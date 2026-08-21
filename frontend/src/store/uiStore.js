// store/uiStore.js — Zustand global UI store (no backend)
import { create } from 'zustand';

// Cap on how many toasts may share the screen. Beyond three the stack
// covers content the message is asking the reader to look at.
const MAX_TOASTS = 3;

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
  //
  // The queue used to append unconditionally, so a control that could be
  // clicked repeatedly -- the hype button, above all -- stacked one toast
  // per failed click and buried the screen in identical copies of the same
  // sentence. Three rules keep it to one useful message:
  //
  //   1. An identical message already on screen is refreshed, not
  //      duplicated. Saying the same thing five times is not five pieces
  //      of information.
  //   2. A new failure clears earlier failures. Only the most recent one
  //      still describes the current state; the ones behind it are stale
  //      and reading them wastes the moment when something is wrong.
  //      Successes are left alone, since those describe things that did
  //      happen and remain true.
  //   3. The queue is capped, oldest dropped first.
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const duration = toast.duration ?? (toast.type === 'error' || toast.type === 'warning' ? 6000 : 4000);
    const isFailure = (t) => t.type === 'error' || t.type === 'warning';

    set((s) => {
      let next = s.toasts.filter(
        (t) => !(t.type === toast.type && t.message === toast.message)
      );
      if (isFailure(toast)) next = next.filter((t) => !isFailure(t));
      next = [...next, { ...toast, id }];
      return { toasts: next.slice(-MAX_TOASTS) };
    });

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
