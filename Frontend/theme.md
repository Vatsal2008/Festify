---
version: alpha
name: "Elicit"
website: "https://elicit.com"
description: >-
  An AI research assistant for academic literature whose design reaches into library science rather than tech — deep teal (#083d44) anchors every structural surface while a chartreuse accent (#e5ff97) marks interactive highlights, and three typefaces share the page without competing: Martina Plantijn (a seriffed display for headlines), Special Gothic Variable (a condensed grotesque for body text), and DM Mono (a fixed-width face for section labels and timestamps in uppercase), together constructing a visual grammar that reads as journal stacks, card catalogs, and academic marginalia rather than as startup marketing.

seo:
  title: "Elicit Design System for React — deep teal + chartreuse, Martina Plantijn + Special Gothic, 15 components"
  metaDescription: "Elicit's design system layers a serif display face, condensed grotesque body, and mono uppercase labels over a deep teal and off-white canvas. Tokens for React, Next.js, and AI coding tools via DESIGN.md."
  highlights:
    - "Three-typeface system — Martina Plantijn serif for display, Special Gothic Variable grotesque for body, DM Mono uppercase for labels; each occupies a non-overlapping typographic tier"
    - "Deep teal (#083d44) as structural ink — used for text (113), bg (55), and border (113), functioning simultaneously as the darkest canvas and the primary text color"
    - "Chartreuse accent (#e5ff97) — acid-bright against the teal and cream surfaces; the only non-neutral brand color in the system, used for CTAs and interactive highlights"
    - "Off-white canvas (#fcfcf8) with a barely-perceptible warm tint — the system's parchment substitute for academic publishing aesthetics"
    - "Library-search UI archetype — the hero section contains a search-input field and database-count display rather than a standard headline-plus-CTA pattern"
  tags:
    - "AI & LLM Platforms"
    - "Education & Learning"
  lastUpdated: "2026-05-18"
  author:
    name: "Dov Azencot"
    url: "https://x.com/dovazencot"
  opening: |
    Elicit's marketing page is a library catalog before it is a product page. The hero presents a search field as the primary CTA — not a button, not a headline-led pitch, but a white input field with placeholder text ("e.g., Does zinc improve the duration of the common cold?") sitting in the center of an off-white canvas with institution logos (NASA, Stanford, Cornell, Harvard, Tulane) ranged below. The visual grammar quotes academic search rather than consumer software. Where Semantic Scholar, PubMed, and Google Scholar maintain either institutional austerity or consumer-web flatness, Elicit assembles the typography of a journal — display headlines in Martina Plantijn (a Dutch serif with old-style proportions), body text in Special Gothic Variable (a condensed grotesque that packs information at the column density of a printed abstract), and section labels in DM Mono uppercase (a fixed-width face that reads as archival notation).

    The DESIGN.md file packages the system into 15 color tokens, 12 typography tokens, 7 border-radius steps, 8 spacing values, and 15 component definitions. Color is spare: deep teal (#083d44) runs every surface that isn't the off-white canvas (#fcfcf8), and a single chartreuse accent (#e5ff97) appears as the primary CTA fill and as the "Search" interactive highlight — the only chromatic non-neutral in the system. The teal carries an unusual load: it functions simultaneously as the dark background for the hero band and the "Stand on the shoulders of giants" section, AND as the primary text and border color on the off-white sections below the fold. One hue, two roles.

    Feed this file to an AI coding tool and it reproduces Elicit's specific moves: off-white parchment instead of pure white, deep teal as both text and background depending on section context, three-typeface stratification by semantic role, and chartreuse reserved for the single most important interactive moment on each section. The system rewards attention if you're building a research, documentation, or data-extraction product that needs to signal credibility through typographic precision rather than through gradient fills and illustration.

  related:
    - href: "/design"
      title: "Browse all design systems"
      description: "The full directory of DESIGN.md files on shadcn.io, with live mockups for each."
    - href: "https://elicit.com"
      title: "Elicit — official site"
      description: "Elicit's public marketing site — the source of truth for the live tokens captured in this file."
    - href: "https://github.com/google-labs-code/design.md"
      title: "The DESIGN.md specification"
      description: "Google Labs' open spec for machine-readable design system files — the format this page is built on."
  questions:
    - id: "primary-color"
      title: "What is Elicit's primary brand color?"
      answer: "Elicit does not follow the single-voltage CTA pattern common in SaaS design. The structural foundation is deep teal (#083d44), which functions simultaneously as the dark section background, the primary text color on off-white, and the primary border color — 281 total occurrences as text (113), bg (55), and border (113). The sole chromatic accent is chartreuse (#e5ff97) with 8 total occurrences, used for the primary search button fill, a gradient stop, and interactive highlights. If you need to identify 'the brand color' for a CTA, chartreuse is the correct token; if you need the brand's typographic voice, deep teal is the structural anchor."
    - id: "typography"
      title: "What typefaces does Elicit use, and what can I substitute?"
      answer: "Elicit runs three typefaces in strict role separation. Martina Plantijn Regular — a Dutch serif with old-style proportions — handles display headlines at 48-64px weight 400; it appears on the hero h1 ('AI for Scientific Research') and section feature headlines. Special Gothic Variable (a condensed grotesque) handles all body text at 15-27px at weight 400; it runs the hero subtext, feature descriptions, and card body paragraphs. DM Mono handles section labels and timestamps at 14.4px in weight 500 uppercase. For substitutes: Freight Display Pro or EB Garamond approximate Martina Plantijn at display sizes; Barlow Condensed or Aktiv Grotesk Condensed works for Special Gothic Variable at 16px body; any monospace (IBM Plex Mono, JetBrains Mono) at weight 500 uppercase for DM Mono labels."
    - id: "canvas-color"
      title: "What background color does Elicit use?"
      answer: "The main canvas is #fcfcf8, an off-white with a barely-perceptible warm-yellow tint. It clusters perceptually with pure white but is intentionally distinct — the faint warmth reads as paper or parchment, supporting the academic publishing aesthetic. The extraction merged #fcfcf8, #ffffff, and #f6f8f8 into a single token because of their near-identity. Sections that carry the deep teal (#083d44) as background — the hero band and the 'Stand on the shoulders of giants' section — flip the canvas entirely to dark; there is no mid-range gray or charcoal surface in between. The system operates in binary: off-white or deep teal."
    - id: "how-teal-is-used"
      title: "How does the deep teal work as both text and background?"
      answer: "Deep teal (#083d44) with 281 total occurrences serves two non-overlapping roles. On off-white sections (#fcfcf8 canvas), teal functions as the primary text color and hairline border, replacing the near-black that most design systems use as ink — this gives body text a slightly warmer, less harsh read than pure black while maintaining the academic color authority. On the hero band and the feature section, teal flips to a full-bleed section background with off-white or chartreuse text on top of it. There is no single 'teal as CTA' usage — the chartreuse accent handles the interactive fill role exclusively."
    - id: "use-in-project"
      title: "Can I use this DESIGN.md to build a research-tool or knowledge-base interface?"
      answer: "Yes — the file captures Elicit's three-typeface stratification, dual-role teal system, and chartreuse accent in portable token form. Feed it to Claude or Cursor and the tool can reproduce the specific construction: Martina Plantijn serif headlines at 48-64px for section titles, Special Gothic Variable condensed body at 17.6px, DM Mono uppercase labels for metadata, off-white canvas with teal text, and chartreuse-filled search buttons. One consideration: Martina Plantijn is not openly licensed. The closest freely available serifs that maintain the old-style proportions at display sizes are EB Garamond (from Google Fonts) and Fraunces. The DESIGN.md tokens document the extracted family names; you will need to swap to an available substitute for production."

mockups:
  - "marketing-hero"
  - "editorial-article"

colors:
  ink: "#083d44"
  ink-deep: "#09272b"
  canvas: "#fcfcf8"
  surface-sage: "#f3f6e4"
  surface-cool: "#e8eced"
  primary: "#026370"
  accent: "#e5ff97"
  link-blue: "#0000ee"
  hairline: "#000000"
  hairline-light: "#083d44"

typography:
  display-xl:
    fontFamily: "\"Martina Plantijn Regular\", sans-serif"
    fontSize: 64px
    fontWeight: 400
    lineHeight: 76.8px
    letterSpacing: "-1.28px"
  display-lg:
    fontFamily: "\"Martina Plantijn Regular\", sans-serif"
    fontSize: 48px
    fontWeight: 400
    lineHeight: 64.8px
    letterSpacing: "-0.24px"
  display-md:
    fontFamily: "\"Martina Plantijn Regular\", sans-serif"
    fontSize: 32px
    fontWeight: 400
    lineHeight: 42.24px
    letterSpacing: 0
  heading-lg:
    fontFamily: "\"Special Gothic Variable\", sans-serif"
    fontSize: 27.2px
    fontWeight: 400
    lineHeight: 34px
    letterSpacing: "0.1px"
  heading-md:
    fontFamily: "\"Special Gothic Variable\", sans-serif"
    fontSize: 20.8px
    fontWeight: 400
    lineHeight: 29.12px
    letterSpacing: "0.1px"
  body-lg:
    fontFamily: "\"Special Gothic Variable\", sans-serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 29px
    letterSpacing: "0.15px"
  body-md:
    fontFamily: "\"Special Gothic Variable\", sans-serif"
    fontSize: 17.6px
    fontWeight: 400
    lineHeight: 26.4px
    letterSpacing: "0.25px"
  body-sm:
    fontFamily: "\"Special Gothic Variable\", sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: "0.15px"
  body-xs:
    fontFamily: "\"Special Gothic Variable\", sans-serif"
    fontSize: 15.2px
    fontWeight: 400
    lineHeight: 21.28px
    letterSpacing: "0.15px"
  label-mono:
    fontFamily: "\"DM Mono\", monospace"
    fontSize: 14.4px
    fontWeight: 500
    lineHeight: 18.72px
    letterSpacing: "0.72px"
  serif-accent:
    fontFamily: "\"Crimson Pro\", serif"
    fontSize: 48px
    fontWeight: 400
    lineHeight: 33.6px
    letterSpacing: "-0.96px"
  nav-label:
    fontFamily: "Inter, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0

rounded:
  none: "0px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
  pill: "100px"

spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  base: "10px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-label}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
    height: "40px"
  top-nav:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.body-sm}"
    padding: "0px 32px"
    height: "48px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.canvas}"
    typography: "{typography.body-sm}"
    padding: "6px 10px"
  hero-heading:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-xl}"
    padding: "0"
  section-heading:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    padding: "0"
  body-paragraph:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    padding: "0"
  section-label:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label-mono}"
    padding: "0"
  search-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "48px"
    borderColor: "{colors.hairline}"
  card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "16px"
    borderColor: "{colors.hairline-light}"
  card-teal:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-sage:
    backgroundColor: "{colors.surface-sage}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "16px"
  hero-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.body-md}"
    padding: "48px 32px"
  timestamp:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label-mono}"
    padding: "0"
  institution-logo:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "5px 10px"

