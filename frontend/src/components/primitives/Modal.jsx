// components/primitives/Modal.jsx
import { useEffect, useRef } from 'react';
import './Modal.css';

export default function Modal({
  isOpen, onClose, title, children, footer,
  size = 'md', closeOnOverlayClick = true, closeOnEsc = true,
}) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement;
    // Focus first focusable element
    const focusable = panelRef.current?.querySelector('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])');
    setTimeout(() => focusable?.focus(), 50);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!closeOnEsc) return;
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeOnOverlayClick ? onClose : undefined} role="presentation">
      <div
        ref={panelRef}
        className={`modal-panel modal-panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {title && <h2 id="modal-title" className="modal-title type-display-md">{title}</h2>}
          <button className="modal-close" onClick={onClose} aria-label="Close modal" type="button">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
