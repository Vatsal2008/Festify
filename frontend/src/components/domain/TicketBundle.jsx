// components/domain/TicketBundle.jsx
// Ten tickets to one event used to render as ten identical cards, and
// the wallet became unreadable exactly when someone had bought for a
// group. Tickets are grouped by event and tier instead: one card per
// group showing the count, expanding to the individual tickets.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '@/components/primitives/Badge';
import { buildRoute } from '@/constants/routes';
import {
  CalendarIcon, MapPinIcon, TicketIcon, ChevronDownIcon, CheckIcon,
} from '@/components/icons/Icons';
import { format } from 'date-fns';
import './domain.css';

function fmtDate(value) {
  try { return format(new Date(value), 'EEE, d MMM · h:mm a'); } catch { return value || ''; }
}

/** Group tickets by event + tier, preserving the incoming order. */
export function groupTickets(tickets) {
  const groups = new Map();
  for (const t of tickets) {
    // Tier is part of the key because a VIP and a general ticket to the
    // same event are not interchangeable, and bundling them would hide
    // which is which.
    const key = `${t.event?.id ?? 'unknown'}::${t.tier?.id ?? 'none'}`;
    if (!groups.has(key)) groups.set(key, { key, event: t.event, tier: t.tier, tickets: [] });
    groups.get(key).tickets.push(t);
  }
  return [...groups.values()];
}

export default function TicketBundle({ group }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { event, tier, tickets } = group;

  const count = tickets.length;
  const usedCount = tickets.filter(t => t.status === 'used' || t.status === 'scanned').length;
  const allUsed = usedCount === count;
  const single = count === 1;

  const openTicket = (id) => navigate(buildRoute.ticketDetail ? buildRoute.ticketDetail(id) : `/me/tickets/${id}`);

  return (
    <motion.div
      className={`ticket-bundle ${allUsed ? 'ticket-bundle--used' : ''}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      layout
    >
      {/* Stacked-paper edges hint at multiple tickets before it is
          opened, so the count is not the only signal. */}
      {!single && <span className="ticket-bundle__stack ticket-bundle__stack--2" aria-hidden="true" />}
      {!single && <span className="ticket-bundle__stack ticket-bundle__stack--1" aria-hidden="true" />}

      <button
        className="ticket-bundle__head"
        onClick={() => (single ? openTicket(tickets[0].id) : setOpen(o => !o))}
        aria-expanded={single ? undefined : open}
        aria-label={single ? `Open ticket for ${event?.title}` : `${open ? 'Collapse' : 'Expand'} ${count} tickets for ${event?.title}`}
      >
        <div className="ticket-bundle__main">
          <div className="ticket-bundle__title-row">
            <h3 className="ticket-bundle__title">{event?.title ?? 'Event'}</h3>
            {!single && (
              <span className="ticket-bundle__count">
                <TicketIcon size={13} /> {count}
              </span>
            )}
          </div>

          <div className="ticket-bundle__meta">
            <span><CalendarIcon size={13} /> {fmtDate(event?.start_date)}</span>
            <span><MapPinIcon size={13} /> {event?.venue}</span>
          </div>

          <div className="ticket-bundle__tags">
            <Badge variant="teal">{tier?.name ?? 'Ticket'}</Badge>
            {allUsed
              ? <Badge variant="default"><CheckIcon size={11} /> {single ? 'Used' : 'All used'}</Badge>
              : usedCount > 0
                ? <Badge variant="warning">{usedCount} of {count} used</Badge>
                : <Badge variant="success">{single ? 'Valid' : `${count} valid`}</Badge>}
            {event?.qr_revealed_at
              ? <Badge variant="accent">Codes live</Badge>
              : <Badge variant="default">Codes pending</Badge>}
          </div>
        </div>

        {!single && (
          <motion.span
            className="ticket-bundle__chevron"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <ChevronDownIcon size={20} />
          </motion.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && !single && (
          <motion.ul
            className="ticket-bundle__list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {tickets.map((t, i) => {
              const used = t.status === 'used' || t.status === 'scanned';
              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.035, duration: 0.25 }}
                >
                  <button
                    className={`ticket-bundle__row ${used ? 'ticket-bundle__row--used' : ''}`}
                    onClick={() => openTicket(t.id)}
                    aria-label={`Open ticket ${t.booking_code}`}
                  >
                    <span className="ticket-bundle__row-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="ticket-bundle__row-code">{t.booking_code}</span>
                    <span className="ticket-bundle__row-status">
                      {used ? <><CheckIcon size={12} /> Used</> : 'Valid'}
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
