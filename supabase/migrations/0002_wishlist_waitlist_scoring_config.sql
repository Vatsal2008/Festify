-- Three tables the spec references constantly but never actually defines
-- with a CREATE TABLE anywhere in the document (flagged during schema
-- reconstruction): scoring_config (§8.4/§9.5/§12/§21/§24.1), a
-- wishlist/follow mechanism (§22), and a waitlist (§25, described as
-- "the shared destination every fallback points to").

CREATE TABLE scoring_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE event_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  event_id uuid REFERENCES events(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE org_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  org_group_id uuid REFERENCES org_groups(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, org_group_id)
);

CREATE TABLE event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  ticket_tier_id uuid REFERENCES ticket_tiers(id),
  user_id uuid REFERENCES users(id),
  quantity_requested int NOT NULL DEFAULT 1 CHECK (quantity_requested > 0),
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','notified','converted','expired')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (ticket_tier_id, user_id)
);
