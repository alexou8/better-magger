# Better Magger — architecture

Static web app (Vite + Preact + TypeScript), deployed to GitHub Pages. Talks to the keyboard via WebHID
(Chrome/Edge/Opera desktop). Protocol reference: `research/PROTOCOL.md` (authoritative), cross-check
`research/DESKTOP_DRIVER.md`.

## Module ownership / public surface

`src/core/types.ts` — the shared contract (do not change without updating both sides).

Core layer (src/hid, src/core, src/data) exports, and the UI may import ONLY these:

- `src/core/types.ts` for types; `src/core/protocol.ts` exposes the pure `encodeMacros` preflight for backup
  memory validation. Device I/O continues through the session contract.

- `src/core/connect.ts`
  - `isWebHidSupported(): boolean`
  - `requestKeyboard(): Promise<ConnectResult>` — shows the browser picker (needs a user gesture)
  - `reconnectKnown(): Promise<ConnectResult | null>` — silently reopen an already-authorised keyboard; null if none
  - `openDemo(pid?: number): Promise<KeyboardSession>` — fully simulated keyboard (default Magger68 Plus)
  - `supportedModels(): DeviceModel[]` — Magger models first
  - `onDeviceAttached(cb: () => void): () => void` — navigator.hid 'connect' for auto-reconnect
- `src/core/units.ts`
  - `rawToMm(raw, rawPerMm)`, `mmToRaw(mm, rawPerMm)`, `rtMode(model, id): RtPrecisionMode`, `formatMm(mm)`
  - `defaultTrigger(model): KeyTrigger`
- `src/data/keycodes.ts`
  - `describeAction(a: KeyAction, model: DeviceModel): { label: string; short: string; category: string }`
  - `pickerCategories(model): { id: string; name: string; keys: { action: KeyAction; label: string }[] }[]`
  - `actionsEqual(a, b): boolean`, `EMPTY_ACTION`, `isModifierAction(a)`
  - `MOD_BITS` (`{ LCtrl:1, LShift:2, LAlt:4, LGui:8, RCtrl:16, RShift:32, RAlt:64, RGui:128 }`)
  - `hidUsageFromKeyboardEvent(e: KeyboardEvent): number | null` (for "press a key to assign" & macro recording)
- `src/data/lighting.ts`
  - `LIGHT_EFFECTS: { id: number; name: string; speed: boolean; brightness: boolean; color: boolean; direction: 0|1|2|3|4 }[]`
  - `DIRECTION_LABELS: Record<number, [string, string]>`
  - `SLEEP_OPTIONS_MIN: number[]` (0 = never)

## Design principles (fixes vs. the official driver)
- One serial command queue per device; reply command/offset matching learned per command, with a legacy
  serial path for non-echoing firmware; timeouts reject with an error and
  are retried once; unsolicited reports routed to events — never mistaken for replies.
- Cached func block per profile, all func-block writes serialised read-modify-write.
- Correct masks (stability/debounce, key_mode & 0x0F, dead-zone encoding).
- Choose the right HID collection (vendor/config collection, 64-byte output) instead of `[0]`.
- Physical layout and active-profile reads must succeed before the UI permits editing. Simulator fallback
  key positions must never be used on a real device. See `docs/HARDWARE_VALIDATION.md` for verification limits.
- Every change is applied immediately to the keyboard with visible "Saved"/error feedback; no silent failures.
- Firmware flashing is intentionally NOT implemented (brick risk). We detect bootloader mode and link to
  the official updater.


## Browser previews and profile labels

- `KeyboardSession.readLiveColors(signal?)` reads global command `0xDE` at offsets 0..383 in seven
  serial chunks. It returns output RGB (already brightness-scaled), rather than the saved Custom table
  (`0x0A`). It never writes settings and has no per-profile offset. Cancellation is checked between chunks;
  each optional preview request has a 750 ms timeout with no automatic retries.
- `ui/lib/liveLighting.ts` schedules a new read 300 ms after the previous one finishes. It never overlaps
  reads, yields to pending writes/profile transitions, stops after an error and drops cancelled replies.
  `useLiveColors` owns its lifecycle; hidden tabs stop reads, reduced motion takes one sample, and paused
  views can refresh one snapshot. Profile/page unmounts cancel the old reader.
- `LightingPreview` defaults to keyboard output and renders it without additional brightness scaling or
  guessed timing. Unsupported readback shows an error with Retry and an explicit Illustration alternative.
  Tachyon locks settings but does not invent black LED output: the readback shows what the device reports.
- Illustration mode remains separate: `ui/lib/lightingPreview.ts` calculates approximate patterns from
  settings, geometry and time. Its timer stops on pause, hidden tabs, reduced motion or Tachyon mode.
- `ui/state/recentColors.ts` keeps six unique validated hex colours in a versioned browser preference.
  Picker input remembers final colour changes, and blocked storage falls back to the in-memory signal.
- Selection toolbar groups use physical layout codes rather than current assignments. Matching RT sensitivity
  copies each selected key's press value and precision to release, preserving its other trigger settings.
- `SwitchPreview` is a manual first-actuation demonstration. Its slider is component-local and cannot write
  triggers. Real measurements continue to come from `useLiveTravel`; the first selected key's current sample
  is displayed separately. Both views use the model's raw-per-mm scale and selected switch travel.
- `ui/state/profileNames.ts` uses versioned localStorage keys scoped by demo/device, PID and profile index.
  A signal-backed in-memory map supports blocked storage and updates header labels immediately. Names are
  browser preferences, outside the firmware/session and backup contracts; multiple devices of the same model
  share labels in that browser. Clearing a name restores its numbered label. No migration of backups is needed.
