// pages/discovery/EventDetailPage.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventStateChip, TicketTierCard, OrganizerCard, ReviewCard, ReviewForm, EarlyAccessBanner, hueFor } from '@/components/domain';
import MediaGallery from '@/components/domain/MediaGallery';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import Modal from '@/components/primitives/Modal';
import { StarRating, Spinner } from '@/components/primitives/Primitives';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import { eventsApi, ordersApi, waitlistApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { openCheckout } from '@/lib/payments/razorpay';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import {
  CalendarIcon, MapPinIcon, UsersIcon, TicketIcon, ZapIcon, HeartIcon,
  StarIcon, CheckIcon, ArrowLeftIcon
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [selectedTier, setSelectedTier] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  const eventQuery = useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => eventsApi.get(id),
    // Seed from whatever the visitor was just looking at. Arriving from
    // the grid, this event is already in a cached list response --
    // title, cover, venue, price -- so gating the whole page behind a
    // fresh fetch shows a spinner for data we already hold.
    //
    // This is also what makes the shared cover transition possible at
    // all: the hero has to exist in the same frame the card unmounts,
    // and it cannot if it is waiting on the network.
    placeholderData: () => {
      const lists = qc.getQueriesData({ queryKey: ['events'] });
      for (const [, data] of lists) {
        const rows = Array.isArray(data) ? data : data?.events;
        const hit = Array.isArray(rows) ? rows.find((e) => e?.id === id) : null;
        if (hit) return hit;
      }
      return undefined;
    },
  });
  const event = eventQuery.data;

  // Uploaded media for this event. Kept separate from the event query
  // so a gallery upload does not invalidate the whole event payload.
  const mediaQuery = useQuery({
    queryKey: ['events', id, 'media'],
    queryFn: () => eventsApi.media(id),
    enabled: !!id,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.events.reviews(id),
    queryFn: () => eventsApi.reviews(id),
    enabled: !!event,
  });

  const invalidateEvent = () => {
    qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) });
    qc.invalidateQueries({ queryKey: ['events'] });
  };

  const hypeMutation = useMutation({
    mutationFn: () => eventsApi.toggleHype(id),
    onSuccess: invalidateEvent,
    onError: (e) => toast.error(apiError(e)),
  });

  const wishlistMutation = useMutation({
    mutationFn: () => eventsApi.toggleWishlist(id),
    onSuccess: (data) => {
      invalidateEvent();
      toast[data.wishlisted ? 'success' : 'info'](
        data.wishlisted ? 'Added to wishlist' : 'Removed from wishlist'
      );
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const reviewMutation = useMutation({
    mutationFn: (body) => eventsApi.createReview(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events.reviews(id) });
      invalidateEvent();
      toast.success('Review posted.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const waitlistMutation = useMutation({
    mutationFn: (tierId) => waitlistApi.join(tierId, quantity),
    onSuccess: () => toast.success("You're on the waitlist. We'll notify you if a ticket frees up."),
    onError: (e) => toast.error(apiError(e)),
  });

  const requireAuth = () => {
    if (!isAuthenticated) {
      sessionStorage.setItem('festify_return_url', window.location.pathname);
      navigate('/login');
      return false;
    }
    return true;
  };

  /** Create the order, open Razorpay, then confirm it. */
  const handleConfirmPurchase = async () => {
    if (!selectedTier) return;
    setIsPaying(true);
    let createdOrderId = null;
    try {
      const created = await ordersApi.create({
        ticket_tier_id: selectedTier.id,
        quantity,
      });
      createdOrderId = created.order.id;
      // Survives a redirect: netbanking sends the browser to the bank and
      // back, losing all in-page state, so the order id has to outlive it.
      sessionStorage.setItem('festify_pending_order', createdOrderId);

      if (created.amount === 0) {
        toast.info('Free event — confirming your ticket.');
      }

      const signed = await openCheckout({
        order: created,
        user,
        eventTitle: event.title,
      });

      const confirmed = await ordersApi.verifyPayment(createdOrderId, signed);
      sessionStorage.removeItem('festify_pending_order');
      setShowPurchaseModal(false);
      setSuccessOrder(confirmed);
      invalidateEvent();
    } catch (err) {
      // The in-page callback may never fire even though the payment went
      // through, so ask the server to check with Razorpay before treating
      // this as a failure.
      if (createdOrderId) {
        try {
          const synced = await ordersApi.sync(createdOrderId);
          sessionStorage.removeItem('festify_pending_order');
          setShowPurchaseModal(false);
          setSuccessOrder(synced);
          invalidateEvent();
          return;
        } catch {
          // Genuinely not paid — fall through to the original error.
        }
      }
      toast.error(apiError(err, err.message));
    } finally {
      setIsPaying(false);
    }
  };

  const formatDt = (dt) => { try { return format(new Date(dt), 'EEEE, d MMMM yyyy'); } catch { return dt; } };
  const formatTm = (dt) => { try { return format(new Date(dt), 'h:mm a'); } catch { return dt; } };

  const totalPrice = selectedTier ? selectedTier.price * quantity : 0;
  const maxTickets = (event?.capacity ?? 0) > 200 ? 10 : 5;
  const reviews = reviewsQuery.data ?? [];
  const isSoldOut = event?.state === 'sold_out';

  return (
    <PageShell>
      <QueryBoundary
        query={eventQuery}
        isEmpty={() => false}
        loadingLabel="Loading event"
        minHeight={520}
      >
        {(ev) => (
          <>
            <TealBand
              variant="hero"
              className="event-hero"
              style={{
                '--cat': hueFor(ev.category),
                backgroundColor: 'var(--color-ink-deep)',
                // Three stops rather than two: a lighter top lets the
                // image read, a hue-tinted middle ties the page to the
                // category, and a near-opaque base carries white text.

                marginTop: 'calc(-1 * (var(--nav-height) + 32px))',
                paddingTop: 'calc(var(--nav-height) + 72px)',
              }}
            >
              {/* Destination of the grid card's cover. Same layoutId,
                  so Framer treats the two as one object and tweens the
                  card's thumbnail into this full-bleed hero rather than
                  cutting between two unrelated screens. */}
              <motion.div
                className="event-hero__cover"
                layoutId={`cover-${ev.id}`}
                transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${
                    mediaQuery.data?.detail_bg?.url
                    || mediaQuery.data?.cover?.url
                    || ev.cover_image
                    || `https://picsum.photos/seed/${ev.id}/1600/900`
                  })`,
                }}
              />
              {mediaQuery.data?.hero_video?.url && (
                <video
                  className="event-hero__video"
                  src={mediaQuery.data.hero_video.url}
                  autoPlay loop muted playsInline
                  aria-hidden="true"
                />
              )}
              <div className="event-hero__scrim" aria-hidden="true" />

              <div className="event-detail-hero">
                {/* Every page needs a way back; this one was a dead end. */}
                <button className="event-hero__back" onClick={() => navigate(-1)}>
                  <ArrowLeftIcon size={14} /> Back
                </button>
                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', marginBottom: 'var(--space-lg)' }}>
                  <EventStateChip state={ev.state} />
                  <span className="event-hero__cat">{ev.category}</span>
                  {ev.organizer?.trust_tier === 'trusted' && (
                    <Badge variant="accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <StarIcon size={12} filled /> Trusted Organizer
                    </Badge>
                  )}
                </div>

                <h1 className="event-detail-hero__title">{ev.title}</h1>

                <div className="event-detail-hero__meta">
                  <span className="event-detail-hero__meta-item">
                    <CalendarIcon size={16} /> {formatDt(ev.start_date)} · {formatTm(ev.start_date)}
                  </span>
                  <span className="event-detail-hero__meta-item">
                    <MapPinIcon size={16} /> {ev.venue}
                  </span>
                  {ev.organizer && (
                    <span className="event-detail-hero__meta-item">
                      <UsersIcon size={16} /> {ev.organizer?.name ?? 'Organizer'}
                    </span>
                  )}
                  {ev.capacity != null && (
                    <span className="event-detail-hero__meta-item">
                      <TicketIcon size={16} /> Capacity {(ev.capacity ?? 0).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="event-detail-hero__actions">
                  <button
                    onClick={() => requireAuth() && hypeMutation.mutate()}
                    disabled={hypeMutation.isPending}
                    className={`hype-btn hype-btn--canvas ${ev.is_hyped ? 'hype-btn--hyped' : ''}`}
                    aria-pressed={ev.is_hyped}
                  >
                    <ZapIcon size={16} filled={ev.is_hyped} className="hype-btn__icon" />
                    Hype · {(ev.hype_count ?? 0).toLocaleString()}
                  </button>
                  <button
                    onClick={() => requireAuth() && wishlistMutation.mutate()}
                    disabled={wishlistMutation.isPending}
                    className={`wishlist-btn wishlist-btn--canvas ${ev.is_wishlisted ? 'wishlist-btn--active' : ''}`}
                    aria-pressed={ev.is_wishlisted}
                    aria-label={ev.is_wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <HeartIcon size={20} filled={ev.is_wishlisted} />
                  </button>
                </div>
              </div>
            </TealBand>

            <EarlyAccessBanner event={ev} />

            <CanvasBand>
              <div className="event-detail-layout">
                <div>
                  <section aria-labelledby="about-heading">
                    <h2 id="about-heading" className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>About this event</h2>
                    <div className="type-body-md" style={{ whiteSpace: 'pre-line', lineHeight: 'var(--lh-body-md)' }}>
                      {ev.description || 'No description provided.'}
                    </div>
                  </section>

                  <MediaGallery media={mediaQuery.data?.gallery ?? []} title="Event gallery" />

                  <section aria-labelledby="reviews-heading" style={{ marginTop: 'var(--space-3xl)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                      <h2 id="reviews-heading" className="type-label-mono">Reviews</h2>
                      {ev.avg_rating && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                          <StarRating value={ev.avg_rating} size={18} />
                          <span className="type-body-md">{ev.avg_rating} ({ev.review_count})</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                      {reviews.length === 0 && (
                        <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.6)' }}>
                          No reviews yet. Only people who bought a ticket can review this event.
                        </p>
                      )}
                      {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
                    </div>
                    {isAuthenticated && (
                      <ReviewForm eventId={ev.id} onSubmit={(body) => reviewMutation.mutate(body)} />
                    )}
                  </section>
                </div>

                <aside aria-labelledby="tickets-heading">
                  <h2 id="tickets-heading" className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>
                    {isSoldOut ? 'Sold Out' : 'Select Tickets'}
                  </h2>
                  <div className="tiers-panel">
                    {ev.tiers.length === 0 && (
                      <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.6)' }}>
                        Tickets for this event aren&apos;t on sale yet.
                      </p>
                    )}
                    {ev.tiers.map(tier => (
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
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, border: 'var(--border-hairline)', background: 'none', cursor: 'pointer', fontSize: 18 }} aria-label="Decrease quantity">−</button>
                            <span className="type-body-md">{quantity}</span>
                            <button onClick={() => setQuantity(q => Math.min(maxTickets, q + 1))} style={{ width: 28, height: 28, border: 'var(--border-hairline)', background: 'none', cursor: 'pointer', fontSize: 18 }} aria-label="Increase quantity">+</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                          <span className="type-body-md" style={{ fontWeight: 600 }}>Total</span>
                          <span className="type-heading-lg">{totalPrice === 0 ? 'Free' : `₹${totalPrice}`}</span>
                        </div>
                      </div>
                    )}

                    {isSoldOut ? (
                      <Button
                        variant="secondary"
                        fullWidth
                        isLoading={waitlistMutation.isPending}
                        onClick={() => {
                          if (!requireAuth()) return;
                          const tier = selectedTier || ev.tiers[0];
                          if (tier) waitlistMutation.mutate(tier.id);
                        }}
                      >
                        Join Waitlist
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        fullWidth
                        isDisabled={!ev.tiers.length}
                        onClick={() => {
                          if (!requireAuth()) return;
                          if (!selectedTier) { toast.warning('Pick a ticket tier first.'); return; }
                          setShowPurchaseModal(true);
                        }}
                      >
                        {isAuthenticated ? 'Buy Tickets' : 'Sign in to Buy'}
                      </Button>
                    )}
                  </div>

                  {ev.organizer && (
                    <div style={{ marginTop: 'var(--space-2xl)' }}>
                      <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>Organizer</h2>
                      <OrganizerCard org={ev.organizer} />
                    </div>
                  )}
                </aside>
              </div>
            </CanvasBand>

            {/* ── Purchase confirmation ── */}
            <Modal
              isOpen={showPurchaseModal}
              onClose={() => !isPaying && setShowPurchaseModal(false)}
              title="Confirm Purchase"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setShowPurchaseModal(false)} isDisabled={isPaying}>Cancel</Button>
                  <Button variant="primary" onClick={handleConfirmPurchase} isLoading={isPaying}>
                    {totalPrice === 0 ? 'Get ticket' : `Pay ₹${totalPrice}`}
                  </Button>
                </>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Event</p><p className="type-body-md">{ev.title}</p></div>
                <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Tier</p><p className="type-body-md">{selectedTier?.name}</p></div>
                <div><p className="type-label-mono" style={{ marginBottom: 4 }}>Quantity</p><p className="type-body-md">{quantity}</p></div>
                <div style={{ borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-lg)' }}>
                  <p className="type-label-mono" style={{ marginBottom: 4 }}>Total</p>
                  <p className="type-display-md">{totalPrice === 0 ? 'Free' : `₹${totalPrice}`}</p>
                </div>
                <p className="type-body-xs" style={{ color: 'rgba(22,16,31,0.6)' }}>
                  Payment is by UPI. You&apos;ll be redirected to a secure Razorpay window.
                </p>
                {isPaying && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <Spinner size="sm" /> <span className="type-body-sm">Opening payment…</span>
                  </div>
                )}
              </div>
            </Modal>

            {/* ── Success ── */}
            <Modal
              isOpen={!!successOrder}
              onClose={() => setSuccessOrder(null)}
              title="Booking Confirmed!"
              footer={
                <Button variant="primary" onClick={() => { setSuccessOrder(null); navigate('/me/tickets'); }}>
                  View My Tickets
                </Button>
              }
            >
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xl)' }}>
                <CheckIcon size={48} style={{ color: 'var(--color-success)' }} />
                <p className="type-body-md">
                  Your {successOrder?.tickets?.length === 1 ? 'ticket' : 'tickets'} for <strong>{ev.title}</strong> {successOrder?.tickets?.length === 1 ? 'is' : 'are'} confirmed. The QR code is ready in your ticket wallet.
                </p>
                {successOrder?.tickets?.[0]?.verify_code && (
                  <Badge variant="success">
                    Code: {successOrder.tickets[0].verify_code.slice(0, 8).toUpperCase()}
                  </Badge>
                )}
              </div>
            </Modal>
          </>
        )}
      </QueryBoundary>
    </PageShell>
  );
}
