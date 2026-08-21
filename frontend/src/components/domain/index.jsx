// components/domain/index.jsx — All domain components with SVG icons & image overlays
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import { eventsApi } from '@/lib/api/endpoints';
import { Avatar, StarRating } from '@/components/primitives/Primitives';
import Badge from '@/components/primitives/Badge';
import Card from '@/components/primitives/Card';
import Button from '@/components/primitives/Button';
import { buildRoute } from '@/constants/routes';
import { EVENT_STATE_LABELS, LEVEL_COLORS, LEVEL_LABELS } from '@/constants/eventStates';
import {
  CalendarIcon, MapPinIcon, UsersIcon, ZapIcon, HeartIcon,
  GraduationCapIcon, TicketIcon, CheckIcon, XIcon, AlertTriangleIcon,
  BellIcon, SparklesIcon, CodeIcon, TheaterIcon, MusicIcon, TrophyIcon, MicIcon
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import './domain.css';

// ── Helpers ──────────────────────────────────────────────────────
function formatPrice(tiers) {
  if (!tiers || !tiers.length) return 'Free';
  const prices = tiers.map(t => t.price).filter(p => p !== null);
  if (!prices.length) return 'Free';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === 0 && max === 0) return 'Free';
  if (min === max) return `₹${min}`;
  if (min === 0) return `Free – ₹${max}`;
  return `₹${min} – ₹${max}`;
}
function formatDate(dt) {
  try { return format(new Date(dt), 'dd MMM yyyy, h:mm a'); }
  catch { return dt; }
}
function formatDateShort(dt) {
  try { return format(new Date(dt), 'dd MMM yyyy'); }
  catch { return dt; }
}
function timeAgo(dt) {
  const diff = Date.now() - new Date(dt).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CATEGORY_HUE = {
  Hackathon: 'var(--hue-hackathon)',
  Cultural:  'var(--hue-cultural)',
  Music:     'var(--hue-music)',
  Sports:    'var(--hue-sports)',
  Talk:      'var(--hue-talk)',
  Workshop:  'var(--hue-workshop)',
  Party:     'var(--hue-party)',
  Comedy:    'var(--hue-comedy)',
  Theatre:   'var(--hue-theatre)',
};
export const hueFor = (category) => CATEGORY_HUE[category] || 'var(--hue-default)';

export function CategoryIcon({ category, size = 16, className = '' }) {
  switch (category) {
    case 'Hackathon': return <CodeIcon size={size} className={className} />;
    case 'Cultural':  return <TheaterIcon size={size} className={className} />;
    case 'Music':     return <MusicIcon size={size} className={className} />;
    case 'Sports':    return <TrophyIcon size={size} className={className} />;
    case 'Talk':      return <MicIcon size={size} className={className} />;
    default:          return <SparklesIcon size={size} className={className} />;
  }
}

// ── EventStateChip ───────────────────────────────────────────────
export function EventStateChip({ state }) {
  const label = EVENT_STATE_LABELS[state] || state;
  return (
    <Badge variant={`state-${state.replace('_', '-')}`} className="event-state-chip">
      {label}
    </Badge>
  );
}

// ── EventCard ────────────────────────────────────────────────────
export function EventCard({ event, variant = 'grid', showHypeButton = true, showWishlistButton = true }) {
  const [isHyped, setIsHyped] = useState(event.is_hyped);
  const [hypeCount, setHyped] = useState(event.hype_count);
  const [isWishlisted, setWishlisted] = useState(event.is_wishlisted);
  const [animating, setAnimating] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const cardVariant = variant === 'featured' ? 'teal' : 'default';
  const cardClass = `event-card spotlight ${variant === 'list' ? 'event-card--list' : ''}`;

  // Pointer position drives the spotlight border. Written as CSS custom
  // properties rather than React state so moving the mouse never
  // triggers a re-render.
  // Warm the detail chunk on first hover. Without this the shared
  // cover transition cannot run at all: the route is code-split, so
  // clicking unmounts the card and shows a Suspense fallback while the
  // destination downloads, and the two elements never coexist.
  const warm = () => { import('@/pages/discovery/EventDetailPage'); };

  const trackPointer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // The event prop is replaced whenever a list refetches, so local state
  // has to follow it -- otherwise a card keeps showing the optimistic
  // value from before the refresh and drifts from the server.
  useEffect(() => { setWishlisted(event.is_wishlisted); }, [event.is_wishlisted]);
  useEffect(() => { setIsHyped(event.is_hyped); setHyped(event.hype_count); }, [event.is_hyped, event.hype_count]);

  // Both of these used to update local state and nothing else, so the
  // heart filled in, a toast claimed success, and the server never heard
  // about it -- the wishlist page stayed empty and a refresh undid it.
  const hypeMutation = useMutation({
    mutationFn: () => eventsApi.toggleHype(event.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const prev = qc.getQueriesData({ queryKey: ['events'] });
      qc.setQueriesData({ queryKey: ['events'] }, (old) => {
        const rows = Array.isArray(old) ? old : old?.events;
        if (!Array.isArray(rows)) return old;
        const next = rows.map(e => e.id === event.id
          ? { ...e, is_hyped: !e.is_hyped, hype_count: (e.hype_count ?? 0) + (e.is_hyped ? -1 : 1) }
          : e);
        return Array.isArray(old) ? next : { ...old, events: next };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, v]) => qc.setQueryData(k, v));
      setIsHyped(event.is_hyped);
      setHyped(event.hype_count);
      toast.error('Could not update hype. Try again.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const wishlistMutation = useMutation({
    mutationFn: () => eventsApi.toggleWishlist(event.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['events'] });
      const prev = qc.getQueriesData({ queryKey: ['events'] });
      // Write through to every cached list holding this event, so the
      // optimistic state survives navigating away and back rather than
      // living only in this component.
      qc.setQueriesData({ queryKey: ['events'] }, (old) => {
        const rows = Array.isArray(old) ? old : old?.events;
        if (!Array.isArray(rows)) return old;
        const next = rows.map(e => e.id === event.id ? { ...e, is_wishlisted: !e.is_wishlisted } : e);
        return Array.isArray(old) ? next : { ...old, events: next };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([k, v]) => qc.setQueryData(k, v));
      setWishlisted(event.is_wishlisted);
      toast.error('Could not update your wishlist. Try again.');
    },
    onSuccess: (data) => {
      // The server is the authority on the resulting state; trust its
      // answer over the optimistic guess.
      if (typeof data?.wishlisted === 'boolean') setWishlisted(data.wishlisted);
      qc.invalidateQueries({ queryKey: ['user'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const handleHype = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }
    setAnimating(true);
    setIsHyped(h => !h);
    setHyped(c => (isHyped ? c - 1 : c + 1));
    setTimeout(() => setAnimating(false), 300);
    hypeMutation.mutate();
  };

  const handleWishlist = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }
    const next = !isWishlisted;
    setWishlisted(next);
    toast[next ? 'success' : 'info'](next ? 'Added to wishlist' : 'Removed from wishlist');
    wishlistMutation.mutate();
  };

  return (
    <Card
      variant={cardVariant}
      padding="sm"
      onClick={() => navigate(buildRoute.eventDetail(event.id))}
      ariaLabel={`View ${event.title}`}
      className={cardClass}
      style={{ '--cat': hueFor(event.category) }}
      onPointerMove={trackPointer}
      onPointerEnter={warm}
      onFocus={warm}
    >
      {/* Image */}
      <motion.div className="event-card__image-wrap" layoutId={`cover-${event.id}`}>
        <img
          src={event.cover_image || `https://picsum.photos/seed/${event.id}/800/600`}
          alt={event.title}
          className="event-card__image"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = `https://picsum.photos/seed/${event.id}-alt/800/600`;
          }}
        />
        <div className="event-card__chips">
          <EventStateChip state={event.state} />
          <span className="event-card__cat">
            <CategoryIcon category={event.category} size={12} /> {event.category}
          </span>
        </div>
      </motion.div>

      {/* Body */}
      <div className="event-card__body">
        <h3 className="event-card__title">{event.title}</h3>
        <div className="event-card__meta">
          <span className="event-card__meta-item"><CalendarIcon size={14} /> {formatDateShort(event.start_date)}</span>
          <span className="event-card__meta-item"><MapPinIcon size={14} /> {event.venue}</span>
          <span className="event-card__meta-item"><UsersIcon size={14} /> {event.organizer?.name ?? 'Organizer'}</span>
        </div>
        <p className="event-card__price">{formatPrice(event.tiers)}</p>

        <div className="event-card__footer" onClick={e => e.stopPropagation()}>
          <div className="event-card__actions">
            {showHypeButton && (
              <button
                className={`hype-btn ${isHyped ? 'hype-btn--hyped' : ''} ${animating ? 'hype-btn--animating' : ''} ${variant === 'featured' ? 'hype-btn--canvas' : ''}`}
                onClick={handleHype}
                aria-pressed={isHyped}
                aria-label={`${isHyped ? 'Remove hype' : 'Hype'} — ${hypeCount} hypes`}
              >
                <ZapIcon size={14} filled={isHyped} className="hype-btn__icon" />
                {hypeCount.toLocaleString()}
              </button>
            )}
          </div>
          {showWishlistButton && (
            <button
              className={`wishlist-btn ${isWishlisted ? 'wishlist-btn--active' : ''} ${variant === 'featured' ? 'wishlist-btn--canvas' : ''}`}
              onClick={handleWishlist}
              aria-pressed={isWishlisted}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <HeartIcon size={18} filled={isWishlisted} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── TicketTierCard ────────────────────────────────────────────────
export function TicketTierCard({ tier, isSelected, onSelect }) {
  const soldPct = tier.quantity > 0 ? (tier.sold_count / tier.quantity) * 100 : 0;
  const isSoldOut = tier.sold_count >= tier.quantity;
  const isLocked = tier.type === 'college_only';
  const filledClass = soldPct >= 90 ? 'tier-card__capacity-fill--danger' : soldPct >= 70 ? 'tier-card__capacity-fill--warning' : '';

  return (
    <Card
      variant={isSelected ? 'sage' : 'default'}
      isSelected={isSelected}
      onClick={isSoldOut ? undefined : () => onSelect(tier)}
      className={`tier-card ${isSoldOut ? 'tier-card--sold-out' : ''} ${isLocked ? 'tier-card--locked' : ''}`}
      ariaLabel={`${tier.name} — ₹${tier.price}`}
    >
      <div className="tier-card__header">
        <div>
          <p className="tier-card__name">{tier.name}</p>
          {tier.college_only && (
            <p className="type-label-mono" style={{ color: 'var(--color-info)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <GraduationCapIcon size={14} /> College Students Only
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="tier-card__price">{tier.price === 0 ? 'Free' : `₹${tier.price}`}</p>
          {isSoldOut
            ? <Badge variant="error" size="sm">Sold Out</Badge>
            : <p className="tier-card__sold">{tier.quantity - tier.sold_count} left</p>
          }
        </div>
      </div>

      {!isSoldOut && (
        <>
          <div className="tier-card__capacity-bar">
            <div className={`tier-card__capacity-fill ${filledClass}`} style={{ width: `${soldPct}%` }} />
          </div>
          {soldPct >= 70 && (
            <p className="tier-card__lock-msg" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ZapIcon size={12} filled />
              {soldPct >= 90 ? 'Almost sold out!' : 'Filling fast'}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ── TicketCard (wallet) ───────────────────────────────────────────
export function TicketCard({ ticket }) {
  const navigate = useNavigate();

  return (
    <Card padding="md" onClick={() => navigate(buildRoute.ticketDetail(ticket.id))} ariaLabel={`Ticket for ${ticket.event?.title ?? 'event'}`}>
      <div className="ticket-card">
        <div className="ticket-card__event-img" aria-hidden="true" style={{ overflow: 'hidden' }}>
          {ticket.event?.cover_image ? (
            <img src={ticket.event?.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <CategoryIcon category={ticket.event?.category} size={28} />
          )}
        </div>
        <div className="ticket-card__info">
          <h3 className="ticket-card__event-name">{ticket.event?.title ?? 'Event'}</h3>
          <div className="ticket-card__meta">
            <span>{ticket.tier?.name ?? 'Ticket'} · {(ticket.tier?.price ?? 0) === 0 ? 'Free' : `₹${ticket.tier.price}`}</span>
            <br />
            <span>{formatDate(ticket.event?.start_date)}</span>
            <br />
            <span>Code: {ticket.booking_code}</span>
          </div>
          <div className="ticket-card__actions">
            <Badge variant={ticket.status === 'valid' ? 'success' : ticket.status === 'used' ? 'default' : 'error'}>
              {ticket.status === 'valid' ? <CheckIcon size={12} /> : ticket.status === 'used' ? <CheckIcon size={12} /> : <XIcon size={12} />}
              {ticket.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── QRDisplay ─────────────────────────────────────────────────────
export function QRDisplay({ ticket }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  // This drew a deterministic pattern from the booking code before --
  // it looked like a QR code and no scanner on earth could read it. It
  // now encodes the real verify_code, which is what /tickets/scan
  // matches against.
  const payload = ticket.verify_code;
  const revealed = ticket.qr_revealed !== false && !!payload;

  useEffect(() => {
    if (!canvasRef.current || !revealed) return;
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (cancelled || !canvasRef.current) return;
        return QRCode.toCanvas(canvasRef.current, payload, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#16101F', light: '#ffffff' },
        });
      })
      .catch(() => { if (!cancelled) setError('Could not render the code'); });
    return () => { cancelled = true; };
  }, [payload, revealed]);

  if (!revealed) {
    return (
      <div className="qr-display">
        <div className="qr-display__frame qr-display__frame--locked">
          <div className="qr-locked">
            <motion.div
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <TicketIcon size={44} />
            </motion.div>
            <p className="type-label-mono" style={{ marginTop: 12 }}>Code not released</p>
            <p className="type-body-sm" style={{ marginTop: 6, opacity: 0.7, maxWidth: 190 }}>
              The organizer releases QR codes shortly before doors open.
            </p>
          </div>
        </div>
        <p className="qr-display__code">{ticket.booking_code}</p>
      </div>
    );
  }

  return (
    <div className="qr-display">
      <motion.div
        className="qr-display__frame"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          aria-label={`QR code for ${ticket.event?.title ?? 'this'} ticket`}
          style={{ display: 'block', userSelect: 'none', pointerEvents: 'none' }}
        />
        {error && <p className="type-body-sm" style={{ padding: 16 }}>{error}</p>}
        {ticket.status === 'used' && (
          <div className="qr-display__used-overlay">
            <CheckIcon size={48} />
            <p className="type-label-mono">Ticket Used</p>
          </div>
        )}
      </motion.div>
      <p className="qr-display__warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <AlertTriangleIcon size={14} /> Show this screen at the gate
      </p>
      <p className="qr-display__code">{ticket.booking_code}</p>
    </div>
  );
}

// ── LevelBadge ────────────────────────────────────────────────────
export function LevelBadge({ level, size = 'md', showLabel = true }) {
  const color = LEVEL_COLORS[level] || 'var(--color-ink)';
  const label = LEVEL_LABELS[level] || level;
  const dotSize = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;

  return (
    <span className="level-badge">
      <span className="level-badge__dot" style={{ backgroundColor: color, width: dotSize, height: dotSize }} aria-hidden="true" />
      {showLabel && (
        <span className="level-badge__label" style={{ color }}>{label}</span>
      )}
    </span>
  );
}

// ── PrimeBadge ────────────────────────────────────────────────────
export function PrimeBadge() {
  return (
    <Badge variant="prime" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <ZapIcon size={12} filled /> Prime
    </Badge>
  );
}

export function PrimePassBadge() {
  return (
    <Badge variant="accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <SparklesIcon size={12} /> Prime Pass
    </Badge>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────
export function ReviewCard({ review }) {
  // The API returned raw rows with only user_id for a while, and reading
  // review.user.name off that took down the whole event page. A review
  // whose author cannot be resolved is still worth showing -- the rating
  // and comment are the point -- so this degrades instead of throwing.
  const author = review.user ?? {};
  const authorName = author.name || 'Festify user';

  return (
    <Card padding="md" className="review-card">
      <div className="review-card__header">
        <Avatar name={authorName} src={author.avatar_url} size="sm" />
        <div className="review-card__user">
          <p className="review-card__user-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {authorName}
            {review.is_prime_review && (
              <span className="review-card__prime-tag" style={{ marginLeft: 4 }}>
                <ZapIcon size={10} filled /> Prime
              </span>
            )}
          </p>
          <p className="review-card__date">{formatDateShort(review.created_at)}</p>
        </div>
        <StarRating value={review.rating} size={16} />
      </div>
      {review.comment && <p className="review-card__text">{review.comment}</p>}
    </Card>
  );
}

// ── ReviewForm ────────────────────────────────────────────────────
export function ReviewForm({ eventId, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const toast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!rating) { toast.error('Please select a star rating'); return; }
    onSubmit?.({ rating, comment, event_id: eventId });
    toast.success('Review submitted!');
    setRating(0);
    setComment('');
  };

  return (
    <Card padding="md">
      <form onSubmit={handleSubmit}>
        <p className="type-label-mono" style={{ marginBottom: 12 }}>Write a Review</p>
        <div style={{ marginBottom: 16 }}>
          <StarRating value={rating} interactive onChange={setRating} size={28} />
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Share your experience (optional)"
          rows={4}
          className="textarea-field"
          style={{ marginBottom: 12 }}
        />
        <Button type="submit" variant="primary">Submit Review</Button>
      </form>
    </Card>
  );
}

// ── OrganizerCard ─────────────────────────────────────────────────
export function OrganizerCard({ org, onFollow }) {
  const [following, setFollowing] = useState(false);
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleFollow = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setFollowing(f => !f);
    toast[following ? 'info' : 'success'](following ? `Unfollowed ${org.name}` : `Following ${org.name}`);
  };

  const TIER_LABELS = { new: 'New', verified: 'Verified', trusted: 'Trusted' };

  return (
    <Card variant="sage" padding="md" className="org-card">
      <div className="org-card__header">
        <Avatar name={org.name} src={org.avatar} size="md" />
        <div className="org-card__info">
          <h3 className="org-card__name">{org.name}</h3>
          <p className="org-card__rank" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckIcon size={12} /> {TIER_LABELS[org.trust_tier] ?? 'New'} organizer
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleFollow}>
          {following ? 'Following' : 'Follow'}
        </Button>
      </div>
      {org.description && (
        <p className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.7)', lineHeight: 'var(--lh-body-xs)' }}>{org.description}</p>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
        <span className="type-label-mono" style={{ color: 'rgba(22, 16, 31,0.6)' }}>{org.successful_events_count} events</span>
        <span className="type-label-mono" style={{ color: 'rgba(22, 16, 31,0.6)' }}>{(org.followers || 0).toLocaleString()} followers</span>
      </div>
    </Card>
  );
}

// ── EarlyAccessBanner ─────────────────────────────────────────────
export function EarlyAccessBanner({ event }) {
  const isPrimeWindow = event.state === 'early_access';
  const isGeneralOpen = event.state === 'on_sale';
  if (!isPrimeWindow && !isGeneralOpen) return null;

  return (
    <div className="teal-band teal-band--compact">
      <div className="section-container">
        <div className="early-access-banner">
          <div className="early-access-banner__left">
            <p className="early-access-banner__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isPrimeWindow ? <><ZapIcon size={16} filled /> Prime Early Access Open</> : <><TicketIcon size={16} /> General Sale Open</>}
            </p>
            <p className="early-access-banner__desc">
              {isPrimeWindow
                ? 'Tickets available to Prime members first. General sale opens after Prime window.'
                : 'Tickets are open to everyone.'}
            </p>
          </div>
          <Badge variant="canvas">{event.state === 'early_access' ? 'Prime Window' : 'On Sale Now'}</Badge>
        </div>
      </div>
    </div>
  );
}

// ── NotificationItem ──────────────────────────────────────────────
export function NotificationItem({ notification, onClick }) {
  const renderIcon = (type) => {
    switch (type) {
      case 'purchase_confirmation': return <TicketIcon size={20} />;
      case 'early_access':          return <ZapIcon size={20} filled />;
      case 'wishlist_alert':        return <HeartIcon size={20} filled />;
      case 'org_push':              return <SparklesIcon size={20} />;
      case 'event_cancelled':       return <XIcon size={20} />;
      default:                      return <BellIcon size={20} />;
    }
  };

  return (
    <div
      className={`notif-item ${!notification.read_at ? 'notif-item--unread' : ''}`}
      onClick={() => onClick?.(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter') && onClick?.(notification)}
      aria-label={notification.title}
    >
      <span className="notif-item__icon" aria-hidden="true">
        {renderIcon(notification.type)}
      </span>
      <div className="notif-item__content">
        <p className="notif-item__title">{notification.title}</p>
        <p className="notif-item__message">{notification.message}</p>
      </div>
      <span className="notif-item__time">{timeAgo(notification.sent_at)}</span>
    </div>
  );
}
