// pages/admin/AdminManagementPage.jsx
// Grant and revoke admin roles. Admin access is a role on a normal
// Google account — there is no separate admin login — so granting it
// means finding an existing user and promoting them.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Avatar, Spinner } from '@/components/primitives/Primitives';
import { superAuthApi, platformApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import '@/pages/pages.css';

/** Search for a user, then run an action on the one you pick. */
function UserPicker({ actionLabel, onPick, isPending, extraControl }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  const searchQuery = useQuery({
    queryKey: ['users', 'search', q],
    queryFn: () => platformApi.searchUsers(q),
    enabled: q.trim().length >= 2,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div className="input-wrapper">
        <label className="input-label" htmlFor="user-search">Find a user by name or email</label>
        <input
          id="user-search"
          className="input-field"
          placeholder="e.g. vatsal@gmail.com"
          value={q}
          onChange={(e) => { setQ(e.target.value); setSelected(null); }}
        />
        <span className="input-hint">
          They must have signed in with Google at least once before they can be given a role.
        </span>
      </div>

      {searchQuery.isPending && q.trim().length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <Spinner size="sm" /> <span className="type-body-sm">Searching…</span>
        </div>
      )}

      {searchQuery.data?.length === 0 && (
        <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.6)' }}>
          No user matches “{q}”. They need to sign in once first.
        </p>
      )}

      {(searchQuery.data ?? []).map(u => (
        <button
          key={u.id}
          onClick={() => setSelected(u)}
          className="admin-user-row"
          style={{
            borderColor: selected?.id === u.id ? 'var(--color-accent)' : 'var(--color-hairline)',
            background: selected?.id === u.id ? 'rgba(255,61,138,0.06)' : 'transparent',
          }}
        >
          <Avatar name={u.full_name || u.email} src={u.avatar_url} size="sm" />
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span className="type-body-sm" style={{ display: 'block', fontWeight: 600 }}>{u.full_name || '—'}</span>
            <span className="type-body-xs" style={{ color: 'rgba(22,16,31,0.6)' }}>{u.email}</span>
          </span>
          {selected?.id === u.id && <Badge variant="accent">Selected</Badge>}
        </button>
      ))}

      {selected && extraControl}

      <Button
        variant="primary"
        isDisabled={!selected}
        isLoading={isPending}
        onClick={() => onPick(selected)}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

export default function AdminManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [collegeId, setCollegeId] = useState('');

  const rolesQuery = useQuery({ queryKey: ['auth', 'my-roles'], queryFn: platformApi.myRoles });
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const superAdminsQuery = useQuery({ queryKey: ['super-admins'], queryFn: superAuthApi.admins });
  const collegeAdminsQuery = useQuery({ queryKey: ['college-admins'], queryFn: platformApi.collegeAdmins });
  const collegesQuery = useQuery({ queryKey: ['colleges'], queryFn: platformApi.colleges });

  // Approval is by email, not by picking an existing account: the point
  // is to grant access to someone who may never have signed in, so
  // searching the users table would not find them.
  const addSuper = useMutation({
    mutationFn: (email) => superAuthApi.addAdmin(email),
    onSuccess: (_d, email) => {
      qc.invalidateQueries({ queryKey: ['super-admins'] });
      setNewAdminEmail('');
      toast.success(`${email} can now sign in at /super.`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const removeSuper = useMutation({
    mutationFn: (adminId) => superAuthApi.removeAdmin(adminId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admins'] });
      toast.info('Super admin access removed.');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const addCollege = useMutation({
    mutationFn: (u) => platformApi.addCollegeAdmin(u.id, collegeId),
    onSuccess: (_d, u) => {
      qc.invalidateQueries({ queryKey: ['college-admins'] });
      toast.success(`${u.email} now administers that college.`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (rolesQuery.isPending) {
    return (
      <DashboardShell orgId={null} sidebarType="super-admin">
        <div style={{ padding: 'var(--space-3xl)', display: 'grid', placeItems: 'center' }}>
          <Spinner size="lg" />
        </div>
      </DashboardShell>
    );
  }

  if (!rolesQuery.data?.is_super_admin) {
    return (
      <DashboardShell orgId={null} sidebarType="super-admin">
        <div className="empty-state" style={{ padding: 'var(--space-3xl)' }}>
          <h2 className="empty-state__title">Super admin only</h2>
          <p className="empty-state__sub">
            You&apos;re signed in as {user?.email}, which doesn&apos;t have super admin access.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const superAdmins = superAdminsQuery.data ?? { admins: [], bootstrap_emails: [] };

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)', maxWidth: 860 }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-sm)' }}>Admin Access</h1>
        <p className="type-body-md" style={{ color: 'rgba(22,16,31,0.7)', marginBottom: 'var(--space-3xl)' }}>
          Super admins sign in at /super with an emailed code. College admins use their normal account.
        </p>

        {/* ── Super admins ── */}
        <section style={{ marginBottom: 'var(--space-3xl)' }}>
          <h2 className="type-heading-lg" style={{ marginBottom: 'var(--space-lg)' }}>Super admins</h2>

          {superAdmins.bootstrap_emails.length > 0 && (
            <div style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-lg)', border: 'var(--border-hairline)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-sage)' }}>
              <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>From server config</p>
              <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.75)' }}>
                {superAdmins.bootstrap_emails.join(', ')}
              </p>
              <p className="type-body-xs" style={{ color: 'rgba(22,16,31,0.6)', marginTop: 'var(--space-sm)' }}>
                Set via SUPER_ADMIN_EMAILS so there is always a way in. Change it on the server, not here.
              </p>
            </div>
          )}

          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
            <table className="admin-table">
              <thead><tr><th>Email</th><th>Signed in</th><th>Last login</th><th></th></tr></thead>
              <tbody>
                {superAdmins.admins.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'rgba(22,16,31,0.6)' }}>
                    No super admins approved yet.
                  </td></tr>
                )}
                {superAdmins.admins.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.email}</strong></td>
                    <td>
                      <Badge variant={a.user_id ? 'success' : 'default'}>
                        {a.user_id ? 'Yes' : 'Never'}
                      </Badge>
                    </td>
                    <td style={{ color: 'rgba(22,16,31,0.65)' }}>
                      {a.last_login_at ? new Date(a.last_login_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      {(a.email || '').toLowerCase() !== (user?.email || '').toLowerCase() && (
                        <Button variant="danger" size="sm"
                          isLoading={removeSuper.isPending && removeSuper.variables === a.id}
                          onClick={() => removeSuper.mutate(a.id)}>Remove</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}
            onSubmit={(e) => { e.preventDefault(); if (newAdminEmail.includes('@')) addSuper.mutate(newAdminEmail.trim().toLowerCase()); }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="type-label-mono" style={{ display: 'block', marginBottom: 'var(--space-sm)' }} htmlFor="new-admin">
                Approve an email
              </label>
              <input
                id="new-admin"
                type="email"
                className="input-field"
                placeholder="colleague@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
              />
            </div>
            <Button variant="primary" type="submit"
              isDisabled={!newAdminEmail.includes('@')} isLoading={addSuper.isPending}>
              Approve
            </Button>
          </form>
          <p className="type-body-sm" style={{ color: 'rgba(22,16,31,0.6)', marginTop: 'var(--space-sm)' }}>
            They sign in at <strong>/super</strong> with this address and a emailed code. No account needed beforehand.
          </p>
        </section>

        {/* ── College admins ── */}
        <section>
          <h2 className="type-heading-lg" style={{ marginBottom: 'var(--space-lg)' }}>College admins</h2>

          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
            <table className="admin-table">
              <thead><tr><th>Admin</th><th>Email</th><th>College</th><th>Status</th></tr></thead>
              <tbody>
                {(collegeAdminsQuery.data ?? []).length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'rgba(22,16,31,0.6)' }}>
                    No college admins yet.
                  </td></tr>
                )}
                {(collegeAdminsQuery.data ?? []).map(a => (
                  <tr key={a.id}>
                    <td>{a.user?.full_name || '—'}</td>
                    <td style={{ color: 'rgba(22,16,31,0.65)' }}>{a.user?.email}</td>
                    <td>{a.college?.name || '—'}</td>
                    <td><Badge variant={a.status === 'active' ? 'success' : 'default'}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <UserPicker
            actionLabel="Make college admin"
            isPending={addCollege.isPending}
            onPick={(u) => {
              if (!collegeId) { toast.warning('Pick a college first.'); return; }
              addCollege.mutate(u);
            }}
            extraControl={
              <div className="input-wrapper">
                <label className="input-label" htmlFor="college-select">College</label>
                <select
                  id="college-select"
                  className="select-field"
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                >
                  <option value="">Select a college…</option>
                  {(collegesQuery.data ?? []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            }
          />
        </section>
      </div>
    </DashboardShell>
  );
}
