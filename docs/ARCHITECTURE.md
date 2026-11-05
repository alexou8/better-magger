# Better Magger — architecture

Static web app (Vite + Preact + TypeScript), deployed to GitHub Pages. Talks to the keyboard via WebHID
(Chrome/Edge/Opera desktop). Protocol reference: `research/PROTOCOL.md` (authoritative), cross-check
`research/DESKTOP_DRIVER.md`.

## Module ownership / public surface

`src/core/types.ts` — the shared contract (do not change without updating both sides).

Core layer (src/hid, src/core, src/data) exports, and the UI may import ONLY these:

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
- One serial command queue per device; replies matched to requests; timeouts reject with an error and
  are retried once; unsolicited reports routed to events — never mistaken for replies.
- Cached func block per profile, all func-block writes serialised read-modify-write.
- Correct masks (stability/debounce, key_mode & 0x0F, dead-zone encoding).
- Choose the right HID collection (vendor/config collection, 64-byte output) instead of `[0]`.
- Every change is applied immediately to the keyboard with visible "Saved"/error feedback; no silent failures.
- Firmware flashing is intentionally NOT implemented (brick risk). We detect bootloader mode and link to
  the official updater.
