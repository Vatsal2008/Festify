# Festify — Complete Frontend Implementation Plan
### Production-Ready Architecture for Any AI Coding Agent
**Version:** 1.0 | **Stack:** React (Vite) on Vercel | **Theme:** Elicit Design System (deep teal + chartreuse)

> **READ THIS FIRST** — This document is the single source of truth for the Festify frontend. It is derived from `fullsystem.md` (system design, roles, business rules) and `Frontend/theme.md` (Elicit design system — visual language, tokens, components). Every decision herein honors both sources. Do not deviate without reconciling both documents.

---

## Table of Contents
1. [Design System & Tokens](#1-design-system--tokens)
2. [Folder Structure & Architecture](#2-folder-structure--architecture)
3. [Authentication & Role Architecture](#3-authentication--role-architecture)
4. [Routing Map](#4-routing-map)
5. [Component Library](#5-component-library)
6. [Page-by-Page Implementation](#6-page-by-page-implementation)
7. [State Management & Data Flow](#7-state-management--data-flow)
8. [API Integration Contracts](#8-api-integration-contracts)
9. [Responsive & Accessibility Requirements](#9-responsive--accessibility-requirements)
10. [Performance & SEO](#10-performance--seo)
11. [Animations & Micro-interactions](#11-animations--micro-interactions)
12. [Security Considerations](#12-security-considerations)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment & Maintainability](#14-deployment--maintainability)

---

## 1. Design System & Tokens

### 1.1 Origin
The visual language is the **Elicit design system** as documented in `Frontend/theme.md`. It reads as a scholarly journal, not startup marketing. Every color, typeface, radius, spacing, and component rule in this section is extracted directly from that file. Deviations are explicitly marked `[FESTIFY EXTENSION]`.

### 1.2 Color Tokens

```css
/* tokens/colors.css — single source of truth for all color usage */
:root {
  /* Structural */
  --color-ink:           #083d44;   /* primary text, bg on dark bands, hairline borders */
  --color-ink-deep:      #09272b;   /* depth stop for dark section backgrounds */
  --color-canvas:        #fcfcf8;   /* parchment-tinted off-white base surface */
  --color-surface-sage:  #f3f6e4;   /* warm sage for differentiated card surfaces */
  --color-surface-cool:  #e8eced;   /* cool-gray for alternate card fills */
  --color-primary:       #026370;   /* mid-range teal — gradients, secondary surfaces */
  --color-accent:        #e5ff97;   /* chartreuse — ONE primary CTA per section only */
  --color-link-blue:     #0000ee;   /* browser-default hyperlink — never overridden */
  --color-hairline:      #000000;   /* 1px card borders on off-white canvas */
  --color-hairline-light:#083d44;   /* 1px card borders on teal dark bands */

  /* [FESTIFY EXTENSION] Status / Semantic colors */
  --color-success:       #22c55e;   /* ticket valid, payment success */
  --color-warning:       #f59e0b;   /* event postponed, capacity filling */
  --color-error:         #ef4444;   /* form errors, ticket theft alerts */
  --color-info:          #3b82f6;   /* general informational toasts */

  /* [FESTIFY EXTENSION] Event State Badge colors */
  --state-draft:         #6b7280;   /* gray */
  --state-pending:       #f59e0b;   /* amber */
  --state-live:          #22c55e;   /* green */
  --state-early-access:  #e5ff97;   /* chartreuse */
  --state-on-sale:       #083d44;   /* teal ink */
  --state-sold-out:      #ef4444;   /* red */
  --state-ongoing:       #8b5cf6;   /* purple */
  --state-completed:     #083d44;   /* teal */
  --state-postponed:     #f59e0b;   /* amber */
  --state-cancelled:     #ef4444;   /* red */

  /* [FESTIFY EXTENSION] Customer Level colors */
  --level-bronze:        #cd7f32;
  --level-silver:        #c0c0c0;
  --level-gold:          #ffd700;
  --level-platinum:      #e5e4e2;
  --level-prime:         #e5ff97;   /* chartreuse — most prestigious, uses accent */
}
```

### 1.3 Typography Tokens

```css
/* tokens/typography.css */

/* Font imports — Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400&family=Barlow+Condensed:wght@400&family=DM+Mono:wght@500&family=Inter:wght@600&display=swap');

/*
  FONT STRATEGY:
  - Martina Plantijn → substitute: EB Garamond (Google Fonts, old-style serif proportions)
  - Special Gothic Variable → substitute: Barlow Condensed weight 400
  - DM Mono → DM Mono weight 500 (available on Google Fonts)
  - Inter → Inter weight 600 (button labels only)
*/

:root {
  /* Display tier — EB Garamond (Martina Plantijn substitute) */
  --font-display:       'EB Garamond', Georgia, serif;

  /* Body tier — Barlow Condensed (Special Gothic Variable substitute) */
  --font-body:          'Barlow Condensed', system-ui, sans-serif;

  /* Label/Mono tier — DM Mono */
  --font-mono:          'DM Mono', 'Courier New', monospace;

  /* Button label only — Inter */
  --font-ui:            'Inter', system-ui, sans-serif;

  /* Type scale */
  --text-display-xl:    64px;   /* hero h1 */
  --text-display-lg:    48px;   /* section headlines */
  --text-display-md:    32px;   /* sub-section h3 */
  --text-heading-lg:    27.2px; /* card heading h3 */
  --text-heading-md:    20.8px; /* compact card heading */
  --text-body-lg:       20px;   /* hero sub-paragraph */
  --text-body-md:       17.6px; /* default running text */
  --text-body-sm:       16px;   /* compact prose */
  --text-body-xs:       15.2px; /* caption */
  --text-label-mono:    14.4px; /* section labels, timestamps (UPPERCASE) */

  /* Line heights */
  --lh-display-xl:   76.8px;
  --lh-display-lg:   64.8px;
  --lh-display-md:   42.24px;
  --lh-heading-lg:   34px;
  --lh-heading-md:   29.12px;
  --lh-body-lg:      29px;
  --lh-body-md:      26.4px;
  --lh-body-sm:      24px;
  --lh-body-xs:      21.28px;
  --lh-label-mono:   18.72px;

  /* Letter spacing */
  --ls-display-xl:   -1.28px;
  --ls-display-lg:   -0.24px;
  --ls-body-md:      0.25px;
  --ls-label-mono:   0.72px;
}

/* Semantic type classes */
.type-display-xl {
  font-family: var(--font-display);
  font-size: var(--text-display-xl);
  line-height: var(--lh-display-xl);
  letter-spacing: var(--ls-display-xl);
  font-weight: 400;
}
.type-display-lg {
  font-family: var(--font-display);
  font-size: var(--text-display-lg);
  line-height: var(--lh-display-lg);
  letter-spacing: var(--ls-display-lg);
  font-weight: 400;
}
.type-display-md {
  font-family: var(--font-display);
  font-size: var(--text-display-md);
  line-height: var(--lh-display-md);
  font-weight: 400;
}
.type-heading-lg {
  font-family: var(--font-body);
  font-size: var(--text-heading-lg);
  line-height: var(--lh-heading-lg);
  font-weight: 400;
  letter-spacing: 0.1px;
}
.type-body-md {
  font-family: var(--font-body);
  font-size: var(--text-body-md);
  line-height: var(--lh-body-md);
  font-weight: 400;
  letter-spacing: var(--ls-body-md);
}
.type-label-mono {
  font-family: var(--font-mono);
  font-size: var(--text-label-mono);
  line-height: var(--lh-label-mono);
  font-weight: 500;
  letter-spacing: var(--ls-label-mono);
  text-transform: uppercase;
}
.type-ui-button {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
```

### 1.4 Spacing & Radius Tokens

```css
:root {
  /* Spacing */
  --space-xs:    4px;
  --space-sm:    6px;
  --space-md:    8px;
  --space-base:  10px;   /* base spacing unit — 10px */
  --space-lg:    16px;
  --space-xl:    24px;
  --space-2xl:   32px;
  --space-3xl:   48px;
  --space-4xl:   64px;   /* [FESTIFY EXTENSION] */
  --space-5xl:   80px;   /* [FESTIFY EXTENSION] */
  --space-6xl:   120px;  /* [FESTIFY EXTENSION] */

  /* Border radius */
  --radius-none: 0px;    /* primary CTA button — squared, anti-consumer-UI */
  --radius-sm:   6px;
  --radius-md:   8px;    /* search inputs, form inputs */
  --radius-lg:   12px;   /* cards */
  --radius-xl:   16px;   /* larger surface cards */
  --radius-2xl:  20px;   /* featured highlight cards */
  --radius-pill: 100px;  /* category filter tags */

  /* Elevation — NO SHADOWS. Separation via hairline borders + surface-color shifts */
  --border-hairline: 1px solid var(--color-hairline);
  --border-hairline-teal: 1px solid var(--color-hairline-light);
  --border-hairline-accent: 1px solid var(--color-accent); /* [FESTIFY EXTENSION] */

  /* Layout */
  --max-width:        1200px;
  --nav-height:       48px;
  --sidebar-width:    260px;
  --content-padding:  var(--space-2xl);  /* 32px horizontal padding */
}
```

### 1.5 Design Principles (From theme.md — Non-Negotiable)

1. **Binary surface system**: either `--color-canvas` (off-white parchment) or `--color-ink` (deep teal). No mid-range grays.
2. **Chartreuse scarcity**: `--color-accent` used for exactly ONE primary interactive moment per section. Never as a decorative fill.
3. **Zero shadow tier**: all card separation via `1px` hairline borders and surface-color switching.
4. **Primary CTA button = `border-radius: 0`**: squared corners signal archival precision, never rounded.
5. **Typeface stratification is sacred**: EB Garamond → display only (32px+). Barlow Condensed → body. DM Mono → labels/timestamps in UPPERCASE.
6. **Section-alternation rhythm**: off-white band → teal dark band → off-white → teal dark. Chapter-break structure.
7. **Inline hyperlinks**: retain `--color-link-blue` (#0000ee). Never override to brand colors.

---

## 2. Folder Structure & Architecture

```
festify-frontend/
├── public/
│   ├── favicon.svg
│   ├── manifest.json
│   └── robots.txt
│
├── src/
│   ├── main.jsx                  # Vite entry
│   ├── App.jsx                   # Router + auth context providers
│   │
│   ├── tokens/                   # Design system tokens
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── spacing.css
│   │   └── index.css             # Imports all tokens + base resets
│   │
│   ├── components/               # Reusable UI primitives (design system layer)
│   │   ├── primitives/
│   │   │   ├── Button.jsx          # Primary / Secondary / Ghost / Danger variants
│   │   │   ├── Card.jsx            # card / card-teal / card-sage variants
│   │   │   ├── Badge.jsx           # Event state, customer level, role badges
│   │   │   ├── Input.jsx           # Text input, search input, textarea
│   │   │   ├── Select.jsx          # Dropdown select
│   │   │   ├── Modal.jsx           # Base modal with overlay
│   │   │   ├── Toast.jsx           # Notification toast (success/error/warning/info)
│   │   │   ├── Spinner.jsx         # Loading indicator
│   │   │   ├── Skeleton.jsx        # Content skeleton loader
│   │   │   ├── Tag.jsx             # Pill-radius category/filter tags
│   │   │   ├── Avatar.jsx          # User avatar with level ring
│   │   │   ├── ProgressBar.jsx     # Customer level progress
│   │   │   ├── StarRating.jsx      # 1-5 star rating input + display
│   │   │   ├── Table.jsx           # Sortable data table
│   │   │   └── Divider.jsx         # Horizontal rule (hairline)
│   │   │
│   │   ├── navigation/
│   │   │   ├── TopNav.jsx          # Public nav — deep teal bg, canvas text
│   │   │   ├── DashboardSidebar.jsx# Organizer / Admin sidebars
│   │   │   ├── BottomTabBar.jsx    # Mobile-only bottom tab bar
│   │   │   └── Breadcrumb.jsx      # Dashboard breadcrumbs
│   │   │
│   │   ├── layout/
│   │   │   ├── PageShell.jsx       # Public page wrapper (nav + content)
│   │   │   ├── DashboardShell.jsx  # Sidebar + main content layout
│   │   │   ├── TealBand.jsx        # Full-bleed teal section wrapper
│   │   │   ├── CanvasBand.jsx      # Off-white section wrapper
│   │   │   └── SectionContainer.jsx# Max-width centered content column
│   │   │
│   │   └── domain/               # Domain-specific composite components
│   │       ├── EventCard.jsx       # Event listing card
│   │       ├── EventHero.jsx       # Event detail hero section
│   │       ├── TicketCard.jsx      # Ticket in wallet
│   │       ├── QRDisplay.jsx       # QR code display with anti-screenshot overlay
│   │       ├── OrganizerCard.jsx   # Organizer profile mini-card
│   │       ├── ReviewCard.jsx      # Review + rating display
│   │       ├── ReviewForm.jsx      # Write a review (post-event)
│   │       ├── HypeButton.jsx      # Hype toggle with count
│   │       ├── WishlistButton.jsx  # Wishlist toggle
│   │       ├── LevelBadge.jsx      # Bronze/Silver/Gold/Platinum/Prime badge
│   │       ├── PrimeBadge.jsx      # Prime symbol badge (earned)
│   │       ├── PrimePassBadge.jsx  # Prime Pass symbol badge (paid)
│   │       ├── TicketTierCard.jsx  # Ticket tier selection card
│   │       ├── EventStateChip.jsx  # Live/Draft/Sold Out state chip
│   │       ├── NotificationItem.jsx# In-app notification list item
│   │       ├── BulkRequestRow.jsx  # Organizer bulk request approve/reject row
│   │       ├── SupportTicketRow.jsx# Admin support ticket row
│   │       └── AuditLogRow.jsx     # Super admin audit log row
│   │
│   ├── features/                 # Feature modules (page-level logic)
│   │   ├── discovery/
│   │   │   ├── HomePage.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   ├── TrendingSection.jsx
│   │   │   ├── HypedSection.jsx
│   │   │   ├── FeaturedSection.jsx
│   │   │   └── NearMeSection.jsx
│   │   │
│   │   ├── event-detail/
│   │   │   ├── EventDetailPage.jsx
│   │   │   ├── TicketTierSection.jsx
│   │   │   ├── ReviewsSection.jsx
│   │   │   ├── OrganizerProfileSection.jsx
│   │   │   ├── EarlyAccessBanner.jsx
│   │   │   └── EventMediaGallery.jsx
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── OnboardingPage.jsx
│   │   │   ├── CollegeVerifyPage.jsx
│   │   │   └── OrganizerApplicationPage.jsx
│   │   │
│   │   ├── attendee/
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── TicketWalletPage.jsx
│   │   │   ├── TicketDetailPage.jsx
│   │   │   ├── ResellPage.jsx
│   │   │   ├── GiftPage.jsx
│   │   │   ├── WishlistPage.jsx
│   │   │   ├── FollowingPage.jsx
│   │   │   ├── ReviewsPage.jsx
│   │   │   └── PrimePassPage.jsx
│   │   │
│   │   ├── organizer/
│   │   │   ├── OrgDashboardPage.jsx
│   │   │   ├── OrgEventsPage.jsx
│   │   │   ├── EventBuilderPage.jsx
│   │   │   ├── EventEditPage.jsx
│   │   │   ├── QRScannerPage.jsx
│   │   │   ├── BulkRequestsPage.jsx
│   │   │   ├── FeedbackRequestPage.jsx
│   │   │   ├── OrgMembersPage.jsx
│   │   │   ├── OrgChatPage.jsx
│   │   │   └── AnalyticsExportPage.jsx
│   │   │
│   │   ├── college-admin/
│   │   │   ├── CollegeAdminLoginPage.jsx
│   │   │   ├── CollegeApplicationsPage.jsx
│   │   │   ├── CollegeEventsPage.jsx
│   │   │   └── CollegeCreateEventPage.jsx
│   │   │
│   │   └── super-admin/
│   │       ├── SuperAdminLoginPage.jsx   # Isolated bundle
│   │       ├── SuperDashboardPage.jsx
│   │       ├── SuperOrganizersPage.jsx
│   │       ├── SuperCollegeAdminsPage.jsx
│   │       ├── SuperConfigPage.jsx
│   │       ├── SuperSupportTicketsPage.jsx
│   │       ├── SuperTrendingCurationPage.jsx
│   │       └── SuperAuditLogPage.jsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.js              # Auth context consumer
│   │   ├── useEvents.js            # Events list with React Query
│   │   ├── useEventDetail.js       # Single event detail
│   │   ├── useTickets.js           # User ticket wallet
│   │   ├── useNotifications.js     # In-app notification feed
│   │   ├── useHype.js              # Hype toggle + count
│   │   ├── useWishlist.js          # Wishlist toggle
│   │   ├── useReviews.js           # Reviews for event
│   │   ├── useCustomerLevel.js     # Level + progress
│   │   ├── useOrgDashboard.js      # Org overview data
│   │   ├── useQRScanner.js         # Camera QR scan (mobile bridge)
│   │   └── useToast.js             # Toast notification queue
│   │
│   ├── lib/                      # API client + utilities
│   │   ├── api/
│   │   │   ├── client.js           # Axios instance with interceptors
│   │   │   ├── auth.api.js
│   │   │   ├── events.api.js
│   │   │   ├── tickets.api.js
│   │   │   ├── payments.api.js
│   │   │   ├── notifications.api.js
│   │   │   ├── media.api.js
│   │   │   ├── search.api.js
│   │   │   ├── score.api.js
│   │   │   ├── admin.api.js
│   │   │   └── user.api.js
│   │   │
│   │   ├── auth/
│   │   │   ├── AttendeeAuthContext.jsx
│   │   │   ├── CollegeAdminAuthContext.jsx
│   │   │   └── SuperAdminAuthContext.jsx
│   │   │
│   │   ├── queryClient.js          # React Query config
│   │   ├── razorpay.js             # Razorpay checkout wrapper
│   │   ├── fcm.js                  # Firebase FCM token registration
│   │   └── utils.js                # Date formatting, price formatting, etc.
│   │
│   ├── store/                    # Zustand global stores
│   │   ├── authStore.js
│   │   ├── notificationStore.js
│   │   └── uiStore.js              # Modal state, sidebar state
│   │
│   ├── constants/
│   │   ├── eventStates.js
│   │   ├── roles.js
│   │   ├── routes.js               # Centralized route constants
│   │   └── queryKeys.js            # React Query key factory
│   │
│   └── types/                    # JSDoc type definitions (or TypeScript interfaces)
│       ├── event.types.js
│       ├── ticket.types.js
│       ├── user.types.js
│       └── api.types.js
│
├── index.html
├── vite.config.js
├── package.json
└── .env.example
```

---

## 3. Authentication & Role Architecture

### 3.1 Three Completely Separate Auth Contexts

Festify has **three independent identity systems** — never merged:

```
┌─────────────────────────────────────┐
│  Attendee/Organizer Auth            │
│  Google OAuth only                  │
│  JWT stored in httpOnly cookie      │
│  Context: AttendeeAuthContext       │
│  Roles: guest | user | organizer    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  College Admin Auth                 │
│  Separate credentials (email+pass)  │
│  JWT stored in httpOnly cookie      │
│  Context: CollegeAdminAuthContext   │
│  Route prefix: /college-admin/*     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Super Admin Auth                   │
│  Separate credentials               │
│  Completely isolated route bundle   │
│  Context: SuperAdminAuthContext     │
│  Route prefix: /superadmin/*        │
│  NOT linked to public app shell     │
└─────────────────────────────────────┘
```

### 3.2 Auth State Shape

```js
// AttendeeAuthContext — state shape
{
  user: {
    id: string,
    name: string,
    email: string,
    avatar_url: string,
    college_id: string | null,
    college_verified: boolean,
    customer_level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'prime',
    is_prime: boolean,
    prime_since: string | null,
    has_prime_pass: boolean,
    prime_pass_expires_at: string | null,
    org_memberships: [{ org_id, org_name, role: 'owner' | 'member' }]
  },
  isAuthenticated: boolean,
  isLoading: boolean,
  login: () => void,     // triggers Google OAuth redirect
  logout: () => void,
  refreshUser: () => void
}
```

### 3.3 Route Guards

```jsx
// Three guard components — never shared:
<GuestRoute />           // Redirect to /login if authenticated
<AttendeeRoute />        // Redirect to /login if not authenticated
<OrganizerRoute />       // Redirect if no org membership for :orgId
<CollegeAdminRoute />    // Isolated — uses CollegeAdminAuthContext
<SuperAdminRoute />      // Isolated — uses SuperAdminAuthContext, separate bundle
```

### 3.4 Token Refresh Strategy

- Access token: 15-minute expiry
- Refresh token: 7-day expiry, stored httpOnly cookie
- Axios interceptor auto-refreshes on 401 before retrying original request
- On refresh failure: redirect to login, clear stores

### 3.5 Role Detection Logic

A single user account simultaneously holds multiple roles. The client determines UI rendering based on:

```js
// Role derivation from auth state — priority order:
const roles = {
  isGuest:          !isAuthenticated,
  isUser:           isAuthenticated,
  isPrime:          user?.is_prime,
  hasPrimePass:     user?.has_prime_pass,
  isOrgMember:      user?.org_memberships.length > 0,
  isOrgOwner:       user?.org_memberships.some(m => m.role === 'owner'),
  isCollegeVerified:user?.college_verified,
};
// Organizer context is scoped per :orgId param — check org_memberships for match
```

---

## 4. Routing Map

### 4.1 Public Routes (No Auth Required)

| Route | Page | Notes |
|---|---|---|
| `/` | Home / Discovery | Trending, Hyped, Featured, Near Me/College sections |
| `/events/:id` | Event Detail | Full event page — guests can browse but not buy/hype/wishlist |
| `/search` | Search & Filters | Category, college, date, price, visibility filters |
| `/login` | Login | Google OAuth entry — redirect away if already authenticated |
| `/organizers/:orgId` | Organizer Profile | Public organizer profile, score rank, past events |

### 4.2 Onboarding Routes (Post-Login, Pre-Complete)

| Route | Page | Condition |
|---|---|---|
| `/onboarding` | T&C acceptance + college email | Shown to new users before accessing platform |
| `/onboarding/college-verify` | College email verification | After T&C, if user wants student badge |

### 4.3 Attendee Routes (Auth Required)

| Route | Page | Notes |
|---|---|---|
| `/me` | Profile | Level progress, Prime status, badges |
| `/me/tickets` | Ticket Wallet | Valid / Used / Expired tabs |
| `/me/tickets/:id` | Ticket Detail | QR display, event info, resell/gift options |
| `/me/tickets/:id/resell` | Resell Listing | Price ≤ original; disabled < 10 min before event |
| `/me/tickets/:id/gift` | Gift Flow | In-platform friend gifting only |
| `/me/wishlist` | Wishlist | Event list + alert configuration |
| `/me/following` | Following | Followed organizers and users |
| `/me/reviews` | My Reviews | Reviews within 30-day windows |
| `/me/prime-pass` | Prime Pass | Subscribe / Manage subscription |
| `/me/notifications` | Notifications | In-app notification feed |
| `/organizer-application` | Apply | Organizer application form |

### 4.4 Organizer Dashboard Routes (Auth + Org Membership Required)

| Route | Page |
|---|---|
| `/org/:orgId/dashboard` | Overview, trust tier, summary analytics |
| `/org/:orgId/events` | Event list (draft/live/completed) |
| `/org/:orgId/events/new` | Event builder |
| `/org/:orgId/events/:id/edit` | Edit event (locked fields post-sale) |
| `/org/:orgId/events/:id/scan` | QR scanner — ongoing events only |
| `/org/:orgId/events/:id/bulk-requests` | Approve/reject bulk requests |
| `/org/:orgId/events/:id/feedback` | Send Prime feedback requests |
| `/org/:orgId/members` | Manage members |
| `/org/:orgId/chat` | Private group chat |
| `/org/:orgId/analytics/export` | PDF/Excel revenue export |

### 4.5 College Admin Routes (Separate Auth)

| Route | Page |
|---|---|
| `/college-admin/login` | Separate credential login |
| `/college-admin/applications` | Approve/reject organizer applications (college-scoped) |
| `/college-admin/events` | Moderate college-domain events |
| `/college-admin/create-event` | Free college event creation |
| `/college-admin/analytics` | College-scoped analytics |

### 4.6 Super Admin Routes (Isolated Bundle — Separate Auth)

| Route | Page |
|---|---|
| `/superadmin` | Login (separate from public app shell) |
| `/superadmin/dashboard` | Platform-wide metrics |
| `/superadmin/organizers` | Approve/ban/bonus actions |
| `/superadmin/college-admins` | Flag college admins |
| `/superadmin/config` | Scoring thresholds, platform fee, Prime Pass pricing |
| `/superadmin/support-tickets` | Non-college-routed ticket queue |
| `/superadmin/trending-curation` | Manual trending/featured curation |
| `/superadmin/audit-log` | Full audit trail |

### 4.7 Route Code Splitting

```jsx
// Each feature module is lazy-loaded:
const SuperAdminBundle = React.lazy(() => import('./features/super-admin'));
const OrgDashboard = React.lazy(() => import('./features/organizer'));
const CollegeAdmin = React.lazy(() => import('./features/college-admin'));

// Super Admin is NEVER included in public app shell bundle
// It only loads when route matches /superadmin/*
```

---

## 5. Component Library

### 5.1 Button

```jsx
// Button.jsx — Four variants following theme.md exactly
// Primary: chartreuse bg, teal text, 0px radius, 44px height, Inter 600
// Secondary: teal bg, canvas text, 0px radius, 40px height, DM Mono uppercase
// Ghost: transparent bg, teal border (1px), teal text, 0px radius
// Danger: error color bg, canvas text, 0px radius

Props:
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  size: 'sm' | 'md' | 'lg'
  isLoading: boolean              // show spinner, disable
  isDisabled: boolean
  leftIcon: ReactNode
  rightIcon: ReactNode
  fullWidth: boolean
  onClick: function
  type: 'button' | 'submit' | 'reset'
  ariaLabel: string               // required for icon-only buttons

States:
  Default → Hover (opacity 0.9 + transform: scale(0.99)) → Active (scale 0.97) → Focus (accent outline) → Disabled (opacity 0.4, cursor not-allowed) → Loading (spinner replaces label)

Accessibility:
  - Always has aria-label or visible text
  - Focus ring: 2px solid var(--color-accent) with 2px offset
  - Role="button" with keyboard Enter/Space activation
```

### 5.2 Card

```jsx
// Card.jsx — Three variants from theme.md
// card:      canvas bg, teal hairline border, 12px radius, 16px padding
// card-teal: ink bg, canvas text, 12px radius, 24px padding
// card-sage: sage bg, teal text, 12px radius, 16px padding

Props:
  variant: 'default' | 'teal' | 'sage'
  padding: 'sm' | 'md' | 'lg'    // override padding
  onClick: function | null        // if provided, card is interactive (hover state + cursor pointer)
  isSelected: boolean             // adds accent border for selection state
  ariaLabel: string

Hover (interactive cards only):
  transform: translateY(-2px)
  transition: transform 150ms ease-out
  border-color shifts to accent

No shadows — separation via border only.
```

### 5.3 EventCard

```jsx
// EventCard.jsx — Primary discovery unit
// Used in: homepage grids, search results, organizer event lists

Props:
  event: EventObject
  variant: 'grid' | 'list' | 'featured'
  showOrganizerInfo: boolean
  showHypeButton: boolean
  showWishlistButton: boolean

Layout (grid variant):
  ┌──────────────────────────┐
  │  [Event Image 16:9]      │
  │  [State Chip] [Category] │
  │                          │
  │  Event Title (display-md)│
  │  Organizer · Date        │
  │  Venue                   │
  │  ₹ Price range           │
  │  ━━━━━━━━━━━━━━━━━━━━━━ │
  │  [Hype ♥ count] [Wishlist│
  └──────────────────────────┘

Skeleton state: Skeleton.jsx fills all content areas
Empty image: placeholder using teal gradient
```

### 5.4 Modal

```jsx
// Modal.jsx — Base modal
Props:
  isOpen: boolean
  onClose: function
  title: string
  size: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'
  closeOnOverlayClick: boolean
  closeOnEsc: boolean
  children: ReactNode
  footer: ReactNode

Behavior:
  - Focus trap inside modal when open
  - Escape key closes (if closeOnEsc)
  - Body scroll locked when open (overflow: hidden on body)
  - Animated: overlay fade in 150ms, modal slide-up 200ms
  - Accessible: role="dialog", aria-modal="true", aria-labelledby

Overlay: rgba(8, 61, 68, 0.6) — ink color at 60% opacity
Panel: canvas bg, ink hairline border, radius-lg, no shadow
```

### 5.5 Toast

```jsx
// Toast.jsx — Global notification system
// Positioned: top-right on desktop, top-center on mobile
// Auto-dismiss: 4s (success/info), 6s (warning/error), manual dismiss for critical

Types:
  success: --color-success border, checkmark icon
  error:   --color-error border, X icon
  warning: --color-warning border, alert icon
  info:    --color-info border, info icon

Props:
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
  action: { label: string, onClick: function }  // optional CTA in toast

Animation: slide in from right (translateX), fade out on dismiss
```

### 5.6 QRDisplay

```jsx
// QRDisplay.jsx — Anti-screenshot, app-only QR
// Critical security component per §6 of fullsystem.md

Props:
  ticketId: string
  qrHash: string        // rendered as QR code client-side via qrcode.js
  eventTitle: string
  isUsed: boolean       // grayed out if ticket scanned

Security measures:
  - QR rendered on <canvas> element (not <img>) — harder to screenshot
  - Rotating refresh token every 30 seconds (fetched from server)
  - Visibility API: blur QR when tab loses focus
  - CSS: user-select: none; -webkit-user-drag: none
  - Warning banner: "Screenshots don't work — show this screen at the gate"
  - Overlay shimmer animation to deter screen recording
```

### 5.7 TicketTierCard

```jsx
// TicketTierCard.jsx — Ticket purchase selection
Props:
  tier: { name, price, quantity, sold_count, deal_expiry, college_only }
  isAvailable: boolean      // false if sold out
  isAccessible: boolean     // false if college-only and user not verified, or wrong window
  accessWindow: 'prime' | 'prime_pass' | 'general' | null
  currentWindow: string     // currently active purchase window
  onSelect: function
  isSelected: boolean

States:
  Available → Selected (accent border + chartreuse bg tint)
  Sold Out  → Grayed, "SOLD OUT" label-mono badge
  Not Yet   → Locked, "OPENS [datetime]" label-mono badge
  College   → Lock icon if not verified, "COLLEGE STUDENTS ONLY"

Early Access Banner:
  Prime Window:      TealBand strip — "PRIME EARLY ACCESS OPEN"
  Prime Pass Window: TealBand strip — "PRIME PASS EARLY ACCESS OPEN"
  General Sale:      No special banner
```

### 5.8 LevelBadge / PrimeBadge

```jsx
// LevelBadge.jsx
Props:
  level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'prime'
  size: 'sm' | 'md' | 'lg'
  showLabel: boolean

Visual:
  Each level has a distinct color ring around avatar (from --level-* tokens)
  Prime: chartreuse ring + "PRIME" label-mono badge
  Prime is the EARNED tier — never show it for Pass-only holders

// PrimeBadge.jsx — earned Prime symbol
// PrimePassBadge.jsx — purchased Pass symbol
// Both shown simultaneously if user holds both
```

### 5.9 HypeButton

```jsx
// HypeButton.jsx — Social signal + trending feed input
Props:
  eventId: string
  isHyped: boolean
  hyped: number           // total hype count
  isPrimeUser: boolean    // Prime hypes visually weighted

Behavior:
  - Optimistic update: toggle immediately, revert on API error
  - Animation: scale 1 → 1.3 → 1 on hype (150ms spring)
  - Unauthenticated click: redirect to /login with return URL
  - Tooltip on hover: "Hype this event!" / "Remove hype"
  - Prime users: subtle chartreuse glow on button after hype
```

### 5.10 EarlyAccessBanner

```jsx
// EarlyAccessBanner.jsx — Displays active purchase window
Props:
  eventState: EventState
  primeWindowOpen: boolean
  primePassWindowOpen: boolean
  generalSaleOpen: boolean
  primeWindowOpenAt: datetime
  primePassWindowOpenAt: datetime
  generalSaleOpenAt: datetime
  userAccessLevel: 'prime' | 'prime_pass' | 'general'

Renders TealBand with:
  - Current window label in type-label-mono uppercase
  - Countdown timer to next window opening
  - User's access level indicator
  - CTA appropriate to current window + user level
```

---

## 6. Page-by-Page Implementation

### 6.1 Home / Discovery Page (`/`)

**Purpose:** Event discovery feed — the product's front door.

**Sections (in order, alternating band colors):**

```
[TealBand — HERO]
  - Festify wordmark + tagline (type-display-xl, canvas text)
  - Search bar (search-input component) as primary CTA
  - Category filter pills (pill radius, chartreuse on active)
  - "DISCOVER EVENTS NEAR YOU" label-mono below search

[CanvasBand — TRENDING]
  - "TRENDING NOW" label-mono heading
  - EventCard grid (3 col desktop, 2 col tablet, 1 col mobile)
  - "See all trending" ghost button

[TealBand — FEATURED]
  - "FEATURED" label-mono heading, canvas text
  - Large featured event cards (card-teal variant)
  - Organizer paid placement (no visual distinction from super admin curated)

[CanvasBand — HYPED THIS WEEK]
  - EventCard grid sorted by hype count
  - Hype count prominently displayed

[TealBand — NEAR YOUR COLLEGE] (College-verified users only)
  - "AT YOUR COLLEGE" label-mono
  - College-scoped events

[CanvasBand — UPCOMING] / [COLLEGE-ONLY EVENTS]
  - General upcoming events sorted by date
```

**States:**
- **Loading:** Full-page skeleton (Skeleton.jsx fills EventCard shapes)
- **Empty:** "No events yet — check back soon!" with teal band illustration
- **Guest view:** College section hidden; hype/wishlist disabled (click → /login)
- **Error:** Toast error + "Retry" link

**Data:** `GET /trending`, `GET /featured`, events filtered by hype, events filtered by college

---

### 6.2 Event Detail Page (`/events/:id`)

**Purpose:** The full event experience — discovery → purchase decision.

**Layout:**
```
[TealBand — EVENT HERO]
  EventHero.jsx:
    - Event cover image (16:9 max, full-bleed on mobile)
    - Event Title (type-display-lg, canvas text)
    - Organizer name + trust tier chip
    - Date, time, venue (type-label-mono, canvas text)
    - Event state chip (Live / Early Access / Sold Out)
    - [Hype Button] [Wishlist Button]

[CanvasBand — EARLY ACCESS BANNER] (if applicable)
  EarlyAccessBanner.jsx

[CanvasBand — TICKET TIERS]
  TicketTierSection.jsx:
    - Each tier as TicketTierCard.jsx
    - Total + platform fee breakdown
    - "SELECT TICKETS" primary button (chartreuse)
    - Bulk purchase request button (ghost variant)
    - Waitlist button (if Sold Out)

[TealBand — EVENT DESCRIPTION]
  - Description (type-body-md, canvas text)
  - Tags / categories (pill tags)
  - Pre-event images/reels (media gallery)

[CanvasBand — ORGANIZER]
  OrganizerProfileSection.jsx:
    - Org name, trust tier, score rank
    - "VERIFIED" or "TRUSTED" label-mono badge
    - Follow button
    - Past successful events count

[TealBand — REVIEWS] (only after event Completed)
  ReviewsSection.jsx:
    - Average rating (large StarRating display)
    - "X REVIEWS" label-mono count
    - ReviewCard list
    - ReviewForm.jsx (only for ticket buyers within 30-day window)
    - Pagination or infinite scroll

[CanvasBand — HYPE LIST] (Prime hypes, organizer configurable visibility)
```

**States:**
- **Loading:** Skeleton.jsx for hero + tiers
- **Draft/Pending:** Only visible to organizer; shows "PENDING APPROVAL" banner
- **Sold Out:** All tiers disabled, waitlist CTA prominent
- **Cancelled:** Red banner, refund information
- **Postponed:** Amber banner, new date, refund request CTA
- **Guest:** Buy buttons redirect to /login

**Purchase Flow (Modal sequence):**
```
1. User clicks "SELECT TICKETS" 
2. TicketSelectionModal opens (quantity per tier, max enforced client-side)
3. OrderSummaryModal → shows price + platform fee breakdown
4. RazorpayCheckout (client-side Razorpay SDK loads)
5. On payment success → PurchaseSuccessModal (with QR preview)
6. On payment failure → PaymentFailModal with retry option
```

---

### 6.3 Search Page (`/search`)

**Layout:**
```
[CanvasBand — SEARCH HEADER]
  - Large search input (search-input, 48px height)
  - Active query display

[TealBand — FILTER BAR]
  - Category pills (pill radius, chartreuse on active)
  - Date range picker
  - Price range slider
  - College filter (dropdown)
  - Visibility filter (only shown to authenticated users)
  - "CLEAR FILTERS" label-mono button

[CanvasBand — RESULTS]
  - Result count "X EVENTS FOUND" label-mono
  - Sort: Trending / Date / Price (label-mono tabs)
  - EventCard list or grid (user toggleable)
  - Infinite scroll with "LOADING MORE..." label-mono
```

**States:**
- **Loading:** Skeleton grid
- **Empty:** "NO EVENTS MATCH YOUR SEARCH" with suggestions
- **Error:** Toast + retry

---

### 6.4 Login Page (`/login`)

**Layout (centered, TealBand full-height):**
```
[TealBand — FULL SCREEN]
  - Festify wordmark (large, canvas text, type-display-lg)
  - "Sign in to discover and attend events" (type-body-md, canvas text)
  - [Continue with Google] button (chartreuse bg, primary variant)
    - Google icon + "Continue with Google" (type-ui-button)
  - Guest browsing link: "Browse events without signing in →"
  - T&C disclaimer (type-body-xs, canvas text, link-blue for links)
```

**Post-Login redirect:** Return to original URL (stored in sessionStorage before redirect)

---

### 6.5 Onboarding Page (`/onboarding`)

**Multi-step flow:**
```
Step 1 — T&C Acceptance
  - Full T&C text (scrollable, CanvasBand)
  - Must scroll to bottom before "I ACCEPT" becomes enabled
  - "I ACCEPT" primary button (chartreuse)

Step 2 — College Email Verification (optional, skippable)
  - "Are you a college student?" prompt
  - Email input for .edu or college domain
  - "VERIFY EMAIL" primary button
  - "Skip for now" ghost button
  - Shows student badge preview on success

Step 3 — Welcome Screen
  - "WELCOME TO FESTIFY" display-xl
  - Level badge: Bronze (entry tier)
  - Redirect to home
```

---

### 6.6 Profile Page (`/me`)

**Sections:**
```
[TealBand — PROFILE HERO]
  - Avatar + name
  - Customer level badge (LevelBadge.jsx) with progress bar
  - Prime badge (if earned) + Prime Pass badge (if subscribed)
  - College verification badge (if verified)
  - "EDIT PROFILE" secondary button

[CanvasBand — LEVEL PROGRESS]
  - Current level + XP progress bar
  - "NEXT TIER" label-mono with remaining requirements (TBD thresholds shown as locked)
  - Activity stats: events attended, total spend

[TealBand — PRIME STATUS]
  - If Prime: "YOU ARE PRIME" chartreuse text, earned date
  - If not Prime: "PRIME — EARNED, NEVER PURCHASED" with progress info

[CanvasBand — QUICK LINKS]
  - My Tickets, Wishlist, Following, Reviews, Prime Pass — card-sage variant cards
```

---

### 6.7 Ticket Wallet (`/me/tickets`)

**Layout:**
```
[CanvasBand — HEADER]
  - "MY TICKETS" type-display-md
  - Tab bar: VALID | USED | EXPIRED (DM Mono uppercase tabs)

[CanvasBand — TICKET LIST]
  TicketCard.jsx per ticket:
    - Event name + date
    - Ticket tier name
    - Status chip
    - [VIEW QR] or [RESELL] or [GIFT] contextual buttons
    - For gifted: "Gifted to [Name]" label
```

**Ticket Detail (`/me/tickets/:id`):**
```
[TealBand — QR DISPLAY]
  - QRDisplay.jsx (full-width, centered)
  - "SHOW THIS AT THE GATE" label-mono warning
  - Screenshots don't work banner

[CanvasBand — TICKET INFO]
  - Event: name, date, venue
  - Tier: name, price, booking code
  - Purchase date
  - [RESELL TICKET] ghost button (if resale allowed)
  - [GIFT TICKET] ghost button (if gift allowed)
  - [REPORT THEFT] danger button (if within 1hr before event, max 2 reports)
```

---

### 6.8 Resell Page (`/me/tickets/:id/resell`)

**Layout:**
```
[CanvasBand — RESELL FORM]
  - Ticket summary card (card-sage)
  - "LIST FOR RESALE" type-display-md
  - Original price displayed prominently
  - Price input: "New price (max ₹[original])" — enforced validation
  - "PRICE CAN ONLY GO DOWN" label-mono warning (amber color)
  - Resale closes at: "10 MINUTES BEFORE EVENT" label-mono
  - [LIST FOR RESALE] primary button
  - Confirmation modal before listing

Validation:
  - Price > original: error "Price cannot exceed ₹[original]"
  - Event < 10 min away: disabled with "RESALE CLOSED" message
  - College-only ticket: "CAN ONLY BE RESOLD TO VERIFIED [COLLEGE] STUDENTS"
```

---

### 6.9 Event Builder (`/org/:orgId/events/new`)

**Multi-step wizard:**
```
Step 1 — Basic Info
  - Event title (required)
  - Category (dropdown)
  - Description (rich text — markdown or basic WYSIWYG)
  - Cover image upload (via media.api.js → Cloudflare R2)
  - Pre-event images/reels upload

Step 2 — Date & Venue
  - Single day / Multi-day toggle
  - Start date/time, End date/time
  - Venue name + address
  - [FESTIFY NOTE: Major edits locked after first ticket sold]

Step 3 — Visibility & Capacity
  - Visibility: Public / Registered-Only / College-Only (if verified)
  - Total capacity
  - Waitlist: enable/disable toggle
  - Max tickets per person (auto-computed: >200 cap → 10, ≤200 → 5)

Step 4 — Ticket Tiers
  - Add tier button → opens TierFormModal:
    - Tier type: VIP / General / Early Bird / College-Only
    - Name, price, quantity
    - Early Bird: deal_expiry datetime
    - College-Only: restricted to verified students checkbox
  - Can add multiple tiers
  - Drag to reorder

Step 5 — Prime Configuration
  - Prime early-access pool size (slider: % of capacity)
  - Prime Pass pool size (slider: % of remaining)
  - Enable Prime bulk-buy skip toggle
  - [PRIME POOL WINDOW OPENS FIRST] informational banner

Step 6 — Review & Publish
  - Full preview of event
  - "PUBLISH EVENT" primary button
  - New org: triggers approval flow (event goes to Pending state, shows "AWAITING ADMIN APPROVAL")
  - Verified/Trusted org: event goes Live immediately
```

**Auto-save:** Debounced 2s after last change, stored as Draft.

---

### 6.10 QR Scanner (`/org/:orgId/events/:id/scan`)

**Layout:**
```
[TealBand — SCANNER HEADER]
  - Event name, "GATE SCANNER" label-mono
  - Tickets scanned: X / Y count

[FullScreen — CAMERA VIEW]
  - Native camera via WebView bridge
  - Scan frame overlay (teal border guide)
  - Flash toggle button
  - Manual booking code input fallback

[CanvasBand — SCAN RESULT]
  Success (valid ticket):
    - Green flash animation
    - Attendee name, ticket tier
    - "ENTRY GRANTED" in type-display-md, success color
    
  Already Used:
    - Red flash animation
    - "TICKET ALREADY SCANNED" — timestamp of first scan
    
  Invalid:
    - Red flash animation
    - "INVALID TICKET" error

  Theft Reported:
    - Amber flash animation
    - "TICKET THEFT REPORTED — VERIFY IDENTITY"
```

**Notes:**
- Only accessible when event is in "Ongoing" state
- Camera access via native bridge (FCM/camera permissions)
- Offline resilience: scans queued locally if connectivity lost

---

### 6.11 Organizer Dashboard (`/org/:orgId/dashboard`)

**Layout (DashboardShell with sidebar):**
```
Sidebar:
  - Org name + trust tier badge
  - Navigation: Dashboard | Events | Members | Analytics | Chat

Main Content:
[TealBand — OVERVIEW HEADER]
  - "ORG DASHBOARD" label-mono
  - Org score rank: "#X EVENT ORGANIZER" type-display-md
  - Trust tier: NEW / VERIFIED / TRUSTED chip

[CanvasBand — METRICS GRID]
  Card grid (card-sage):
    - Total events: live / completed / draft counts
    - Total revenue (current month vs last month)
    - Avg rating across all events
    - Total attendees (all-time)
    - Prime hype count (all events)

[TealBand — RECENT EVENTS]
  - Last 3 events with status, revenue, rating
  - "VIEW ALL EVENTS" ghost button

[CanvasBand — PENDING ACTIONS]
  - Bulk requests awaiting approval (count badge)
  - Events awaiting approval (if New tier)
  - Feedback requests pending
```

---

### 6.12 College Admin Panel (`/college-admin/*`)

**Separate design context — same design tokens, different shell:**
```
Layout: DashboardShell with college admin sidebar

Applications Page:
  - Table: Applicant, College, Date Applied, Status, Actions
  - Approve / Reject buttons per row
  - Filter by status: Pending | Approved | Rejected
  - Each row expandable: application details

Events Moderation Page:
  - Table: Event, Organizer, Status, Date, Actions
  - Moderate / Approve / Flag actions

Create Event Page:
  - Simplified EventBuilder (fewer steps — free, no payment required)
  - No Prime pool config (college events default behavior)
  - Unlimited free events

Analytics Page:
  - College-scoped: events, attendance, top organizers within college
  - No cross-college data visible
```

---

### 6.13 Super Admin Panel (`/superadmin/*`)

**Completely isolated bundle — not linked to public shell:**
```
Super Admin is NOT visible to any other role.
All actions are audit-logged (timestamp, action, target, metadata).

Dashboard:
  - Platform metrics: total users, events, revenue, tickets sold
  - Active issues: pending organizer approvals, open support tickets
  - Ban/flag queue

Organizers Page:
  - Full organizer list with trust tier, score, ban status
  - Actions per row: Approve | Warn | Ban (7d/30d/long) | Bonus
  - Ban modal: select stage, add reason (audit-logged)
  - Bonus modal: amount, reason (audit-logged)

Config Page:
  - Scoring thresholds (numeric inputs)
  - Platform fee % (numeric input)
  - Prime Pass pricing (monthly/yearly — numeric inputs)
  - Successful event threshold (default 70% / 3.5 stars)
  - Customer level thresholds (TBD — fields shown as "TBD — will be set post-launch")
  - Save triggers POST /superadmin/config/* — requires confirmation modal

Trending Curation Page:
  - Drag-drop list of featured events
  - Search to add event to featured
  - Remove from featured

Audit Log Page:
  - Sortable/filterable table: timestamp, actor, action, target, metadata
  - Export to CSV
  - Real-time updates via polling or WebSocket
```

---

### 6.14 Prime Pass Page (`/me/prime-pass`)

**Layout:**
```
[TealBand — PRIME PASS HERO]
  - "PRIME PASS" type-display-lg, canvas text
  - "Convenience perks for the dedicated attendee" body-md
  - "IMPORTANT: PRIME PASS ≠ PRIME STATUS" label-mono warning banner

[CanvasBand — BENEFITS]
  Card grid (card-sage) — benefits of Prime Pass:
    - Second-window early ticket access
    - Prioritized support tickets
    - Platform vouchers and discounts
  
  "WHAT PRIME PASS CANNOT DO" card-teal:
    - Cannot grant Prime badge
    - Cannot access Prime early-access queue
    - Cannot skip bulk-buy requests

[TealBand — PRICING]
  - Monthly plan: ₹TBD / month
  - Yearly plan: ₹TBD / year (save X%)
  - Plan selector cards (chartreuse border on selected)
  - [SUBSCRIBE] primary button → Razorpay checkout
  - If active: shows expiry, [CANCEL SUBSCRIPTION] danger button

[CanvasBand — PRIME EARNED STATUS]
  - If user has Prime: "YOU ALREADY HAVE PRIME — THE HIGHEST TIER"
  - If not Prime: "WANT PRIME? ATTEND AND SPEND — IT CANNOT BE PURCHASED"
```

---

## 7. State Management & Data Flow

### 7.1 State Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Server State (React Query / TanStack Query)                    │
│  — events, tickets, notifications, reviews, org data            │
│  — automatic caching, background refetch, stale-while-revalidate│
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Global Client State (Zustand)                                  │
│  — auth user object                                             │
│  — modal open/close state                                       │
│  — toast queue                                                  │
│  — sidebar collapse state                                       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Local Component State (useState / useReducer)                  │
│  — form field values                                            │
│  — step wizard progress                                         │
│  — filter/sort UI state                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 React Query Configuration

```js
// lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes stale time for lists
      gcTime: 1000 * 60 * 30,          // 30 minutes garbage collection
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,                         // no retry for mutations
    }
  }
});

// Query keys factory — constants/queryKeys.js
export const queryKeys = {
  events: {
    all:     () => ['events'],
    list:    (filters) => ['events', 'list', filters],
    detail:  (id) => ['events', id],
    reviews: (id) => ['events', id, 'reviews'],
    hypes:   (id) => ['events', id, 'hypes'],
    tiers:   (id) => ['events', id, 'tiers'],
  },
  tickets: {
    wallet:  (userId) => ['tickets', userId],
    detail:  (ticketId) => ['tickets', ticketId],
    resale:  () => ['tickets', 'resale'],
  },
  user: {
    profile:   (userId) => ['user', userId],
    level:     (userId) => ['user', userId, 'level'],
    wishlist:  (userId) => ['user', userId, 'wishlist'],
    following: (userId) => ['user', userId, 'following'],
  },
  notifications: (userId) => ['notifications', userId],
  org: {
    dashboard: (orgId) => ['org', orgId],
    events:    (orgId) => ['org', orgId, 'events'],
    members:   (orgId) => ['org', orgId, 'members'],
    score:     (orgId) => ['org', orgId, 'score'],
    bulkRequests: (orgId, eventId) => ['org', orgId, 'events', eventId, 'bulk-requests'],
  }
};
```

### 7.3 Optimistic Updates

Applied to high-frequency mutations that need instant feedback:

```js
// Hype toggle — optimistic update pattern
const { mutate: toggleHype } = useMutation({
  mutationFn: (eventId) => scoreApi.toggleHype(eventId),
  onMutate: async (eventId) => {
    await queryClient.cancelQueries(queryKeys.events.detail(eventId));
    const prev = queryClient.getQueryData(queryKeys.events.detail(eventId));
    queryClient.setQueryData(queryKeys.events.detail(eventId), old => ({
      ...old,
      is_hyped: !old.is_hyped,
      hype_count: old.is_hyped ? old.hype_count - 1 : old.hype_count + 1
    }));
    return { prev };
  },
  onError: (err, eventId, context) => {
    queryClient.setQueryData(queryKeys.events.detail(eventId), context.prev);
    toast.error("Couldn't update hype — please try again");
  },
  onSettled: (eventId) => {
    queryClient.invalidateQueries(queryKeys.events.detail(eventId));
  }
});

// Same pattern applied to: wishlist toggle, follow/unfollow
```

### 7.4 Error Handling Strategy

```
API Error Types → Frontend Handling:

400 Bad Request      → Form validation error inline (not toast)
401 Unauthorized     → Auto token refresh → if fails, logout + redirect /login
403 Forbidden        → Toast "You don't have permission" + stay on page
404 Not Found        → Redirect to /404 page
409 Conflict         → Inline message (e.g., "Already hyped")
422 Validation Error → Extract field errors from response → show inline
429 Rate Limited     → Toast "Too many requests — wait a moment"
500 Server Error     → Toast "Something went wrong — try again" + Sentry log
Network Error        → Toast "No connection — check your internet"
```

---

## 8. API Integration Contracts

### 8.1 Axios Client Setup

```js
// lib/api/client.js
import axios from 'axios';
import { authStore } from '../store/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // for httpOnly cookies
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor: attach access token from store
apiClient.interceptors.request.use(config => {
  const token = authStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 with token refresh
let isRefreshing = false;
let failedQueue = [];

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post('/auth/refresh', {}, { withCredentials: true });
        authStore.setState({ accessToken: data.access_token });
        failedQueue.forEach(p => p.resolve(data.access_token));
        failedQueue = [];
        return apiClient(original);
      } catch (refreshError) {
        failedQueue.forEach(p => p.reject(refreshError));
        failedQueue = [];
        authStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 8.2 Key API Module Contracts

```js
// lib/api/events.api.js
export const eventsApi = {
  getEvent:        (id) => apiClient.get(`/events/${id}`),
  listEvents:      (filters) => apiClient.get('/events', { params: filters }),
  createEvent:     (data) => apiClient.post('/events', data),
  updateEvent:     (id, data) => apiClient.patch(`/events/${id}`, data),
  publishEvent:    (id) => apiClient.post(`/events/${id}/publish`),
  cancelEvent:     (id) => apiClient.post(`/events/${id}/cancel`),
  postponeEvent:   (id, data) => apiClient.post(`/events/${id}/postpone`, data),
  getAnalytics:    (id) => apiClient.get(`/events/${id}/analytics`),
  exportAnalytics: (id, format) => apiClient.get(`/events/${id}/analytics/export`, { params: { format }, responseType: 'blob' }),
};

// lib/api/tickets.api.js
export const ticketsApi = {
  purchaseTicket:  (data) => apiClient.post('/tickets/purchase', data),
  bulkRequest:     (data) => apiClient.post('/tickets/bulk-request', data),
  approveBulk:     (id) => apiClient.post(`/tickets/bulk-request/${id}/approve`),
  rejectBulk:      (id) => apiClient.post(`/tickets/bulk-request/${id}/reject`),
  giftTicket:      (id, data) => apiClient.post(`/tickets/${id}/gift`, data),
  shareTicket:     (id, data) => apiClient.post(`/tickets/${id}/share`, data),
  resellTicket:    (id, data) => apiClient.post(`/tickets/${id}/resell`, data),
  scanTicket:      (id) => apiClient.post(`/tickets/${id}/scan`),
  reportTheft:     (id) => apiClient.post(`/tickets/${id}/report-theft`),
  getUserTickets:  (userId) => apiClient.get(`/users/${userId}/tickets`),
};

// lib/api/payments.api.js
export const paymentsApi = {
  createCheckout:  (data) => apiClient.post('/payments/checkout', data),
  getTransaction:  (id) => apiClient.get(`/payments/${id}`),
  requestRefund:   (id, data) => apiClient.post(`/payments/${id}/refund`, data),
  getPayouts:      (orgId) => apiClient.get(`/org-groups/${orgId}/payouts`),
};

// lib/razorpay.js
export const openRazorpayCheckout = (order, userInfo, onSuccess, onFailure) => {
  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    order_id: order.razorpay_order_id,
    amount: order.amount,
    currency: 'INR',
    name: 'Festify',
    description: order.description,
    prefill: { name: userInfo.name, email: userInfo.email },
    theme: { color: '#083d44' },   // ink teal as Razorpay theme
    handler: (response) => onSuccess(response),
    modal: { ondismiss: () => onFailure('dismissed') }
  };
  const rzp = new window.Razorpay(options);
  rzp.on('payment.failed', (response) => onFailure(response.error));
  rzp.open();
};
```

### 8.3 Notification Integration

```js
// lib/fcm.js — Firebase Cloud Messaging (WebView bridge for mobile)
export const initFCM = async () => {
  if (typeof window.__FCMBridge !== 'undefined') {
    // Mobile WebView: request token via native bridge
    const token = await window.__FCMBridge.requestToken();
    await notificationsApi.registerPushToken(token);
  } else {
    // Web PWA: use Firebase SDK directly
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FCM_VAPID_KEY });
    await notificationsApi.registerPushToken(token);
  }
};
```

---

## 9. Responsive & Accessibility Requirements

### 9.1 Breakpoints

```css
/* Mobile-first breakpoints */
--bp-sm:  480px;   /* large phones */
--bp-md:  768px;   /* tablets */
--bp-lg:  1024px;  /* small desktops */
--bp-xl:  1200px;  /* standard desktop */
--bp-2xl: 1440px;  /* wide desktop */
```

### 9.2 Responsive Behavior by Component

| Component | Mobile | Tablet | Desktop |
|---|---|---|---|
| Navigation | Bottom tab bar + hamburger | Top nav + hamburger | Full top nav |
| EventCard grid | 1 column | 2 columns | 3 columns |
| Hero section | Single column, search full-width | Single column | Single column, max 800px |
| Dashboard | Sidebar hidden (drawer) | Sidebar collapsed | Full sidebar |
| Event Detail tiers | Stacked vertically | 2-column grid | 2-column grid |
| Search filters | Slide-up drawer | Side panel | Side panel |
| Type scale | Display-xl: 40px → 64px | 48px → 64px | 64px |

### 9.3 Accessibility Standards

**Target: WCAG 2.1 AA minimum**

```
Color Contrast:
  - Canvas (#fcfcf8) + Ink text (#083d44): ✓ 12:1 (AAA)
  - Teal bg (#083d44) + Canvas text (#fcfcf8): ✓ 12:1 (AAA)
  - Chartreuse (#e5ff97) + Ink text (#083d44): ✓ 7.5:1 (AAA)
  - Sage (#f3f6e4) + Ink text — verify at small sizes (flagged in theme.md)

Focus States:
  - All interactive elements: 2px solid var(--color-accent) + 2px offset
  - Never remove :focus-visible outline
  - Logical focus order — no keyboard traps except modals (intentional)

Semantic HTML:
  - Single <h1> per page (event title on detail, "Festify" on home, etc.)
  - Proper heading hierarchy: h1 → h2 → h3
  - <main>, <nav>, <aside>, <footer>, <article>, <section> landmarks
  - <button> for actions, <a> for navigation only
  - aria-label on icon-only buttons (QR scan, hype, wishlist)
  - aria-live="polite" on toast region
  - aria-busy="true" on loading skeleton areas
  - role="dialog" + aria-modal on all modals

Keyboard Navigation:
  - Tab order follows visual reading order
  - Escape closes modals/drawers
  - Arrow keys navigate: ticket tier selection, filter pills, star rating
  - Enter/Space activates buttons
  - Skip-to-content link (first focusable element on every page)

Screen Reader:
  - EventCard: aria-label includes event name, date, price range
  - HypeButton: aria-pressed="true/false"
  - WishlistButton: aria-pressed="true/false"
  - StarRating input: radiogroup with value announcement
  - QRDisplay: aria-label="QR code for [event] ticket — show at gate"
  - Event state chips: aria-label includes full state name

Reduced Motion:
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
```

### 9.4 Mobile-Specific UX

```
Bottom Tab Bar (mobile ≤768px):
  Tabs: Discover | Search | Tickets | Profile | [Org Dashboard if member]
  Active tab: chartreuse underline + icon color shift
  Height: 60px + safe area inset (env(safe-area-inset-bottom))

Touch Targets:
  Minimum 44x44px for all interactive elements
  Card tap area = full card (not just button)

Swipe Gestures:
  Ticket Wallet: swipe left on ticket card → reveal Resell / Gift actions
  Event images: swipe gallery
  Tab bar: swipe between tabs

Scroll Behavior:
  Event list: infinite scroll (not pagination)
  Discovery feed: pull-to-refresh
  Admin tables: horizontal scroll on small screens

Input handling:
  Date pickers: native mobile date input (<input type="date">)
  Price inputs: numeric keyboard (inputmode="decimal")
  Search: autofocus + keyboard dismiss on search submit
```

---

## 10. Performance & SEO

### 10.1 Code Splitting Strategy

```js
// Route-level lazy loading:
const SuperAdminBundle = lazy(() => import('./features/super-admin'));   // ~0 KB in public bundle
const OrgDashboard = lazy(() => import('./features/organizer'));
const CollegeAdmin = lazy(() => import('./features/college-admin'));
const AttendeePages = lazy(() => import('./features/attendee'));
const EventDetail = lazy(() => import('./features/event-detail'));

// Component-level lazy loading:
const QRDisplay = lazy(() => import('./components/domain/QRDisplay'));           // qrcode.js heavy
const RichTextEditor = lazy(() => import('./components/domain/RichTextEditor')); // WYSIWYG heavy
const Analytics = lazy(() => import('./components/domain/AnalyticsCharts'));     // chart lib heavy

// All lazy routes wrapped in <Suspense fallback={<PageSkeleton />}>
```

### 10.2 Image Optimization

```
All user-uploaded images served via Cloudflare R2 with:
  - Responsive srcset: 400w, 800w, 1200w variants
  - WebP format with JPEG fallback
  - loading="lazy" for below-fold images
  - loading="eager" for above-fold hero image
  - aspect-ratio: 16/9 on EventCard images (no layout shift)
  - placeholder: canvas-teal gradient while loading

Event cover image sizes:
  - Card thumbnail: 400x225 (16:9)
  - Event hero: 1200x675 (16:9)
  - OG image: 1200x630

<img> always has:
  - alt attribute (descriptive, not "image")
  - width + height attributes (prevents CLS)
  - decoding="async"
```

### 10.3 Rendering Strategy

```
Static + SSG (Vercel):
  - / (Home) — ISR, revalidate every 60 seconds (trending changes)
  - /events/:id — ISR, revalidate every 30 seconds (ticket availability)
  - /search — CSR (filter-driven, cannot pre-render)

Client-Side:
  - All authenticated pages (/me/*, /org/*, /college-admin/*, /superadmin/*)
  - QR scanner, payment flows
```

### 10.4 SEO

```html
<!-- Per page <head> — Vite + react-helmet-async -->

<!-- Home -->
<title>Festify — Discover College Events & Get Tickets</title>
<meta name="description" content="Browse trending hackathons, parties, cultural shows and more at colleges near you. Buy tickets, follow organizers, and discover what's happening.">

<!-- Event Detail -->
<title>[Event Name] — [Date] at [Venue] | Festify</title>
<meta name="description" content="[First 160 chars of description]">
<meta property="og:image" content="[event cover image URL]">
<meta property="og:type" content="event">

<!-- Open Graph + Twitter Card on all pages -->
<meta property="og:site_name" content="Festify">
<meta property="og:url" content="[canonical URL]">
<meta name="twitter:card" content="summary_large_image">

<!-- Structured Data (JSON-LD) on Event Detail page -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "[Event Name]",
  "startDate": "[ISO 8601 date]",
  "location": { "@type": "Place", "name": "[Venue]" },
  "organizer": { "@type": "Organization", "name": "[Org Name]" },
  "offers": { "@type": "Offer", "price": "[min price]", "priceCurrency": "INR" }
}
</script>
```

### 10.5 Core Web Vitals Targets

```
LCP (Largest Contentful Paint): < 2.5s
  → Hero image preloaded: <link rel="preload">
  → Font preconnect: <link rel="preconnect" href="https://fonts.googleapis.com">

FID / INP (Interaction to Next Paint): < 200ms
  → Heavy computations in Web Workers (score calculations, QR generation)
  → Debounce search input: 300ms

CLS (Cumulative Layout Shift): < 0.1
  → All images have explicit width/height
  → Font display: swap
  → Skeleton loaders match final content dimensions

Bundle size targets:
  Initial JS: < 150KB gzipped
  Per-route chunk: < 50KB gzipped
  Vendor chunk: < 200KB gzipped (React + React Query + Zustand)
```

---

## 11. Animations & Micro-interactions

### 11.1 Animation Principles

All animations follow the theme's archival precision aesthetic — functional, not decorative. Duration values calibrated for a scholarly, deliberate feel.

```css
/* Animation tokens */
--duration-instant:  100ms;   /* immediate feedback */
--duration-fast:     150ms;   /* hover states, button press */
--duration-normal:   200ms;   /* modal open, panel slide */
--duration-slow:     350ms;   /* page transitions, band alternation */

--ease-out:   cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in:    cubic-bezier(0.4, 0.0, 1, 1);
--ease-inout: cubic-bezier(0.4, 0.0, 0.2, 1);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* hype button bounce */
```

### 11.2 Component-Level Animations

```
Button press:
  → scale(0.97) in 100ms ease-in
  → restore scale(1) in 150ms ease-out

EventCard hover (interactive):
  → translateY(-2px) in 150ms ease-out
  → border transitions to accent

HypeButton activation:
  → scale(1) → scale(1.3) → scale(1) in 300ms spring ease
  → count number: animate count change (countup.js or CSS flip)
  → Prime user: chartreuse glow pulse (box-shadow fade)

Toast appear:
  → slideInFromRight: translateX(100%) → translateX(0) in 200ms ease-out
  → dismiss: fadeOut + translateX(100%) in 150ms ease-in

Modal open:
  → overlay: opacity 0 → 0.6 in 150ms ease-out
  → panel: translateY(20px) + opacity 0 → translateY(0) + opacity 1 in 200ms ease-out

Modal close:
  → panel: translateY(0) + opacity 1 → translateY(20px) + opacity 0 in 150ms ease-in
  → overlay: opacity 0.6 → 0 in 150ms ease-in

QR scanner flash (scan result):
  → success: canvas flash green (opacity 0.3) + fade out in 500ms
  → error: canvas flash red (opacity 0.3) + fade out in 500ms

Level progress bar fill:
  → Animate from 0 to current % on mount: 600ms ease-out
  → Shown only once per session (stored in sessionStorage)

TealBand ↔ CanvasBand page transitions:
  → Smooth scroll behavior
  → Section entry: fade-in + slight translateY(10px → 0) via IntersectionObserver
  → Stagger child elements 50ms apart

Event card image:
  → skeleton shimmer (gradient animation, left-to-right, 1.5s loop) while loading
  → fade-in on load (opacity 0 → 1, 200ms)

Star rating input:
  → Each star: scale(1) → scale(1.2) → scale(1) on hover-over
  → Fill color: transition 150ms

Notification bell:
  → Wobble animation (rotate -10° → 10° → 0°) on new notification
  → Plays only once, then stops

Search input focus:
  → Border transitions from hairline black to ink teal in 150ms
  → Subtle scale(1.01) on focus

Section scroll reveal (IntersectionObserver):
  → Elements below fold: opacity 0 → 1 + translateY(20px → 0) as they enter viewport
  → Stagger: 100ms per child
  → Threshold: 0.1 (fires when 10% visible)
  → Once-only: { once: true }

Resale price input validation flash:
  → When price > original: input border flashes red (red → hairline, 300ms)
  → Error message shakes (translateX animation, 3 oscillations, 300ms)
```

### 11.3 Page-level Transitions

```jsx
// Wrap routes in AnimatePresence (Framer Motion or CSS transitions)
// Transition: crossfade opacity 150ms — no slide (scholarly, not app-like)

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 }
};
const pageTransition = { duration: 0.15 };
```

---

## 12. Security Considerations

### 12.1 Authentication Security

```
- Access tokens: 15-minute expiry, stored in memory (Zustand), never localStorage
- Refresh tokens: 7-day expiry, httpOnly cookie (JS cannot access)
- CSRF protection: SameSite=Strict cookie attribute + CSRF token header
- Google OAuth: PKCE flow, nonce validation
- Super Admin: completely separate auth system, isolated route bundle never shipped in public JS bundle (Vite dynamic import — only loads if URL matches /superadmin/*)
```

### 12.2 QR Ticket Security

```
- QR rendered on <canvas>, not <img> — harder to screenshot
- QR contains time-limited rotating token (30-second window, refreshed via /tickets/:id/qr-token)
- Visibility API: QR blurred when tab loses focus (document.visibilityState)
- CSS: user-select: none; pointer-events: none on QR canvas
- Warning text: "Screenshots don't work — App-only QR scanning"
- Overlay shimmer animation discourages screen recording
```

### 12.3 Payment Security

```
- Never handle raw card data — Razorpay hosted checkout only
- Order created server-side before payment (POST /payments/checkout)
- Payment verification done server-side via webhook (POST /payments/webhook)
- Client only triggers Razorpay SDK after server-side order ID received
- Platform fee added server-side — client cannot override
```

### 12.4 Content Security

```
- All user-generated content (reviews, comments) sanitized before rendering
- DOMPurify used on any HTML content from API responses
- Event descriptions: rendered as markdown (react-markdown), sanitized
- CSP header (configured on Vercel): default-src 'self'; img-src 'self' data: r2.example.com; script-src 'self' checkout.razorpay.com
- No dangerouslySetInnerHTML except with DOMPurify sanitized output
```

### 12.5 Role Enforcement

```
- All role checks are SERVER-ENFORCED — client-side checks are UI-only
- Organizer dashboard: client checks org_memberships, server checks on every request
- College Admin: separate token, server validates college domain scope
- Super Admin: completely isolated bundle, separate token — token mismatch = 401
- Locked event fields (post-sale): server rejects PATCH for locked fields — UI merely reflects this
- Ticket purchase windows: server validates timing — client cannot bypass Early Access windows
```

---

## 13. Testing Strategy

### 13.1 Unit Tests (Vitest)

```
Priority targets:
  - lib/utils.js: date formatting, price formatting, level calculations
  - Business logic hooks: useAuth, useCustomerLevel, useTickets
  - Validation logic: resale price validation, ticket quantity limits
  - Query key factory: constants/queryKeys.js

Test file colocation: *.test.js alongside source files
```

### 13.2 Component Tests (Vitest + React Testing Library)

```
Priority components:
  - Button: all variants, states, keyboard interaction
  - Modal: open/close, focus trap, escape key
  - HypeButton: optimistic update, revert on error
  - TicketTierCard: all states (available, sold out, locked, college-only)
  - QRDisplay: canvas render, blur on focus loss
  - StarRating: keyboard navigation, value setting
  - ResellPage: price validation (above original = error)
  - EventCard: all event states render correctly

Test principles:
  - Test behavior, not implementation
  - Use aria queries (getByRole, getByLabelText) — no test-id reliance
  - Mock API calls with MSW (Mock Service Worker)
```

### 13.3 Integration Tests (Playwright)

```
Critical flows to cover:
  1. Guest browses home → event detail → clicks buy → redirected to login
  2. User logs in via Google OAuth → completes onboarding → browses home
  3. User buys ticket → wallet shows ticket → opens QR
  4. Organizer creates event → publishes → event appears on home
  5. Organizer scans QR at gate → valid ticket → success flash
  6. User hyped event → count increments → un-hype → count decrements
  7. User resells ticket → price above original → validation error shown
  8. Super Admin bans organizer → audit log entry created

Run on: Vercel preview deployments (CI/CD)
Browser targets: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
```

### 13.4 Accessibility Tests

```
Automated (axe-core via @axe-core/playwright):
  - Run on every page in Playwright suite
  - Assert zero critical violations

Manual (periodic):
  - Keyboard-only navigation of purchase flow
  - Screen reader test (NVDA/VoiceOver) on EventCard, Modal, QRDisplay
  - Color contrast validation (theme.md known gap: sage + small text — verify)
```

---

## 14. Deployment & Maintainability

### 14.1 Environment Variables

```env
# .env.example
VITE_API_BASE_URL=https://festify-api.onrender.com
VITE_RAZORPAY_KEY_ID=rzp_live_xxxx
VITE_FCM_VAPID_KEY=xxxx
VITE_FIREBASE_API_KEY=xxxx
VITE_FIREBASE_PROJECT_ID=xxxx
VITE_R2_PUBLIC_URL=https://media.festify.com
VITE_SENTRY_DSN=xxxx                    # error monitoring
VITE_ENVIRONMENT=production             # production | staging | development
```

### 14.2 Vercel Configuration

```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; img-src 'self' data: https://media.festify.com; script-src 'self' https://checkout.razorpay.com; frame-src https://api.razorpay.com" }
      ]
    }
  ],
  "github": {
    "enabled": true,
    "silent": true
  }
}
```

### 14.3 Build Configuration

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':      ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':      ['@tanstack/react-query'],
          'vendor-state':      ['zustand'],
          'vendor-ui':         ['framer-motion'],
          'super-admin':       ['./src/features/super-admin/index.jsx'],   // isolated
          'organizer':         ['./src/features/organizer/index.jsx'],
          'college-admin':     ['./src/features/college-admin/index.jsx'],
        }
      }
    },
    sourcemap: false,       // disable in production (security)
    minify: 'terser',
    target: 'es2020'
  },
  resolve: {
    alias: { '@': '/src' }
  }
});
```

### 14.4 Naming Conventions

```
Files:      PascalCase for components (EventCard.jsx), camelCase for hooks/utils
CSS:        BEM-inspired (block__element--modifier) or CSS Modules per component
Query keys: snake_case strings organized in queryKeys factory
API funcs:  verbNoun pattern (getEvent, createTicket, listEvents)
Zustand:    camelCase store methods (setUser, clearAuth, openModal)
Constants:  SCREAMING_SNAKE_CASE (EVENT_STATES, CUSTOMER_LEVELS)
Routes:     Centralized in constants/routes.js — no hardcoded strings in components
```

### 14.5 Component Responsibilities

```
RULE: Each component does ONE thing.

primitives/   → Pure UI, zero business logic, fully props-driven
domain/       → Composed from primitives, domain-aware (knows event/ticket shape)
features/     → Full pages, contains data fetching (React Query hooks), business logic
hooks/        → Data fetching + derived state only. No JSX.
lib/api/      → HTTP calls only. No state. No UI.
store/        → Global state slices only. No API calls.
```

### 14.6 TBD Field Handling

Per `fullsystem.md §17`, several fields are intentionally deferred. The frontend handles these as:

```
Customer Level Thresholds → ProgressBar renders "..." until server provides thresholds
Prime Level Criteria      → "/me" page shows "Requirements TBD — stay tuned" in label-mono
Prime Pass Pricing        → PrimePassPage shows "₹ — announced soon" in placeholder
Prime Review Multiplier   → Review weight shown as relative: "Prime reviews carry more weight"
Long Ban Duration         → Super Admin ban modal: Stage 4 shows "Extended" with custom input
Free Event Fee            → College events: no fee charged; other free events: fee TBD
Loyalty Vouchers (Prime)  → Voucher section on /me shows "Coming soon" label-mono state
```

---

## Appendix A: Event State Machine → UI Mapping

| State | Visible To | Ticket CTA | QR Scanner | Review |
|---|---|---|---|---|
| Draft | Organizer only | N/A | Off | Off |
| Pending | Organizer only | N/A | Off | Off |
| Live / Early Access | Per visibility | Buy (if in window) | Off | Off |
| On Sale | Per visibility | Buy | Off | Off |
| Sold Out | All | Waitlist | Off | Off |
| Ongoing | All | N/A | ACTIVE | Off |
| Completed | All | N/A | Off | ON (30 days) |
| Postponed | All | Refund request | Off | Off (reset) |
| Cancelled | All | N/A | Off | Off |

---

## Appendix B: Purchase Flow Decision Tree

```
User clicks "BUY TICKET"
  │
  ├─ Not authenticated? → /login (return URL stored)
  │
  ├─ Event state = Sold Out? → Show waitlist CTA
  │
  ├─ Event state = Ongoing / Completed / Cancelled? → Block
  │
  ├─ Ticket tier = College-Only AND user not college-verified? → Block + verify prompt
  │
  ├─ Current window = Prime Early Access AND user not Prime? → "Early access for Prime members"
  │
  ├─ Current window = Prime Pass AND user not Prime/PrimePass? → "Opens for all soon — [countdown]"
  │
  ├─ Quantity > max allowed (10 or 5)? → Bulk request flow
  │
  └─ All checks pass → Ticket selection modal → Order summary → Razorpay → Success
```

---

## Appendix C: Notification Display Rules

Per `fullsystem.md §10`:

```
NO mid-session popups. Promotions only at app launch.
App launch popup for ticket holders: venue/event preview content.

In-app notification feed (/me/notifications):
  - All types listed in the notification table (§10)
  - Unread count badge on bell icon in nav
  - Mark all read button
  - Per-notification dismiss

Push notification handling (WebView):
  - Tapping push → deep-link to relevant page (/events/:id, /me/tickets, etc.)
  - Push shown only when app is backgrounded

User-controllable:
  - Push for: college/big/hyped events, vouchers, wishlist alerts, org broadcasts, reminders
  - NOT controllable: purchase confirmation QR, event cancelled alerts

Notification preferences page (/me/notifications/preferences):
  - Toggle per notification type × channel
  - Only shows controllable types
```

---

## Appendix D: Resale Marketplace Rules → UI

```
Resale listing:
  - Listed_price ≤ purchased_price (enforced: max input = original price)
  - Resale closes 10 minutes before event_start (disabled automatically)
  - College-only tickets: buyer must be verified at same college (filtered server-side)
  
Resale marketplace page (/search → filter: "Resale"):
  - Shows active resale listings for events in On Sale / Live states
  - Sorted by price (cheapest first)
  - College-only listings only visible to verified students of that college

Seller's revoked college verification:
  - Warning banner on ticket: "YOUR COLLEGE VERIFICATION EXPIRED — RESELL TO A VERIFIED STUDENT BEFORE [expiry] OR TICKET WILL BE CANCELLED AND REFUNDED"
  - Automatic cancellation + refund if not resold before expiry (handled server-side, push notification to user)
```

---

*Document generated: 2026-08-14 | Festify Frontend v1.0 | Based on fullsystem.md (654 lines) + Frontend/theme.md (408 lines)*
*Any AI coding agent reading this document has complete information to build the entire Festify frontend without ambiguity.*
