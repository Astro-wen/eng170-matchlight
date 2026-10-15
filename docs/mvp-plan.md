# Camera-first prototype scope

The primary user is a casual spectator or tourist who sees a sporting moment and
wants context without searching a sports website. The core product is:
**take a photo → explore information on that photo → tap for a short explanation**.

## Three solution states

1. **Capture:** open the device camera or choose a local photo. A real competition
   photograph and a recreated scoreboard provide a no-camera sample path.
2. **Discover:** keep the photograph visible, with tappable athlete, score and rule
   markers. Own photos require an explicit saved-match and moment selection.
3. **Understand:** open a contextual card and a grounded explanation while keeping
   the captured image as the visual anchor. Change language, ask about the moment,
   hide labels, or place a manual marker on your own photo.

## Prototype boundary

The camera interface requests video only and stops tracks on capture, reset,
sample selection and unmount. Photos remain in browser memory, with no photo
upload, persistence, pixel analysis, face recognition or automatic event matching.
Sample overlays are explicitly preset. Arbitrary photos do not inherit a match
until the user selects one. Photo placement does not measure judging faults.

The saved Paris 2024 final records support authentic names, nations and scoring
examples. The sample action photograph comes from the semi-final; it is not
represented as the selected final dive. No live coverage is connected.

## Definition of done

- The home page is capture-first; a match catalog is not the primary entry.
- Camera, file input and sample controls expose actual interactive paths.
- The photograph remains visible through markers and explanations.
- Local photo validation, manual context and error/retry states work.
- Markers follow the contained image bounds through responsive resizing.
- Explanations preserve recorded facts, rules and evidence limitations.
- English/Chinese, desktop/mobile, automated tests and production build pass.
- Publish the revised existing private prototype, preserving its audience.
