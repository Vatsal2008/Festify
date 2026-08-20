-- Prime Pass subscriptions, and organizer control over the gate.
--
-- Prime Pass existed only as UI copy and a badge: there was no table, no
-- purchase path, and /auth/me never returned has_prime_pass, so the
-- benefit could never actually be held by anyone.
--
-- The gate columns let an organizer decide *when* attendees can see
-- their QR code. Revealing on purchase gives people hours or days to
-- screenshot and forward a ticket; revealing at the door shrinks that
-- window to the length of the queue.

CREATE TABLE IF NOT EXISTS prime_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  amount integer NOT NULL,
  starts_at timestamptz,
  expires_at timestamptz,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz DEFAULT now()
);

-- The active-pass lookup runs on every profile load and on every
-- early-access check, so it gets an index rather than a scan.
CREATE INDEX IF NOT EXISTS idx_prime_passes_user_status
  ON prime_passes (user_id, status);

-- A person may hold only one live pass at a time. Renewals supersede
-- rather than stack, so this is a partial unique index on the active
-- rows only -- expired and cancelled history stays queryable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prime_passes_one_active
  ON prime_passes (user_id) WHERE status = 'active';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS qr_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_opened_at timestamptz;

COMMENT ON COLUMN events.qr_revealed_at IS
  'When the organizer released QR codes to ticket holders. NULL means holders see a placeholder instead of a scannable code.';
COMMENT ON COLUMN events.gate_opened_at IS
  'When the organizer started admitting attendees. Scans are rejected before this is set.';

ALTER TABLE prime_passes ENABLE ROW LEVEL SECURITY;
