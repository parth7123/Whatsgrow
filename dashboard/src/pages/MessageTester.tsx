import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, CheckCircle, XCircle, Loader2, Paperclip, X } from 'lucide-react';
import { messageApi, contactApi, sessionApi, marketingApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useSessionGroupsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './MessageTester.css';

interface ApiResponse {
  success: boolean;
  messageId?: string;
  timestamp: string;
  error?: string;
}

export function MessageTester() {
  const { t } = useTranslation();
  useDocumentTitle(t('messageTester.title'));
  const { canWrite } = useRole();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter(s => s.status === 'ready');
  const [session, setSession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<'personal' | 'group'>('personal');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [sendToGroupMembers, setSendToGroupMembers] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; sent: number; errors: number; active: boolean } | null>(null);

  const { data: rawGroups, isLoading: loadingGroups } = useSessionGroupsQuery(
    session,
    recipientType === 'group',
  );
  const groups = Array.isArray(rawGroups) ? rawGroups : [];

  useEffect(() => {
    if (sessions.length > 0 && !session) {
      setSession(sessions[0].id);
    }
  }, [sessions, session]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
    if (recipientType !== 'group') {
      setSelectedGroup('');
    }
  }, [groups, selectedGroup, recipientType]);

  const sendMediaBatchToChat = async (
    targetChatId: string,
    uploadedMedia: Array<{ url: string; mimetype: string; filename: string }>,
    textContent: string
  ) => {
    let lastResult: { messageId?: string; timestamp?: number } = {};
    if (uploadedMedia.length > 0) {
      // Step 1: Send ALL media files first without caption
      for (let i = 0; i < uploadedMedia.length; i++) {
        const item = uploadedMedia[i];
        let res;
        if (item.mimetype.startsWith('video/')) {
          res = await messageApi.sendVideo(session, targetChatId, item.url);
        } else if (item.mimetype.startsWith('audio/')) {
          res = await messageApi.sendAudio(session, targetChatId, item.url);
        } else if (item.mimetype.startsWith('image/')) {
          res = await messageApi.sendImage(session, targetChatId, item.url);
        } else {
          res = await messageApi.sendDocument(session, targetChatId, item.url, item.filename);
        }

        lastResult = res || {};
        await new Promise(r => setTimeout(r, 1000));
      }

      // Step 2: Send text message AFTER sending all media files (if text content was entered)
      if (textContent && textContent.trim()) {
        lastResult = await messageApi.sendText(session, targetChatId, textContent.trim());
      }
    } else {
      lastResult = await messageApi.sendText(session, targetChatId, textContent.trim());
    }

    return lastResult;
  };

  const handleSend = async () => {
    const targetId = recipientType === 'group' ? selectedGroup : recipient;
    if (!session || !targetId) return;
    setIsLoading(true);
    setResponse(null);

    try {
      let uploadedMedia: Array<{ url: string; mimetype: string; filename: string }> = [];

      if (selectedFiles.length > 0) {
        setIsUploading(true);
        for (const file of selectedFiles) {
          const res = await marketingApi.uploadMedia(file);
          uploadedMedia.push({
            url: res.mediaUrl,
            mimetype: res.mediaType || file.type || 'application/octet-stream',
            filename: file.name,
          });
        }
        setIsUploading(false);
      }

      if (recipientType === 'group' && sendToGroupMembers) {
        const groupInfo = await sessionApi.getGroup(session, selectedGroup);
        const participants = groupInfo.participants || [];
        if (participants.length === 0) {
          throw new Error('No participants found in this group.');
        }

        setBulkProgress({ total: participants.length, sent: 0, errors: 0, active: true });

        let sentCount = 0;
        let errorCount = 0;

        for (const p of participants) {
          try {
            const chatId = p.id;
            await sendMediaBatchToChat(chatId, uploadedMedia, content);
            sentCount++;
          } catch (err) {
            errorCount++;
          }
          setBulkProgress(prev => (prev ? { ...prev, sent: sentCount, errors: errorCount } : null));
          await new Promise(r => setTimeout(r, 1000));
        }

        setResponse({
          success: errorCount === 0,
          timestamp: new Date().toISOString(),
          messageId: `Bulk sent: ${sentCount} successful, ${errorCount} failed`,
        });
        setIsLoading(false);
        setBulkProgress(prev => (prev ? { ...prev, active: false } : null));
        return;
      }

      let chatId = targetId;
      if (recipientType !== 'group') {
        const resolved = await contactApi.checkNumber(session, targetId.replace(/[^0-9]/g, ''));
        if (!resolved.exists || !resolved.whatsappId) {
          setResponse({
            success: false,
            timestamp: new Date().toISOString(),
            error: t('messageTester.notOnWhatsApp'),
          });
          return;
        }
        chatId = resolved.whatsappId;
      }

      const result = await sendMediaBatchToChat(chatId, uploadedMedia, content);

      setResponse({
        success: !!result.messageId,
        messageId: result.messageId,
        timestamp: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : new Date().toISOString(),
      });
    } catch (err) {
      setResponse({
        success: false,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : t('messageTester.sendFailed'),
      });
      setBulkProgress(null);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  if (loadingSessions) {
    return (
      <div
        className="message-tester"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="message-tester">
      <PageHeader title={t('messageTester.title')} subtitle={t('messageTester.subtitle')} />

      <div className="tester-panels">
        <div className="compose-panel">
          <h2>{t('messageTester.compose')}</h2>

          <div className="form-group">
            <label>{t('messageTester.session')}</label>
            <select value={session} onChange={e => setSession(e.target.value)}>
              {sessions.length === 0 && <option value="">{t('messageTester.noReadySessions')}</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || t('messageTester.sessionOptionPhoneNone')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('messageTester.recipientType')}</label>
            <div className="toggle-group">
              <button
                className={recipientType === 'personal' ? 'active' : ''}
                onClick={() => setRecipientType('personal')}
              >
                {t('messageTester.personal')}
              </button>
              <button className={recipientType === 'group' ? 'active' : ''} onClick={() => setRecipientType('group')}>
                {t('messageTester.group')}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>{recipientType === 'group' ? t('messageTester.selectGroup') : t('messageTester.recipientPhone')}</label>
            {recipientType === 'group' ? (
              <>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  disabled={loadingGroups || groups.length === 0}
                >
                  {loadingGroups && <option value="">{t('messageTester.loadingGroups')}</option>}
                  {!loadingGroups && groups.length === 0 && <option value="">{t('messageTester.noGroupsFound')}</option>}
                  {groups.map((g: any, idx: number) => {
                    const gId = typeof g?.id === 'object' ? g?.id?._serialized || String(g?.id) : String(g?.id ?? idx);
                    const gName = typeof g?.name === 'object' ? String(g?.name?.name || g?.name?.formattedTitle || gId) : String(g?.name || gId);
                    return (
                      <option key={gId} value={gId}>
                        {gName}
                      </option>
                    );
                  })}
                </select>
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="sendToGroupMembers"
                    checked={sendToGroupMembers}
                    onChange={e => setSendToGroupMembers(e.target.checked)}
                  />
                  <label htmlFor="sendToGroupMembers" style={{ margin: 0, fontWeight: 'normal', fontSize: '14px', cursor: 'pointer' }}>
                    Send separately to each member of this group
                  </label>
                </div>
                <span className="hint">{t('messageTester.selectGroupHint')}</span>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="+62812345678"
                />
                <span className="hint">{t('messageTester.phoneHint')}</span>
              </>
            )}
          </div>

          <div className="form-group">
            <label>{t('messageTester.messageContent')}</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('messageTester.messagePlaceholder')}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Attach Media (Optional - Up to 5 files)</label>
            <div className="file-upload-dropzone">
              <Paperclip size={18} />
              <input
                type="file"
                multiple
                disabled={selectedFiles.length >= 5}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (files.length === 0) return;
                  const remaining = 5 - selectedFiles.length;
                  if (remaining <= 0) {
                    alert('You can attach up to 5 media files total per message.');
                    return;
                  }
                  const toAdd = files.slice(0, remaining);
                  if (toAdd.length < files.length) {
                    alert(`Only ${toAdd.length} of ${files.length} files added (limit is 5 total).`);
                  }
                  setSelectedFiles(prev => [...prev, ...toAdd]);
                }}
              />
              <span className="file-upload-text">
                {selectedFiles.length >= 5 ? 'Maximum 5 files reached' : 'Click to select media files (Images, Videos, Audio, Documents)'}
              </span>
            </div>

            {selectedFiles.length > 0 && (
              <div className="attached-media-list">
                <div className="attached-media-header">
                  Attached Media ({selectedFiles.length} / 5 files)
                </div>
                {selectedFiles.map((file, idx) => {
                  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
                  const sizeKb = Math.round(file.size / 1024);
                  const displaySize = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
                  const isImg = file.type.startsWith('image/');
                  const isVid = file.type.startsWith('video/');
                  const isAud = file.type.startsWith('audio/');

                  return (
                    <div key={`${file.name}-${idx}`} className="attached-media-item">
                      <div className="attached-media-info">
                        <span className="media-type-icon">
                          {isImg ? '🖼️' : isVid ? '🎬' : isAud ? '🎵' : '📄'}
                        </span>
                        <div className="media-text-meta">
                          <span className="media-filename">{file.name}</span>
                          <span className="media-size">{displaySize} • {file.type || 'file'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-icon remove-media-btn"
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!canWrite || isLoading || isUploading || !session || (recipientType === 'group' ? !selectedGroup : !recipient)}
          >
            {isLoading || isUploading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isUploading ? 'Uploading Media...' : isLoading ? t('messageTester.sending') : canWrite ? t('messageTester.send') : t('messageTester.viewOnly')}
          </button>
        </div>

        <div className="response-panel">
          <h2>{t('messageTester.responseTitle')}</h2>

          {bulkProgress && bulkProgress.active && (
            <div className="bulk-progress-panel" style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Sending to Group Members...</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span>Progress: {bulkProgress.sent + bulkProgress.errors} / {bulkProgress.total}</span>
                <span style={{ color: 'var(--primary)' }}>{Math.round(((bulkProgress.sent + bulkProgress.errors) / bulkProgress.total) * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${((bulkProgress.sent + bulkProgress.errors) / bulkProgress.total) * 100}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px', color: '#10B981' }} /> {bulkProgress.sent} Successful</span>
                <span><XCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px', color: '#EF4444' }} /> {bulkProgress.errors} Failed</span>
              </div>
            </div>
          )}

          {response ? (
            <>
              <div className={`response-status ${response.success ? 'success' : 'error'}`}>
                {response.success ? (
                  <>
                    <CheckCircle size={20} />
                    <span>{t('messageTester.successLabel')}</span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} />
                    <span>{t('messageTester.failedLabel')}</span>
                  </>
                )}
              </div>

              <div className="response-details">
                <div className="detail-row">
                  <span className="detail-label">{t('messageTester.response.timestamp')}</span>
                  <span className="detail-value">{response.timestamp}</span>
                </div>
                {response.messageId && (
                  <div className="detail-row">
                    <span className="detail-label">{t('messageTester.response.messageId')}</span>
                    <span className="detail-value mono">{response.messageId}</span>
                  </div>
                )}
                {response.error && (
                  <div className="detail-row">
                    <span className="detail-label">{t('messageTester.response.error')}</span>
                    <span className="detail-value" style={{ color: '#DC2626' }}>
                      {response.error}
                    </span>
                  </div>
                )}
              </div>

              <div className="response-json">
                <pre>{JSON.stringify(response, null, 2)}</pre>
              </div>
            </>
          ) : isLoading || isUploading ? (
            <div className="sending-loading-card">
              <div className="sending-loading-spinner" />
              <div className="sending-loading-text">
                {isUploading ? 'Uploading Media Files...' : selectedFiles.length > 0 ? 'Sending Media Content...' : 'Sending Message...'}
              </div>
              <div className="sending-loading-subtext">
                Uploading content and processing through WhatsApp Web engine. Please wait...
              </div>
              <div className="sending-progress-track">
                <div className="sending-progress-bar-shimmer" />
              </div>
            </div>
          ) : (
            <div className="response-empty">
              <p>{t('messageTester.responseEmpty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
