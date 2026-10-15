# Real photo analysis

POST `/api/analyze`, JSON body ≤2.61MB:

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "capturedAt": "2024-06-18T02:00:00Z",
  "timeZone": "America/Los_Angeles",
  "locale": "en",
  "hint": "Optional team or league hint"
}
```

The client downsizes the full photo (no crop) to 1600px JPEG before sending.
Only server routes load provider secrets. `AnalyzeResult` in `lib/analysis/types.ts`
is the authoritative response contract. It includes visible features, matched
or uncertain state, independent photo/provider points, source URLs and fetch
timestamps, model names and a small stage trace. Neither keys nor image bytes are
returned. Private hosting authentication is the current access boundary; sharing
or public deployment needs additional per-user quotas before exposing paid calls.

`selectedEvent: {league,eventId}` explicitly confirms a candidate. The server
re-fetches its real details and labels the association as user-confirmed.
Automatic matches require JEV choice/evidence thresholds plus two independent
visible team identifiers and a unique candidate. JEV sees features and candidates,
not photos. ESPN receives only fixed league/date/event-ID requests.

Provider scores describe the lookup snapshot. Event completion, wall-clock date,
and capture-time proximity determine whether a result can be called live. A live
clock is not inferred from the upload date. Shared clock/score records are not a
unique pictured action. Unknown projects and no provider matches remain explicit.

The insight model selects existing fact IDs only. All provider point prose and
source IDs are built from verified data in code; model text cannot invent a foul,
change a final into a live game or overwrite score arithmetic.

Runtime secrets: `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY`.
Models: `MATCHLIGHT_VISION_MODEL`, `MATCHLIGHT_ANALYSIS_MODEL`, `MATCHLIGHT_JEV_MODEL`.
Default vision/selection model: `google/gemini-3-flash-preview` (verified available
in OpenRouter's model catalog during integration); JEV defaults to `jev-latest`.
Fixed official endpoints: `https://openrouter.ai/api/v1/chat/completions` and
`https://api.typesafe.ai/v1/systemone`. No model-supplied fetch URLs are accepted.

The app holds no database copy of uploads. OpenRouter/provider policies still
apply to requests. Server handlers do not log images, prompts or credentials.
