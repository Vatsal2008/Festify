// App.jsx — Complete router tree for Festify
import { useEffect, lazy, Suspense } from 'react';
import { LayoutGroup } from 'framer-motion';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Spinner } from '@/components/primitives/Primitives';
import ToastContainer from '@/components/primitives/ToastContainer';

// ── Discovery ──────────────────────────────────────────────────────
import HomePage        from '@/pages/discovery/HomePage';
import SearchPage      from '@/pages/discovery/SearchPage';

// Lazy, like every other route. This was briefly a static import to
// make the shared cover transition work -- the destination chunk has to
// already be loaded for the two elements to coexist -- but that pulls
// the whole detail page into the initial bundle and makes
// prefetchEventDetail below a no-op, which is the opposite of the point.
// The hover prefetch is what warms the chunk; a click without a prior
// hover simply falls back to a normal Suspense load.
const EventDetailPage = lazy(() => import('@/pages/discovery/EventDetailPage'));

// ── Auth ───────────────────────────────────────────────────────────
import LoginPage, { OnboardingPage } from '@/pages/auth/LoginPage';

// Everything past discovery is code-split. A visitor landing on the
// homepage was downloading the organizer dashboard, both admin panels
// and the QR scanner (which pulls in jsQR) before seeing a single
// event -- most of it for surfaces they will never open.
//
// ── Attendee ───────────────────────────────────────────────────────
const ProfilePage        = lazy(() => import('@/pages/attendee/ProfilePage'));
const TicketWalletPage   = lazy(() => import('@/pages/attendee/TicketPages'));
const TicketDetailPage   = lazy(() => import('@/pages/attendee/TicketPages').then(m => ({ default: m.TicketDetailPage })));
const WishlistPage       = lazy(() => import('@/pages/attendee/OtherAttendeePages').then(m => ({ default: m.WishlistPage })));
const NotificationsPage  = lazy(() => import('@/pages/attendee/NotificationsPage'));
const PrimePassPage      = lazy(() => import('@/pages/attendee/PrimePassPage'));

// ── Organizer ──────────────────────────────────────────────────────
const OrganizerApplicationPage = lazy(() => import('@/pages/organizer/OrganizerApplicationPage'));
const GateScannerPage    = lazy(() => import('@/pages/organizer/GateScannerPage'));
const EventMediaPage     = lazy(() => import('@/pages/organizer/EventMediaPage'));
const OrgDashboardPage   = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.OrgDashboardPage })));
const EventBuilderPage   = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.EventBuilderPage })));
const BulkRequestsPage   = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.BulkRequestsPage })));
const OrgMembersPage     = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.OrgMembersPage })));
const OrgChatPage        = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.OrgChatPage })));
const OrgEventsPage      = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.OrgEventsPage })));
const OrgAnalyticsPage   = lazy(() => import('@/pages/organizer/OrgPages').then(m => ({ default: m.OrgAnalyticsPage })));

// ── Admin ──────────────────────────────────────────────────────────
const CollegeAdminApplicationsPage = lazy(() => import('@/pages/admin/AdminPages').then(m => ({ default: m.CollegeAdminApplicationsPage })));
const CollegeAdminEventsPage       = lazy(() => import('@/pages/admin/CollegeAdminPages').then(m => ({ default: m.CollegeAdminEventsPage })));
const CollegeAdminAnalyticsPage    = lazy(() => import('@/pages/admin/CollegeAdminPages').then(m => ({ default: m.CollegeAdminAnalyticsPage })));
const SuperAdminDashboardPage      = lazy(() => import('@/pages/admin/AdminPages').then(m => ({ default: m.SuperAdminDashboardPage })));
const SuperAdminOrganizersPage     = lazy(() => import('@/pages/admin/AdminPages').then(m => ({ default: m.SuperAdminOrganizersPage })));
const SuperAdminSupportPage        = lazy(() => import('@/pages/admin/SuperAdminSupportPage'));
const SuperAdminEventsPage         = lazy(() => import('@/pages/admin/SuperAdminEventsPage'));
const SuperAdminConfigPage         = lazy(() => import('@/pages/admin/AdminPages').then(m => ({ default: m.SuperAdminConfigPage })));
const SuperAdminAuditLogPage       = lazy(() => import('@/pages/admin/AdminPages').then(m => ({ default: m.SuperAdminAuditLogPage })));
const SuperAdminTrendingPage       = lazy(() => import('@/pages/admin/AdminPages').then(m => ({ default: m.SuperAdminTrendingPage })));
const AdminManagementPage          = lazy(() => import('@/pages/admin/AdminManagementPage'));
const SuperAdminGate               = lazy(() => import('@/pages/admin/SuperAdminGate'));
const SuperLoginPage               = lazy(() => import('@/pages/admin/SuperLoginPage'));

import ErrorBoundary from '@/components/ErrorBoundary';

// Warms the detail-route chunk before it is needed. Exported so the
// card can call it on hover; the module cache makes repeat calls free.
export const prefetchEventDetail = () => import('@/pages/discovery/EventDetailPage');

