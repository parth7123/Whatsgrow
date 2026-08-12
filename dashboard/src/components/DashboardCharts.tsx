import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useStatsMessagesQuery } from '../hooks/queries';
import { SkeletonChart } from './SkeletonLoader';
import { marketingApi, type StatsPeriod } from '../services/api';
import './DashboardCharts.css';

const PERIODS: StatsPeriod[] = ['24h', '7d', '30d'];

// Message type colors
const TYPE_COLORS: Record<string, string> = {
  text: '#25d366',
  image: '#3b82f6',
  contact: '#a855f7',
  document: '#f59e0b',
  audio: '#06b6d4',
  voice: '#ec4899',
  video: '#14b8a6',
  sticker: '#ef4444',
  location: '#84cc16',
  revoked: '#f43f5e',
  unknown: '#64748b',
};

const KNOWN_GRADIENTS = ['text', 'image', 'contact', 'document', 'audio', 'voice', 'video', 'sticker', 'location', 'unknown'];

const FALLBACK_COLORS = ['#0ea5e9', '#d946ef', '#f97316', '#10b981', '#6366f1', '#eab308'];
function colorForType(name: string): string {
  if (TYPE_COLORS[name]) return TYPE_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function formatTick(ts: string, period: StatsPeriod): string {
  return period === '24h' ? ts.slice(11, 16) : ts.slice(5);
}

// Format raw digits into standard international phone format with + and spacing
function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return raw;

  if (digits.length === 12 && digits.startsWith('91')) {
    // India phone format: +91 81601 63896
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    // US / Canada format: +1 (800) 555-0199
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 7 && digits.length <= 15) {
    if (digits.length > 10) {
      return `+${digits.slice(0, digits.length - 10)} ${digits.slice(digits.length - 10, digits.length - 5)} ${digits.slice(digits.length - 5)}`;
    }
    return `+${digits}`;
  }
  return `+${digits}`;
}

// Format raw WhatsApp chat IDs into clean phone numbers or saved contact names
function formatChatDisplayName(chatId: string, contactsMap: Map<string, string>): string {
  if (!chatId) return '';

  const rawId = chatId.split('@')[0] || chatId;
  const digits = rawId.replace(/[^0-9]/g, '');

  // 1. Saved contact name lookup
  if (digits && contactsMap.has(digits)) {
    return contactsMap.get(digits)!;
  }

  // 2. WhatsApp Group
  if (chatId.endsWith('@g.us') || chatId.includes('@g.us')) {
    return `Group (${rawId.slice(0, 8)})`;
  }

  // 3. WhatsApp Linked Device (LID)
  if (chatId.endsWith('@lid') || chatId.includes('@lid') || (digits.length >= 14 && !chatId.includes('@c.us'))) {
    return digits ? `Contact (...${digits.slice(-4)})` : 'Contact';
  }

  // 4. Standard phone number with +
  if (digits) {
    return formatPhoneNumber(digits);
  }

  return rawId;
}

const customTooltipStyle = {
  background: 'var(--glass-bg-tooltip, rgba(15, 23, 42, 0.92))',
  border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
  borderRadius: '10px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
  color: '#ffffff',
  fontSize: '12px',
  padding: '8px 12px',
};

