import { useState } from 'react';
import { ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { marketingApi } from '../services/api';

interface ConsentModalProps {
  isOpen: boolean;
  sessionId?: string;
  dailyCount?: number;
  onConsentSuccess: () => void;
  onClose: () => void;
}

export function ConsentModal({
  isOpen,
  sessionId,
  dailyCount = 0,
  onConsentSuccess,
  onClose,
}: ConsentModalProps) {
  const [hasChecked, setHasChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChecked) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await marketingApi.agreeConsent({ sessionId });
      setIsSubmitting(false);
      onConsentSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to record consent. Please try again.');
    }
  };

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
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '100%',
          borderRadius: '16px',
          backgroundColor: 'var(--surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#991b1b' }}>
                High-Volume Messaging Liability Consent
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#b91c1c' }}>
                Daily Threshold Warning: 500+ Messages / Day
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ color: '#991b1b', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConsentSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              backgroundColor: 'var(--surface-hover, #f8fafc)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              border: '1px solid var(--border-color, #e2e8f0)',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              color: 'var(--text-primary, #334155)',
            }}
          >
            <p style={{ marginTop: 0, marginBottom: '0.75rem', fontWeight: 600 }}>
              You are attempting to send more than <strong>500 WhatsApp messages</strong> today (Current Today: {dailyCount} msgs).
            </p>
            <p style={{ margin: '0 0 0.75rem 0' }}>
              Sending high volumes of automated or promotional messages on WhatsApp increases the risk of account review, rate-limiting, temporary restriction, or permanent WhatsApp account ban by Meta/WhatsApp.
            </p>
            <div
              style={{
                backgroundColor: '#fffbe6',
                border: '1px solid #ffe58f',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#873800',
                fontSize: '0.825rem',
              }}
            >
              ⚠️ <strong>IMPORTANT LEGAL NOTICE:</strong> You explicitly acknowledge that you are solely and exclusively responsible for your WhatsApp account safety. Our software platform, company, and developers assume NO liability for any WhatsApp account ban, suspension, or phone number restriction.
            </div>
          </div>

          {errorMsg && (
            <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          {/* Consent Checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              border: hasChecked ? '2px solid #ef4444' : '1px solid var(--border-color, #cbd5e1)',
              backgroundColor: hasChecked ? '#fff5f5' : 'var(--surface, #ffffff)',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={hasChecked}
              onChange={(e) => setHasChecked(e.target.checked)}
              style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: '#ef4444' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', lineHeight: '1.4' }}>
              I have read the disclaimer above. I accept 100% full responsibility for my WhatsApp account and agree that the company and software are not responsible for any WhatsApp ban or restriction.
            </span>
          </label>

          {/* Modal Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasChecked || isSubmitting}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: !hasChecked || isSubmitting ? 'not-allowed' : 'pointer',
                border: 'none',
                backgroundColor: !hasChecked ? '#cbd5e1' : '#ef4444',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: hasChecked ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle2 size={18} />
              {isSubmitting ? 'Recording Consent...' : 'I Consent & Proceed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
