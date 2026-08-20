---
name: "purachina's stuff"
description: "A personal public hub for presets, tools, cards, themes, and project links."
colors:
  bg: "#141a13"
  bg-alt: "#232c22"
  fg: "#dee8dc"
  fg-dim: "#94a491"
  accent: "#a0e570"
  accent2: "#79c4b7"
  ok: "#b8d26b"
  warn: "#f0e06b"
  err: "#e05c3f"
  border: "#5f8f55"
  hairline: "color-mix(in oklch, #5f8f55 58%, transparent)"
  glow: "rgba(160, 229, 112, 0.16)"
  on-accent: "#141a13"
  rainbow-red: "#ff6b6b"
  rainbow-yellow: "#feca57"
  rainbow-cyan: "#48dbfb"
  rainbow-pink: "#ff9ff3"
  rainbow-blue: "#54a0ff"
  rainbow-purple: "#8250e8"
hueRamp:
  pill-bg: "oklch(0.24 0.012 var(--pill-hue))"
  pill-hover-bg: "oklch(0.29 0.020 var(--pill-hue))"
  pill-active-bg: "oklch(0.74 0.055 var(--pill-hue))"
  pill-border: "oklch(0.58 0.028 var(--pill-hue))"
  pill-hover-border: "oklch(0.62 0.048 var(--pill-hue))"
  pill-active-border: "oklch(0.74 0.055 var(--pill-hue))"
  pill-text: "oklch(0.72 0.028 var(--pill-hue))"
  pill-hover-text: "oklch(0.90 0.036 var(--pill-hue))"
typography:
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
  display:
    fontSize: "clamp(2rem, 5.4vw, 3.35rem)"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.4
  micro:
    fontSize: "0.7rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
  proseWidth: "78ch"
rounded:
  all: "0"
spacing:
  xxs: "0.15rem"
  xs: "0.3rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  xxl: "2rem"
  section: "4rem"
components:
  statusline:
    backgroundColor: "{colors.bg-alt}"
    textColor: "{colors.fg-dim}"
    borderBlockEnd: "1px solid {colors.border}"
    typography: "{typography.micro}"
    padding: "6px 10px"
  hero-title:
    typography: "{typography.display}"
    background: "the rainbow set, animated"
  link-pill:
    backgroundColor: "{hueRamp.pill-bg}"
    textColor: "{hueRamp.pill-text}"
    border: "1px solid {hueRamp.pill-border}"
    padding: "0.32rem 0.95rem"
  tab-pill:
    backgroundColor: "{hueRamp.pill-bg}"
    textColor: "{hueRamp.pill-text}"
    border: "1px solid {hueRamp.pill-border}"
    padding: "0.4rem 1.3rem"
  tab-pill-active:
    backgroundColor: "{hueRamp.pill-active-bg}"
    textColor: "{colors.on-accent}"
    fontWeight: 700
    padding: "0.4rem 1.3rem"
  option-card:
    backgroundColor: "{colors.bg-alt}"
    textColor: "{colors.fg}"
    border: "1px solid {colors.border}"
    padding: "0.95rem 1rem"
  resource-card:
    backgroundColor: "{colors.bg-alt}"
    textColor: "{colors.fg}"
    border: "1px solid {colors.border}"
    padding: "1rem 1.2rem"
  download-pill:
    backgroundColor: "{colors.bg-alt}"
    textColor: "{colors.fg}"
    border: "1px solid {colors.border}"
    padding: "0.5rem 1.4rem"
    decoration: "[ bracketed ]"
  download-pill-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    border: "1px solid transparent"
    padding: "0.6rem 1.6rem"
  screenshot-thumb:
    backgroundColor: "{colors.bg-alt}"
    border: "1px solid {colors.border}"
    width: "100%"
---

# Design System: purachina's stuff

## 1. Overview

**Creative North Star: "The Tinkerer's Bench"**

