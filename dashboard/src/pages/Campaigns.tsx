import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { marketingApi, sessionApi, templateApi, API_BASE_URL } from '../services/api';
import { Megaphone, Plus, Search, Play, Pause, Trash2, RotateCcw, Paperclip, SquarePen, CheckCircle, AlertCircle } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/SkeletonLoader';
import { ConsentModal } from '../components/ConsentModal';
import { ConfirmModal } from '../components/ConfirmModal';
import './Campaigns.css';

const getMediaPreviewType = (mediaUrl: string, mediaType: string, file: File | null) => {
  const type = file?.type || mediaType || '';
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl || file?.name || '')) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(mediaUrl || file?.name || '')) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(mediaUrl || file?.name || '')) return 'audio';
  return 'document';
};

export function Campaigns() {
  useDocumentTitle('Campaigns - Marketing Dashboard');

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState<{
    name: string;
    audience: string;
    sessionId: string;
    messageText: string;
    mediaUrl: string;
    mediaType: string;
    mediaUrls?: string[];
    mediaTypes?: string[];
    templateId: string;
  }>({ name: '', audience: '', sessionId: '', messageText: '', mediaUrl: '', mediaType: '', mediaUrls: [], mediaTypes: [], templateId: '' });
  const [messageType, setMessageType] = useState<'custom' | 'template'>('custom');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => marketingApi.getCampaigns(),
    refetchInterval: 2000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates', newCampaign.sessionId],
    queryFn: () => templateApi.list(newCampaign.sessionId),
    enabled: !!newCampaign.sessionId && messageType === 'template',
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => marketingApi.getContacts(),
  });

  const availableTags = Array.from(
    new Set(
      (contacts || [])
        .flatMap((c: any) => (Array.isArray(c.tags) ? c.tags : []))
        .filter((t: any) => t && typeof t === 'string' && t.trim())
        .map((t: string) => t.trim().toLowerCase()),
    ),
  );

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingCampaignId(null);
    setNewCampaign({ name: '', audience: '', sessionId: '', messageText: '', mediaUrl: '', mediaType: '', mediaUrls: [], mediaTypes: [], templateId: '' });
    setSelectedFiles([]);
    setMessageType('custom');
  };

  const handleOpenCreateModal = () => {
    setEditingCampaignId(null);
    setNewCampaign({ name: '', audience: '', sessionId: '', messageText: '', mediaUrl: '', mediaType: '', mediaUrls: [], mediaTypes: [], templateId: '' });
    setSelectedFiles([]);
    setMessageType('custom');
    setIsAddModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => marketingApi.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      alert(`Failed to create campaign: ${err.message || 'Unknown error'}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; campaign: any }) => marketingApi.updateCampaign(data.id, data.campaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      alert(`Failed to update campaign: ${err.message || 'Unknown error'}`);
    }
  });

  const handleEditClick = (campaign: any) => {
    setEditingCampaignId(campaign.id);
    const existingUrls = Array.isArray(campaign.mediaUrls) && campaign.mediaUrls.length > 0
      ? campaign.mediaUrls
      : (campaign.mediaUrl ? [campaign.mediaUrl] : []);
    const existingTypes = Array.isArray(campaign.mediaTypes) && campaign.mediaTypes.length > 0
      ? campaign.mediaTypes
      : (campaign.mediaType ? [campaign.mediaType] : []);

    setNewCampaign({
      name: campaign.name || '',
      audience: campaign.audience || '',
      sessionId: campaign.sessionId || '',
      messageText: campaign.messageText || '',
      mediaUrl: campaign.mediaUrl || existingUrls[0] || '',
      mediaType: campaign.mediaType || existingTypes[0] || '',
      mediaUrls: existingUrls,
      mediaTypes: existingTypes,
      templateId: campaign.templateId || '',
    });
    setMessageType(campaign.templateId ? 'template' : 'custom');
    setSelectedFiles([]);
    setIsAddModalOpen(true);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Start only from already-confirmed server-side URLs (stored in newCampaign.mediaUrls).
    // selectedFiles are NEW files that haven't been uploaded yet — upload them and append.
    const existingUrls: string[] = newCampaign.mediaUrls || [];
    const existingTypes: string[] = newCampaign.mediaTypes || [];
    let finalUrls: string[] = [...existingUrls];
    let finalTypes: string[] = [...existingTypes];
    
    if (selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        for (const file of selectedFiles) {
          const data = await marketingApi.uploadMedia(file);
          finalUrls.push(data.mediaUrl);
          finalTypes.push(data.mediaType);
        }
      } catch (err: any) {
        alert('File upload failed: ' + (err.message || 'Unknown error'));
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    
    const dataToSubmit: any = {
      ...newCampaign,
      mediaUrl: finalUrls[0] || '',
      mediaType: finalTypes[0] || '',
      mediaUrls: finalUrls,
      mediaTypes: finalTypes,
    };
      
    if (messageType === 'template') {
      dataToSubmit.messageText = '';
    } else {
      dataToSubmit.templateId = '';
    }

    if (editingCampaignId) {
      updateMutation.mutate({ id: editingCampaignId, campaign: dataToSubmit });
    } else {
      dataToSubmit.status = 'draft';
      dataToSubmit.sentCount = 0;
      dataToSubmit.totalCount = 0;
      createMutation.mutate(dataToSubmit);
    }
  };

  const [consentModalState, setConsentModalState] = useState<{
    isOpen: boolean;
    campaignId: string | null;
    sessionId: string;
    dailyCount: number;
  }>({
    isOpen: false,
    campaignId: null,
    sessionId: '',
    dailyCount: 0,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => marketingApi.startCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any, campaignId: string) => {
      const msg = err?.message || JSON.stringify(err);
      if (msg.includes('CONSENT_REQUIRED') || msg.includes('Consent Required')) {
        const campaign = campaigns.find((c: any) => c.id === campaignId);
        setConsentModalState({
          isOpen: true,
          campaignId,
          sessionId: campaign?.sessionId || '',
          dailyCount: err?.dailyCount || 500,
        });
      } else {
        alert(`Failed to start campaign: ${msg}`);
      }
    },
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => marketingApi.restartCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any, campaignId: string) => {
      const msg = err?.message || JSON.stringify(err);
      if (msg.includes('CONSENT_REQUIRED') || msg.includes('Consent Required')) {
        const campaign = campaigns.find((c: any) => c.id === campaignId);
        setConsentModalState({
          isOpen: true,
          campaignId,
          sessionId: campaign?.sessionId || '',
          dailyCount: err?.dailyCount || 500,
        });
      } else {
        alert(`Failed to restart campaign: ${msg}`);
      }
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => marketingApi.pauseCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => alert(`Failed to pause campaign: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingApi.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => alert(`Failed to delete campaign: ${err.message}`),
  });

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return 'badge-running';
      case 'completed': return 'badge-completed';
      case 'paused': return 'badge-paused';
      case 'failed': return 'badge-failed';
      default: return 'badge-draft';
    }
  };

  return (
    <div className="campaigns-page">
      <PageHeader
        title="Campaigns"
        subtitle="Manage your WhatsApp marketing broadcasts"
        actions={
          <button className="btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={18} />
            Create Campaign
          </button>
        }
      />

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="campaigns-grid">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredCampaigns.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={48} />
            <h3>No Campaigns Found</h3>
            <p>Create a new campaign to start sending messages.</p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => (
            <div key={campaign.id} className="campaign-card">
              <div className="card-header">
                <h3>{campaign.name}</h3>
                <span className={`status-badge ${getStatusBadge(campaign.status)}`}>
                  {campaign.status}
                </span>
              </div>
              
              <div className="campaign-info">
                <div className="info-row">
                  <span className="info-label">Audience:</span>
                  <span className="info-value">{campaign.audience}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Progress:</span>
                  <span className="info-value">
                    {campaign.sentCount} / {campaign.totalCount}
                  </span>
                </div>
                
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${campaign.totalCount ? (campaign.sentCount / campaign.totalCount) * 100 : 0}%` }}
                  ></div>
                </div>

                {/* Live Activity Status Subtext directly under progress bar */}
                <div className="campaign-live-status">
                  {campaign.status === 'running' && (
                    <div className="status-step-running">
                      <span className="live-pulse-dot" />
                      <span>
                        {campaign.sentCount === 0 && campaign.totalCount > 0
                          ? 'Uploading media & preparing contact queue...'
                          : `Sending to contact ${campaign.sentCount} of ${campaign.totalCount} (${Math.round((campaign.sentCount / campaign.totalCount) * 100)}% complete)`}
                      </span>
                    </div>
                  )}
                  {campaign.status === 'completed' && (
                    <div className="status-step-completed">
                      <CheckCircle size={14} />
                      <span>Completed ({campaign.totalCount} / {campaign.totalCount} contacts processed)</span>
                    </div>
                  )}
                  {campaign.status === 'paused' && (
                    <div className="status-step-paused">
                      <Pause size={14} />
                      <span>
                        {campaign.sentCount > 0
                          ? `Paused at contact ${campaign.sentCount} of ${campaign.totalCount}. Click Start to resume.`
                          : 'Campaign paused. Click Start to resume.'}
                      </span>
                    </div>
                  )}
                  {campaign.status === 'draft' && (
                    <div className="status-step-draft">
                      <span>Ready to launch. Click Start to process contacts.</span>
                    </div>
                  )}
                  {campaign.status === 'failed' && (
                    <div className="status-step-failed">
                      <AlertCircle size={14} />
                      <span>Campaign stopped or failed. Click Restart to retry.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-actions">
                {campaign.status === 'draft' || campaign.status === 'paused' ? (
                  <button 
                    className="btn-action" 
                    onClick={() => startMutation.mutate(campaign.id)}
                    disabled={startMutation.isPending}
                  >
                    <Play size={16} />
                    {startMutation.isPending ? 'Starting...' : 'Start'}
                  </button>
                ) : campaign.status === 'running' ? (
                  <button 
                    className="btn-action"
                    onClick={() => pauseMutation.mutate(campaign.id)}
                    disabled={pauseMutation.isPending}
                  >
                    <Pause size={16} />
                    {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
                  </button>
                ) : null}
                {campaign.status === 'completed' && (
                  <button 
                    className="btn-action"
                    onClick={() => {
                      setConfirmState({
                        isOpen: true,
                        title: 'Restart Campaign?',
                        message: `Are you sure you want to restart "${campaign.name}"? This will reset its progress to 0 and send messages again.`,
                        confirmText: 'Restart Campaign',
                        variant: 'warning',
                        onConfirm: () => {
                          restartMutation.mutate(campaign.id);
                          setConfirmState(prev => ({ ...prev, isOpen: false }));
                        },
                      });
                    }}
                    disabled={restartMutation.isPending}
                  >
                    <RotateCcw size={16} />
                    {restartMutation.isPending ? 'Restarting...' : 'Restart'}
                  </button>
                )}
                {campaign.status !== 'running' && (
                  <button 
                    className="btn-action"
                    onClick={() => handleEditClick(campaign)}
                  >
                    <SquarePen size={16} />
                    Edit
                  </button>
                )}
                <button 
                  className="btn-action danger"
                  onClick={() => {
                    setConfirmState({
                      isOpen: true,
                      title: 'Delete Campaign?',
                      message: `Are you sure you want to delete campaign "${campaign.name}"? This action cannot be undone.`,
                      confirmText: 'Delete Campaign',
                      variant: 'danger',
                      onConfirm: () => {
                        deleteMutation.mutate(campaign.id);
                        setConfirmState(prev => ({ ...prev, isOpen: false }));
                      },
                    });
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAddModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCampaignId ? 'Edit Campaign' : 'Create Campaign'}</h2>
              <button type="button" className="btn-icon" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden', minHeight: 0 }}>
              <div className="modal-body">
                <label>Campaign Name</label>
                <input 
                  type="text" 
                  required 
                  value={newCampaign.name || ''}
                  onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                  placeholder="e.g. Summer Promo"
                />
                
                <label>Audience Tags</label>
                <input 
                  type="text" 
                  required 
                  value={newCampaign.audience || ''}
                  onChange={(e) => setNewCampaign({...newCampaign, audience: e.target.value})}
                  placeholder="e.g. vip, newsletter"
                />

                <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                    Available Contact Tags (Click to select):
                  </span>
                  {availableTags.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No contact tags created yet. Add contacts with tags first.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {availableTags.map(tag => {
                        const selectedTags = (newCampaign.audience || '')
                          .split(',')
                          .map(s => s.trim().toLowerCase())
                          .filter(Boolean);
                        const isSelected = selectedTags.includes(tag);

                        const handleToggleTag = () => {
                          let updated: string[];
                          if (isSelected) {
                            updated = selectedTags.filter(t => t !== tag);
                          } else {
                            updated = [...selectedTags, tag];
                          }
                          setNewCampaign({ ...newCampaign, audience: updated.join(', ') });
                        };

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={handleToggleTag}
                            style={{
                              padding: '0.25rem 0.625rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--surface-hover)',
                              color: isSelected ? 'var(--primary)' : 'var(--text)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <small className="form-hint" style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Contacts with any of these tags will receive the message.</small>

                <label>WhatsApp Session</label>
                <select
                  required
                  value={newCampaign.sessionId || ''}
                  onChange={(e) => setNewCampaign({ ...newCampaign, sessionId: e.target.value })}
                >
                  <option value="" disabled>Select a session...</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>{session.name} ({session.phone || session.status || 'Connected'})</option>
                  ))}
                </select>

                <label>Message Type</label>
                <select
                  value={messageType || 'custom'}
                  onChange={(e) => setMessageType(e.target.value as 'custom' | 'template')}
                >
                  <option value="custom">Custom Message</option>
                  <option value="template">Message Template</option>
                </select>

                {messageType === 'template' ? (
                  <>
                    <label>Select Template</label>
                    <select
                      required
                      value={newCampaign.templateId || ''}
                      onChange={(e) => setNewCampaign({ ...newCampaign, templateId: e.target.value })}
                      disabled={!newCampaign.sessionId || templates.length === 0}
                    >
                      <option value="" disabled>
                        {!newCampaign.sessionId 
                          ? 'Select a session first' 
                          : templates.length === 0 
                            ? 'No templates found for this session' 
                            : 'Select a template...'}
                      </option>
                      {templates.map((tpl: any) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label>Message Text</label>
                    <textarea
                      required
                      value={newCampaign.messageText || ''}
                      onChange={(e) => setNewCampaign({ ...newCampaign, messageText: e.target.value })}
                      placeholder="Type your marketing message here..."
                      style={{ minHeight: '110px', resize: 'vertical' }}
                    />
                  </>
                )}
                
                <>
                  <label>Attach Media (Optional - Up to 5 files)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px dashed var(--border, #e2e8f0)', background: 'var(--bg-light, #f8fafc)', color: 'var(--text-primary, #1e293b)' }}>
                    <Paperclip size={18} />
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = '';
                        if (files.length === 0) return;
                        // Calculate total: existing server files + already-staged new files + newly picked
                        const existingCount = (newCampaign.mediaUrls?.length) || (newCampaign.mediaUrl ? 1 : 0);
                        const stagedCount = selectedFiles.length;
                        const remaining = 5 - existingCount - stagedCount;
                        if (remaining <= 0) {
                          alert('You can attach up to 5 media files total per campaign.');
                          return;
                        }
                        const toAdd = files.slice(0, remaining);
                        if (toAdd.length < files.length) {
                          alert(`Only ${toAdd.length} of ${files.length} files added (limit is 5 total).`);
                        }
                        setSelectedFiles(prev => [...prev, ...toAdd]);
                      }}
                      style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem', border: 'none', background: 'transparent', padding: 0 }}
                    />
                  </div>
                </>
                {(() => {
                  const existingMediaItems: { url: string; type: string; index: number }[] = [];
                  if (newCampaign.mediaUrls && Array.isArray(newCampaign.mediaUrls) && newCampaign.mediaUrls.length > 0) {
                    newCampaign.mediaUrls.forEach((url, idx) => {
                      if (url) existingMediaItems.push({ url, type: newCampaign.mediaTypes?.[idx] || '', index: idx });
                    });
                  } else if (newCampaign.mediaUrl) {
                    existingMediaItems.push({ url: newCampaign.mediaUrl, type: newCampaign.mediaType || '', index: 0 });
                  }

                  const totalCount = existingMediaItems.length + selectedFiles.length;
                  if (totalCount === 0) return null;

                  return (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                        Attached Media ({totalCount} / 5 files)
                      </div>
                      {existingMediaItems.map((item) => {
                        const previewUrl = `${API_BASE_URL}/marketing/media/preview?path=${encodeURIComponent(item.url)}`;
                        const previewType = getMediaPreviewType(item.url, item.type, null);
                        const fileName = item.url.split('/').pop() || 'Existing Media';
                        return (
                          <div key={`existing-${item.index}`} style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-white, #fff)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                <span style={{ fontSize: '1.2rem' }}>
                                  {previewType === 'image' ? '🖼️' : previewType === 'video' ? '🎬' : previewType === 'audio' ? '🎵' : '📄'}
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {fileName}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                                    Existing campaign media ({item.type || previewType})
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <a
                                  href={previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'var(--bg-light, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', color: 'var(--text-primary, #1e293b)', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 500 }}
                                >
                                  Open Fullscreen ↗
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newCampaign.mediaUrls && newCampaign.mediaUrls.length > 0) {
                                      const updatedUrls = newCampaign.mediaUrls.filter((_, i) => i !== item.index);
                                      const updatedTypes = (newCampaign.mediaTypes || []).filter((_, i) => i !== item.index);
                                      setNewCampaign(prev => ({
                                        ...prev,
                                        mediaUrls: updatedUrls,
                                        mediaTypes: updatedTypes,
                                        mediaUrl: updatedUrls[0] || '',
                                        mediaType: updatedTypes[0] || '',
                                      }));
                                    } else {
                                      setNewCampaign(prev => ({ ...prev, mediaUrl: '', mediaType: '', mediaUrls: [], mediaTypes: [] }));
                                    }
                                  }}
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'rgb(239, 68, 68)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            {previewType === 'image' && (
                              <div style={{ maxHeight: '180px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={previewUrl} alt="Attached Media" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                              </div>
                            )}
                            {previewType === 'video' && (
                              <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', background: '#000' }}>
                                <video src={previewUrl} controls style={{ width: '100%', maxHeight: '200px' }} />
                              </div>
                            )}
                            {previewType === 'audio' && (
                              <div style={{ width: '100%' }}>
                                <audio src={previewUrl} controls style={{ width: '100%' }} />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {selectedFiles.map((file, idx) => {
                        const previewUrl = URL.createObjectURL(file);
                        const previewType = getMediaPreviewType('', '', file);
                        return (
                          <div key={`new-${idx}-${file.name}`} style={{ padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-white, #fff)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                <span style={{ fontSize: '1.2rem' }}>
                                  {previewType === 'image' ? '🖼️' : previewType === 'video' ? '🎬' : previewType === 'audio' ? '🎵' : '📄'}
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #1e293b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.name}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                                    New upload ({Math.round(file.size / 1024)} KB)
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'rgb(239, 68, 68)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            {previewType === 'image' && (
                              <div style={{ maxHeight: '180px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={previewUrl} alt="Attached Media" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                              </div>
                            )}
                            {previewType === 'video' && (
                              <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border, #e2e8f0)', background: '#000' }}>
                                <video src={previewUrl} controls style={{ width: '100%', maxHeight: '200px' }} />
                              </div>
                            )}
                            {previewType === 'audio' && (
                              <div style={{ width: '100%' }}>
                                <audio src={previewUrl} controls style={{ width: '100%' }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending || isUploading}>
                  {isUploading ? 'Uploading...' : editingCampaignId ? (updateMutation.isPending ? 'Saving...' : 'Save Changes') : (createMutation.isPending ? 'Creating...' : 'Create Campaign')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConsentModal
        isOpen={consentModalState.isOpen}
        sessionId={consentModalState.sessionId}
        dailyCount={consentModalState.dailyCount}
        onConsentSuccess={() => {
          const campaignId = consentModalState.campaignId;
          setConsentModalState(prev => ({ ...prev, isOpen: false }));
          if (campaignId) {
            startMutation.mutate(campaignId);
          }
        }}
        onClose={() => setConsentModalState(prev => ({ ...prev, isOpen: false }))}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
