-- Simulates what Razorpay Route would actually transfer to each organizer
-- once it's approved. Computed the same way a real transfer would be
-- (gross minus flat platform fee per §8.4), just recorded here instead of
-- moved by Razorpay. Converting to real transfers later is a small
-- addition (call Route's transfer API with these same numbers), not a
-- redesign.
CREATE TABLE org_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  order_id uuid REFERENCES orders(id),
  gross_amount numeric NOT NULL,
  platform_fee numeric NOT NULL,
  net_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated', 'transferred')),
  created_at timestamptz DEFAULT now()
);
