-- The frontend filters and browses by category across every discovery
-- surface (home category chips, search filters, category cover art), but
-- the source spec never defined a category column. Same for capacity,
-- which the event detail page shows and the bulk-purchase limit reads.
ALTER TABLE events
  ADD COLUMN category text NOT NULL DEFAULT 'Cultural'
    CHECK (category IN (
      'Hackathon','Cultural','Music','Sports',
      'Talk','Workshop','Party','Comedy','Theatre'
    )),
  ADD COLUMN capacity int,
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT true;
