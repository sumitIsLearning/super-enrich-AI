---
name: Super Enrich
description: Provider-agnostic, AI-powered data enrichment tool
colors:
  ember-orange: "#fa5d19"
  ember-orange-hot: "#ff4c00"
  heat-200: "#ff6600"
  accent-black: "#262626"
  accent-white: "#ffffff"
  accent-amethyst: "#9061ff"
  accent-bluetron: "#2a6dfb"
  accent-crimson: "#eb3424"
  background-base: "#f9f9f9"
  background-lighter: "#fbfbfb"
  border-faint: "#ededed"
  border-muted: "#e8e8e8"
  border-loud: "#e6e6e6"
  black-alpha-4: "rgba(0,0,0,0.039)"
  black-alpha-8: "rgba(0,0,0,0.078)"
  black-alpha-12: "rgba(0,0,0,0.122)"
  black-alpha-48: "rgba(38,38,38,0.478)"
typography:
  display:
    fontFamily: "SuisseIntl, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "60px"
    fontWeight: 500
    lineHeight: "64px"
    letterSpacing: "-0.3px"
  headline:
    fontFamily: "SuisseIntl, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "52px"
    fontWeight: 500
    lineHeight: "56px"
    letterSpacing: "-0.52px"
  title:
    fontFamily: "SuisseIntl, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: "32px"
    letterSpacing: "-0.24px"
  body:
    fontFamily: "SuisseIntl, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0px"
  label:
    fontFamily: "SuisseIntl, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 450
    lineHeight: "20px"
    letterSpacing: "0px"
  mono:
    fontFamily: "var(--font-geist-mono), monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
rounded:
  sm: "8px"
  md: "10px"
  lg: "16px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ember-orange-hot}"
    textColor: "{colors.accent-white}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  button-primary-hover:
    backgroundColor: "var(--heat-90)"
  button-secondary:
    backgroundColor: "{colors.black-alpha-4}"
    textColor: "{colors.accent-black}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  input-default:
    backgroundColor: "{colors.accent-white}"
    textColor: "{colors.accent-black}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Super Enrich

## 1. Overview

**Creative North Star: "The Heat Signature"**

One hot color — ember orange — marks action and state against a field of near-black text, white surfaces, and a light gray page. Everything that isn't the accent is deliberately quiet: alpha-black borders, hairline dividers, a single flat gray background. The orange never spreads; it appears on primary buttons, the active input focus ring, and the brand mark, and nowhere else. Elevated surfaces (upload card, config card) don't float on a drop shadow — they sit inside a structural halo: a soft multi-layer blur plus a hairline border plus a thick ring in the page's own background color, so the card reads as inset into the page rather than stacked above it.

This system explicitly rejects the generic SaaS-cream dashboard: no warm-beige near-white body background, no gradient-text hero metrics, no tiny uppercase eyebrows, no colored side-stripe borders. It also rejects any residue of being a cloned vendor template — every surface should read as this product's own, built for someone who is about to trust it with real lead data, not a landing page trying to convert them.

**Key Characteristics:**
- One accent color, used sparingly and consistently (buttons, focus states, brand mark only)
- Structural halo elevation on cards, not incidental drop shadows
- Hairline (1px, alpha-black) borders over heavier line weights
- SuisseIntl throughout; monospace reserved for code/data-adjacent contexts
- Motion is a state response (hover, tab transition), never decoration

## 2. Colors

Near-monochrome neutrals (near-black text, white surface, light gray page) with exactly one saturated accent doing all the emphasis work.

