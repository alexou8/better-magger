# LUMINKEY HE Desktop Driver: static analysis

Source: public Drive folder `1AMyegUEBEmMFFIEdybFO3eiYMUuQ7qR5`. Nothing was executed. Everything below comes from static
extraction plus `objdump` disassembly of the 32-bit MFC binary.
Confidence tags: **[confirmed]** means seen directly in code or data, **[inferred]** means a reasonable reading of the code, **[guess]** means weak.

## 1. What is in the folder [confirmed]

| Drive id | Name | What it is |
|---|---|---|
| 1jUKy2PKnC-oCkHfRWSkzKcMVsWFpmQ9Y | DKS Key Travel Increase | **Sub-folder** (dated Mar 23) holding a newer bundle: `LUMINKEY HE Driver-1.0.2.9.zip` (id 13IPgsek32hLNd0WILIRyybZIa5MnoF97) and `Magger68_APP_CS_4FE5D74F_V118_0323.exe` (id 1jbnNeS6NW9ckTj8F5xN00MibsoNj8RcD, the Magger68 firmware updater V1.18). The folder name suggests this firmware/driver pair raises the DKS travel range. I did not confirm that from code. |
| 1BNzWZ2CIn1stJEwDC_F0rawi-Ituihci | LUMINKEY HE Driver-1.0.2.5.exe | Inno Setup 6.3.0 installer (45 MB), driver v1.0.2.5 (2024-12-23) |
| 1KTV-GGeO7gAk5XUBkPEQNmP2vbUPYMqP | Magger68-Per-V1.15-Firmware.exe | `FirmwareUpdateTool` (MFC). Its VS_VERSION ProductName is **"Magger68"** |
| 1di7greK0ffjVjn7wMWlOBkVkoeM9_MLo | Magger68-Pro-V1.12-Firmware.exe | Same tool. ProductName is **"Magger68 Pro"** |

The id-to-name mapping given in the task is correct. Driver 1.0.2.9 is dated 2026-03-21 and is almost identical to 1.0.2.5.
The only real difference is that 1.0.2.9 ships 3 extra layout XMLs (see §4).
1.0.2.9 also hard-codes this Drive folder as its download link (`https://drive.google.com/drive/folders/1AMyeg...`).

**"Per" means the plain Magger68 (not Pro).** The Per updater's product name is "Magger68", and it targets PID FE24/FF17, the same as the V118 updater.
It is probably a typo for "Plus" [inferred].

## 2. Technology [confirmed]
- The installer is Inno Setup 6.3. The bundled innoextract 1.9 cannot unpack it, so I decompressed the solid LZMA1 chunk (`zlb\x1a` at file offset 0xC1E00) by hand.
  I then reversed Inno's E8/E9 call filter (`inno_exe_decoder_5200`, flip_high_byte) on the main exe.
- The app is a **native C++/MFC** app with its own `mui.dll` UI library. It is **not Electron or Qt**, so there is no JS or asar to reuse.
- Installed files: `LUMINKEY HE Driver.exe`, `CH375DLL.DLL` (WCH ISP for the bootloader), `mui.dll`, `config.xml`, `language\{1033,1041,1042,2052}.lan` (UTF-16 INI),
  `layouts\*.xml`, `profile\default_light.xml`, skins and fonts. Local state lives in SQLite (`db\%s_datav11.db`), with tables `t_profile_data` and `t_light_data`
  (columns: mode, brightness, speed, direction, colorful, colorindex, color_value, config_func), `t_userlight_data` and `t_customlight_data`.
- HID access goes through a statically linked **hidapi** (Windows backend): `hid_write` at 0x4671e0, `hid_read_timeout` at 0x4672c0.

## 3. Device / PID table (complete for this driver) [confirmed]
The table is built in code at 0x431709 to 0x4318b8 (60-byte entries) and is consistent in 0x41de2e, 0x41fe9b and 0x445ddc.

