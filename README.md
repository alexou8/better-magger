# Better Magger

A friendlier, more reliable web configurator for **LUMINKEY Magger** hall-effect (magnetic switch) keyboards.
It's an unofficial replacement for the official web driver at luminkey.club, and runs entirely in your browser.

**Use it:** https://alexou8.github.io/better-magger/ (desktop Chrome, Edge or Opera — they support WebHID)

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

## Why it's more reliable than the official driver

The protocol was reverse-engineered from the official web driver and cross-checked against the Windows driver
(`research/`). The official app has several bugs that cause the glitches people see; this app avoids them:

- Every command goes through one serial queue and replies are matched to requests — unsolicited keyboard
  reports (profile/OS/lighting changes) are no longer mistaken for replies.
- Timeouts are retried and surfaced as visible errors instead of silently producing garbage.
- Settings writes are serialised read-modify-write, so quick successive changes can't overwrite each other.
- Bit-mask bugs fixed (debounce wiped by the stability toggle, Rapid Trigger mode/priority mix-up, dead-zone
  encoding, macro mouse actions).
- The correct HID interface is chosen, and event listeners don't leak.

## Development

```bash
npm install
npm run dev      # local dev server (WebHID works on http://localhost)
npm test         # unit tests (protocol codec, session, transport, UI logic)
npm run build    # type-check + production build into dist/
```

`node scripts/e2e.mjs` runs the end-to-end demo tests against `npx vite preview --port 4173`.

Code map: `src/hid` (WebHID transport), `src/core` (protocol codec, session, connection, demo keyboard),
`src/data` (generated device/layout/keycode/lighting tables — `node scripts/gen-data.mjs`), `src/ui` (Preact app).
Protocol notes: `research/PROTOCOL.md`.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push. One-time setup: in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**.

## Disclaimer

Unofficial project, not affiliated with LUMINKEY. Use at your own risk; you can always restore defaults with the
factory reset or the official driver.
