-- ============================================================================
-- Festify — Full Schema Migration (APPLIED to Supabase project vinphlpxsejqyhgofybp)
--
-- Source: D:\claude\initial\festify_full.md
--
-- This file was assembled in two parts:
--
--   PART A — Reconstructed base tables (users, events, ticket_tiers, tickets,
--   orders, org_groups, colleges). §2 of the spec states these were created by
--   an earlier migration (`0001_init_schema.sql`) that does not exist anywhere
--   on disk. These 7 tables have been reconstructed here by inference from
--   every reference to their columns found elsewhere in the document (foreign
--   keys, generated columns, and prose mentions of specific fields). Columns
--   that are directly evidenced by the document are commented as such;
--   everything else is a reasonable inferred column needed to make the
--   dependent schema in Part B work at all. See the accompanying report for
--   the full evidenced-vs-inferred breakdown.
--
--   PART B — §31 "Consolidated SQL Migration", captured verbatim from the
--   document, in the same order and grouping as written there. Every comment
--   banner, blank line grouping, and statement matches §31 exactly.
--
-- NOTE: the four events.* columns (change_request_deadline, poll_close_by,
-- edit_lock_at, sales_close_at) were changed from GENERATED ALWAYS AS (...)
-- STORED to plain columns + a BEFORE INSERT/UPDATE trigger, because
-- `timestamptz - interval` is not immutable and Postgres rejects it as a
-- generated-column expression (error 42P17). Same computed result, valid SQL.
--
-- RLS is NOT enabled on any table yet — every table is currently fully
-- readable/writable by the anon/authenticated Supabase roles. This must be
-- addressed with real policies before any real user traffic touches this DB.
-- ============================================================================


-- ============================================================================
-- PART A: Reconstructed base tables (not present in the source document —
-- inferred from FK references and prose throughout the spec)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- colleges
-- Evidenced: referenced everywhere as `colleges(id)` (organizer_applications,
-- college_admins, users.college_id, org_groups.college_id, events.college_id).
-- No other column on `colleges` itself is explicitly named anywhere in the
-- document. `name` and `domain` below are inferred — `domain` specifically to
-- support the college-email OTP verification flow described in §23, which
-- requires matching a user's email against a known college domain.
-- ----------------------------------------------------------------------------
CREATE TABLE colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                 -- inferred
  domain text,                        -- inferred (used to validate college email in §23)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- users
