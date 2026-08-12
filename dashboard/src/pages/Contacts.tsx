import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Upload, Search, Trash2, Edit, Download, MessageSquare } from 'lucide-react';
import { marketingApi, sessionApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { SkeletonTable } from '../components/SkeletonLoader';
import './Contacts.css';

function TagSuggestions({
  allTags,
  currentTags,
  onToggle
}: {
  allTags: string[];
  currentTags: string;
  onToggle: (tag: string) => void;
}) {
  if (allTags.length === 0) return null;
  const currentList = currentTags.split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  return (
    <div style={{ marginTop: '0.65rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: '0.45rem', fontWeight: 600 }}>
        Previously Added Tags (click to add/remove):
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', maxHeight: '120px', overflowY: 'auto', padding: '0.25rem 0' }}>
        {allTags.map((tag) => {
          const isSelected = currentList.includes(tag.toLowerCase());
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
                border: isSelected ? '1px solid var(--primary-color, #3b82f6)' : '1px solid var(--border-color, #cbd5e1)',
                backgroundColor: isSelected ? 'var(--primary-color, #3b82f6)' : 'var(--bg-light, #f1f5f9)',
                color: isSelected ? '#ffffff' : 'var(--text-primary, #334155)'
              }}
            >
              <span>{isSelected ? '✓' : '+'}</span>
              <span>{tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '100%',
          borderRadius: '16px',
          padding: '1.75rem',
          backgroundColor: 'var(--surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: variant === 'danger' ? '#fef2f2' : variant === 'warning' ? '#fffbe6' : '#eff6ff',
              color: variant === 'danger' ? '#ef4444' : variant === 'warning' ? '#d97706' : '#3b82f6',
              border: `1px solid ${variant === 'danger' ? '#fecaca' : variant === 'warning' ? '#fef08a' : '#bfdbfe'}`,
            }}
          >
            <Trash2 size={22} />
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary, #64748b)', lineHeight: '1.5' }}>
              {message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isLoading}
            style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: variant === 'danger' ? '#ef4444' : '#3b82f6',
              color: '#ffffff',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Contacts() {
  useDocumentTitle('Contacts - Marketing Dashboard');

  const [searchQuery, setSearchQuery] = useState('');
  const [contactPage, setContactPage] = useState(0);
  const CONTACTS_PER_PAGE = 50;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState<{ name: string; phone: string; tags: string; countryCode?: string }>({ name: '', phone: '', tags: '', countryCode: '+91' });
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);
  const [quickTags, setQuickTags] = useState('imported');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isFetchingWa, setIsFetchingWa] = useState(false);
  const [waContacts, setWaContacts] = useState<Array<{ id: string; name: string; phone: string; pushName: string; isAdmin?: boolean; selected: boolean }>>([]);
  const [waSearchQuery, setWaSearchQuery] = useState('');

  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(),
    enabled: isQuickConnectOpen,
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => marketingApi.getContacts(),
  });

  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>(recentTags);
    contacts.forEach((c: any) => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach((t: string) => {
          if (t && typeof t === 'string' && t.trim()) tagSet.add(t.trim());
        });
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [contacts, recentTags]);

  const toggleTag = (tagToToggle: string, target: 'newContact' | 'quickTags' = 'newContact') => {
    const currentStr = target === 'newContact' ? newContact.tags : quickTags;
    const currentList = currentStr
      .split(/[;,]/)
      .map(t => t.trim())
      .filter(Boolean);
    
    const exists = currentList.some(t => t.toLowerCase() === tagToToggle.toLowerCase());
    let nextList: string[];
    if (exists) {
      nextList = currentList.filter(t => t.toLowerCase() !== tagToToggle.toLowerCase());
    } else {
      nextList = [...currentList, tagToToggle];
    }
    const resultStr = nextList.join(', ');
    if (target === 'newContact') {
      setNewContact({ ...newContact, tags: resultStr });
    } else {
      setQuickTags(resultStr);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => marketingApi.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsAddModalOpen(false);
      setNewContact({ name: '', phone: '', tags: '', countryCode: '+91' });
    },
    onError: (err: any) => alert(`Failed to create contact: ${err.message}`),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data: any[]) => marketingApi.createContactsBulk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      alert('Contacts imported successfully!');
    },
    onError: (err: any) => alert(`Failed to import contacts: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; contact: any }) => marketingApi.updateContact(data.id, data.contact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsAddModalOpen(false);
      setEditingContactId(null);
      setNewContact({ name: '', phone: '', tags: '', countryCode: '+91' });
    },
    onError: (err: any) => alert(`Failed to update contact: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingApi.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: any) => alert(`Failed to delete contact: ${err.message}`),
  });

  const deleteBulkMutation = useMutation({
    mutationFn: (ids: string[]) => marketingApi.deleteContactsBulk(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSelectedContactIds(new Set());
    },
    onError: (err: any) => alert(`Failed to delete selected contacts: ${err.message}`),
  });

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = newContact.tags.split(/[;,]/).map(t => t.trim()).filter(Boolean);
    if (tagsArray.length === 0) {
      alert('Please provide at least one tag for this contact.');
      return;
    }
    setRecentTags(prev => Array.from(new Set([...prev, ...tagsArray])));
    const code = newContact.countryCode || '+91';
    const cleanDigits = newContact.phone.replace(/\D/g, '');
    const finalPhone = cleanDigits.length === 10 ? `${code}${cleanDigits}` : cleanDigits ? `${code}${cleanDigits}` : cleanDigits;
    
    if (editingContactId) {
      updateMutation.mutate({
        id: editingContactId,
        contact: {
          name: newContact.name,
          phone: finalPhone,
          tags: tagsArray
        }
      });
    } else {
      createMutation.mutate({
        name: newContact.name,
        phone: finalPhone,
        tags: tagsArray
      });
    }
  };

  const handleEditClick = (contact: any) => {
    setEditingContactId(contact.id);
    let raw = (contact.phone || '').trim();
    let code = '+91';
    let digits = raw;

    const codeMatch = raw.match(/^(\+\d{1,4}|\d{2})\s*(\d+)$/);
    if (codeMatch && codeMatch[2].length >= 7) {
      code = codeMatch[1].startsWith('+') ? codeMatch[1] : `+${codeMatch[1]}`;
      digits = codeMatch[2];
    } else if (raw.startsWith('+91') && raw.length > 3) {
      code = '+91';
      digits = raw.slice(3);
    } else if (raw.startsWith('91') && raw.length === 12) {
      code = '+91';
      digits = raw.slice(2);
    }

    setNewContact({
      name: contact.name,
      phone: digits,
      countryCode: code,
      tags: (contact.tags || []).join(', ')
    });
    setIsAddModalOpen(true);
  };

  const handleImportCsv = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split('\n').filter((line: string) => line.trim().length > 0);
        if (lines.length <= 1) {
          alert('CSV file is empty or only contains headers.');
          return;
        }
        
        const contacts = lines.slice(1).map((line: string) => {
          let inQuote = false;
          const parts = [];
          let current = '';
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) {
              parts.push(current);
              current = '';
            } else current += char;
          }
          parts.push(current);

          if (parts.length >= 2) {
            return {
              name: parts[0]?.trim(),
              phone: parts[1]?.trim(),
              tags: parts[2] ? parts[2].split(/[;,]/).map((t: string) => t.trim()).filter(Boolean) : []
            };
          }
          return null;
        }).filter(Boolean);

        if (contacts.length > 0) {
          bulkCreateMutation.mutate(contacts);
        } else {
          alert('No valid contacts found in the CSV.');
        }
      } catch (err: any) {
        alert('Failed to parse CSV file: ' + err.message);
      }
    };
    input.click();
  };


  const handleDownloadCsvTemplate = () => {
    const csvContent = 'name,phone,tags\nJohn Doe,919876543210,"client, vip"\nJane Smith,14155552671,"lead, marketing"\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contacts_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatPhone = (raw: string): string => {
    if (!raw) return '';
    const clean = raw.split(':')[0].split('@')[0];
    const digits = clean.replace(/[^0-9]/g, '');
    if (!digits) return raw;

    // 10-digit Indian mobile number starting with 6-9
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return `+91${digits}`;
    }
    // 12-digit Indian mobile number starting with 916-9
    if (digits.length === 12 && /^91[6-9]/.test(digits)) {
      return `+${digits}`;
    }
    // 10 to 14 digit international E.164 phone numbers
    if (digits.length >= 10 && digits.length <= 14) {
      return `+${digits}`;
    }

    // Raw 15+ digit WhatsApp LID integer (not a phone number)
    return `Privacy Protected`;
  };

  const extractDigits = (val: string): string => {
    if (!val || typeof val !== 'string') return '';
    const clean = val.split('@')[0].split(':')[0];
    const digits = clean.replace(/[^0-9]/g, '');

    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return `91${digits}`;
    }
    return digits;
  };

  const loadDirectContactsForSession = async (sessionId: string) => {
    setIsFetchingWa(true);
    try {
      const [contactsRes, chatsRes] = await Promise.all([
        sessionApi.getContacts(sessionId).catch(() => []),
        sessionApi.getChats(sessionId).catch(() => []),
      ]);

      const seenPhones = new Set<string>();
      const parsed: any[] = [];
      const allItems = [...(contactsRes || []), ...(chatsRes || [])];

      for (const item of allItems) {
        if (!item || item.isGroup || (item.id || '').includes('@g.us') || (item.id || '').includes('status@') || (item.id || '').includes('@lid')) continue;

        const rawDigits = item.number
          ? extractDigits(item.number)
          : extractDigits(item.id || '');

        if (!rawDigits || rawDigits.length < 7 || rawDigits.length > 15) continue;
        if (seenPhones.has(rawDigits)) continue;
        seenPhones.add(rawDigits);

        let name = typeof item.name === 'string' ? item.name.trim() : '';
        const nameIsJustNumber = !name || name === rawDigits ||
          name.includes('@') || /^[0-9+\-\s()]+$/.test(name);
        if (nameIsJustNumber) {
          name = (typeof item.pushName === 'string' ? item.pushName : typeof item.verifiedName === 'string' ? item.verifiedName : '').trim();
        }
        const phone = formatPhone(rawDigits);
        if (!name) name = phone;

        parsed.push({
          id: item.id || rawDigits,
          name,
          phone,
          pushName: typeof item.pushName === 'string' ? item.pushName.trim() : '',
          selected: true,
        });
      }
      setWaContacts(parsed);
    } catch (err: any) {
      alert('Failed to load contacts from session: ' + err.message);
    } finally {
      setIsFetchingWa(false);
    }
  };

  const handleSessionChange = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setWaContacts([]);

    if (!sessionId) return;

    const sessionObj = sessions.find((s: any) => s.id === sessionId);
    if (sessionObj && sessionObj.status !== 'ready') {
      alert(`Session "${sessionObj.name}" is not connected (current status: ${sessionObj.status}). Please go to the "Sessions" page, start the session, and scan the QR code first.`);
      return;
    }

    await loadDirectContactsForSession(sessionId);
  };

  const handleToggleSelectAll = () => {
    const filtered = waContacts.filter(c =>
      c.name.toLowerCase().includes(waSearchQuery.toLowerCase()) ||
      c.phone.includes(waSearchQuery) ||
      c.pushName.toLowerCase().includes(waSearchQuery.toLowerCase())
    );
    const allSelected = filtered.every(c => c.selected);
    setWaContacts(prev => prev.map(c => {
      const isMatch = filtered.some(f => f.id === c.id);
      return isMatch ? { ...c, selected: !allSelected } : c;
    }));
  };

  const handleToggleContactSelect = (id: string) => {
    setWaContacts(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const handleWaNameChange = (id: string, newName: string) => {
    setWaContacts(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
  };

  const handleWhatsAppImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = quickTags.split(/[;,]/).map(t => t.trim()).filter(Boolean);
    if (tagsArray.length === 0) {
      alert('Please enter default tags for the imported WhatsApp contacts.');
      return;
    }
    const toImport = waContacts
      .filter((c) => c.selected)
      .map((c) => ({
        name: c.name,
        phone: c.phone,
        tags: tagsArray,
      }));

    if (toImport.length === 0) {
      alert('Please select at least one contact to import.');
      return;
    }

    bulkCreateMutation.mutate(toImport, {
      onSuccess: () => {
        setIsQuickConnectOpen(false);
        setSelectedSessionId('');
        setWaContacts([]);
      }
    });
  };

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  });
  const totalPages = Math.ceil(filteredContacts.length / CONTACTS_PER_PAGE);
  const pagedContacts = filteredContacts.slice(contactPage * CONTACTS_PER_PAGE, (contactPage + 1) * CONTACTS_PER_PAGE);

  return (
    <div className="contacts-page">
      <PageHeader
        title="Contacts"
        subtitle="Manage your marketing audience"
        actions={
          <>
            {selectedContactIds.size > 0 && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: `Delete ${selectedContactIds.size} Contacts`,
                    message: `Are you sure you want to delete ${selectedContactIds.size} selected contact(s)? This action cannot be undone.`,
                    confirmText: `Delete ${selectedContactIds.size} Contacts`,
                    variant: 'danger',
                    onConfirm: () => {
                      deleteBulkMutation.mutate(Array.from(selectedContactIds), {
                        onSuccess: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
                      });
                    },
                  });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', borderColor: '#fca5a5', backgroundColor: '#fef2f2', fontWeight: 600 }}
                disabled={deleteBulkMutation.isPending}
              >
                <Trash2 size={16} />
                {deleteBulkMutation.isPending ? 'Deleting...' : `Delete Selected (${selectedContactIds.size})`}
              </button>
            )}
            <button className="btn-secondary" onClick={() => { setIsQuickConnectOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} style={{ color: '#22c55e' }} />
              WhatsApp Import
            </button>
            <button className="btn-secondary" onClick={handleDownloadCsvTemplate} title="Download CSV Excel template format">
              <Download size={18} />
              CSV Format Template
            </button>
            <button className="btn-secondary" onClick={handleImportCsv} disabled={bulkCreateMutation.isPending}>
              <Upload size={18} />
              {bulkCreateMutation.isPending ? 'Importing...' : 'Import CSV'}
            </button>
            <button className="btn-primary" onClick={() => {
              setEditingContactId(null);
              setNewContact({ name: '', phone: '', tags: '', countryCode: '+91' });
              setIsAddModalOpen(true);
            }}>
              <Plus size={18} />
              Add Contact
            </button>
          </>
        }
      />

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, phone or tag..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setContactPage(0); }}
          />
          {searchQuery && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--text-secondary)' }}
              onClick={() => { setSearchQuery(''); setContactPage(0); }}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
          {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
          {selectedContactIds.size > 0 && ` (${selectedContactIds.size} selected)`}
        </span>
      </div>

      <div className="table-container">
        {isLoading ? (
          <div style={{ padding: '1.5rem' }}>
            <SkeletonTable rows={6} columns={5} />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="empty-state">
            <p>No contacts found. Create one or import to get started.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={pagedContacts.length > 0 && pagedContacts.every(c => selectedContactIds.has(c.id))}
                    onChange={() => {
                      const allSelected = pagedContacts.every(c => selectedContactIds.has(c.id));
                      setSelectedContactIds(prev => {
                        const next = new Set(prev);
                        if (allSelected) {
                          pagedContacts.forEach(c => next.delete(c.id));
                        } else {
                          pagedContacts.forEach(c => next.add(c.id));
                        }
                        return next;
                      });
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Select/Deselect all visible contacts"
                  />
                </th>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Tags</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedContacts.map((contact) => (
                <tr key={contact.id} style={{ backgroundColor: selectedContactIds.has(contact.id) ? 'var(--surface-hover, rgba(59, 130, 246, 0.05))' : undefined }}>
                  <td style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedContactIds.has(contact.id)}
                      onChange={() => {
                        setSelectedContactIds(prev => {
                          const next = new Set(prev);
                          if (next.has(contact.id)) next.delete(contact.id);
                          else next.add(contact.id);
                          return next;
                        });
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td className="font-medium" style={{ fontWeight: 500 }}>{contact.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{contact.phone}</td>
                  <td>
                    <div className="tags-container">
                      {(contact.tags || []).map((tag: string, idx: number) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="btn-icon" onClick={() => handleEditClick(contact)} title="Edit">
                        <Edit size={16} />
                      </button>
                      <button className="btn-icon" style={{ color: 'var(--error, #ef4444)' }} onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Delete Contact',
                          message: `Are you sure you want to delete contact "${contact.name}"? This action cannot be undone.`,
                          confirmText: 'Delete Contact',
                          variant: 'danger',
                          onConfirm: () => {
                            deleteMutation.mutate(contact.id, {
                              onSuccess: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
                            });
                          },
                        });
                      }} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid var(--border-color, #e5e7eb)', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => setContactPage(p => Math.max(0, p - 1))}
              disabled={contactPage === 0}
            >← Prev</button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Page {contactPage + 1} of {totalPages} &nbsp;·&nbsp; {filteredContacts.length} total
            </span>
            <button
              className="btn-secondary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => setContactPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={contactPage >= totalPages - 1}
            >Next →</button>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingContactId ? 'Edit Contact' : 'Add Contact'}</h2>
              <button type="button" className="btn-icon" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body">
                <label>Name</label>
                <input 
                  type="text" 
                  required 
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  placeholder="e.g. John Doe"
                  style={{ marginBottom: '1rem' }}
                />
                
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.45rem', color: 'var(--text-primary)' }}>Phone Number</label>
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--surface, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '0 0.5rem',
                    position: 'relative'
                  }}>
                    <span style={{ fontSize: '1.1rem', marginRight: '0.35rem', userSelect: 'none' }}>🇮🇳</span>
                    <select
                      value={newContact.countryCode || '+91'}
                      onChange={(e) => setNewContact({ ...newContact, countryCode: e.target.value })}
                      aria-label="Country Code"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary, #1e293b)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        outline: 'none',
                        paddingRight: '0.5rem'
                      }}
                    >
                      <option value="+91">+91 (IN)</option>
                      <option value="+1">+1 (US/CA)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+61">+61 (AU)</option>
                      <option value="+971">+971 (UAE)</option>
                      <option value="+966">+966 (SA)</option>
                      <option value="+62">+62 (ID)</option>
                      <option value="+55">+55 (BR)</option>
                      <option value="+49">+49 (DE)</option>
                      <option value="+33">+33 (FR)</option>
                    </select>
                  </div>
                  <input 
                    type="text" 
                    required 
                    value={newContact.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setNewContact({ ...newContact, phone: digits });
                    }}
                    placeholder="10 digit number (e.g. 9876543210)"
                    maxLength={10}
                    style={{ flex: 1, margin: 0, padding: '0.65rem 0.85rem', fontSize: '0.95rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-white, #fff)', color: 'var(--text-primary, #1e293b)' }}
                  />
                </div>
                
                <label>Tags (comma separated)</label>
                <input 
                  type="text" 
                  required
                  value={newContact.tags}
                  onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                  placeholder="e.g. lead, vip"
                />
                <TagSuggestions allTags={allExistingTags} currentTags={newContact.tags} onToggle={(t) => toggleTag(t, 'newContact')} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : (editingContactId ? 'Save Changes' : 'Add Contact')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isQuickConnectOpen && (
        <div className="modal-overlay" onClick={() => setIsQuickConnectOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h2>WhatsApp Import</h2>
              <button type="button" className="btn-icon" onClick={() => setIsQuickConnectOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleWhatsAppImport} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', gap: '1.5rem', overflow: 'hidden', minHeight: '450px', maxHeight: '75vh', padding: '1.5rem' }}>
                  
                  {/* Left Panel: Configuration & Actions */}
                  <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRight: '1px solid var(--border-color, #e5e7eb)', paddingRight: '1.5rem' }}>
                    <div>
                      <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Select WhatsApp Session</label>
                      <select
                        required
                        value={selectedSessionId}
                        onChange={(e) => handleSessionChange(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color, #d1d5db)', backgroundColor: 'var(--bg-card, #fff)', color: 'var(--text-primary, #000)', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Choose session --</option>
                        {sessions.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    {!isFetchingWa && selectedSessionId && waContacts.length > 0 && (
                      <>
                        <div>
                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Search Contacts</label>
                          <div className="search-input" style={{ maxWidth: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                            <Search size={15} />
                            <input
                              type="text"
                              placeholder="Type name/number..."
                              value={waSearchQuery}
                              onChange={(e) => setWaSearchQuery(e.target.value)}
                              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text)', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Batch Operations</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.4rem', fontSize: '0.8rem', width: '100%' }}
                              onClick={() => setWaContacts(prev => prev.map(c => {
                                const isVisible = c.name.toLowerCase().includes(waSearchQuery.toLowerCase()) || c.phone.includes(waSearchQuery) || c.pushName.toLowerCase().includes(waSearchQuery.toLowerCase());
                                return isVisible ? { ...c, selected: true } : c;
                              }))}
                            >
                              Select All Visible
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.4rem', fontSize: '0.8rem', width: '100%' }}
                              onClick={() => setWaContacts(prev => prev.map(c => {
                                const isVisible = c.name.toLowerCase().includes(waSearchQuery.toLowerCase()) || c.phone.includes(waSearchQuery) || c.pushName.toLowerCase().includes(waSearchQuery.toLowerCase());
                                return isVisible ? { ...c, selected: false } : c;
                              }))}
                            >
                              Deselect All Visible
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.4rem', fontSize: '0.8rem', width: '100%', color: 'var(--error, #ef4444)' }}
                              onClick={() => setWaContacts(prev => prev.map(c => ({ ...c, selected: false })))}
                            >
                              Clear All Selections
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: '0.75rem' }}>
                          <div><strong>Total Loaded:</strong> {waContacts.length}</div>
                          <div style={{ marginTop: '0.25rem' }}><strong>Selected:</strong> {waContacts.filter(c => c.selected).length}</div>
                        </div>
                      </>
                    )}

                  </div>

                  {/* Right Panel: List of Numbers */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {isFetchingWa && (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>
                        Loading contacts from WhatsApp...
                      </div>
                    )}

                    {!isFetchingWa && selectedSessionId && waContacts.length > 0 && (
                      <div style={{ overflowY: 'auto', height: '100%', border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '0.375rem', maxHeight: '420px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ backgroundColor: 'var(--surface-hover, #f9fafb)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                            <tr>
                              <th style={{ padding: '0.75rem 0.5rem', width: '40px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={
                                    waContacts.filter(c =>
                                      c.name.toLowerCase().includes(waSearchQuery.toLowerCase()) ||
                                      c.phone.includes(waSearchQuery) ||
                                      c.pushName.toLowerCase().includes(waSearchQuery.toLowerCase())
                                    ).length > 0 &&
                                    waContacts.filter(c =>
                                      c.name.toLowerCase().includes(waSearchQuery.toLowerCase()) ||
                                      c.phone.includes(waSearchQuery) ||
                                      c.pushName.toLowerCase().includes(waSearchQuery.toLowerCase())
                                    ).every(c => c.selected)
                                  }
                                  onChange={handleToggleSelectAll}
                                />
                              </th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Name (Editable)</th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Phone</th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>WhatsApp Name</th>
                            </tr>
                          </thead>
                          <tbody>
                            {waContacts
                              .filter(c =>
                                c.name.toLowerCase().includes(waSearchQuery.toLowerCase()) ||
                                c.phone.includes(waSearchQuery) ||
                                c.pushName.toLowerCase().includes(waSearchQuery.toLowerCase())
                              )
                              .map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', transition: 'background-color 0.2s' }}>
                                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={c.selected}
                                      onChange={() => handleToggleContactSelect(c.id)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.75rem 0.5rem' }}>
                                    <input
                                      type="text"
                                      value={c.name}
                                      onChange={(e) => handleWaNameChange(c.id, e.target.value)}
                                      style={{ width: '100%', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #000)', fontSize: '0.875rem' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary, #4b5563)', fontFamily: 'monospace', fontWeight: 500, fontSize: '0.9rem' }}>{c.phone}</td>
                                  <td style={{ padding: '0.75rem 0.5rem' }}>
                                    <span style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.8rem', fontStyle: 'italic' }}>{c.pushName || '—'}</span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!isFetchingWa && selectedSessionId && waContacts.length === 0 && (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary, #6b7280)', padding: '2rem' }}>
                        No contacts found in this session.
                      </div>
                    )}

                    {!selectedSessionId && (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary, #6b7280)', padding: '2rem' }}>
                        Select a WhatsApp session from the left panel to begin.
                      </div>
                    )}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '0.75rem' }}>
                      <TagSuggestions allTags={allExistingTags} currentTags={quickTags} onToggle={(t: string) => toggleTag(t, 'quickTags')} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', margin: 0 }}>Tag for Imports:</label>
                    <input
                      type="text"
                      value={quickTags}
                      onChange={(e) => setQuickTags(e.target.value)}
                      placeholder="e.g. whatsapp-import"
                      style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color, #d1d5db)', fontSize: '0.85rem', width: '220px', background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #000)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn-secondary" onClick={() => setIsQuickConnectOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={isFetchingWa || bulkCreateMutation.isPending || (!!selectedSessionId && waContacts.filter(c => c.selected).length === 0)}>
                      {bulkCreateMutation.isPending ? 'Importing...' : `Import Selected (${selectedSessionId ? waContacts.filter(c => c.selected).length : 0})`}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        isLoading={deleteMutation.isPending || deleteBulkMutation.isPending}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
