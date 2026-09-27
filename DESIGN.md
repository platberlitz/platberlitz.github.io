# Design System: purachina's stuff

## Direction: cute terminal

I want this to look like my personal site. Green terminal text, pixel headings,
a small text-art cat, and downloads you can actually find. The soft rounded
'Moss and glow' version looked too generic. This replaces it.

The signature is the welcome window: a thin title bar, `welcome :3` with a
static pink cursor, and an ASCII cat. Everything around it stays compact.
There are no simulated loading messages, fake command inputs or window buttons.

## Tokens

All four pages share `site.css`. Change colours in its `:root` block.

| Token | Value | Use |
| --- | --- | --- |
| bg | #172018 | Page background |
| surface | #1c281e | Panels and controls |
| surface-2 | #28362a | Selected tabs and title bar |
| line | #3b503e | Quiet dividers |
| line-strong | #6e8b67 | Window and control borders |
| fg | #e1ecd9 | Reading text |
| fg-dim | #a9bba2 | Descriptions and metadata |
| accent | #b6d995 | Selected controls and primary downloads |
| accent2 | #9ad4c0 | Links and names |
| blush | #edb0bd | Cat face, cursor and Ko-fi |
| err | #ff9a8f | Actual failures |

Use solid surfaces. No gradient headings, blurred panels, glowing cards or
scanlines over the text. Theme swatches and character element icons keep their
own colours because those colours describe the content.

## Type and shape

- **VT323** at weight 400 for the welcome, page titles and section headings.
  Keep pixel type out of paragraphs and small controls.
- **IBM Plex Mono** at weights 400 to 700 for body text, controls and metadata.
  The body is 15px with 1.7 line spacing; prose caps at 70ch.
- Fonts load from Google Fonts with `display=swap` and local monospace fallbacks.
- Corners are 2px, 3px or 4px. The welcome has a hard offset shadow.
- Borders and selected fills do most of the work. Reserve pink for small details.
- Focus uses a visible 2px outline, including on labels for hidden radio buttons.

## Layout

The content is at most 1160px wide. The sticky top bar is 56px tall, or 52px
on phones. It links to Presets, Extensions, Themes and Cards on every page.
The current link has `aria-current="page"` and a filled background.

The home page has the welcome window, project links, two compact preset choices,
the app selector, and the selected preset's tabs. Each preset choice has a name,
version and short description. `[x]` marks the selected one; `[ ]` marks the other.
The release pictures appear in the overview rather than twice on the same screen.

The overview puts prose on the left and downloads above release art on the right.
Below 900px it becomes one column: title, version, downloads, art, prose.
The side column is sticky on desktop. Older notes fold into 'More notes'.

Extensions, Themes and Cards have their own pages. Theme and card collections
use compact rectangular selectors. Cards have two columns on phones; collection
selectors and preset tabs scroll horizontally within their own rows.

## Interaction and accessibility

Tabs remain CSS radio controls. Each radio must precede the content and labels
it controls, because the rules use the following-sibling `~` selector. Preserve
their IDs and names when changing the layout.

Prompt readers find their download source in the nearest `.platform-panel`.
Keep `.downloads-primary` inside that panel. Keep downloads as ordinary links.

Text-art decoration is hidden from screen readers. The cursor is static. Existing
hover transitions stop under `prefers-reduced-motion`; no flashing or CRT overlay.
Lightboxes remain `:target` links, with meaningful image descriptions.

## Page maintenance

- The four pages load the same versioned stylesheet and font URL. Bump the
  stylesheet query on all four when changing the appearance.
- The top-bar statusline is repeated on all pages. `tests/site-pages.cjs` compares
  the real card and theme counts, preset versions and stylesheet versions.
- Update the last-updated date when editing the site.
- Old home-page links to `#extensions`, `#themes` and `#cards` forward to their pages.
- Keep Synapse and other tools' own designs. Don't restyle captured transcript bodies.
- Check the four pages in a browser at desktop and phone widths, and run both
  `tests/site-pages.cjs` and `tests/preset-prompts.cjs` after changing shared styles.