The root site is a personal bench of useful things: presets, tools, cards, themes, screenshots, and blunt notes laid out for people who already know why they came here. It should feel handmade and maintained, not like a generic product launch. The page can be playful, sardonic, and compact, but the useful objects must stay in reach.

The bench now sits in a terminal. The system is the **Hazard Console** palette from SillyBunny-Terminal-UI, rotated green: the extension's exact geometry — every token's lightness and chroma unchanged — with the hue family turned from yellow and brass to green at 140°. It wears that extension's chrome: monospace throughout, no corner radius, no shadows, 1px moss hairlines, `>` sigils that mark where a thing begins, and the CRT scanline overlay. Terminal conventions are here to clarify state, not to decorate. The design rejects corporate SaaS polish, generic AI landing-page aesthetics, oversized marketing hero sections, vague value-prop copy, sterile template grids, and anything that makes the site feel like a startup pitch.

**Key Characteristics:**
- A statusline pinned at the top carrying the counts that actually change: preset version, cards, themes, last updated.
- A compact centered landing stack that quickly gives way to functional tabs and downloads.
- Monospace-only typography with small, readable sizes and weight — not colour — doing the hierarchy.
- Flat bordered controls for navigation, downloads, platform switches, and quick links. Selection inverts.
- Olive surfaces with green accents and desaturated per-project hues, all at one chroma.
- A CRT scanline over the whole page — 1px every 3px at 8%, and a flicker that dips once every four seconds.

## 2. Colors

Seven tokens are the whole palette. They keep the exact lightness and chroma of Hazard Console (`SillyBunny-Terminal-UI/style.css:303`) with the hue rotated to 140°, so the console reads green rather than yellow while every contrast relationship the original had is preserved. Everything else on the page derives from them.

### Primary
- **Console Olive** (`#141a13`): The page background, and the text colour on any inverted surface. Quiet, industrial, near-black and clearly green.
- **Console Text** (`#dee8dc`): The main reading tone for body copy, descriptions, changelog items, and resource explanations.
- **Console Green** (`#a0e570`): The one accent, at 134° — far enough from the teal at 182° that the two never muddle. Sigils, focus rings, primary downloads, hover states, active table keys, the update marker, and the Ko-fi call. It is what the eye is supposed to find.

### Secondary
- **Console Teal** (`#79c4b7`): Names and links — extension names, card names, transcript speakers, inline anchors. Where green says "act here", teal says "this is a thing with a name". It is the one token that did not move in the rotation, because it was already the cool half of the pair.
- **Moss** (`#5f8f55`): Every component outline. One weight, 1px, everywhere.
- **Surface Olive** (`#232c22`): Statusline, rails, cards, tables, inputs — anything that needs one step of separation from the page.

### Tertiary
- **Status Set** (`#b8d26b` ok, `#f0e06b` warn, `#e05c3f` error): Reserved for genuine state. None of the three is declared on the root page — the update marker takes the accent, and the rest are recorded here rather than sitting unused in the stylesheet. `prompting-lab/lab.css` declares `ok` and `warn` for its verdict pills.
- **Rainbow Welcome Set** (`#ff6b6b`, `#feca57`, `#48dbfb`, `#ff9ff3`, `#54a0ff`, `#8250e8`): The animated hero treatment, kept deliberately. The purple stop was lightened from `#5f27cd` because the original was tuned against a near-black page and went muddy on olive.

### Neutral
- **Dim Console** (`#94a491`): Last updated copy, captions, version metadata, statusline text, table headers, and the `[ ]` brackets on buttons.
- **Hairline** (`color-mix(in oklch, #5f8f55 58%, transparent)`): Separators *inside* an already-bounded box — table row rules, the short divider. Nothing else.

### The Hue Ramp

Twenty-four tabs and seven project links still carry their own hue; the hue was pulled into the olive world rather than deleted. Chroma is held near `--fg-dim`'s (~0.021 oklch) so a pill still reads as "the pink one" without leaving the palette, and lightness does all the contrast work.

