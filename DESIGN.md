---
name: "purachina's stuff"
description: "A personal public hub for presets, tools, cards, themes, and project links."
colors:
  page-bg: "#0a0a0f"
  panel-bg: "#0f1019"
  panel-bg-soft: "#0f111b"
  pill-bg: "#12151f"
  active-bg: "#1c2330"
  border-muted: "#2a3445"
  border-pill: "#353d4d"
  border-download: "#353f52"
  border-active: "#566985"
  divider: "#394455"
  text-base: "#9bbbaa"
  text-body: "#89aa99"
  text-muted: "#739282"
  text-dim: "#607f70"
  text-bright: "#d8eee2"
  text-active: "#e0f2e7"
  text-link: "#91b3a0"
  bullet: "#6b8d7c"
  accent-blue: "#54a0ff"
  accent-blue-soft: "#6eaef9"
  accent-blue-text: "#c7e7ff"
  accent-green: "#54d9ac"
  accent-green-soft: "#8fe7a8"
  accent-green-text: "#c9f5e2"
  accent-pink: "#ff84cd"
  accent-pink-text: "#ffe0f0"
  accent-orange: "#ff9500"
  accent-orange-soft: "#ffad5c"
  accent-orange-text: "#ffd9a8"
  rainbow-red: "#ff6b6b"
  rainbow-yellow: "#feca57"
  rainbow-cyan: "#48dbfb"
  rainbow-pink: "#ff9ff3"
  rainbow-purple: "#5f27cd"
typography:
  display:
    fontFamily: "Figtree, sans-serif"
    fontSize: "clamp(2.5rem, 8vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "normal"
  headline:
    fontFamily: "Figtree, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  micro:
    fontFamily: "Figtree, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  image: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  subtab: "20px"
  pill: "999px"
  round: "50%"
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
  hero-title:
    textColor: "{colors.text-bright}"
    typography: "{typography.display}"
  link-pill:
    backgroundColor: "{colors.pill-bg}"
    textColor: "{colors.text-link}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.6rem"
  link-pill-hover:
    backgroundColor: "{colors.active-bg}"
    textColor: "{colors.text-active}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.6rem"
  tab-pill:
    backgroundColor: "{colors.pill-bg}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "0.4rem 1.3rem"
  tab-pill-active:
    backgroundColor: "{colors.active-bg}"
    textColor: "{colors.text-active}"
    rounded: "{rounded.pill}"
    padding: "0.4rem 1.3rem"
  option-card:
    backgroundColor: "{colors.panel-bg-soft}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.md}"
    padding: "0.95rem 1rem"
  resource-card:
    backgroundColor: "{colors.panel-bg}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.sm}"
    padding: "1rem 1.2rem"
  download-pill:
    backgroundColor: "{colors.pill-bg}"
    textColor: "{colors.text-link}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.4rem"
  screenshot-thumb:
    backgroundColor: "{colors.panel-bg}"
    rounded: "{rounded.image}"
    width: "100%"
---

# Design System: purachina's stuff

## 1. Overview

**Creative North Star: "The Tinkerer's Bench"**

The root site is a personal bench of useful things: presets, tools, cards, themes, screenshots, and blunt notes laid out for people who already know why they came here. It should feel handmade and maintained, not like a generic product launch. The page can be playful, sardonic, and compact, but the useful objects must stay in reach.

The system is a dark, green-tinted hub with low-glow interaction states and small functional surfaces. The palette gives each project link a slightly different signal, while the main preset area stays quiet enough for changelogs and downloads to be scanned. The design rejects corporate SaaS polish, generic AI landing-page aesthetics, oversized marketing hero sections, vague value-prop copy, sterile template grids, and anything that makes the site feel like a startup pitch.

**Key Characteristics:**
- A compact centered landing stack that quickly gives way to functional tabs and downloads.
- Figtree-only typography with small, readable sizes and clear weight contrast.
- Pill controls for navigation, downloads, platform switches, and quick links.
- Dark surfaces with muted green text, blue/green platform accents, and tiny glow states.
- Resource cards and screenshot galleries that prioritize scanning over decoration.

## 2. Colors

The palette is a muted dark workbench: near-black surfaces, green-gray text, blue and green platform accents, and a few deliberately colored link pills for project identity.

### Primary
- **Workbench Black** (`#0a0a0f`): The page background. It should feel quiet and late-night, not glossy or cinematic.
- **Workbench Green Text** (`#9bbbaa` / `#89aa99`): The main reading tone for body copy, descriptions, changelog items, and resource explanations.
- **Electric Blue Accent** (`#54a0ff`): The SillyTavern and generic interaction glow. Use for hover glows, active tab shine, and link affordance, not for large background fields.