### Primary
- **Ember Orange** (#fa5d19, button fill #ff4c00): the single accent. Primary CTA fill, input focus-ring border, brand mark stroke. Never used as a background fill larger than a button or badge.

### Secondary (optional)
- **Ember Orange Hot** (#ff6600): reserved for the most saturated micro-states (active/pressed primary button glow layers). Not a standalone UI color.

### Neutral
- **Accent Black** (#262626): all body/heading text.
- **Accent White** (#ffffff): card and input surfaces.
- **Background Base** (#f9f9f9): page background; also the halo-ring color under elevated cards.
- **Background Lighter** (#fbfbfb): sticky header bar.
- **Border Faint / Muted / Loud** (#ededed / #e8e8e8 / #e6e6e6): hairline dividers, in ascending emphasis.
- **Black-alpha scale** (4%–88% opacity black): every interactive-surface border, hover fill, and disabled state is a black-alpha tint, not a new gray. This keeps every neutral relative to the same black rather than introducing off-tones.

### Named Rules
**The One Ember Rule.** Ember Orange appears on at most one interactive element type per screen at rest (the primary CTA). Everything else earns its color from black-alpha, not from a second hue. If a screen needs a second accent for status/category (e.g. distinguishing scraper vs. LLM in a provider picker), pull from the existing accent set (amethyst, bluetron, crimson) rather than inventing a new hue — those three exist precisely as the sanctioned secondary palette.

## 3. Typography

**Display Font:** SuisseIntl (with -apple-system, BlinkMacSystemFont fallback)
**Mono Font:** Geist Mono (`var(--font-geist-mono)`), for code/data/ascii contexts only

**Character:** A single grotesque sans carries every weight from hero display down to form labels — no serif, no second display face. Mono is a deliberate register shift, not a typography accent; use it only where content is genuinely code-like or tabular-technical.

### Hierarchy
- **Display** (500, 60px/64px, -0.3px tracking): page-level hero headline only (`text-title-h1`).
- **Headline** (500, 52px/56px, -0.52px): section-level headline, e.g. step titles like "Configure Enrichment" at the top of a config screen (`text-title-h2`).
- **Title** (500, 24px, -0.24px): card/section headers within a step (`text-title-h5`).
- **Body** (400, 16px/24px): all descriptive copy, max ~75ch (`text-body-large` / `text-body-medium`).
- **Label** (450, 14px/20px, tracked 0.01–0.02em): form labels, buttons, chips (`text-label-medium` / `text-label-small`).

### Named Rules
**The One Face Rule.** SuisseIntl for everything humans read as prose or UI copy. Mono is quarantined to genuinely technical content — never used for emphasis or decoration.

## 4. Elevation

The system uses one dominant elevated-surface treatment, applied identically everywhere a white card sits on the gray page: a very soft outer blur, a stack of tightly-layered directional shadows for depth, a 1px hairline border, and — the distinctive move — a thick 10px ring painted in the page's own background color. The ring is what makes the card read as inset/structural rather than floating; it's a halo, not a shadow. Buttons use a separate, smaller-scale version of the same idea: multi-layer inset + drop shadows in the accent hue itself, giving the primary button a literal warm glow rather than a neutral gray shadow.

### Shadow Vocabulary
- **Card halo** (`box-shadow: 0px 0px 44px 0px rgba(0,0,0,0.02), 0px 88px 56px -20px rgba(0,0,0,0.03), 0px 56px 56px -20px rgba(0,0,0,0.02), 0px 32px 32px -20px rgba(0,0,0,0.03), 0px 16px 24px -12px rgba(0,0,0,0.03), 0px 0px 0px 1px rgba(0,0,0,0.05), 0px 0px 0px 10px #F9F9F9`): every top-level elevated card (CSV upload panel, config panel). Fixed at rest, not a hover response.
- **Button primary glow** (`box-shadow: 0px -6px 12px 0px rgba(255,0,0,0.2) inset, 0px 2px 4px 0px rgba(255,77,0,0.12), 0px 1px 1px 0px rgba(255,77,0,0.12), 0px 0.5px 0.5px 0px rgba(255,77,0,0.16), 0px 0.25px 0.25px 0px rgba(255,77,0,0.2)`): primary button only, intensifies slightly on hover.

### Named Rules
**The Halo Card Rule.** A card is never just a drop shadow on a border-radius. It gets the full halo stack — soft blur, hairline border, background-colored ring — or it isn't an elevated card in this system.

## 5. Components

Buttons, inputs, and cards feel tactile and precise: hairline borders that tighten on hover, a single accent glow reserved for the primary action, and generous but exact padding. Nothing is decorative; every visual detail (the ring, the inset glow, the border tightening) signals a real state.

### Buttons
- **Shape:** 8px radius (default size), 10px radius (large size) — never fully rounded except icon-only buttons.
- **Primary:** Ember Orange Hot fill (#ff4c00), white text, the accent glow shadow above; padding 6px 10px (default) / 8px 12px (large), 4–6px icon gap.
- **Hover / Focus:** primary darkens to `var(--heat-90)` and its glow intensifies; all variants get a 2px focus-visible ring (white ring on dark variants, black ring on light variants), offset 2px.
- **Secondary / Tertiary / Destructive:** secondary is a flat `black-alpha-4` fill with black text; tertiary is transparent until hover (`black-alpha-4`); destructive is solid red-600. All share the primary's radius/padding scale, none share its glow shadow.

### Cards / Containers
- **Corner Style:** large radius (rounded-lg equivalent, ~16–20px) on top-level step cards.
- **Background:** `accent-white` surface on `background-base` page.
- **Shadow Strategy:** Card halo (see Elevation).
- **Border:** none beyond the halo's own 1px hairline layer.
- **Internal Padding:** 24px mobile, 40px desktop (`p-6 lg:p-10`).

### Inputs / Fields
- **Style:** white background, 8px radius, 1px `black-alpha-8` hairline border (`before:inside-border` pattern, not a real `border`).
- **Hover:** border tightens to `black-alpha-12`, fill tints to `black-alpha-2`.
- **Focus:** border switches to Ember Orange at 1.25px, background forced back to pure white.
- **Error / Disabled:** not yet defined in the codebase — extend the hover/focus pattern (tint + border color swap) rather than inventing a new treatment.

### Navigation
- Sticky header, `background-lighter` on the enrichment-results step, transparent/hero-blended elsewhere. Right-aligned action cluster (GitHub link, sign-out) at label-medium size, left-aligned brand mark.

## 6. Do's and Don'ts

### Do:
- **Do** use the Card halo shadow stack verbatim for any new top-level elevated surface (e.g. a provider-picker panel) — don't invent a lighter or heavier shadow for consistency's sake.
- **Do** keep Ember Orange to the primary CTA, focus rings, and brand mark only (The One Ember Rule).
- **Do** build new secondary-state color needs from the existing accent set (amethyst, bluetron, crimson) or from black-alpha tints, not new hues.
- **Do** use SuisseIntl for all new copy; reserve mono for genuinely technical/tabular content.

### Don't:
- **Don't** ship a generic SaaS-cream dashboard — no warm-beige near-white body background.
- **Don't** use gradient-text hero-metric templates, tiny uppercase tracked eyebrows, or colored side-stripe borders on cards/list items.
- **Don't** let any new UI read as a leftover vendor template — this product is actively being de-branded from a cloned UI kit; new surfaces must look native to Super Enrich, not borrowed.
- **Don't** add a second saturated accent color competing with Ember Orange on the same screen.
- **Don't** use a plain neutral-gray drop shadow on a card when the Card halo stack is the established pattern.
