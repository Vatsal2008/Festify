// components/ErrorBoundary.jsx
// A render error anywhere below this point would otherwise unmount the
// whole React tree and leave a blank white page with no explanation --
// which is exactly what a single undefined field did on the organizers
// table. This keeps the failure local and legible.
import { Component } from 'react';
import { AlertTriangleIcon } from '@/components/icons/Icons';
import './errorBoundary.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retries: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack in the console for debugging; the UI stays calm.
    console.error('Render error:', error, info?.componentStack);
  }

  // Clearing the error re-renders the same subtree with the same props,
  // so a fault in the data rather than a transient one throws straight
  // back and the button looks broken. After the second attempt the
  // offer changes to a reload, which is the thing that can actually
  // still help, instead of repeating one that cannot.
  retry = () => this.setState((s) => ({ error: null, retries: s.retries + 1 }));

  render() {
    if (!this.state.error) return this.props.children;
    const exhausted = this.state.retries >= 2;

    return (
      <div role="alert" className="errb">
        <div className="errb__inner">
          <span className="errb__mark" aria-hidden="true">
            <AlertTriangleIcon size={24} />
          </span>

          <h1 className="type-display-md errb__title">This page hit a problem</h1>

          <p className="type-body-md errb__body">
            {exhausted
              ? 'This screen keeps failing to render. Reloading clears whatever state it is stuck on.'
              : 'Something on this screen failed to render. The rest of the app still works.'}
          </p>

          <code className="errb__detail">
            {String(this.state.error?.message || this.state.error)}
          </code>

          <div className="errb__actions">
            {exhausted ? (
              <button className="btn btn--primary" onClick={() => window.location.reload()}>
                Reload the page
              </button>
            ) : (
              <button className="btn btn--primary" onClick={this.retry}>
                Try again
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => { window.location.href = '/'; }}>
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
