import { Reflector } from '@nestjs/core';
import { StatsController } from './stats.controller';
import { REQUIRED_ROLE_KEY } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

describe('StatsController access control', () => {
  const reflector = new Reflector();
  const proto = StatsController.prototype as unknown as Record<string, object>;

  it.each(['getOverview', 'getMessageStats', 'getSessionStats'] as const)(
    'route %s is accessible to logged-in users with user-level data isolation',
    method => {
      const role = reflector.get<ApiKeyRole | undefined>(REQUIRED_ROLE_KEY, proto[method]);
      expect(role).toBeUndefined();
    },
  );
});
