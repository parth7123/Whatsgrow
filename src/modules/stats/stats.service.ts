import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { Message, MessageStatus } from '../message/entities/message.entity';
import { CacheService } from '../../common/cache';

/**
 * SQL for the time-series timestamp bucket, per DB dialect. SQLite has strftime(); Postgres has
 * neither strftime nor a case-insensitive bare `m.createdAt` (unquoted it folds to lowercase and
 * misses the quoted "createdAt" column) — so it needs to_char() with a quoted column. The hour
 * format yields an identical zero-padded, chronologically-sortable label on both engines, so the
 * GROUP BY/ORDER BY on the alias and the downstream map() are unchanged.
 */
export function timeSeriesTimestampSql(dbType: string, interval: 'hour' | 'day'): string {
  if (dbType === 'postgres') {
    const fmt = interval === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 'YYYY-MM-DD';
    return `to_char(m."createdAt", '${fmt}')`;
  }
  const fmt = interval === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d';
  return `strftime('${fmt}', m.createdAt)`;
}

/** SQL for the integer hour-of-day (0-23) bucket, per DB dialect. */
export function hourBucketSql(dbType: string): string {
  return dbType === 'postgres'
    ? `CAST(EXTRACT(HOUR FROM m."createdAt") AS INTEGER)`
    : `CAST(strftime('%H', m.createdAt) AS INTEGER)`;
}

export interface OverviewStats {
  sessions: {
    active: number;
    total: number;
    byStatus: Record<string, number>;
  };
  messages: {
    sent: number;
    received: number;
    delivered: number;
    read: number;
    failed: number;
    today: { sent: number; received: number };
  };
}

export interface TimeSeriesPoint {
  timestamp: string;
  sent: number;
  received: number;
}

export interface MessageStats {
  timeSeries: TimeSeriesPoint[];
  byType: Record<string, number>;
  bySession: Array<{ sessionId: string; name: string; sent: number; received: number }>;
  topChats: Array<{ chatId: string; messageCount: number }>;
}