### Secondary
- **Bunny Green Accent** (`#54d9ac` / `#8fe7a8`): The SillyBunny platform accent and green project identity.
- **Support Orange Accent** (`#ff9500` / `#ffad5c`): Reserved for Ko-fi and support-related calls.
- **Startpage Pink Accent** (`#ff84cd`): Reserved for the startpage project pill.

### Tertiary
- **Rainbow Welcome Set** (`#ff6b6b`, `#feca57`, `#48dbfb`, `#ff9ff3`, `#54a0ff`, `#5f27cd`): Existing animated hero treatment. Keep it as the one intentionally loud flourish on the root page.

### Neutral
- **Panel Night** (`#0f1019`): Dense tables, extension/resource cards, and gallery card backgrounds.
- **Panel Ink** (`#0f111b`): Option cards and nested information blocks that need one step of separation.
- **Pill Night** (`#12151f`): Default pill and tab background.
- **Active Slate** (`#1c2330`): Active tab and selected state background.
- **Quiet Border** (`#2a3445`): Default card, table, image, and panel border.
- **Pill Border** (`#353d4d`): Default hero-link and pill border.
- **Bright Mint Text** (`#d8eee2` / `#e0f2e7`): Preset titles, active labels, important names, and hover text.
- **Dim Green Metadata** (`#607f70` / `#739282`): Last updated copy, subtitles, captions, and secondary link info.

### Named Rules

**The Useful Color Rule.** Colored accents should identify a project, platform, or state. Do not add decorative accent colors to ordinary information blocks.

**The Dark Bench Rule.** New root-page surfaces should stay within the current dark green-gray family unless they are a named project pill, support pill, or platform state.

**The Rainbow Exception Rule.** The animated rainbow heading is the loud flourish. Do not repeat gradient text elsewhere.

## 3. Typography

**Display Font:** Figtree, sans-serif
**Body Font:** Figtree, sans-serif
**Label/Mono Font:** Figtree for labels; browser monospace only when content itself is code.

**Character:** Figtree keeps the site casual, rounded, and readable without becoming cute. The hierarchy is compact because the root page is a hub, not a brochure.

### Hierarchy
- **Display** (600, `clamp(2.5rem, 8vw, 4.5rem)`, 1.05): The `welcome :3` hero only.
- **Headline** (600, `1.25rem`, 1.3): Preset and section titles inside content panels.
- **Title** (600, `1.1rem`, 1.35): Section headings and prominent tab-panel headings.
- **Body** (400, `0.88rem`, 1.7): Preset descriptions, option explanations, and long changelog copy. Keep readable text around 65 to 75 characters where layout allows.
- **Label** (600, `0.85rem`, normal tracking unless uppercase): Pill tabs, download links, resource names, and compact controls.
- **Micro** (400 to 600, `0.68rem` to `0.78rem`): Link info, captions, version metadata, badges, and table labels.

### Named Rules

**The Compact Hub Rule.** Do not introduce oversized marketing typography beyond the existing hero. Most new content belongs at title, body, label, or micro scale.

**The One-Family Rule.** Keep Figtree as the root site's voice. Add another family only for genuine code snippets or embedded content that already carries its own format.

## 4. Elevation

The root site uses tonal layering and small colored glow states instead of heavy depth. Static panels are mostly flat and separated by borders, background opacity, and spacing. Shadows appear on hover, active tabs, project pills, the favicon, and lightbox/screenshot affordances.

### Shadow Vocabulary
- **Favicon Drop** (`filter: drop-shadow(0 10px 24px rgba(32, 64, 48, 0.28))`): Only for the pixel favicon in the hero.
- **Soft Pill Glow** (`0 0 20px rgba(84, 160, 255, 0.18)`): Default glow-pill depth.
- **Hover Pill Glow** (`0 0 24px rgba(84, 160, 255, 0.28)`): Stronger hover state for project pills.
- **Active Platform Glow** (`0 0 24px rgba(84, 160, 255, 0.34), 0 8px 24px rgba(31, 68, 110, 0.28)`): Selected SillyTavern platform state. Use the green equivalent for SillyBunny.
- **Resource Hover Glow** (`0 0 18px rgba(84, 160, 255, 0.08)`): Extension cards, tabs, and quiet hover states.
- **Screenshot Hover Glow** (`0 2px 18px rgba(84, 160, 255, 0.1)`): Tracker and screenshot thumbnail hover.

### Named Rules

