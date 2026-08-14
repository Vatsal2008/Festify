// store/uiStore.js — Zustand global UI store (no backend)
import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  // ── Sidebar ──
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),
  openSidebar:   () => set({ sidebarOpen: true }),

  // ── Modal (one at a time) ──
  modal: null,   // { id, props }
  openModal:  (id, props = {}) => set({ modal: { id, props } }),
  closeModal: () => set({ modal: null }),

  // ── Toast queue ──
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duration = toast.duration ?? (toast.type === 'error' || toast.type === 'warning' ? 6000 : 4000);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => get().removeToast(id), duration);
    return id;
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // ── Mobile active tab ──
  activeTab: 'discover',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

// Convenience hook
export const useToast = () => {
  const addToast = useUIStore((s) => s.addToast);
  return {
    success: (message, opts) => addToast({ type: 'success', message, ...opts }),
    error:   (message, opts) => addToast({ type: 'error',   message, ...opts }),
    warning: (message, opts) => addToast({ type: 'warning', message, ...opts }),
    info:    (message, opts) => addToast({ type: 'info',    message, ...opts }),
  };
};
