// components/primitives/Input.jsx
import './primitives.css';
export default function Input({ label, error, hint, type = 'text', isSearch = false, className = '', id, ...rest }) {
  const fieldId = id || `input-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label htmlFor={fieldId} className="input-label">{label}</label>}
      <input
        id={fieldId} type={type}
        className={`input-field ${isSearch ? 'input-search' : ''} ${error ? 'input-field--error' : ''}`}
        aria-invalid={!!error} aria-describedby={error ? `${fieldId}-err` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
      {error && <span id={`${fieldId}-err`} className="input-error-msg" role="alert">{error}</span>}
      {hint && !error && <span id={`${fieldId}-hint`} className="input-hint">{hint}</span>}
    </div>
  );
}

// components/primitives/Select.jsx
export function Select({ label, error, hint, children, className = '', id, ...rest }) {
  const fieldId = id || `select-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label htmlFor={fieldId} className="input-label">{label}</label>}
      <select id={fieldId} className={`select-field ${error ? 'input-field--error' : ''}`}
        aria-invalid={!!error} {...rest}>{children}</select>
      {error && <span className="input-error-msg" role="alert">{error}</span>}
      {hint && !error && <span className="input-hint">{hint}</span>}
    </div>
  );
}

// components/primitives/Textarea.jsx
export function Textarea({ label, error, hint, rows = 4, className = '', id, ...rest }) {
  const fieldId = id || `ta-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label htmlFor={fieldId} className="input-label">{label}</label>}
      <textarea id={fieldId} rows={rows}
        className={`textarea-field ${error ? 'input-field--error' : ''}`}
        aria-invalid={!!error} {...rest} />
      {error && <span className="input-error-msg" role="alert">{error}</span>}
      {hint && !error && <span className="input-hint">{hint}</span>}
    </div>
  );
}

// components/primitives/Spinner.jsx
export function Spinner({ size = 'md', variant = 'ink', className = '' }) {
  return <span className={`spinner spinner--${size} ${variant === 'canvas' ? 'spinner--canvas' : ''} ${className}`} role="status" aria-label="Loading" />;
}

// components/primitives/Skeleton.jsx
export function Skeleton({ width, height, variant = '', className = '', style }) {
  return <div className={`skeleton skeleton--${variant} ${className}`} style={{ width, height, ...style }} aria-hidden="true" />;
}

// components/primitives/ProgressBar.jsx
export function ProgressBar({ value = 0, max = 100, size = 'md', variant = 'default', className = '', ariaLabel }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`progress-bar progress-bar--${size} ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={ariaLabel}>
      <div className={`progress-bar__fill progress-bar__fill--${variant}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// components/primitives/StarRating.jsx
export function StarRating({ value = 0, max = 5, interactive = false, onChange, size = 20, className = '' }) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  if (interactive) {
    return (
      <div className={`star-rating star-input ${className}`} role="radiogroup" aria-label="Star rating">
        {stars.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={value === s} aria-label={`${s} star`}
            className={`star ${s <= value ? 'star--filled' : ''}`} style={{ fontSize: size }}
            onClick={() => onChange?.(s)}>★</button>
        ))}
      </div>
    );
  }
  return (
    <div className={`star-rating ${className}`} aria-label={`${value} out of ${max} stars`}>
      {stars.map((s) => (
        <span key={s} className={`star ${s <= Math.floor(value) ? 'star--filled' : ''}`} style={{ fontSize: size }} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

// components/primitives/Avatar.jsx
export function Avatar({ name = '', src, size = 'md', level, className = '' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`avatar avatar--${size} ${className}`} aria-label={name}>
      {src ? <img src={src} alt={name} /> : <span aria-hidden="true">{initials}</span>}
      {level && <span className={`avatar__ring avatar__ring--${level}`} aria-hidden="true" />}
    </div>
  );
}

// components/primitives/Divider.jsx
export function Divider({ variant = '', size = 'md', className = '' }) {
  return <hr className={`divider ${variant ? `divider--${variant}` : ''} divider--${size} ${className}`} aria-hidden="true" />;
}

// Re-export Select for index barrel
export { Select as SelectField };
