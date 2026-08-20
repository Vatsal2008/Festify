// pages/attendee/OtherAttendeePages.jsx — Wishlist and Notifications
// (Prime Pass moved to its own file once it gained a real purchase flow.)
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventCard, PrimePassBadge } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import { meApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/constants/queryKeys';
import { HeartIcon, BellIcon, CheckIcon, ZapIcon, TicketIcon, StarIcon, BarChartIcon, SparklesIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

// ── WishlistPage ──────────────────────────────────────────────────
export function WishlistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const wishlistQuery = useQuery({
    queryKey: queryKeys.user.wishlist(user?.id),
    queryFn: meApi.wishlist,
    enabled: !!user,
  });

  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>My Wishlist</h1>
      </TealBand>
      <CanvasBand>
        <QueryBoundary
          query={wishlistQuery}
          emptyTitle="Your wishlist is empty"
          emptySub="Hit the heart icon on any event to save it here."
          loadingLabel="Loading your wishlist"
        >
          {(events) => (
            <div className="wishlist-grid">
              {events.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </QueryBoundary>

        {!wishlistQuery.isPending && (wishlistQuery.data ?? []).length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
            <Button variant="primary" onClick={() => navigate('/')}>
              <HeartIcon size={16} /> Explore Events
            </Button>
          </div>
        )}
      </CanvasBand>
    </PageShell>
  );
}

// ── NotificationsPage ─────────────────────────────────────────────
export function NotificationsPage() {
  const navigate = useNavigate();

  // The notification subsystem (Firebase push, the delivery pipeline and
  // its storage) has not been built on the API yet, so there is nothing
  // real to list. Showing an honest empty state beats rendering
  // fabricated notifications that no action of the user's produced.
  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Notifications</h1>
      </TealBand>
      <CanvasBand variant="compact">
        <div className="empty-state">
          <BellIcon size={64} style={{ color: 'var(--color-ink)' }} />
          <h2 className="empty-state__title">Notifications aren&apos;t switched on yet</h2>
          <p className="empty-state__sub">
            Ticket confirmations, wishlist alerts and organizer updates will land here once notifications go live.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>Browse events</Button>
        </div>
      </CanvasBand>
    </PageShell>
  );
}