-- Evidenced directly: `college_id` and `college_verified_at` are explicitly
-- listed in §27's Full Data Model Index as extensions to the base `users`
-- table ("extended here with customer_level, lifetime_spend,
-- lifetime_events_attended, college_id, college_verified_at"), and are used
-- throughout (§9.3, §12, §23, §26.1: "sets `college_verified_at`"). Note this
-- is a genuine inconsistency in the source document: §31's own
-- `ALTER TABLE users` only adds customer_level/lifetime_spend/
-- lifetime_events_attended, NOT college_id/college_verified_at — so those two
-- columns are placed directly on the reconstructed base table here instead,
-- since every other part of the document assumes they already exist.
-- `id` is evidenced everywhere via `users(id)` foreign keys.
-- email/full_name/avatar_url/phone/google_id are inferred — necessary for a
-- Google-OAuth-based identity system (§1, §26.1) but never named explicitly.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,         -- inferred
  full_name text,                     -- inferred
  avatar_url text,                    -- inferred
  phone text,                         -- inferred
  google_id text UNIQUE,              -- inferred (Google OAuth identity, §1/§26.1)
  college_id uuid REFERENCES colleges(id),        -- evidenced (§27, §9.3, §12, §13)
  college_verified_at timestamptz,                -- evidenced (§27, §9.3, §26.1)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- org_groups
-- Evidenced: `id` via `org_groups(id)` everywhere. The distinction between
-- "college-committee-organized events" and "private-organizer events...
-- including private organizations that happen to operate at a specific
-- college" (§19), plus college admins managing "organizations from their own
-- college only... does not extend to private/non-college-affiliated
-- organizations" (§4, §13 RLS), together imply org_groups needs both a
-- nullable college affiliation and a way to distinguish an official college
-- committee from a private org — but no literal `org_groups.college_id` or
-- `org_groups.is_college_committee` column name ever appears in the text, so
-- both are inferred. `name` is inferred (obviously necessary, never named).
-- ----------------------------------------------------------------------------
CREATE TABLE org_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                             -- inferred
  college_id uuid REFERENCES colleges(id),        -- inferred (§4, §13, §19)
  is_college_committee boolean NOT NULL DEFAULT false,  -- inferred (§19 flat-access distinction)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- events
-- Evidenced directly: `starts_at` (used in §6.2's GENERATED ALWAYS AS columns
-- — change_request_deadline, poll_close_by, edit_lock_at, sales_close_at, all
-- computed as `starts_at - interval ...`). `college_id` is evidenced directly
-- via §9.5: "routes using the exact same college-affiliation rule used
-- everywhere else in this document (`college_id` present on the event →
-- routes to college admin; otherwise → routes to super admin)".
-- org_group_id/title/description/venue/ends_at/status/visibility are all
-- inferred — necessary for the event lifecycle (§6.1's Draft → ... →
-- Completed / Postponed / Cancelled state machine) and visibility rules
-- (§26.2) but never given literal column names in the document.
-- ----------------------------------------------------------------------------
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),    -- inferred (the organizing group)
  college_id uuid REFERENCES colleges(id),        -- evidenced (§9.5)
  title text NOT NULL,                            -- inferred
  description text,                               -- inferred
  venue text,                                     -- inferred (§6.3 venue-clash detection)
  starts_at timestamptz NOT NULL,                 -- evidenced (§6.2 generated columns)
  ends_at timestamptz,                             -- inferred
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft','pending','live','early_access','on_sale',
      'sold_out','ongoing','completed','postponed','cancelled'
    )),                                            -- inferred (§6.1 state machine)
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','college_only','private')), -- inferred (§26.2)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- ticket_tiers
-- Evidenced: `id` via `ticket_tiers(id)` everywhere. `pool_capacity` is
-- evidenced by §9.5's formula: "COALESCE(max_team_size_override,
-- floor(pool_capacity * default_pct))" — a ticket_tiers-scoped capacity value
-- referenced by exact name. `is_college_only` is evidenced conceptually by
-- §9.3: "the ticket's tier (is it flagged college-only?)" — strongly implies
-- a boolean flag on the tier, though the exact column name is not given.
-- event_id/name/price are inferred (obviously necessary per §7.1's "Each
-- event can define multiple ticket tiers... each with its own name, price,
-- and quantity", but no literal column names given).
-- ----------------------------------------------------------------------------
CREATE TABLE ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),            -- inferred
  name text NOT NULL,                             -- inferred (§7.1: "its own name, price, and quantity")
  price numeric NOT NULL DEFAULT 0,                -- inferred (§7.1)
  pool_capacity int NOT NULL DEFAULT 0,            -- evidenced (§9.5 formula names it directly)
  is_college_only boolean NOT NULL DEFAULT false,  -- evidenced conceptually (§9.3)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- orders
