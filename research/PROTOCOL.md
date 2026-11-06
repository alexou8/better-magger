# LUMINKEY / Magger WebHID protocol (reverse-engineered)

Source: static analysis of the official web driver at https://luminkey.club/ (Next.js build).
Main logic: `_next/static/chunks/app/page-f17bd796bc939422.js` (webpack module 19840). Lazy chunks
(layout JSONs, locales) are mapped by modules 3264 / 94781. Line numbers below refer to a
prettier-formatted copy of `page-f17bd796bc939422.js`; code excerpts are the original minified text.

Companion files: `devices.json`, `layouts.json`, `keycodes.json`, `lighting.json`.
Items marked **UNVERIFIED** are inferences that the JS alone cannot prove (no hardware captures).

---

## 1. Transport

### 1.1 Device selection / filters

`navigator.hid.requestDevice({filters:[...]})` (pretty line ~129) lists, for VID `0x19F5` (6645),
two filters per model:

| filter | meaning in the app |
|---|---|
| `{productId: <normal PID>, usagePage: 0x0001, usage: 0x0000}` | normal (keyboard) mode — the PID you configure |
| `{productId: <second PID>, usagePage: 0xFF00, usage: 0x0001}` | firmware-update / bootloader mode |

Evidence that the second PID is the bootloader: after connecting, if `productId` is one of
`0xFF17 0xFF39 0xFF7C 0xFF7D 0xFF7F 0xFF73 0xFF46 0xAF05 0xAF06 0xAF13 0xAF1E 0xAF1F 0xAF2A 0xFF87 0x8A20`
the app calls `ey(!0)` (= `setUpdateMode(true)`) and returns without reading config (pretty ~14050).
The firmware-update flow is `enterBootMode()` -> device re-enumerates -> user reconnects in
"update" mode -> `startUpdate()` (section 4.13). Those PIDs are also never stored in
`localStorage.lastConnectedHIDDevice`.

Magger PIDs (full table in `devices.json`):

| model | id | type | normal PID | boot PID | layout | fw (expected) | update file |
|---|---|---|---|---|---|---|---|
| Magger68 (original) | 1 | 101 | 0xFE24 | 0xFF17 | K68 | 116 | update_68_116.bin |
| Magger68 Pro | 2 | 102 | 0xFE25 | 0xFF39 | K68 | 113 | update_68Pro_113.bin |
| Magger68 Plus | 9 | 109 | 0xFC67 | 0xFF87 | K68 | 107 | Magger68Plus_107.bin |
| Magger68 Ultra | 10 | 110 | 0xFC66 | 0xFF7F | K68 | 109 | Magger68Ultra_109.bin |
| Magger68 Ultra JIS | 12 | 112 | 0xFC60 | 0xFF46 | K68_JIS | 109 | Magger68Ultra_JIS_109.bin |
| Magger 60 | 14 | 114 | 0xFB37 | 0xAF05 | K60_1 | 100 | – |
| Magger 60 | 15 | 115 | 0xFB38 | 0xAF06 | K60 | 100 | – |
| Magger 60 | 17 | 117 | 0xFB48 | 0xAF1E | K60 | 100 | – |
| Magger 60 (2404) | 18 | 118 | 0xFB49 | 0xAF1F | K60 | 104 | update_Magger60_2404_104.bin |

Names "Magger68" / "Magger68 Pro" come from the firmware-notes table `oS` (pretty ~18959,
`"vid_pid":"0x19F5_0xFE24","title":"Magger68"`, `"0x19F5_0xFE25" ... "Magger68 Pro"`); Plus/Ultra/JIS
names only from update-file names. There is no "Magger68 Per" anywhere in the bundle. The
`K68_Ultra_UK.json` layout exists in the lazy-chunk map but no device entry references it.

Lookup (`ea()`, pretty ~13228): key = `"0x19F5_0x" + pid.toString(16).toUpperCase()`. PIDs `0x3250`
(12880) and `0xA026` (40998) map to arrays and are disambiguated by `HIDDevice.productName`
(e.g. "LK80 2.4G", "LK98-V2"). Unknown -> `alert("连接失败…")`. Missing type defaults to 101,
missing layout to "K68".

