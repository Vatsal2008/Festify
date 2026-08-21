// pages/admin/CollegeAdminPages.jsx
//
// The college admin's two screens, rebuilt against the API.
//
// Both were hard-coded. The events table called the *public* events
// endpoint and showed its first five rows, so it listed other colleges'
// events and hid the college's own drafts -- backwards for a moderation
// surface. Its Approve and Reject buttons printed "Event approved --
// now live!" and changed nothing. The analytics page was entirely
// invented: 12 clubs, 28 events, 18,400 tickets, Rs 48.2 lakh, and
// eight months of made-up monthly data.
//
// Everything here is counted from the database. Where a college has no
// activity the screens say so rather than drawing a plausible shape.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout';
import { EventStateChip } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Spinner } from '@/components/primitives/Primitives';
import { collegeAdminApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useToast } from '@/store/uiStore';
import { PlusIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Which state each action moves an event to. Publishing targets on_sale
// rather than live, because a published event whose tickets cannot be
// bought is not what "approve" means to anyone using this screen.
const ACTIONS = {
  publish:   { to: 'on_sale',   label: 'Publish',   variant: 'primary'   },
  unpublish: { to: 'draft',     label: 'Unpublish', variant: 'secondary' },
  cancel:    { to: 'cancelled', label: 'Cancel',    variant: 'danger'    },
};

/** Shared college picker. A super admin oversees every college, and a
 *  college admin may hold more than one, so the scope has to be chosen
 *  rather than assumed. Hidden entirely when there is only one.
 *
 *  `selected` stays null until someone actually picks, and the data
 *  queries pass that null straight through -- the endpoints default to
 *  the caller's first college on their own. Deriving the id from the
 *  scope response instead would make every page wait for /scope before
 *  it could ask for anything, which measured 4.66s to the first row
 *  against 2.5s of that being the wait itself. The two now go out
 *  together, and the picker shows whichever college the data came back
 *  for so the label can never disagree with the table under it. */
function useCollegeScope() {
  const [selected, setSelected] = useState(null);
  const scopeQuery = useQuery({
    queryKey: queryKeys.collegeAdmin.scope(),
    queryFn: collegeAdminApi.scope,
    staleTime: 5 * 60_000,
  });
  const colleges = scopeQuery.data?.colleges ?? [];
  return { scopeQuery, colleges, selected, setSelected };
}

function CollegePicker({ colleges, collegeId, onChange }) {
  if (colleges.length < 2) return null;
  return (
    <select
      className="input-field ca__picker"
      value={collegeId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Choose a college"
    >
      {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

function NoCollege() {
  return (
    <div className="empty-state">
      <h2 className="empty-state__title">No college assigned</h2>
      <p className="empty-state__sub">
        This account does not administer a college yet. A super admin can grant that from Admin Access.
      </p>
    </div>
  );
}

// ── College Admin: Events ─────────────────────────────────────────
export function CollegeAdminEventsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { scopeQuery, colleges, selected, setSelected } = useCollegeScope();

  const eventsQuery = useQuery({
    queryKey: queryKeys.collegeAdmin.events(selected),
    queryFn: () => collegeAdminApi.events(selected),
  });
  const collegeId = selected ?? eventsQuery.data?.college_id ?? null;

  const moderate = useMutation({
    mutationFn: ({ id, to }) => collegeAdminApi.setEventState(id, to),
    onSuccess: (updated, { to }) => {
      qc.invalidateQueries({ queryKey: ['college-admin'] });
      // Discovery caches this event too, so an admin who has just
      // unpublished something should not still see it listed.
      qc.invalidateQueries({ queryKey: ['events'] });
      toast.success(
        to === 'on_sale' ? `${updated.title} is published and on sale.`
          : to === 'draft' ? `${updated.title} is back to draft and hidden from discovery.`
          : `${updated.title} is cancelled.`
      );
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const events = eventsQuery.data?.events ?? [];
  const pending = moderate.isPending ? moderate.variables?.id : null;

  if (scopeQuery.isSuccess && colleges.length === 0) {
    return <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}><NoCollege /></div>
    </DashboardShell>;
  }

  return (
    <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div className="sup__head">
          <div>
            <h1 className="type-display-md">College events</h1>
            <p className="type-body-md" style={{ color: 'var(--color-muted)', marginTop: 4 }}>
              Every event run under this college, drafts included.
            </p>
          </div>
          <div className="ca__head-actions">
            <CollegePicker colleges={colleges} collegeId={collegeId} onChange={setSelected} />
            <Button variant="primary" onClick={() => navigate('/admin/create-event')}>
              <PlusIcon size={16} /> Create event
            </Button>
          </div>
        </div>

        {(scopeQuery.isLoading || eventsQuery.isLoading) && (
          <div style={{ padding: 'var(--space-3xl)', display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        )}

        {eventsQuery.isError && (
          <div className="empty-state" role="alert">
            <h2 className="empty-state__title">Couldn&apos;t load events</h2>
            <p className="empty-state__sub">{apiError(eventsQuery.error)}</p>
            <Button variant="primary" onClick={() => eventsQuery.refetch()}>Try again</Button>
          </div>
        )}

        {eventsQuery.isSuccess && events.length === 0 && (
          <div className="empty-state">
            <h2 className="empty-state__title">No events yet</h2>
            <p className="empty-state__sub">
              Nothing has been created under this college. Events made by its clubs appear here automatically.
            </p>
          </div>
        )}

        {events.length > 0 && (
          <div className="sup__table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Event</th><th>Organiser</th><th>Starts</th>
                  <th>Sold</th><th>State</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const isDraft = e.state === 'draft';
                  const isDead = e.state === 'cancelled' || e.state === 'completed';
                  const busy = pending === e.id;
                  return (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.title}</strong><br />
                        <span className="sup__sub">{e.venue || 'No venue set'}</span>
                      </td>
                      <td>{e.organizer?.name ?? '—'}</td>
                      <td className="sup__sub">
                        {e.start_date
                          ? new Date(e.start_date).toLocaleDateString(undefined,
                              { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="sup__sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {e.tickets_sold}{e.capacity ? ` / ${e.capacity}` : ''}
                      </td>
                      <td><EventStateChip state={e.state} /></td>
                      <td>
                        <div className="admin-actions">
                          {isDraft && (
                            <Button variant={ACTIONS.publish.variant} size="sm" isLoading={busy}
                              onClick={() => moderate.mutate({ id: e.id, to: ACTIONS.publish.to })}>
                              {ACTIONS.publish.label}
                            </Button>
                          )}
                          {!isDraft && !isDead && (
                            <Button variant={ACTIONS.unpublish.variant} size="sm" isLoading={busy}
                              onClick={() => moderate.mutate({ id: e.id, to: ACTIONS.unpublish.to })}>
                              {ACTIONS.unpublish.label}
                            </Button>
                          )}
                          {!isDead && (
                            <Button variant={ACTIONS.cancel.variant} size="sm" isLoading={busy}
                              onClick={() => moderate.mutate({ id: e.id, to: ACTIONS.cancel.to })}>
                              {ACTIONS.cancel.label}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${e.id}`)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ── College Admin: Analytics ──────────────────────────────────────
export function CollegeAdminAnalyticsPage() {
  const toast = useToast();
  const { scopeQuery, colleges, selected, setSelected } = useCollegeScope();
  // A window that actually changes the query. The old control offered
  // 7d / 30d / YTD / All and re-rendered the same fixed array whichever
  // was chosen.
  const [months, setMonths] = useState(8);

  const statsQuery = useQuery({
    queryKey: queryKeys.collegeAdmin.analytics(selected, months),
    queryFn: () => collegeAdminApi.analytics(selected, months),
  });
  const collegeId = selected ?? statsQuery.data?.college_id ?? null;

  const data = statsQuery.data;
  const monthly = useMemo(() => data?.monthly ?? [], [data]);
  const maxRev = useMemo(() => Math.max(1, ...monthly.map((m) => m.revenue)), [monthly]);
  const hasRevenue = monthly.some((m) => m.revenue > 0);

  // A real file, built from the figures on screen. This used to raise a
  // toast saying the report had downloaded, while producing no file.
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['Festify — college analytics'],
      ['College', data.college_name],
      ['Generated', new Date().toISOString()],
      [],
      ['Metric', 'Value'],
      ...data.metrics.map((m) => [m.label, m.value]),
      [],
      ['Month', 'Revenue (INR)', 'Tickets'],
      ...monthly.map((m) => [m.month, m.revenue, m.tickets]),
      [],
      [`Category share (by ${data.category_basis})`, 'Count', 'Percent'],
      ...data.categories.map((c) => [c.name, c.count, `${c.pct}%`]),
      [],
      ['Top events', 'Tickets', 'Revenue (INR)'],
      ...data.top_events.map((e) => [e.title, e.tickets, e.revenue]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `festify-${data.college_name.toLowerCase().replace(/\s+/g, '-')}-analytics.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Report saved.');
  };

  if (scopeQuery.isSuccess && colleges.length === 0) {
    return <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}><NoCollege /></div>
    </DashboardShell>;
  }

  return (
    <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div className="sup__head">
          <div>
            <h1 className="type-display-md">Analytics</h1>
            <p className="type-body-md" style={{ color: 'var(--color-muted)', marginTop: 4 }}>
              {data?.college_name ?? 'Loading'} — revenue, ticket sales and what its clubs run.
            </p>
          </div>
          <div className="ca__head-actions">
            <CollegePicker colleges={colleges} collegeId={collegeId} onChange={setSelected} />
            <select
              className="input-field ca__picker"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              aria-label="How far back to report"
            >
              {[3, 6, 8, 12, 24].map((m) => <option key={m} value={m}>Last {m} months</option>)}
            </select>
            <Button variant="primary" size="sm" onClick={exportCsv} isDisabled={!data}>
              Export CSV
            </Button>
          </div>
        </div>

        {statsQuery.isLoading && (
          <div style={{ padding: 'var(--space-3xl)', display: 'grid', placeItems: 'center' }}><Spinner /></div>
        )}

        {statsQuery.isError && (
          <div className="empty-state" role="alert">
            <h2 className="empty-state__title">Couldn&apos;t load analytics</h2>
            <p className="empty-state__sub">{apiError(statsQuery.error)}</p>
            <Button variant="primary" onClick={() => statsQuery.refetch()}>Try again</Button>
          </div>
        )}

        {data && (
          <>
            <div className="kpi-strip">
              {data.metrics.map((m) => (
                <div className="kpi" key={m.key}>
                  <div className="kpi__top">
                    <p className="kpi__value">
                      {m.format === 'currency' ? money(m.value) : Number(m.value).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="kpi__label">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="ca__grid">
              <section className="ca__panel">
                <h2 className="type-label-mono ca__panel-title">Revenue by month</h2>
                {hasRevenue ? (
                  <div className="ca__chart">
                    {monthly.map((m) => (
                      <div key={m.key} className="ca__bar-col">
                        <span className="ca__bar-val">{m.revenue ? money(m.revenue) : ''}</span>
                        <div
                          className="ca__bar"
                          style={{ height: `${(m.revenue / maxRev) * 100}%` }}
                          title={`${m.month}: ${money(m.revenue)}, ${m.tickets} ticket(s)`}
                        />
                        <span className="ca__bar-label">{m.month}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ca__none">
                    No tickets have sold in this window, so there is nothing to chart yet.
                  </p>
                )}
              </section>

              <section className="ca__panel ca__panel--alt">
                <h2 className="type-label-mono ca__panel-title">
                  Category share
                  {data.category_basis === 'events' && (
                    <Badge variant="default" style={{ marginLeft: 8 }}>by events</Badge>
                  )}
                </h2>
                {/* Named honestly: with no sales the split is of events
                    listed, not tickets sold, and the badge above says so
                    rather than letting the two be read as the same thing. */}
                {data.categories.length === 0 ? (
                  <p className="ca__none">No events yet.</p>
                ) : (
                  <div className="ca__cats">
                    {data.categories.map((c) => (
                      <div key={c.name}>
                        <div className="ca__cat-head">
                          <span className="type-body-sm" style={{ fontWeight: 600 }}>{c.name}</span>
                          <span className="type-label-mono">{c.pct}%</span>
                        </div>
                        <div className="ca__cat-track">
                          <div
                            className="ca__cat-fill"
                            style={{
                              width: `${c.pct}%`,
                              background: `var(--hue-${c.name.toLowerCase()}, var(--color-accent))`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.top_events.length > 0 && (
                  <>
                    <h2 className="type-label-mono ca__panel-title" style={{ marginTop: 'var(--space-2xl)' }}>
                      Top events
                    </h2>
                    <ul className="ca__top">
                      {data.top_events.map((e) => (
                        <li key={e.id}>
                          <span className="ca__top-name">{e.title}</span>
                          <span className="ca__top-val">
                            {e.tickets} · {money(e.revenue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
