// pages/admin/SuperAdminEventsPage.jsx
// Platform-wide event management. Everything discovery hides -- drafts,
// private listings, cancelled events -- is reachable here, because those
// are exactly the ones that need an admin.
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout';
import { EventStateChip } from '@/components/domain';
import MediaManager from '@/components/domain/MediaManager';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import Modal from '@/components/primitives/Modal';
import { platformApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useToast } from '@/store/uiStore';
import '@/pages/pages.css';

// Mirrors the server's allowed set. sold_out is absent on purpose: it
// follows from tickets running out, so setting it by hand would assert
// something the ticket counts contradict.
const STATES = ['draft', 'live', 'early_access', 'on_sale', 'ongoing', 'completed', 'cancelled', 'postponed'];
const VISIBILITIES = ['public', 'unlisted', 'private'];

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time; the API speaks
// ISO with an offset. Going through Date keeps them consistent rather
// than slicing the string and shifting the event by the offset.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

function EditModal({ event, onClose }) {
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
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => platformApi.updateEvent(event.id, {
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
      // Discovery caches this event too; an admin who has just cancelled
      // something should not still see it listed as on sale.
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: queryKeys.superAdmin.auditLog({}) });
      toast.success('Event updated.');
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={event.title}
      size="lg"
      footer={tab === 'details' ? (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isLoading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </>
      ) : <Button variant="ghost" onClick={onClose}>Done</Button>}
    >
      <div className="sae__tabs" role="tablist">
        {[{ id: 'details', label: 'Details & timing' }, { id: 'banner', label: 'Banner & media' }].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`sae__tab ${tab === t.id ? 'sae__tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' ? (
        <div className="sae__form">
          <label className="sae__field">
            <span>Title</span>
            <input className="input-field" value={form.title} onChange={set('title')} />
          </label>
          <label className="sae__field">
            <span>Venue</span>
            <input className="input-field" value={form.venue} onChange={set('venue')} />
          </label>
          <div className="sae__pair">
            <label className="sae__field">
              <span>Starts</span>
              <input type="datetime-local" className="input-field" value={form.start_date} onChange={set('start_date')} />
            </label>
            <label className="sae__field">
              <span>Ends</span>
              <input type="datetime-local" className="input-field" value={form.end_date} onChange={set('end_date')} />
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
            <input type="number" min="0" className="input-field" value={form.capacity} onChange={set('capacity')} />
          </label>

          {/* Shown only for the two settings that remove an event from
              view. A warning on every option teaches people to ignore it. */}
          {(form.state === 'cancelled' || form.visibility === 'private') && (
            <p className="sae__warn" role="status">
              {form.state === 'cancelled'
                ? 'Cancelling removes this event from discovery. Ticket holders are not refunded by this change.'
                : 'A private event disappears from search and listings. Anyone holding a direct link still reaches it.'}
            </p>
          )}
        </div>
      ) : (
        <MediaManager eventId={event.id} />
      )}
    </Modal>
  );
}

export default function SuperAdminEventsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [editingId, setEditingId] = useState(null);

  const eventsQuery = useQuery({
    queryKey: queryKeys.superAdmin.events({ status }),
    queryFn: () => platformApi.allEvents({ status, limit: 200 }),
  });

  const all = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  // Filtered here rather than refetching per keystroke: the list is
  // already loaded and a request per character is slower than the
  // filter it replaces.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((e) =>
      (e.title ?? '').toLowerCase().includes(needle) ||
      (e.venue ?? '').toLowerCase().includes(needle) ||
      (e.organizer?.name ?? '').toLowerCase().includes(needle));
  }, [all, q]);

  const editing = editingId ? all.find((e) => e.id === editingId) : null;
  const fmt = (v) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-sm)' }}>All events</h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.65)', marginBottom: 'var(--space-2xl)' }}>
          Every event on the platform, including drafts and anything hidden from discovery.
        </p>

        <div className="sae__controls">
          <input
            className="input-field"
            placeholder="Search title, venue or organiser"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search events"
            style={{ flex: '1 1 280px' }}
          />
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

        {eventsQuery.isSuccess && rows.length === 0 && (
          <div className="empty-state">
            <h2 className="empty-state__title">No events match</h2>
            <p className="empty-state__sub">Try a different search, or clear the state filter.</p>
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Event</th><th>Organiser</th><th>Starts</th>
                  <th>State</th><th>Visibility</th><th>Capacity</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong><br />
                      <span style={{ color: 'rgba(22, 16, 31,0.68)', fontSize: 12 }}>{e.venue || 'No venue set'}</span>
                    </td>
                    <td>{e.organizer?.name ?? '—'}</td>
                    <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{fmt(e.start_date)}</td>
                    <td><EventStateChip state={e.state} /></td>
                    <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{e.visibility}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.capacity ?? '—'}</td>
                    <td>
                      <Button variant="secondary" size="sm" onClick={() => setEditingId(e.id)}>Manage</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EditModal key={editing.id} event={editing} onClose={() => setEditingId(null)} />}
    </DashboardShell>
  );
}
