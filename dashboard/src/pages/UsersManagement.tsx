import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, Shield, User, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { usersApi, marketingApi } from '../services/api';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { SkeletonTable } from '../components/SkeletonLoader';
import { ConfirmModal } from '../components/ConfirmModal';
import './UsersManagement.css';

interface UserData {
  id: string;
  username: string;
  webhooksEnabled: boolean;
  isActive: boolean;
  maxSessions?: number;
  expiresAt: string | null;
  createdAt: string;
}

export function UsersManagement() {
  const [activeTab, setActiveTab] = useState<'users' | 'consents'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [webhooksEnabled, setWebhooksEnabled] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [maxSessions, setMaxSessions] = useState(1);
  const [expiresAt, setExpiresAt] = useState('');
  const [newApiKeyModal, setNewApiKeyModal] = useState<{username: string, apiKey: string} | null>(null);
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
  const { success: showSuccess, error: showError } = useToast();

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.getUsers(),
  });

  const { data: consents = [], isLoading: isLoadingConsents } = useQuery({
    queryKey: ['consents'],
    queryFn: () => marketingApi.getConsentsList(),
    enabled: activeTab === 'consents',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.createUser(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User created successfully');
      closeModal();
      if (data && data.apiKey) {
        setNewApiKeyModal({ username: data.username, apiKey: data.apiKey });
      }
    },
    onError: () => {
      showError('Error creating user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User updated successfully');
      closeModal();
    },
    onError: () => {
      showError('Error updating user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showSuccess('User deleted successfully');
    },
    onError: (err: any) => {
      showError(`Error deleting user: ${err.message}`);
    },
  });

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (user?: UserData) => {
    if (user) {
      setEditingUser(user);
      setUsername(user.username);
      setPassword('');
      setWebhooksEnabled(user.webhooksEnabled);
      setIsActive(user.isActive !== false); // default true if undefined
      setMaxSessions(user.maxSessions !== undefined ? user.maxSessions : 1);
      setExpiresAt(user.expiresAt ? user.expiresAt.substring(0, 10) : '');
    } else {
      setEditingUser(null);
      setUsername('');
      setPassword('');
      setWebhooksEnabled(false);
      setIsActive(true);
      setMaxSessions(1);
      setExpiresAt('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setWebhooksEnabled(false);
    setIsActive(true);
    setMaxSessions(1);
    setExpiresAt('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payloadExpiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
    
    if (editingUser) {
      const data: any = { webhooksEnabled, isActive, maxSessions, expiresAt: payloadExpiresAt };
      if (password) data.password = password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate({ username, password, webhooksEnabled, isActive, maxSessions, expiresAt: payloadExpiresAt });
    }
  };

  const handleDelete = (id: string, name?: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete User Account?',
      message: `Are you sure you want to delete user "${name || 'this account'}"? This action cannot be undone.`,
      confirmText: 'Delete User',
      variant: 'danger',
      onConfirm: () => {
        deleteMutation.mutate(id);
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="users-page">
      <PageHeader
        title="Users Management"
        subtitle="Manage sub-accounts and permissions"
        actions={
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={20} />
            <span>New User</span>
          </button>
        }
      />

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'users' ? 'var(--primary-color, #3b82f6)' : 'transparent',
            color: activeTab === 'users' ? '#ffffff' : 'var(--text-secondary, #64748b)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <User size={18} />
          User Accounts ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('consents')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            border: 'none',
            backgroundColor: activeTab === 'consents' ? '#ef4444' : 'transparent',
            color: activeTab === 'consents' ? '#ffffff' : 'var(--text-secondary, #64748b)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldAlert size={18} />
          WhatsApp Ban Consents Log ({consents.length})
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          <div className="filters-bar" style={{ marginBottom: '1.5rem' }}>
            <div className="search-input">
              <Search size={20} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="users-card">
            {isLoading ? (
              <div style={{ padding: '1.5rem' }}>
                <SkeletonTable rows={5} columns={5} />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">
                <User size={48} />
                <h3>No users found</h3>
                <p>Create a new user to get started.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Status</th>
                      <th>Max Sessions</th>
                  <th>Webhooks Access</th>
                  <th>Expires At</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                        <User size={16} />
                        {user.username}
                      </div>
                    </td>
                    <td>
                      {user.isActive !== false ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-error">Disabled</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        {user.maxSessions ?? 1}
                      </span>
                    </td>
                    <td>
                      {user.webhooksEnabled ? (
                        <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                          <Shield size={14} /> Enabled
                        </span>
                      ) : (
                        <span className="badge badge-error">Disabled</span>
                      )}
                    </td>
                    <td>
                      {user.expiresAt ? (
                        <span className={new Date(user.expiresAt) < new Date() ? 'text-red-500' : ''}>
                          {new Date(user.expiresAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          className="btn-icon"
                          onClick={() => openModal(user)}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: 'var(--error)' }}
                          onClick={() => handleDelete(user.id)}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : (
        <div className="users-card">
          {isLoadingConsents ? (
            <div style={{ padding: '1.5rem' }}>
              <SkeletonTable rows={4} columns={4} />
            </div>
          ) : consents.length === 0 ? (
            <div className="empty-state">
              <ShieldAlert size={48} style={{ color: '#ef4444' }} />
              <h3>No WhatsApp Ban Consents Recorded Yet</h3>
              <p>When users send over 500 daily messages and accept responsibility, their legal consents will appear here.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Operator / User</th>
                    <th>Session ID</th>
                    <th>Daily Threshold</th>
                    <th>Date & Time</th>
                    <th>Status & Risk Disclaimer</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((item: any) => (
                    <tr key={item.id}>
                      <td className="font-medium" style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={16} />
                          {item.userName || item.userEmail || item.userId || 'Operator'}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {item.sessionId || 'All Sessions'}
                      </td>
                      <td>
                        <span className="badge badge-warning" style={{ backgroundColor: '#fffbe6', color: '#d97706', border: '1px solid #fef08a', padding: '0.25rem 0.6rem', fontSize: '0.8rem', fontWeight: 600 }}>
                          500+ Daily Msgs
                        </span>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                          <CheckCircle2 size={14} />
                          Agreed & Verified (User Holds 100% Liability)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <form className="modal" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button type="button" className="btn-icon" onClick={closeModal}>&times;</button>
            </div>
            
            <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    className="form-input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    disabled={!!editingUser}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="password">{editingUser ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required={!editingUser}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="maxSessions">Max Allowed Sessions</label>
                  <input
                    id="maxSessions"
                    type="number"
                    min="0"
                    className="form-input"
                    value={maxSessions}
                    onChange={e => setMaxSessions(parseInt(e.target.value, 10) || 0)}
                    required
                  />
                  <p className="text-gray-500" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Maximum number of WhatsApp sessions this user account can create.
                  </p>
                </div>
                
                <div className="form-group checkbox-group">
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={webhooksEnabled}
                      onChange={e => setWebhooksEnabled(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span>Allow Access to Webhooks</span>
                  </label>
                  <p className="text-gray-500" style={{ fontSize: '0.875rem', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
                    If enabled, this user will be able to manage webhooks for their sessions.
                  </p>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span>Account Active</span>
                  </label>
                  <p className="text-gray-500" style={{ fontSize: '0.875rem', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
                    Disable to instantly revoke API and dashboard access for this account.
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="expiresAt">Expiration Date (Optional)</label>
                  <input
                    id="expiresAt"
                    type="date"
                    className="form-input"
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                  />
                  <p className="text-gray-500" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    If set, the account will automatically be disabled on this date.
                  </p>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save User'}
                </button>
              </div>
          </form>
        </div>
      )}

      {newApiKeyModal && (
        <div className="modal-overlay" onClick={() => setNewApiKeyModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Save API Key</h2>
              <button type="button" className="btn-icon" onClick={() => setNewApiKeyModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Please copy this API Key and provide it to <strong>{newApiKeyModal.username}</strong>. 
                For security reasons, it will <strong>never be shown again</strong>.
              </p>
              <div className="form-group">
                <input 
                  type="text" 
                  readOnly 
                  value={newApiKeyModal.apiKey} 
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '1.1rem', padding: '1rem' }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  navigator.clipboard.writeText(newApiKeyModal.apiKey);
                  showSuccess('API Key copied to clipboard');
                }}
              >
                Copy to Clipboard
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setNewApiKeyModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
