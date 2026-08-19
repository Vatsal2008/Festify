// pages/discovery/EventDetailPage.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventStateChip, TicketTierCard, OrganizerCard, ReviewCard, ReviewForm, EarlyAccessBanner } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import Modal from '@/components/primitives/Modal';
import { StarRating } from '@/components/primitives/Primitives';
import { mockEvents, mockReviews } from '@/data/mockData';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import {
  CalendarIcon, MapPinIcon, UsersIcon, TicketIcon, ZapIcon, HeartIcon,
  StarIcon, CheckIcon, SparklesIcon
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

export default function EventDetailPage() {
  const { id } = useParams();
  const event = mockEvents.find(e => e.id === id) || mockEvents[0];
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  const [selectedTier, setSelectedTier] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isHyped, setIsHyped] = useState(event.is_hyped);
  const [hypeCount, setHypeCount] = useState(event.hype_count);
  const [isWishlisted, setWishlisted] = useState(event.is_wishlisted);

  const reviews = mockReviews.filter(r => r.event_id === event.id);
  const maxTickets = event.capacity > 200 ? 10 : 5;
  const totalPrice = selectedTier ? selectedTier.price * quantity : 0;
  const platformFee = Math.round(totalPrice * 0.05);

  const handleBuyClick = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!selectedTier) { toast.warning('Please select a ticket tier'); return; }
    setShowPurchaseModal(true);
  };

  const handleConfirmPurchase = () => {
    setShowPurchaseModal(false);
    setTimeout(() => setShowSuccessModal(true), 200);
  };

  const handleHype = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setIsHyped(h => !h);
    setHypeCount(c => isHyped ? c - 1 : c + 1);
  };

  const formatDt = (dt) => { try { return format(new Date(dt), 'EEEE, d MMMM yyyy'); } catch { return dt; } };
  const formatTm = (dt) => { try { return format(new Date(dt), 'h:mm a'); } catch { return dt; } };

  return (
    <PageShell>
      {/* ── Photographic Hero Background ── */}
      <TealBand
        variant="hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(22, 16, 31, 0.3) 0%, rgba(22, 16, 31, 0.68) 100%), url(${event.cover_image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          marginTop: 'calc(-1 * (var(--nav-height) + 32px))',
          paddingTop: 'calc(var(--nav-height) + 88px)',
        }}
      >
        <div className="event-detail-hero__info">
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
            <EventStateChip state={event.state} />
            <Badge variant="canvas">{event.category}</Badge>
            {event.organizer.trust_tier === 'trusted' && (
              <Badge variant="accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <StarIcon size={12} filled /> Trusted Organizer
              </Badge>
            )}
          </div>

          <h1 className="event-detail-hero__title">{event.title}</h1>

          <div className="event-detail-hero__meta">
            <span className="event-detail-hero__meta-item">
              <CalendarIcon size={16} /> {formatDt(event.start_date)} · {formatTm(event.start_date)}
            </span>
            <span className="event-detail-hero__meta-item">
              <MapPinIcon size={16} /> {event.venue}
            </span>
            <span className="event-detail-hero__meta-item">
              <UsersIcon size={16} /> {event.organizer.name}
            </span>
            <span className="event-detail-hero__meta-item">
              <TicketIcon size={16} /> {event.capacity.toLocaleString()} capacity
            </span>
          </div>

          <div className="event-detail-hero__actions">
            <button
              onClick={handleHype}
              className={`hype-btn hype-btn--canvas ${isHyped ? 'hype-btn--hyped' : ''}`}
              aria-pressed={isHyped}
            >
              <ZapIcon size={16} filled={isHyped} className="hype-btn__icon" />
              Hype · {hypeCount.toLocaleString()}
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) { navigate('/login'); return; }
                setWishlisted(w => !w);
                toast[isWishlisted ? 'info' : 'success'](isWishlisted ? 'Removed from wishlist' : 'Added to wishlist!');
              }}
              className={`wishlist-btn wishlist-btn--canvas ${isWishlisted ? 'wishlist-btn--active' : ''}`}
              aria-pressed={isWishlisted}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <HeartIcon size={20} filled={isWishlisted} />
            </button>
          </div>
        </div>
      </TealBand>

      {/* ── Early Access Banner ── */}
      <EarlyAccessBanner event={event} />

      {/* ── Main Content ── */}
      <CanvasBand>
        <div className="event-detail-layout">
          {/* Left: Description & Reviews */}
          <div>
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>About this event</h2>
              <div className="type-body-md" style={{ whiteSpace: 'pre-line', lineHeight: 'var(--lh-body-md)' }}>
                {event.description}
              </div>
            </section>

            {event.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-xl)' }}>
                {event.tags.map(tag => (
                  <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label-mono)', letterSpacing: 'var(--ls-label-mono)', textTransform: 'uppercase', padding: '4px 12px', border: 'var(--border-hairline-teal)', borderRadius: 'var(--radius-pill)', color: 'var(--color-ink)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Reviews */}
            {event.state === 'completed' && (
              <section aria-labelledby="reviews-heading" style={{ marginTop: 'var(--space-3xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                  <h2 id="reviews-heading" className="type-label-mono">Reviews</h2>
                  {event.avg_rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <StarRating value={event.avg_rating} size={18} />
                      <span className="type-body-md">{event.avg_rating} ({event.review_count})</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                  {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                </div>
                {isAuthenticated && <ReviewForm eventId={event.id} />}
              </section>
            )}
          </div>

          {/* Right: Ticket Tiers */}
          <aside aria-labelledby="tickets-heading">
            <h2 id="tickets-heading" className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>
              {event.state === 'sold_out' ? 'Sold Out' : 'Select Tickets'}
            </h2>
            <div className="tiers-panel">
              {event.tiers.map(tier => (
                <TicketTierCard
                  key={tier.id}
                  tier={tier}
                  isSelected={selectedTier?.id === tier.id}
                  onSelect={setSelectedTier}
                />
              ))}

              {selectedTier && (
                <div className="tiers-panel__total">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                    <span className="type-body-sm">Quantity</span>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, border: 'var(--border-hairline)', background: 'none', cursor: 'pointer', fontSize: 18 }}>−</button>
                      <span className="type-body-md">{quantity}</span>
                      <button onClick={() => setQuantity(q => Math.min(maxTickets, q + 1))} style={{ width: 28, height: 28, border: 'var(--border-hairline)', background: 'none', cursor: 'pointer', fontSize: 18 }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                    <span className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.6)' }}>Platform fee (5%)</span>
                    <span className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.6)' }}>₹{platformFee}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                    <span className="type-body-md" style={{ fontWeight: 600 }}>Total</span>
                    <span className="type-heading-lg">{totalPrice === 0 ? 'Free' : `₹${totalPrice + platformFee}`}</span>
                  </div>
                </div>
              )}

              {event.state === 'sold_out' ? (
                <Button variant="secondary" fullWidth onClick={() => toast.info('Added to waitlist!')}>
                  Join Waitlist
                </Button>
              ) : (
                <Button variant="primary" fullWidth onClick={handleBuyClick}>
                  {isAuthenticated ? 'Buy Tickets' : 'Sign in to Buy'}
                </Button>
              )}
            </div>

            {/* Organizer */}
            <div style={{ marginTop: 'var(--space-2xl)' }}>
              <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>Organizer</h2>
              <OrganizerCard org={event.organizer} />
            </div>
          </aside>
        </div>
      </CanvasBand>

      {/* ── Purchase Confirmation Modal ── */}
      <Modal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        title="Confirm Purchase"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPurchaseModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirmPurchase}>Pay ₹{(totalPrice + platformFee) || 0}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Event</p><p className="type-body-md">{event.title}</p></div>
          <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Tier</p><p className="type-body-md">{selectedTier?.name}</p></div>
          <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Quantity</p><p className="type-body-md">{quantity}</p></div>
          <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Ticket price</p><p className="type-body-md">₹{totalPrice}</p></div>
          <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Platform fee (5%)</p><p className="type-body-md">₹{platformFee}</p></div>
          <div style={{ borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-lg)' }}>
            <p className="type-label-mono" style={{ marginBottom: 4 }}>Total</p>
            <p className="type-display-md">{totalPrice === 0 ? 'Free' : `₹${totalPrice + platformFee}`}</p>
          </div>
        </div>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Booking Confirmed!"
        footer={
          <Button variant="primary" onClick={() => { setShowSuccessModal(false); navigate('/me/tickets'); }}>
            View My Tickets
          </Button>
        }
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xl)' }}>
          <CheckIcon size={48} style={{ color: 'var(--color-success)' }} />
          <p className="type-body-md">Your ticket for <strong>{event.title}</strong> is confirmed. A QR code is ready in your ticket wallet.</p>
          <Badge variant="success">Booking code: FTF-{Math.random().toString(36).slice(2, 6).toUpperCase()}</Badge>
        </div>
      </Modal>
    </PageShell>
  );
}
