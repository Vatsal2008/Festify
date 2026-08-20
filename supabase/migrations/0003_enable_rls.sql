-- Enables Row Level Security on all 33 tables. The FastAPI backend always
-- connects with the Supabase service_role key, which bypasses RLS
-- entirely -- so this has ZERO effect on anything the API does. It only
-- matters for the anon/authenticated keys, i.e. if the frontend ever
-- queries Supabase directly instead of going through the backend.
--
-- Policy: most tables get RLS enabled with NO policies, meaning direct
-- anon/authenticated access is fully denied (service_role still works
-- fine) -- these are tables the backend's own authorization logic
-- already gates, so leaving them closed to any other access path is the
-- safe default. A small set of genuinely public, read-only tables get an
-- explicit SELECT policy so the frontend *could* read them directly for
-- performance if it ever wants to, without needing to go through the API
-- for a plain public listing.

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_size_override_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_co_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contact_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_admin_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_theft_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

-- Public read-only policies (anon + authenticated) for genuinely public,
-- browsable data -- everything else stays fully closed to direct access.

CREATE POLICY "public read" ON public.colleges FOR SELECT USING (true);
CREATE POLICY "public read" ON public.org_groups FOR SELECT USING (true);
CREATE POLICY "public read" ON public.events FOR SELECT USING (visibility = 'public');
CREATE POLICY "public read" ON public.ticket_tiers FOR SELECT USING (true);
CREATE POLICY "public read" ON public.event_banners FOR SELECT USING (status = 'active');
CREATE POLICY "public read" ON public.event_reviews FOR SELECT USING (true);
CREATE POLICY "public read" ON public.event_hypes FOR SELECT USING (true);
