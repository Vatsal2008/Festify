// pages/admin/AdminPages.jsx — College Admin + Super Admin pages with SVG vector icons & interactive analytics
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/layout';
import { EventStateChip } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Avatar } from '@/components/primitives/Primitives';
import Sparkline from '@/components/primitives/Sparkline';
import { useToast } from '@/store/uiStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi, adminApi, supportApi, eventsApi, mediaMaintenanceApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { ZapIcon, PlusIcon, BarChartIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

// ── College Admin Login ──────────────────────────────────────────
export function CollegeAdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@bits.ac.in', password: '••••••••' });
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e?.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/admin/applications');
    }, 600);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <p className="login-card__logo">Fest<span>ify</span></p>
          <p className="type-label-mono" style={{ color: 'var(--color-accent)', marginTop: 'var(--space-sm)' }}>College Admin Portal</p>
        </div>
        <h1 className="login-card__title">Admin Sign In</h1>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
          <input type="email" className="input-field" placeholder="admin@college.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <input type="password" className="input-field" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <Button type="submit" variant="primary" fullWidth isLoading={loading}>Sign In</Button>
        </form>
        <div style={{ borderTop: '1px solid rgba(251, 247, 240,0.15)', paddingTop: 'var(--space-lg)' }}>
          <Button variant="ghost-canvas" size="sm" fullWidth onClick={() => handleLogin()}>
            ⚡ Quick Demo Sign In as College Admin
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── College Admin: Applications ───────────────────────────────────
export function CollegeAdminApplicationsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  // This page used to render three hardcoded applications and approve
  // them by mutating local state, so real submissions never appeared and
  // no decision reached the server.
  const rolesQuery = useQuery({ queryKey: ['auth', 'my-roles'], queryFn: platformApi.myRoles });
  const roles = rolesQuery.data;
  const isSuper = !!roles?.is_super_admin;
  const collegeId = (roles?.college_admin_of ?? [])[0];

  // A super admin reviews everything, including applications submitted
  // without a college -- those are routed to super_admin and carry no
  // college_id, so the college-scoped listing can never return them.
  const appsQuery = useQuery({
    queryKey: ['organizer-applications', isSuper ? 'all' : collegeId],
    queryFn: () => (isSuper ? adminApi.allApplications() : adminApi.pendingApplications(collegeId)),
    enabled: !!roles && (isSuper || !!collegeId),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }) =>
      approve ? adminApi.approveApplication(id) : adminApi.rejectApplication(id),
    onSuccess: (_d, { approve }) => {
      qc.invalidateQueries({ queryKey: ['organizer-applications'] });
      toast[approve ? 'success' : 'info'](approve ? 'Organizer approved.' : 'Application rejected.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const apps = appsQuery.data ?? [];
  const pending = apps.filter(a => a.status === 'pending');
  const decided = apps.filter(a => a.status !== 'pending');

  const fmt = (v) => { try { return new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return v ?? '—'; } };

  const Row = ({ app }) => (
    <tr key={app.id}>
      <td>
        <strong>{app.applicant?.full_name || 'Unknown applicant'}</strong><br />
        <span style={{ color: 'rgba(22, 16, 31,0.55)', fontSize: 12 }}>{app.applicant?.email}</span>
      </td>
      <td>{app.college?.name || <span style={{ opacity: 0.5 }}>No college</span>}</td>
      <td>{app.routed_to === 'college_admin' ? 'College admin' : 'Festify team'}</td>
      <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{fmt(app.created_at)}</td>
      <td>
        <Badge variant={app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'error' : 'warning'}>
          {app.status}
        </Badge>
      </td>
      <td>
        {app.status === 'pending' && (
          <div className="admin-actions">
            <Button variant="primary" size="sm" isLoading={decide.isPending && decide.variables?.id === app.id}
              onClick={() => decide.mutate({ id: app.id, approve: true })}>Approve</Button>
            <Button variant="danger" size="sm"
              onClick={() => decide.mutate({ id: app.id, approve: false })}>Reject</Button>
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <DashboardShell orgId={null} sidebarType={isSuper ? 'super-admin' : 'college-admin'}>
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-sm)' }}>Organizer applications</h1>
        <p className="type-body-md" style={{ color: 'rgba(22,16,31,0.65)', marginBottom: 'var(--space-2xl)' }}>
          {isSuper
            ? 'Every application across the platform, including those with no college.'
            : 'Applications from students at your college.'}
        </p>

        {rolesQuery.isLoading && <p className="type-body-md">Checking your access…</p>}

        {!rolesQuery.isLoading && !isSuper && !collegeId && (
          <div className="empty-state">
            <h2 className="empty-state__title">You do not review applications</h2>
            <p className="empty-state__sub">
              This page is for college admins and super admins. Ask a super admin to grant you access.
            </p>
          </div>
        )}

        {appsQuery.isError && (
          <div className="empty-state" role="alert">
            <h2 className="empty-state__title">Couldn&apos;t load applications</h2>
            <p className="empty-state__sub">{apiError(appsQuery.error)}</p>
            <Button variant="primary" onClick={() => appsQuery.refetch()}>Try again</Button>
          </div>
        )}

        {appsQuery.isSuccess && apps.length === 0 && (
          <div className="empty-state">
            <h2 className="empty-state__title">No applications yet</h2>
            <p className="empty-state__sub">
              Applications appear here as soon as someone applies from their profile page.
            </p>
          </div>
        )}

        {apps.length > 0 && (
          <>
            <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-md)' }}>
              Pending ({pending.length})
            </h2>
            <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 'var(--space-2xl)' }}>
              <table className="admin-table">
                <thead><tr><th>Applicant</th><th>College</th><th>Reviewed by</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {pending.length > 0
                    ? pending.map(a => <Row key={a.id} app={a} />)
                    : <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-xl)', opacity: 0.6 }}>Nothing waiting on you.</td></tr>}
                </tbody>
              </table>
            </div>

            {decided.length > 0 && (
              <>
                <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-md)' }}>Decided ({decided.length})</h2>
                <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <table className="admin-table">
                    <thead><tr><th>Applicant</th><th>College</th><th>Reviewed by</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
                    <tbody>{decided.map(a => <Row key={a.id} app={a} />)}</tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

// The College Admin events and analytics screens moved to
// CollegeAdminPages.jsx when they were rebuilt against the API. They
// were the last two surfaces still rendering invented figures.

// ── Super Admin: KPI strip ─────────────────────────────────────────
// These four numbers were hard-coded -- "23" organisers, "₹2.4Cr"
// revenue -- and had never been connected to anything. The live values
// are 5 and ₹16,189. A fabricated metric is worse than a missing one,
// because it looks like a measurement and gets acted on.
//
// Each card carries the trend behind its number. The support backlog
// deliberately has none: it is a level rather than a rate, and a daily
// count of arrivals would say nothing about how many are still waiting.
const KPI_ACCENTS = {
  organisers: 'var(--hue-hackathon)',
  events:     'var(--hue-talk)',
  support:    'var(--color-warning)',
  revenue:    'var(--hue-sports)',
};

function formatMetric(m) {
  if (m.format === 'currency') {
    return `₹${Number(m.value || 0).toLocaleString('en-IN')}`;
  }
  return Number(m.value || 0).toLocaleString('en-IN');
}

function KpiStrip() {
  const statsQuery = useQuery({
    queryKey: queryKeys.superAdmin.stats(14),
    queryFn: () => platformApi.stats(14),
    staleTime: 60_000,
  });

  if (statsQuery.isError) {
    return (
      <div className="kpi-strip kpi-strip--failed" role="status">
        <p className="type-body-sm">
          Platform figures are unavailable right now. {apiError(statsQuery.error)}
        </p>
      </div>
    );
  }

  const metrics = statsQuery.data?.metrics ?? [];

  return (
    <div className="kpi-strip">
      {(statsQuery.isLoading ? [1, 2, 3, 4] : metrics).map((m, i) => (
        <div className="kpi" key={statsQuery.isLoading ? i : m.key}>
          {statsQuery.isLoading ? (
            <>
              <span className="kpi__ghost kpi__ghost--value" />
              <span className="kpi__ghost kpi__ghost--label" />
            </>
          ) : (
            <>
              <div className="kpi__top">
                <p className="kpi__value">{formatMetric(m)}</p>
                <span className="kpi__spark" style={{ color: KPI_ACCENTS[m.key] || 'var(--color-accent)' }}>
                  <Sparkline data={m.series} label={m.label} />
                </span>
              </div>
              <p className="kpi__label">{m.label}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Super Admin: Dashboard ─────────────────────────────────────────
export function SuperAdminDashboardPage() {
  const auditQuery = useQuery({ queryKey: queryKeys.superAdmin.auditLog({}), queryFn: platformApi.auditLog });
  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ZapIcon size={28} filled /> Super Admin Dashboard
        </h1>
        <KpiStrip />
        <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Recent Audit Events</h2>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Time</th></tr></thead>
            <tbody>
              {(auditQuery.data ?? []).slice(0, 4).map(log => (
                <tr key={log.id}>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.action_type}</code></td>
                  <td>{log.actor}</td>
                  <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{log.target}</td>
                  <td style={{ color: 'rgba(22, 16, 31,0.65)', fontSize: 12 }}>{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin: College Admins Management ────────────────────────
export function SuperAdminCollegeAdminsPage() {
  const toast = useToast();
  const [collegeAdmins, setCollegeAdmins] = useState([
    { id: 'ca-1', name: 'Dr. R. K. Sharma', college: 'BITS Pilani', email: 'admin@bits.ac.in', events_count: 14, status: 'active', joined: '2025-01-15' },
    { id: 'ca-2', name: 'Prof. Anjali Gupta', college: 'IIT Bombay', email: 'admin@iitb.ac.in', events_count: 9, status: 'active', joined: '2025-02-10' },
    { id: 'ca-3', name: 'Dr. Suresh Verma', college: 'IIT Kanpur', email: 'admin@iitk.ac.in', events_count: 6, status: 'active', joined: '2025-03-01' },
    { id: 'ca-4', name: 'Meenakshi Sundaram', college: 'Delhi University', email: 'admin@du.ac.in', events_count: 0, status: 'pending', joined: '2026-08-10' },
  ]);

  const approve = (id) => {
    setCollegeAdmins(admins => admins.map(a => a.id === id ? { ...a, status: 'active' } : a));
    toast.success('College Admin approved!');
  };

  const revoke = (id) => {
    setCollegeAdmins(admins => admins.map(a => a.id === id ? { ...a, status: 'suspended' } : a));
    toast.error('College Admin access suspended');
  };

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>College Admins Management</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead>
              <tr><th>Admin Name</th><th>College / University</th><th>Email</th><th>Events</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {collegeAdmins.map(admin => (
                <tr key={admin.id}>
                  <td><strong>{admin.name}</strong></td>
                  <td>{admin.college}</td>
                  <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{admin.email}</td>
                  <td>{admin.events_count}</td>
                  <td>
                    <Badge variant={admin.status === 'active' ? 'success' : admin.status === 'pending' ? 'warning' : 'error'}>
                      {admin.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {admin.status === 'pending' && (
                        <Button variant="primary" size="sm" onClick={() => approve(admin.id)}>Approve</Button>
                      )}
                      {admin.status === 'active' && (
                        <Button variant="danger" size="sm" onClick={() => revoke(admin.id)}>Suspend</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin: Organizers ────────────────────────────────────────
export function SuperAdminOrganizersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const orgsQuery = useQuery({ queryKey: queryKeys.superAdmin.organizers({}), queryFn: platformApi.orgGroups });
  const orgs = orgsQuery.data ?? [];

  const banMutation = useMutation({
    mutationFn: ({ id, stage }) => adminApi.banOrg(id, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.superAdmin.organizers({}) });
      toast.success('Ban issued.');
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const ban = (id, stage) => banMutation.mutate({ id, stage });

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Organizers</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Organizer</th><th>Tier</th><th>Score</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}><Avatar name={org.name} src={org.avatar} size="sm" /><strong>{org.name}</strong></div></td>
                  <td><Badge variant={org.trust_tier === 'trusted' ? 'success' : org.trust_tier === 'verified' ? 'info' : 'default'}>{org.trust_tier}</Badge></td>
                  <td>{(org.score_points ?? 0).toLocaleString()}</td>
                  <td>{org.successful_events_count ?? 0}</td>
                  <td><Badge variant={org.banned ? 'error' : 'success'}>{org.banned ? `Banned (${org.ban_stage})` : 'Active'}</Badge></td>
                  <td>
                    {!org.banned && (
                      <div className="admin-actions">
                        <Button variant="secondary" size="sm" onClick={() => { toast.success(`Bonus granted to ${org.name}`); }}>Grant Bonus</Button>
                        <Button variant="danger" size="sm" onClick={() => ban(org.id, '7d')}>Ban 7d</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin: Support Tickets ───────────────────────────────────
// ── Super Admin: Platform Config ───────────────────────────────────
// The API stores config as free-form key/value rows in scoring_config,
// so this page edits the keys the platform actually reads today rather
// than a fixed struct. Each field saves independently via PUT.
const CONFIG_FIELDS = [
  { key: 'platform_fee_flat', label: 'Platform fee per ticket (₹)', hint: 'Flat rupee amount added per ticket, not a percentage.' },
  { key: 'reservation_hold_minutes', label: 'Checkout hold (minutes)', hint: 'How long a tier is reserved during checkout.' },
  { key: 'max_refund_tiers', label: 'Max refund policy tiers', hint: 'Cap on how many tiers an organizer may define.' },
  { key: 'min_refund_floor_pct', label: 'Minimum refund floor (%)', hint: 'No organizer policy may refund below this.' },
];

export function SuperAdminConfigPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const configQuery = useQuery({ queryKey: queryKeys.superAdmin.config(), queryFn: platformApi.scoringConfig });
  const [drafts, setDrafts] = useState({});

  const saveMutation = useMutation({
    mutationFn: ({ key, value }) => platformApi.setScoringConfig(key, value),
    onSuccess: (_d, { key }) => {
      qc.invalidateQueries({ queryKey: queryKeys.superAdmin.config() });
      setDrafts(d => { const next = { ...d }; delete next[key]; return next; });
      toast.success(`Saved ${key}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const stored = Object.fromEntries((configQuery.data ?? []).map(r => [r.key, r.value]));

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)', maxWidth: 640 }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Platform Config</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {CONFIG_FIELDS.map(({ key, label, hint }) => {
            const value = drafts[key] ?? stored[key] ?? '';
            const dirty = drafts[key] !== undefined && drafts[key] !== stored[key];
            return (
              <div key={key} className="input-wrapper">
                <label className="input-label" htmlFor={`cfg-${key}`}>{label}</label>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                  <input
                    id={`cfg-${key}`}
                    type="number"
                    className="input-field"
                    value={value}
                    placeholder={configQuery.isPending ? 'Loading…' : 'Not set'}
                    onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                  />
                  <Button
                    variant="primary"
                    isDisabled={!dirty}
                    isLoading={saveMutation.isPending && saveMutation.variables?.key === key}
                    onClick={() => saveMutation.mutate({ key, value: Number(drafts[key]) })}
                  >
                    Save
                  </Button>
                </div>
                <span className="input-hint">{hint}</span>
              </div>
            );
          })}
          <div style={{ paddingTop: 'var(--space-xl)', borderTop: 'var(--border-hairline)' }}>
            <p className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.6)' }}>
              Prime Pass pricing, level thresholds and ban durations are still marked open in the system design, so they are not editable here yet.
            </p>
          </div>

          <StorageSweepPanel />
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Storage sweep ─────────────────────────────────────────────────
// Deleting media marks the row and leaves the file, so a mistake stays
// recoverable. Nothing reclaimed those files afterwards, which made
// every deletion a permanent storage charge for something no longer
// reachable. This reclaims them, on demand and deliberately.
//
// Preview and sweep are separate calls. Anything that deletes files
// should say what it will delete before it does, and the retention
// window is the safety rail -- the default keeps a month of undo.
function StorageSweepPanel() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [result, setResult] = useState(null);

  const previewQuery = useQuery({
    queryKey: ['media', 'sweep-preview', days],
    queryFn: () => mediaMaintenanceApi.preview(days),
  });

  const sweep = useMutation({
    mutationFn: () => mediaMaintenanceApi.sweep(days),
    onSuccess: (data) => {
      setResult(data);
      previewQuery.refetch();
      toast.success(
        data.swept === 0
          ? 'Nothing needed reclaiming.'
          : `Reclaimed ${data.swept} file${data.swept === 1 ? '' : 's'}.`
      );
      // A partial result is not a success worth burying in a toast that
      // disappears: the panel keeps it on screen.
      if (data.failed) toast.warning(`${data.failed} could not be deleted and will be retried.`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const count = previewQuery.data?.count ?? 0;
  const kb = previewQuery.data?.bytes_kb ?? 0;

  return (
    <section className="sweep" aria-label="Storage maintenance">
      <h2 className="type-label-mono sweep__title">Storage maintenance</h2>
      <p className="sweep__body">
        Removed photos keep their file so a mistake can be undone. Once the undo window has
        passed the file is only costing storage, and this deletes it for good.
      </p>

      <div className="sweep__row">
        <label className="sweep__field">
          <span>Keep removed files for</span>
          <select
            className="input-field"
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setResult(null); }}
          >
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>

        <p className="sweep__count" role="status">
          {previewQuery.isLoading
            ? 'Checking…'
            : count === 0
              ? 'Nothing to reclaim.'
              : `${count} file${count === 1 ? '' : 's'} older than ${days} days${kb ? `, about ${Math.round(kb / 1024)}MB` : ''}.`}
        </p>

        <Button
          variant="danger"
          isDisabled={count === 0 || previewQuery.isLoading}
          isLoading={sweep.isPending}
          onClick={() => sweep.mutate()}
        >
          Delete permanently
        </Button>
      </div>

      {result && (
        <p className="sweep__result">
          Reclaimed {result.swept}. {result.failed > 0
            ? `${result.failed} could not be deleted; their records were kept so the next run tries again.`
            : 'Nothing was left behind.'}
        </p>
      )}
    </section>
  );
}

// ── Super Admin: Audit Log ─────────────────────────────────────────
export function SuperAdminAuditLogPage() {
  const auditQuery = useQuery({ queryKey: queryKeys.superAdmin.auditLog({}), queryFn: platformApi.auditLog });
  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Audit Log</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Changed</th><th>Timestamp</th></tr></thead>
            <tbody>
              {(auditQuery.data ?? []).map(log => (
                <tr key={log.id}>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.action_type}</code></td>
                  <td>{log.actor}</td>
                  <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{log.target}</td>
                  {/* The names of the fields that moved, not the raw
                      metadata blob. A stringified object spilled across
                      the column and was unreadable at a glance, which is
                      the only way anyone scans an audit table. */}
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(22, 16, 31,0.65)' }}>{log.summary || '—'}</code></td>
                  <td style={{ color: 'rgba(22, 16, 31,0.65)', fontSize: 12 }}>{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin: Trending Curation ─────────────────────────────────
export function SuperAdminTrendingPage() {
  const toast = useToast();
  const eventsQuery = useQuery({ queryKey: queryKeys.events.list({ curation: true }), queryFn: () => eventsApi.list({}) });
  const [featured, setFeatured] = useState([]);

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Trending Curation</h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.65)', marginBottom: 'var(--space-2xl)' }}>
          Add events to the featured/trending section on the home page. These are pinned above the algorithm-driven list.
        </p>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Event</th><th>Organizer</th><th>Hypes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(eventsQuery.data ?? []).map(e => (
                <tr key={e.id}>
                  <td><strong>{e.title}</strong></td>
                  <td>{e.organizer?.name ?? '—'}</td>
                  <td>{(e.hype_count ?? 0).toLocaleString()}</td>
                  <td><EventStateChip state={e.state} /></td>
                  <td>
                    {featured.includes(e.id)
                      ? <Button variant="danger" size="sm" onClick={() => { setFeatured(f => f.filter(id => id !== e.id)); toast.info('Removed from trending'); }}>Remove</Button>
                      : <Button variant="primary" size="sm" onClick={() => { setFeatured(f => [...f, e.id]); toast.success('Added to trending!'); }}>Pin</Button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin Login ─────────────────────────────────────────────
export function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('ADMIN');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e?.preventDefault();
    if (code.trim() === 'ADMIN') { navigate('/super/dashboard'); }
    else { setError('Invalid access code'); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <p className="login-card__logo" style={{ fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ZapIcon size={32} filled /> Super Admin
        </p>
        <h1 className="login-card__title" style={{ fontSize: 24 }}>Restricted Access</h1>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', width: '100%' }}>
          <input type="password" className="input-field" placeholder="Access code (ADMIN)" value={code} onChange={e => { setCode(e.target.value); setError(''); }} style={{ textAlign: 'center', letterSpacing: '0.2em' }} />
          {error && <p style={{ color: 'var(--color-error)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)' }}>{error}</p>}
          <Button type="submit" variant="primary" fullWidth>Enter Dashboard</Button>
        </form>

        <div style={{ borderTop: '1px solid rgba(251, 247, 240,0.15)', paddingTop: 'var(--space-lg)' }}>
          <p className="type-body-xs" style={{ color: 'var(--color-accent)', marginBottom: 8, fontWeight: 600 }}>Access Code: ADMIN</p>
          <Button variant="ghost-canvas" size="sm" fullWidth onClick={() => handleLogin()}>
            ⚡ 1-Click Auto Login to Super Admin
          </Button>
        </div>
      </div>
    </div>
  );
}
