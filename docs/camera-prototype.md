# Photo-first prototype

The core interaction is **camera or photo → information over the photo → tap to
understand**. A spectator starts with the scene in front of them, then opens an
athlete, score or rule pin without navigating a sports news dashboard first.

## What works

- A browser can accept a photo from the device or capture one with the camera,
  subject to the browser's camera permissions and secure-context support.
- The selected photo stays in the browser. The photo flow does not upload,
  persist or transmit the photo. Replacing or clearing it should release its
  object URL and stop camera tracks when the camera closes.
- Saved samples have predetermined overlay pins and predetermined match context.
  Their labels explicitly call this a preset demonstration.
- For an uploaded or captured photo, the viewer explicitly selects a saved match
  and moment before information appears. No selection means no match context.
- Tapping a pin can show the saved athlete profile, the recorded score and its
  arithmetic, or the applicable rule. Historical records remain labeled as
  historical; fictional fixtures remain labeled as demo data.

## What is simulated

Image understanding is simulated. The prototype does not identify faces, read
scoreboards, classify an event, locate people in an arbitrary photo, or match an
uploaded photo to an athlete. The `preset-demo` status means that an authored
sample selects authored context. The `manual-context` status means that the user
selected the context for their own photo. Neither status is a model confidence
score or a statement that the photo proves the selected context.

The action-photo sample opens separate saved Paris 2024 final context for an
interaction demo. The photo is not claimed to depict the selected final dive;
its pins do not claim to identify the pictured athlete. The illustrated
scoreboard sample is paired with CHEN Yiwen's last dive (`paris-1-dive-5`) from the
saved women's 3 m final (`paris-2024-diving-women-3m`). A scoreboard illustration
is not actual event photography. Attribution and photo provenance belong with
the supplied assets.

## Data contract

`lib/photo-prototype.ts` owns this client-safe deterministic mapping. It imports
the existing fixtures to validate selected match and moment IDs and never
receives image bytes. Both sample getters return copies. Each pin uses normalized
coordinates from 0 to 1 relative to the full, uncropped sample image; the UI must
keep the image and pins in the same coordinate frame.

`selectPhotoContext` returns the source, status, optional sample ID, nullable match
and moment IDs, and bilingual label and note. Unknown sources, unknown IDs,
foreign moments, sample overrides, and sample IDs on user photos are rejected.
An explicitly selected match without a moment uses that fixture's default moment
while retaining the `manual-context` label. Existing explanation requests contain
only the selected context IDs and question, not photo content.

## NBA reference direction

Official reference pages inspected on 14 October 2026:

- https://www.nba.com/news/nba-app-launches-new-features-ahead-of-2024-25
- https://www.nba.com/news/nba-courtoptix

The prototype borrows the general idea of connecting a visible sporting moment
with concise contextual data. Its camera-first entry and photo markers are our
own product interaction, not a claim that NBA Insights provides photo scanning.
No NBA code, logos, photography, proprietary UI assets or live data were imported.

## Interaction implementation

The camera uses video-only browser getUserMedia and local canvas frame capture,
with a mobile capture-file fallback where that API is absent. JPEG/PNG/WebP inputs
up to 10 MB remain local. Manual markers use the contained image's measured bounds,
so portrait/wide letterbox bars do not become annotation coordinates. ResizeObserver
updates the annotation plane when the layout changes.
