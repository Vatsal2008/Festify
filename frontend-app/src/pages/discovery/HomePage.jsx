// pages/discovery/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventCard } from '@/components/domain';
import { Tag } from '@/components/primitives';
import { trendingEvents, featuredEvents, hypedEvents, upcomingEvents, collegeEvents, eventCategories, HERO_BACKGROUND_IMAGE } from '@/data/mockData';
import { useAuth } from '@/lib/auth/AuthContext';
import { ZapIcon, GraduationCapIcon, ArrowRightIcon, SearchIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const navigate = useNavigate();
  const { isAuthenticated, isCollegeVerified } = useAuth();

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <PageShell>
      {/* ── Hero with Photographic Background Overlay ── */}
      <TealBand
        variant="hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(8, 61, 68, 0.35) 0%, rgba(8, 61, 68, 0.68) 100%), url(${HERO_BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          position: 'relative',
          marginTop: 'calc(-1 * (var(--nav-height) + 32px))',
          paddingTop: 'calc(var(--nav-height) + 88px)',
        }}
      >
        <div className="home-hero">
          <h1 className="home-hero__title">
            Discover <em>College Events</em> &amp; Book Tickets
          </h1>
          <p className="home-hero__sub">
            Hackathons, cultural fests, concerts, sports, and keynotes — curated from top colleges across India
          </p>

          <form className="home-hero__search" onSubmit={handleSearch} role="search">
            <label htmlFor="hero-search" className="visually-hidden">Search events</label>
            <input
              id="hero-search"
              type="search"
              placeholder="Search by event, college, or category..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SearchIcon size={18} /> Search
            </button>
          </form>

          <div className="home-hero__cats" role="list" aria-label="Event categories">
            {eventCategories.slice(0, 8).map(cat => (
              <Tag
                key={cat}
                isActive={activeCategory === cat}
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
      </TealBand>

      {/* ── Trending ── */}
      <CanvasBand>
        <div className="home-section-header">
          <h2 className="type-display-md">Trending Now</h2>
          <a href="/search?sort=trending" className="home-section-header__link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <ArrowRightIcon size={14} />
          </a>
        </div>
        <div className="events-grid">
          {trendingEvents.map(evt => <EventCard key={evt.id} event={evt} />)}
        </div>
      </CanvasBand>

      {/* ── Featured ── */}
      <TealBand>
        <div className="home-section-header">
          <h2 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Featured Events</h2>
          <span className="type-label-mono" style={{ color: 'rgba(252,252,248,0.5)' }}>Curated by Festify</span>
        </div>
        <div className="events-grid">
          {featuredEvents.map(evt => <EventCard key={evt.id} event={evt} variant="featured" />)}
        </div>
      </TealBand>

      {/* ── Hyped ── */}
      <CanvasBand>
        <div className="home-section-header">
          <h2 className="type-display-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ZapIcon size={24} filled style={{ color: 'var(--color-ink)' }} /> Hyped This Week
          </h2>
          <a href="/search?sort=hyped" className="home-section-header__link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <ArrowRightIcon size={14} />
          </a>
        </div>
        <div className="events-grid">
          {hypedEvents.map(evt => <EventCard key={evt.id} event={evt} />)}
        </div>
      </CanvasBand>

      {/* ── College-only (if verified) ── */}
      {isAuthenticated && isCollegeVerified && (
        <TealBand>
          <div className="home-section-header">
            <h2 className="type-display-md" style={{ color: 'var(--color-canvas)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCapIcon size={24} /> At Your College
            </h2>
            <span className="type-label-mono" style={{ color: 'rgba(252,252,248,0.5)' }}>BITS Pilani</span>
          </div>
          <div className="events-grid">
            {collegeEvents.map(evt => <EventCard key={evt.id} event={evt} variant="featured" />)}
          </div>
        </TealBand>
      )}

      {/* ── Upcoming ── */}
      <CanvasBand>
        <div className="home-section-header">
          <h2 className="type-display-md">Upcoming Events</h2>
          <a href="/search" className="home-section-header__link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            See all <ArrowRightIcon size={14} />
          </a>
        </div>
        <div className="events-grid">
          {upcomingEvents.map(evt => <EventCard key={evt.id} event={evt} />)}
        </div>
      </CanvasBand>
    </PageShell>
  );
}
