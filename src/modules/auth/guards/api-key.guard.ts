import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY, SESSION_SCOPED_KEY } from '../decorators/auth.decorators';
import { resolveClientIp } from '../../../common/utils/ip';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = this.extractApiKey(request);

    if (!apiKeyHeader) {
      throw new UnauthorizedException('API key is required');
    }

    let requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Fail-safe secure default when @RequireRole is omitted:
    // State-mutating methods require at least OPERATOR, read-only methods require VIEWER.
    if (!requiredRole) {
      const method = (request.method || 'GET').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        requiredRole = ApiKeyRole.OPERATOR;
      } else {
        requiredRole = ApiKeyRole.VIEWER;
      }
    }

    // Resolve the session id used for the key's allowedSessions scope. `:sessionId` is always a
    // session; the bare `:id` param is only a session on controllers marked @SessionScoped (i.e.
    // SessionController) — on other routes `:id` is an unrelated resource id (API key, plugin, …)
    // and must NOT be fed to the allowedSessions check, which would spuriously deny a scoped key.
    const sessionScoped = this.reflector.getAllAndOverride<boolean>(SESSION_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const sessionId = (request.params['sessionId'] || (sessionScoped ? request.params['id'] : undefined)) as
      | string
      | undefined;
    const clientIp = this.getClientIp(request);

    // Validate API key
    const apiKey = await this.authService.validateApiKey(apiKeyHeader, clientIp, sessionId);

    if (!this.authService.hasPermission(apiKey, requiredRole)) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    // Prevent session-scoped keys from creating global resources (e.g. POST /sessions)
    if (sessionScoped && !sessionId && ['POST', 'PUT', 'PATCH', 'DELETE'].includes((request.method || 'GET').toUpperCase())) {
      if (apiKey.allowedSessions && apiKey.allowedSessions.length > 0) {
        throw new ForbiddenException('Session-scoped API keys cannot perform global session operations');
      }
    }

    // Attach API key to request for use in controllers
    (request as Request & { apiKey: typeof apiKey }).apiKey = apiKey;

    // Attach User to request if the key belongs to a specific user
    if (apiKey.user) {
      const incomingToken = request.headers['x-login-token'] as string | undefined;
      // If the user currently has an active login token, OR the client supplies an X-Login-Token header,
      // strictly enforce that both exist and exactly match.
      if (apiKey.user.activeLoginToken || incomingToken) {
        if (!incomingToken || !apiKey.user.activeLoginToken || incomingToken !== apiKey.user.activeLoginToken) {
          throw new UnauthorizedException('Session expired or invalid login token');
        }
      }
      (request as Request & { user: any }).user = apiKey.user;
    }

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Support both X-API-Key header and Authorization Bearer
    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) return xApiKey;

    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }

  /**
   * Resolve the real client IP used for the API key's allowedIps whitelist.
   *
   * X-Forwarded-For is client-controllable, so it is only honored when the
   * request actually arrives from a configured trusted proxy (TRUSTED_PROXIES).
   * With no trusted proxies configured, the header is ignored entirely and the
   * direct socket address is used — preventing IP-whitelist spoofing.
   */
  private getClientIp(request: Request): string {
    const trustedProxies = this.configService.get<string[]>('security.trustedProxies') ?? [];
    return resolveClientIp(request, trustedProxies);
  }
}
