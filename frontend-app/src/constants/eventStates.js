// constants/eventStates.js
export const EVENT_STATES = {
  DRAFT:         'draft',
  PENDING:       'pending',
  LIVE:          'live',
  EARLY_ACCESS:  'early_access',
  ON_SALE:       'on_sale',
  SOLD_OUT:      'sold_out',
  ONGOING:       'ongoing',
  COMPLETED:     'completed',
  POSTPONED:     'postponed',
  CANCELLED:     'cancelled',
};

export const EVENT_STATE_LABELS = {
  draft:        'Draft',
  pending:      'Pending Approval',
  live:         'Live',
  early_access: 'Early Access',
  on_sale:      'On Sale',
  sold_out:     'Sold Out',
  ongoing:      'Ongoing',
  completed:    'Completed',
  postponed:    'Postponed',
  cancelled:    'Cancelled',
};

export const EVENT_STATE_COLORS = {
  draft:        'var(--state-draft)',
  pending:      'var(--state-pending)',
  live:         'var(--state-live)',
  early_access: 'var(--state-early-access)',
  on_sale:      'var(--state-on-sale)',
  sold_out:     'var(--state-sold-out)',
  ongoing:      'var(--state-ongoing)',
  completed:    'var(--state-completed)',
  postponed:    'var(--state-postponed)',
  cancelled:    'var(--state-cancelled)',
};

// States where tickets can be purchased
export const PURCHASABLE_STATES = [
  EVENT_STATES.LIVE,
  EVENT_STATES.EARLY_ACCESS,
  EVENT_STATES.ON_SALE,
];

// States where the event is visible to guests
export const PUBLIC_VISIBLE_STATES = [
  EVENT_STATES.LIVE,
  EVENT_STATES.EARLY_ACCESS,
  EVENT_STATES.ON_SALE,
  EVENT_STATES.SOLD_OUT,
  EVENT_STATES.ONGOING,
  EVENT_STATES.COMPLETED,
  EVENT_STATES.POSTPONED,
  EVENT_STATES.CANCELLED,
];

// constants/roles.js
export const CUSTOMER_LEVELS = {
  BRONZE:   'bronze',
  SILVER:   'silver',
  GOLD:     'gold',
  PLATINUM: 'platinum',
  PRIME:    'prime',
};

export const LEVEL_LABELS = {
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
  prime:    'Prime',
};

export const LEVEL_COLORS = {
  bronze:   'var(--level-bronze)',
  silver:   'var(--level-silver)',
  gold:     'var(--level-gold)',
  platinum: 'var(--level-platinum)',
  prime:    'var(--level-prime)',
};

export const ORG_TRUST_TIERS = {
  NEW:      'new',
  VERIFIED: 'verified',
  TRUSTED:  'trusted',
};

export const TICKET_STATUSES = {
  VALID:           'valid',
  USED:            'used',
  EXPIRED:         'expired',
  CANCELLED:       'cancelled',
  THEFT_REPORTED:  'theft_reported',
};

export const TICKET_TIER_TYPES = {
  VIP:          'vip',
  GENERAL:      'general',
  EARLY_BIRD:   'early_bird',
  COLLEGE_ONLY: 'college_only',
};
