# MVP verification

Verified locally on 14 October 2026:

- TypeScript strict check passes for the integrated project.
- 23 tests pass: seven-judge arithmetic, all 60 official historical dives and
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