export function DashboardCharts() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<StatsPeriod>('7d');
  const { data, isLoading, isError } = useStatsMessagesQuery(period);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => marketingApi.getContacts().catch(() => []),
    staleTime: 60000,
  });

  const contactsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts) {
      if (!c) continue;
      const name = (c.name || '').trim();
      if (!name) continue;
      if (c.phoneNumber) {
        const digits = c.phoneNumber.replace(/[^0-9]/g, '');
        if (digits) map.set(digits, name);
      }
      if (c.id) {
        const digits = String(c.id).replace(/@c\.us|@s\.whatsapp\.net|@lid/g, '').replace(/[^0-9]/g, '');
        if (digits) map.set(digits, name);
      }
    }
    return map;
  }, [contacts]);

  const timeSeries = (data?.timeSeries ?? []).map(p => ({ ...p, label: formatTick(p.timestamp, period) }));
  const byType = Object.entries(data?.byType ?? {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const totalTypeMessages = useMemo(() => byType.reduce((sum, item) => sum + item.value, 0), [byType]);

  if (isError) return null;

  const topChats = (data?.topChats ?? [])
    .slice(0, 8)
    .map(c => ({ name: formatChatDisplayName(c.chatId, contactsMap), count: c.messageCount }));
  const hasData = timeSeries.length > 0 || byType.length > 0 || topChats.length > 0;

  return (
    <section className="dashboard-charts">
      <div className="charts-header">
        <div className="charts-title">
          <BarChart3 size={18} />
          <h2>{t('dashboard.charts.title')}</h2>
        </div>
        <div className="period-toggle" role="group" aria-label={t('dashboard.charts.title')}>
          {PERIODS.map(p => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              className={`period-tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {t(`dashboard.charts.period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonChart height={280} />
      ) : !hasData ? (
        <div className="charts-empty">{t('dashboard.charts.empty')}</div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card chart-wide">
            <h3>{t('dashboard.charts.overTime')}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timeSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25d366" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border, var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="sent"
                  name={t('dashboard.charts.sent')}
                  stroke="#25d366"
                  fill="url(#gSent)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  name={t('dashboard.charts.received')}
                  stroke="#3b82f6"
                  fill="url(#gReceived)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>{t('dashboard.charts.byType')}</h3>
            {byType.length === 0 ? (
              <div className="charts-empty small">{t('dashboard.charts.empty')}</div>
            ) : (
              <div className="pie-chart-wrapper">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <defs>
                      <filter id="glassPieGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.3" />
                      </filter>
                      <linearGradient id="pieGrad_text" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#25d366" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <linearGradient id="pieGrad_image" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                      <linearGradient id="pieGrad_video" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#2dd4bf" />
                      </linearGradient>
                      <linearGradient id="pieGrad_audio" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                      <linearGradient id="pieGrad_document" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                      <linearGradient id="pieGrad_contact" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                      <linearGradient id="pieGrad_voice" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#f472b6" />
                      </linearGradient>
                      <linearGradient id="pieGrad_sticker" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#f87171" />
                      </linearGradient>
                      <linearGradient id="pieGrad_location" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#84cc16" />
                        <stop offset="100%" stopColor="#a3e635" />
                      </linearGradient>
                      <linearGradient id="pieGrad_unknown" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#94a3b8" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={byType}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy={105}
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={4}
                      cornerRadius={6}
                      stroke="var(--glass-border, rgba(255, 255, 255, 0.2))"
                      strokeWidth={1.5}
                      style={{ filter: 'url(#glassPieGlow)' }}
                    >
                      {byType.map(entry => (
                        <Cell
                          key={entry.name}
                          fill={KNOWN_GRADIENTS.includes(entry.name) ? `url(#pieGrad_${entry.name})` : colorForType(entry.name)}
                        />
                      ))}
                    </Pie>
                    {/* Center Text Stats - Locked to cy={105} */}
                    <text
                      x="50%"
                      y={105}
                      dy="-3"
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize="20"
                      fontWeight="800"
                      letterSpacing="-0.02em"
                    >
                      {totalTypeMessages}
                    </text>
                    <text
                      x="50%"
                      y={105}
                      dy="16"
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="10"
                      fontWeight="700"
                      letterSpacing="0.08em"
                    >
                      TOTAL
                    </text>
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="chart-card">
            <h3>{t('dashboard.charts.topChats')}</h3>
            {topChats.length === 0 ? (
              <div className="charts-empty small">{t('dashboard.charts.empty')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topChats} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="topChatsBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#25d366" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border, var(--border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--text-primary)' }}
                  />
                  <Tooltip
                    contentStyle={customTooltipStyle}
                    formatter={(value: any) => [`${value} ${t('dashboard.charts.messages')}`, t('dashboard.charts.messages') || 'Messages']}
                  />
                  <Bar
                    dataKey="count"
                    name={t('dashboard.charts.messages')}
                    fill="url(#topChatsBarGradient)"
                    radius={[0, 8, 8, 0]}
                    style={{ filter: 'drop-shadow(0px 3px 6px rgba(37, 211, 102, 0.3))' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
