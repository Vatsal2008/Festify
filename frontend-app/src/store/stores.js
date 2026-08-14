// store/authStore.js — Zustand auth store (attendee/organizer)
// Access tokens stored in memory ONLY — never localStorage
import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,    // true on init until /auth/me resolves

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setAccessToken: (token) => set({ accessToken: token }),
  setLoading: (isLoading) => set({ isLoading }),

  logout: () => set({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
  }),

  // Derived role helpers (computed from user object)
  get isPrime()      { return get().user?.is_prime ?? false; },
  get hasPrimePass() { return get().user?.has_prime_pass ?? false; },
  get isCollegeVerified() { return get().user?.college_verified ?? false; },
  get orgMemberships()    { return get().user?.org_memberships ?? []; },

  getOrgRole: (orgId) => {
    const memberships = get().user?.org_memberships ?? [];
    return memberships.find(m => m.org_id === orgId)?.role ?? null;
  },
  isMemberOf: (orgId) => {
    const memberships = get().user?.org_memberships ?? [];
    return memberships.some(m => m.org_id === orgId);
  },
  isOwnerOf: (orgId) => {
    const memberships = get().user?.org_memberships ?? [];
    return memberships.some(m => m.org_id === orgId && m.role === 'owner');
  },
}));

// store/uiStore.js — Global UI state (modals, sidebar, overlays)
export const useUIStore = create((set) => ({
  // Sidebar
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),
  openSidebar:   () => set({ sidebarOpen: true }),

  // Mobile bottom tab bar active tab
  activeTab: 'discover',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Active modal (one at a time)
  modal: null,   // { id: string, props: object }
  openModal:  (id, props = {}) => set({ modal: { id, props } }),
  closeModal: () => set({ modal: null }),
}));

// store/notificationStore.js — In-app notification state
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.read_at).length,
  }),

  markAllRead: () => set((s) => ({
    notifications: s.notifications.map(n => ({ ...n, read_at: new Date().toISOString() })),
    unreadCount: 0,
  })),

  addNotification: (notification) => set((s) => ({
    notifications: [notification, ...s.notifications],
    unreadCount: s.unreadCount + (notification.read_at ? 0 : 1),
  })),

  // Toast queue (separate from in-app feed)
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? (toast.type === 'error' || toast.type === 'warning' ? 6000 : 4000);
    setTimeout(() => get().removeToast(id), duration);
    return id;
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
