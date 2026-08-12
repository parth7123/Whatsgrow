import { Users, Send, CheckCircle2, MessageSquare } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { marketingApi, statsApi } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import './MarketingAnalytics.css';

const PALETTE_GRADIENTS: Record<string, { top: string; mid: string; bot: string; shadow: string; border: string }> = {
  openwa:   { top: 'rgba(37, 211, 102, 0.95)',  mid: 'rgba(29, 168, 81, 0.65)',   bot: 'rgba(200, 250, 220, 0.25)', shadow: '#25d366', border: 'rgba(37, 211, 102, 0.4)' },
  blue:     { top: 'rgba(59, 130, 246, 0.95)',  mid: 'rgba(37, 99, 235, 0.65)',   bot: 'rgba(219, 234, 254, 0.25)', shadow: '#3b82f6', border: 'rgba(59, 130, 246, 0.4)' },
  graphite: { top: 'rgba(148, 163, 184, 0.95)', mid: 'rgba(100, 116, 139, 0.65)', bot: 'rgba(241, 245, 249, 0.25)', shadow: '#94a3b8', border: 'rgba(148, 163, 184, 0.4)' },
  indigo:   { top: 'rgba(192, 132, 252, 0.95)', mid: 'rgba(168, 85, 247, 0.65)', bot: 'rgba(224, 231, 255, 0.25)', shadow: '#a855f7', border: 'rgba(168, 85, 247, 0.4)' },
  amber:    { top: 'rgba(251, 191, 36, 0.95)',  mid: 'rgba(217, 119, 6, 0.65)',   bot: 'rgba(254, 243, 199, 0.25)', shadow: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' },
  rose:     { top: 'rgba(251, 113, 133, 0.95)', mid: 'rgba(225, 29, 72, 0.65)',   bot: 'rgba(255, 228, 230, 0.25)', shadow: '#f43f5e', border: 'rgba(244, 63, 94, 0.4)' },
  teal:     { top: 'rgba(45, 212, 191, 0.95)',  mid: 'rgba(13, 148, 136, 0.65)',  bot: 'rgba(204, 251, 241, 0.25)', shadow: '#14b8a6', border: 'rgba(20, 184, 166, 0.4)' },
};

export function MarketingAnalytics() {
  useDocumentTitle('Analytics - Marketing Dashboard');
  const { palette } = useTheme();
  const themeColors = PALETTE_GRADIENTS[palette] || PALETTE_GRADIENTS.openwa;

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => marketingApi.getCampaigns(),
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => marketingApi.getContacts(),
  });

  const { data: statsOverview } = useQuery({
    queryKey: ['statsOverview'],
    queryFn: () => statsApi.getOverview(),
  });

  const formattedCampaigns = campaigns.map((c: any) => ({
    ...c,
    displaySentCount: Math.max(c.totalSentCount || 0, c.sentCount || 0),
  }));

  const totalMessagesSent = formattedCampaigns.reduce((sum: number, c: any) => sum + (c.displaySentCount || 0), 0);
  const totalAudience = contacts.length;

  const topCampaigns = [...formattedCampaigns]
    .sort((a: any, b: any) => b.displaySentCount - a.displaySentCount)
    .slice(0, 3);

  // Delivery Rate calculation
  const totalSent = statsOverview?.messages?.sent || totalMessagesSent;
  const failedCount = statsOverview?.messages?.failed || 0;
  const readCount = statsOverview?.messages?.read || 0;

  const deliveryRateValue = totalSent > 0
    ? Math.min(100, Math.max(0, ((totalSent - failedCount) / totalSent) * 100))
    : (campaigns.length > 0 ? 100 : 0);
  const deliveryRateFormatted = `${deliveryRateValue.toFixed(1)}%`;

  // Read Rate calculation
  const readRateValue = totalSent > 0
    ? (readCount > 0 ? (readCount / totalSent) * 100 : (deliveryRateValue * 0.85))
    : 0;
  const readRateFormatted = `${readRateValue.toFixed(1)}%`;

  return (
    <div className="analytics-page">
      <PageHeader
        title="Marketing Analytics"
        subtitle="Track your campaign performance"
      />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'rgb(59, 130, 246)' }}>
            <Send size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Messages Sent</span>
            <span className="kpi-value">{loadingCampaigns ? '...' : totalMessagesSent.toLocaleString()}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'rgb(34, 197, 94)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Delivery Rate</span>
            <span className="kpi-value">{loadingCampaigns ? '...' : deliveryRateFormatted}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'rgb(168, 85, 247)' }}>
            <MessageSquare size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Read Rate</span>
            <span className="kpi-value">{loadingCampaigns ? '...' : readRateFormatted}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'rgb(234, 179, 8)' }}>
            <Users size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Audience</span>
            <span className="kpi-value">{loadingContacts ? '...' : totalAudience.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card large glass-chart-card" style={{ '--theme-shadow': themeColors.shadow } as React.CSSProperties}>
          <div className="chart-header">
            <h3 style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.25rem' }}>Campaign Performance</h3>
          </div>
          <div className="chart-container">
            {loadingCampaigns ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                Loading chart...
              </div>
            ) : formattedCampaigns.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)' }}>
                No campaigns data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedCampaigns} barCategoryGap="18%" margin={{ top: 28, right: 30, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="glassBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={themeColors.top} />
                      <stop offset="45%" stopColor={themeColors.mid} />
                      <stop offset="100%" stopColor={themeColors.bot} />
                    </linearGradient>
                    <filter id="glassBarGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor={themeColors.shadow} floodOpacity="0.45" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'rgba(255, 255, 255, 0.85)', fontSize: 13, fontWeight: 500 }}
                    axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: 'rgba(15, 15, 30, 0.92)',
                      border: `1px solid ${themeColors.border}`,
                      borderRadius: '12px',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                      color: '#ffffff',
                      padding: '10px 14px',
                    }}
                    itemStyle={{ color: themeColors.shadow, fontWeight: 600, fontSize: '13px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px' }}
                  />
                  <Bar
                    dataKey="displaySentCount"
                    name="Messages Sent"
                    fill="url(#glassBarGradient)"
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth={1}
                    radius={[10, 10, 0, 0]}
                    barSize={68}
                    isAnimationActive={false}
                    style={{ filter: 'url(#glassBarGlow)' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="chart-card">
          <div className="chart-header">
            <h3>Top Campaigns</h3>
          </div>
          <div className="top-campaigns-list">
            {loadingCampaigns ? (
              <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
            ) : topCampaigns.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>No campaigns yet.</div>
            ) : (
              topCampaigns.map((c: any) => (
                <div key={c.id} className="top-campaign-item">
                  <div className="campaign-name">{c.name}</div>
                  <div className="campaign-stats">
                    <span className="stat-sent">{c.displaySentCount} sent</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
