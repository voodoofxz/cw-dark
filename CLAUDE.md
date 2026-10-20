# CLAUDE.md — ConnectWise PSA Dark Mode (cw-dark)

Manifest V3 Chromium extension (Chrome, Edge, Brave, Vivaldi) that adds a dark theme and status-based row highlighting to ConnectWise PSA (Manage). Personal project, published under the voodoofxz GitHub account. Keep it free of any employer or client references.

## Layout
- `extension/` — the shipped extension. This folder is what gets zipped and uploaded. `manifest.json` must sit at the zip root.
- `store/` — Chrome Web Store / Edge Add-ons listing copy (`STORE_LISTING.md`) and images.
- `.github/workflows/ci.yml` — validates manifest, JS syntax, referenced files, and that CHANGELOG has the current version.
- `.github/workflows/release.yml` — on a `v*` tag: checks tag == manifest version, builds `cw-dark-x.y.z.zip`, creates a GitHub release with that version's changelog notes.

## How it works
- **Sites are user-added.** `optional_host_permissions: ["*://*/*"]`, requested one host at a time (`*://host/*`). `background.js` registers content scripts only for granted hosts via `chrome.scripting.registerContentScripts`, and injects into already-open tabs when a site is added.
- **Dark theme** (`dark.css` + `content.js`, top frame only, `document_start`): inverts the whole page with `filter: invert(1) hue-rotate(180deg)` plus brightness/contrast CSS variables, then re-inverts media. Iframes are covered by the parent's filter, so dark mode must NOT run in subframes (double inversion).
- **Already-dark areas** (`content.js`): scans for large elements (≥15000 px², not full-page) whose computed background is dark and adds `.cwdm-native`, which re-inverts them. This keeps CW's left nav dark. Computed styles ignore CSS filters, so this sees CW's original colors.
- **Grid checkboxes** (`dark.css`): CW draws them as Ext GXT `div.x-grid-row-checker` / `.x-grid-hd-checker` with navy/white PNG backgrounds set by stylesheet, not inline, so the media rules miss them. They are re-inverted so the checkmark stays white. There are no native `<input type=checkbox>` in the grids.
- **Light/Dark toggle**: storage key `enabled` (true = dark). When false, the dark script is unregistered (no flash on load) and `html.cwdm-off` disables it live in open tabs. Alt+Shift+D command toggles it.
- **Status highlights** (`highlight.js` + `highlight.css`, all frames, both themes): rules are `{ text, color }`; `*` and `?` wildcards, case-insensitive, first matching rule wins. A cell only matches if it sits geometrically under a column header whose text is exactly "Status" — this stopped the top-bar "+ New" menu from matching a "New" rule. In dark mode, colors are lightness-flipped (`flipLightness`) so they display as picked after inversion.
- **Popup "Add this site"**: Chrome closes the popup when the permission prompt opens, killing popup code. `background.js` therefore adopts newly granted hosts into the `sites` list itself (`permissions.onAdded`, and on startup via `permissions.getAll`).
- **Extension reload safety**: content scripts check `chrome.runtime?.id` and disconnect observers when the extension context is invalidated, instead of throwing.

## Settings (chrome.storage.sync)
`enabled`, `sites`, `brightness`, `contrast`, `keepImages`, `keepDark`, `customCSS` (keep under ~7 KB — sync item limit), `highlights`. Defaults live in `extension/shared.js` (`CWDM_DEFAULTS`) and are duplicated in the content scripts, which can't load shared.js — keep them in sync.

## Conventions
- No build step, no dependencies, no remote code. Plain JS/CSS/HTML. Store review requires all code packaged.
- UI palette (`ui.css`): night `#14182b`, panel `#1d2340`, line `#2c3458`, text `#e7e9f3`, muted `#9097b3`, accent `#f2b84b`.
- ConnectWise DOM is GWT-generated with unstable class names; prefer text/geometry/computed-style detection over class selectors.
- Custom CSS is an unsupported power-user feature; don't add code that depends on it.

## Releasing
1. Bump `version` in `extension/manifest.json` (stores reject re-uploads of the same version).
2. Add `## x.y.z` at the top of `CHANGELOG.md` and update "What's new" + version history in `store/STORE_LISTING.md`.
3. Commit, push, then `git tag vx.y.z && git push origin vx.y.z`.
4. Upload the release zip to the Chrome Web Store and Edge Partner Center.

## Git identity
Commit as the personal account only: repo-local `user.name` and the GitHub noreply `user.email`. Never use a work email or push to a work org.

## Testing
Load unpacked from `extension/`, reload the extension card after changes, then refresh the ConnectWise tab. Check both themes, a service board with highlighted statuses, and the left nav.