**The Glow Means State Rule.** Glow should communicate hover, selection, support, or project identity. Do not use it as ambient decoration behind sections.

**The Flat Card Rule.** Resource cards are bordered, dark, and mostly flat at rest. If every card glows, nothing is active anymore.

## 5. Components

### Buttons
- **Shape:** Root-page buttons are usually pills (`999px`) because they behave like quick links, platform switches, tabs, or downloads.
- **Primary:** Download pills use `#12151f` / muted green text, `1px` `#353f52` borders, and `0.5rem 1.4rem` padding.
- **Hover / Focus:** Hover shifts text to bright mint, border to `#5c7193`, and adds a restrained blue glow. Keyboard focus should be at least as visible as hover.
- **Secondary / Ghost:** Link-info anchors and inline links stay text-first with quiet underlines or color shifts.

### Chips
- **Style:** Option badges use uppercase micro labels, pill radius, dark backgrounds, and subtle colored borders by platform or agent type.
- **State:** SillyTavern badges lean blue, SillyBunny badges lean green, and agent badges lean warm amber. Keep badges informational, not button-like, unless they are wired as controls.

### Cards / Containers
- **Corner Style:** Extension cards use `10px`, option cards use `14px`, table/mobile panels use `18px`, image thumbnails use `6px`.
- **Background:** Use `#0f1019` or `#0f111b` with low opacity equivalents from the existing CSS.
- **Shadow Strategy:** No shadow at rest. Hover can add a low blue glow only when the card is interactive.
- **Border:** Default to `1px solid #2a3445` or the slightly cooler `#293345` for resource cards.
- **Internal Padding:** Dense cards use `0.95rem 1rem`; resource cards use `1rem 1.2rem`; mobile cards tighten to `0.8rem 1rem`.

### Inputs / Fields
- **Style:** The root page currently avoids visible text inputs. Future fields should borrow the tab/card vocabulary: dark surface, quiet border, Figtree body text, and `10px` to `14px` radius.
- **Focus:** Use a clear border shift toward `#54a0ff` or `#54d9ac` depending on platform context, plus a visible focus outline for keyboard users.
- **Error / Disabled:** Error states should stay plain and readable. Avoid theatrical red glows unless an actual destructive or failed state needs attention.

### Navigation
- **Style:** Navigation is radio-driven pills: top platform switcher, main preset tabs, theme/card subtabs, and download groups.
- **States:** Default state is muted green-gray on dark pill. Hover brightens the label and border. Active state uses bright mint text, active slate background, and a small inner highlight.
- **Mobile:** Pill groups wrap, hero links stack to full-width buttons, platform labels become full-width, and grids collapse from three or two columns down to one.

### Signature Component: Project Glow Pills

Project glow pills are the root page's strongest brand affordance. Each pill has a custom text color, border, tinted background, and glow tied to the project it opens. Use them for top-level project identity only: startpage, Synapse, SD Proxy, SillyBunny, Ko-fi, or similarly important future links.

### Signature Component: Preset Tabs

Preset tabs make the dense resource hub usable without turning it into a long marketing page. Keep labels short, plain, and functional. Do not add explanatory text inside the tab row.

### Signature Component: Screenshot And Card Galleries

Gallery items are plain linked thumbnails with captions. The thumbnail itself carries the visual interest. Keep captions small, centered, and descriptive, and let the lightbox show the real image without extra chrome.

## 6. Do's and Don'ts

### Do:
- **Do** lead with presets, downloads, changelogs, project links, screenshots, and cards before adding new personality flourishes.
- **Do** keep the blunt, personal, tinkerer-made voice in visible copy, especially version notes and resource descriptions.
- **Do** make current versions, previous versions, changelog entries, and platform differences obvious.
- **Do** use the existing pill, card, table, gallery, and lightbox vocabulary before inventing a new component shape.
- **Do** preserve readable contrast, responsive wrapping, keyboard access, visible focus states, meaningful image alt text, and reduced-motion-friendly behavior.
- **Do** let tools like Synapse keep their own product-specific context and denser app patterns.

### Don't:
- **Don't** make the root hub feel like corporate SaaS polish.
- **Don't** use generic AI landing-page aesthetics, oversized marketing hero sections, vague value-prop copy, or sterile template grids.
- **Don't** make the page feel like a startup pitch.
- **Don't** overdecorate the root hub until presets, programs, and downloads become harder to find.
- **Don't** repeat gradient text beyond the existing rainbow welcome heading.
- **Don't** turn every repeated item into a same-sized icon card grid. Use plain resource cards, tables, tabs, and galleries when those fit better.
