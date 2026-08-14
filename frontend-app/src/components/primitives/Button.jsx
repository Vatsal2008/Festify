// components/primitives/Button.jsx
import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  onClick,
  type = 'button',
  ariaLabel,
  className = '',
  ...rest
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    fullWidth ? 'btn--full' : '',
    (isDisabled || isLoading) ? 'btn--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={isDisabled || isLoading}
      aria-label={ariaLabel}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        <>
          {leftIcon && <span className="btn__icon" aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="btn__icon" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
