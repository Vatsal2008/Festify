// components/layout/index.jsx — All layout components with Floating Capsule TopNav & Floating Bell Icon
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationsApi } from '@/lib/api/endpoints';
import { useUIStore } from '@/store/uiStore';
import {
  BellIcon, HomeIcon, SearchIcon, TicketIcon, UserIcon,
  BarChartIcon, CalendarIcon, UsersIcon, MessageSquareIcon,
  ZapIcon, SettingsIcon, PlusIcon, SparklesIcon, TicketIcon as SupportIcon
} from '@/components/icons/Icons';
import './layout.css';

/* ── SectionContainer ── */
export function SectionContainer({ children, className = '' }) {
  return <div className={`section-container ${className}`}>{children}</div>;
}

/* ── TealBand ── */
export function TealBand({ children, variant = '', className = '', style }) {
  return (
    <section className={`teal-band ${variant ? `teal-band--${variant}` : ''} ${className}`} style={style}>
      <SectionContainer>{children}</SectionContainer>
    </section>
  );
}

/* ── CanvasBand ── */
export function CanvasBand({ children, variant = '', className = '', style }) {
  return (
    <section className={`canvas-band ${variant ? `canvas-band--${variant}` : ''} ${className}`} style={style}>
      <SectionContainer>{children}</SectionContainer>
    </section>
  );
}

