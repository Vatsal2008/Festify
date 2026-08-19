// pages/attendee/TicketPages.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageShell, CanvasBand, TealBand } from '@/components/layout';
import { TicketCard, QRDisplay } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import Modal from '@/components/primitives/Modal';
import { useAuth } from '@/lib/auth/AuthContext';
import { mockTickets } from '@/data/mockData';
import { useToast } from '@/store/uiStore';
import { TicketIcon, AlertTriangleIcon, ArrowLeftIcon } from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

const TABS = ['Active', 'Used', 'All'];

export default function TicketWalletPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Active');
  if (!isAuthenticated) { navigate('/login'); return null; }

  const filtered = mockTickets.filter(t => {
    if (activeTab === 'Active') return t.status === 'valid';
    if (activeTab === 'Used')   return t.status === 'used';
    return true;
  });

  return (
    <PageShell>
      <CanvasBand>
        {/* ── My Tickets Header ── */}
        <div style={{ marginBottom: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)', borderBottom: 'var(--border-hairline)' }}>
          <h1 className="type-display-lg" style={{ color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 6 }}>
            <TicketIcon size={44} style={{ color: 'var(--color-ink)' }} /> My Tickets
          </h1>
          <p className="type-body-lg" style={{ color: 'rgba(8,61,68,0.7)' }}>
            Your ticket wallet, active QR codes, and entry details
          </p>
        </div>
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
        {filtered.length > 0 ? (
          <div className="tickets-list" role="tabpanel">
            {filtered.map(t => <TicketCard key={t.id} ticket={t} />)}
          </div>
        ) : (
          <div className="empty-state">
            <TicketIcon size={64} style={{ color: 'var(--color-ink)' }} />
            <h2 className="empty-state__title">No {activeTab.toLowerCase()} tickets</h2>
            <p className="empty-state__sub">Buy tickets to events to see them here</p>
            <button onClick={() => navigate('/')} className="btn btn--primary">Browse Events</button>
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
  const ticket = mockTickets.find(t => t.id === id) || mockTickets[0];
  const [showResellModal, setShowResellModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const fmt = (dt) => { try { return format(new Date(dt), 'EEEE, d MMMM yyyy, h:mm a'); } catch { return dt; } };

  return (
    <PageShell>
      <CanvasBand>
        {/* ── Ticket Detail Header ── */}
        <div style={{ marginBottom: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)', borderBottom: 'var(--border-hairline)' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'rgba(8,61,68,0.65)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label-mono)', fontWeight: 500, letterSpacing: 'var(--ls-label-mono)', textTransform: 'uppercase', marginBottom: 'var(--space-md)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeftIcon size={14} /> Back
          </button>
          <h1 className="type-display-lg" style={{ color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 6 }}>
            <TicketIcon size={44} style={{ color: 'var(--color-ink)' }} /> {ticket.event.title}
          </h1>
          <p className="type-body-lg" style={{ color: 'rgba(8,61,68,0.75)', marginTop: 6 }}>{ticket.tier.name}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-3xl)', alignItems: 'start' }}>
          {/* Ticket info */}
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
              <Badge variant={ticket.status === 'valid' ? 'success' : ticket.status === 'used' ? 'default' : 'error'}>
                {ticket.status.replace('_', ' ')}
              </Badge>
            </div>
            {ticket.status === 'valid' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', borderTop: 'var(--border-hairline)', paddingTop: 'var(--space-xl)' }}>
                <p className="type-label-mono">Actions</p>
                {ticket.can_resell && (
                  <Button variant="ghost" onClick={() => setShowResellModal(true)}>Resell Ticket</Button>
                )}
                {ticket.can_gift && (
                  <Button variant="ghost" onClick={() => setShowGiftModal(true)}>Gift Ticket</Button>
                )}
                <Button variant="danger" size="sm" onClick={() => setShowCancelModal(true)}>Report Theft / Cancel</Button>
              </div>
            )}
          </div>
          {/* QR Code */}
          <div>
            <p className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Your QR Code</p>
            <QRDisplay ticket={ticket} />
          </div>
        </div>
      </CanvasBand>

      <Modal isOpen={showResellModal} onClose={() => setShowResellModal(false)} title="Resell Ticket"
        footer={<><Button variant="ghost" onClick={() => setShowResellModal(false)}>Cancel</Button><Button variant="primary" onClick={() => { setShowResellModal(false); toast.success('Ticket listed for resale!'); }}>List for Resale</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div className="resell-warning">
            <AlertTriangleIcon size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <p className="resell-warning__text">You can only list at or below your original purchase price of ₹{ticket.original_price}. Resale is only available on Festify — no external transfers.</p>
          </div>
          <div><label className="input-label">Your asking price (max ₹{ticket.original_price})</label><input type="number" className="input-field" max={ticket.original_price} min={0} onInput={e => { if (Number(e.target.value) < 0) e.target.value = 0; }} defaultValue={ticket.original_price} /></div>
        </div>
      </Modal>

      <Modal isOpen={showGiftModal} onClose={() => setShowGiftModal(false)} title="Gift Ticket"
        footer={<><Button variant="ghost" onClick={() => setShowGiftModal(false)}>Cancel</Button><Button variant="primary" onClick={() => { setShowGiftModal(false); toast.success('Gift sent!'); }}>Send Gift</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <p className="type-body-md">Enter the Festify username or email of the person you'd like to gift this ticket to.</p>
          <input type="text" className="input-field" placeholder="username or email" />
          <p className="type-body-xs" style={{ color: 'rgba(8,61,68,0.6)' }}>Gifting is permanent and cannot be reversed. The recipient must have a Festify account.</p>
        </div>
      </Modal>

      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Report Theft / Cancel"
        footer={<><Button variant="ghost" onClick={() => setShowCancelModal(false)}>Cancel</Button><Button variant="danger" onClick={() => { setShowCancelModal(false); toast.error('Ticket cancelled and theft reported.'); }}>Confirm Report</Button></>}>
        <p className="type-body-md">This will invalidate your QR code immediately and open a support case. Only do this if your ticket has been compromised.</p>
      </Modal>
    </PageShell>
  );
}
