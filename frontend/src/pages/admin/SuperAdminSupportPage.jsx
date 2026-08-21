// pages/admin/SuperAdminSupportPage.jsx
//
// One queue for everything awaiting a support decision.
//
// This page read only support_tickets, while theft reports are written
// to ticket_theft_reports by a separate flow, and nothing joined them.
// A filed report was stored correctly and then appeared nowhere an
// admin looks: the table showed empty while real reports sat unattended.
// The endpoint now returns both, normalised, and this renders them with
// the actions each kind actually needs.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardShell } from '@/components/layout';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { platformApi, supportApi, theftApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useToast } from '@/store/uiStore';
import { AlertTriangleIcon, MessageSquareIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function SuperAdminSupportPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('open');
  const [notes, setNotes] = useState({});

  const ticketsQuery = useQuery({
    queryKey: queryKeys.superAdmin.support({}),
    queryFn: platformApi.allSupportTickets,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.superAdmin.support({}) });

  const resolveMutation = useMutation({
    mutationFn: (id) => supportApi.resolve(id),
    onSuccess: () => { refresh(); toast.success('Marked resolved.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  // Approving revokes the stolen code and issues a replacement, so the
  // result names both outcomes rather than saying "done".
  const decideTheft = useMutation({
    mutationFn: ({ id, approve }) =>
      approve ? theftApi.approve(id, notes[id]) : theftApi.reject(id, notes[id]),
    onSuccess: (data, { approve }) => {
      refresh();
      toast.success(
        approve
          ? `Old code revoked. Replacement issued: ${data?.replacement?.booking_code ?? ''}`.trim()
          : 'Rejected. The original ticket is active again.'
      );
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const all = ticketsQuery.data ?? [];
  const isOpen = (t) => t.status === 'pending' || t.status === 'open';
  const items =
    filter === 'all' ? all : filter === 'open' ? all.filter(isOpen) : all.filter((t) => !isOpen(t));
  const openCount = all.filter(isOpen).length;

  const fmt = (v) => {
    try { return new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
    catch { return '—'; }
  };

  return (
    <DashboardShell orgId={null} sidebarType="super-admin">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div className="sup__head">
          <div>
            <h1 className="type-display-md">Support queue</h1>
            <p className="type-body-md" style={{ color: 'var(--color-muted)', marginTop: 4 }}>
              Support requests and stolen-ticket reports, unresolved first.
            </p>
          </div>
          {openCount > 0 && <Badge variant="warning">{openCount} awaiting you</Badge>}
        </div>

        <div className="sup__filters" role="tablist" aria-label="Filter support items">
          {[
            { id: 'open', label: `Open (${openCount})` },
            { id: 'done', label: 'Decided' },
            { id: 'all', label: `All (${all.length})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`sup__filter ${filter === f.id ? 'sup__filter--on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {filter === f.id && (
                <motion.span className="sup__filter-bg" layoutId="supportFilter"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
              )}
              <span className="sup__filter-label">{f.label}</span>
            </button>
          ))}
        </div>

        {ticketsQuery.isError && (
          <div className="empty-state" role="alert">
            <h2 className="empty-state__title">Couldn&apos;t load the queue</h2>
            <p className="empty-state__sub">{apiError(ticketsQuery.error)}</p>
            <Button variant="primary" onClick={() => ticketsQuery.refetch()}>Try again</Button>
          </div>
        )}

        {!ticketsQuery.isError && !ticketsQuery.isLoading && items.length === 0 && (
          <div className="empty-state">
            <h2 className="empty-state__title">
              {filter === 'open' ? 'Nothing waiting on you' : 'Nothing here'}
            </h2>
            <p className="empty-state__sub">
              Stolen-ticket reports and support requests appear here as they are filed.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="sup__table-wrap">
            <table className="admin-table sup__table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Raised by</th>
                  <th>Detail</th>
                  <th>Filed</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {items.map((t) => {
                    const theft = t.source === 'theft_report';
                    const open = isOpen(t);
                    return (
                      <motion.tr
                        key={t.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={theft ? 'sup__row--theft' : ''}
                      >
                        <td>
                          <span className={`sup__kind ${theft ? 'sup__kind--theft' : ''}`}>
                            {theft ? <AlertTriangleIcon size={12} /> : <MessageSquareIcon size={12} />}
                            {t.kind}
                          </span>
                        </td>
                        <td>
                          <strong>{t.raised_by_user?.full_name || 'Unknown'}</strong>
                          <br />
                          <span className="sup__sub">{t.raised_by_user?.email || '—'}</span>
                        </td>
                        <td>
                          {theft ? (
                            <>
                              <span className="sup__code">{t.ticket?.booking_code}</span>
                              <br />
                              <span className="sup__sub">
                                {t.event?.title || 'Unknown event'} · ticket is {t.ticket?.status}
                              </span>
                              {t.reason && (
                                <>
                                  <br />
                                  <span className="sup__sub">&ldquo;{t.reason}&rdquo;</span>
                                </>
                              )}
                            </>
                          ) : (
                            <span className="sup__sub">{t.subject || t.description || '—'}</span>
                          )}
                        </td>
                        <td className="sup__sub">{fmt(t.created_at)}</td>
                        <td>
                          <Badge
                            variant={open ? 'warning' : t.status === 'approved' ? 'success' : 'default'}
                          >
                            {t.status}
                          </Badge>
                        </td>
                        <td>
                          {open && theft && (
                            <div className="sup__actions">
                              <input
                                className="input-field sup__note"
                                placeholder="Note (optional)"
                                value={notes[t.id] ?? ''}
                                onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                                aria-label={`Reviewer note for ${t.ticket?.booking_code}`}
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={decideTheft.isPending && decideTheft.variables?.id === t.id}
                                onClick={() => decideTheft.mutate({ id: t.id, approve: true })}
                              >
                                Replace ticket
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => decideTheft.mutate({ id: t.id, approve: false })}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {open && !theft && (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={resolveMutation.isPending}
                              onClick={() => resolveMutation.mutate(t.id)}
                            >
                              Resolve
                            </Button>
                          )}
                          {!open && <span className="sup__sub">—</span>}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