| device_type | Display name | Layout file | Runtime VID:PID (cfg interface) | Bootloader VID:PID | Conn label | FW file |
|---|---|---|---|---|---|---|
| 101 (0x65) | `Magger68` | `Magger68.xml` | 19F5:**FE24**, path match `VID_19F5&PID_FE24&MI_01` | 19F5:**FF17** | "USB" | `firmware-101.bin` |
| 102 (0x66) | `Magger68 Pro` | `Magger68Pro.xml` | 19F5:**FE25**, `VID_19F5&PID_FE25&MI_01` | 19F5:**FF39** | "USB" | `firmware-102.bin` |

- **There are only these two entries.** The exe contains no "Ultra", "JIS", "Magger60" or "Per" strings in any encoding, so the Ultra/JIS layout XMLs in 1.0.2.9 are shipped but nothing references them yet [confirmed absence].
  A "KB75" string is present but unused [guess: leftover]. The UI also has strings "RF 2.4G", "RF ADV" and "BT3" (Fn keycodes and labels), but the table has no wireless entries.
- Device acceptance check: `HidP_GetCaps`, then InputReportByteLength == 0x41 **and** OutputReportByteLength == 0x41.
  So reports are 64 bytes with no report ID, and a 0x00 prefix is used on Windows (0x433dc4).
- Firmware updater (both exes, 0x407800 and 0x40a6b5): it opens the runtime device by PID with **usage_page 0x0001, usage 0x0000** (hidapi enumeration fields) and sends the enter-bootloader packet `00 5F 06 00 00 01 00 00 00 51 ...` [inferred meaning].
  It then opens the bootloader by PID **FF17 or FF39**, usage_page **0xFF00**, usage **0x01**. Its first bootloader packet is `81 07 F5 19 <PID lo> <PID hi> 00` (0x40abc4).
  The main driver also handles WCH ISP devices (VID 0x4348 or PID 0x55E0) through CH375DLL.
- **Per-model feature flag** (0x433446): a flag (`dev+0x834`) is set to 0 when **(FE24 and fw < 0x103) or (FE25 and fw < 0x101)**, and to 1 otherwise.
  When the flag is 1, the driver uses the newer 1 KB block format: read cmd **0xAA** instead of **0x04**, and writes cmd **0xA1** with `type |= 0xA0` per 8-byte entry.
  This version gate is the only per-model difference in the protocol I found.
- Update endpoints: `https://luminkey-1316538621.cos.ap-guangzhou.myqcloud.com/software-upgrade/` and `https://www.luminkey.vip/firmware-upgrade/`, using `/version` and `firmware-%s.zip`.

## 4. Layouts (copied to `research/desktop/layout_*.xml`) [confirmed]
- The Keyboard grid is 16 columns by 6 rows (5 used). Each `<key>` has `code` (HID usage; `0xFF`/`0x1FF`/`0x3FF` = FN1/FN-layer keys), `key_index` (firmware matrix index, 16..120),
  `light_index` (equal to key_index except `-_`: key 27, light 37 in **every** layout, possibly a bug), `row_col` and pixel rect.
- **Magger68 vs Magger68 Pro**: the key indices and codes are identical. The only difference is the visual column of the bottom-right mods.
  Magger68 has RAlt at 4#8, FN1 at 4#9 and RCtrl at 4#10. Pro has them one column right: RAlt 4#9, FN1 4#10, RCtrl 4#11.
  The two models share the same matrix (68 keys).
