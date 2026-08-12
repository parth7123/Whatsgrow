import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Statistics')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overall or user-scoped statistics' })
  async getOverview(@Query('all') all?: string, @CurrentUser() user?: User) {
    const targetUserId = (all === 'true' && user?.role === UserRole.ADMIN) ? undefined : user?.id;
    return this.statsService.getOverview(targetUserId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get message statistics with time series' })
  async getMessageStats(@Query() query: StatsQueryDto, @CurrentUser() user?: User) {
    const targetUserId = (query.all === 'true' && user?.role === UserRole.ADMIN) ? undefined : user?.id;
    return this.statsService.getMessageStats(query.period || '24h', targetUserId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get statistics for a specific session' })
  async getSessionStats(@Param('sessionId') sessionId: string, @Query('all') all?: string, @CurrentUser() user?: User) {
    const targetUserId = (all === 'true' && user?.role === UserRole.ADMIN) ? undefined : user?.id;
    return this.statsService.getSessionStats(sessionId, targetUserId);
  }
}