-- Evidenced: `id` via later `orders.captain_ticket_id` ALTER (§9.4/§31) and
-- via prose ("one row in `orders`" — §30.1). No individual order column is
-- ever named explicitly in the document (event_id, buyer_id, quantity,
-- total_amount, razorpay_order_id, status are all inferred — necessary to
-- represent "a buyer purchasing N tickets in one order" as described
-- throughout §9 and §30.1/§30.3, and to carry the Razorpay order reference
-- described in §8.2/§26.4, but never given literal column names).
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),            -- inferred
  buyer_id uuid REFERENCES users(id),              -- inferred
  quantity int NOT NULL DEFAULT 1,                 -- inferred
  total_amount numeric,                            -- inferred
  razorpay_order_id text,                          -- inferred (§8.2, §26.4)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')), -- inferred
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- tickets
-- Evidenced directly: `event_id` is evidenced via §17.3's QR payload
-- definition ("The QR encodes: `ticket_id`, `event_id` ..."), which names
-- `event_id` as a field belonging to the ticket record itself. `verify_code`
-- is evidenced directly and extensively (§17.2, §17.3, §14, §30.4 — "the QR
-- code and its associated `verify_code` are generated a single time, at the
-- moment payment is captured"). `policy_snapshot` is evidenced directly
-- (§8.5: "The policy is snapshotted onto the specific ticket... `a JSON blob
-- capturing the three tiers`", named explicitly in §30.3 as `policy_snapshot`).
-- ticket_tier_id/order_id/owner_id/price_paid/status are inferred — necessary
-- to represent tier membership, order membership, current holder (required
-- by the transfer/captain mechanics in §9.4), and the Reserved/Issued/
-- Scanned/Expired lifecycle (§16.1), but never given literal column names
-- (§16.1 notes Reserved itself is a Redis key, never a DB row, so the DB
-- status enum only needs issued/scanned/expired).
-- ----------------------------------------------------------------------------
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),             -- evidenced (§17.3 QR payload)
  ticket_tier_id uuid REFERENCES ticket_tiers(id),  -- inferred
  order_id uuid REFERENCES orders(id),              -- inferred
  owner_id uuid REFERENCES users(id),               -- inferred (current holder; §9.4 captain mechanic needs this)
  verify_code text,                                 -- evidenced (§17.2, §17.3, §14)
  price_paid numeric,                               -- inferred
  policy_snapshot jsonb,                            -- evidenced (§8.5, §30.3)
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','scanned','expired')), -- inferred (§16.1: Reserved is Redis-only, never a DB row)
  created_at timestamptz DEFAULT now()
);


-- ============================================================================
-- PART B: §31 "Consolidated SQL Migration" — captured verbatim from the
-- source document (D:\claude\initial\festify_full.md, lines ~1337-1678).
-- Comment banners and grouping below match §31 exactly as written.
-- ============================================================================

-- ============================================================
-- PART 1: Extend base tables with columns introduced in this document
-- ============================================================

ALTER TABLE users
  ADD COLUMN customer_level text DEFAULT 'bronze'
    CHECK (customer_level IN ('bronze','silver','gold','platinum','prime')),
  ADD COLUMN lifetime_spend numeric DEFAULT 0,
  ADD COLUMN lifetime_events_attended int DEFAULT 0;

ALTER TABLE events
  ADD COLUMN change_request_deadline timestamptz,
  ADD COLUMN poll_close_by timestamptz,
  ADD COLUMN edit_lock_at timestamptz,
  ADD COLUMN sales_close_at timestamptz,
  ADD COLUMN offline_mode_enabled boolean DEFAULT true,
  ADD COLUMN youtube_video_id text,
  ADD COLUMN youtube_valid boolean DEFAULT null,
  ADD COLUMN ai_prompt_custom text;

CREATE OR REPLACE FUNCTION set_events_derived_timestamps()
RETURNS trigger AS $$
BEGIN
  NEW.change_request_deadline := NEW.starts_at - interval '4 days';
  NEW.poll_close_by := NEW.starts_at - interval '2 days';
  NEW.edit_lock_at := NEW.starts_at - interval '48 hours';
  NEW.sales_close_at := NEW.starts_at - interval '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_derived_timestamps
  BEFORE INSERT OR UPDATE OF starts_at ON events
  FOR EACH ROW EXECUTE FUNCTION set_events_derived_timestamps();

ALTER TABLE ticket_tiers
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_pct numeric,
  ADD COLUMN bulk_discount_threshold int,
  ADD COLUMN bulk_discount_pct numeric,
  ADD COLUMN assignment_mode text NOT NULL DEFAULT 'flexible'
    CHECK (assignment_mode IN ('flexible','locked_roster')),
  ADD COLUMN min_team_size int NOT NULL DEFAULT 1 CHECK (min_team_size >= 1),
  ADD COLUMN max_team_size_override int,
  ADD COLUMN valid_days int NOT NULL DEFAULT 1;

ALTER TABLE orders
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN team_name text,
  ADD COLUMN captain_ticket_id uuid REFERENCES tickets(id);

ALTER TABLE org_groups
  ADD COLUMN trust_tier text DEFAULT 'new' CHECK (trust_tier IN ('new','verified','trusted')),
  ADD COLUMN successful_event_count int DEFAULT 0,
  ADD COLUMN recent_failed_event_count int DEFAULT 0,
  ADD COLUMN score int DEFAULT 0;

-- ============================================================
-- PART 2: Event lifecycle & change-request polling (§6)
-- ============================================================

CREATE TABLE event_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  question text,
  closes_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE event_poll_votes (
  poll_id uuid REFERENCES event_polls(id),
  user_id uuid REFERENCES users(id),
  vote boolean,
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE event_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  poll_id uuid REFERENCES event_polls(id),
  change_details text,
  status text DEFAULT 'pending_super_admin'
    CHECK (status IN ('pending_super_admin','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 3: User-to-user — friend groups, sharing, team events (§9)
-- ============================================================

CREATE TABLE user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id),
  name text,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES user_groups(id),
  user_id uuid REFERENCES users(id),
  status text CHECK (status IN ('invited','accepted','left')),
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (group_id, user_id)
);

CREATE TABLE ticket_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id),
  group_id uuid REFERENCES user_groups(id),
  recipient_id uuid REFERENCES users(id),
  status text CHECK (status IN ('pending','accepted','skipped_ineligible','expired')),
  skip_reason text,
  respond_by timestamptz,
  assigned_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

CREATE TABLE team_size_override_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tier_id uuid REFERENCES ticket_tiers(id),
  organizer_id uuid REFERENCES users(id),
  requested_max int NOT NULL CHECK (requested_max > 0),
  routed_to text CHECK (routed_to IN ('college_admin','super_admin')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  granted_max int,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 4: Org-to-org — co-hosting, internal roles (§10)
-- ============================================================

CREATE TABLE event_co_hosts (
  event_id uuid REFERENCES events(id),
  org_group_id uuid REFERENCES org_groups(id),
  is_billing_org boolean DEFAULT false,
  display_split_pct numeric,
  PRIMARY KEY (event_id, org_group_id)
);

CREATE TABLE org_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  user_id uuid REFERENCES users(id),
  role text CHECK (role IN ('leader','manager','ticket_checker')),
  permissions jsonb DEFAULT '{}',
  granted_by uuid REFERENCES users(id)
);

-- ============================================================
-- PART 5: User-to-organizer — hype, reviews, feedback, blocking (§11)
-- ============================================================

CREATE TABLE event_hypes (
  event_id uuid REFERENCES events(id),
  user_id uuid REFERENCES users(id),
  weight numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  user_id uuid REFERENCES users(id),
  ticket_id uuid REFERENCES tickets(id),
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  weight numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE org_feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  org_group_id uuid REFERENCES org_groups(id),
  prime_user_id uuid REFERENCES users(id),
  message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE org_contact_blocks (
  user_id uuid REFERENCES users(id),
  org_group_id uuid REFERENCES org_groups(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, org_group_id)
);

-- ============================================================
-- PART 6: Organizer-to-admin — applications, trust, bans (§12)
-- ============================================================

CREATE TABLE organizer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES users(id),
  college_id uuid REFERENCES colleges(id),
  routed_to text CHECK (routed_to IN ('college_admin','super_admin')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX one_pending_application_per_user
  ON organizer_applications (applicant_id) WHERE status = 'pending';

CREATE TABLE org_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  stage text CHECK (stage IN ('warning','7d','30d','long')),
  reason text,
  issued_by uuid REFERENCES users(id),
  ends_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE org_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  flagged_by uuid REFERENCES users(id),
  reason text,
  status text DEFAULT 'open' CHECK (status IN ('open','reviewed')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 7: Admin-to-admin — college admin accounts (§13)
-- ============================================================

CREATE TABLE college_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  college_id uuid REFERENCES colleges(id),
  added_by uuid REFERENCES users(id),
  status text DEFAULT 'active' CHECK (status IN ('active','flagged','removed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE college_admin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_admin_id uuid REFERENCES college_admins(id),
  flagged_by uuid REFERENCES users(id),
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE admin_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_admin_id uuid REFERENCES college_admins(id),
  subject text,
  details text,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 8: Admin-to-everyone — theft, support, audit (§14)
-- ============================================================

CREATE TABLE ticket_theft_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id),
  reported_by uuid REFERENCES users(id),
  report_number int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by uuid REFERENCES users(id),
  category text CHECK (category IN ('theft_escalation','event_report','other')),
  related_id uuid,
  routed_to text CHECK (routed_to IN ('college_admin','super_admin')),
  status text DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action_type text,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 9: Ticket lifecycle — multi-day scans (§16)
-- ============================================================

CREATE TABLE ticket_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id),
  day_number int NOT NULL,
  scanned_at timestamptz NOT NULL,
  device_id text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (ticket_id, day_number)
);

-- ============================================================
-- PART 10: Standard bulk purchase (§18)
-- ============================================================

CREATE TABLE bulk_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  buyer_id uuid REFERENCES users(id),
  requested_qty int NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  last_reminder_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX one_pending_bulk_request_per_buyer
  ON bulk_purchase_requests (buyer_id, event_id) WHERE status = 'pending';

-- ============================================================
-- PART 11: Gamification scoring ledger (§21)
-- ============================================================

CREATE TABLE score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  event_id uuid REFERENCES events(id),
  points int,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 12: Media — event banners (§24)
-- ============================================================

CREATE TABLE event_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  storage_path text NOT NULL,
  banner_type text NOT NULL CHECK (banner_type IN ('main','ticket','event_page','ad')),
  uploaded_by uuid REFERENCES users(id),
  status text DEFAULT 'active' CHECK (status IN ('active','removed')),
  source text DEFAULT 'uploaded' CHECK (source IN ('uploaded','ai_generated')),
  file_size_kb int,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT one_banner_per_type_per_event UNIQUE (event_id, banner_type)
);

-- ============================================================================
-- NOTE: §31 in the source document does not include a CREATE TABLE for
-- `scoring_config`, even though it is referenced constantly throughout the
-- document (§8.4, §9.5, §12, §21, §24.1, and the entire "scoring_config
-- Reference" appendix) as the general-purpose super-admin-tunable settings
-- table. Per the task instructions, this migration captures §31 exactly as
-- written and does not add statements beyond what's there — but this is
-- flagged explicitly here (and in the final report) as a table the document
-- clearly assumes exists yet never actually defines with a CREATE TABLE
-- anywhere in the document, including §31 itself.
-- ============================================================================

-- ============================================================================
-- End of migration.
-- ============================================================================
