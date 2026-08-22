// App.jsx — Complete router tree for Festify
import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { Spinner } from '@/components/primitives/Primitives';
import ToastContainer from '@/components/primitives/ToastContainer';

// ── Discovery ──────────────────────────────────────────────────────
import HomePage        from '@/pages/discovery/HomePage';
import EventDetailPage from '@/pages/discovery/EventDetailPage';
import SearchPage      from '@/pages/discovery/SearchPage';

// ── Auth ───────────────────────────────────────────────────────────
import LoginPage, { OnboardingPage } from '@/pages/auth/LoginPage';

// ── Attendee ───────────────────────────────────────────────────────
import ProfilePage      from '@/pages/attendee/ProfilePage';
import TicketWalletPage, { TicketDetailPage } from '@/pages/attendee/TicketPages';
import { WishlistPage, FollowingPage, MyReviewsPage } from '@/pages/attendee/OtherAttendeePages';
import SuperAdminEventsPage from '@/pages/admin/SuperAdminEventsPage';
import EventMediaPage from '@/pages/organizer/EventMediaPage';
import EventManagePage from '@/pages/organizer/EventManagePage';
import NotificationsPage from '@/pages/attendee/NotificationsPage';
import JoinGroupPage from '@/pages/attendee/JoinGroupPage';
import PrimePassPage from '@/pages/attendee/PrimePassPage';

// ── Organizer ──────────────────────────────────────────────────────
import OrganizerApplicationPage from '@/pages/organizer/OrganizerApplicationPage';
import GateScannerPage from '@/pages/organizer/GateScannerPage';
import { OrgDashboardPage, EventBuilderPage, BulkRequestsPage, OrgMembersPage, OrgChatPage, OrgEventsPage, OrgAnalyticsPage } from '@/pages/organizer/OrgPages';

// ── Admin ──────────────────────────────────────────────────────────
import {
  CollegeAdminApplicationsPage,
  CollegeAdminEventsPage, CollegeAdminAnalyticsPage,
  SuperAdminDashboardPage, SuperAdminOrganizersPage,
  SuperAdminSupportPage, SuperAdminConfigPage, SuperAdminAuditLogPage,
  SuperAdminTrendingPage
} from '@/pages/admin/AdminPages';
import AdminManagementPage from '@/pages/admin/AdminManagementPage';
import SuperAdminGate from '@/pages/admin/SuperAdminGate';
import SuperLoginPage from '@/pages/admin/SuperLoginPage';
import ErrorBoundary from '@/components/ErrorBoundary';

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
        {/* Both were linked from the profile with no route behind
            them, so two of the six account tiles hit the 404 page. */}
        <Route path="/me/following"      element={<RequireAuth><FollowingPage /></RequireAuth>} />
        <Route path="/me/reviews"        element={<RequireAuth><MyReviewsPage /></RequireAuth>} />
        <Route path="/me/groups"         element={<RequireAuth><JoinGroupPage /></RequireAuth>} />
        <Route path="/me/wishlist"       element={<RequireAuth><WishlistPage /></RequireAuth>} />
        <Route path="/me/prime-pass"     element={<RequireAuth><PrimePassPage /></RequireAuth>} />
        <Route path="/me/notifications"  element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="/organizer-application" element={<RequireAuth><OrganizerApplicationPage /></RequireAuth>} />

        {/* ── Organizer ── */}
        <Route path="/org/:orgId/dashboard"                    element={<RequireAuth><OrgDashboardPage /></RequireAuth>} />
        <Route path="/org/:orgId/events"                       element={<RequireAuth><OrgEventsPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/new"                   element={<RequireAuth><EventBuilderPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/scan"         element={<RequireAuth><GateScannerPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/bulk-requests" element={<RequireAuth><BulkRequestsPage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/manage"        element={<RequireAuth><EventManagePage /></RequireAuth>} />
        <Route path="/org/:orgId/events/:eventId/media"         element={<RequireAuth><EventMediaPage /></RequireAuth>} />
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
      </ErrorBoundary>

      {/* Global toast container */}
      <ToastContainer />

      {/* Inline animation for scanner sweep */}
      <style>{`@keyframes scanner-sweep { 0%, 100% { top: 0; opacity: 0.8; } 50% { top: calc(100% - 2px); opacity: 1; } }`}</style>
    </>
  );
}
