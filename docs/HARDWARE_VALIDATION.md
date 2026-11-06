# Physical keyboard validation

Automated demo tests validate the UI → session → simulated HID device → readback flow. They do not validate
the actual firmware's report headers, byte offsets or persistence. No physical keyboard was available during
this completion pass. Run this checklist separately for each model/firmware/OS combination you use.

## Record the device

- Model reported by Better Magger, USB VID/PID, firmware version.
- Desktop browser/version, operating system, wired or receiver connection.
- Exact error message for any failed step. Do not infer success from a toast alone: read back or observe the result.

The manufacturer's [quick-start guide](https://www.luminkey.com/zh/blogs/magger68-user-manual/magger68-quick-start-guide)
distinguishes Performance/Professional (desktop and web driver) from Plus/Ultra (web driver). Desktop research
therefore does not establish Plus/Ultra protocol compatibility. This app uses the official web protocol and
USB product IDs to identify the variant automatically.

## First connection and reversible edits

1. Close the official web/desktop driver and other Better Magger tabs. Connect with a USB data cable.
2. Connect through the browser picker. Verify model, firmware, key labels and active profile against the official
   driver (open it separately after disconnecting here). A failed physical keymap/profile read must block editing.
3. Export each profile to a file before editing; verify JSON contains the expected model and tables.
4. Remap one spare key to an ordinary letter. Type in a text editor, reload/reconnect and verify the remap reads
   back correctly. Undo or restore that key. Repeat once on an FN layer and another profile.
5. Change lighting brightness, speed, direction and colour. Observe the physical keys, navigate away/back
   and reconnect to check readback. Compare the illustrative preview, allowing differences in animation timing
   and colour rendering. Paint a few Custom keys and verify their colours persist. Check Tachyon mode separately.
6. Adjust one key's actuation/RT. Verify the displayed millimetres and selected switch travel against the installed
   switches. Check real behavior and the measured Live key view. The manual switch preview must not alter any
   device setting. On a spare profile, check actuation clamping when selecting a shorter-travel switch, then
   restore the original switch type and trigger settings. Calibrate only when appropriate for the physical device.
7. Record a short macro, save and assign it to a spare key. Check the resulting text, delays and key release.
8. Try one advanced binding at a time and restore it afterward. Test both directions of pair bindings.
   Fixed-key SOCD priority is experimental; its priority nibble interpretation is not established by captures.

## Reconnection and recovery

1. Unplug/replug while viewing a page. Confirm a disconnect notice, automatic reconnection and fresh data.
2. Change polling rate once and confirm USB reconnects, the new rate reads back and normal typing still works.
3. Import a known backup into an unused profile. Read back every table; macros and advanced actions should
   still work. Settings are written last because polling changes may re-enumerate USB.
4. Verify persistence after a keyboard power cycle. There is no explicit save command in the observed web
   protocol; whether all settings persist across power loss still needs actual firmware validation.

Do not use calibration or factory reset just to establish connectivity. Validate calibration separately after
changing switches, following the manufacturer's instructions. Firmware flashing is outside this app's scope.

## Remaining protocol questions

- Payload offset: web driver uses byte 8; desktop disassembly notes contain byte-7/byte-8 discrepancies.
- Response headers: exact CMD/OFF echo behavior is not confirmed across firmware revisions. The transport
  learns echo behavior per command and keeps a legacy serial path. Same-signature duplicate replies cannot
  be distinguished without a firmware transaction ID.
- Older Performance/Pro firmware may differ from the current web protocol; no minimum firmware version has
  been proven for this implementation.

Record results and captures with the device details above before marking a hardware combination verified.
