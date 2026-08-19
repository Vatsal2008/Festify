// pages/discovery/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventCard } from '@/components/domain';
import { Tag, RevealGrid } from '@/components/primitives';
import { trendingEvents, featuredEvents, hypedEvents, upcomingEvents, collegeEvents, eventCategories } from '@/data/mockData';
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

        <div className="home-hero">
          <span className="home-hero__live">
            <span className="home-hero__live-dot" aria-hidden="true" />
            214 fests live right now
          </span>

          <h1 className="home-hero__title">
            Your next fest <em>starts here.</em>
          </h1>
          <p className="home-hero__sub">
            Every cultural night, tech fest, DJ set, and hackathon worth showing up for — across every college in India, in one place.
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
        <RevealGrid className="events-grid">
          {trendingEvents.map(evt => <EventCard key={evt.id} event={evt} />)}
        </RevealGrid>
      </CanvasBand>

      {/* ── Featured ── */}
      <TealBand>
        <div className="home-section-header">
          <h2 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Featured Events</h2>
          <span className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.5)' }}>Curated by Festify</span>
        </div>
        <RevealGrid className="events-grid">
          {featuredEvents.map(evt => <EventCard key={evt.id} event={evt} variant="featured" />)}
        </RevealGrid>
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
        <RevealGrid className="events-grid">
          {hypedEvents.map(evt => <EventCard key={evt.id} event={evt} />)}
        </RevealGrid>
      </CanvasBand>

      {/* ── College-only (if verified) ── */}
      {isAuthenticated && isCollegeVerified && (
        <TealBand>
          <div className="home-section-header">
            <h2 className="type-display-md" style={{ color: 'var(--color-canvas)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GraduationCapIcon size={24} /> At Your College
            </h2>
            <span className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.5)' }}>BITS Pilani</span>
          </div>
          <RevealGrid className="events-grid">
            {collegeEvents.map(evt => <EventCard key={evt.id} event={evt} variant="featured" />)}
          </RevealGrid>
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
        <RevealGrid className="events-grid">
          {upcomingEvents.map(evt => <EventCard key={evt.id} event={evt} />)}
        </RevealGrid>
      </CanvasBand>
    </PageShell>
  );
}