`getFilteredDevices` (auto-reconnect) keeps devices with a collection
`(usagePage 1, usage 0)` or `(usagePage 0xFF00, usage 1)`. The app takes `requestDevice()[0]` —
it never checks which collection it got.

A second, unrelated HID stack (pretty ~31287) targets VID 0x0C45 PID 0x0500, usagePage 0xFF05/0xFF60
(VIA-style). It is not used for Magger.

### 1.2 Reports

* **Output:** `device.sendReport(0, data)` — report ID 0 (no report IDs), **64 bytes**.
  No feature reports are used anywhere.
* **Input:** `inputreport` events, 64 bytes, read from `e.data.buffer`.

```js
async webhid_write_command(e){let o=...arguments[1]:[],t=[0,e,...o],d=Array(65).fill(0);
 return t.forEach((e,o)=>{d[o]=e}),await this.getHID().write(d),Array.from(await this.webhid_read_command())}
async write(e){...let t=new Uint8Array(e.slice(1));this.fastForwardGlobalBuffer(Date.now()),
 l[this.address]=[],await ...sendReport(0,t)}
```

### 1.3 Frame format (the 0x55 command channel)

All normal commands are sent as `sendDeviceData(85, [cmd, 0, chk, ...])`, which becomes the 64-byte
report:

```
byte 0   0x55            frame header ("85")
byte 1   CMD
byte 2   0x00
byte 3   CHK
byte 4   LEN             payload length, 0..56
byte 5   OFF_LO          16-bit little-endian byte offset into the addressed table
byte 6   OFF_HI
byte 7   0x00
byte 8.. DATA[LEN]       (writes only; reads send zeros)
rest     0x00 padding to 64
```

* **Read checksum:** `CHK = (LEN + OFF_LO + OFF_HI) & 0xFF`
  (`c=(a+n+d)&255; getDeviceData(85,[cmd,0,c,d,a,n])`)
* **Write checksum:** `CHK = (LEN + OFF_LO + OFF_HI + 0 + sum(DATA)) & 0xFF`
  ```js
  async sendData(e,o,t){for(let d=0;d<t.length;){let a=Math.min(56,t.length-d),[n,c]=v(o+d),
   r=t.slice(d,d+a),l=[a,n,c,0,...r],i=255&f().sum(l);await this.sendDeviceData(85,[e,0,i,...l]),d+=a}}
  ```
  `v(x) = [x & 0xFF, x >> 8]`, `k([lo,hi]) = hi<<8 | lo`.
* Fixed-arg commands use the same rule, e.g. `reset`: `[238,0,0,1,0,0,0,255]` -> LEN 1, DATA FF,
  CHK (1+0xFF)&0xFF = 0.
* **Chunking/pagination:** tables are transferred in 56-byte chunks at increasing OFF; the last
  chunk is shorter. OFF is an absolute byte offset that includes the profile/layer base (see each
  command). OFF is only 16 bits, so every table must fit in 64 KiB.
* **Response:** the next input report (byte0 != 0xA0). Payload is **`response[8 .. 8+LEN)`**
  (`flatMap(e=>e.slice(8))`). Bytes 0..7 of the response are never inspected
  (presumably an echo of the request header — **UNVERIFIED**). No checksum validation of responses.
* Every command — reads *and* writes — waits for exactly one input report.

### 1.4 Request/response matching, timeouts, queueing

* Strict FIFO, one outstanding command per device (`commandQueue` + `flushQueue`). `Promise.all`
  over chunk reads still runs them sequentially through the queue.
* Before each send: `fastForwardGlobalBuffer(Date.now())` drops all buffered unsolicited reports and
  `l[addr]=[]` drops pending read callbacks. The next input report whose byte0 != 0xA0 is the reply.
  **There is no matching on CMD/OFF**; the first report wins.
* Read timeout: 1500 ms (`Promise.race([... setTimeout(()=>e([]),1500) ...])`). On timeout the
  reply is `[]` (so `.slice(8)` is empty) — no retry, no error.