export interface SessionStats {
  session: { id: string; name: string; status: string };
  messages: { sent: number; received: number; today: number; failed: number };
  topChats: Array<{ chatId: string; count: number; lastActive: string }>;
  hourlyActivity: Array<{ hour: number; sent: number; received: number }>;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Message, 'data')
    private readonly messageRepo: Repository<Message>,
    private readonly cacheService: CacheService,
  ) {}

  /** The data-connection dialect ('sqlite' | 'postgres'), used to pick portable date SQL. */
  private get dataDbType(): string {
    return this.messageRepo.manager.connection.options.type;
  }

  async getOverview(userId?: string): Promise<OverviewStats> {
    const sessionWhere: FindOptionsWhere<Session> = {};
    if (userId) {
      sessionWhere.userId = userId;
    }

    const sessions = await this.sessionRepo.find({ where: sessionWhere });
    const byStatus: Record<string, number> = {};
    let active = 0;

    for (const session of sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
      if (session.status === SessionStatus.READY) active++;
    }

    const sessionIds = sessions.map(s => s.id);

    // If scoped to a non-admin user who has 0 sessions, return zeroed stats
    if (userId && sessionIds.length === 0) {
      return {
        sessions: { active: 0, total: 0, byStatus: {} },
        messages: {
          sent: 0,
          received: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          today: { sent: 0, received: 0 },
        },
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const messageQuery = this.messageRepo
      .createQueryBuilder('m')
      .select('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.direction');

    if (sessionIds.length > 0) {
      messageQuery.where('m.sessionId IN (:...sessionIds)', { sessionIds });
    }

    const messageStats = await messageQuery.getRawMany<{ direction: string; count: string }>();

    const todayQuery = this.messageRepo
      .createQueryBuilder('m')
      .select('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .where('m.createdAt >= :todayStart', { todayStart })
      .groupBy('m.direction');

    if (sessionIds.length > 0) {
      todayQuery.andWhere('m.sessionId IN (:...sessionIds)', { sessionIds });
    }

    const todayStats = await todayQuery.getRawMany<{ direction: string; count: string }>();

    const sent = parseInt(messageStats.find(m => m.direction === 'outgoing')?.count || '0');
    const received = parseInt(messageStats.find(m => m.direction === 'incoming')?.count || '0');
    const todaySent = parseInt(todayStats.find(m => m.direction === 'outgoing')?.count || '0');
    const todayReceived = parseInt(todayStats.find(m => m.direction === 'incoming')?.count || '0');

    let failed = 0;
    let delivered = 0;
    let read = 0;

    if (sessionIds.length > 0) {
      failed = await this.messageRepo.count({
        where: { sessionId: In(sessionIds), status: MessageStatus.FAILED },
      });
      delivered = await this.messageRepo.count({
        where: [
          { sessionId: In(sessionIds), status: MessageStatus.DELIVERED },
          { sessionId: In(sessionIds), status: MessageStatus.READ },
        ],
      });
      read = await this.messageRepo.count({
        where: { sessionId: In(sessionIds), status: MessageStatus.READ },
      });
    } else {
      failed = await this.messageRepo.count({
        where: { status: MessageStatus.FAILED },
      });
      delivered = await this.messageRepo.count({
        where: [{ status: MessageStatus.DELIVERED }, { status: MessageStatus.READ }],
      });
      read = await this.messageRepo.count({
        where: { status: MessageStatus.READ },
      });
    }

    if (!userId) {
      await this.cacheService.setSessionsStats({
        active,
        total: sessions.length,
        byStatus,
      });
    }

    return {
      sessions: {
        active,
        total: sessions.length,
        byStatus,
      },
      messages: {
        sent,
        received,
        delivered,
        read,
        failed,
        today: { sent: todaySent, received: todayReceived },
      },
    };
  }

  async getMessageStats(period: '24h' | '7d' | '30d', userId?: string): Promise<MessageStats> {
    const since = this.getPeriodStart(period);
    const interval = period === '24h' ? 'hour' : 'day';

    const sessionWhere: FindOptionsWhere<Session> = {};
    if (userId) {
      sessionWhere.userId = userId;
    }

    const sessions = await this.sessionRepo.find({ where: sessionWhere });
    const sessionIds = sessions.map(s => s.id);

    if (userId && sessionIds.length === 0) {
      return {
        timeSeries: [],
        byType: {},
        bySession: [],
        topChats: [],
      };
    }

    // Time series
    const timeSeries = await this.getTimeSeries(since, interval, sessionIds);

    // By type
    const byTypeQuery = this.messageRepo
      .createQueryBuilder('m')
      .select('m.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('m.createdAt >= :since', { since })
      .groupBy('m.type');

    if (sessionIds.length > 0) {
      byTypeQuery.andWhere('m.sessionId IN (:...sessionIds)', { sessionIds });
    }

    const byTypeRaw = await byTypeQuery.getRawMany<{ type: string; count: string }>();

    const byType: Record<string, number> = {};
    for (const row of byTypeRaw) {
      byType[row.type || 'unknown'] = parseInt(row.count);
    }

    // By session
    const bySessionQuery = this.messageRepo
      .createQueryBuilder('m')
      .select('m.sessionId', 'sessionId')
      .addSelect('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .where('m.createdAt >= :since', { since })
      .groupBy('m.sessionId')
      .addGroupBy('m.direction');

    if (sessionIds.length > 0) {
      bySessionQuery.andWhere('m.sessionId IN (:...sessionIds)', { sessionIds });
    }

    const bySessionRaw = await bySessionQuery.getRawMany<{ sessionId: string; direction: string; count: string }>();

    const sessionMap = new Map<string, { sent: number; received: number }>();
    for (const row of bySessionRaw) {
      if (!sessionMap.has(row.sessionId)) {
        sessionMap.set(row.sessionId, { sent: 0, received: 0 });
      }
      const entry = sessionMap.get(row.sessionId)!;
      if (row.direction === 'outgoing') entry.sent = parseInt(row.count);
      else entry.received = parseInt(row.count);
    }

    const sessionNames = new Map(sessions.map(s => [s.id, s.name]));

    const bySession = Array.from(sessionMap.entries()).map(([sessionId, stats]) => ({
      sessionId,
      name: sessionNames.get(sessionId) || 'Unknown',
      ...stats,
    }));

    // Top chats
    const topChatsQuery = this.messageRepo
      .createQueryBuilder('m')
      .select('m.chatId', 'chatId')
      .addSelect('COUNT(*)', 'messageCount')
      .where('m.createdAt >= :since', { since })
      .groupBy('m.chatId')
      .orderBy('messageCount', 'DESC')
      .limit(10);

    if (sessionIds.length > 0) {
      topChatsQuery.andWhere('m.sessionId IN (:...sessionIds)', { sessionIds });
    }

    const topChats = await topChatsQuery.getRawMany<{ chatId: string; messageCount: string }>();

    return {
      timeSeries,
      byType,
      bySession,
      topChats: topChats.map(c => ({
        chatId: c.chatId,
        messageCount: parseInt(c.messageCount),
      })),
    };
  }

  async getSessionStats(sessionId: string, userId?: string): Promise<SessionStats> {
    const where: FindOptionsWhere<Session> = { id: sessionId };
    if (userId) {
      where.userId = userId;
    }
    const session = await this.sessionRepo.findOne({ where });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Message counts
    const stats = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.direction', 'direction')
      .addSelect('COUNT(*)', 'count')
      .where('m.sessionId = :sessionId', { sessionId })
      .groupBy('m.direction')
      .getRawMany<{ direction: string; count: string }>();

    const todayCount = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.sessionId = :sessionId', { sessionId })
      .andWhere('m.createdAt >= :todayStart', { todayStart })
      .getCount();

    const sent = parseInt(stats.find(s => s.direction === 'outgoing')?.count || '0');
    const received = parseInt(stats.find(s => s.direction === 'incoming')?.count || '0');

    // Count failed messages for this session
    const failed = await this.messageRepo.count({
      where: { sessionId, status: MessageStatus.FAILED },
    });

    // Top chats for this session
    const topChats = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.chatId', 'chatId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(m.createdAt)', 'lastActive')
      .where('m.sessionId = :sessionId', { sessionId })
      .groupBy('m.chatId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{ chatId: string; count: string; lastActive: string }>();

    // Hourly activity (last 24h)
    const hourlyActivity = await this.getHourlyActivity(sessionId);

    return {
      session: { id: session.id, name: session.name, status: session.status },
      messages: { sent, received, today: todayCount, failed },
      topChats: topChats.map(c => ({
        chatId: c.chatId,
        count: parseInt(c.count),
        lastActive: c.lastActive,
      })),
      hourlyActivity,
    };
  }

  private getPeriodStart(period: '24h' | '7d' | '30d'): Date {
    const now = new Date();
    switch (period) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private async getTimeSeries(since: Date, interval: 'hour' | 'day', sessionIds?: string[]): Promise<TimeSeriesPoint[]> {
    const query = this.messageRepo
      .createQueryBuilder('m')
      .select(timeSeriesTimestampSql(this.dataDbType, interval), 'bucket')
      .addSelect(`SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END)`, 'sent')
      .addSelect(`SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END)`, 'received')
      .where('m.createdAt >= :since', { since });

    if (sessionIds && sessionIds.length > 0) {
      query.andWhere('m.sessionId IN (:...sessionIds)', { sessionIds });
    }

    const raw = await query
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: string; sent: string; received: string }>();

    return raw.map(r => ({
      timestamp: r.bucket,
      sent: parseInt(r.sent || '0'),
      received: parseInt(r.received || '0'),
    }));
  }

  private async getHourlyActivity(sessionId: string): Promise<Array<{ hour: number; sent: number; received: number }>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const raw = await this.messageRepo
      .createQueryBuilder('m')
      .select(hourBucketSql(this.dataDbType), 'hour')
      .addSelect(`SUM(CASE WHEN m.direction = 'outgoing' THEN 1 ELSE 0 END)`, 'sent')
      .addSelect(`SUM(CASE WHEN m.direction = 'incoming' THEN 1 ELSE 0 END)`, 'received')
      .where('m.sessionId = :sessionId', { sessionId })
      .andWhere('m.createdAt >= :since', { since })
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany<{ hour: string; sent: string; received: string }>();

    // Fill in missing hours
    const result: Array<{ hour: number; sent: number; received: number }> = [];
    const hourMap = new Map(raw.map(r => [parseInt(r.hour), r]));

    for (let h = 0; h < 24; h++) {
      const data = hourMap.get(h);
      result.push({
        hour: h,
        sent: data ? parseInt(data.sent || '0') : 0,
        received: data ? parseInt(data.received || '0') : 0,
      });
    }

    return result;
  }
}
