// pages/admin/AdminPages.jsx — College Admin + Super Admin pages with SVG vector icons & interactive analytics
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/layout';
import { EventStateChip } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Avatar } from '@/components/primitives/Primitives';
import { useToast } from '@/store/uiStore';
import { mockEvents, mockOrganizers, mockSupportTickets, mockAuditLog, mockPlatformConfig } from '@/data/mockData';
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
      navigate('/college-admin/applications');
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
        <div style={{ borderTop: '1px solid rgba(252,252,248,0.15)', paddingTop: 'var(--space-lg)' }}>
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
  const [apps, setApps] = useState([
    { id: 'app-1', org_name: 'Tech Society BITS', leader: 'Vatsal Shah', email: 'vatsal@bits.ac.in', members_count: 12, status: 'pending', submitted_at: '2026-08-12' },
    { id: 'app-2', org_name: 'Campus Music Club', leader: 'Priya Nair', email: 'priya@bits.ac.in', members_count: 5, status: 'pending', submitted_at: '2026-08-13' },
    { id: 'app-3', org_name: 'Debate Society', leader: 'Karan M', email: 'karan@bits.ac.in', members_count: 8, status: 'approved', submitted_at: '2026-08-08' },
  ]);

  const approve = (id) => { setApps(a => a.map(x => x.id === id ? { ...x, status: 'approved' } : x)); toast.success('Organizer approved!'); };
  const reject  = (id) => { setApps(a => a.map(x => x.id === id ? { ...x, status: 'rejected' } : x)); toast.info('Application rejected'); };

  return (
    <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Organizer Applications</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Org Name</th><th>Leader</th><th>Members</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id}>
                  <td><strong>{app.org_name}</strong></td>
                  <td>{app.leader}<br/><span style={{ color: 'rgba(8,61,68,0.55)', fontSize: 12 }}>{app.email}</span></td>
                  <td>{app.members_count}</td>
                  <td style={{ color: 'rgba(8,61,68,0.65)' }}>{app.submitted_at}</td>
                  <td><Badge variant={app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'error' : 'warning'}>{app.status}</Badge></td>
                  <td>{app.status === 'pending' && (
                    <div className="admin-actions">
                      <Button variant="primary" size="sm" onClick={() => approve(app.id)}>Approve</Button>
                      <Button variant="danger"  size="sm" onClick={() => reject(app.id)}>Reject</Button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── College Admin: Events ─────────────────────────────────────────
export function CollegeAdminEventsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState(mockEvents.filter(e => e.state === 'pending').map(e => ({ ...e, state: 'pending' })).concat(mockEvents.slice(0, 3)));

  const approve = (id) => {
    setEvents(evs => evs.map(e => e.id === id ? { ...e, state: 'live' } : e));
    toast.success('Event approved — now live!');
  };
  const reject = (id) => {
    setEvents(evs => evs.map(e => e.id === id ? { ...e, state: 'draft' } : e));
    toast.warning('Event rejected — returned to organizer');
  };

  return (
    <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h1 className="type-display-md">College Events</h1>
          <Button variant="primary" onClick={() => navigate('/college-admin/create-event')}><PlusIcon size={16} /> Create Event</Button>
        </div>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Event</th><th>Organizer</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {events.slice(0, 5).map(e => (
                <tr key={e.id}>
                  <td><strong>{e.title}</strong><br/><span style={{ color: 'rgba(8,61,68,0.55)', fontSize: 12 }}>{e.venue}</span></td>
                  <td>{e.organizer.name}</td>
                  <td>{e.capacity.toLocaleString()}</td>
                  <td><EventStateChip state={e.state} /></td>
                  <td>
                    {e.state === 'pending' ? (
                      <div className="admin-actions">
                        <Button variant="primary" size="sm" onClick={() => approve(e.id)}>Approve</Button>
                        <Button variant="danger"  size="sm" onClick={() => reject(e.id)}>Reject</Button>
                      </div>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => navigate(`/events/${e.id}`)}>View</Button>
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

// ── College Admin: Interactive Analytics ──────────────────────────
export function CollegeAdminAnalyticsPage() {
  const toast = useToast();
  const [timeRange, setTimeRange] = useState('YTD');

  const monthlyCollegeData = [
    { month: 'Jan', revenue: 320, tickets: 980 },
    { month: 'Feb', revenue: 450, tickets: 1420 },
    { month: 'Mar', revenue: 390, tickets: 1100 },
    { month: 'Apr', revenue: 620, tickets: 1890 },
    { month: 'May', revenue: 840, tickets: 2540 },
    { month: 'Jun', revenue: 510, tickets: 1600 },
    { month: 'Jul', revenue: 780, tickets: 2310 },
    { month: 'Aug', revenue: 910, tickets: 2840 },
  ];

  const maxRev = Math.max(...monthlyCollegeData.map(m => m.revenue));

  const handleExportCSV = () => {
    toast.success('Campus Analytics report downloaded successfully!');
  };

  return (
    <DashboardShell orgId={null} sidebarType="college-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)', flexWrap: 'wrap', gap: 'var(--space-lg)' }}>
          <div>
            <h1 className="type-display-md">College Analytics &amp; Reports</h1>
            <p className="type-body-sm" style={{ color: 'rgba(8,61,68,0.65)', marginTop: 4 }}>
              BITS Pilani — Campus revenue, registration metrics, and club performance
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <div style={{ display: 'flex', border: 'var(--border-hairline)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {['7d', '30d', 'YTD', 'All'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  style={{
                    padding: '6px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: timeRange === range ? 'var(--color-ink)' : 'transparent',
                    color: timeRange === range ? 'var(--color-canvas)' : 'var(--color-ink)',
                  }}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div style={{ background: 'var(--color-ink)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', marginBottom: 'var(--space-2xl)' }}>
          <div className="dash-metrics">
            {[
              { value: '12', label: 'Active Clubs / Orgs' },
              { value: '28', label: 'Events Hosted' },
              { value: '18,400', label: 'Tickets Sold' },
              { value: '₹48.2L', label: 'Gross Revenue' },
            ].map(m => (
              <div key={m.label} className="dash-metric">
                <p className="dash-metric__value">{m.value}</p>
                <p className="dash-metric__label">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Chart + Distribution Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-2xl)', alignItems: 'start' }}>
          {/* Revenue Chart */}
          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', background: 'var(--color-canvas)' }}>
            <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-2xl)' }}>Campus Event Revenue (₹ in Thousands)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-lg)', height: 220, paddingTop: 'var(--space-xl)', borderBottom: '2px solid var(--color-hairline)' }}>
              {monthlyCollegeData.map(item => {
                const heightPct = (item.revenue / maxRev) * 100;
                return (
                  <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(8,61,68,0.7)' }}>₹{item.revenue}k</span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 36,
                        height: `${heightPct}%`,
                        background: 'linear-gradient(180deg, var(--color-accent) 0%, var(--color-ink) 100%)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.4s ease',
                      }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', marginTop: 4 }}>{item.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Department / Category Breakdown */}
          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', background: 'var(--color-surface-sage)' }}>
            <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Club Distribution</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {[
                { name: 'Cultural Societies', pct: 40, color: '#083d44' },
                { name: 'Tech & Hackathons', pct: 35, color: '#005f6b' },
                { name: 'Sports Council', pct: 15, color: '#008b8b' },
                { name: 'Music & Arts', pct: 10, color: '#e5ff97' },
              ].map(cat => (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="type-body-sm" style={{ fontWeight: 600 }}>{cat.name}</span>
                    <span className="type-label-mono">{cat.pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'rgba(8,61,68,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${cat.pct}%`, height: '100%', background: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin: Dashboard ─────────────────────────────────────────
export function SuperAdminDashboardPage() {
  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ZapIcon size={28} filled /> Super Admin Dashboard
        </h1>
        <div style={{ background: 'var(--color-ink)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', marginBottom: 'var(--space-2xl)' }}>
          <div className="sa-metrics">
            {[{ value: '23', label: 'Active Orgs' }, { value: '4', label: 'College Admins' }, { value: '3', label: 'Pending Support' }, { value: '₹2.4Cr', label: 'Platform Revenue' }].map(m => (
              <div key={m.label} className="dash-metric"><p className="dash-metric__value">{m.value}</p><p className="dash-metric__label">{m.label}</p></div>
            ))}
          </div>
        </div>
        <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Recent Audit Events</h2>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Time</th></tr></thead>
            <tbody>
              {mockAuditLog.slice(0, 4).map(log => (
                <tr key={log.id}>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.action_type}</code></td>
                  <td>{log.actor}</td>
                  <td style={{ color: 'rgba(8,61,68,0.65)' }}>{log.target}</td>
                  <td style={{ color: 'rgba(8,61,68,0.65)', fontSize: 12 }}>{new Date(log.timestamp).toLocaleString()}</td>
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
                  <td style={{ color: 'rgba(8,61,68,0.65)' }}>{admin.email}</td>
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
  const [orgs, setOrgs] = useState(mockOrganizers);

  const ban = (id, stage) => { setOrgs(o => o.map(x => x.id === id ? { ...x, banned: true, ban_stage: stage } : x)); toast.error(`Organizer banned (Stage ${stage})`); };

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
                  <td>{org.score_points.toLocaleString()}</td>
                  <td>{org.successful_events_count}</td>
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
export function SuperAdminSupportPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState(mockSupportTickets);

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Support Tickets</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Type</th><th>Raised By</th><th>College</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.type}</code></td>
                  <td>{t.raised_by}</td>
                  <td>{t.college || '—'}</td>
                  <td><Badge variant={t.status === 'resolved' ? 'success' : 'warning'}>{t.status}</Badge></td>
                  <td>
                    {t.status === 'pending' && (
                      <Button variant="primary" size="sm" onClick={() => { setTickets(tk => tk.map(x => x.id === t.id ? { ...x, status: 'resolved' } : x)); toast.success('Ticket resolved'); }}>Resolve</Button>
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

// ── Super Admin: Platform Config ───────────────────────────────────
export function SuperAdminConfigPage() {
  const toast = useToast();
  const [config, setConfig] = useState(mockPlatformConfig);

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)', maxWidth: 640 }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Platform Config</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {[
            { field: 'platform_fee_pct', label: 'Platform Fee %', type: 'number' },
            { field: 'successful_event_threshold_rating', label: 'Success Threshold Rating', type: 'number' },
            { field: 'successful_event_threshold_pct', label: 'Success Threshold Attendance %', type: 'number' },
            { field: 'prime_review_multiplier', label: 'Prime Review Multiplier', type: 'number' },
          ].map(({ field, label, type }) => (
            <div key={field} className="input-wrapper">
              <label className="input-label">{label}</label>
              <input
                type={type}
                className="input-field"
                value={config[field] ?? ''}
                onChange={e => setConfig(c => ({ ...c, [field]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
          <div style={{ paddingTop: 'var(--space-xl)', borderTop: 'var(--border-hairline)' }}>
            <p className="type-body-xs" style={{ color: 'rgba(8,61,68,0.6)', marginBottom: 'var(--space-lg)' }}>
              Pricing for Prime Pass, level thresholds, and ban durations are marked as TBD in fullsystem.md and are shown as locked config fields.
            </p>
            <Button variant="primary" onClick={() => toast.success('Config saved!')}>Save Changes</Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Super Admin: Audit Log ─────────────────────────────────────────
export function SuperAdminAuditLogPage() {
  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Audit Log</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Metadata</th><th>Timestamp</th></tr></thead>
            <tbody>
              {mockAuditLog.map(log => (
                <tr key={log.id}>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{log.action_type}</code></td>
                  <td>{log.actor}</td>
                  <td style={{ color: 'rgba(8,61,68,0.65)' }}>{log.target}</td>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(8,61,68,0.65)' }}>{JSON.stringify(log.metadata)}</code></td>
                  <td style={{ color: 'rgba(8,61,68,0.65)', fontSize: 12 }}>{new Date(log.timestamp).toLocaleString()}</td>
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
  const [featured, setFeatured] = useState(mockEvents.slice(0, 2).map(e => e.id));

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Trending Curation</h1>
        <p className="type-body-md" style={{ color: 'rgba(8,61,68,0.65)', marginBottom: 'var(--space-2xl)' }}>
          Add events to the featured/trending section on the home page. These are pinned above the algorithm-driven list.
        </p>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Event</th><th>Organizer</th><th>Hypes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {mockEvents.map(e => (
                <tr key={e.id}>
                  <td><strong>{e.title}</strong></td>
                  <td>{e.organizer.name}</td>
                  <td>{e.hype_count.toLocaleString()}</td>
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
    if (code.trim() === 'ADMIN') { navigate('/superadmin/dashboard'); }
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

        <div style={{ borderTop: '1px solid rgba(252,252,248,0.15)', paddingTop: 'var(--space-lg)' }}>
          <p className="type-body-xs" style={{ color: 'var(--color-accent)', marginBottom: 8, fontWeight: 600 }}>Access Code: ADMIN</p>
          <Button variant="ghost-canvas" size="sm" fullWidth onClick={() => handleLogin()}>
            ⚡ 1-Click Auto Login to Super Admin
          </Button>
        </div>
      </div>
    </div>
  );
}
