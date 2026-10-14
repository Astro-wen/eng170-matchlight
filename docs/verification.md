# MVP verification

Verified locally on 14 October 2026:

- TypeScript strict check passes for the integrated project.
- 26 tests pass: seven-judge arithmetic, all 60 official historical dives and
  running totals, cricket legal-ball notation, selected-moment consistency,
  swimming hundredths, request validation, source provenance, provider fallback
  and all frontend default questions in both languages.
- Production Worker build succeeds.
- Local HTTP health endpoint returns 200 with `aiConfigured: false`.
- Browser checks cover match discovery, sport filtering, historical diving
  explanation, custom evidence question, English/Chinese switch, follow-next
  navigation and swimming's default explanation.
- Desktop and 390 × 844 phone viewport render successfully; phone document width
  equals viewport width (390), with no horizontal overflow.
- Kumo tab control and source timestamp wording corrected after browser review.

No model credential is configured, so provider tests use mocked responses.
Historical source is a saved official results snapshot; real-time updates are
future work. AI illustrations are separate from competition result evidence.

GitHub Actions repeats type checking, the test suite and the production build
for pushes and pull requests. Its remote run status is separate from these
completed local checks.

## Sports theme update — 14 October 2026

- Type checking and 26 tests pass, including 12 unique official portrait mappings,
  localized country codes, immutable top-three score previews, and all-participant
  search metadata derived from the same standings.
- Production Worker build succeeds.
- Actual browser checks at 1280px desktop and 390 × 844 mobile: portraits load,
  document width matches viewport, and browser error logs are empty.
- Sport tabs and score-strip selector stay in sync. Athlete search and country
  filtering narrow the actual match cards; a nonexistent search shows an empty
  state and clear-filters restores the catalog. PELLACANI + Italy resolves the
  historical final, including participants outside the medalist preview.
- Opened the historical final, selected CHANG Yani's 42.00 dive, expanded all seven
  judge awards, asked a scoring question, and confirmed 14.0 × 3.0 = 42.00.
- Follow-the-match and next-recorded-moment select KEENEY Maddison's 78.20 dive;
  Chinese explanation confirms 23.0 × 3.4 = 78.20 with the matching portrait.
- Corrected mobile Chinese headline wrapping during visual QA. Historical results
  remain labeled as finished archives, with no invented live data or fault diagnosis.
