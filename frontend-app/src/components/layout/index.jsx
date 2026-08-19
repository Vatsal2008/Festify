// components/layout/index.jsx — All layout components with Floating Capsule TopNav & Floating Bell Icon
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUIStore } from '@/store/uiStore';
import { mockNotifications } from '@/data/mockData';
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
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = mockNotifications.filter(n => !n.read_at).length;
  const orgId = user?.org_memberships?.[0]?.org_id;

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
    <header className={`top-nav-wrapper ${hidden ? 'top-nav-wrapper--hidden' : ''}`}>
      <nav className="top-nav" aria-label="Main navigation">
        <div className="top-nav__inner">
          <Link to="/" className="top-nav__logo">Fest<span>ify</span></Link>

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
              <li>
                <Link
                  to="/me"
                  className={`top-nav__link ${location.pathname === '/me' ? 'top-nav__link--active' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px' }}
                  aria-label="Profile"
                  title="Profile"
                >
                  <UserIcon size={24} />
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
        </div>
      </nav>

      {/* Standalone Notification Bell Icon outside the capsule navbar */}
      {isAuthenticated && (
        <button
          className="top-nav__notif-btn-outside"
          onClick={() => navigate('/me/notifications')}
          aria-label={`Notifications, ${unread} unread`}
          title="Notifications"
        >
          <BellIcon size={18} />
          {unread > 0 && <span className="top-nav__notif-badge" aria-hidden="true">{unread}</span>}
        </button>
      )}
    </header>
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
    { path: `/org/${orgId}/dashboard`,  label: 'Overview',     icon: <BarChartIcon size={24} /> },
    { path: `/org/${orgId}/events`,     label: 'Events',       icon: <CalendarIcon size={24} /> },
    { path: `/org/${orgId}/members`,    label: 'Members',      icon: <UsersIcon size={24} /> },
    { path: `/org/${orgId}/chat`,       label: 'Group Chat',   icon: <MessageSquareIcon size={24} /> },
    { path: `/org/${orgId}/analytics`,  label: 'Analytics',    icon: <BarChartIcon size={24} /> },
  ];

  const collegeAdminLinks = [
    { path: '/college-admin/applications', label: 'Applications', icon: <UsersIcon size={24} /> },
    { path: '/college-admin/events',       label: 'Events',       icon: <CalendarIcon size={24} /> },
    { path: '/college-admin/create-event', label: 'Create Event', icon: <PlusIcon size={24} /> },
    { path: '/college-admin/analytics',    label: 'Analytics',    icon: <BarChartIcon size={24} /> },
  ];

  const superAdminLinks = [
    { path: '/superadmin/dashboard',          label: 'Dashboard',   icon: <ZapIcon size={24} /> },
    { path: '/superadmin/college-admins',     label: 'College Admins', icon: <UsersIcon size={24} /> },
    { path: '/superadmin/organizers',         label: 'Organizers',  icon: <UsersIcon size={24} /> },
    { path: '/superadmin/support-tickets',    label: 'Support',     icon: <SupportIcon size={24} /> },
    { path: '/superadmin/trending-curation',  label: 'Curation',    icon: <SparklesIcon size={24} /> },
    { path: '/superadmin/config',             label: 'Config',      icon: <SettingsIcon size={24} /> },
    { path: '/superadmin/audit-log',          label: 'Audit Log',   icon: <BarChartIcon size={24} /> },
  ];

  const links = type === 'organizer' ? orgLinks : type === 'college-admin' ? collegeAdminLinks : superAdminLinks;
  const title = type === 'organizer' ? 'Organizer' : type === 'college-admin' ? 'College Admin' : 'Super Admin';

  return (
    <aside className="dash-sidebar" aria-label={`${title} navigation`}>
      <div className="dash-sidebar__org">
        <p className="type-label-mono" style={{ color: 'rgba(252,252,248,0.5)', marginBottom: 4 }}>{title} Panel</p>
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