// ── Scroll to Top on Navigation ───────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// ── Route guards ───────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) { sessionStorage.setItem('festify_return_url', window.location.pathname); return <Navigate to="/login" replace />; }
  return children;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-canvas)' }}>
      <Spinner size="lg" />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-ink)', color: 'var(--color-canvas)', gap: 'var(--space-xl)', textAlign: 'center', padding: 'var(--space-xl)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 120, lineHeight: 1, fontWeight: 800, color: 'var(--color-accent)' }}>404</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-md)', fontWeight: 700 }}>Page not found</h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)', color: 'rgba(251, 247, 240,0.7)' }}>The page you're looking for doesn't exist or has moved.</p>
      <a
        href="/"
        className="impact-flash-on-active"
        style={{ background: 'var(--color-accent)', color: 'var(--color-canvas)', border: '2px solid var(--color-canvas)', padding: '12px 32px', fontFamily: 'var(--font-ui)', fontWeight: 700, textDecoration: 'none', fontSize: 16 }}
      >
        Back to Home
      </a>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <ErrorBoundary>
      {/* Shared-element transitions between the grid and a detail page
          need both elements under one LayoutGroup; they are in
          different routes, so the group has to wrap the router. */}
      <LayoutGroup>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* ── Public ── */}
        <Route path="/"          element={<HomePage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/search"    element={<SearchPage />} />
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* ── Attendee (auth required) ── */}
        <Route path="/me"                element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/me/tickets"        element={<RequireAuth><TicketWalletPage /></RequireAuth>} />
        <Route path="/me/tickets/:id"    element={<RequireAuth><TicketDetailPage /></RequireAuth>} />
        <Route path="/me/wishlist"       element={<RequireAuth><WishlistPage /></RequireAuth>} />
        <Route path="/me/prime-pass"     element={<RequireAuth><PrimePassPage /></RequireAuth>} />
        <Route path="/me/notifications"  element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="/organizer-application" element={<RequireAuth><OrganizerApplicationPage /></RequireAuth>} />

        {/* ── Organizer ── */}
        <Route path="/org/:orgId/dashboard"                    element={<RequireAuth><OrgDashboardPage /></RequireAuth>} />
        <Route path="/org/:orgId/events"                       element={<RequireAuth><OrgEventsPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/new"                   element={<RequireAuth><EventBuilderPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/scan"         element={<RequireAuth><GateScannerPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/media"        element={<RequireAuth><EventMediaPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/bulk-requests" element={<RequireAuth><BulkRequestsPage /></RequireAuth>} />
        <Route path="/org/:orgId/members"                      element={<RequireAuth><OrgMembersPage /></RequireAuth>} />
        <Route path="/org/:orgId/chat"                         element={<RequireAuth><OrgChatPage /></RequireAuth>} />
        <Route path="/org/:orgId/analytics"                    element={<RequireAuth><OrgAnalyticsPage /></RequireAuth>} />

        {/* ── College Admin ── */}
        {/* College admin. Access is a role on the normal account, so
            these only need a signed-in session -- the API enforces the
            college_admins check per request. */}
        <Route path="/admin"              element={<RequireAuth><CollegeAdminApplicationsPage /></RequireAuth>} />
        <Route path="/admin/applications" element={<RequireAuth><CollegeAdminApplicationsPage /></RequireAuth>} />
        <Route path="/admin/events"       element={<RequireAuth><CollegeAdminEventsPage /></RequireAuth>} />
        <Route path="/admin/analytics"    element={<RequireAuth><CollegeAdminAnalyticsPage /></RequireAuth>} />

        {/* ── Super Admin ── */}
        {/* Every super admin route sits behind the emailed-code gate. */}
        <Route path="/super" element={<SuperLoginPage />} />
        <Route path="/super/dashboard"          element={<SuperAdminGate><SuperAdminDashboardPage /></SuperAdminGate>} />
        <Route path="/super/college-admins"     element={<SuperAdminGate><AdminManagementPage /></SuperAdminGate>} />
        <Route path="/super/admin-access"       element={<SuperAdminGate><AdminManagementPage /></SuperAdminGate>} />
        <Route path="/super/applications"       element={<SuperAdminGate><CollegeAdminApplicationsPage /></SuperAdminGate>} />
        <Route path="/super/organizers"         element={<SuperAdminGate><SuperAdminOrganizersPage /></SuperAdminGate>} />
        <Route path="/super/support-tickets"    element={<SuperAdminGate><SuperAdminSupportPage /></SuperAdminGate>} />
        <Route path="/super/events"             element={<SuperAdminGate><SuperAdminEventsPage /></SuperAdminGate>} />
        <Route path="/super/config"             element={<SuperAdminGate><SuperAdminConfigPage /></SuperAdminGate>} />
        <Route path="/super/audit-log"          element={<SuperAdminGate><SuperAdminAuditLogPage /></SuperAdminGate>} />
        <Route path="/super/trending-curation"  element={<SuperAdminGate><SuperAdminTrendingPage /></SuperAdminGate>} />

        {/* ── 404 ── */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </LayoutGroup>
      </ErrorBoundary>

      {/* Global toast container */}
      <ToastContainer />

      {/* Inline animation for scanner sweep */}
      <style>{`@keyframes scanner-sweep { 0%, 100% { top: 0; opacity: 0.8; } 50% { top: calc(100% - 2px); opacity: 1; } }`}</style>
    </>
  );
}
