import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../modules/auth/auth.service';
import { ApiKeyRole } from '../../modules/auth/entities/api-key.entity';
import { resolveClientIp } from '../utils/ip';

/**
 * Protects the Bull Board UI (/admin/queues).
 *
 * Bull Board is mounted as raw Express middleware by @bull-board/nestjs, so the
 * global ApiKeyGuard — which only runs on Nest controller handlers — does not
 * cover it. This middleware requires a valid ADMIN-role API key, supplied via
 * the X-API-Key header or an Authorization: Bearer token.
 *
 * The ?apiKey query-string fallback was removed: an ADMIN key in the
 * URL leaks into proxy/access logs, browser history, bookmarks, and the Referer header.
 */
@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawKey = this.extractKey(req);
      if (!rawKey) {
        res.status(401).json({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'API key or session token is required to access the queue dashboard. Supply ?apiKey=YOUR_KEY or ?token=YOUR_TOKEN',
        });
        return;
      }

      const apiKey = await this.authService.validateKeyOrToken(rawKey, this.getClientIp(req));
      if (!this.authService.hasPermission(apiKey, ApiKeyRole.ADMIN)) {
        res.status(403).json({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Admin role required to access the queue dashboard',
        });
        return;
      }

      res.setHeader('Set-Cookie', `owa_bull_auth=${encodeURIComponent(rawKey)}; Path=/api/admin/queues; HttpOnly; SameSite=Lax`);

      next();
    } catch (err: any) {
      res.status(err?.status || 401).json({
        statusCode: err?.status || 401,
        error: err?.name || 'Unauthorized',
        message: err?.message || 'Authentication failed',
      });
    }
  }

  private extractKey(req: Request): string | undefined {
    const header = req.headers['x-api-key'];
    if (typeof header === 'string' && header) return header;

    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

    if (typeof req.query?.apiKey === 'string' && req.query.apiKey) return req.query.apiKey;
    if (typeof req.query?.token === 'string' && req.query.token) return req.query.token;

    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
      const match = cookieHeader.match(/owa_bull_auth=([^;]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }

    return undefined;
  }

  private getClientIp(req: Request): string {
    // Mirror the ApiKeyGuard's IP model so allowedIps is enforced consistently for the queue UI:
    // X-Forwarded-For is honored only behind a configured trusted proxy.
    const trustedProxies = this.configService.get<string[]>('security.trustedProxies') ?? [];
    return resolveClientIp(req, trustedProxies);
  }
}
