// components/primitives/Card.jsx
import './Card.css';

export default function Card({
  children,
  variant = 'default',   // 'default' | 'teal' | 'sage'
  padding = 'md',        // 'sm' | 'md' | 'lg'
  onClick,
  isSelected = false,
  className = '',
  ariaLabel,
  style,
  ...rest
}) {
  const cls = [
    'card',
    `card--${variant}`,
    `card--pad-${padding}`,
    onClick ? 'card--interactive' : '',
    isSelected ? 'card--selected' : '',
    className,
  ].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <div
        className={cls}
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-pressed={isSelected}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(e)}
        style={style}
        {...rest}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cls} aria-label={ariaLabel} style={style} {...rest}>
      {children}
    </div>
  );
}
