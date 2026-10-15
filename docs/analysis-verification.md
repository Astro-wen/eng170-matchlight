# Real integration verification

Verified on 2026-10-14 Pacific time. No credentials or private photos are recorded
here. Keys are encrypted server-side runtime secrets; no client bundle contains
provider credentials.

- OpenRouter official API accepted the supplied credential and returned
  `google/gemini-3-flash-preview` responses.
- TypeSafe official API returned real `jev-1.13.0` Choice/Noul decisions.
- ESPN normalized scoreboards and event summaries were checked for all 17
  allowlisted competitions; coverage details are in espn-provider.md.
- Real ESPN NBA Finals screenshot: model extracted Dallas Mavericks, Boston
  Celtics, 88/106 and Final. JEV selected event401656363. ESPN summary returned
  BOS106/DAL88 and Tatum31points. Browser Analyze generated five tappable points;
  clicking Player to know displayed Tatum's record and the ESPN source link.
- Result correctly displayed HISTORICAL, not live. No specific play was inferred
  from a final scoreboard without period/clock evidence.
- The same positive flow completed on the deployed private Site after fixing
  Cloudflare Workers' unsupported `redirect: error` mode. All providers use
  `manual` and reject non-OK responses without following redirects.
- Real local-file upload through the file picker, Chinese UI: public diving photo
  produced visible athlete/Olympic-ring points and explicit unsupported-event
  status. It did not assign Chen Yiwen, a final dive score, or a live event.
- 390px viewport had document scrollWidth390 and five distinct tap targets.
- 69 automated tests, strict TypeScript, production build and GitHub Actions
  passed for application commit aaa0472f002b2c3c502ae6aee0288cf262753281.

Physical device camera permission/capture was not exercised during this run.
Camera entry and upload share the same analysis path after image capture.
