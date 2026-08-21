// pages/organizer/EventMediaPage.jsx
// Where an organiser manages one event's photos and video. The backend
// has supported this since the media router landed; there was no screen
// for it, so the whole feature was unreachable.
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
      <div style={{ padding: 'var(--space-2xl)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/events`)}>
          <ArrowLeftIcon size={14} /> Back to events
        </Button>

        <h1 className="type-display-md" style={{ margin: 'var(--space-lg) 0 var(--space-sm)' }}>
          {eventQuery.data?.title ?? 'Event media'}
        </h1>
        <p className="type-body-md" style={{ color: 'rgba(22, 16, 31,0.65)', marginBottom: 'var(--space-2xl)' }}>
          Photos for the listing, the event page and the ticket. Videos are linked from YouTube rather
          than uploaded, so they cost no bandwidth.
        </p>

        <MediaManager eventId={eventId} />
      </div>
    </DashboardShell>
  );
}
