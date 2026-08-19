// pages/attendee/TicketPages.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageShell, CanvasBand, TealBand } from '@/components/layout';
import { TicketCard, QRDisplay } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import Modal from '@/components/primitives/Modal';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import { useAuth } from '@/lib/auth/AuthContext';
import api, { apiError } from '@/lib/api/client';
import { supportApi } from '@/lib/api/endpoints';
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
  const [activeTab, setActiveTab] = useState('Active');

  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets.wallet(user?.id),
    queryFn: fetchMyTickets,
    enabled: !!user,
  });

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
              {filtered.map(t => <TicketCard key={t.id} ticket={t} />)}
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
  });

  const ticket = (ticketsQuery.data ?? []).find(t => t.id === id);

  const theftMutation = useMutation({
    mutationFn: () => supportApi.reportTheft(id),
    onSuccess: (report) => {
      setShowTheftModal(false);
      toast.success(`Theft report #${report.report_number} filed. Support will follow up.`);
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
              <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>{ticket.event.title}</h1>
              <p className="type-body-md" style={{ color: 'rgba(251, 247, 240,0.7)', marginTop: 'var(--space-sm)' }}>{ticket.tier.name}</p>
            </TealBand>

            <CanvasBand>
              <div className="ticket-detail-layout">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Event Date</p>
                    <p className="type-body-md">{fmt(ticket.event.start_date)}</p>
                  </div>
                  <div>
                    <p className="type-label-mono" style={{ marginBottom: 'var(--space-sm)' }}>Venue</p>
                    <p className="type-body-md">{ticket.event.venue}</p>
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
