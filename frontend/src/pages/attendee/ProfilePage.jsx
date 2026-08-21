// pages/attendee/ProfilePage.jsx — Compact 100vh fitted Profile view with matching hero background
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { LevelBadge, PrimePassBadge } from '@/components/domain';
import { Avatar, ProgressBar } from '@/components/primitives/Primitives';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  TicketIcon, HeartIcon, UsersIcon, StarIcon, SparklesIcon, BellIcon,
  GraduationCapIcon, CheckIcon
} from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) { navigate('/login'); return null; }

  // org_memberships comes from /auth/me and is the same source the
  // organizer dashboard routes on, so this cannot disagree with whether
  // the dashboard actually opens.
  const memberships = user.org_memberships ?? [];
  const isOrganizer = memberships.length > 0;
  const primaryOrgId = memberships[0]?.org_id;

  const quickLinks = [
    { icon: <TicketIcon size={22} />, label: 'My Tickets', path: '/me/tickets' },
    { icon: <HeartIcon size={22} />, label: 'Wishlist',   path: '/me/wishlist' },
    { icon: <UsersIcon size={22} />, label: 'Following',  path: '/me/following' },
    { icon: <StarIcon size={22} />, label: 'Reviews',    path: '/me/reviews' },
    { icon: <SparklesIcon size={22} />, label: 'Prime Pass', path: '/me/prime-pass' },
    { icon: <BellIcon size={22} />, label: 'Notifications', path: '/me/notifications' },
  ];

  // Level and Prime are two unrelated things and the server now returns
  // them separately: the level is earned from events attended, Prime is
  // an active paid pass. They used to share the customer_level column --
  // buying a pass overwrote the tier with "prime" -- which is why this
  // page rendered a level badge saying PRIME, a Prime badge, and a Prime
  // Pass badge all at once.
  //
  // The old progress was ((tierIndex + 0.65) / 4), a bar that moved when
  // the tier changed and never when the user actually attended anything;
  // it showed two thirds full to someone who had attended none.
  const level = user.level ?? { key: 'bronze', label: 'Bronze', events_attended: 0, percent: 0 };
  const isPrime = !!user.is_prime;
  const primeRenews = user.prime_pass_expires_at
    ? new Date(user.prime_pass_expires_at).toLocaleDateString('en-GB',
        { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <PageShell>
      <div style={{ minHeight: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column' }}>
        {/* ── Profile Hero (matching dark ink background) ── */}
        <TealBand
          style={{
            marginTop: 'calc(-1 * (var(--nav-height) + 32px))',
            paddingTop: 'calc(var(--nav-height) + 48px)',
            paddingBottom: 'var(--space-2xl)',
            backgroundColor: 'var(--color-ink)',
          }}
        >
          <div className="profile-hero">
            <Avatar name={user.name} size="xl" level={level.key} src={user.avatar_url} />
            <div className="profile-hero__info">
              <h1 className="profile-hero__name">{user.name}</h1>
              <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.75)', marginBottom: 'var(--space-sm)' }}>{user.email}</p>
              {user.college_name && (
                <p className="type-body-sm" style={{ color: 'rgba(251, 247, 240,0.65)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <GraduationCapIcon size={16} /> {user.college_name}
                </p>
              )}
              <div className="profile-hero__badges">
                <LevelBadge level={level.key} />
                {isPrime && <PrimePassBadge />}
                {user.college_verified && (
                  <Badge variant="canvas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckIcon size={12} /> Verified Student
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Level Progress */}
          <div style={{ marginTop: 'var(--space-xl)', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.7)' }}>
                Level: {level.label}
              </span>
              {!level.is_max && level.next_label && (
                <span className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.65)' }}>
                  {level.events_to_next} more for {level.next_label}
                </span>
              )}
            </div>
            <ProgressBar
              value={level.percent}
              max={100}
              variant="prime"
              size="sm"
              ariaLabel={`${level.label} level, ${level.events_attended} events attended`}
            />
            <p className="type-body-sm" style={{ color: 'rgba(251, 247, 240,0.65)', marginTop: 6 }}>
              {level.is_max
                ? `${level.events_attended} events attended — top tier reached.`
                : `${level.events_attended}/${level.next_at} events attended for ${level.next_label}.`}
              {isPrime
                ? `  ·  Prime active${primeRenews ? `, renews ${primeRenews}` : ''}.`
                : ''}
            </p>
          </div>
        </TealBand>

        {/* ── Stats ── */}
        <CanvasBand variant="compact">
          <div className="profile-stats">
            {[
              { value: level.events_attended, label: 'Events Attended' },
              { value: level.label, label: 'Level' },
              { value: isPrime ? <SparklesIcon size={20} /> : '—', label: 'Prime Member' },
            ].map(stat => (
              <div key={stat.label} className="profile-stat">
                <p className="profile-stat__value">{stat.value}</p>
                <p className="profile-stat__label">{stat.label}</p>
              </div>
            ))}
          </div>
        </CanvasBand>

        {/* ── Quick Links (Fitted for single screen view) ── */}
        <CanvasBand style={{ flex: 1, padding: 'var(--space-xl) 0' }}>
          <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>My Account</h2>
          <div className="profile-quick-links">
            {quickLinks.map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 'var(--space-lg)',
                  border: 'var(--border-hairline)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-sage)'; e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--color-hairline)'; }}
                aria-label={link.label}
              >
                <span aria-hidden="true" style={{ color: 'var(--color-ink)' }}>{link.icon}</span>
                <span className="type-label-mono" style={{ fontSize: 11 }}>{link.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-lg)', borderTop: 'var(--border-hairline)', display: 'flex', gap: 'var(--space-lg)', justifyContent: 'flex-end' }}>
            {/* Someone who already runs an organization has nothing to
                apply for. Offering it again reads as the approval not
                having worked, and sends them to a page that can only
                tell them they are already an organizer. */}
            {isOrganizer ? (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${primaryOrgId}/dashboard`)}>
                Organizer Dashboard
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate('/organizer-application')}>
                Apply as Organizer
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => { logout(); navigate('/'); }}>Sign Out</Button>
          </div>
        </CanvasBand>
      </div>
    </PageShell>
  );
}
