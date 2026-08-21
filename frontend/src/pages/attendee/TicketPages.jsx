// pages/attendee/TicketPages.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageShell, CanvasBand, TealBand } from '@/components/layout';
import { QRDisplay } from '@/components/domain';
import TicketBundle, { groupTickets } from '@/components/domain/TicketBundle';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import Modal from '@/components/primitives/Modal';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import { useAuth } from '@/lib/auth/AuthContext';
import api, { apiError } from '@/lib/api/client';
import { theftApi, ordersApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/constants/queryKeys';
import { useToast } from '@/store/uiStore';
import { TicketIcon, AlertTriangleIcon, ArrowLeftIcon } from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

const TABS = ['Active', 'Used', 'All'];

const fetchMyTickets = () => api.get('/users/me/tickets').then(r => r.data);

export default function TicketWalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Active');

  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets.wallet(user?.id),
    queryFn: fetchMyTickets,
    enabled: !!user,
    // The gate changes this data from another device, so nothing local
    // can invalidate it. Poll while the wallet is open.
    staleTime: 0,
    refetchInterval: 15_000,
  });

  // A redirect-based payment (netbanking) can land the user back here
  // with the purchase already captured but never confirmed, because the
  // page that opened Checkout was destroyed mid-flow. Reconcile any
  // order left pending so the ticket appears instead of silently
  // vanishing.
  useEffect(() => {
    const pending = sessionStorage.getItem('festify_pending_order');
    if (!pending || !user) return;
    sessionStorage.removeItem('festify_pending_order');
    ordersApi.sync(pending)
      .then((res) => {
        if (res?.tickets?.length) {
          qc.invalidateQueries({ queryKey: queryKeys.tickets.wallet(user.id) });
          toast.success('Payment confirmed — your ticket is ready.');
        }
      })
      .catch(() => { /* nothing to reconcile; the wallet below is the truth */ });
  }, [user, qc, toast]);

  const all = ticketsQuery.data ?? [];
  const filtered = all.filter(t => {
    if (activeTab === 'Active') return t.status === 'issued';
    if (activeTab === 'Used') return t.status === 'used' || t.status === 'scanned';
    return true;
  });

  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>My Tickets</h1>
      </TealBand>
      <CanvasBand>
        <div className="tickets-tabs" role="tablist">
          {TABS.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`tickets-tab ${activeTab === tab ? 'tickets-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <QueryBoundary
          query={ticketsQuery}
          isEmpty={() => filtered.length === 0}
          emptyTitle={`No ${activeTab.toLowerCase()} tickets`}
          emptySub="Buy tickets to events and they'll show up here."
          loadingLabel="Loading your tickets"
        >
          {() => (
            <div className="tickets-list" role="tabpanel">
              {groupTickets(filtered).map(g => <TicketBundle key={g.key} group={g} />)}
            </div>
          )}
        </QueryBoundary>

        {!ticketsQuery.isPending && filtered.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
            <Button variant="primary" onClick={() => navigate('/')}>
              <TicketIcon size={16} /> Browse Events
            </Button>
          </div>
        )}
      </CanvasBand>
    </PageShell>
  );
}

export function TicketDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [showTheftModal, setShowTheftModal] = useState(false);

  // The wallet list already carries everything this page shows, so read
  // the ticket out of that cached response rather than adding a
  // per-ticket endpoint round trip.
  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets.wallet(user?.id),
    queryFn: fetchMyTickets,
    enabled: !!user,
    // This is the screen held up at the gate: the moment it is scanned
    // it must stop looking valid, so poll tightly while it is open.
    staleTime: 0,
    refetchInterval: 5_000,
  });

  const ticket = (ticketsQuery.data ?? []).find(t => t.id === id);

  const theftMutation = useMutation({
    mutationFn: () => theftApi.file(id),
    onSuccess: (report) => {
      setShowTheftModal(false);
      qc.invalidateQueries({ queryKey: queryKeys.tickets.wallet(user?.id) });
      toast.success(`Report filed with ${report.routed_to_label}. Your ticket is frozen until it is reviewed.`);
    },
    onError: (e) => { setShowTheftModal(false); toast.error(apiError(e)); },
  });

  const fmt = (dt) => { try { return format(new Date(dt), 'EEEE, d MMMM yyyy, h:mm a'); } catch { return dt; } };

  return (
    <PageShell>
      <QueryBoundary
        query={ticketsQuery}
        isEmpty={() => !ticket}
        emptyTitle="Ticket not found"
        emptySub="This ticket isn't in your wallet."
        loadingLabel="Loading ticket"
        minHeight={420}
      >
        {() => (
          <>
            <TealBand variant="compact">
              <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'rgba(251, 247, 240,0.7)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label-mono)', fontWeight: 700, letterSpacing: 'var(--ls-label-mono)', textTransform: 'uppercase', marginBottom: 'var(--space-lg)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeftIcon size={14} /> Back
              </button>
              <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>{ticket.event?.title ?? 'Ticket'}</h1>
              <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.7)', marginTop: 'var(--space-sm)' }}>{ticket.tier?.name ?? ''}</p>
            </TealBand>

            <CanvasBand>
              <div className="ticket-detail-layout">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Event Date</p>
                    <p className="type-body-md">{fmt(ticket.event?.start_date)}</p>
                  </div>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Venue</p>
                    <p className="type-body-md">{ticket.event?.venue ?? '—'}</p>
                  </div>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Booking Code</p>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 20, letterSpacing: '0.1em', display: 'block', padding: 'var(--space-lg)', background: 'var(--color-surface-sage)', border: 'var(--border-hairline)' }}>{ticket.booking_code}</code>
                  </div>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Status</p>
                    <Badge variant={ticket.status === 'issued' ? 'success' : ticket.status === 'used' ? 'default' : 'error'}>
                      {ticket.status === 'issued' ? 'valid' : ticket.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Paid</p>
                    <p className="type-body-md">{ticket.price_paid === 0 ? 'Free' : `₹${ticket.price_paid}`}</p>
                  </div>

                  {ticket.status === 'issued' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-xl)' }}>
                      <p className="type-label-mono">Actions</p>
                      <Button variant="danger" size="sm" onClick={() => setShowTheftModal(true)}>
                        Report stolen ticket
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <p className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Your QR Code</p>
                  <QRDisplay ticket={ticket} />
                </div>
              </div>
            </CanvasBand>

            <Modal
              isOpen={showTheftModal}
              onClose={() => setShowTheftModal(false)}
              title="Report stolen ticket"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setShowTheftModal(false)}>Cancel</Button>
                  <Button variant="danger" onClick={() => theftMutation.mutate()} isLoading={theftMutation.isPending}>
                    File report
                  </Button>
                </>
              }
            >
              <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-warning)' }} />
                <p className="type-body-md">
                  This opens a support case for this ticket. Only report a ticket you believe has been shared or stolen — repeat reports on the same ticket are tracked.
                </p>
              </div>
            </Modal>
          </>
        )}
      </QueryBoundary>
    </PageShell>
  );
}
