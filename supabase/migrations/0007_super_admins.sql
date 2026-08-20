-- §4 describes Super Admin as separate auth outside the users table.
-- That system doesn't exist, and the interim env-var allowlist
-- (SUPER_ADMIN_EMAILS) can't be changed at runtime, so a super admin had
-- no way to promote anyone else. This makes the grant a real record.
--
-- The env var is kept as a bootstrap: it must still work even when this
-- table is empty, otherwise a fresh deploy has no way in.
CREATE TABLE super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  granted_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
