// pages/discovery/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventCard, hueFor } from '@/components/domain';
import { Tag, RevealGrid, QueryBoundary } from '@/components/primitives';
import { EventGridSkeleton } from '@/components/primitives/Skeleton';
import { eventsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/lib/auth/AuthContext';
import { ZapIcon, GraduationCapIcon, ArrowRightIcon, SearchIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

const CATEGORIES = [
  'All', 'Hackathon', 'Cultural', 'Music', 'Sports',
  'Talk', 'Workshop', 'Party', 'Comedy', 'Theatre',
];

/** A home section backed by a slice of the shared events query. */
function EventSection({ query, pick, emptySub, variant }) {
  return (
    <QueryBoundary
      query={query}
      isEmpty={(data) => !pick(data ?? []).length}
      emptyTitle="No events yet"
      emptySub={emptySub}
      loadingLabel="Loading events"
      skeleton={<EventGridSkeleton count={6} />}
    >
      {(data) => (
        <RevealGrid className="events-grid">
          {pick(data).map(evt => <EventCard key={evt.id} event={evt} variant={variant} />)}
        </RevealGrid>
      )}
    </QueryBoundary>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const navigate = useNavigate();
  const { isAuthenticated, isCollegeVerified, user } = useAuth();

  // One request feeds every section on this page; each section is a
  // different slice of the same result rather than its own round trip.
  const eventsQuery = useQuery({
    queryKey: queryKeys.events.list({ sort: 'trending' }),
    queryFn: () => eventsApi.list({ sort: 'trending' }),
  });

  const events = eventsQuery.data ?? [];
  const liveCount = events.filter(
    e => ['on_sale', 'live', 'ongoing', 'early_access'].includes(e.state)
  ).length;

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <PageShell>
      {/* ── Hero: full-bleed looping video, festival-night energy ── */}
      <TealBand
        variant="hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          marginTop: 'calc(-1 * (var(--nav-height) + 32px))',
          paddingTop: 'calc(var(--nav-height) + 96px)',
          paddingBottom: 'var(--space-6xl)',
        }}
      >
        <video
          className="home-hero-video"
          autoPlay
          loop
          muted
          playsInline
          poster="/media/hero-poster.jpg"
          aria-hidden="true"
        >
          <source src="/media/hero-stage-loop.mp4" type="video/mp4" />
        </video>
        <div className="home-hero-scrim" aria-hidden="true" />

        {/* Two columns of unequal weight rather than one centred stack.
            A dead-centre hero is the most recognisable generated layout
            there is; an off-axis split gives the eye somewhere to enter
            and somewhere to travel. */}
        <div className="home-hero">
          <div className="home-hero__lead">
            <span className="home-hero__live">
              <span className="home-hero__live-dot" aria-hidden="true" />
              {liveCount > 0 ? `${liveCount} fests on sale right now` : 'Fresh fests every week'}
            </span>

            <h1 className="home-hero__title">
              Your next fest <em>starts here.</em>
            </h1>
            <p className="home-hero__sub">
              Every cultural night, tech fest, DJ set and hackathon worth showing up for — across every college in India, in one place.
            </p>

          <form className="home-hero__search" onSubmit={handleSearch} role="search">
            <label htmlFor="hero-search" className="visually-hidden">Search events</label>
            <input
              id="hero-search"
              type="search"
              placeholder="Search by fest, college, or artist..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SearchIcon size={18} /> Search
            </button>
          </form>

          <div className="home-hero__cats" role="list" aria-label="Event categories">
            {CATEGORIES.slice(0, 9).map(cat => (
              <Tag
                key={cat}
                isActive={activeCategory === cat}
                className="cat-chip"
                style={{ '--cat': cat === 'All' ? 'var(--color-accent)' : hueFor(cat) }}
                onClick={() => {
                  setActiveCategory(cat);
                  if (cat !== 'All') navigate(`/search?category=${cat}`);
                }}
              >
                {cat}
              </Tag>
            ))}
            </div>
          </div>

          {/* The counterweight. Real figures from the loaded events, not
              invented stats -- a hero that lies about its own numbers is
              worse than one with none. */}
          <aside className="home-hero__panel" aria-label="At a glance">
            <div className="home-hero__stat">
              <span className="home-hero__stat-num">{events.length || '—'}</span>
              <span className="home-hero__stat-label">fests listed</span>
            </div>
            {/* "on sale now" lived here and repeated the pill above it
                verbatim -- two identical numbers side by side read as a
                bug, not as emphasis. Colleges is the figure the pill
                does not already carry. */}
            <div className="home-hero__stat">
              <span className="home-hero__stat-num" style={{ color: 'var(--hue-sports)' }}>
                {new Set(events.map(e => e.venue?.split(',').pop()?.trim()).filter(Boolean)).size || '—'}
              </span>
              <span className="home-hero__stat-label">cities</span>
            </div>
            <div className="home-hero__stat">
              <span className="home-hero__stat-num" style={{ color: 'var(--hue-talk)' }}>
                {new Set(events.map(e => e.organizer?.name).filter(Boolean)).size || '—'}
              </span>
              <span className="home-hero__stat-label">organisers</span>
            </div>
          </aside>
        </div>
      </TealBand>

      {/* ── Trending ── */}
      <CanvasBand>
        <div className="home-section-header">
          <h2 className="type-display-md">Trending now</h2>
          <a href="/search?sort=trending" className="home-section-header__link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <ArrowRightIcon size={14} />
          </a>
        </div>
        <EventSection
          query={eventsQuery}
          pick={(d) => d.slice(0, 6)}
          emptySub="Nothing is live yet — the first fests are on their way."
        />
      </CanvasBand>

      {/* ── Hyped ── */}
      <CanvasBand>
        <div className="home-section-header">
          <h2 className="type-display-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ZapIcon size={24} filled style={{ color: 'var(--color-ink)' }} /> Hyped This Week
          </h2>
          <a href="/search?sort=trending" className="home-section-header__link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <ArrowRightIcon size={14} />
          </a>
        </div>
        <EventSection
          query={eventsQuery}
          pick={(d) => [...d].sort((a, b) => b.hype_count - a.hype_count).slice(0, 3)}
          emptySub="No one has hyped an event yet. Be first."
        />
      </CanvasBand>

      {/* ── At your college (only once the user has verified one) ── */}
      {isAuthenticated && isCollegeVerified && (
        <TealBand>
          <div className="home-section-header">
            <h2 className="type-display-md" style={{ color: 'var(--color-canvas)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCapIcon size={24} /> At Your College
            </h2>
          </div>
          <EventSection
            query={eventsQuery}
            variant="featured"
            pick={(d) => d.filter(e => e.college_id && e.college_id === user?.college_id).slice(0, 3)}
            emptySub="No events at your college right now."
          />
        </TealBand>
      )}

      {/* ── Upcoming (soonest first) ── */}
      <CanvasBand>
        <div className="home-section-header">
          <h2 className="type-display-md">Upcoming Events</h2>
          <a href="/search" className="home-section-header__link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <ArrowRightIcon size={14} />
          </a>
        </div>
        <EventSection
          query={eventsQuery}
          pick={(d) => [...d].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)).slice(0, 6)}
          emptySub="No upcoming events scheduled yet."
        />
      </CanvasBand>
    </PageShell>
  );
}
