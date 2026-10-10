# Design System: purachina's stuff

## Direction: Windows XP Olive cat desktop

I want this to match my HyDE desktop and startpage: dark Windows XP Olive,
cream text, bevelled buttons and the painted white cat on a night-time Bliss
wallpaper. This replaces the cute-terminal version.

The signature is the cat Start button in the top taskbar, followed by compact
olive windows. The welcome window keeps `welcome :3`, the cat icon and project
links. Its 'Browse presets' button goes to the downloads. Window-like controls
must do something; there are no pretend minimise or close buttons.

## Tokens

All five pages share `site.css`. Change colours in its `:root` block.

| Token | Value | Use |
| --- | --- | --- |
| bg | #161d13 | Background beneath the wallpaper |
| surface | #252c20 | Panels and controls |
| surface-2 | #35422b | Selected tabs and inset areas |
| line | #46523a | Quiet dividers |
| line-strong | #78885a | Window and control borders |
| fg | #eeeedd | Reading text |
| fg-dim | #c0c5ae | Descriptions and metadata |
| accent | #c5d69b | Selected controls and focus |
| accent2 | #d5dfbb | Links and names |
| blush | #edb8b1 | Cat details and Ko-fi |
| on-accent | #202919 | Text on light accent surfaces |
| err | #f4b1a0 | Actual failures |

Window surfaces are 97% opaque, with no blur. The taskbar, title bars and buttons
use the olive gradients and small inset highlights from my desktop. No gradient
text, glowing cards or scanlines. Theme swatches and character element icons keep
their own colours because those colours describe the content.

## Type and shape

- **Tahoma**, falling back to **Liberation Sans**, Arial and sans-serif, for body
  text and controls. The body is 14px with 1.65 line spacing; prose caps at 70ch.
- Welcome and content headings use bold text. Window titles stay compact at 14px.
- **Liberation Mono**, falling back to Consolas and monospace, for code and versions.
  All fonts are local; no font service is needed.
- Corners are 2px or 3px on controls, 6px on windows. Borders, small shadows and
  bevel highlights define the shapes. Reserve pink for small details.
- Focus uses a visible 2px outline, including on labels for hidden radio buttons.

## Layout

The content is at most 1120px wide, aligned left with generous gaps so the cat is
visible beside it at 1920px. The welcome window caps at 760px. The fixed wallpaper
covers the viewport, with a slightly closer crop on wide desktops.

The sticky top taskbar is 40px tall, or 46px on phones. It links to Presets,
Neconyan, Extensions, Themes and Cards on every page. The current link has
`aria-current="page"` and a pressed background. The Start menu repeats those pages,
then gives direct links to tools and Ko-fi. Its contents scroll on short screens.

The home page has the welcome window, project links, two compact preset choices,
and the selected preset's tabs. There is no separate App selector: the Director
Preset overview has both app downloads together, and its Prompts tab contains
both prompt readers. Each preset choice has a name,
version and short description. Folder icons, a stronger border and a bevel mark
the selected choice.
The release pictures appear in the overview rather than twice on the same screen.

The overview puts prose on the left and downloads above release art on the right.
Below 900px it becomes one column: title, version, downloads, art, prose.
The side column is sticky on desktop. Older notes fold into 'More notes'.

Neconyan, Extensions, Themes and Cards have their own pages. Theme and card collections
use compact rectangular selectors. Cards have two columns on phones; collection
selectors and preset tabs scroll horizontally within their own rows.

## Interaction and accessibility

Tabs remain CSS radio controls. Each radio must precede the content and labels
it controls, because the rules use the following-sibling `~` selector. Preserve
their IDs and names when changing the layout.

Prompt readers find their download source in the nearest `.platform-panel`.
Keep `.downloads-primary` inside that panel. Keep downloads as ordinary links.

Decorative icons use empty alternative text or CSS backgrounds. Existing hover
transitions stop under `prefers-reduced-motion`; no flashing or CRT overlay.
Lightboxes remain `:target` links, with meaningful image descriptions.

The Start menu is a native `details` disclosure, so it works with the keyboard
and without JavaScript. `site.js` closes it on an outside click, focus leaving the
menu, link activation or Escape. Escape returns focus to Start.

## Page maintenance

- The five pages load the same versioned stylesheet and menu script. Bump their
  queries together across all five pages when changing those files.
- The top-bar statusline is repeated on all pages. `tests/site-pages.cjs` compares
  the real card and theme counts, preset versions and stylesheet versions.
- Update the last-updated date when editing the site.
- Old home-page links to `#extensions`, `#themes` and `#cards` forward to their pages.
- Keep Synapse and other tools' own designs. Don't restyle captured transcript bodies.
- Keep the wallpaper and cat icon local in `assets/`, alongside the folder icon.
- Check all five pages in a browser at desktop and phone widths, and run both
  `tests/site-pages.cjs` and `tests/preset-prompts.cjs` after changing shared styles.
