// pages/admin/SuperAdminEventsPage.jsx
//
// Platform-wide event management. Everything discovery hides -- drafts,
// private listings, cancelled events -- is reachable here, because those
// are precisely the ones needing intervention.
//
// Edits open in a side panel rather than a modal. A modal would cover
// the table, and the common task is checking several events in a row
// against each other; keeping the list visible is what makes that work.
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardShell } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import MediaManager from '@/components/domain/MediaManager';
import { platformApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useToast } from '@/store/uiStore';
import { CalendarIcon, SearchIcon, XIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

// Mirrors SUPER_EVENT_STATUSES on the server. sold_out is absent on
// purpose: it follows from tickets running out, so setting it by hand
// would state something the ticket counts contradict.
const STATES = [
  'draft', 'live', 'early_access', 'on_sale',
  'ongoing', 'completed', 'cancelled', 'postponed',
];
const VISIBILITIES = ['public', 'unlisted', 'private'];

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time; the API speaks
// ISO with an offset. Converting through the Date object keeps the two
// consistent instead of slicing the string and silently shifting an
// event by the timezone offset.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const badgeFor = (state) =>
  state === 'cancelled' ? 'error'
    : state === 'draft' || state === 'completed' ? 'default'
    : state === 'postponed' ? 'warning'
    : 'success';

function EditPanel({ event, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState({
    title: event.title ?? '',
    venue: event.venue ?? '',
    capacity: event.capacity ?? '',
    state: event.state ?? 'draft',
    visibility: event.visibility ?? 'public',
    start_date: toLocalInput(event.start_date),
    end_date: toLocalInput(event.end_date),
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = useMutation({
    mutationFn: () =>
      platformApi.updateEvent(event.id, {
        title: form.title,
        venue: form.venue,
        capacity: form.capacity === '' ? null : Number(form.capacity),
        state: form.state,
        visibility: form.visibility,
        start_date: fromLocalInput(form.start_date),
        end_date: fromLocalInput(form.end_date),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'all-events'] });
      // Discovery caches this event too, and an admin who has just
      // cancelled something should not see it still listed as on sale.
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: queryKeys.superAdmin.auditLog({}) });
      toast.success('Event updated.');
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <motion.aside
      className="sae__panel"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      role="dialog"
      aria-label={`Edit ${event.title}`}
    >
      <header className="sae__panel-head">
        <div>
          <p className="sae__panel-eyebrow">Editing</p>
          <h2 className="sae__panel-title">{event.title}</h2>
          <p className="sae__panel-sub">
            {event.organizer?.name ?? 'Unknown organiser'}
            {event.college_name ? ` · ${event.college_name}` : ''}
          </p>
        </div>
        <button className="sae__panel-x" onClick={onClose} aria-label="Close editor">
          <XIcon size={18} />
        </button>
      </header>

      <div className="sae__tabs" role="tablist">
        {[{ id: 'details', label: 'Details & timing' }, { id: 'banner', label: 'Banner & media' }].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`sae__tab ${tab === t.id ? 'sae__tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {tab === t.id && (
              <motion.span className="sae__tab-bg" layoutId="saeTab"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="sae__tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="sae__panel-body">
        {tab === 'details' ? (
          <form
            className="sae__form"
            onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          >
            <label className="sae__field">
              <span>Title</span>
              <input className="input-field" value={form.title} onChange={set('title')} required />
            </label>

            <label className="sae__field">
              <span>Venue</span>
              <input className="input-field" value={form.venue} onChange={set('venue')} />
            </label>

            <div className="sae__pair">
              <label className="sae__field">
                <span>Starts</span>
                <input type="datetime-local" className="input-field"
                  value={form.start_date} onChange={set('start_date')} />
              </label>
              <label className="sae__field">
                <span>Ends</span>
                <input type="datetime-local" className="input-field"
                  value={form.end_date} onChange={set('end_date')} />
              </label>
            </div>

            <div className="sae__pair">
              <label className="sae__field">
                <span>State</span>
                <select className="input-field" value={form.state} onChange={set('state')}>
                  {STATES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="sae__field">
                <span>Visibility</span>
                <select className="input-field" value={form.visibility} onChange={set('visibility')}>
                  {VISIBILITIES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>

            <label className="sae__field">
              <span>Capacity</span>
              <input type="number" min="0" className="input-field"
                value={form.capacity} onChange={set('capacity')} />
            </label>

            {(form.state === 'cancelled' || form.visibility === 'private') && (
              <p className="sae__warn" role="status">
                {form.state === 'cancelled'
                  ? 'Cancelling removes this event from discovery. Ticket holders are not refunded by this change.'
                  : 'A private event disappears from search and listings. Anyone holding a direct link still reaches it.'}
              </p>
            )}

            <div className="sae__actions">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={save.isPending}>Save changes</Button>
            </div>
          </form>
        ) : (
          <MediaManager eventId={event.id} />
        )}
      </div>
    </motion.aside>
  );
}

export default function SuperAdminEventsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);

  const eventsQuery = useQuery({
    queryKey: queryKeys.superAdmin.events({ status }),
    queryFn: () => platformApi.allEvents({ status, limit: 200 }),
  });

  const all = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  // Filtered here rather than refetching per keystroke: the whole list
  // is already loaded and a request per character would be slower than
  // the filter it replaces.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((e) =>
      (e.title ?? '').toLowerCase().includes(needle) ||
      (e.venue ?? '').toLowerCase().includes(needle) ||
      (e.organizer?.name ?? '').toLowerCase().includes(needle));
  }, [all, q]);

  const fmt = (v) => {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString(undefined,
        { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return '—'; }
  };

  // The live event is kept in sync with the list, so a save updates the
  // open panel instead of leaving it showing pre-save values.
  const current = editing ? all.find((e) => e.id === editing) ?? null : null;

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div className="sup__head">
          <div>
            <h1 className="type-display-md">All events</h1>
            <p className="type-body-md" style={{ color: 'var(--color-muted)', marginTop: 4 }}>
              Every event on the platform, including drafts and anything hidden from discovery.
            </p>
          </div>
          {!eventsQuery.isLoading && <Badge variant="default">{rows.length} shown</Badge>}
        </div>

        <div className="sae__controls">
          <div className="sae__search">
            <SearchIcon size={15} />
            <input
              className="sae__search-input"
              placeholder="Search title, venue or organiser"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search events"
            />
          </div>
          <select
            className="input-field sae__status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by state"
          >
            <option value="all">All states</option>
            {STATES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        {eventsQuery.isError && (
          <div className="empty-state" role="alert">
            <h2 className="empty-state__title">Couldn&apos;t load events</h2>
            <p className="empty-state__sub">{apiError(eventsQuery.error)}</p>
            <Button variant="primary" onClick={() => eventsQuery.refetch()}>Try again</Button>
          </div>
        )}

        {!eventsQuery.isError && !eventsQuery.isLoading && rows.length === 0 && (
          <div className="empty-state">
            <h2 className="empty-state__title">No events match</h2>
            <p className="empty-state__sub">
              {q ? 'Try a different search, or clear the state filter.' : 'Nothing is in this state right now.'}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="sup__table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Organiser</th>
                  <th>Starts</th>
                  <th>State</th>
                  <th>Visibility</th>
                  <th>Capacity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                      <br />
                      <span className="sup__sub">{e.venue || 'No venue set'}</span>
                    </td>
                    <td>
                      {e.organizer?.name ?? '—'}
                      {e.college_name && <><br /><span className="sup__sub">{e.college_name}</span></>}
                    </td>
                    <td className="sup__sub">
                      <CalendarIcon size={12} /> {fmt(e.start_date)}
                    </td>
                    <td><Badge variant={badgeFor(e.state)}>{(e.state ?? '').replace('_', ' ')}</Badge></td>
                    <td className="sup__sub">{e.visibility}</td>
                    <td className="sup__sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {e.capacity ?? '—'}
                    </td>
                    <td>
                      <Button variant="secondary" size="sm" onClick={() => setEditing(e.id)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {current && (
          <>
            <motion.div
              className="sae__scrim"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditing(null)}
            />
            <EditPanel key={current.id} event={current} onClose={() => setEditing(null)} />
          </>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
