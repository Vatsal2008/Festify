// pages/organizer/EventMediaPage.jsx
// Media management for one event. Kept as its own route rather than a
// step in the builder because media is added and revised long after an
// event is published -- photos from last year, a trailer that arrives
// the week before doors.
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout';
import MediaManager from '@/components/domain/MediaManager';
import Button from '@/components/primitives/Button';
import { eventsApi } from '@/lib/api/endpoints';
import { ArrowLeftIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

export default function EventMediaPage() {
  const { orgId, eventId } = useParams();
  const navigate = useNavigate();

  const eventQuery = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.get(eventId),
    enabled: !!eventId,
  });

  return (
    <DashboardShell orgId={orgId} sidebarType="organizer">
      <div style={{ padding: 'var(--space-2xl)', maxWidth: 900 }}>
        <button className="back-link" style={{ color: 'var(--color-muted)' }} onClick={() => navigate(`/org/${orgId}/events`)}>
          <ArrowLeftIcon size={14} /> Back to events
        </button>
        <h1 className="type-display-md" style={{ marginBottom: 'var(--space-sm)' }}>
          {eventQuery.data?.title ?? 'Event media'}
        </h1>
        <p className="type-body-md" style={{ color: 'var(--color-muted)', marginBottom: 'var(--space-2xl)' }}>
          Add photos and video, and choose which surface each one appears on.
        </p>

        <MediaManager eventId={eventId} />

        <div style={{ marginTop: 'var(--space-3xl)' }}>
          <Button variant="secondary" onClick={() => navigate(`/events/${eventId}`)}>
            View the public page
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
