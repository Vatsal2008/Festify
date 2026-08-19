// pages/attendee/OtherAttendeePages.jsx — Wishlist, PrimePass, Notifications
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

// ── PrimePassPage ─────────────────────────────────────────────────
export function PrimePassPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  if (!isAuthenticated) { navigate('/login'); return null; }

  const BENEFITS = [
    { text: 'Early access window — buy before general sale', icon: <ZapIcon size={16} filled /> },
    { text: 'Dedicated Prime ticket pool (more seats reserved)', icon: <TicketIcon size={16} /> },
    { text: 'Prime Pass pool for sold-out events', icon: <SparklesIcon size={16} /> },
    { text: 'Priority review visibility (1.5× weight)', icon: <BarChartIcon size={16} /> },
    { text: 'Prime badge on profile & reviews', icon: <StarIcon size={16} filled /> },
    { text: 'Fewer ads, cleaner experience', icon: <CheckIcon size={16} /> },
  ];

  const plans = [
    { period: 'Monthly', price: 'TBD', badge: 'Flexible' },
    { period: 'Annual',  price: 'TBD', badge: 'Best Value', popular: true },
  ];

  if (user.has_prime_pass) return (
    <PageShell>
      <TealBand>
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <h1 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-xl)' }}>
            You have <span style={{ color: 'var(--color-accent)' }}>Prime Pass</span> <CheckIcon size={28} style={{ color: 'var(--color-accent)', verticalAlign: 'middle' }} />
          </h1>
          <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.8)', marginBottom: 'var(--space-xl)' }}>
            Your Prime Pass is active and all benefits are enabled.
          </p>
          <PrimePassBadge />
        </div>
      </TealBand>
      <CanvasBand>
        <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Your Benefits</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {BENEFITS.map(b => (
            <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', padding: 'var(--space-lg)', border: 'var(--border-hairline)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--color-ink)' }}>{b.icon}</span>
              <span className="type-body-md">{b.text}</span>
            </div>
          ))}
        </div>
      </CanvasBand>
    </PageShell>
  );

  return (
    <PageShell>
      <TealBand>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <h1 className="type-display-lg" style={{ color: 'var(--color-canvas)', marginBottom: 'var(--space-xl)' }}>
            Festify <span style={{ color: 'var(--color-accent)' }}>Prime Pass</span>
          </h1>
          <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.8)' }}>
            Get early access, dedicated pools, and a Prime badge across all events.
          </p>
        </div>
      </TealBand>
      <CanvasBand>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', maxWidth: 640, margin: '0 auto var(--space-3xl)' }}>
          {plans.map(plan => (
            <div key={plan.period} style={{ border: plan.popular ? '2px solid var(--color-accent)' : 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', textAlign: 'center', position: 'relative' }}>
              {plan.popular && <Badge variant="accent" style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)' }}>{plan.badge}</Badge>}
              <p className="type-label-mono">{plan.period}</p>
              <p className="plan-card__price">{plan.price}</p>
              <p className="plan-card__period">Coming soon</p>
              <Button variant={plan.popular ? 'primary' : 'secondary'} fullWidth size="sm" onClick={() => toast.info('Pricing coming soon!')}>
                Get {plan.period}
              </Button>
            </div>
          ))}
        </div>
        <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>What you get</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', maxWidth: 480, margin: '0 auto' }}>
          {BENEFITS.map(b => (
            <div key={b.text} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', padding: 'var(--space-md) 0', borderBottom: 'var(--border-hairline)' }}>
              <span style={{ color: 'var(--color-success)' }}><CheckIcon size={16} /></span>
              <span className="type-body-md">{b.text}</span>
            </div>
          ))}
        </div>
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
