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
}) {
  if (query.isPending) {
    return (
      <div style={{ minHeight, display: 'grid', placeItems: 'center', gap: 'var(--space-lg)' }}>
        <Spinner size="lg" />
        <span className="type-label-mono" style={{ opacity: 0.6 }}>{loadingLabel}</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="empty-state" style={{ minHeight }} role="alert">
        <h2 className="empty-state__title">Couldn&apos;t load this</h2>
        <p className="empty-state__sub">{apiError(query.error)}</p>
        <Button variant="primary" onClick={() => query.refetch()}>Try again</Button>
      </div>
    );
  }

  const empty = typeof isEmpty === 'function'
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
