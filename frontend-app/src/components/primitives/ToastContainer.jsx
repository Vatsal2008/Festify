// components/primitives/Toast.jsx + ToastContainer.jsx
import './Modal.css';
import { useUIStore } from '@/store/uiStore';
import { CheckIcon, XIcon, AlertTriangleIcon, BellIcon } from '@/components/icons/Icons';

export function Toast({ id, type = 'info', message, onDismiss }) {
  const renderIcon = () => {
    switch (type) {
      case 'success': return <CheckIcon size={18} />;
      case 'error':   return <XIcon size={18} />;
      case 'warning': return <AlertTriangleIcon size={18} />;
      default:        return <BellIcon size={18} />;
    }
  };

  return (
    <div className={`toast toast--${type}`} role="alert" aria-live="polite">
      <span className="toast__icon" aria-hidden="true">{renderIcon()}</span>
      <p className="toast__message">{message}</p>
      <button className="toast__close" onClick={() => onDismiss(id)} aria-label="Dismiss notification" type="button"><XIcon size={14} /></button>
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