The eight `--pill-*` properties in the `hueRamp` block above are the entire knob. Every hued surface on the page derives from them, so retuning happens there and nowhere else. Measured across all 26 hues, **on a scanline row**, the ramp holds text at ≥5.7:1 and every border at ≥3.3:1.

### Named Rules

**The Useful Color Rule.** Colored accents identify a project, platform, or state. Do not add decorative accent colors to ordinary information blocks.

**The One Chroma Rule.** New hued surfaces derive from the ramp. A colour that sits at higher chroma than `--fg-dim` reads as a foreign object against Hazard and does not belong unless it is genuinely content — a theme swatch, a game crest, a card thumbnail.

**The Rainbow Exception Rule.** The animated rainbow heading is the one gradient on the page, and the one loud flourish. Do not repeat gradient text or gradient fills anywhere else.

**The Green Means Act Rule.** Console green marks the thing to do or the thing in focus: sigils, focus rings, hover, primary downloads, support. Teal marks the thing with a name. Neither is decoration.

**The Rotation Rule.** The palette is Hazard Console with one number changed — the hue. If it ever needs recolouring again, rotate the hue family and leave every lightness and chroma alone; that is what kept all 26 tab hues, every border and every text pair passing contrast through the green move without a single other edit.

## 3. Typography

**One family:** `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`.

The stack is deliberately system-only — no webfont request, nothing to wait for, and it renders as the same class of face the extension shows on Linux. Monospace reads larger than a proportional face at the same px, so every size dropped roughly 5% from the Figtree-era scale.

**Character:** Mono makes the site read as a working tool rather than a page about a tool. Hierarchy comes from weight (400 body, 600 labels, 700 headings, 800 sigils) and from the sigils themselves, not from size jumps.

### Hierarchy
- **Display** (700, `clamp(2rem, 5.4vw, 3.35rem)`): The `welcome :3` hero only.
- **Headline** (700, `1.15rem`): Preset and section titles inside content panels.
- **Title** (700, `1.05rem`): Section headings and prominent tab-panel headings.
- **Body** (400, `0.85rem`, 1.62): Preset descriptions, option explanations, changelog copy.
- **Label** (600, `0.8rem`): Pill tabs, download links, resource names, compact controls.
- **Micro** (600, `0.66rem` to `0.74rem`, `0.04em` tracking): Statusline, link info, captions, version metadata, badges, table labels.

### Named Rules

**The Compact Hub Rule.** Do not introduce oversized marketing typography beyond the existing hero. Most new content belongs at title, body, label, or micro scale.

**The One-Family Rule.** Monospace is the whole voice now. There is no second family and no reason for one — code snippets are already in the same face as everything around them.

**The 78ch Rule.** Monospace runs unreadable past about eighty characters. Prose blocks cap at `78ch`, the same figure the extension uses.

**No Uppercasing.** `text-transform` appears nowhere. The extension's own title is lowercase `sillybunny terminal`; this page's is lowercase `welcome :3`. Uppercase labels were a Figtree-era device and are gone.

## 4. Elevation

There is none, and that is the point. `border-radius`, `box-shadow` and `text-shadow` are zeroed by a single global rule, so anything added later arrives flat by default instead of arriving as itself. Depth is communicated by exactly three things: a 1px moss outline, a one-step surface change to `--bg-alt`, and inversion.

### The Three Exceptions
- **Favicon Drop** (`filter: drop-shadow(0 0 10px var(--glow))`): The hero pixel favicon. The extension keeps exactly one glow too — a drop-shadow on its bunny mascot — and this is the same thing here.
- **The rainbow hero**, which needs `background-clip: text` and is unaffected by the reset.
- **The CRT overlay**, which is a `repeating-linear-gradient` and puts a 2px text-shadow bloom on the statusline. It is the glass in front of the screen, not a component — see below.

### Named Rules

