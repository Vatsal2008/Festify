// components/primitives/QueryBoundary.jsx
// One place to render the loading / error / empty states around a
// TanStack Query result, so every page treats them the same way instead
// of each inventing its own spinner and error copy.
import { Spinner } from '@/components/primitives/Primitives';
import Button from '@/components/primitives/Button';
import { apiError } from '@/lib/api/client';

export default function QueryBoundary({
  query,
  children,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptySub = 'Check back soon.',
  loadingLabel = 'Loading',
  minHeight = 280,
  // A placeholder shaped like the content that is coming. Passing one
  // is strongly preferred to the spinner fallback: a spinner reserves
  // no space, so the page jumps by the full height of the result the
  // moment it lands, and it communicates nothing about what is loading.
  skeleton = null,
}) {
  // isPending is true for a *disabled* query too, and stays true
  // forever because nothing will ever fetch. Testing it alone renders a
  // spinner that never resolves -- the failure mode that left the admin
  // panel as a blank dark screen. A spinner is only right while a
  // request is genuinely in flight.
  if (query.isLoading || (query.isPending && query.isFetching)) {
    if (skeleton) return skeleton;
    return (
      <div
        style={{ minHeight, display: 'grid', placeItems: 'center', gap: 'var(--space-lg)' }}
        role="status"
        aria-live="polite"
      >
        <Spinner size="lg" />
        <span className="type-label-mono" style={{ opacity: 0.6 }}>{loadingLabel}</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="empty-state" style={{ minHeight }} role="alert" aria-live="assertive">
        <h2 className="empty-state__title">Couldn&apos;t load this</h2>
        <p className="empty-state__sub">{apiError(query.error)}</p>
        <Button variant="primary" onClick={() => query.refetch()}>Try again</Button>
      </div>
    );
  }

  // A disabled query that never ran has no data at all. Treat that as
  // empty rather than handing undefined to children, which would throw
  // inside the very boundary meant to prevent broken screens.
  const empty = query.data === undefined
    ? true
    : typeof isEmpty === 'function'
      ? isEmpty(query.data)
      : Array.isArray(query.data) && query.data.length === 0;

  if (empty) {
    return (
      <div className="empty-state" style={{ minHeight }}>
        <h2 className="empty-state__title">{emptyTitle}</h2>
        <p className="empty-state__sub">{emptySub}</p>
      </div>
    );
  }

  return children(query.data);
}
