// pages/attendee/ProfilePage.jsx — Compact 100vh fitted Profile view with matching hero background
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { LevelBadge, PrimeBadge, PrimePassBadge } from '@/components/domain';
import { Avatar, ProgressBar } from '@/components/primitives/Primitives';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  TicketIcon, HeartIcon, UsersIcon, StarIcon, SparklesIcon, BellIcon,
  GraduationCapIcon, CheckIcon, ZapIcon
} from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) { navigate('/login'); return null; }

  const quickLinks = [
    { icon: <TicketIcon size={22} />, label: 'My Tickets', path: '/me/tickets' },
    { icon: <HeartIcon size={22} />, label: 'Wishlist',   path: '/me/wishlist' },
    { icon: <UsersIcon size={22} />, label: 'Following',  path: '/me/following' },
    { icon: <StarIcon size={22} />, label: 'Reviews',    path: '/me/reviews' },
    { icon: <SparklesIcon size={22} />, label: 'Prime Pass', path: '/me/prime-pass' },
    { icon: <BellIcon size={22} />, label: 'Notifications', path: '/me/notifications' },
  ];

  const LEVEL_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'prime'];
  const levelIdx = LEVEL_ORDER.indexOf(user.customer_level);
  const nextLevel = LEVEL_ORDER[levelIdx + 1];
  const progressPct = ((levelIdx + 0.65) / (LEVEL_ORDER.length - 1)) * 100;

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
            <Avatar name={user.name} size="xl" level={user.customer_level} src={user.avatar_url} />
            <div className="profile-hero__info">
              <h1 className="profile-hero__name">{user.name}</h1>
              <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.75)', marginBottom: 'var(--space-sm)' }}>{user.email}</p>
              {user.college_name && (
                <p className="type-body-sm" style={{ color: 'rgba(251, 247, 240,0.65)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <GraduationCapIcon size={16} /> {user.college_name}
                </p>
              )}
              <div className="profile-hero__badges">
                <LevelBadge level={user.customer_level} />
                {user.is_prime && <PrimeBadge />}
                {user.has_prime_pass && <PrimePassBadge />}
                {user.college_verified && (
                  <Badge variant="canvas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckIcon size={12} /> Verified Student
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost-canvas" size="sm" onClick={() => navigate('/organizer-application')}>
              Apply as Organizer
            </Button>
          </div>

          {/* Level Progress */}
          <div style={{ marginTop: 'var(--space-xl)', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.7)' }}>
                Level: {user.customer_level.charAt(0).toUpperCase() + user.customer_level.slice(1)}
              </span>
              {nextLevel && (
                <span className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.5)' }}>
                  Next: {nextLevel.charAt(0).toUpperCase() + nextLevel.slice(1)}
                </span>
              )}
            </div>
            <ProgressBar value={progressPct} max={100} variant="prime" size="sm" ariaLabel="Level progress" />
          </div>
        </TealBand>

        {/* ── Stats ── */}
        <CanvasBand variant="compact">
          <div className="profile-stats">
            {[
              { value: user.lifetime_events_attended ?? 0, label: 'Events Attended' },
              { value: user.is_prime ? <ZapIcon size={20} filled /> : '—', label: 'Prime Status' },
              { value: user.has_prime_pass ? <SparklesIcon size={20} /> : '—', label: 'Prime Pass' },
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/organizer-application')}>Apply as Organizer</Button>
            <Button variant="danger" size="sm" onClick={() => { logout(); navigate('/'); }}>Sign Out</Button>
          </div>
        </CanvasBand>
      </div>
    </PageShell>
  );
}