**The Flat Rule.** No radius, no shadow, no blur, no gradient — the reset is a `*` selector for a reason. If a new component needs to stand out, give it a border, a surface step, or inversion. The three exceptions above are screen furniture, not components; a new one is not a licence for a fourth.

**The Outline Rule.** Focus is drawn with `outline`, never `box-shadow`, so it survives the flat reset. `2px solid var(--accent)` at `2px` offset, everywhere, including on inverted pills where the hue border disappears into the fill. Keyboard focus must stay at least as visible as hover.

**The Border Strength Rule.** Component outlines take `--border` at full strength; only separators inside an already-bounded box drop to `--hairline`. Nothing weaker than full strength clears 3:1 on both `--bg` and `--bg-alt`, so weakening an outline to taste makes the control fail contrast.

**The Scanline Rule.** Measure contrast on a scanline row, not on the flat surface. The overlay darkens text and background together, which costs roughly half a point of ratio — enough that `--fg-dim` and `--border` both had to be lifted a step after it went in. Every figure quoted in this document is the darkened one.

## 5. Components

### Buttons
- **Shape:** Flat rectangles with a 1px moss border. No radius anywhere.
- **Primary:** The current preset downloads take the terminal's primary idiom — a solid fill with `#141a13` text — and each one wears its own platform, using the exact fill the switcher above uses for that platform when selected: SillyTavern at hue 245 (`#8eafcc`), SillyBunny at hue 165 (`#8bb6a2`). They join the hue ramp rather than hardcoding the colour. Hover inverts back to platform-colour-on-dark.
- **Secondary:** `#232c22` surface, `1px #5f8f55` border, wrapped in `[ ` and ` ]` via `::before`/`::after`. Hover moves text and border to console green. The regex sets stay secondary on purpose — the platform fills mark the two downloads most people came for.
- **Brackets or an icon, never both.** The two primary downloads carry a download arrow, so they are excluded from the bracket rule; the stacked regex pills are excluded too, because in a column the brackets stack vertically.
- **Equal cells.** `.downloads-primary` is a grid of `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))` with `grid-auto-rows: 1fr`, so every button in the row is the same rectangle regardless of how long its label is. Three natural widths wrapping ragged was the thing this replaced. Plain `.preset-downloads` stays a flex row — the previous-versions list holds twenty-five short pills and must not be forced into columns.

### Chips
- **Style:** Option badges are flat micro labels on a hued surface from the ramp, with `0.04em` tracking and no uppercasing.
- **State:** SillyTavern badges sit at hue 245, SillyBunny at 165, agent badges at 75. Keep badges informational, not button-like.

### Cards / Containers
- **Corner Style:** Square. All of them.
- **Background:** `#232c22` against the `#141a13` page.
- **Shadow Strategy:** None, at rest or on hover. Hover moves the border to console green instead.
- **Border:** `1px solid #5f8f55`.
- **Internal Padding:** Dense cards `0.95rem 1rem`; resource cards `1rem 1.2rem`; mobile `0.8rem 1rem`.

### Inputs / Fields
- **Style:** The root page has none. Future fields take `--bg-alt`, a `1px --border` outline, and mono text. The extension's own prompt is a bare underline rather than a box — worth borrowing if a field ever reads as a prompt.
- **Focus:** `2px solid var(--accent)`, offset `2px`. Same as everything else.
- **Error / Disabled:** `--err` (`#e05c3f`) exists for genuine failure. Do not spend it on emphasis.

### Navigation
- **Style:** Navigation is radio-driven flat labels: top platform switcher, main preset tabs, theme/card subtabs, download groups. No JavaScript is involved and none should be.
- **States:** Default is a dim hued label on a dark hued surface. Hover brightens label and border. **Active inverts** — solid hued fill, `#141a13` text, weight 700.
- **Mobile:** Label groups wrap, hero links become a two-column grid with the tooltip as a visible second line, platform labels go full width, grids collapse to one column, and the statusline drops its name prefix so the counts and date still fit.

### Signature Component: The Statusline