---

## Overview

Elicit's design surface does not read as a startup's marketing page — it reads as a scholarly journal's index page crossed with a library catalog. **Archival stratification.** Three typefaces occupy three non-overlapping semantic registers: Martina Plantijn (a Dutch serif with old-style proportions) for display headlines that frame the research proposition, Special Gothic Variable (a condensed grotesque that packs text at the density of academic abstracts) for all body reading, and DM Mono for section labels and timestamps in uppercase — archival notation rather than UI chrome. The combination has no parallel in the AI research-tools category, where Consensus, Semantic Scholar, and Perplexity reach for standard sans-serif stacks and consumer-web spacing.

Color operates with similar constraint. Deep teal (#083d44) carries a dual load: it is the primary text color on the off-white canvas AND the full-bleed section background for the hero band and the "Stand on the shoulders of giants" section. The only departure from teal-and-off-white is chartreuse (#e5ff97) — an acid lime that marks the primary search button and the single interactive highlight per section. Where most research tools use navy or blue as the brand color, Elicit's teal reads more as an aged verdigris than as a technology signal.

**Key Characteristics:**
- Deep teal (#083d44) runs simultaneously as text ink (113 occurrences), background fill (55), and border (113) — one hue, three structural roles.
- Chartreuse (#e5ff97) is the sole chromatic accent; it appears 8 times total, always marking the primary interactive moment on each section.
- Off-white canvas (#fcfcf8) with a faint warm tint — the parchment equivalent in a primarily digital system.
- Three-typeface stratification: serif for display, condensed grotesque for body, mono for labels — each occupying a distinct tier with no overlap.
- Hero section positions a search input field as the primary conversion element rather than a button CTA.
- Institution logos (NASA, Stanford, Cornell, Harvard, Tulane) appear in their native rendering — not flattened to monochrome — as social proof for the academic audience.
- No shadow tier; card separation comes from hairline borders and surface-color shifts.

## Colors

### Structural

- **Deep Teal** (`#083d44` — frequency 281): Used as text (113), bg (55), border (113). The structural spine of the system — simultaneously the darkest background tone, the primary text color, and the hairline border. The extraction merged a near-match dark teal variant into this cluster. No other system in the design directory uses the same hex value for both dark-mode backgrounds and light-mode text.
- **Canvas** (`#fcfcf8` — frequency 160): Used as text (60), bg (39), border (60). The parchment-tinted off-white; merged from #ffffff and #f6f8f8 in extraction. The warm tint is the critical difference from pure white — it grounds the academic aesthetic.
- **Pure Black** (`#000000` — frequency 1377): Used as text (685), border (685), shadow (7). The hairline and text color at maximum; appears at full opacity on borders and at near-full opacity on running text. The high frequency reflects the system's comprehensive border usage across card components.
- **Link Blue** (`#0000ee` — frequency 340): Used as text (170), border (170). Browser-default hyperlink blue, retained without override — an unusual choice that reinforces the academic document aesthetic, where link color is considered a navigational affordance rather than a brand opportunity.
- **Ink Deep** (`#09272b` — frequency 1): The darkest teal variant; appears in one section background as a depth stop.

### Brand

- **Primary Teal** (`#026370` — frequency 28): Used as text (7), bg (13), border (7), gradient (1). The mid-range teal between the structural deep teal and the lighter gradient stops. Appears in section backgrounds, feature card fills, and the gradient band transitioning between dark and light sections.
- **Accent Chartreuse** (`#e5ff97` — frequency 8): Used as text (1), bg (5), border (1), gradient (1). The system's single chromatic accent — acid lime against the teal and off-white. The primary search button fill and the interactive highlight on the "Start for free" CTA section.

### Surfaces

- **Surface Sage** (`#f3f6e4` — frequency 9): Used as bg (9). A warm sage-tinted off-white that differentiates certain card backgrounds from the main canvas without introducing a new hue register. Appears in the feature breakdown section.
- **Surface Cool** (`#e8eced` — frequency 9): Used as bg (9). A slightly blue-gray off-white for cool-tinted card surfaces in the "Research takes many forms" section.

## Typography

### Font Families

**Martina Plantijn Regular** — a serif with Dutch old-style proportions — handles the display headline tier at 32-64px, weight 400. It carries the hero h1 and the major section feature headlines. This is the visual anchor that signals scholarly publishing over consumer tech. **Special Gothic Variable** (a condensed grotesque) runs all body text from 15.2-27.2px at weight 400. Its condensed x-height packs academic-density information into columns narrower than standard sans-serif systems. **DM Mono** at 14.4px weight 500 uppercase runs section labels, timestamps, and section category markers. **Crimson Pro** (a second serif) appears in one isolated decorative pull-quote element at 48px. **Inter** appears for exactly one button — the skip-to-content accessibility link — but is otherwise absent from the visible UI.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `display-xl` | 64px | 400 | 76.8px | Hero h1 ("AI for Scientific Research") |
| `display-lg` | 48px | 400 | 64.8px | Feature section display headlines |
| `display-md` | 32px | 400 | 42.24px | Sub-section h3 display |
| `heading-lg` | 27.2px | 400 | 34px | Card heading — h3 |
| `heading-md` | 20.8px | 400 | 29.12px | Compact card heading |
| `body-lg` | 20px | 400 | 29px | Hero sub-paragraph |
| `body-md` | 17.6px | 400 | 26.4px | Default running text |
| `body-sm` | 16px | 400 | 24px | Compact prose |
| `body-xs` | 15.2px | 400 | 21.28px | Caption-level prose |
| `label-mono` | 14.4px | 500 | 18.72px | Section labels, timestamps (uppercase) |
| `serif-accent` | 48px | 400 | 33.6px | Decorative pull-quote element |
| `nav-label` | 16px | 600 | 24px | Primary button label only |

### Principles and Substitutes

The three-typeface system is the hardest element to replicate. Martina Plantijn is not freely licensed; **EB Garamond** from Google Fonts carries the closest old-style serif proportions at display sizes. Special Gothic Variable (from Google Fonts) is available but requires variable-font support; **Barlow Condensed at weight 400** is a non-variable fallback. DM Mono is freely available on Google Fonts.

## Layout

The page uses a centered editorial column (~1200px max width) with section-level alternation between teal dark bands and off-white light bands. Internal content switches between single-column text, two-column text-plus-interface-screenshot, and three-column feature card grids.

- **Base spacing unit:** 10px (high frequency at 101 occurrences in the extraction).
- **Card padding:** `spacing.lg` (16px) for standard cards; `spacing.xl` (24px) for dark-teal feature cards.
- **Section vertical rhythm:** `spacing.3xl` (48px) minimum between major sections.
- **Hero layout:** search input centered in a single column, with institution logos ranged below in a horizontal trust bar.

The section-alternation rhythm (off-white → teal dark → off-white → teal dark) creates a chapter-break effect that maps to academic document structure more than to standard SaaS landing-page flow. Each band change marks a thematic shift in the research capability being demonstrated.

## Elevation

No shadow tier exists in the system. Card separation on the off-white canvas uses 1px near-black hairlines at 8-12px radius. Cards on the teal dark sections use the same hairline but in the canvas off-white tone. The single elevation effect is the transition between the off-white canvas sections and the full-bleed teal bands — the abrupt color switch creates perceived depth through contrast rather than through any shadow or blur technique.

## Shapes

The radius scale runs from sharp (0px for the primary button) to pill (100px for category tags):

- `rounded.none` (0px) — the primary CTA button. The accessibility skip-link button and the primary search call-to-action use fully squared corners — a deliberate anti-consumer-UI choice that reads as form-over-function.
- `rounded.sm` (6px) — minor UI elements, small chips.
- `rounded.md` (8px) — search input fields and standard interactive inputs.
- `rounded.lg` (12px) — default feature cards and content tiles.
- `rounded.xl` (16px) — larger surface cards.
- `rounded.2xl` (20px) — featured highlight cards.
- `rounded.pill` (100px) — category tag filters (full pill on short text elements).

The 0px primary button is the system's most distinctive shape signal. At 44px height with squared corners, the chartreuse-filled search button reads closer to a database query submit button than to a consumer-app CTA. This is not a rounding omission — it is the archival aesthetic applied to interactive surfaces.

## Components

**`button-primary`** — Chartreuse (#e5ff97) fill, deep teal text in Inter 16px weight 600, squared corners (0px radius), 12x24 padding, 44px height. The primary search button in the hero. Squared corners on a bright accent fill inverts the category convention — most systems pair high-saturation fills with generous rounding.

**`button-secondary`** — Deep teal fill, canvas-white text, DM Mono uppercase, squared corners. The "Start for free" variant and dark-section secondary CTAs.

**`top-nav`** — Deep teal background, canvas-white text in Special Gothic Variable 16px, 32px horizontal padding, 48px height. The nav reverses the canvas-and-ink order immediately, setting the teal-dominant tone before the off-white hero begins.

**`nav-link`** — Transparent, canvas-white text at 16px, 6x10 padding. No hover state captured. Links in the teal nav have no underline treatment — they rely on position and color to signal navigability.

**`hero-heading`** — Martina Plantijn 64px weight 400, -1.28px tracking, deep teal on canvas. The single h1 instance on the page.

**`section-heading`** — Martina Plantijn 48px weight 400, -0.24px tracking. Used for major feature section headlines ("Research takes many forms," "Stand on the shoulders of giants").

**`body-paragraph`** — Special Gothic Variable 17.6px weight 400, 0.25px tracking, deep teal. The default running text throughout off-white sections.

**`section-label`** — DM Mono 14.4px weight 500 uppercase, 0.72px tracking, deep teal. Used for section category markers ("TRUSTED BY OVER 5 MILLION RESEARCHERS", feature category timestamps). The uppercase mono label is the system's archival notation signal.

**`search-input`** — Canvas off-white fill, deep teal text, 17.6px Special Gothic Variable, 8px radius, 14x16 padding, 48px height, 1px pure black border. The hero's central conversion element; sits in an off-white field against the off-white canvas so only the border defines its boundaries.

**`card`** — Canvas off-white fill, 1px deep teal hairline border, 12px radius, 16px internal padding. The default feature card on light sections.

**`card-teal`** — Deep teal fill, canvas-white text, 12px radius, 24px padding. Used for the "Research experts" interactive demo cards in the dark section band.

**`card-sage`** — Sage-tinted off-white (#f3f6e4) fill, deep teal text, 12px radius, 16px padding. Appears in the feature breakdown section to differentiate feature cards from the main canvas.

**`hero-band`** — Full-bleed deep teal background, canvas-white text, 48x32 padding. The "Stand on the shoulders of giants" section and the hero section band. Background depth tier 1.

**`timestamp`** — DM Mono 14.4px weight 500 uppercase, deep teal. Used for timestamps and archival date markers (e.g., "ESTABLISHED 2021").

**`institution-logo`** — Transparent background, native-color logo rendering, 5x10 padding. Institution marks (NASA, Stanford) are NOT flattened to monochrome — their native colors are retained as credibility signals.

## Do's and Don'ts

**Do** maintain the three-typeface role stratification: Martina Plantijn only at display sizes (32px+), Special Gothic Variable for all body reading, DM Mono only for labels and timestamps in uppercase. Crossing these role boundaries — running Special Gothic Variable at 48px as a headline, or DM Mono as body text — breaks the archival grammar the system is built on.

**Do** retain the raw browser-default link blue (#0000ee) for inline hyperlinks. The system deliberately does not override it, because academic documents treat hyperlink color as a navigational convention rather than a brand opportunity. Replacing it with teal or chartreuse would import a startup-brand signal into the scholarly register.

**Do** use the full-bleed deep teal band format for major section transitions. The abrupt teal-to-off-white alternation is the page's chapter-break mechanism — it does the organizational work that a fintech system would do with numbered sections or ruled lines.

**Do** keep the primary CTA button at 0px border radius. The squared chartreuse button is the system's most distinctive shape signal. Rounding it to 8px or 12px imports a consumer-app vocabulary that conflicts with the archival precision of the rest of the system.

**Don't** use chartreuse (#e5ff97) as a section background or decorative fill. Its role is strictly as an interactive fill for the primary action on each section — one per section, not more. Used as a background, the acid lime competes with the teal and loses the scarcity that makes it function as a highlight.

**Don't** use deep teal (#083d44) as a button fill on the off-white canvas. Its 113 occurrences are all as text and hairline border — the secondary button is the only teal-filled interactive element, and it lives in teal-background sections where the contrast reversal reads correctly. On an off-white canvas, a teal button reads as a text block rather than as an action.

**Don't** introduce a shadow tier on card components. The 0-shadow constraint is deliberate — the system achieves separation through hairline borders and surface-color switching between off-white, sage, and cool-gray. Adding drop shadows would introduce a consumer-web softness that conflicts with the archival document aesthetic.

**Don't** flatten institution logos to monochrome. The design retains native logo colors (NASA's meatball, Harvard crimson, Cornell red) as an explicit credibility signal to academic users. Forcing monochrome white or teal treatment would register as brand suppression to the exact audience that recognizes these marks.

## Known Gaps

- **Interactive states:** the search input's focus ring, error state, and filled state are not captured. The search is the primary conversion element and its interaction states are critical to the UX.
- **Dark mode:** the system has no dark-mode variant documented here. The teal background sections are not a dark mode — they are full-bleed content sections. A true dark mode would require a complete surface inversion.
- **Mobile layout:** the desktop-1440px layout is captured. The column collapse from two-column and three-column grids to single-column mobile layout is not documented.
- **Typography variable font ranges:** Special Gothic Variable supports a width axis in addition to size. The marketing surface uses a single condensed width setting, but the full variable axis range is not explored or documented here.
- **Hover states:** no hover behavior for navigation links, card interactions, or button press states is captured from the marketing surface.
- **Deep product UI:** the research extraction interface, document summarization panels, and literature-map visualization are not represented here. This file captures the marketing surface only.
- **Accessibility contrast on sage surfaces:** the sage (#f3f6e4) card background paired with deep teal (#083d44) text — verify WCAG AA compliance before using at small text sizes.
