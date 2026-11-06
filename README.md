# Better Magger

A friendlier, more reliable web configurator for **LUMINKEY Magger** hall-effect (magnetic switch) keyboards.
It's an unofficial replacement for the official web driver at luminkey.club, and runs entirely in your browser.

**Use it:** https://alexou8.github.io/better-magger/ (desktop Chrome, Edge or Opera — they support WebHID)

## First use

1. Connect the keyboard with a USB data cable and close the official driver and other configurator tabs.
2. Open the site, click **Connect keyboard**, and choose your keyboard in the browser prompt. The app identifies
   Plus versus Pro from the USB product ID; you do not need to choose a variant yourself.
3. In **Settings**, export your current profile before making changes. Each profile needs its own backup.
4. Select a key on **Keymap** or **Performance** to edit it. Most changes apply immediately; macros have an
   explicit **Save macro** button. Unsaved macro drafts survive navigation within the same connection.

The browser requires permission on the first connection. Subsequent visits and USB replugs can reconnect silently.
Demo mode is separate from your keyboard and resets when disconnected or reloaded.

## Workbench interface

The interface uses a shared [design system](design-system/better-magger/MASTER.md), adapted with
[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): paper/graphite themes, restrained
copper accents, self-hosted IBM Plex fonts and SVG diagrams. Keymap and Performance pair the physical keyboard
with an action/tuning inspector; Lighting uses static pattern illustrations and native radios.

Keyboard access: Tab enters the keyboard once, arrow keys explore it, Enter/Space selects, Shift+arrows selects
multiple keys, and Home/End jumps to the ends. Profile/layer radios and action categories also support arrow
keys. Small screens scroll the keyboard internally so keys remain usable. Reduced motion and both themes
are covered by browser accessibility checks; automated scans do not establish complete WCAG conformance.

## Verification status

The application builds and has automated protocol, session, connection, backup, cache and real-browser demo tests.
**Physical keyboard compatibility has not been verified in this development environment.** The simulator uses
the same protocol assumptions as the app, so passing demo tests is not proof that every firmware revision works.
The web and desktop research also contains reply-offset discrepancies. See
[hardware validation](docs/HARDWARE_VALIDATION.md) and [protocol notes](research/PROTOCOL.md#8-implementation-and-hardware-verification-boundary).

Real connections stop if the physical keymap or active profile cannot be read; unknown key positions remain disabled.
Fixed-key SOCD priority is experimental. Firmware updating remains in the official driver.

## Supported keyboards

The app detects your model automatically from its USB product ID and only shows features that model has.

| Model | USB PID | Travel resolution | Notes |
|---|---|---|---|
| Magger68 | 19F5:FE24 | 0.02 mm | |
| Magger68 Pro | 19F5:FE25 | 0.02 mm | |
| Magger68 Plus | 19F5:FC67 | 0.01 mm | RT precision modes |
| Magger68 Ultra | 19F5:FC66 | 0.01 mm | RT precision modes |
| Magger68 Ultra JIS | 19F5:FC60 | 0.01 mm | JIS layout & key names |
| Magger 60 (several revisions) | 19F5:FB37 / FB38 / FB48 / FB49 | 0.01 mm | RT precision modes |

Other LUMINKEY devices from the official device table are recognised too, but only Magger models are the focus.

## Features

- **Connect in one click**, auto-reconnect after replugging or changing polling rate, clear messages when the
  keyboard is busy in another tab/app or in firmware-update mode.
- **Keymap** for all 4 layers (Main, FN1, Mac/FN2, FN3) and 4 profiles: searchable key picker, "press a key to
  assign", modifier combos, media/mouse/lighting keys, macros, reset to default, undo.
- **Performance**: per-key actuation point, Rapid Trigger (normal / continuous) with press & release sensitivity,
  precision modes, dead zones, switch type, presets and a **live key-depth view**.
- **Advanced keys**: DKS (dynamic keystroke), Mod-Tap, Toggle, SOCD / Snap Tap, Rappy Snappy, OKS.
- **Lighting**: all 23 effects, brightness, speed, direction, colour, sleep timer, per-key RGB painter.
- **Macros**: record with real timings or edit step by step.
- **Settings**: polling rate (up to 8 kHz), debounce, bottom-out actuation, tachyon mode, Win/Alt-Tab/Alt-F4
  locks, calibration wizard, factory reset, **profile backup/restore to a file** and copy between profiles.
- **Demo mode** with a simulated keyboard of any supported model — try everything without hardware.

Firmware flashing is intentionally not included (risk of bricking). Use the official updater for firmware.

## Reliability measures

The protocol was reverse-engineered from the official web driver, with additional Windows driver research
in `research/`. The implementation addresses several failure modes found in that analysis:

- Every command goes through one serial queue; known unsolicited reports go to event handlers. Reply matching
  learns command/offset echoes per command, retaining serial handling for non-echoing firmware.
- Timeouts are retried and surfaced as visible errors instead of silently producing garbage.
- Settings writes are serialised read-modify-write, so quick successive changes can't overwrite each other.
- Bit-mask bugs fixed (debounce wiped by the stability toggle, Rapid Trigger mode/priority mix-up, dead-zone
  encoding, macro mouse actions).
- The correct HID interface is chosen, and event listeners don't leak.
- Backup files are completely validated before any write. Restores write polling settings last because they can
  disconnect USB. A cable removal or write error can still interrupt a restore partway through; reconnect and retry.
- Late connection results and stale reads cannot replace a newer connection or overwrite newer cached data.

## Development

```bash
npm ci           # Node.js 22 or newer
npm run dev      # local dev server (WebHID works on http://localhost)
npm test         # unit tests (protocol codec, session, transport, UI logic)
npm run build    # type-check + production build into dist/
npx playwright install chromium
npm run test:e2e # starts preview automatically; runs Chromium demo flows
npm run check    # tests + build + browser tests
```

Run `npm run build` before standalone browser tests. To use an installed Chromium instead of downloading one,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its path. Browser tests cover remapping/undo, profile isolation,
advanced bindings, macro recording/drafts, backup/restore, performance, lighting, model variants and narrow screens.

Code map: `src/hid` (WebHID transport), `src/core` (protocol codec, session, connection, demo keyboard),
`src/data` (generated device/layout/keycode/lighting tables — `node scripts/gen-data.mjs`), `src/ui` (Preact app).
Protocol notes: `research/PROTOCOL.md`.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs unit tests, TypeScript/build and Chromium browser tests on
pushes and pull requests. Only successful runs on the repository's **default branch** deploy; feature branches
and pull requests cannot publish over the live site. One-time setup: in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**.

## Connection troubleshooting

- **No browser picker:** use desktop Chrome or Edge, over HTTPS (or localhost). Safari, Firefox and mobile
  browsers do not provide WebHID.
- **No keyboard in the picker:** use a data cable directly to the computer, try another port and use wired mode.
- **Keyboard busy:** close other configurator tabs and the desktop driver, then reconnect.
- **Disconnected after polling change:** allow USB to re-enumerate; the app retries automatically.
- **Cannot read key positions or profile:** reconnect. If it persists, check the model/firmware with the official
  driver and report the message with model, firmware, browser and OS in a GitHub issue.

## Disclaimer

Unofficial project, not affiliated with LUMINKEY. Use at your own risk; you can always restore defaults with the
factory reset or the official driver.