A sticky one-line bar carrying `preset:15.1 | cards:53 | themes:48 | updated:2026-08-20`, in the shape of the extension's own `run: | chat: | api: | prompt:` line. The counts are recomputed from the DOM on load, so they cannot drift from the page the way a hardcoded number does; only the version and the date are authored, and both are already bumped by hand on every release. It is the one piece of persistent chrome — keep it to one line and keep it to facts that change.

### Signature Component: The CRT Overlay

`body::after`, fixed over the viewport at `z-index: 400` with `pointer-events: none`, so it covers even the lightbox the way real glass covers a whole screen without ever intercepting a click. The pattern is the extension's own (`style.css:3005`): a 1px line every 3px at 8% opacity in near-black, plus a flicker that dips to 92% for one frame every four seconds. The statusline gets a `0 0 2px var(--glow)` bloom, the one text-shadow the flat reset is allowed to lose.

It is deliberately faint. Turning it up is how a terminal skin becomes a costume — the extension's own product notes name "decorative CRT clutter" an anti-reference, and the numbers above are the line between texture and clutter. It drops out entirely under `forced-colors` or `prefers-contrast: more`, and stops flickering under `prefers-reduced-motion`.

### Signature Component: Sigils

`>` in console green marks the start of a heading, a prompt, or a section. `>` in teal marks a named thing. `-` in dim marks a list item. `[ ]` in dim wraps a secondary button. All of them use the two-value `content: '> ' / ''` form so the alt text is empty and screen readers get nothing.

Sigils replace what colour and size used to do. Adding one is how a new heading joins the system; adding a new glyph is not.

### Signature Component: Project Links

The seven top links each keep a hue from the ramp for project identity: startpage 350, Synapse 245, SD Proxy 60 (its GitHub link one step quieter on the same hue), SillyBunny 165, Botbooru 300. Ko-fi is the exception and takes console green outright, because support is the one call on the page that should read as an action.

### Signature Component: Screenshot And Card Galleries

Gallery items are plain linked thumbnails with captions. The thumbnail carries the visual interest. Keep captions small, centered, and descriptive, and let the lightbox show the real image without extra chrome.

## 6. Do's and Don'ts

### Do:
- **Do** lead with presets, downloads, changelogs, project links, screenshots, and cards before adding new personality flourishes.
- **Do** keep the blunt, personal, tinkerer-made voice in visible copy, especially version notes and resource descriptions.
- **Do** make current versions, previous versions, changelog entries, and platform differences obvious.
- **Do** use the existing flat-panel, label, table, gallery, and lightbox vocabulary before inventing a new component shape.
- **Do** derive any new hued surface from the ramp rather than picking a colour by eye.
- **Do** preserve readable contrast, responsive wrapping, keyboard access, visible focus states, meaningful image alt text, and reduced-motion-friendly behavior.
- **Do** let tools like Synapse keep their own product-specific context and denser app patterns. Synapse is not part of this system.

### Don't:
- **Don't** make the root hub feel like corporate SaaS polish.
- **Don't** use generic AI landing-page aesthetics, oversized marketing hero sections, vague value-prop copy, or sterile template grids.
- **Don't** make the page feel like a startup pitch.
- **Don't** overdecorate the root hub until presets, programs, and downloads become harder to find.
- **Don't** reintroduce radius, shadow, blur, or gradient. The rainbow hero and the CRT overlay are the whole allowance.
- **Don't** add terminal decoration for its own sake — no ASCII art, no box-drawing frames, no CRT scanline. The extension ships its scanline off by default and its own product notes name "decorative CRT clutter" an anti-reference.
- **Don't** uppercase labels.
- **Don't** turn every repeated item into a same-sized icon card grid. Use plain resource cards, tables, tabs, and galleries when those fit better.
- **Don't** restyle anything inside a `prompting-lab/` transcript body. The `<font color>` dialogue and inline-styled tracker blocks are captured model output — they are the sample.