* No inter-packet delays anywhere in the config protocol.
* Input listener (`setupListeners`): reports whose byte0 == 160 (0xA0) are excluded from the
  reply path:
  ```js
  addEventListener("inputreport",e=>{160!=new Uint8Array(e.data.buffer)[0]&&(l[addr].length!==0
    ? l[addr].shift()(new Uint8Array(e.data.buffer)) : r[addr].push({currTime:Date.now(),message:...}))})
  ```
  A second handler (`oninputreport`, class O `addListeners`) dispatches unsolicited events (§5).

---

## 2. Data model

* **Profiles:** 4 (0..3) for types 101,102,107–115,119–124. `getBase()` profile > 3 is clamped
  to 0. For types 116/117/118 (two Magger 60 variants + BLA75) the app forces profile 0 at connect
  (they are missing from the list at pretty ~14305) — likely an oversight, **UNVERIFIED**.
* **Layers:** 4 per profile: 0 "Main"(Win), 1 "FN1", 2 "FN2"(Mac layer, the app switches to layer 2
  when the keyboard reports Mac mode), 3 "FN3" (`tC` pretty ~29982).
* **Key slots:** 128 per layer (protocol key index 0..127). The physical->index mapping is
  discovered at runtime from the default keymap (see `layouts.json`).
* **Key action:** 3 bytes `{type, code1, code2}` (see `keycodes.json`).

Per-profile tables (OFF base = profile × size unless noted):

| table | read cmd | write cmd | size/profile | element |
|---|---|---|---|---|
| func/config block | 0x05 | 0x06 | 64 | see §3 |
| default keymap | 0x07 | – | 2048 (4 × 512) | 128 × 3 B per layer |
| user keymap | 0x08 | 0x09 | 2048 (4 × 512) | 128 × 3 B per layer |
| per-key colors | 0x0A | 0x0B | 512 (384 used) | 128 × RGB |
| macros | 0x0C | 0x0D | 2048 | §4.9 |
| key trigger/travel | 0xA0 | 0xA1 | 1024 | 128 × 8 B |
| DKS | 0xA2 | 0xA3 | 768 | 32 × 24 B |
| MT / RS / SOCD / OKS | 0xA4 | 0xA5 | 256 (192 used) | 32 × 6 B |
| TGL | 0xA6 | 0xA7 | 128 (96 used) | 32 × 3 B |
| TD | 0xB0 | 0xB1 | 256 | 32 × 9 B (overflows, §7) |
| app data | 0xF1 | 0xF2 | 1024 (data from +56) | 5 B records |

There is **no explicit save/commit command**; every write is applied directly (presumably
persisted by firmware — **UNVERIFIED**).

---

## 3. func block (cmd 0x05 read / 0x06 write)

Read: `for(t=64*p; t<64*(p+1); t+=56) getDeviceData(85,[5,0,chk,len,lo,hi])` -> 2 packets (56 + 8),
result sliced to 64. Write: `sendData(6, 64*p, block64)` (2 packets). The app always does
read-modify-write of the whole 64 bytes.

```js
async getBaseInfo(e){let o=await this.api.getFunc(e);return{reportRate:15&o[4],tick:o[4]>>4&15,
 debounce:o[7]>>5&7,bottomrapidtriggerMode:o[7]>>1&1,macMode:o[1],tachyonMode:1&o[7],lightEffect:o[8],
 lightBrightness:o[9],lightSpeed:o[10],color:o[12],r:o[14],g:o[15],b:o[16],lightSleep:o[35],lightSleep2:o[36]}}
```

