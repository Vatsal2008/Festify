// pages/organizer/EventManagePage.jsx
//
// Where an organizer actually manages their event. The dashboard's
// Manage button used to navigate to the event's PUBLIC page, where an
// organizer can do nothing but look at their own listing.
//
// Two things are deliberately not editable here, both because money has
// already changed hands: a tier's price is fixed once it exists, and a
// ticket pool may grow but never shrink.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout';
import MediaManager from '@/components/domain/MediaManager';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { orgEventsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useToast } from '@/store/uiStore';
import { ArrowLeftIcon, AlertTriangleIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

const STATES = ['draft', 'live', 'early_access', 'on_sale', 'cancelled', 'postponed'];
const CATEGORIES = ['Hackathon', 'Cultural', 'Music', 'Sports', 'Talk', 'Workshop', 'Party', 'Comedy', 'Theatre'];
const VISIBILITIES = ['public', 'unlisted', 'private'];

// datetime-local speaks local time in "YYYY-MM-DDTHH:mm"; the API speaks
// ISO with an offset. Converting through Date keeps them consistent
// instead of slicing the string and shifting the event by the offset.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

function TierRow({ eventId, tier }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pool, setPool] = useState(tier.pool_capacity ?? 0);
  const [name, setName] = useState(tier.name ?? '');
  useEffect(() => { setPool(tier.pool_capacity ?? 0); setName(tier.name ?? ''); }, [tier.pool_capacity, tier.name]);

  const save = useMutation({
    mutationFn: () => orgEventsApi.updateTier(eventId, tier.id, { name, pool_capacity: Number(pool) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-events', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success('Tier updated.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const floor = Math.max(tier.pool_capacity ?? 0, tier.sold ?? 0);
  const dirty = name !== (tier.name ?? '') || Number(pool) !== (tier.pool_capacity ?? 0);

  return (
    <div className="em__tier">
      <div className="em__tier-main">
        <label className="em__field">
          <span>Tier name</span>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="em__field">
          <span>Ticket pool</span>
          <input
            type="number"
            className="input-field"
            min={floor}
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          />
        </label>
        <div className="em__field">
          <span>Price</span>
          {/* Shown, never editable. Somebody has paid it; changing it
              would make every sold ticket a discount the organizer did
              not offer or an overcharge with no way to settle up. */}
          <p className="em__locked">
            ₹{tier.price} <span>fixed</span>
          </p>
        </div>
      </div>

      <div className="em__tier-foot">
        <span className="em__tier-sold">
          {tier.sold ?? 0} sold of {tier.pool_capacity ?? 0}
        </span>
        <Button
          variant="primary"
          size="sm"
          isDisabled={!dirty}
          isLoading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save tier
        </Button>
      </div>
      {Number(pool) < floor && (
        <p className="em__warn" role="status">
          <AlertTriangleIcon size={14} /> The pool can only grow — {floor} is the floor
          {tier.sold ? ` (${tier.sold} already sold)` : ''}.
        </p>
      )}
    </div>
  );
}

export default function EventManagePage() {
  const { orgId, eventId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('details');

  const eventQuery = useQuery({
    queryKey: ['org-events', eventId],
    queryFn: () => orgEventsApi.get(eventId),
    enabled: !!eventId,
  });

  const ev = eventQuery.data;
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!ev) return;
    setForm({
      title: ev.title ?? '',
      description: ev.description ?? '',
      venue: ev.venue ?? '',
      category: ev.category ?? 'Cultural',
      state: ev.state ?? 'draft',
      visibility: ev.visibility ?? 'public',
      capacity: ev.capacity ?? '',
      start_date: toLocalInput(ev.start_date),
      end_date: toLocalInput(ev.end_date),
    });
  }, [ev]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => orgEventsApi.update(eventId, {
      ...form,
      capacity: form.capacity === '' ? null : Number(form.capacity),
      start_date: fromLocalInput(form.start_date),
      end_date: fromLocalInput(form.end_date),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-events', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/events`)}>
          <ArrowLeftIcon size={14} /> Back to events
        </Button>

        <div className="em__head">
          <div>
            <h1 className="type-display-md">{ev?.title ?? 'Manage event'}</h1>
            <p className="type-body-sm" style={{ color: 'rgba(22, 16, 31,0.68)', marginTop: 4 }}>
              Everything about this event except what people have already paid for.
            </p>
          </div>
          {ev && <Badge variant="default">{(ev.state ?? '').replace('_', ' ')}</Badge>}
        </div>

        <div className="em__tabs" role="tablist">
          {[
            { id: 'details', label: 'Details' },
            { id: 'tickets', label: 'Tickets' },
            { id: 'media', label: 'Media' },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`em__tab ${tab === t.id ? 'em__tab--on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {eventQuery.isLoading && (
          <div style={{ padding: 'var(--space-3xl)', display: 'grid', placeItems: 'center' }}><Spinner /></div>
        )}

        {eventQuery.isError && (
          <div className="empty-state" role="alert">
            <h2 className="empty-state__title">Couldn&apos;t load this event</h2>
            <p className="empty-state__sub">{apiError(eventQuery.error)}</p>
            <Button variant="primary" onClick={() => eventQuery.refetch()}>Try again</Button>
          </div>
        )}

        {ev && form && tab === 'details' && (
          <form className="em__form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <label className="em__field">
              <span>Event name</span>
              <input className="input-field" value={form.title} onChange={set('title')} required />
            </label>

            <label className="em__field">
              <span>Description</span>
              <textarea className="input-field" rows={5} value={form.description} onChange={set('description')} />
            </label>

            <label className="em__field">
              <span>Venue</span>
              <input className="input-field" value={form.venue} onChange={set('venue')} />
            </label>

            <div className="em__pair">
              <label className="em__field">
                <span>Starts</span>
                <input type="datetime-local" className="input-field" value={form.start_date} onChange={set('start_date')} />
              </label>
              <label className="em__field">
                <span>Ends</span>
                <input type="datetime-local" className="input-field" value={form.end_date} onChange={set('end_date')} />
              </label>
            </div>

            <div className="em__pair">
              <label className="em__field">
                <span>Category</span>
                <select className="input-field" value={form.category} onChange={set('category')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="em__field">
                <span>Total capacity</span>
                <input type="number" min="0" className="input-field" value={form.capacity} onChange={set('capacity')} />
              </label>
            </div>

            <div className="em__pair">
              <label className="em__field">
                <span>State</span>
                <select className="input-field" value={form.state} onChange={set('state')}>
                  {STATES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="em__field">
                <span>Visibility</span>
                <select className="input-field" value={form.visibility} onChange={set('visibility')}>
                  {VISIBILITIES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>

            {(form.state === 'cancelled' || form.visibility === 'private') && (
              <p className="em__warn" role="status">
                <AlertTriangleIcon size={14} />
                {form.state === 'cancelled'
                  ? 'Cancelling removes this event from discovery. Ticket holders are not refunded by this change.'
                  : 'A private event disappears from search and listings. Anyone with a direct link still reaches it.'}
              </p>
            )}

            <div className="em__actions">
              <Button type="button" variant="ghost" onClick={() => navigate(`/events/${eventId}`)}>
                View public page
              </Button>
              <Button type="submit" variant="primary" isLoading={save.isPending}>Save changes</Button>
            </div>
          </form>
        )}

        {ev && tab === 'tickets' && (
          <div className="em__tiers">
            <p className="em__note">
              Prices are fixed once a tier exists, and a pool can only grow — people have already
              bought at these terms.
            </p>
            {(ev.tiers_managed ?? []).length === 0 && (
              <div className="empty-state">
                <h2 className="empty-state__title">No ticket tiers yet</h2>
                <p className="empty-state__sub">Tiers are created with the event.</p>
              </div>
            )}
            {(ev.tiers_managed ?? []).map((t) => (
              <TierRow key={t.id} eventId={eventId} tier={t} />
            ))}
          </div>
        )}

        {ev && tab === 'media' && <MediaManager eventId={eventId} />}
      </div>
    </DashboardShell>
  );
}
