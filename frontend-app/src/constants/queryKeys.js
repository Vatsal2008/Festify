// constants/queryKeys.js — React Query key factory
// Always use these — never hardcode strings in useQuery calls

export const queryKeys = {
  events: {
    all:      ()        => ['events'],
    list:     (filters) => ['events', 'list', filters],
    detail:   (id)      => ['events', id],
    reviews:  (id)      => ['events', id, 'reviews'],
    hypes:    (id)      => ['events', id, 'hypes'],
    tiers:    (id)      => ['events', id, 'tiers'],
    analytics:(id)      => ['events', id, 'analytics'],
  },
  tickets: {
    wallet:  (userId)   => ['tickets', 'wallet', userId],
    detail:  (id)       => ['tickets', id],
    resale:  (filters)  => ['tickets', 'resale', filters],
    bulkReqs:(orgId, eventId) => ['tickets', 'bulk-requests', orgId, eventId],
  },
  user: {
    profile:    (userId) => ['user', userId],
    level:      (userId) => ['user', userId, 'level'],
    primeStatus:(userId) => ['user', userId, 'prime-status'],
    wishlist:   (userId) => ['user', userId, 'wishlist'],
    following:  (userId) => ['user', userId, 'following'],
    followers:  (userId) => ['user', userId, 'followers'],
    reviews:    (userId) => ['user', userId, 'reviews'],
    primePass:  (userId) => ['user', userId, 'prime-pass'],
  },
  notifications:    (userId) => ['notifications', userId],
  notifPreferences: (userId) => ['notifications', 'preferences', userId],
  search: {
    events:     (query, filters) => ['search', 'events', query, filters],
    organizers: (query)          => ['search', 'organizers', query],
  },
  trending: () => ['trending'],
  featured:  () => ['featured'],
  org: {
    profile:    (orgId)          => ['org', orgId],
    events:     (orgId, filters) => ['org', orgId, 'events', filters],
    members:    (orgId)          => ['org', orgId, 'members'],
    score:      (orgId)          => ['org', orgId, 'score'],
    payouts:    (orgId)          => ['org', orgId, 'payouts'],
    chat:       (orgId)          => ['org', orgId, 'chat'],
    bulkReqs:   (orgId, eventId) => ['org', orgId, 'events', eventId, 'bulk-requests'],
    feedbackReqs:(orgId, eventId)=> ['org', orgId, 'events', eventId, 'feedback-requests'],
  },
  collegeAdmin: {
    applications: (collegeId) => ['college-admin', collegeId, 'applications'],
    events:       (collegeId) => ['college-admin', collegeId, 'events'],
    analytics:    (collegeId) => ['college-admin', collegeId, 'analytics'],
  },
  superAdmin: {
    dashboard:   () => ['super-admin', 'dashboard'],
    organizers:  (filters) => ['super-admin', 'organizers', filters],
    support:     (filters) => ['super-admin', 'support-tickets', filters],
    auditLog:    (filters) => ['super-admin', 'audit-log', filters],
    config:      () => ['super-admin', 'config'],
  },
};