- Magger68 key_index map, for reference: Esc16 1-0=17..26 -27 =28 Bksp92 `~106; Tab32 Q..]=33..44 \\60 Del105; Caps48 A..'=49..59 Enter76 PgUp108;
  LShift64 Z..?=65..74 RShift75 Up101 PgDn120; LCtrl80 Win81 LAlt82 Space83 RAlt84 FN1 85 RCtrl87 Left88 Down89 Right91.
- **Ultra US/UK and JIS Ultra** (1.0.2.9 only, unused): these have a different bottom row (split space or extra keys, FN1 code 0x1FF) and re-indexed keys (PgDn 75, Ctrl 85).
  UK adds NUHS (0x32, idx 60) and NUBS `0x64` (idx 110). JIS adds ￥ 0x89, Ro 0x87, 無変換 0x8b, 変換 0x8a and かな 0x88, plus FN3 (0x3FF).
  Some index collisions look unfinished (for example Alt and FN1 both at 82 in the Ultra files), so treat these as drafts.
- `default_light_presets.xml` (from `profile\default_light.xml`) holds 6 per-key RGB presets keyed by HID code: Rainbow, Miami, Cyberpunk, Battlefield, Valentine and Halloween.

## 5. HID transport [confirmed]
- Writes are 65 bytes: `[0x00 reportID][0x55][cmd][b3][chk][len][offLo][offHi][data 56 bytes]`.
  `chk` is the 8-bit sum of bytes 5..64 (that is len, offset and data). It is computed in 0x464730 and 0x464940.
- The device replies with the same frame minus the report ID, so `resp[0]` is **0xAA**. Data in a reply starts at resp[7].
  Senders retry up to 20 times with a 30–100 ms timeout and wait 2 ms between writes.
- A session always looks like `55 01` (begin), then one or more ops, then `55 02` (end/commit). Most data commands move 56 (0x38) bytes per packet and use a 16-bit byte offset.
- Unsolicited input (polled with a 10 ms timeout, 0x4351f6):
  - `A0 ..` is a live key-travel report, only used on the key-test/calibration tab. pos = raw*40/(range-5), capped at 40 (0.1 mm units).
  - `A1 <fn> <dev> .. .. .. .. .. <light_mode>` is a status report: active Fn layer, device id and light mode (the log string is `buffer[0] == 0xA1 fn:%d dev:%d light_mode:%d`).

### Command table (call sites decoded with the asm helper; per-profile stride shown as `p<<n`)
| cmd | dir | size / chunking | offset | meaning |
|---|---|---|---|---|
| 0x01 | – | none | – | begin session [confirmed usage] |
| 0x02 | – | none | – | end / commit [confirmed usage] |
| 0x03 | R | resp len in resp[3..4] | – | firmware version/date string (`%s.%s(%04d-%02d-%02d)`) [inferred] |
| 0x04 | R | 0x10 bytes, or chunked | – | device/profile info (old fw); also the legacy 1 KB read [inferred] |
| 0x05 | R | 0x20 or 0x38 | **p*64** | per-profile **config block** (layout below) [confirmed] |
| 0x06 | W | 0x20 | p*64 | write config block [confirmed] |
| 0x07 | R | 10 chunks = 512 B (9x56+8) | chunk*56 | key data (keymap) [inferred] |
| 0x09 | W | 512 B | **(p<<9)**+chunk*56 | write keymap per profile [inferred] |
| 0x08 | R | chunked | – | read (used by the profile loader 0x42ac60) [unknown] |
| 0x0A | R | 7 chunks = 384 B (6x56+48) | – | per-key perf data (actuation / RT / deadzone?) [guess] |
| 0x0B | W | 384 B | (p<<9)+chunk*56 | write per-key perf data [guess] |
| 0x0D | W | 56-B chunks | – | macros (the code checks HID modifiers 0xE0–0xE7 and event types 2..5) [inferred] |
| 0xA0 | R | chunked | – | read (0x42b180, 0x435d90) [unknown] |
| 0xA1 | W | 19 chunks = 1024 B (18x56+16) | (p<<10)+chunk*56 | 128 entries of 8 B: `[type|0xA0 if newfw][id][a-1 u16][b-1 u16 + flags][c-1 u16 + flags]`. Probably advanced keys or macro bindings [guess] |
| 0xAA | R | 1024 B | chunk*56 | read the 0xA1 block (new fw only) [confirmed pairing] |
| 0xA3 / 0xA5 / 0xA7 | W | A7: 14x56 = 784 B | – | written before the keymap (0x42eaf0 / 0x42f910): advanced keys (DKS/MT/TGL/SOCD)? [guess] |
| 0xA8 / 0xA9 | – | none | – | 0xA8 when `dev+0x54294` != 0, else 0xA9. A mode toggle, probably start/stop calibration or excessive mode [guess] |
| 0xDD | W | 384 B | chunk*56 (global) | global 384-B table [unknown] |
| 0xDE | R | chunked | – | read (0x42d400) [unknown] |
| 0xEE | – | none | – | **factory reset**: the driver waits 2x3 s and then re-reads everything [inferred, strong] |

### Config block (cmd 0x05/0x06, data[] = bytes after the 8-byte header) [confirmed from 0x42dd60 and 0x42d120]
- `data[5]`: low nibble is `reporte_rate` (UI: 0=8000, 1=4000, 2=2000, 3=1000 Hz [inferred order]); high nibble is `tick_rate` (none/30/60).
- `data[6]` = `dead_zone`
- `data[7]`: bit0 disable_win, bit1 disable_alttab, bit2 disable_altf4
- `data[8]`: bit0 `perf_tachyon_mode`, bit1 `perf_bottomrapidtrigger_mode`, bit2 `actuation_check`, bit3 (set from a UI state, and set to 0x0C when `dev+0x54294`), bits5-7 `debounce_level`
- `data[9]` = light mode, `data[10]` brightness, `data[11]` = 4 − speed, `data[12]` direction, `data[13]` colorful, `data[14]` colorindex, `data[15..17]` colour (24-bit, `d17<<16|d16<<8|d15`).
  These map to the `t_light_data` columns [inferred].

## 6. Features and UI enums (full English strings in `research/desktop/lang_1033_en.txt`) [confirmed strings]
- Tabs: Remap, Performance, Advanced, Macro, Light, Config.
- Layers: Main plus **FN Layer 1–8**. Layout presets: Win, Mac, Dvorak, Colemak, Workman.
- Advanced keys: **DKS** (4 actions on one key), **MT** (mod-tap), **TGL**, **SOCD** / RS (snap-tap). Maximum 40 advanced keys per profile.
- Performance: actuation point, **RT**, separate press/release sensitivity, continuous RT, **bottom RT**, top and bottom dead zone, **Tachyon mode**, **Excessive mode** (allows values below 0.1 mm),
  recalibration, polling 8k/4k/2k/1k, tick rate none/30/60, debounce high/medium/low.
  Performance presets: Default, Valorant, CSGO, FPS, FPS-Balanced, MOBA, MOBA-balanced. Some UI defaults are 0.40 mm and 1.50 mm.
- Config: disable Win, Alt+Tab and Alt+F4; Light sleep (15 min); Caps indicator off; LOGO light; factory reset.
- Light modes (lan ids 600–690): Static, Breathing, Spectrum, Wave, Vertical wave, Sea wave, Ripple, Constant Ripple, Flowing light, Starlight, Wave Band, Rainbow, Reverse Rainbow,
  Spectrum Cycle, Ambilight, Custom Light, plus Music. Directions: up, down, left, right, clockwise, anticlockwise, inward, outward.
  **The numeric mode id behind each name is not mapped yet.**
- Fn special keycodes (UI names): RGB Mode±, Bright±, Speed±, Color±, Light Left/Right, RGB Test, WASD Change, Win/Mac, WinLock, RF 2.4G, RF ADV, BT, FN10–FN15, Recalibration, Boot, Reset, and mouse buttons 1–5 and wheel.

## 7. Firmware updaters [confirmed]
- V1.15 "Per" and V118 (in the DKS folder) target FE24 → FF17 (Magger68). V1.12 targets FE25 → FF39 (Magger68 Pro).
- The Per and Pro exes are the same size (3,944,448 B) and differ in about 86 regions: the PIDs plus the embedded image in `.rsrc`.

## Open items
- Numeric light-mode ids, keycode encoding inside the 0x07/0x09 keymap, and the exact layout of the 0x0A/0x0B, 0xA1/0xAA, 0xA3/A5/A7 and 0xDD blocks.
  These need deeper decompilation (Ghidra), or cross-checking against the web driver.
