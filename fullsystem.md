# Festify — Full System Document
### College Events & Ticketing Platform | v1.0 (Pre-Schema Architecture)

> **Note on sources:** Sections 1–11 are pulled directly from the *Festify System Design Document* (all 19 pages). Sections 12–14 (Frontend Architecture, Backend API Reference, Lite Database Schema) are **derived/proposed** — the source PDF is explicitly a *pre-schema* document, so no API contracts or table definitions exist yet. Everything proposed here is built to satisfy the exact business rules documented in Sections 1–11. Anything still undecided in the source doc is marked **TBD** and carried through unchanged.

---

## Table of Contents
1. [Platform Overview & Philosophy](#1-platform-overview--philosophy)
2. [Roles & Character System](#2-roles--character-system)
3. [Role Interaction Map](#3-role-interaction-map)
4. [Organizer Group Structure](#4-organizer-group-structure)
5. [Event Lifecycle](#5-event-lifecycle)
6. [Ticketing System](#6-ticketing-system)
7. [Payment & Refund Flows](#7-payment--refund-flows)
8. [Gamification & Scoring](#8-gamification--scoring)
9. [Prime & Prime Pass System](#9-prime--prime-pass-system)
10. [Notification System](#10-notification-system)
11. [Trust & Safety](#11-trust--safety)
12. [Admin Architecture](#12-admin-architecture)
13. [Frontend Architecture (Proposed)](#13-frontend-architecture-proposed)
14. [Backend Architecture & API Reference (Proposed)](#14-backend-architecture--api-reference-proposed)
15. [Lite Database Schema (Proposed)](#15-lite-database-schema-proposed)
16. [Tech Stack Summary](#16-tech-stack-summary)
17. [Pending / TBD Decisions](#17-pending--tbd-decisions)

---

## 1. Platform Overview & Philosophy

**What is Festify?** A college event discovery and ticketing platform — "District by Zomato" but built for the college ecosystem. Anyone (students or general public) can browse. Organizers can be individuals or groups. Events span hackathons, tournaments, parties, cultural shows, and motivational talks.

**Core Design Principles**

| Principle | Meaning |
|---|---|
| Trust is earned, not assumed | New organizers go through approval. Trust-tier upgrades only after proven successful events. |
| One account, many roles | A single user account can simultaneously be an attendee, organizer, Prime member, and Pass holder. |
| Platform is a marketplace | Festify is the legal marketplace. Organizers are fully liable. T&C accepted at onboarding. |
| Free tier, zero infra cost | Entire stack runs on free tiers. Monetization via per-ticket fees and featured listings. |
| Events are the product | Discovery, scoring, trending — everything revolves around making good events surface faster. |
| Prime is prestige, Pass is convenience | Prime badge cannot be bought. Pass gives convenience perks but never Prime status. |

---

## 2. Roles & Character System

### Guest — No account required
- **Can:** Browse & search public events · View event pages/organizer profiles · See trending, hyped, featured events
- **Cannot:** Buy tickets/register · Wishlist/follow/hype/review · See college-only or registered-only events

### User / Attendee — Registered account, Google OAuth only
- **Can:** Buy tickets, request bulk purchases · Resell in-app (price only down, closes 10 min before event) · Gift/share tickets to friends in-app · Wishlist events with smart price/fill alerts · Follow organizers/users · Review & comment after event ends (30-day window) · Hype events · Verify college email for student badge · Earn customer level (Bronze → Silver → Gold → Platinum → Prime) · Report suspicious/fake events · Apply to become organizer
- **Cannot:** Create/manage events until organizer mode approved

### Prime User — Earned, highest attendee tier, never purchasable
- **Can:** Everything a User can, plus: priority access to organizer's Prime early-ticket pool (largest share) · skip bulk-purchase request if organizer enables Prime toggle · hypes/reviews carry more weight · visible to organizer for structured feedback (max 2/event) · shown in organizer's Prime hype list · can turn off organizer contact entirely
- **Cannot:** Be purchased or shortcut to — earned only through attendance and spend

### Prime Pass Holder — Paid monthly/yearly subscription
- **Can:** Everything a User can, plus: smaller early-access pool (opens after Prime window) · support tickets prioritized · platform vouchers/discounts
- **Cannot:** Access Prime-level queue/permissions · earn Prime badge through Pass alone (still needs attendance + spend)

### Organizer (Group) — Group of users, owner applied, members added
- **Can:** Create single/multi-day events, multiple ticket tiers · set visibility (Public/Registered-Only/College-Only) · minor edits anytime, major edits locked after sales begin · manage waitlist, capacity, deadlines · manually deduct tickets for offline sales · upload pre/post images and reels · send max 1-2 push/day to ticket holders · configure Prime early-access pool size · enable Prime bulk-buy toggle · send structured feedback to Prime attendees (max 2/Prime/event) · approve/reject bulk requests (24h window) · full revenue analytics + PDF/Excel export · create 1 free event/month (Verified/Trusted only) · members can personally attend/review/hype other events · private group chat among members
- **Cannot:** Cancel event without mandatory full refund · turn off reviews (comments only) · create new events while banned · directly message Prime users without consent · review their own events as organizer (only as individual member)

### College Admin — Per-college, managed by college committee, separate account
- **Can:** Manage/verify college domain · approve organizer applications within college · moderate college-domain events · create free unlimited college events · view college-scoped analytics
- **Cannot:** Act outside their college domain · see super admin panel · be banned (flagged to super admin only) · access platform-wide or other-college data

### Super Admin — You + your friend. Silent, invisible, fully audit-logged.
- **Can:** Full access to all data/events/users/transactions · override any organizer/college admin action · issue/escalate bans (warning → 7d → 30d → longer) · handle all raised support tickets/reports · manually curate trending/featured listings · configure platform fee/ticket · manage featured-listing payments · view all transaction logs, force refunds · adjust all scoring thresholds/point values · approve/remove any organizer · flag college admins · configure Prime Pass pricing/benefits · optionally grant organizer revenue-share bonus
- **Cannot:** Directly deduct from organizer bank accounts · directly ban college admins (flag only)

---

## 3. Role Interaction Map

| From → To | Interaction |
|---|---|
| Attendee → Organizer | Buy tickets · Hype events · Review after event · Report event · Raise date-change refund ticket |
| Organizer → Attendee | Send max 2 push/day · Feedback requests to Prime attendees only (max 2/Prime/event) · Broadcast system notifications |
| Prime → Organizer | Can block organizer contact · Reviews/hypes carry more weight · Skip bulk request if toggle enabled |
| Organizer → Prime | Cannot direct message · Can send structured feedback only if Prime attended their event |
| Attendee → Attendee | Follow each other · Ticket gifting · In-app ticket sharing for group bookings |
| Org Member → Own Event | Can buy/review as individual user · bias accepted but diluted at scale |
| College Admin → Org | Approve organizer applications within domain · Moderate college-domain events |
| College Admin → Students | Manage college domain verification · No direct user-level actions |
| Super Admin → Everyone | Full override on all roles · Audit-logged · Invisible to all other roles · Flags (not bans) college admins |
| Organizer → Super Admin | Can receive manual bonus/motivation share · Subject to ban escalation |
| User → Support System | Raise tickets → college students route to college admin, others to super admin |

---

## 4. Organizer Group Structure

**Formation**
- Any registered user can apply via the organizer portal.
- Application raises a support ticket — routed to college admin if college-affiliated, else super admin.
- States: `Pending → Approved / Rejected`.
- Approved applicant becomes **Org Owner**, can invite members.
- One person can own or belong to multiple org groups simultaneously.
- No group-size limit defined yet (open, flagged in Pending for Later).

**Member Dual Identity** — every org member keeps their full individual identity:

| As Individual User | As Org Member |
|---|---|
| Buy tickets to any event incl. own org's | Co-manage assigned org events |
| Earn Prime through attendance/spend | Access org dashboard if permitted |
| Purchase Prime Pass | Participate in org group chat |
| Hype and review events | Be credited on org's event pages |
| Review own org's events (bias accepted at scale) | |

**Trust Tiers**

| Tier | Condition | Privileges |
|---|---|---|
| New | Just approved | Manual approval required before each event goes live |
| Verified | 3+ successful events | Auto-publish enabled · 1 free event/month |
| Trusted | 7+ successful events | Auto-publish · Free events · Priority support routing |

★ *Successful event = 70%+ of attendees give ≥3.5 stars. All thresholds configurable by super admin.*

---

## 5. Event Lifecycle

**States**

| State | Meaning |
|---|---|
| Draft | Organizer building the event. Not visible to anyone. |
| Pending | New org — waiting for admin approval before going live. |
| Live | Published and visible. Tickets per visibility setting. |
| Early Access | Prime window open. General sale not yet open. |
| On Sale | General sale open after all early access windows close. |
| Sold Out | All tickets sold. Waitlist active if organizer enabled it. |
| Ongoing | Event day. QR scanning active. |
| Completed | Event ended. Review window opens (30 days). Score calculated. |
| Postponed | Date changed. Review window resets. Attendees can raise refund ticket. |
| Cancelled | Organizer/admin cancelled. Full refund mandatory. Hurts organizer score. |

**Edit Rules**

| Edit Type | Allowed When | Notes |
|---|---|---|
| Minor edits (description, images) | Anytime | No restriction |
| Major edits (date, venue, tier pricing) | Before first ticket sold | Locked after sales begin |
| Capacity increase | Anytime via waitlist | Organizer controlled |
| Cancellation | Anytime | Full refund mandatory; late cancellation hurts score |
| Date change (postpone) | Anytime | Attendees can raise refund ticket if new date doesn't work |

**Ticket Access Windows (Early Access Flow)**

```
PRIME WINDOW  →  PRIME PASS WINDOW  →  GENERAL SALE
Largest pool     Smaller pool           Remaining + unsold from above
First-come        Opens after Prime      Everyone can buy
Primes notified   Pass holders notified
```

---

## 6. Ticketing System

**Ticket Tiers** (organizer defines name/price/quantity per tier): VIP · General · Early Bird (deal + expiry) · College-Only (verified students only)

**Purchase Rules**

| Rule | Detail |
|---|---|
| Max tickets/person | Large events (>200 cap): 10 max · Small events (≤200 cap): 5 max |
| Bulk purchase | Request system, organizer approves within 24h. One-time use/event. Primes skip if toggle enabled. |
| Group booking | Main buyer purchases bulk, shares in-app to named friends. Recipient named on ticket, expires after scan. |
| Unregistered recipient | Counted manually at gate by organizer. |
| Ticket gifting | Within-platform friend-to-friend only. No external sharing. |

**Resale Rules**
- In-app only, no external reselling.
- Price can only go **down** from original purchase price.
- Resale closes 10 minutes before event start.
- College-only tickets resellable only to verified students of same college.
- If seller's college verification is revoked: can sell to another verified student before expiry, else ticket cancelled + refunded.

**Ticket Theft & QR Security**

| Rule | Detail |
|---|---|
| Scanning method | App-only QR scan. Screenshots don't work. |
| Once scanned | Ticket expires immediately, cannot be rescanned. If thief scans first, nothing can be done. |
| Theft report window | Must be raised ≥1 hour before event starts. |
| Reports per ticket | Max 2 theft reports per ticket per customer. |
| After 2 reports | Must raise support ticket → college student to college admin, others to super admin. |
| On valid report | Old QR + booking code deactivated, new ticket generated. |

---

## 7. Payment & Refund Flows

**Platform Fee** — per-ticket fee on every transaction, no free tier for organizers (prevents multi-account abuse). Fee % **TBD**, configured by super admin. Free events: nominal charge to prevent spam listings; college admin events exempt.

**Refund Policy**

| Time Before Event | Refund Amount | Platform Fee |
|---|---|---|
| Early cancellation | 100% ticket price | Super admin decides case by case |
| Mid window | 75% ticket price | Super admin decides case by case |
| Late cancellation | 50% ticket price | Super admin decides case by case |
| Very close to event | No refund | N/A |
| Event cancelled by organizer | 100% mandatory | Returned with ticket price |

Razorpay transaction fee is **never** refunded regardless of scenario.

**Organizer Ban & Refund Flow**
1. Organizer is banned
2. All active events frozen
3. Refund process triggered for all ticket holders
4. Ticket price + platform fee returned
5. Ban fully applied after all refunds confirmed
6. Existing events must still run if ban isn't fraud-related

**Featured Listing Payment** — organizers pay for Trending/Featured placement, mostly manual curation by super admin. Flow details **TBD**.

**Super Admin Bonus** — optional revenue-share bonus to motivate organizers. Manual, fully audit-logged.

---

## 8. Gamification & Scoring

**Customer Levels** (earned via attendance + spend, never decay)

`Bronze → Silver → Gold → Platinum → Prime`

- **Bronze:** entry level, just registered + attended first event
- **Silver:** growing attendance and spend
- **Gold:** consistent attendee, meaningful spend
- **Platinum:** high-value customer, significant history
- **Prime:** top tier, earned only, cannot be purchased — unlocks special privileges

Thresholds are **TBD**, configurable by super admin.

**Organizer Score — Per Successful Event** (successful = 70%+ attendees give ≥3.5 stars, threshold configurable)

| Condition | Points |
|---|---|
| Event successful, 500+ attendees | attendees ÷ 2 points |
| Event successful, under 500 attendees | Flat 500 points |
| Each 3-star rating | 5 points |
| Each 4-star rating | 7 points |
| Each 5-star rating | 10 points |
| Prime review | Weighted higher (multiplier **TBD**) |
| Event cancelled (organizer fault) | Score penalty (amount **TBD**) |

Score rank shown publicly under every event page (e.g. "#3 Event Organizer"). All values configurable by super admin.

**Hype System**
- Any user can hype an event (like/bookmark + social signal).
- Prime hypes count more toward organizer's hype score.
- Organizers see total hype count + list of Primes who hyped.
- Hype count feeds the trending algorithm.

**Review System**
- Only ticket buyers can review.
- Review window: event day → 30 days after event. Resets to 30 days from new date if postponed.
- Prime reviews carry more weight on organizer success score.
- Bad word detection + content moderation active.
- College events: reviews/comments off by default, organizer can enable.
- Small personal orgs: can turn off comments, cannot turn off reviews.
- Minimum 10 reviews + 2 consecutive events below 2.0 stars before ban consideration.

---

## 9. Prime & Prime Pass System

Two distinct systems — one earned, one purchased. **Never interchangeable.**

| Feature | PRIME | PRIME PASS |
|---|---|---|
| What is it? | Top attendee tier — highest customer level | Paid subscription — monthly or yearly |
| How to get it? | Earned via attendance + spend. Cannot be purchased. | Purchase — no attendance requirement |
| Badge | Prime symbol on profile — cannot be bought | Prime Pass symbol on profile |
| Early ticket access | Largest pool, first window | Smaller pool, second window (after Prime) |
| Bulk buy | Skip request if organizer enables toggle | Standard request system |
| Review weight | Higher weight on organizer score | Standard weight |
| Hype weight | Higher weight on hype score | Standard weight |
| Org contact | Can receive feedback requests (max 2/event); can block org contact | Not included |
| Support priority | Standard (same as any user) | Prioritized above regular users |
| Vouchers | None from Pass — loyalty program vouchers **TBD** | Platform vouchers + discounts included |
| Decay | No decay — permanent once earned | Expires when subscription lapses |

A user can hold **both** Prime badge and Prime Pass simultaneously. In all queues/systems, earned Prime always takes priority over Pass.

---

## 10. Notification System

| Trigger | Email | In-App | Push | User Can Disable? |
|---|---|---|---|---|
| Purchase confirmation + QR | ✓ | ✓ | — | No — always sent |
| College / big / hyped event | — | ✓ | ✓ | Push only |
| Vouchers / offers | ✓ | ✓ | ✓ | Push only |
| Wishlist alert (price drop / filling up) | — | ✓ | ✓ | Only if event not wishlisted |
| Org push to ticket holders | — | ✓ | ✓ | Push only, max 1-2/day from org |
| Smart reminders (event soon, venue change) | — | ✓ | ✓ | Push only |
| Event cancelled | ✓ | ✓ | ✓ | No — always sent |

- No mid-session popups. Promotions shown only at app launch.
- Ticket holders get an app-launch popup showing venue/event preview content.

---

## 11. Trust & Safety

**Organizer Ban Escalation**

| Stage | Duration | Trigger |
|---|---|---|
| Warning | None | First violation — minor issue |
| Short ban | 7 days | Repeated or moderate violation |
| Mid ban | 30 days | Serious violation |
| Long ban | Longer (**TBD**) | Severe or repeated serious violations |

Minimum 10 reviews + 2 consecutive events below 2.0 stars before automatic ban consideration. College admins cannot be banned — flagged to super admin only.

**Support Ticket Routing**

| Ticket Type | Routes To |
|---|---|
| Theft report (college student) | College Admin |
| Theft report (non-student) | Super Admin |
| Organizer application (college-affiliated) | College Admin |
| Organizer application (non-affiliated) | Super Admin |
| Event report / flag | Super Admin |
| Date-change refund request | Organizer first, then escalates |
| College admin issue | Super Admin only |
| Org feedback request to Prime | Direct to Prime user (not admin) |

**Content Moderation**
- Bad word detection on all reviews and comments.
- Respectful content policy enforced.
- Reviews open only after event ends — no pre-event manipulation.
- Organizer-uploaded images/reels moderated by platform.
- Open chat page per event (post-event) — moderation approach to be finalized later.

---

## 12. Admin Architecture

**College Admin**
- One or more admins per college, managed by college committee.
- Scoped entirely to their college domain — cannot act outside it.
- Approves organizer applications within college. Moderates college-domain events.
- Creates unlimited free college events, no platform charges.
- Cannot see super admin panel. Cannot be banned — violations flagged to super admin only.

**Super Admin**
- Only you + your friend — separate auth, **not stored in the users table**.
- Invisible to all roles including college admins.
- Every action audit-logged (timestamp, action type, target, metadata).
- Full platform override on any user, org, event, or transaction.
- Configures all scoring thresholds, point values, platform fee, Prime Pass pricing.
- Curates trending/featured listings manually. Handles all non-college-routed support tickets.
- Can grant organizer bonus share (manual, audit-logged). Flags (not bans) college admins.

---

## 13. Frontend Architecture (Proposed)

**Stack:** React (Vercel) as the single web app; a WebView wrapper packages the same app for iOS/Android distribution — no separate native codebase.

### 13.1 Route / Page Map

```
/                         → Home / Discovery feed (trending, hyped, featured, near-me/college)
/events/:id               → Event detail page (tiers, hype count, reviews, organizer profile)
/search                   → Search & filters (category, college, date, price)
/login                    → Google OAuth entry
/onboarding               → T&C acceptance, college email verification

--- Attendee-authenticated ---
/me                       → Profile, customer level progress, Prime status
/me/tickets                → My tickets (valid/used/expired), QR display
/me/tickets/:id/resell      → Resale listing flow
/me/tickets/:id/gift         → Gift/share flow
/me/wishlist               → Wishlist + smart alerts
/me/following               → Followed organizers/users
/me/reviews                 → Reviews submitted (within 30-day windows)
/me/prime-pass              → Subscribe/manage Prime Pass
/organizer-application      → Apply to become organizer

--- Organizer dashboard (org-scoped) ---
/org/:orgId/dashboard        → Overview, trust tier, revenue analytics
/org/:orgId/events           → Event list (draft/live/completed)
/org/:orgId/events/new         → Event builder (tiers, visibility, capacity)
/org/:orgId/events/:id/edit     → Minor/major edit (locked fields post-sale)
/org/:orgId/events/:id/scan      → QR scanner (event day, ongoing state)
/org/:orgId/events/:id/bulk-requests → Approve/reject (24h SLA)
/org/:orgId/events/:id/feedback     → Send Prime feedback requests
/org/:orgId/members           → Manage org members
/org/:orgId/chat               → Private org group chat
/org/:orgId/analytics/export    → PDF/Excel export

--- College Admin panel (separate auth) ---
/college-admin/applications    → Approve/reject organizer applications
/college-admin/events          → Moderate college-domain events
/college-admin/create-event     → Free college event creation

--- Super Admin panel (separate auth, hidden route/subdomain) ---
/superadmin/dashboard          → Platform-wide metrics
/superadmin/organizers          → Approve/ban/bonus actions
/superadmin/college-admins       → Flag college admins
/superadmin/config                → Scoring thresholds, platform fee, Prime Pass pricing
/superadmin/support-tickets        → Ticket queue not routed to college admins
/superadmin/trending-curation       → Manual trending/featured curation
/superadmin/audit-log                 → Full audit trail
```

### 13.2 Component Layers
- **Design system layer:** shared Button/Card/Modal/Toast/Table components, theming for role-specific dashboards.
- **Feature modules:** `discovery`, `event-detail`, `ticketing`, `wallet` (tickets/resale/gift), `organizer-dashboard`, `admin-panel`, `notifications`, `gamification` (level/score widgets).
- **Data layer:** thin API client per backend service (auth, events, tickets, payments, notifications, media, search, admin, score) matching Section 14; React Query/SWR-style caching for lists (events, tickets, notifications).
- **Auth layer:** three separate auth contexts — attendee/organizer (Google OAuth, shared users table), college admin (separate login), super admin (separate login, isolated route bundle, not linked to public app shell).

### 13.3 Mobile Distribution
- WebView wrapper (Android/iOS shells) loads the same Vercel-hosted React app.
- Native bridge only needed for: push notification token registration (Firebase FCM) and camera access (QR scanning for organizers, and QR display/scan for gate entry).

---

## 14. Backend Architecture & API Reference (Proposed)

FastAPI on Render.com, split into the 9 documented services: **Auth, User, Event, Ticket, Payment, Notification, Media, Search, Admin, Score**. Each below lists endpoints derived from the functional rules in Sections 1–11.

### 14.1 Auth Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/google` | Google OAuth login/signup (only method for User/Attendee) |
| POST | `/auth/college-verify` | Verify college email domain → issues student badge |
| POST | `/auth/college-admin/login` | Separate login for College Admin |
| POST | `/auth/superadmin/login` | Separate, isolated login — not in `users` table |
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current authenticated identity + role(s) |

### 14.2 User Service
| Method | Endpoint | Purpose |
|---|---|---|
| GET/PATCH | `/users/{id}` | Profile read/update |
| GET | `/users/{id}/level` | Customer level (Bronze→Prime) + progress |
| GET | `/users/{id}/prime-status` | Prime badge / Prime Pass status |
| POST/DELETE | `/users/{id}/follow` | Follow / unfollow |
| GET | `/users/{id}/followers`, `/following` | Social graph |
| POST | `/organizer-applications` | Apply to become organizer (routes per college affiliation) |
| GET | `/organizer-applications/{id}` | Application status |
| POST/DELETE | `/users/{id}/wishlist/{eventId}` | Wishlist management |
| POST | `/users/{id}/report` | Report suspicious/fake event or account |
| POST | `/users/{id}/prime-pass/subscribe` | Purchase/renew Prime Pass |
| DELETE | `/users/{id}/prime-pass` | Cancel Prime Pass (expires at period end) |

### 14.3 Event Service (incl. Organizer Group management)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/org-groups` | Create org group (owner, post-approval) |
| POST/DELETE | `/org-groups/{id}/members` | Add/remove members |
| GET | `/org-groups/{id}` | Group profile, trust tier, successful-event count |
| POST | `/events` | Create draft event |
| PATCH | `/events/{id}` | Edit (minor anytime; major locked after first sale) |
| GET | `/events/{id}` | Event detail |
| GET | `/events` | List/filter (delegates ranking to Search service) |
| POST | `/events/{id}/publish` | Draft → Pending/Live (auto per trust tier) |
| POST | `/events/{id}/cancel` | Triggers mandatory full refund flow |
| POST | `/events/{id}/postpone` | Date change, resets review window, opens refund-request eligibility |
| POST | `/events/{id}/capacity` | Increase capacity / manage waitlist |
| POST | `/events/{id}/prime-pool-config` | Set Prime/Pass early-access pool sizes, bulk-buy toggle |
| GET | `/events/{id}/analytics` | Revenue dashboard |
| GET | `/events/{id}/analytics/export` | PDF/Excel export |

### 14.4 Ticket Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/events/{id}/tiers` | Define ticket tiers (VIP/General/Early Bird/College-Only) |
| POST | `/tickets/purchase` | Standard purchase (enforces per-person max, tier windows) |
| POST | `/tickets/bulk-request` | Bulk purchase request |
| POST | `/tickets/bulk-request/{id}/approve` \| `/reject` | Organizer decision (24h SLA) |
| POST | `/tickets/{id}/gift` | Friend-to-friend gift (in-platform only) |
| POST | `/tickets/{id}/share` | Group-booking share to named recipient |
| POST | `/tickets/{id}/resell` | List for resale (price ≤ original, closes 10 min pre-event) |
| GET | `/tickets/resale-marketplace` | Active resale listings (college-scoped where relevant) |
| POST | `/tickets/{id}/scan` | Gate QR scan (organizer app) — expires ticket instantly |
| POST | `/tickets/{id}/report-theft` | Theft report (max 2 per ticket per customer, ≥1h before event) |
| POST | `/tickets/manual-deduct` | Offline sale manual deduction |
| GET | `/users/{id}/tickets` | Wallet — all tickets by status |

### 14.5 Payment Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/payments/checkout` | Create Razorpay order (ticket price + platform fee) |
| POST | `/payments/webhook` | Razorpay payment/refund callbacks |
| POST | `/payments/{id}/refund` | Apply refund tier (100/75/50/0%) or mandatory 100% (org cancel) |
| GET | `/payments/{id}` | Transaction detail |
| GET | `/org-groups/{id}/payouts` | Organizer payout ledger |
| POST | `/events/{id}/featured-listing/pay` | Pay for trending/featured placement |
| POST | `/admin/organizer-bonus` | Super admin manual revenue-share bonus (audit-logged) |

### 14.6 Notification Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/notifications/send` | Internal dispatch (email/in-app/push per matrix in §10) |
| GET | `/users/{id}/notifications` | In-app notification feed |
| PATCH | `/users/{id}/notification-preferences` | Per-type opt-out (where allowed) |
| POST | `/org-groups/{id}/push-to-attendees` | Organizer broadcast (max 1-2/day enforced server-side) |
| POST | `/org-groups/{id}/feedback-request` | Structured Prime feedback (max 2/Prime/event enforced) |

### 14.7 Media Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/media/upload` | Upload images/reels/QR/exports → Cloudflare R2 |
| GET | `/media/{id}` | Fetch asset |
| DELETE | `/media/{id}` | Remove asset (moderation or organizer action) |

### 14.8 Search Service
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/search/events` | Query + filters (category, college, date, price, visibility) |
| GET | `/search/organizers` | Organizer/profile search |
| GET | `/trending` | Trending algorithm output (hype + score weighted) |
| GET | `/featured` | Curated/paid featured listings |

### 14.9 Admin Service (College Admin + Super Admin)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/support-tickets` | Queue, filtered by routing rules (§11) |
| POST | `/admin/support-tickets/{id}/resolve` | Close/escalate ticket |
| POST | `/college-admin/organizers/{id}/approve` \| `/reject` | Scoped to college domain |
| POST | `/college-admin/events/{id}/moderate` | Moderate college-domain event |
| POST | `/superadmin/organizers/{id}/ban` | Escalation stage (warning/7d/30d/long) |
| POST | `/superadmin/college-admins/{id}/flag` | Flag (never ban) |
| PATCH | `/superadmin/config/scoring` | Thresholds, point values |
| PATCH | `/superadmin/config/platform-fee` | Per-ticket fee % |
| PATCH | `/superadmin/config/prime-pass-pricing` | Monthly/yearly pricing |
| POST | `/superadmin/trending/curate` | Manual curation |
| GET | `/superadmin/audit-log` | Full audit trail (all super admin actions) |

### 14.10 Score Service
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/events/{id}/reviews` | Submit review (ticket buyers only, within window) |
| GET | `/events/{id}/reviews` | List reviews (moderated) |
| POST | `/events/{id}/hype` | Hype an event |
| GET | `/events/{id}/hype-list` | Primes who hyped |
| POST | `/events/{id}/calculate-score` | Internal — triggered on `Completed` state |
| GET | `/org-groups/{id}/score` | Organizer score + public rank |
| GET | `/users/{id}/customer-level` | Level + next-tier progress |

---

## 15. Lite Database Schema (Proposed)

Core tables only — column lists are indicative, not exhaustive DDL. Grouped by domain.

**Identity & Roles**
- `users` — id, google_id, email, name, avatar_url, college_id (nullable), college_verified (bool), customer_level (enum), is_prime (bool), prime_since, created_at
- `college_domains` — id, college_name, domain
- `college_admins` — id, name, college_id, credentials (separate auth)
- `super_admins` — id, name, credentials (separate auth, isolated table — never joined to `users`)

**Organizer Groups**
- `org_groups` — id, owner_user_id, name, trust_tier (new/verified/trusted), successful_events_count, is_banned, ban_stage, ban_expires_at, created_at
- `org_members` — id, org_id, user_id, role (owner/member), joined_at
- `organizer_applications` — id, user_id, college_affiliated (bool), college_id, status, routed_to, reviewed_by, created_at

**Events & Ticketing**
- `events` — id, org_id, title, description, category, visibility, state, venue, start_date, end_date, capacity, waitlist_enabled, prime_pool_size, prime_pass_pool_size, prime_bulk_toggle, published_at, created_at
- `ticket_tiers` — id, event_id, name, price, quantity, sold_count, deal_expiry, college_only (bool)
- `tickets` — id, tier_id, event_id, owner_user_id, purchaser_user_id, status (valid/used/expired/cancelled/theft_reported), qr_hash, booking_code, gifted_from_user_id, purchased_at, scanned_at
- `bulk_purchase_requests` — id, event_id, requester_id, quantity, status, requested_at, decided_at
- `resale_listings` — id, ticket_id, seller_id, listed_price, status, listed_at, closes_at
- `theft_reports` — id, ticket_id, reporter_id, report_count, status, created_at

**Payments**
- `transactions` — id, user_id, event_id, ticket_ids[], amount, platform_fee, razorpay_payment_id, status, created_at
- `refunds` — id, transaction_id, amount, platform_fee_refunded (bool), reason, status, processed_at
- `payouts` — id, org_id, amount, status, period, processed_at
- `featured_listings` — id, event_id, payment_id, status, curated_by, start_date, end_date

**Gamification**
- `reviews` — id, event_id, user_id, rating, comment, is_prime_review (bool), moderated (bool), created_at
- `hypes` — id, event_id, user_id, is_prime (bool), created_at
- `organizer_scores` — id, org_id, event_id, points, breakdown (json), created_at
- `scoring_config` — key, value (platform_fee_pct, prime_review_multiplier, ban_durations, successful_event_threshold, level_thresholds, etc. — all super-admin editable)

**Social & Personalization**
- `follows` — id, follower_id, following_id, created_at
- `wishlists` — id, user_id, event_id, created_at
- `prime_pass_subscriptions` — id, user_id, plan (monthly/yearly), status, started_at, expires_at

**Notifications**
- `notifications` — id, user_id, type, channel, payload, sent_at, read_at
- `notification_preferences` — id, user_id, type, email_enabled, push_enabled, in_app_enabled
- `organizer_feedback_requests` — id, event_id, org_id, prime_user_id, message, sent_at

**Trust, Safety & Admin**
- `support_tickets` — id, type, raised_by, routed_to, status, created_at, resolved_at
- `audit_log` — id, actor_id (super admin), action_type, target_type, target_id, metadata (json), timestamp
- `media_assets` — id, owner_type (event/user), owner_id, type (image/reel/qr/export), url, uploaded_at

---

## 16. Tech Stack Summary

Fully free-tier infrastructure. **Total cost = ₹0** (except Razorpay's per-transaction fee split).

| Layer | Service | Role | Cost |
|---|---|---|---|
| Backend | FastAPI on Render.com | All API services — Auth, Events, Tickets, Payments, Notifications, Media, Search, Admin, Score | Free |
| Database | Supabase (PostgreSQL) | Primary data store | Free |
| Cache | Upstash Redis | Sessions, rate limiting, leaderboard, fast reads | Free |
| Storage | Cloudflare R2 | Images, reels, QR codes, exports | Free |
| Email | Resend.com | Ticket confirmation, QR delivery, notifications | Free |
| Push Notifications | Firebase FCM | Push to mobile/web | Free |
| Payments | Razorpay | Ticket purchases, refunds, payouts | % platform fee per transaction |
| Frontend | Vercel | React web app | Free |
| Mobile | WebView wrapper | Wraps web app for mobile distribution | Free |

**Backend Services (FastAPI):** Auth · User · Event · Ticket · Payment · Notification · Media · Search · Admin · Score

**Work Split**
- **Vatsal (you):** Backend, Database, Storage, Payments, Notifications, Email, Auth, all APIs
- **Friend:** Frontend (React) — all UI components and pages on Vercel

---

## 17. Pending / TBD Decisions

Do **not** finalize schema fields or API contracts around these — they're intentionally deferred in the source doc:

| Item | Status |
|---|---|
| Open Chat Page (per-event, post-event) | Moderation approach not finalized |
| Customer Group Chat | Deprioritized — WhatsApp fills this need; revisit post-launch |
| Razorpay Fee Details | Exact %, split config, platform-fee refund handling — TBD |
| Customer Level Thresholds | Exact spend/attendance for Bronze→Silver→Gold→Platinum→Prime — TBD |
| Prime Level Thresholds | Exact criteria for earning Prime — TBD |
| Organizer Score Penalty | Points deducted for cancelled events — amount TBD |
| Prime Review Multiplier | Exact weighting multiplier — TBD |
| Prime Pass Pricing | Monthly/yearly price — TBD, set after launch data |
| Long Ban Duration | 4th escalation stage length — TBD |
| Free Event Platform Fee | Exact nominal charge — TBD |
| Max Org Group Size | No limit defined — may need a cap, revisit |
| Featured Listing Payment Flow | Mostly manual curation — payment flow details TBD |
| Loyalty Program Vouchers (Prime) | TBD |
