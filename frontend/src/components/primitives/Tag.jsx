// components/primitives/Tag.jsx — Pill-radius category filter tags
import './primitives.css';

export default function Tag({ children, isActive = false, onClick, className = '' }) {
  if (onClick) {
    return (
      <button
        type="button"
        className={`tag ${isActive ? 'tag--active' : ''} ${className}`}
        onClick={onClick}
        aria-pressed={isActive}
      >
        {children}
      </button>
    );
  }
  return (
    <span className={`tag ${isActive ? 'tag--active' : ''} ${className}`}>
      {children}
    </span>
  );
}