| byte | bits | meaning |
|---|---|---|
| 0 | | unknown (`getKeyboardConfig()` = `getFunc(0)`; the demo stub lists version/pid/firmware/workMode/linkStatus/battery/charge/profileCnt/profile/layerCnt/layer — **UNVERIFIED** whether bytes 0..10 really mean this) |
| 1 | all | OS mode ("macMode"); UI: `2 == macMode ? "mac" : "windows"`; written by `setSystemMode` (unused in UI) |
| 4 | 0–3 | polling ("return") rate: 1 = 8000 Hz, 2 = 4000, 3 = 2000, 4 = 1000 |
| 4 | 4–7 | "tick" rate (setter exists, no UI) |
| 6 | 0 / 1 / 2 | lock Win / lock Alt-Tab / lock Alt-F4 (setters exist, no UI) |
| 7 | 0 | "Light speed mode" (tachyon/berserk); UI notes lighting cannot be adjusted while on |
| 7 | 1 | "Actuation when bottom out" (stability / bottom protection) |
| 7 | 3 | debug mode: device streams live travel reports (§5); app sets it to 1 while the Performance tab is open, 0 otherwise (not for types 120–124) |
| 7 | 5–7 | debounce ("shake resistance"): 0 low, 1 medium, 2 high |
| 8 | | lighting effect id (0..22, `lighting.json`) |
| 9 | | brightness (UI 0..100) |
| 10 | | speed, stored as `4 - uiSpeed` (uiSpeed 0..4) |
| 11 | | direction (0/1, per effect) |
| 12 | | 0 = single user color, 1 = multicolor |
| 14,15,16 | | R, G, B |
| 35 | | light sleep timeout in 30 s units (UI 2/20/30/60 = 1/10/15/30 min) |
| 36 | | 1 = never sleep (UI writes [35]=0,[36]=1) |

After `setReportRate` the UI waits 3 s and reconnects if the device dropped
(`setTimeout(()=>{Z.current||g()},3e3)`): changing the polling rate probably re-enumerates.

---

## 4. Commands

### 4.1 Firmware/device info — 0x03
`sendDeviceData(85,[3,0,32,32])` (LEN 32, OFF 0). Response `data[0..1]` = firmware version, LE:
`{fw_ver: ((e[1]<<8)|e[0]).toString(16)}` -> e.g. bytes `07 01` -> `"107"`. The version is BCD-like
(hex digits read as decimal). `"4148"` (0x4148) is treated as "needs update".

### 4.2 Active profile — 0x04
`[4,0,32,32]` -> `data[0]` = active profile index.

### 4.3 Select profile — 0x0E
```js
async setConfigMode(e){let o=...arguments[1]:1;await this.sendDeviceData(85,[14,0,2+e+o&255,2,0,0,0,e,o])}
```
LEN 2, OFF 0, DATA `[profile, mode]`; mode = 1 for Magger (4 for types 122/124). The app then
re-reads everything for that profile (`e8()`).

### 4.4 Keymap — 0x07 default (read), 0x08 user (read), 0x09 user (write)
* Read layer `L` of profile `P`: OFF from `2048*P + 512*L` to `+512` in 56-byte chunks; use the first
  384 bytes = 128 × `{type, code1, code2}`.
  ```js
  async getKeyMatrix(e,o){let t=arguments[2],d=[],a=t?7:8;for(let t=512*o;t<512*(o+1);t+=56){
   let n=Math.min(512*(o+1)-t,56),[c,r]=v(t+2048*e),l=(c+r+n)&255;d.push(this.getDeviceData(85,[a,0,l,n,c,r]))}...slice(0,512)}
  ```
* Write one key: `sendData(9, 2048*P + 512*L + 3*index, [type,code1,code2])`.
  Write a whole layer: same with index 0 and 3×N bytes.
  (`setUserKeyMatrix(e,o,t,d){await this.sendData(9,512*t+3*d+2048*o,e)}`, args data,profile,layer,index.)
* Default keymap (0x07) is what the app uses to bind layout positions to indices; it reads
  default layers 0..3 but only layer 0 is used for mapping.

### 4.5 Key travel / actuation / rapid trigger — 0xA0 read, 0xA1 write
1024 bytes/profile = 128 keys × 8 bytes, OFF `1024*P + 8*index`.

