// components/ErrorBoundary.jsx
// A render error anywhere below this point would otherwise unmount the
// whole React tree and leave a blank white page with no explanation --
// which is exactly what a single undefined field did on the organizers
// table. This keeps the failure local and legible.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console for debugging; the UI stays calm.
    console.error('Render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--space-3xl)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h1 className="type-display-md">This page hit a problem</h1>
          <p className="type-body-md" style={{ color: 'rgba(22,16,31,0.7)' }}>
            Something on this screen failed to render. The rest of the app still works.
          </p>
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              padding: 'var(--space-lg)',
              background: 'var(--color-surface-sage)',
              border: 'var(--border-hairline)',
              textAlign: 'left',
              overflowX: 'auto',
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </code>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
            <button className="btn btn--primary" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button className="btn btn--ghost" onClick={() => { window.location.href = '/'; }}>
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
