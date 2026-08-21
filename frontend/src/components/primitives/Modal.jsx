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
    if (!isOpen) return;

    // A real focus trap. The dialog previously moved focus *into* itself
    // and restored it on close, but never contained it: tabbing past the
    // last control walked out into the page behind, which is still
    // rendered and still clickable. A keyboard user then finds
    // themselves operating a page they cannot see, with no way back
    // except reverse-tabbing blind through the whole document.
    const SELECTOR = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handler = (e) => {
      if (e.key === 'Escape' && closeOnEsc) { onClose(); return; }
      if (e.key !== 'Tab') return;

      const nodes = Array.from(panelRef.current?.querySelectorAll(SELECTOR) ?? [])
        // offsetParent filters out anything hidden; a trap that lands on
        // an invisible control is indistinguishable from a broken one.
        .filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!nodes.length) { e.preventDefault(); return; }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

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