| byte | bits | field |
|---|---|---|
| 0 | 7–4 | always 0xA (written as `0xA0 | switch_type`) |
| 0 | 3–0 | switch_type (index into the model's switch list, `devices.json` features.switchTypes) |
| 1 | 3–0 | key_mode: 0 normal, 1 rapid trigger, 2 "full-trip" (continuous) rapid trigger |
| 1 | 7–4 | priority (SOCD: 1/2 = which key of the pair wins; 0 none) |
| 2 | 7–0 | actuation − 1, bits 0–7 |
| 3 | 0 | actuation − 1, bit 8 |
| 3 | 2–1 | release (RT up) precision mode |
| 3 | 4–3 | press (RT down) precision mode |
| 4 | 7–0 | rt_press − 1, bits 0–7 |
| 5 | 0 | rt_press − 1, bit 8 |
| 5 | 7–1 | press (top) dead zone, raw |
| 6 | 7–0 | rt_release − 1, bits 0–7 |
| 7 | 0 | rt_release − 1, bit 8 |
| 7 | 7–1 | release (bottom) dead zone, raw |

Values are 9-bit (1..512 after +1). Decode/encode evidence (`getKeyTrigger` / `setAllKeyTravel`, class O):

```js
key_actuation:k([d[2],1&d[3]])+1, pressPrecision:d[3]>>3&3, releasePrecision:d[3]>>1&3,
rt_press:k([d[4],1&d[5]])+1, rt_release:k([d[6],1&d[7]])+1, press_deadzone:d[5]>>1&127 ...
o[3]=1&d[1]|(3&e.pressPrecision)<<3|(3&e.releasePrecision)<<1; ... o[5]=a[1]|Math.max(0,e.press_deadzone)<<1
```

**Units (per device type — the main encoding difference between models):**

| | types 101, 102 (Magger68, Magger68 Pro) | all other Hall types (107–119, incl. Plus/Ultra/JIS/Magger 60) |
|---|---|---|
| actuation unit | **0.02 mm** (50 raw/mm) | **0.01 mm** (100 raw/mm) |
| full travel (`switchMaxTravel`) | 170 (3.4 mm) — per-switch 175/170/165 | 340 (3.4 mm) — per-switch 330..370 |
| min actuation (`minTravel`) | 4 | 9 |
| dead-zone max | 25 | 50 |
| RT press/release max | 220 raw (UI also sets `rtMaxTravel`=110) — **UNVERIFIED** unit for 101/102 | 220 raw at precision 0 |
| RT precision modes | not offered (bits stay 0) | 0: 0.01 mm (100/mm, max 220 = 2.2 mm); 1: 0.005 mm (200/mm, max 500 = 2.5 mm); 2: 0.001 mm (1000/mm, max 500 = 0.5 mm) — types 107–112, 114–119 |

Evidence: pretty ~14077 `101==t||102==t?(setSwitchMaxTravel(170),setSwitchStep(.02),setSwitchStepValue(50),setMinTravel(4),setDeadzoneMaxTravel(25),…):(setSwitchMaxTravel(340),setSwitchStep(.01),setSwitchStepValue(100),setMinTravel(9),setDeadzoneMaxTravel(50),…)`;
precision modes ~14160 (`2===o?(setPressSwitchMaxTravel(500),setPressSwitchStep(.001),setPressSwitchStepValue(1e3)…)`);
presets ~30401 (`Office`: actuation `0.02==u?100:200` = 2.0 mm). Displayed mm = raw / stepValue.
The precision mode only changes how the RT fields (bytes 4–7) are read; actuation stays at the base unit.
The UI clamps actuation ≤ `switchTravel − release_deadzone`.

### 4.6 DKS (dynamic keystroke) — 0xA2 read, 0xA3 write
768 B/profile = 32 slots × 24 B, OFF `768*P + 24*slot`. Keymap entry `{144, slot, 0}`.

```
[0] point0  first actuation depth   (0.1 mm units, default 10 = 1.0 mm, UI range 1..point1)
[1] point1  bottom depth            (default 30, UI range point0..30)
[2] point2  release-from-bottom     (default 30, UI range point3..30)
[3] point3  final release           (default 10, UI range 1..point2)
[4+5i .. 8+5i] action i (i = 0..3): type, code1, code2, maskLo, maskHi
```
DKS points are a **different unit (0.1 mm)** from travel (`valueLabelFormat: e=>[e/10,"mm"]`).
Mask (u16 LE): bits 0–2 = phase "down start" (pass point0), 3–5 = "down end" (reach point1),
6–8 = "up start" (leave bottom), bit 9 = "up end" (full release). Each 3-bit field is a thermometer
code of a UI state 0..3 (`dksStatus2Bit(e)=(e>0)|(e>1)<<1|(e>2)<<2`). UI-state normalisation on
write: `downStart==4 -> (3,3,2)`, `downStart==3 -> (3,2,…)`, `downEnd==3 -> upStart=2`; the reverse
is `e9()`. Exact firmware semantics of values 1/2/3 (tap vs. hold) **UNVERIFIED**.

### 4.7 MT / RS / SOCD / OKS — 0xA4 read, 0xA5 write
256 B/profile, 32 slots × 6 B: `[tap.type, tap.code1, tap.code2, hold.type, hold.code1, hold.code2]`
(`clickKey` then `downKey`). The app always rewrites the whole profile (`setAllMtKeyInfoForOks`,
OFF `256*P`).

Keymap entries:
* MT: `{146, slot, holdTime/10}` (hold time in 10 ms, default 100 ms).
* RS (147) / SOCD (148) / OKS (149): each pair uses **two** MT slots, one per key:
  key A `{type, slotA, indexB}`, key B `{type, slotB, indexA}`; slot A = `[A's key, B's key]`,
  slot B = `[B's key, A's key]`. SOCD stores priority in trigger byte1 high nibble (1/2, mirrored),
  and both keys get the pair's actuation/rt values via `setKeyTrigger` (0xA1 single-key write).

### 4.8 TGL — 0xA6/0xA7, TD — 0xB0/0xB1
* TGL: 32 × 3 B `[type,code1,code2]`, OFF `128*P + 3*slot`; keymap `{145, slot, 0}`.
* TD (only offered for types 120–122): 9 B `[hold(3), doubleTap(3), tap(3)]`, OFF `256*P`; keymap
  `{150, slot, time/10}`.

### 4.9 Macros — 0x0C read, 0x0D write
2048 B/profile at OFF `2048*P`. 16 macros in the UI (M1..M16), 32 offset entries in the table.
```
[0..63]   32 × u16 LE start offset (relative to the macro block); 64 (0x40,0x00) = empty
[64..]    actions, 4 bytes each:
          [delayLo, delayHi, flags, code]
          flags bit0-5 kind: 1 = modifier (code = bitmask 1<<(usage&15)), 2 = key (HID usage), 3 = mouse
          flags bit6: 1 = press, 0 = release;  bit7: 1 = last action of this macro
          delay (ms, UNVERIFIED unit) = wait after this action before the next (last = 0)
```
Write chunks are 56 B at OFF `2048*P + 56*n` (`setMacro`), all chunks sent sequentially.
Keymap entry `{112, macroIndex, code2}` — code2 is copied from the macro item; meaning (play mode /
repeat) **UNVERIFIED**.

### 4.10 Per-key RGB — 0x0A/0x0B, live colours — 0xDE
* Custom colours (used by effect 0 "Custom"): OFF `512*P + 3*index`, RGB per key; read 384 B.
* Single key write: `[11,0,chk, 3, lo, hi, 0, R,G,B]` with OFF `512*P + 3*index`.
* 0xDE: read 384 B (OFF 0..383) = current LED colours (live preview; the official driver polls every 300 ms).
  This is global output for the active keyboard, not a profile-strided table or the saved Custom colours.
  Better Magger exposes it as `readLiveColors(signal?, slotCount?)`: up to seven serial chunks,
  cancellable between chunks, no extra brightness scaling, no effect-reset writes. These are sampled frames, not an atomic hardware
  timestamp or zero-latency stream. The UI targets 30 updates per second, accounting for USB read time,
  and stops after the highest visible slot rather than reading unused trailing slots. Physical support still
  needs confirmation per model/firmware.

### 4.11 App data — 0xF1 read, 0xF2 write
Per profile 1024 B at OFF `1024*P`; records start at +56 (read drops the first 56 bytes, write
starts at `1024*P+56`). Records are 5 B `[advType, slotIndex, origType, origCode1, origCode2]`
terminated by advType 0: the original key the user bound to each DKS(144)/TGL(145)/MT(146)/
RS(147)/SOCD(148)/OKS(149)/TD(150)/combo(16) entry, so the UI can show it. Written length =
max(previous length, new length), zero-padded to erase old records. Whether firmware reads it:
**UNVERIFIED** (looks UI-only).

### 4.12 Calibration, reset, misc
| action | frame |
|---|---|
| start calibration | `55 A8 00 00 …` (LEN 0) |
| end calibration | `55 A9 00 00 …` |
| factory reset | `55 EE 00 00 01 00 00 00 FF` -> device later emits 0xA2 event; app waits 5 s then reloads |
| fast mode on/off (unused) | `55 01 00 00`, `55 02 00 00` |
| enter bootloader | `5F 06 00 52 01 00 00 00 51` (header 0x5F, otherwise same framing) |

During calibration the device streams 0xA0 reports (byte 10 = per-key check status, travel in 6/7).

### 4.13 Firmware update (bootloader PID, not 0x55 framed)
`startUpdate(bin)`: `eraseRom` `[0x81, 7, vidLo, vidHi, pidLo, pidHi, 0]` -> for each 32-byte chunk
`[0x80, len, addr0, addr1, addr2, addr3, data…]` (addr = 32×n, LE u32) -> same chunks again with
`0x82` (verify) -> `[0x83,1,0,0,0]` (end, **not awaited**) -> `[0x84,1,0,0,0]` (success). Each still
waits for one input report. Firmware binaries are fetched from the site root by file name.

---

## 5. Unsolicited input reports (class O `addListeners`)

| byte0 | meaning | payload |
|---|---|---|
| 0xA0 | live key travel (debug mode) / calibration sample | [1]=type,[2]=code1,[3]=code2 of the key's **default** action; travel = `[6]<<8 \| [7]` (big-endian!); [10] = calibration check status. Key located by `N(type,code1,code2)` against layout codes; `N()==3809` (type 224, code1 0) is hard-coded to key 65 |
| 0xA1 | profile changed on the keyboard | [2] = new profile, [8..16] = light bytes as in the func block |
| 0xA2 | reset finished | [2] = profile |
| 0xA3 | OS/Mac mode changed | [2]: 0,4,8,12 -> layer 0; 2,6,10,14 -> layer 2; [8..16] light bytes |
| 0xAA, [1]=0xFA | lighting changed | (light listener) |
| contains `FA FB 06 00` | dongle: keyboard disconnected | |
| contains `FA FB 06 01` | dongle: keyboard linked | |

Travel units in 0xA0 reports: displayed via the same stepValue — **UNVERIFIED**.

---

## 6. Per-device differences (all gating found)

| gate (pretty line) | types | effect |
|---|---|---|
| ~14077 | 101,102 vs rest | travel unit 0.02 mm vs 0.01 mm, limits (§4.5) |
| ~14107 | 107–112,114–119 | RT precision modes offered (bits 3[1..4]) |
| ~14305 | 101,102,107–115,119–124 | 4 profiles; others forced to profile 0 |
| ~14332, ~19071 | same minus 122,124 | backup/restore all 4 profiles around firmware update |
| ~20124 `oR` | per type | switch list & full travel (`devices.json`) |
| ~29260 menu | not 120–124 | RS, SOCD, DKS, MT, TGL, OKS available |
| ~29548 | 120,121,122 | Combo (CB) and Tap-Dance (TD) |
| ~31088 | 120–124 | no Performance (travel) tab, no debug-mode writes; 123 also no Light tab |
| ~16521, ~16862, T() | 112 (and 124) | JIS key-name table, JIS picker keyboard, "E/J" key; preset colour on slot 53 |
| ~16175 | 122,124 | profile select mode byte 4 instead of 1 |
| layout JSON | K80 (120/121) | only effects 1,3,4 |

Everything else (polling-rate options 8k/4k/2k/1k, debounce, sleep, lighting list 0..22, per-key
RGB, macros) is not gated for Magger types. The site has no screen, knob or side-light settings
for Magger (special keycodes "Side Bright±" etc. exist in the keycode list only).
Magger 60 (114/115/117/118) uses the same protocol and units as Magger68 Plus/Ultra.

---

## 7. Bugs / gotchas in the official code (avoid these)

1. **No reply matching.** First non-0xA0 report is taken as the reply; unsolicited 0xA1/0xA2/0xA3/
   0xAA/`FA FB` reports arriving mid-command are consumed as replies and shift data. Match replies
   on byte1 (CMD) and OFF (**UNVERIFIED** echo) and route 0xA1–0xAA/FA FB to events.
2. **Silent timeouts:** 1500 ms timeout resolves `[]`; decoders then produce `NaN`/`undefined`.
3. **Missing awaits:** func-block setters (`setReportRate`, `setDebounce`, `setLockWin`, `setTickRate`,
   `setStabilityMode`, `setBerserkMode`, `setDebugModeKey`, `setLightSleep`, `setFunData`) call
   `this.api.setFunc(...)` without `await`; `setKeyColor`, `setKeyInfos` chunks, `endRom()` likewise.
   Concurrent read-modify-write of the 64-byte func block can lose updates (e.g. lighting + debounce).
   Keep one cached copy of the func block and serialise writes.
4. **`setStabilityMode` mask bug:** `t[7]=29&t[7]|o<<1` (29 = 0b00011101) clears debounce bits 5–7.
   Use mask `0xFD`.
5. **`key_mode` decode includes priority:** `key_mode:d[1]` (no `&15`). Mask it.
6. **Dead-zone encode inconsistency:** `setAllKeyTravel` writes `dz<<1`, `setKeyTrigger` writes
   `(dz-1)<<1` and drops the precision bits in byte 3; decode reads `dz` raw. Use the
   `setAllKeyTravel` form everywhere.
7. **`openDebug/closeDebug`** read profile e but write `setFunc(0, …)` (profile 0).
8. **`setMtKeyInfo` offset** `(256*e+o)*6` is wrong (should be `256*e+6*o`; unused).
   `getAllKeyMatrix` offset `512*o*e` also wrong (unused).
9. **TD table overflow:** 32 × 9 B = 288 > 256 B read/written; slots 28–31 truncated.
10. **Macro mouse encode:** encoder marks mouse actions as kind 2 (key) and only handles webCodes
    "0".."3"; decoder expects kind 3. Decoder also maps modifier actions through `N(32,…)` which
    returns 0. Loop bound `d<2100` reads past the 2048-byte buffer.
11. **Listener leaks / stale closures:** listeners are pushed on every React effect run and never
    removed; dispatch uses `find()` so only the first (stale) one runs.
12. **Firmware version compare** mixes hex strings and decimal numbers (`D(...) > e.fw_ver`).
13. `HIDDevice.open()` is fired from the constructor without awaiting; `write` awaits
    `openPromise` but `requestDevice()[0]` may not be the right collection.
14. Line ~30554 `(e[t]&&e[t].code1===o&&101==t)||102==t` compares the loop index to device types.
15. `oninputreport` is overwritten (`addListeners`) while `addEventListener` is also used — fine,
    but don't rely on `oninputreport` alone.
16. Key index is found by matching codes; duplicate default codes (two Space keys on JIS, etc.)
    are assigned in order — keep that algorithm or mis-binds occur.

Recommended implementation: a single serial queue, per-command reply matching with timeout+retry,
cached tables per profile, writes as whole chunks, and explicit event routing for 0xA0–0xAA.

## 8. Implementation and hardware verification boundary

The current transport learns whether each command echoes CMD from its first accepted reply.
OFF matching is enabled only after a reply matches a nonzero requested offset; a zero offset alone
does not prove echoing, because legacy headers may always contain zero. Learning is per command
so generic write acknowledgements and command-only headers can coexist with echoed table reads.
Known duplicate and late replies are dropped once sufficient header evidence exists. Firmware
whose replies do not echo these fields retains serial reply
handling after unsolicited-event routing; full request correlation is not established for that
firmware. There is no sequence number, so repeated requests with the same CMD/OFF cannot distinguish
a delayed duplicate from a new reply. Real hardware captures are still needed to establish reply
headers across supported firmware revisions.

Real sessions require a readable, recognisable default keymap. Physical keys without a matching
default action stay unresolved (disabled); synthetic demo positions are never substituted for
real-device positions. Failure to read the map aborts the connection and releases the HID device.

The desktop notes are a useful independent source for VID/PID and report size, but their §5
reports a payload offset of 7 while the web driver directly slices at 8; the desktop config notes
also have shifted byte indices. Those static-analysis discrepancies are not proof that desktop
and web formats differ. The implementation follows the observed web-driver indexing. Simulator
tests validate internal consistency, not physical keyboard compatibility or persistence after
unplugging. Verify connection, physical key mapping, an exported backup, a reversible key remap,
settings readback, reconnection, and persistence on the actual keyboard before claiming those
flows have been hardware-tested.
