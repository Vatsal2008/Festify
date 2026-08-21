// constants/routes.js — Centralized route constants
// Never hardcode route strings in components — always import from here

export const ROUTES = {
  // Public
  HOME:              '/',
  EVENT_DETAIL:      '/events/:id',
  SEARCH:            '/search',
  LOGIN:             '/login',
  ORGANIZER_PROFILE: '/organizers/:orgId',

  // Onboarding
  ONBOARDING:        '/onboarding',
  COLLEGE_VERIFY:    '/onboarding/college-verify',

  // Attendee
  PROFILE:           '/me',
  TICKETS:           '/me/tickets',
  TICKET_DETAIL:     '/me/tickets/:id',
  TICKET_RESELL:     '/me/tickets/:id/resell',
  TICKET_GIFT:       '/me/tickets/:id/gift',
  WISHLIST:          '/me/wishlist',
  FOLLOWING:         '/me/following',
  REVIEWS:           '/me/reviews',
  PRIME_PASS:        '/me/prime-pass',
  NOTIFICATIONS:     '/me/notifications',
  ORG_APPLICATION:   '/organizer-application',

  // Organizer
  ORG_DASHBOARD:     '/org/:orgId/dashboard',
  ORG_EVENTS:        '/org/:orgId/events',
  ORG_EVENT_NEW:     '/org/:orgId/events/new',
  ORG_EVENT_EDIT:    '/org/:orgId/events/:eventId/edit',
  ORG_EVENT_SCAN:    '/org/:orgId/events/:eventId/scan',
  ORG_BULK_REQUESTS: '/org/:orgId/events/:eventId/bulk-requests',
  ORG_FEEDBACK:      '/org/:orgId/events/:eventId/feedback',
  ORG_MEMBERS:       '/org/:orgId/members',
  ORG_CHAT:          '/org/:orgId/chat',
  ORG_ANALYTICS:     '/org/:orgId/analytics/export',

  // College Admin
  COLLEGE_ADMIN_LOGIN:        '/admin/login',
  COLLEGE_ADMIN_APPLICATIONS: '/admin/applications',
  COLLEGE_ADMIN_EVENTS:       '/admin/events',
  COLLEGE_ADMIN_CREATE_EVENT: '/admin/create-event',
  COLLEGE_ADMIN_ANALYTICS:    '/admin/analytics',

  // Super Admin (isolated bundle)
  SUPER_ADMIN:               '/super',
  SUPER_ADMIN_DASHBOARD:     '/super/dashboard',
  SUPER_ADMIN_ORGANIZERS:    '/super/organizers',
  SUPER_ADMIN_COLLEGE_ADMINS:'/super/college-admins',
  SUPER_ADMIN_CONFIG:        '/super/config',
  SUPER_ADMIN_SUPPORT:       '/super/support-tickets',
  SUPER_ADMIN_TRENDING:      '/super/trending-curation',
  SUPER_ADMIN_AUDIT:         '/super/audit-log',

  // Utilities
  NOT_FOUND: '/404',
};

// Route helpers — build parameterized paths
export const buildRoute = {
  eventDetail:     (id)              => `/events/${id}`,
  orgProfile:      (orgId)           => `/organizers/${orgId}`,
  ticketDetail:    (id)              => `/me/tickets/${id}`,
  ticketResell:    (id)              => `/me/tickets/${id}/resell`,
  ticketGift:      (id)              => `/me/tickets/${id}/gift`,
  orgDashboard:    (orgId)           => `/org/${orgId}/dashboard`,
  orgEvents:       (orgId)           => `/org/${orgId}/events`,
  orgEventNew:     (orgId)           => `/org/${orgId}/events/new`,
  orgEventEdit:    (orgId, eventId)  => `/org/${orgId}/events/${eventId}/edit`,
  orgEventScan:    (orgId, eventId)  => `/org/${orgId}/events/${eventId}/scan`,
  orgBulkRequests: (orgId, eventId)  => `/org/${orgId}/events/${eventId}/bulk-requests`,
  orgFeedback:     (orgId, eventId)  => `/org/${orgId}/events/${eventId}/feedback`,
  orgMembers:      (orgId)           => `/org/${orgId}/members`,
  orgChat:         (orgId)           => `/org/${orgId}/chat`,
};
