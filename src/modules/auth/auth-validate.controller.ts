import { Controller, Post, Headers, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { createLogger } from '../../common/services/logger.service';
import { Public, CurrentApiKey, RequireRole } from './decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthValidateController {
  private readonly logger = createLogger('AuthValidateController');

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username, password, and API key' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: Record<string, string>,
  ): Promise<{ valid: boolean; role?: string; webhooksEnabled?: boolean; loginToken?: string; message?: string }> {
    const { username, password, apiKey } = body;
    if (!username || !password || !apiKey) {
      return { valid: false, message: 'Username, password, and API key are required.' };
    }

    try {
      const result = await this.authService.login(username, password, apiKey);
      return { valid: true, role: result.role, webhooksEnabled: result.webhooksEnabled, loginToken: result.loginToken };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid API key';
      this.logger.warn('Login failed', { error: errorMessage });
      return { valid: false, message: errorMessage };
    }
  }

  @Post('logout')
  @RequireRole(ApiKeyRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate active login token on server' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@CurrentApiKey() apiKey?: ApiKey): Promise<{ success: boolean }> {
    if (apiKey?.user) {
      await this.authService.logout(apiKey.user.id);
    }
    return { success: true };
  }

  @Post('validate')
  @RequireRole(ApiKeyRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an API key' })
  @ApiHeader({ name: 'X-API-Key', description: 'API key to validate' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  async validate(
    @CurrentApiKey() currentApiKey?: ApiKey,
    @Headers('x-api-key') headerKey?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ valid: boolean; role?: string; webhooksEnabled?: boolean }> {
    if (currentApiKey && currentApiKey.isActive) {
      return { valid: true, role: currentApiKey.role, webhooksEnabled: currentApiKey.user?.webhooksEnabled };
    }

    const rawKey = headerKey || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined);
    if (!rawKey) {
      return { valid: false };
    }

    try {
      const keyEntity = await this.authService.validateApiKey(rawKey);
      if (keyEntity && keyEntity.isActive) {
        return { valid: true, role: keyEntity.role, webhooksEnabled: keyEntity.user?.webhooksEnabled };
      }
      return { valid: false };
    } catch (error) {
      this.logger.warn('API key validation error', { error: error instanceof Error ? error.message : String(error) });
      return { valid: false };
    }
  }
}
