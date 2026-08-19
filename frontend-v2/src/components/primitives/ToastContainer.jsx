// components/primitives/Toast.jsx + ToastContainer.jsx
import './Modal.css';
import { useUIStore } from '@/store/uiStore';

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

export function Toast({ id, type = 'info', message, onDismiss }) {
  return (
    <div className={`toast toast--${type}`} role="alert" aria-live="polite">
      <span className="toast__icon" aria-hidden="true">{ICONS[type]}</span>
      <p className="toast__message">{message}</p>
      <button className="toast__close" onClick={() => onDismiss(id)} aria-label="Dismiss notification" type="button">✕</button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  if (!toasts.length) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={removeToast} />
      ))}
    </div>
  );
}
