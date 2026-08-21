// pages/attendee/OtherAttendeePages.jsx — Wishlist
// (Prime Pass moved to its own file once it gained a real purchase flow.)
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageShell, TealBand, CanvasBand } from '@/components/layout';
import { EventCard, PrimePassBadge } from '@/components/domain';
import Button from '@/components/primitives/Button';
import Badge from '@/components/primitives/Badge';
import QueryBoundary from '@/components/primitives/QueryBoundary';
import { Avatar, StarRating } from '@/components/primitives/Primitives';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/store/uiStore';
import { meApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/constants/queryKeys';
import { HeartIcon, BellIcon, CheckIcon, ZapIcon, TicketIcon, StarIcon, BarChartIcon, SparklesIcon, CalendarIcon, GraduationCapIcon } from '@/components/icons/Icons';
import '@/pages/pages.css';

// ── WishlistPage ──────────────────────────────────────────────────
export function WishlistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const wishlistQuery = useQuery({
    queryKey: queryKeys.user.wishlist(user?.id),
    queryFn: meApi.wishlist,
    enabled: !!user,
  });

  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>My Wishlist</h1>
      </TealBand>
      <CanvasBand>
        <QueryBoundary
          query={wishlistQuery}
          emptyTitle="Your wishlist is empty"
          emptySub="Hit the heart icon on any event to save it here."
          loadingLabel="Loading your wishlist"
        >
          {(events) => (
            <div className="wishlist-grid">
              {events.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </QueryBoundary>

        {!wishlistQuery.isPending && (wishlistQuery.data ?? []).length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
            <Button variant="primary" onClick={() => navigate('/')}>
              <HeartIcon size={16} /> Explore Events
            </Button>
          </div>
        )}
      </CanvasBand>
    </PageShell>
  );
}


// ── FollowingPage ─────────────────────────────────────────────────
// The profile linked to /me/following and /me/reviews and neither route
// existed, so two of its six account tiles led to the 404 page. Both
// pages are built from the same QueryBoundary pattern as the wishlist
// above, so they carry this design rather than introducing another.
export function FollowingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const followingQuery = useQuery({
    queryKey: queryKeys.user.following(user?.id),
    queryFn: meApi.following,
    enabled: !!user,
  });

  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>Following</h1>
      </TealBand>
      <CanvasBand>
        <QueryBoundary
          query={followingQuery}
          emptyTitle="Not following anyone yet"
          emptySub="Follow an organiser from their page and their events show up here."
          loadingLabel="Loading organisers"
        >
          {(orgs) => (
            <div className="follow-list">
              {orgs.map(org => (
                <div key={org.org_id} className="follow-row">
                  <Avatar name={org.name} size="md" />
                  <div className="follow-row__main">
                    <p className="follow-row__name">{org.name}</p>
                    <p className="follow-row__sub">
                      {org.college_name && (
                        <><GraduationCapIcon size={13} /> {org.college_name} · </>
                      )}
                      {org.successful_events} event{org.successful_events === 1 ? '' : 's'} run
                    </p>
                  </div>
                  <Badge variant="default">{org.score} pts</Badge>
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/org/${org.org_id}`)}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </CanvasBand>
    </PageShell>
  );
}

// ── MyReviewsPage ─────────────────────────────────────────────────
export function MyReviewsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const reviewsQuery = useQuery({
    queryKey: queryKeys.user.reviews(user?.id),
    queryFn: meApi.reviews,
    enabled: !!user,
  });

  const fmt = (v) => {
    if (!v) return null;
    try { return new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return null; }
  };

  return (
    <PageShell>
      <TealBand variant="compact">
        <h1 className="type-display-md" style={{ color: 'var(--color-canvas)' }}>My Reviews</h1>
      </TealBand>
      <CanvasBand>
        <QueryBoundary
          query={reviewsQuery}
          emptyTitle="No reviews yet"
          emptySub="After an event you attended finishes, you can rate it from its page."
          loadingLabel="Loading your reviews"
        >
          {(reviews) => (
            <div className="myrev-list">
              {reviews.map(r => (
                <div key={r.id} className="myrev">
                  <div className="myrev__head">
                    <div>
                      {/* An event can be removed after a review is left,
                          so the title is never assumed to be there. */}
                      <p className="myrev__event">{r.event?.title ?? 'Event no longer listed'}</p>
                      {r.event?.start_date && (
                        <p className="myrev__meta">
                          <CalendarIcon size={12} /> {fmt(r.event.start_date)}
                          {r.event.venue ? ` · ${r.event.venue}` : ''}
                        </p>
                      )}
                    </div>
                    <StarRating value={r.rating} size={16} />
                  </div>
                  {r.comment && <p className="myrev__body">{r.comment}</p>}
                  <div className="myrev__foot">
                    <span className="myrev__date">Written {fmt(r.created_at) ?? '—'}</span>
                    {r.event?.id && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${r.event.id}`)}>
                        View event
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </CanvasBand>
    </PageShell>
  );
}
