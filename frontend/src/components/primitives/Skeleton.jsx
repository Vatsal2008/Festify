// components/primitives/Skeleton.jsx
//
// Placeholders that occupy the exact geometry of the content they stand
// in for. A centred spinner reserves no space, so the moment data
// arrives the page jumps by however tall the real content turned out to
// be -- and it tells the visitor nothing about what is coming.
//
// These mirror the real components' box model, which is why the swap
// costs zero layout shift.
import './skeleton.css';

export function Skeleton({ w = '100%', h = 16, radius = 6, className = '', style }) {
  return (
    <span
      className={`sk ${className}`}
      style={{ width: w, height: h, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** Mirrors EventCard: 16:9 cover, two-line title, meta row, footer. */
export function EventCardSkeleton() {
  return (
    <div className="sk-card" aria-hidden="true">
      <div className="sk-card__cover"><Skeleton w="100%" h="100%" radius={12} /></div>
      <div className="sk-card__body">
        <Skeleton w="82%" h={19} />
        <Skeleton w="55%" h={19} style={{ marginTop: 6 }} />
        <div className="sk-card__meta">
          <Skeleton w={92} h={12} />
          <Skeleton w={78} h={12} />
          <Skeleton w={64} h={12} />
        </div>
        <Skeleton w={64} h={16} style={{ marginTop: 10 }} />
        <div className="sk-card__footer">
          <Skeleton w={54} h={30} radius={8} />
          <Skeleton w={22} h={22} radius={11} />
        </div>
      </div>
    </div>
  );
}

/**
 * A grid of card skeletons matching the editorial layout, so the lead
 * item is wide in the placeholder exactly as it will be in the content.
 */
export function EventGridSkeleton({ count = 6 }) {
  return (
    <div className="events-grid" role="status" aria-label="Loading events">
      {Array.from({ length: count }, (_, i) => <EventCardSkeleton key={i} />)}
      <span className="visually-hidden">Loading events…</span>
    </div>
  );
}

/** Mirrors TicketBundle: title, meta line, tag row. */
export function TicketSkeleton() {
  return (
    <div className="sk-ticket" aria-hidden="true">
      <div style={{ flex: 1 }}>
        <Skeleton w="46%" h={18} />
        <div className="sk-card__meta"><Skeleton w={120} h={12} /><Skeleton w={96} h={12} /></div>
        <div className="sk-card__meta"><Skeleton w={70} h={20} radius={999} /><Skeleton w={62} h={20} radius={999} /></div>
      </div>
    </div>
  );
}

export function TicketListSkeleton({ count = 3 }) {
  return (
    <div className="tickets-list" role="status" aria-label="Loading tickets">
      {Array.from({ length: count }, (_, i) => <TicketSkeleton key={i} />)}
      <span className="visually-hidden">Loading your tickets…</span>
    </div>
  );
}

/** Mirrors a notification row: icon square, title, body, tag row. */
export function NotificationSkeleton() {
  return (
    <div className="sk-notif" aria-hidden="true">
      <Skeleton w={38} h={38} radius={8} />
      <div style={{ flex: 1 }}>
        <Skeleton w="62%" h={15} />
        <Skeleton w="88%" h={13} style={{ marginTop: 7 }} />
        <Skeleton w={70} h={18} radius={6} style={{ marginTop: 9 }} />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ count = 4 }) {
  return (
    <div className="notif-list" role="status" aria-label="Loading notifications">
      {Array.from({ length: count }, (_, i) => <NotificationSkeleton key={i} />)}
      <span className="visually-hidden">Loading notifications…</span>
    </div>
  );
}

export default Skeleton;
