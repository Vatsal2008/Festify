// components/primitives/Tag.jsx — category filter tags
import './primitives.css';

export default function Tag({
  children,
  isActive = false,
  onClick,
  className = '',
  // Forwarded so callers can set per-tag custom properties such as
  // --cat. Without this the category hue could not reach the tag and
  // every filter chip rendered the same grey.
  style,
  ...rest
}) {
  const cls = `tag ${isActive ? 'tag--active' : ''} ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        aria-pressed={isActive}
        style={style}
        {...rest}
      >
        {children}
      </button>
    );
  }
  return (
    <span className={cls} style={style} {...rest}>
      {children}
    </span>
  );
}
