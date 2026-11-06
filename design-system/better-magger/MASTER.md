# Better Magger — keyboard workbench

## Intent

A useful control surface for a physical keyboard. The board is the primary object; every screen should help
someone understand what they are changing, which keys/profile they are changing, and when it applies.
Audience: Magger owners configuring typing, gaming, actuation, shortcuts and lighting on desktop browsers.
The small-screen demo remains fully navigable, although real WebHID access requires a supported desktop browser.
Stack: Preact + Signals, TypeScript, native browser controls, hand-authored CSS. No framework migration.

## Skill and decisions

Applied [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md)
from the linked repository. Ran its `--design-system` searches for hardware keyboard configuration and industrial
control utilities, plus style, typography, drag alternatives, focus visibility and effect cleanup searches.
The generated Hero/Features/CTA, blue palette and generic typography were poor fits for this utility and the
user's request; they were not adopted. The narrower Swiss Modernism result supplied useful grid, asymmetry,
single accent and hierarchy guidance. This workbench aesthetic and the precise palette below are tailored
design decisions, not a claim that the database supplied a keyboard-specific theme.

## Visual language

- Warm paper background with graphite text and deck. Rust orange is reserved for primary actions and selected
  states. Dark mode is a matching charcoal/lichen system with a lighter copper accent, not a colour inversion.
- IBM Plex Sans: 400 body, 500 headings/controls, 600 occasional emphasis. IBM Plex Mono: measurements,
  identifiers and short section labels. Latin font files are hosted with the app; no font CDN requests.
- Corners: 3–4px for controls and panels, 5px keyboard case. A physical key has a small bottom edge. No glass,
  neon glow, gradient headlines, floating marketing tiles, decorative scroll animation or stock imagery.
- Spacing: 4/8/12/16/24/32/48px rhythm. Use dividers and alignment before adding another surface.
- A custom M mark and one 24px SVG stroke icon family. Icons beside text are decorative. Standalone controls
  have accessible labels. Do not use emojis for structural navigation.

## Tokens

Source of truth: `src/styles/tokens.css`. Light: paper #F2F1E9, elevated #FCFBF6, graphite #272C25,
secondary text #5D6458, orange #B33F1D with white text. Dark: #181C18 background, #222722 elevated,
#EDF0E6 text, #B2BBA9 secondary text, copper #F8A17D with #231C17 text. Theme states must be measured
independently, including the composed colours on real keys and native controls.

## Layouts

- Connection: asymmetrical introduction, exact K68 geometry, one primary connection action, separate virtual
  keyboard entry and practical three-step help. Illustration is explicitly a preview, not a connected device.
- Workspace: persistent device/profile context, compact save/demo status, six named navigation destinations.
  On smaller screens navigation reflows to two rows, rather than hiding destinations offscreen.
- Keymap: keyboard + action inspector. Performance: keyboard + numeric actuation instrument and tuning controls.
  At narrower widths these stack. Keep profile/layer context beside the board.
- Lighting: named pattern radio library + current-effect controls, static illustrative diagrams, no pretend
  live hardware rendering. Settings: tuning, backup, calibration, reset in that order, separated by numbered rows.
- Macros: slot bank and sequence editor, explicit Save action, draft markers and shared memory usage.
- Advanced: a ruled action library and dedicated binding editors. Do not present technical features as pricing cards.

## Interaction and accessibility

- Native buttons, inputs, radios and dialogs where possible. Clear names and visible field labels. Controls that
  depend on a selection explain how to start; destructive writes retain confirmation.
- Keyboard diagram uses one Tab stop, spatial arrow navigation, Enter/Space selection, Shift+arrows multiselect,
  Home/End and Control/Command+A. All/None/Row/Invert remain single-pointer alternatives to dragging.
- The keyboard can scroll within its case at small widths; the document must not overflow. Touch gestures do not
  start box selection. Never shrink the physical keys below the minimum usable target size to fit a phone.
- Radio groups and picker tabs use roving focus and arrows/Home/End. Associated tabpanels and slider descriptions
  are required. Modal close returns focus to its trigger. Sticky-header height is measured for focus clearance.
- Selected keys have an outline AND underline. Settings use text and numbers, not colour alone. Static calibration
  keys carry progress descriptions. Reduced motion disables nonessential motion; no endlessly moving lighting previews.

## Verification

Run `npm run check`. Browser tests cover the existing editing/backup flows, both-theme axe scans across every
page plus selected editors/dialogs, keyboard behavior, accessible descriptions and narrow-screen key sizes.
Automated scans supplement manual checks; they do not establish complete WCAG conformance or physical keyboard
compatibility. Verify screenshots at desktop/tablet/phone widths, both themes, 200% text zoom and reduced motion.
