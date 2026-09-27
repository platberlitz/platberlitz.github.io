---
name: "purachina's stuff"
description: "A personal public hub for presets, tools, cards, themes, and project links."
colors:
  bg: "#10160f"
  surface: "#172017"
  surface-2: "#1f2a1e"
  line: "#2c3a2a"
  line-strong: "#46603f"
  fg: "#e7eee3"
  fg-dim: "#a3b39e"
  accent: "#a6e37a"
  accent2: "#8fd6c6"
  blush: "#f3b3c8"
  on-accent: "#10160f"
  err: "#ff9a8f"
  glow: "rgba(166, 227, 122, 0.18)"
  welcome-gradient: ["#a6e37a", "#8fd6c6", "#a9b8ff", "#f3b3c8", "#ffd08a"]
typography:
  display: "'Bricolage Grotesque', 'Figtree', system-ui, sans-serif"
  body: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif"
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  hero: "clamp(2.6rem, 7vw, 4.4rem), display 800"
  sectionTitle: "clamp(1.7rem, 4vw, 2.3rem), display 800"
  presetTitle: "clamp(1.5rem, 3.2vw, 2rem), display 800"
  bodySize: "16px / 1.6"
  proseWidth: "70ch"
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
  pill: "999px"
layout:
  topbarHeight: "56px (52px on phones)"
  containerWidth: "1160px"
  breakpoints: ["900px: overview stacks", "760px: tables become cards", "700px: phone layout"]
---

# Design System: purachina's stuff

## 1. Overview

**Creative North Star: 'Moss and glow'**

The site is my shelf of things people come to download: two presets, their regex sets, character cards, themes and the extensions I use. It should feel handmade and cared for, soft rather than sterile, and still get people to a download in two clicks.

The old look was a green terminal: monospace everywhere, square corners, a scanline overlay. It was fun but cluttered, and it made a long page harder to scan. The current look keeps the green identity and trades the terminal for soft surfaces, rounded corners and a real type pairing.

**Key characteristics:**
- A slim sticky top bar on every page: the site name, links to the four pages (Presets, Extensions, Themes, Cards) with the current one highlighted, and the statusline.
- A short hero: pixel cat, `welcome :3`, one sentence on what's here, and my other projects as small chips.
- The preset picker is the centre of the page. Pick a preset by its release art, then pick your app.
- Extensions, Themes and Cards each have their own page (`extensions.html`, `themes.html`, `cards.html`). The home page is only the hero and the presets.
- A footer with Ko-fi and back to top.

## 2. Colours

One palette block at the top of the stylesheet. Recolour there and nowhere else.

