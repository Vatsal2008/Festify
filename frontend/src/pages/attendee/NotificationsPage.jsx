// pages/attendee/NotificationsPage.jsx
// The real notification feed. This page previously said notifications
// "aren't switched on yet", which was accurate -- there was no table, no
// dispatch and no feed behind it.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import { notificationsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import {
  BellIcon, TicketIcon, SparklesIcon, HeartIcon, UsersIcon,
  AlertTriangleIcon, CheckIcon, SettingsIcon, ZapIcon,
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

const ICONS = {
  purchase_confirmation: <TicketIcon size={18} />,
  ticket_reissued: <TicketIcon size={18} />,
  prime_pass_active: <SparklesIcon size={18} />,
  organizer_application: <UsersIcon size={18} />,
  theft_report_decision: <AlertTriangleIcon size={18} />,
  event_cancelled: <AlertTriangleIcon size={18} />,
  wishlist_alert: <HeartIcon size={18} filled />,
  event_reminder: <BellIcon size={18} />,
  org_broadcast: <UsersIcon size={18} />,
  offer: <ZapIcon size={18} filled />,
};

const LABELS = {
  purchase_confirmation: 'Ticket',
  ticket_reissued: 'Ticket',
  prime_pass_active: 'Prime',
  organizer_application: 'Organizer',
  theft_report_decision: 'Support',
  event_cancelled: 'Cancelled',
  wishlist_alert: 'Wishlist',
  event_reminder: 'Reminder',
  org_broadcast: 'Organizer',
  offer: 'Offer',
};

function when(ts) {
  try {
    const d = new Date(ts);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
    return format(d, 'd MMM yyyy');
  } catch { return ''; }
}

export default function NotificationsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);

  const feedQuery = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationsApi.list(),
    enabled: isAuthenticated,
    // New notifications arrive from server-side events the client never
    // sees, so this cannot rely on invalidation alone.
    refetchInterval: 60_000,
  });

  const prefsQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsApi.preferences,
    enabled: isAuthenticated && showSettings,
  });

  const markRead = useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All caught up.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const setPref = useMutation({
    mutationFn: (body) => notificationsApi.setPreference(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences'] }),
    onError: (e) => toast.error(apiError(e)),
  });

  const open = (n) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  const items = feedQuery.data?.notifications ?? [];
  const unread = feedQuery.data?.unread_count ?? 0;

  return (
    <PageShell>
      <TealBand variant="compact">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div>
            <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Notifications</h1>
            {unread > 0 && (
              <p className="type-body-sm" style={{ color: 'rgba(251,247,240,0.7)', marginTop: 4 }}>
                {unread} unread
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            {unread > 0 && (
              <Button variant="ghost-canvas" size="sm" isLoading={markAll.isPending} onClick={() => markAll.mutate()}>
                <CheckIcon size={14} /> Mark all read
              </Button>
            )}
            <Button variant="ghost-canvas" size="sm" onClick={() => setShowSettings(s => !s)}>
              <SettingsIcon size={14} /> Settings
            </Button>
          </div>
        </div>
      </TealBand>

      <CanvasBand>
        <AnimatePresence initial={false}>
          {showSettings && (
            <motion.div
              className="notif-settings"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-lg)' }}>What you receive</h2>
              {(prefsQuery.data?.preferences ?? []).map(p => (
                <div key={p.type} className="notif-pref">
                  <div>
                    <p className="notif-pref__name">{LABELS[p.type] ?? p.type}</p>
                    <p className="notif-pref__type">{p.type.replace(/_/g, ' ')}</p>
                  </div>
                  {p.mandatory ? (
                    <Badge variant="default">Always sent</Badge>
                  ) : (
                    <label className="notif-pref__toggle">
                      <input
                        type="checkbox"
                        checked={p.in_app_enabled}
                        onChange={(e) => setPref.mutate({ type: p.type, in_app_enabled: e.target.checked })}
                      />
                      <span>In-app</span>
                    </label>
                  )}
                </div>
              ))}
              <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.6)', marginTop: 'var(--space-md)' }}>
                Ticket confirmations and cancellations are always sent — they are how you get into an event.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <QueryBoundary
          query={feedQuery}
          isEmpty={() => items.length === 0}
          emptyTitle="Nothing yet"
          emptySub="Ticket confirmations, organizer updates and reminders land here."
          loadingLabel="Loading notifications"
        >
          {() => (
            <div className="notif-list">
              {items.map((n, i) => (
                <motion.button
                  key={n.id}
                  className={`notif ${n.read_at ? '' : 'notif--unread'}`}
                  onClick={() => open(n)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="notif__icon">{ICONS[n.type] ?? <BellIcon size={18} />}</span>
                  <span className="notif__body">
                    <span className="notif__top">
                      <strong className="notif__title">{n.title}</strong>
                      <span className="notif__time">{when(n.created_at)}</span>
                    </span>
                    {n.body && <span className="notif__text">{n.body}</span>}
                    <span className="notif__tags">
                      <Badge variant={n.read_at ? 'default' : 'accent'}>{LABELS[n.type] ?? 'Update'}</Badge>
                      {(n.channels ?? []).includes('email') && (
                        <span className="notif__channel">also emailed</span>
                      )}
                    </span>
                  </span>
                  {!n.read_at && <span className="notif__dot" aria-label="Unread" />}
                </motion.button>
              ))}
            </div>
          )}
        </QueryBoundary>
      </CanvasBand>
    </PageShell>
  );
}
