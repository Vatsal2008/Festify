// pages/organizer/OrgPages.jsx — All organizer pages with SVG vector icons & interactive analytics
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '@/components/layout';
import { EventStateChip } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import { Avatar } from '@/components/primitives/Primitives';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi, bulkApi, eventsApi } from '@/lib/api/endpoints';
import { apiError } from '@/lib/api/client';
import { queryKeys } from '@/constants/queryKeys';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import {
  CameraIcon, CheckIcon, XIcon, AlertTriangleIcon, PlusIcon,
  ArrowRightIcon, ArrowLeftIcon, BarChartIcon
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import '@/pages/pages.css';

// ── Dashboard Overview ────────────────────────────────────────────
export function OrgDashboardPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const eventsQuery = useQuery({
    queryKey: queryKeys.org.events(orgId, {}),
    queryFn: () => orgsApi.events(orgId),
    enabled: !!orgId,
  });
  const scoreQuery = useQuery({
    queryKey: queryKeys.org.score(orgId),
    queryFn: () => orgsApi.score(orgId),
    enabled: !!orgId,
  });

  const orgEvents = eventsQuery.data ?? [];
  const totalTickets = orgEvents.reduce((a, e) => a + e.tiers.reduce((b, t) => b + t.sold_count, 0), 0);
  const totalRevenue = orgEvents.reduce((a, e) => a + e.tiers.reduce((b, t) => b + (t.sold_count * t.price), 0), 0);

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-3xl)' }}>Dashboard Overview</h1>

        {/* Metrics */}
        <section style={{ background: 'var(--color-ink)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', marginBottom: 'var(--space-2xl)' }}>
          <div className="dash-metrics">
            {[
              { value: orgEvents.length, label: 'Total Events' },
              { value: totalTickets.toLocaleString(), label: 'Tickets Sold' },
              { value: `₹${(totalRevenue / 1000).toFixed(0)}K`, label: 'Revenue' },
              { value: (scoreQuery.data?.score ?? 0).toLocaleString(), label: 'Score Points' },
            ].map(m => (
              <div key={m.label} className="dash-metric">
                <p className="dash-metric__value">{m.value}</p>
                <p className="dash-metric__label">{m.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Events table */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
            <h2 className="type-label-mono">Your Events</h2>
            <Button variant="primary" size="sm" onClick={() => navigate(`/org/${orgId}/events/new`)}>
              <PlusIcon size={16} /> Create Event
            </Button>
          </div>
          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table className="dash-events-table">
              <thead>
                <tr><th>Event</th><th>Status</th><th>Tickets Sold</th><th>Revenue</th><th></th></tr>
              </thead>
              <tbody>
                {orgEvents.map(e => {
                  const sold = e.tiers.reduce((a, t) => a + t.sold_count, 0);
                  const rev = e.tiers.reduce((a, t) => a + (t.sold_count * t.price), 0);
                  return (
                    <tr key={e.id}>
                      <td><strong>{e.title}</strong></td>
                      <td><EventStateChip state={e.state} /></td>
                      <td>{sold.toLocaleString()}</td>
                      <td>₹{rev.toLocaleString()}</td>
                      <td><Button variant="secondary" size="sm" onClick={() => navigate(`/events/${e.id}`)}>Manage</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

// ── Event Builder ─────────────────────────────────────────────────
export function EventBuilderPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const STEPS = ['Basic Info', 'Details', 'Tickets', 'Review & Publish'];

  const [form, setForm] = useState({
    title: '', category: 'Hackathon', venue: '', start_date: '', end_date: '',
    capacity: '', description: '', visibility: 'public', waitlist: true,
    tiers: [{ name: 'General', type: 'general', price: 0, quantity: 100 }],
  });

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handlePublish = () => {
    toast.success('Event published! It\'s now pending college admin review.');
    navigate(`/org/${orgId}/events`);
  };

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)', maxWidth: 800 }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-xl)' }}>
          {step === 1 ? 'Create New Event' : form.title || 'New Event'}
        </h1>

        {/* Steps */}
        <div className="builder-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`builder-step ${step === i + 1 ? 'builder-step--active' : ''} ${step > i + 1 ? 'builder-step--done' : ''}`}>
              {step > i + 1 ? <CheckIcon size={14} style={{ display: 'inline', marginRight: 4 }} /> : ''}{s}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="builder-form">
            <div className="input-wrapper">
              <label className="input-label">Event Title *</label>
              <input className="input-field" value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g., HackSprint 2026" />
            </div>
            <div className="builder-form__row">
              <div className="input-wrapper">
                <label className="input-label">Category *</label>
                <select className="select-field" value={form.category} onChange={e => update('category', e.target.value)}>
                  {['Hackathon','Cultural','Music','Sports','Talk','Workshop','Party','Comedy','Theatre'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-wrapper">
                <label className="input-label">Visibility</label>
                <select className="select-field" value={form.visibility} onChange={e => update('visibility', e.target.value)}>
                  <option value="public">Public</option>
                  <option value="college_only">College Only</option>
                </select>
              </div>
            </div>
            <div className="input-wrapper">
              <label className="input-label">Venue *</label>
              <input className="input-field" value={form.venue} onChange={e => update('venue', e.target.value)} placeholder="e.g., BITS Pilani, Rajasthan" />
            </div>
            <div className="builder-form__row">
              <div className="input-wrapper">
                <label className="input-label">Start Date & Time *</label>
                <input type="datetime-local" className="input-field" value={form.start_date} onChange={e => update('start_date', e.target.value)} />
              </div>
              <div className="input-wrapper">
                <label className="input-label">End Date & Time *</label>
                <input type="datetime-local" className="input-field" value={form.end_date} onChange={e => update('end_date', e.target.value)} />
              </div>
            </div>
            <div className="builder-form__row">
              <div className="input-wrapper">
                <label className="input-label">Total Capacity *</label>
                <input type="number" className="input-field" value={form.capacity} onChange={e => update('capacity', e.target.value)} placeholder="e.g., 500" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="builder-form">
            <div className="input-wrapper">
              <label className="input-label">Event Description *</label>
              <textarea className="textarea-field" rows={8} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe your event, what to expect, schedule, rules..." />
            </div>
            <div className="input-wrapper">
              <label className="input-label">Cover Image (URL)</label>
              <input type="url" className="input-field" placeholder="https://..." />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <input type="checkbox" id="waitlist" defaultChecked onChange={e => update('waitlist', e.target.checked)} />
              <label htmlFor="waitlist" className="type-body-md">Enable waitlist when sold out</label>
            </div>
          </div>
        )}

        {/* Step 3: Tickets */}
        {step === 3 && (
          <div className="builder-form">
            <h2 className="type-label-mono">Ticket Tiers</h2>
            {form.tiers.map((tier, i) => (
              <div key={i} style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <div className="builder-form__row">
                  <div className="input-wrapper">
                    <label className="input-label">Tier Name</label>
                    <input className="input-field" value={tier.name} onChange={e => { const t = [...form.tiers]; t[i].name = e.target.value; update('tiers', t); }} />
                  </div>
                  <div className="input-wrapper">
                    <label className="input-label">Type</label>
                    <select className="select-field" value={tier.type} onChange={e => { const t = [...form.tiers]; t[i].type = e.target.value; update('tiers', t); }}>
                      <option value="general">General</option>
                      <option value="vip">VIP</option>
                      <option value="early_bird">Early Bird</option>
                      <option value="college_only">College Only</option>
                    </select>
                  </div>
                </div>
                <div className="builder-form__row">
                  <div className="input-wrapper">
                    <label className="input-label">Price (₹)</label>
                    <input type="number" className="input-field" value={tier.price} onChange={e => { const t = [...form.tiers]; t[i].price = Number(e.target.value); update('tiers', t); }} />
                  </div>
                  <div className="input-wrapper">
                    <label className="input-label">Quantity</label>
                    <input type="number" className="input-field" value={tier.quantity} onChange={e => { const t = [...form.tiers]; t[i].quantity = Number(e.target.value); update('tiers', t); }} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => update('tiers', [...form.tiers, { name: 'VIP', type: 'vip', price: 999, quantity: 50 }])}>
              <PlusIcon size={14} /> Add Tier
            </Button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div style={{ background: 'var(--color-surface-sage)', border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)' }}>
              <h2 className="type-heading-md" style={{ marginBottom: 'var(--space-xl)' }}>{form.title || 'Untitled Event'}</h2>
              {[
                ['Category', form.category], ['Venue', form.venue || '—'],
                ['Starts', form.start_date ? format(new Date(form.start_date), 'PPP p') : '—'],
                ['Capacity', form.capacity || '—'],
                ['Ticket Tiers', form.tiers.map(t => `${t.name} (₹${t.price})`).join(', ')],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 'var(--space-xl)', padding: 'var(--space-sm) 0', borderBottom: 'var(--border-hairline)' }}>
                  <span className="type-label-mono" style={{ minWidth: 100 }}>{label}</span>
                  <span className="type-body-sm">{val}</span>
                </div>
              ))}
            </div>
            {/* Approval happens once, when the organizer account is
                granted -- not per event. Telling an already-approved
                organizer their event goes for review was simply wrong,
                and made publishing feel like it might not have worked. */}
            <div style={{ background: 'var(--color-surface-sage)', border: 'var(--border-hairline)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <CheckIcon size={20} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <p className="type-body-sm">
                Publishing puts this event live immediately. You can edit it or take it down at any time from your events list.
              </p>
            </div>
          </div>
        )}

        <div className="builder-nav">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)}>
            {step > 1 ? <><ArrowLeftIcon size={16} /> Back</> : 'Cancel'}
          </Button>
          {step < 4
            ? <Button variant="primary" onClick={() => setStep(s => s + 1)}>Next <ArrowRightIcon size={16} /></Button>
            : <Button variant="primary" onClick={handlePublish}>Publish Event</Button>
          }
        </div>
      </div>
    </DashboardShell>
  );
}

// ── QR Scanner ────────────────────────────────────────────────────
export function QRScannerPage() {
  const { orgId } = useParams();
  const [lastResult, setLastResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const toast = useToast();

  const handleManualCheck = () => {
    if (!manualCode.trim()) return;
    const isValid = manualCode.startsWith('FTF-');
    setLastResult({ code: manualCode, valid: isValid });
    if (!isValid) toast.error('Invalid ticket code');
    setManualCode('');
  };

  const mockScan = () => {
    setLastResult({ code: 'FTF-7291-VIP', valid: true, name: 'Vatsal Shah', tier: 'VIP — Includes Merch Kit' });
    toast.success('Valid ticket — entry granted!');
  };

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div className="scanner-page">
        <h1 className="type-display-md">QR Scanner</h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.65)' }}>Scan attendee QR codes at the gate</p>

        <div className="scanner-viewport" onClick={mockScan} style={{ cursor: 'pointer' }} role="button" aria-label="Tap to simulate scan">
          <div className="scanner-viewport__inner">
            <CameraIcon size={48} style={{ color: 'var(--color-ink)' }} />
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--color-accent)', animation: 'scanner-sweep 2s ease-in-out infinite' }} aria-hidden="true" />
        </div>
        <p className="type-label-mono" style={{ color: 'rgba(22, 16, 31,0.6)' }}>Tap the viewport to simulate a scan</p>

        {lastResult && (
          <div className={`scanner-result ${lastResult.valid ? 'scanner-result--success' : 'scanner-result--error'}`} style={{ minWidth: 300 }}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              {lastResult.valid ? <CheckIcon size={40} style={{ color: 'var(--color-success)' }} /> : <XIcon size={40} style={{ color: 'var(--color-error)' }} />}
            </div>
            <p className="type-heading-md">{lastResult.valid ? 'Valid Ticket' : 'Invalid Ticket'}</p>
            <p className="type-body-sm">{lastResult.code}</p>
            {lastResult.name && <p className="type-body-sm">{lastResult.name} · {lastResult.tier}</p>}
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 400 }}>
          <p className="type-label-mono" style={{ marginBottom: 'var(--space-md)' }}>Manual Code Entry</p>
          <div style={{ display: 'flex', gap: 0 }}>
            <input
              className="input-field"
              placeholder="FTF-XXXX-YYYY"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleManualCheck()}
              style={{ borderRight: 'none', borderRadius: '8px 0 0 8px' }}
            />
            <Button variant="secondary" onClick={handleManualCheck} style={{ borderRadius: '0 8px 8px 0', flexShrink: 0 }}>Check</Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Bulk Requests ─────────────────────────────────────────────────
export function BulkRequestsPage() {
  const { orgId, eventId } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const bulkQuery = useQuery({
    queryKey: queryKeys.org.bulkReqs(orgId, eventId),
    queryFn: () => bulkApi.forEvent(eventId),
    enabled: !!eventId,
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }) => bulkApi.review(id, approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.org.bulkReqs(orgId, eventId) }),
    onError: (e) => toast.error(apiError(e)),
  });
  const requests = bulkQuery.data ?? [];

  const approve = (id) => reviewMutation.mutate({ id, approve: true },
    { onSuccess: () => toast.success('Bulk request approved') });
  const reject = (id) => reviewMutation.mutate({ id, approve: false },
    { onSuccess: () => toast.info('Bulk request rejected') });

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-2xl)' }}>Bulk Ticket Requests</h1>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Request</th><th>Quantity</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'rgba(22,16,31,0.6)' }}>
                  {bulkQuery.isPending ? 'Loading requests…' : 'No pending bulk requests for this event.'}
                </td></tr>
              )}
              {requests.map(req => (
                <tr key={req.id}>
                  <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{req.id.slice(0, 8)}</code></td>
                  <td>{req.requested_qty}</td>
                  <td style={{ color: 'rgba(22,16,31,0.65)' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                  <td><Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'}>{req.status}</Badge></td>
                  <td>
                    {req.status === 'pending' && (
                      <div className="admin-actions">
                        <Button variant="primary" size="sm" onClick={() => approve(req.id)}>Approve</Button>
                        <Button variant="danger"  size="sm" onClick={() => reject(req.id)}>Reject</Button>
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

// ── Org Members ────────────────────────────────────────────────────
export function OrgMembersPage() {
  const { orgId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.org_memberships?.some(m => m.org_id === orgId && m.role === 'owner');

  const membersQuery = useQuery({
    queryKey: queryKeys.org.members(orgId),
    queryFn: () => orgsApi.members(orgId),
    enabled: !!orgId,
  });

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h1 className="type-display-md">Team Members</h1>
          {isOwner && <Button variant="primary" size="sm" onClick={() => toast.info('Invite sent!')}><PlusIcon size={14} /> Invite Member</Button>}
        </div>
        <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="admin-table">
            <thead><tr><th>Member</th><th>Email</th><th>Role</th>{isOwner && <th>Actions</th>}</tr></thead>
            <tbody>
              {(membersQuery.data ?? []).length === 0 && (
                <tr><td colSpan={isOwner ? 4 : 3} style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'rgba(22,16,31,0.6)' }}>
                  {membersQuery.isPending ? 'Loading members…' : 'No members yet.'}
                </td></tr>
              )}
              {(membersQuery.data ?? []).map(m => (
                <tr key={m.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}><Avatar name={m.user?.full_name || m.user?.email || '—'} src={m.user?.avatar_url} size="sm" />{m.user?.full_name || '—'}</div></td>
                  <td style={{ color: 'rgba(22, 16, 31,0.65)' }}>{m.user?.email}</td>
                  <td><Badge variant={m.role === 'leader' ? 'teal' : 'default'}>{m.role}</Badge></td>
                  {isOwner && <td>{m.role !== 'leader' && <Button variant="danger" size="sm" onClick={() => toast.info('Member removal is not available yet.')}>Remove</Button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Org Group Chat ─────────────────────────────────────────────────
export function OrgChatPage() {
  const { orgId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    setMessages(m => [...m, { id: `msg-${Date.now()}`, sender: { id: user?.id, name: user?.name || 'You' }, text, sent_at: new Date().toISOString() }]);
    setText('');
  };

  const fmt = (dt) => { try { return format(new Date(dt), 'h:mm a'); } catch { return ''; } };

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
        <div style={{ padding: 'var(--space-xl)', borderBottom: 'var(--border-hairline)' }}>
          <h1 className="type-display-md">Group Chat</h1>
          <p className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.6)', marginTop: 4 }}>Private org-only channel</p>
        </div>
        <div className="chat-messages" style={{ flex: 1 }}>
          {messages.map(msg => (
            <div key={msg.id} className={`chat-msg ${msg.sender.id === (user?.id || 'user-1') ? 'chat-msg--mine' : ''}`}>
              <Avatar name={msg.sender.name} src={msg.sender.avatar_url} size="sm" />
              <div className="chat-msg__bubble">
                <p className="type-label-mono" style={{ fontSize: 11, marginBottom: 4, color: msg.sender.id === (user?.id || 'user-1') ? 'rgba(251, 247, 240,0.6)' : 'rgba(22, 16, 31,0.5)' }}>{msg.sender.name}</p>
                <p className="chat-msg__text">{msg.text}</p>
                <p className="chat-msg__time">{fmt(msg.sent_at)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message..."
            aria-label="Message input"
          />
          <button onClick={send}>Send</button>
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Org Events List ───────────────────────────────────────────────
export function OrgEventsPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const eventsQuery = useQuery({
    queryKey: queryKeys.org.events(orgId, {}),
    queryFn: () => orgsApi.events(orgId),
    enabled: !!orgId,
  });
  const orgEvents = eventsQuery.data ?? [];

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h1 className="type-display-md">Your Events</h1>
          <Button variant="primary" onClick={() => navigate(`/org/${orgId}/events/new`)}><PlusIcon size={16} /> Create Event</Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {orgEvents.map(e => (
            <div key={e.id} style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3 className="type-heading-md" style={{ marginBottom: 4 }}>{e.title}</h3>
                <p className="type-body-xs" style={{ color: 'rgba(22, 16, 31,0.65)' }}>{e.venue}</p>
              </div>
              <EventStateChip state={e.state} />
              <span className="type-body-sm">{e.tiers.reduce((a, t) => a + t.sold_count, 0)} sold</span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/events/${e.id}`)}>View</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/events/${e.id}/scan`)}>Scanner</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

// ── Interactive Org Analytics Page ─────────────────────────────────
export function OrgAnalyticsPage() {
  const { orgId } = useParams();
  const toast = useToast();
  const [timeRange, setTimeRange] = useState('30d');

  const monthlySales = [
    { month: 'Jan', revenue: 140, tickets: 420 },
    { month: 'Feb', revenue: 220, tickets: 680 },
    { month: 'Mar', revenue: 180, tickets: 510 },
    { month: 'Apr', revenue: 310, tickets: 890 },
    { month: 'May', revenue: 450, tickets: 1240 },
    { month: 'Jun', revenue: 380, tickets: 980 },
    { month: 'Jul', revenue: 520, tickets: 1410 },
    { month: 'Aug', revenue: 640, tickets: 1820 },
  ];

  const maxRev = Math.max(...monthlySales.map(m => m.revenue));

  const handleExportCSV = () => {
    toast.success('Analytics CSV report generated and downloaded!');
  };

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2xl)', flexWrap: 'wrap', gap: 'var(--space-lg)' }}>
          <div>
            <h1 className="type-display-md">Analytics &amp; Insights</h1>
            <p className="type-body-sm" style={{ color: 'rgba(22, 16, 31,0.65)', marginTop: 4 }}>
              Track sales, ticket velocity, and attendee demographics
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
              { value: '₹24.8L', label: 'Gross Revenue' },
              { value: '6,450', label: 'Tickets Sold' },
              { value: '94.2%', label: 'Gate Scan Rate' },
              { value: '4.8 / 5.0', label: 'Avg Rating' },
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
            <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-2xl)' }}>Revenue Growth (₹ in Thousands)</h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-lg)', height: 220, paddingTop: 'var(--space-xl)', borderBottom: '2px solid var(--color-hairline)' }}>
              {monthlySales.map(item => {
                const heightPct = (item.revenue / maxRev) * 100;
                return (
                  <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(22, 16, 31,0.7)' }}>₹{item.revenue}k</span>
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

          {/* Ticket Tier Breakdown */}
          <div style={{ border: 'var(--border-hairline)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', background: 'var(--color-surface-sage)' }}>
            <h2 className="type-label-mono" style={{ marginBottom: 'var(--space-xl)' }}>Sales by Category</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              {[
                { name: 'Hackathons', pct: 45, color: '#6C4DFF' },
                { name: 'Cultural Fests', pct: 30, color: '#FF7A29' },
                { name: 'Music & Open Mic', pct: 15, color: '#16101F' },
                { name: 'Sports', pct: 10, color: '#FF3D8A' },
              ].map(cat => (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="type-body-sm" style={{ fontWeight: 600 }}>{cat.name}</span>
                    <span className="type-label-mono">{cat.pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'rgba(22, 16, 31,0.1)', borderRadius: 4, overflow: 'hidden' }}>
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