- **Moss night** (`#10160f`): the page. Two very faint radial washes (mint top right, leaf top left) keep it from looking flat.
- **Surface** (`#172017`) and **Surface 2** (`#1f2a1e`): cards, panels, tab bars, inputs. Surface 2 is also the active tab fill.
- **Line** (`#2c3a2a`) and **Line strong** (`#46603f`): borders at rest and on hover.
- **Text** (`#e7eee3`) and **Dim text** (`#a3b39e`): reading copy and metadata.
- **Leaf** (`#a6e37a`): the accent. Primary downloads, the selected preset, active segmented pills, focus rings. Leaf means 'do this' or 'this is selected'.
- **Mint** (`#8fd6c6`): names and links, extension and card names, inline anchors.
- **Blush** (`#f3b3c8`): the one warm note, used for Ko-fi. Keep it rare.
- **Error** (`#ff9a8f`): genuine failures only (the prompt reader's fetch errors).

The `welcome :3` gradient (leaf, mint, periwinkle, blush, apricot) is the only gradient text on the page.

Project chips each get a small coloured dot from an oklch hue (`--hue`) so they are easy to tell apart without every chip shouting.

### Rules

**Leaf means act.** Don't spend the accent on decoration. If everything glows, nothing is selected.

**One loud thing per view.** The hero gradient and the selected preset ticket are the loud moments. Everything else is quiet surfaces and borders.

## 3. Typography

- **Display: Bricolage Grotesque** (800, tight tracking). The hero, section titles, preset titles, ticket names. Friendly and a bit chunky, which suits a cat-themed hub.
- **Body: Figtree** (400 to 700). Everything people read: descriptions, option cards, changelogs.
- **Utility: JetBrains Mono.** Version numbers, dates, the statusline, prompt text in the prompt reader, code.

Fonts load from Google Fonts with `display=swap`, so text shows in the system fallback until they arrive.

Prose caps at `70ch`. Body text is 16px so it stays readable on a phone without zoom.

## 4. Shape and depth

- Corners are soft: 10px for small controls, 16px for cards and panels, 22px for large blocks, fully round for pills and chips.
- Depth comes from surface steps and borders first. Shadows are reserved for the selected preset ticket (a leaf glow) and lifted hover states.
- Hover lifts by 1-2px. All transitions and the hero gradient stop under `prefers-reduced-motion`.
- Focus is always a 2px leaf `outline` with an offset, never only a colour change.
- Under `forced-colors` the gradient text falls back to plain system text.

## 5. Components

### Top bar
Sticky, blurred surface, 56px tall (52px on phones). Brand on the left, page links (the current page carries `aria-current="page"` and a Surface 2 fill), statusline on the right. The statusline is written by hand and repeated on all four pages; `tests/site-pages.cjs` fails if the pages disagree or if the card and theme counts don't match `cards.html` and `themes.html`. On phones the statusline hides so the page links fit.

### Preset tickets (signature)
Two large cards, one per preset, each showing its release art, name, version and one line about what it's for. The selected one gets a leaf border, a soft glow and a round check badge in the corner. This is how people choose a preset, so it gets the page's boldest styling. On phones the art sits above the name.

### App switcher
A segmented pill (SillyTavern / Neconyan) under the tickets. The selected option fills with leaf. It hides when The Ethereality Express is selected, because that preset is one file for every app.

### Tab bar
Each preset panel has one horizontal tab bar (Overview, Options, Prompts, and so on). It sticks under the top bar while you read, and scrolls sideways on phones instead of wrapping into rows. The active tab gets a Surface 2 fill and a leaf underline.

### Overview
Text on the left, a sticky side column on the right with the release art and the downloads. The primary download is a filled leaf button; the other download is outlined; regex sets sit as a pair of small buttons underneath. Older notes fold into a 'More notes' drawer so the first screen stays short. Below 900px the side column moves above the text.

### Option cards, extension cards, theme cards
Rounded Surface cards with a thin line border. Names are mint, descriptions are body text. Grids use `auto-fill` so short groups don't stretch one card across the whole row.

### Cards gallery
Segmented pills for the card collections (Genshin Impact, Limbus Company and so on), then a grid of portrait thumbnails with the name, element icon, version and a short clamped blurb. Two columns on phones.

### Tables
The model opinions table turns each row into its own card below 760px, with labels taken from `data-label`.

### Lightbox
Full-screen dark overlay opened with `:target`, image capped at 90vh. No JavaScript.

## 6. How the pages work

All four pages share one stylesheet, `site.css`. Old links to `#extensions`, `#themes` and `#cards` on the home page forward to the new pages.

All switching is CSS radio buttons, no JavaScript: the preset and app radios sit at the top of `#presets`, and each panel's tab radios sit at the top of its `.preset-tabs`. Rules take the form `#tab-x:checked ~ .tab-content-x { display: block }`. Keep new radios as earlier siblings of what they control, or the `~` selector can't reach it.

The prompt readers still look up their preset file from the nearest `.platform-panel`'s `.downloads-primary`, so keep each panel's downloads inside it.

## 7. Do's and don'ts

### Do
- **Do** keep downloads and the current version within the first screen of each preset panel.
- **Do** fold older or niche notes into a 'More notes' drawer rather than deleting them.
- **Do** keep the blunt, personal voice in visible copy.
- **Do** keep keyboard focus visible, alt text meaningful, and phones free of sideways page scrolling.
- **Do** let tools like Synapse keep their own design. Synapse is not part of this system.

### Don't
- **Don't** bring back monospace body text, square corners or the scanline overlay.
- **Don't** add a second gradient or a second loud accent colour.
- **Don't** put extensions, themes or cards back on the home page or inside a preset's tabs.
- **Don't** restyle anything inside a `prompting-lab/` transcript body. That's captured model output.
