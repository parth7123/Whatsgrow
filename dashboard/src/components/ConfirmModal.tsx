import { X, AlertTriangle, HelpCircle, Trash2, CheckCircle2 } from 'lucide-react';
import './ConfirmModal.css';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : HelpCircle;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-modal modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-header modal-header">
          <div className="confirm-modal-title-group">
            <div className={`confirm-icon-badge variant-${variant}`}>
              <Icon size={22} />
            </div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} disabled={isLoading}>
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-body modal-body">
          <p className="confirm-message">{message}</p>
        </div>

        <div className="confirm-modal-footer modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn-confirm variant-${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="confirm-spinner" />
            ) : (
              <>
                <CheckCircle2 size={16} />
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
