// lib/api/endpoints.js — every backend call in one place, so components
// never build URLs themselves and route changes have a single edit site.
import api from './client';

// ── auth ──────────────────────────────────────────────────────────
export const authApi = {
  google: (idToken) => api.post('/auth/google', { id_token: idToken }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  requestCollegeOtp: (collegeEmail) =>
    api.post('/auth/verify-college-email/request', { college_email: collegeEmail }).then(r => r.data),
  confirmCollegeOtp: (otp) =>
    api.post('/auth/verify-college-email/confirm', { otp }).then(r => r.data),
};

// ── events ────────────────────────────────────────────────────────
export const eventsApi = {
  list: (params = {}) => api.get('/events', { params }).then(r => r.data),
  get: (id) => api.get(`/events/${id}`).then(r => r.data),
  create: (body) => api.post('/events', body).then(r => r.data),
  tiers: (id) => api.get(`/events/${id}/tiers`).then(r => r.data),
  createTier: (id, body) => api.post(`/events/${id}/tiers`, body).then(r => r.data),

  toggleHype: (id) => api.post(`/events/${id}/hype`).then(r => r.data),
  hypeCount: (id) => api.get(`/events/${id}/hype`).then(r => r.data),

  reviews: (id) => api.get(`/events/${id}/reviews`).then(r => r.data),
  createReview: (id, body) => api.post(`/events/${id}/reviews`, body).then(r => r.data),

  toggleWishlist: (id) => api.post(`/events/${id}/wishlist`).then(r => r.data),

  banners: (id) => api.get(`/events/${id}/banners`).then(r => r.data),
};

// ── orders & tickets ──────────────────────────────────────────────
export const ordersApi = {
  create: (body) => api.post('/orders', body).then(r => r.data),
  verifyPayment: (orderId, body) =>
    api.post(`/orders/${orderId}/verify-payment`, body).then(r => r.data),
  // Server-side reconciliation against Razorpay, for when the in-page
  // callback never runs (redirect-based methods navigate the page away).
  sync: (orderId) => api.post(`/orders/${orderId}/sync`).then(r => r.data),
  get: (orderId) => api.get(`/orders/${orderId}`).then(r => r.data),
};

export const ticketsApi = {
  get: (id) => api.get(`/tickets/${id}`).then(r => r.data),
  scan: (body) => api.post('/tickets/scan', body).then(r => r.data),
  assign: (ticketId, body) => api.post(`/tickets/${ticketId}/assign`, body).then(r => r.data),
  respondToAssignment: (assignmentId, accept) =>
    api.post(`/tickets/assignments/${assignmentId}/respond`, { accept }).then(r => r.data),
};

// ── me ────────────────────────────────────────────────────────────
export const meApi = {
  wishlist: () => api.get('/users/me/wishlist').then(r => r.data),
  following: () => api.get('/users/me/following').then(r => r.data),
};

// ── prime pass ────────────────────────────────────────────────────
export const primePassApi = {
  plans: () => api.get('/prime-pass/plans').then(r => r.data),
  mine: () => api.get('/prime-pass/me').then(r => r.data),
  createOrder: (plan) => api.post('/prime-pass/orders', { plan }).then(r => r.data),
  verify: (passId, body) => api.post(`/prime-pass/orders/${passId}/verify`, body).then(r => r.data),
  sync: (passId) => api.post(`/prime-pass/orders/${passId}/sync`).then(r => r.data),
};

// ── gate control (organizer) ──────────────────────────────────────
export const gateApi = {
  status: (eventId) => api.get(`/events/${eventId}/gate`).then(r => r.data),
  revealQr: (eventId) => api.post(`/events/${eventId}/gate/reveal-qr`).then(r => r.data),
  hideQr: (eventId) => api.post(`/events/${eventId}/gate/hide-qr`).then(r => r.data),
  open: (eventId) => api.post(`/events/${eventId}/gate/open`).then(r => r.data),
  close: (eventId) => api.post(`/events/${eventId}/gate/close`).then(r => r.data),
};

// ── orgs ──────────────────────────────────────────────────────────
export const orgsApi = {
  get: (id) => api.get(`/org-groups/${id}`).then(r => r.data),
  create: (body) => api.post('/org-groups', body).then(r => r.data),
  events: (id) => api.get(`/org-groups/${id}/events`).then(r => r.data),
  members: (id) => api.get(`/org-groups/${id}/members`).then(r => r.data),
  payouts: (id) => api.get(`/org-groups/${id}/payouts`).then(r => r.data),
  score: (id) => api.get(`/org-groups/${id}/score`).then(r => r.data),
  toggleFollow: (id) => api.post(`/org-groups/${id}/follow`).then(r => r.data),
  toggleContactBlock: (id) => api.post(`/org-groups/${id}/contact-block`).then(r => r.data),
};

// ── bulk purchase ─────────────────────────────────────────────────
export const bulkApi = {
  mine: () => api.get('/bulk-purchase-requests/mine').then(r => r.data),
  forEvent: (eventId) =>
    api.get('/bulk-purchase-requests', { params: { event_id: eventId } }).then(r => r.data),
  create: (body) => api.post('/bulk-purchase-requests', body).then(r => r.data),
  review: (id, approve) =>
    api.post(`/bulk-purchase-requests/${id}/review`, { approve }).then(r => r.data),
};

// ── organizer applications / admin ────────────────────────────────
export const adminApi = {
  applyAsOrganizer: (collegeId) =>
    api.post('/organizer-applications', { college_id: collegeId }).then(r => r.data),
  myApplications: () => api.get('/organizer-applications/mine').then(r => r.data),
  allApplications: () => api.get('/organizer-applications/all').then(r => r.data),
  pendingApplications: (collegeId) =>
    api.get('/organizer-applications/pending', { params: { college_id: collegeId } }).then(r => r.data),
  approveApplication: (id) => api.post(`/organizer-applications/${id}/approve`).then(r => r.data),
  rejectApplication: (id) => api.post(`/organizer-applications/${id}/reject`).then(r => r.data),
  banOrg: (orgId, body) => api.post(`/org-groups/${orgId}/bans`, body).then(r => r.data),
  flagOrg: (orgId, reason) => api.post(`/org-groups/${orgId}/flags`, { reason }).then(r => r.data),
};

// ── super admin login (email + OTP, no Google) ────────────────────
export const superAuthApi = {
  requestCode: (email) => api.post('/auth/super/request-code', { email }).then(r => r.data),
  verifyCode: (email, code) => api.post('/auth/super/verify-code', { email, code }).then(r => r.data),
  admins: () => api.get('/auth/super/admins').then(r => r.data),
  addAdmin: (email) => api.post('/auth/super/admins', { email }).then(r => r.data),
  removeAdmin: (id) => api.delete(`/auth/super/admins/${id}`).then(r => r.data),
  logout: () => api.post('/auth/super/logout').then(r => r.data),
};

// ── platform-wide (admin surfaces + signup flows) ─────────────────
export const platformApi = {
  colleges: () => api.get('/colleges').then(r => r.data),
  orgGroups: () => api.get('/org-groups').then(r => r.data),
  allSupportTickets: () => api.get('/support-tickets').then(r => r.data),
  auditLog: () => api.get('/audit-log').then(r => r.data),
  scoringConfig: () => api.get('/scoring-config').then(r => r.data),
  setScoringConfig: (key, value) => api.put('/scoring-config', { key, value }).then(r => r.data),

  // admin management
  myRoles: () => api.get('/auth/my-roles').then(r => r.data),
  superAdminStatus: () => api.get('/auth/super-admin/status').then(r => r.data),
  requestSuperAdminCode: () => api.post('/auth/super-admin/request-code').then(r => r.data),
  verifySuperAdminCode: (code) => api.post('/auth/super-admin/verify-code', { code }).then(r => r.data),
  searchUsers: (q) => api.get('/users/search', { params: { q } }).then(r => r.data),
  superAdmins: () => api.get('/super-admins').then(r => r.data),
  addSuperAdmin: (userId) => api.post('/super-admins', { user_id: userId }).then(r => r.data),
  removeSuperAdmin: (userId) => api.delete(`/super-admins/${userId}`).then(r => r.data),
  collegeAdmins: () => api.get('/college-admins/all').then(r => r.data),
  addCollegeAdmin: (userId, collegeId) =>
    api.post('/college-admins', { user_id: userId, college_id: collegeId }).then(r => r.data),
};

// ── support ───────────────────────────────────────────────────────
export const supportApi = {
  create: (body) => api.post('/support-tickets', body).then(r => r.data),
  mine: () => api.get('/support-tickets/mine').then(r => r.data),
  resolve: (id) => api.post(`/support-tickets/${id}/resolve`).then(r => r.data),
  reportTheft: (ticketId) =>
    api.post('/ticket-theft-reports', { ticket_id: ticketId }).then(r => r.data),
};

// ── waitlist ──────────────────────────────────────────────────────
export const waitlistApi = {
  join: (tierId, quantity = 1) =>
    api.post(`/ticket-tiers/${tierId}/waitlist`, { quantity_requested: quantity }).then(r => r.data),
  list: (tierId) => api.get(`/ticket-tiers/${tierId}/waitlist`).then(r => r.data),
};