/* ── TopNav (Floating Capsule + Floating Notification Bell on Right) ── */
export function TopNav() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const orgId = user?.org_memberships?.[0]?.org_id;

  // A bell with no count is decoration. Polled rather than invalidated,
  // because notifications are created by server-side events the client
  // never observes.
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    retry: false,
  });
  const unread = unreadQuery.data?.unread_count ?? 0;

  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 60 && currentScrollY > lastScrollY) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { to: '/', label: 'Discover' },
    { to: '/search', label: 'Search' },
  ];

  return (
    <nav className={`top-nav ${hidden ? 'top-nav--hidden' : ''}`} aria-label="Main navigation">
      <div className="top-nav__inner">
        <Link to="/" className="top-nav__logo">Fest<span>ify</span></Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginLeft: 'auto' }}>
          <ul className="top-nav__links" role="list">
            {links.map(l => (
              <li key={l.to}>
                <Link to={l.to} className={`top-nav__link ${location.pathname === l.to ? 'top-nav__link--active' : ''}`}>
                  {l.label}
                </Link>
              </li>
            ))}

            {isAuthenticated && orgId && (
              <li>
                <Link to={`/org/${orgId}/dashboard`} className={`top-nav__link ${location.pathname.includes('/org/') ? 'top-nav__link--active' : ''}`}>
                  Dashboard
                </Link>
              </li>
            )}

            {isAuthenticated ? (
              // Sign Out lives on the profile page, not here. A
              // destructive action sitting one slip away from Profile in
              // a persistent bar is easy to hit by accident, and the nav
              // is for navigation.
              <li>
                <Link to="/me" className={`top-nav__link ${location.pathname === '/me' ? 'top-nav__link--active' : ''}`}>
                  Profile
                </Link>
              </li>
            ) : (
              <li>
                <Link to="/login" className="top-nav__link top-nav__link--active" style={{ borderRadius: '9999px', padding: '6px 18px' }}>
                  Sign In
                </Link>
              </li>
            )}
          </ul>

          {/* Floating Bell Icon on the Right */}
          {isAuthenticated && (
            <button
              className="top-nav__notif-btn"
              onClick={() => navigate('/me/notifications')}
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              title="Notifications"
            >
              <BellIcon size={18} />
              {unread > 0 && (
                <span className="top-nav__notif-badge" aria-hidden="true">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ── Bottom Tab Bar (mobile) ── */
export function BottomTabBar() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { id: 'discover', label: 'Discover', icon: <HomeIcon size={20} />, path: '/' },
    { id: 'search',   label: 'Search',   icon: <SearchIcon size={20} />, path: '/search' },
    { id: 'tickets',  label: 'Tickets',  icon: <TicketIcon size={20} />, path: isAuthenticated ? '/me/tickets' : '/login' },
    { id: 'profile',  label: 'Profile',  icon: <UserIcon size={20} />, path: isAuthenticated ? '/me' : '/login' },
  ];

  return (
    <nav className="bottom-tab-bar" aria-label="Mobile navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`bottom-tab-bar__item ${location.pathname === tab.path ? 'bottom-tab-bar__item--active' : ''}`}
          onClick={() => navigate(tab.path)}
          aria-label={tab.label}
          aria-current={location.pathname === tab.path ? 'page' : undefined}
        >
          <span className="bottom-tab-bar__icon" aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

/* ── DashboardSidebar ── */
export function DashboardSidebar({ orgId, type = 'organizer' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const orgLinks = [
    { path: `/org/${orgId}/dashboard`,  label: 'Overview',     icon: <BarChartIcon size={18} /> },
    { path: `/org/${orgId}/events`,     label: 'Events',       icon: <CalendarIcon size={18} /> },
    { path: `/org/${orgId}/members`,    label: 'Members',      icon: <UsersIcon size={18} /> },
    { path: `/org/${orgId}/chat`,       label: 'Group Chat',   icon: <MessageSquareIcon size={18} /> },
    { path: `/org/${orgId}/analytics`,  label: 'Analytics',    icon: <BarChartIcon size={18} /> },
  ];

  const collegeAdminLinks = [
    { path: '/admin/applications', label: 'Applications', icon: <UsersIcon size={18} /> },
    { path: '/admin/events',       label: 'Events',       icon: <CalendarIcon size={18} /> },
    { path: '/admin/create-event', label: 'Create Event', icon: <PlusIcon size={18} /> },
    { path: '/admin/analytics',    label: 'Analytics',    icon: <BarChartIcon size={18} /> },
  ];

  const superAdminLinks = [
    { path: '/super/dashboard',          label: 'Dashboard',   icon: <ZapIcon size={18} /> },
    { path: '/super/applications',       label: 'Applications', icon: <UsersIcon size={18} /> },
    { path: '/super/college-admins',     label: 'Admin Access', icon: <UsersIcon size={18} /> },
    { path: '/super/organizers',         label: 'Organizers',  icon: <UsersIcon size={18} /> },
    { path: '/super/events',             label: 'Events',      icon: <CalendarIcon size={18} /> },
    { path: '/super/support-tickets',    label: 'Support',     icon: <SupportIcon size={18} /> },
    { path: '/super/trending-curation',  label: 'Curation',    icon: <SparklesIcon size={18} /> },
    { path: '/super/config',             label: 'Config',      icon: <SettingsIcon size={18} /> },
    { path: '/super/audit-log',          label: 'Audit Log',   icon: <BarChartIcon size={18} /> },
  ];

  const links = type === 'organizer' ? orgLinks : type === 'college-admin' ? collegeAdminLinks : superAdminLinks;
  const title = type === 'organizer' ? 'Organizer' : type === 'college-admin' ? 'College Admin' : 'Super Admin';

  return (
    <aside className="dash-sidebar" aria-label={`${title} navigation`}>
      <div className="dash-sidebar__org">
        <p className="type-label-mono" style={{ color: 'rgba(251, 247, 240,0.5)', marginBottom: 4 }}>{title} Panel</p>
        <p className="dash-sidebar__org-name">Festify</p>
      </div>
      <nav className="dash-sidebar__nav">
        {links.map(link => (
          <button
            key={link.path}
            className={`dash-sidebar__nav-item ${location.pathname.startsWith(link.path) ? 'dash-sidebar__nav-item--active' : ''}`}
            onClick={() => navigate(link.path)}
            aria-current={location.pathname.startsWith(link.path) ? 'page' : undefined}
          >
            <span className="dash-sidebar__nav-icon" aria-hidden="true">{link.icon}</span>
            {link.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

/* ── PageShell ── */
export function PageShell({ children }) {
  return (
    <div className="page-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopNav />
      <main id="main-content" className="page-shell__main">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}

/* ── DashboardShell ── */
export function DashboardShell({ children, orgId, sidebarType = 'organizer' }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="dashboard-shell">
      <a href="#dash-content" className="skip-link">Skip to content</a>
      <TopNav />
      <div className={`dashboard-shell__sidebar ${sidebarOpen ? 'dashboard-shell__sidebar--open' : ''}`}>
        <DashboardSidebar orgId={orgId} type={sidebarType} />
      </div>
      <main id="dash-content" className="dashboard-shell__content">
        {children}
      </main>
    </div>
  );
}
