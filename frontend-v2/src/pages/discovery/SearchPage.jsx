// pages/discovery/SearchPage.jsx — Search page with inline search bar and category filters
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageShell, CanvasBand } from '@/components/layout';
import { EventCard } from '@/components/domain';
import { Tag, Input, RevealGrid } from '@/components/primitives';
import { mockEvents, eventCategories } from '@/data/mockData';
import '@/pages/pages.css';

const SORT_OPTIONS = [
  { id: 'trending', label: 'Trending' },
  { id: 'date', label: 'Date' },
  { id: 'price-asc', label: 'Price: Low → High' },
  { id: 'price-desc', label: 'Price: High → Low' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState('trending');

  const results = useMemo(() => {
    let evts = [...mockEvents];
    if (query) evts = evts.filter(e => e.title.toLowerCase().includes(query.toLowerCase()) || e.venue.toLowerCase().includes(query.toLowerCase()));
    if (activeCategory !== 'All') evts = evts.filter(e => e.category === activeCategory);
    if (sort === 'date') evts.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    if (sort === 'price-asc') evts.sort((a, b) => Math.min(...a.tiers.map(t => t.price)) - Math.min(...b.tiers.map(t => t.price)));
    if (sort === 'price-desc') evts.sort((a, b) => Math.max(...b.tiers.map(t => t.price)) - Math.max(...a.tiers.map(t => t.price)));
    if (sort === 'trending') evts.sort((a, b) => b.hype_count - a.hype_count);
    return evts;
  }, [query, activeCategory, sort]);

  return (
    <PageShell>
      <CanvasBand>
        {/* ── Search Input Box ── */}
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h1 className="type-display-md" style={{ color: 'var(--color-ink)', marginBottom: 'var(--space-lg)' }}>
            Search Events
          </h1>
          <form onSubmit={e => { e.preventDefault(); setSearchParams({ q: query }); }} role="search" style={{ maxWidth: 640 }}>
            <Input
              isSearch
              placeholder="Search by event title, college, venue, or keyword..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search events"
              style={{ background: 'var(--color-surface-sage)', borderColor: 'var(--color-hairline)' }}
            />
          </form>
        </div>

        {/* ── Category & Sort Filters ── */}
        <div className="search-filters" style={{ marginBottom: 'var(--space-lg)' }}>
          <span className="type-label-mono" style={{ marginRight: 'var(--space-sm)' }}>Category:</span>
          {eventCategories.map(cat => (
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
                color: sort === opt.id ? 'var(--color-ink)' : 'rgba(22, 16, 31,0.5)',
                borderBottom: sort === opt.id ? '2px solid var(--color-ink)' : '2px solid transparent',
                padding: '4px 0',
                marginRight: 'var(--space-md)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Results Grid ── */}
        <div className="search-results-header" style={{ marginBottom: 'var(--space-xl)' }}>
          <p className="type-label-mono" style={{ color: 'rgba(22, 16, 31,0.7)' }}>{results.length} events found</p>
        </div>

        {results.length > 0 ? (
          <RevealGrid className="events-grid">
            {results.map(evt => <EventCard key={evt.id} event={evt} />)}
          </RevealGrid>
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon">🔍</span>
            <h2 className="empty-state__title">No events found</h2>
            <p className="empty-state__sub">Try a different search term or clear the filters</p>
          </div>
        )}
      </CanvasBand>
    </PageShell>
  );
}
