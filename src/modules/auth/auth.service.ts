import { Injectable, NotFoundException, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { writeSecretFile } from '../../common/utils/secret-file';
import { hashApiKey } from './api-key-hash';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { createLogger } from '../../common/services/logger.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

const API_KEY_FILE = join(process.cwd(), 'data', '.api-key');

/**
 * Resolves the API key to seed on first boot (when no keys exist yet).
 * Precedence: an explicit `API_MASTER_KEY` always wins; otherwise a
 * cryptographically random `owa_k1_` key is generated — the secure default,
 * including in non-production. The legacy fixed `dev-admin-key` is used only when
 * a developer explicitly opts in with `ALLOW_DEV_API_KEY=true`, never by default.
 */
export function resolveSeedApiKey(): string {
  if (process.env.API_MASTER_KEY) {
    return process.env.API_MASTER_KEY;
  }
  if (process.env.ALLOW_DEV_API_KEY === 'true' && process.env.NODE_ENV === 'test') {
    return 'dev-admin-key';
  }
  return `owa_k1_${randomBytes(32).toString('hex')}`;
}

/**
 * The line to print for the API key in the startup banner. The full raw key is shown ONLY when it was
 * just created (first run, when the operator needs to capture it once). On every subsequent boot the
 * key is masked to a short non-secret fingerprint, so the live admin key is not re-written to the log
 * pipeline (Docker/Loki/CloudWatch) on each restart — it stays in `data/.api-key` (0600) and the
 * dashboard. A placeholder (e.g. "(check dashboard for keys)") is passed through unchanged.
 */
export function bannerKeyLine(displayKey: string, isNewKey: boolean): string {
  if (isNewKey) return displayKey;
  if (displayKey.startsWith('(')) return displayKey;
  return `${displayKey.slice(0, 8)}… (full key in data/.api-key or the dashboard)`;
}

import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = createLogger('AuthService');

  /** Coalesce per-request usage-stat writes to at most one DB write per key per window. */
  private static readonly STAT_FLUSH_INTERVAL_MS = 60_000;
  /** keyId -> usage increments observed but not yet persisted (flushed on the next windowed write). */
  private readonly pendingUsage = new Map<string, number>();

  constructor(
    @InjectRepository(ApiKey, 'main')
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly usersService: UsersService,
  ) { }

  async onModuleInit(): Promise<void> {
    // Ensure default admin user exists and password hash matches
    let adminUser = await this.usersService.findByUsername('admin');
    const expectedAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!adminUser) {
      adminUser = await this.usersService.create({
        username: 'admin',
        passwordHash: expectedAdminPassword,
        role: UserRole.ADMIN,
        isActive: true,
      });
      this.logger.log('  👤 Seeded default admin user (username: "admin")');
    } else {
      const matches = await bcrypt.compare(expectedAdminPassword, adminUser.passwordHash).catch(() => false);
      if (!matches) {
        adminUser = await this.usersService.update(adminUser.id, { passwordHash: expectedAdminPassword });
        this.logger.log('  👤 Reset admin password to default ("admin123")');
      }
    }

    // Seed a default API key if none exist
    const count = await this.apiKeyRepository.count();
    let displayKey: string;
    let isNewKey = false;

    if (count === 0) {
      displayKey = resolveSeedApiKey();

      await this.seedApiKey(displayKey, 'Default Admin Key', ApiKeyRole.ADMIN, adminUser.id);
      isNewKey = true;

      // Save raw key to file for startup script to read (owner-only — it's the raw admin key).
      try {
        writeSecretFile(API_KEY_FILE, displayKey);
      } catch (err) {
        this.logger.warn('Could not save API key file', { error: String(err) });
      }
    } else {
      // Read saved API key from file if exists
      if (existsSync(API_KEY_FILE)) {
        try {
          displayKey = readFileSync(API_KEY_FILE, 'utf-8').trim();
        } catch (error) {
          this.logger.warn(`Failed to read API key file: ${API_KEY_FILE}`, { error: String(error) });
          displayKey = '(check dashboard for keys)';
        }
      } else {
        displayKey = '(check dashboard for keys)';
      }

      // Backfill any unlinked API keys to the admin user
      const unlinkedKeys = await this.apiKeyRepository.find({ where: { userId: null as any } });
      for (const key of unlinkedKeys) {
        key.userId = adminUser.id;
        await this.apiKeyRepository.save(key);
      }
    }

    // Always show the welcome banner on startup
    const apiBaseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 2785}`;
    // The dashboard is served by NestJS at the same origin as the API now, so default to it.
    const dashboardUrl = process.env.DASHBOARD_URL || apiBaseUrl;

    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
    this.logger.log('  🟢 Welcome to WhatsGrow - WhatsApp API Gateway');
    this.logger.log('');
    this.logger.log(`  📊 Dashboard: ${dashboardUrl}`);
    this.logger.log(`  📚 API Docs:  ${apiBaseUrl}/api/docs`);
    this.logger.log('');
    this.logger.log('  👤 Admin Login:');
    this.logger.log('     Username: admin');
    this.logger.log(`     Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    this.logger.log('');
    if (isNewKey) {
      this.logger.log('  🔑 API Key (newly created):');
    } else {
      this.logger.log('  🔑 API Key:');
    }
    this.logger.log(`     ${bannerKeyLine(displayKey, isNewKey)}`);
    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
  }

  private async seedApiKey(rawKey: string, name: string, role: ApiKeyRole, userId?: string): Promise<ApiKey> {
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      name,
      keyHash,
      keyPrefix,
      key: rawKey,
      role,
      userId: userId || null,
    });

    return this.apiKeyRepository.save(apiKey);
  }

  async createApiKey(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKey; rawKey: string }> {
    // Generate secure random key: owa_k1_<32 bytes hex>
    const rawKey = `owa_k1_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      name: dto.name,
      keyHash,
      keyPrefix,
      key: rawKey,
      role: dto.role || ApiKeyRole.OPERATOR,
      allowedIps: dto.allowedIps || null,
      allowedSessions: dto.allowedSessions || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      userId: dto.userId || null,
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    this.logger.log(`API key created: ${saved.name}`, {
      keyId: saved.id,
      role: saved.role,
      action: 'api_key_created',
    });

    return { apiKey: saved, rawKey };
  }

  async findAll(): Promise<ApiKey[]> {
    const keys = await this.apiKeyRepository.find({
      order: { createdAt: 'DESC' },
    });

    // Backfill any pre-existing key records where key is null
    for (const apiKey of keys) {
      if (!apiKey.key) {
        let fullKey: string | null = null;
        if (apiKey.name === 'Default Admin Key' && existsSync(API_KEY_FILE)) {
          try {
            fullKey = readFileSync(API_KEY_FILE, 'utf-8').trim();
          } catch { }
        }
        if (!fullKey) {
          fullKey = `${apiKey.keyPrefix || 'owa_k1_'}${randomBytes(24).toString('hex')}`;
          apiKey.keyHash = this.hashKey(fullKey);
        }
        apiKey.key = fullKey;
        try {
          await this.apiKeyRepository.update(apiKey.id, {
            key: apiKey.key,
            keyHash: apiKey.keyHash,
          });
        } catch (err) {
          this.logger.warn(`Could not backfill raw key for ${apiKey.name}: ${err}`);
        }
      }
    }

    return keys;
  }

  async findOne(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }
    return apiKey;
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey> {
    const apiKey = await this.findOne(id);

    if (dto.name) apiKey.name = dto.name;
    if (dto.role) apiKey.role = dto.role;
    if (dto.allowedIps !== undefined) apiKey.allowedIps = dto.allowedIps;
    if (dto.allowedSessions !== undefined) apiKey.allowedSessions = dto.allowedSessions;
    if (dto.expiresAt !== undefined) apiKey.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.apiKeyRepository.save(apiKey);
  }

  async delete(id: string): Promise<void> {
    const apiKey = await this.findOne(id);
    // Drop any un-flushed usage accumulator so a deleted key leaves nothing behind in the Map.
    this.pendingUsage.delete(id);
    await this.apiKeyRepository.remove(apiKey);
    this.logger.log(`API key deleted: ${apiKey.name}`, {
      keyId: id,
      action: 'api_key_deleted',
    });
  }

  async revoke(id: string): Promise<ApiKey> {
    const apiKey = await this.findOne(id);
    // A revoked key fails validation before its next flush, so its accumulator would orphan —
    // drop it here.
    this.pendingUsage.delete(id);
    apiKey.isActive = false;
    return this.apiKeyRepository.save(apiKey);
  }

  async validateApiKey(rawKey: string, clientIp?: string, sessionId?: string): Promise<ApiKey> {
    const keyHash = this.hashKey((rawKey || '').trim());
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash },
      relations: ['user'],
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKey.isActive) {
      throw new UnauthorizedException('API key is revoked');
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException('API key has expired');
    }

    if (apiKey.user) {
      if (!apiKey.user.isActive) {
        throw new UnauthorizedException('User account is disabled');
      }
      if (apiKey.user.expiresAt && new Date(apiKey.user.expiresAt).getTime() < Date.now()) {
        throw new UnauthorizedException('User account has expired');
      }
    }

    // Check IP whitelist (fail closed: if a whitelist is configured but the client
    // IP could not be determined, reject rather than silently skipping the check)
    if (apiKey.allowedIps && apiKey.allowedIps.length > 0) {
      if (!clientIp) {
        throw new UnauthorizedException('Client IP could not be determined');
      }
      if (!this.isIpAllowed(clientIp, apiKey.allowedIps)) {
        this.logger.warn(`IP not allowed: ${clientIp}`, {
          keyId: apiKey.id,
          action: 'ip_rejected',
        });
        throw new UnauthorizedException('IP address not allowed');
      }
    }

    // Check session restriction
    if (apiKey.allowedSessions && apiKey.allowedSessions.length > 0 && sessionId) {
      if (!apiKey.allowedSessions.includes(sessionId)) {
        throw new UnauthorizedException('API key not authorized for this session');
      }
    }

    // Update usage stats — coalesced. Validation above is unchanged/synchronous; only
    // the stat WRITE is throttled to at most once per key per window. usageCount stays
    // accurate via an in-memory accumulator; the returned object reflects the true count.
    const pending = (this.pendingUsage.get(apiKey.id) ?? 0) + 1;
    const previousLastUsedAt = apiKey.lastUsedAt;
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount += pending; // DB value + all not-yet-persisted increments (incl. this request)

    const due =
      !previousLastUsedAt ||
      apiKey.lastUsedAt.getTime() - previousLastUsedAt.getTime() >= AuthService.STAT_FLUSH_INTERVAL_MS;

    if (due) {
      this.pendingUsage.set(apiKey.id, 0);
      try {
        await this.apiKeyRepository.update(apiKey.id, {
          lastUsedAt: apiKey.lastUsedAt,
          usageCount: apiKey.usageCount,
        });
      } catch (error) {
        this.logger.error(`Failed to flush usage stats for key ${apiKey.id}`, String(error));
        this.pendingUsage.set(apiKey.id, pending);
      }
    } else {
      this.pendingUsage.set(apiKey.id, pending);
    }

    return apiKey;
  }

  async validateKeyOrToken(keyOrToken: string, clientIp?: string): Promise<ApiKey> {
    const cleanStr = (keyOrToken || '').trim();
    if (!cleanStr) {
      throw new UnauthorizedException('API key or login token is required');
    }

    try {
      return await this.validateApiKey(cleanStr, clientIp);
    } catch {
      const user = await this.usersService.findByActiveLoginToken(cleanStr);
      if (user && user.isActive) {
        const userApiKey = await this.apiKeyRepository.findOne({
          where: { userId: user.id, isActive: true },
        });
        if (userApiKey) {
          return userApiKey;
        }
        return {
          id: 'session-' + user.id,
          name: user.username,
          role: (user.role as unknown as ApiKeyRole) || ApiKeyRole.ADMIN,
          user,
          isActive: true,
        } as ApiKey;
      }
      throw new UnauthorizedException('Invalid API key or session token');
    }
  }

  async login(
    username: string,
    passwordPlain: string,
    rawKey: string,
  ): Promise<{ valid: boolean; role?: string; user?: any; webhooksEnabled?: boolean; loginToken?: string }> {
    const cleanUsername = (username || '').trim();
    const cleanPassword = (passwordPlain || '').trim();
    const cleanKey = (rawKey || '').trim();

    // First validate the API key (this handles expiration, revocation, etc)
    const apiKey = await this.validateApiKey(cleanKey);

    if (!apiKey.user) {
      throw new UnauthorizedException('API key is not associated with a user account');
    }

    if (apiKey.user.username !== cleanUsername) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(cleanPassword, apiKey.user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const loginToken = randomUUID();
    await this.usersService.update(apiKey.user.id, { activeLoginToken: loginToken });
    apiKey.user.activeLoginToken = loginToken;

    return { valid: true, role: apiKey.role, user: apiKey.user, webhooksEnabled: apiKey.user.webhooksEnabled, loginToken };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.update(userId, { activeLoginToken: null });
  }

  private hashKey(rawKey: string): string {
    return hashApiKey(rawKey, process.env.API_KEY_PEPPER);
  }

  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    // Support both exact match and CIDR notation
    for (const entry of allowedIps) {
      if (entry.includes('/')) {
        // CIDR notation (e.g., "10.0.0.0/24")
        if (this.ipInCidr(clientIp, entry)) {
          return true;
        }
      } else {
        // Exact match
        if (clientIp === entry) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if an IPv4 address is within a CIDR range
   * @param ip - Client IP address (e.g., "192.168.1.100")
   * @param cidr - CIDR notation (e.g., "192.168.1.0/24")
   */
  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bitsStr] = cidr.split('/');
      const bits = parseInt(bitsStr, 10);

      if (isNaN(bits) || bits < 0 || bits > 32) {
        return false;
      }

      const mask = ~(2 ** (32 - bits) - 1);
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);

      return (ipNum & mask) === (rangeNum & mask);
    } catch (error) {
      this.logger.warn(`Invalid CIDR format: ${cidr}`, { error: String(error) });
      return false;
    }
  }

  /**
   * Convert IPv4 address string to 32-bit number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;

    return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean {
    const roleHierarchy: Record<ApiKeyRole, number> = {
      [ApiKeyRole.VIEWER]: 1,
      [ApiKeyRole.OPERATOR]: 2,
      [ApiKeyRole.ADMIN]: 3,
    };

    return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
  }
}
