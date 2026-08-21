// pages/discovery/SearchPage.jsx — server-side search, filter and sort
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { PageShell, CanvasBand } from '@/components/layout';
import { EventCard } from '@/components/domain';
import { Tag, Input, RevealGrid, QueryBoundary } from '@/components/primitives';
import { eventsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/constants/queryKeys';
import '@/pages/pages.css';

const CATEGORIES = [
  'All', 'Hackathon', 'Cultural', 'Music', 'Sports',
  'Talk', 'Workshop', 'Party', 'Comedy', 'Theatre',
];

const SORT_OPTIONS = [
  { id: 'trending', label: 'Trending' },
  { id: 'date', label: 'Date' },
  { id: 'price-asc', label: 'Price: Low → High' },
  { id: 'price-desc', label: 'Price: High → Low' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get('q') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState(searchParams.get('sort') || 'trending');

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 350);
    return () => clearTimeout(t);
  }, [input]);

  // Keep the URL shareable/bookmarkable as filters change.
  useEffect(() => {
    const next = {};
    if (q) next.q = q;
    if (activeCategory !== 'All') next.category = activeCategory;
    if (sort !== 'trending') next.sort = sort;
    setSearchParams(next, { replace: true });
  }, [q, activeCategory, sort, setSearchParams]);

  const searchQuery = useQuery({
    queryKey: queryKeys.search.events(q, { category: activeCategory, sort }),
    queryFn: () => eventsApi.list({ q: q || undefined, category: activeCategory, sort }),
    // Keeps previous results on screen while refining, instead of
    // flashing a spinner on every filter change.
    placeholderData: keepPreviousData,
  });

  const results = searchQuery.data ?? [];

  return (
    <PageShell>
      <CanvasBand>
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h1 className="type-display-md" style={{ color: 'var(--color-ink)', marginBottom: 'var(--space-lg)' }}>
            Search Events
          </h1>
          <form onSubmit={e => { e.preventDefault(); setQ(input); }} role="search" style={{ maxWidth: 640 }}>
            <Input
              isSearch
              placeholder="Search by event title, college, venue, or keyword..."
              value={input}
              onChange={e => setInput(e.target.value)}
              aria-label="Search events"
              style={{ background: 'var(--color-surface-sage)', borderColor: 'var(--color-hairline)' }}
            />
          </form>
        </div>

        <div className="search-filters" style={{ marginBottom: 'var(--space-lg)' }}>
          <span className="type-label-mono" style={{ marginRight: 'var(--space-sm)' }}>Category:</span>
          {CATEGORIES.map(cat => (
            <Tag key={cat} isActive={activeCategory === cat} onClick={() => setActiveCategory(cat)}>{cat}</Tag>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-3xl)', borderBottom: 'var(--border-hairline)', paddingBottom: 'var(--space-lg)' }}>
          <span className="type-label-mono">Sort by:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className="type-label-mono"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                // 0.5 alpha measured 3.48:1 on the cream ground; 13px mono needs 4.5:1.
                color: sort === opt.id ? 'var(--color-ink)' : 'rgba(22, 16, 31,0.72)',
                borderBottom: sort === opt.id ? '2px solid var(--color-ink)' : '2px solid transparent',
                padding: '4px 0',
                marginRight: 'var(--space-md)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="search-results-header" style={{ marginBottom: 'var(--space-xl)' }}>
          <p className="type-label-mono" style={{ color: 'rgba(22, 16, 31,0.7)' }}>
            {searchQuery.isPending ? 'Searching…' : `${results.length} event${results.length === 1 ? '' : 's'} found`}
          </p>
        </div>

        <QueryBoundary
          query={searchQuery}
          emptyTitle="No events found"
          emptySub="Try a different search term or clear the filters."
          loadingLabel="Searching"
        >
          {(data) => (
            <RevealGrid className="events-grid">
              {data.map(evt => <EventCard key={evt.id} event={evt} />)}
            </RevealGrid>
          )}
        </QueryBoundary>
      </CanvasBand>
    </PageShell>
  );
}
