# Data requirements and protection

This inventory describes the implemented MVP and clearly identifies optional
future data. Protection levels: **Public** means non-sensitive reference data;
**Personal** means user-linked data that needs access restrictions; **Secret**
means server-only credentials. Public does not mean unlimited redistribution
rights: sports data licensing must be assessed separately.

| Data | Purpose | Source | Protection | Current handling |
| --- | --- | --- | --- | --- |
| Match ID, sport, title, phase, venue and date | Find and identify a match | Curated demos / World Aquatics historical snapshot | Public | Packaged, read-only |
| Competitor names, countries, ranks, totals | Scoreboard and context | Demo competitors / public historical result fields | Public | No private athlete details |
| Moment ID, round, score and statistics | Locate the viewer's question | Packaged event moments | Public | Stable snapshot provenance |
| Difficulty coefficient and seven judge scores | Calculate individual diving score | Demo values / historical official results | Public | Calculated on server |
| Sport rules and source URLs | Explain terms and score calculation | World Aquatics / cricket rules references | Public | Curated reference text |
| Source event timestamp, snapshot provenance and data mode | Distinguish finished results from fictional demonstrations | Provider metadata / fixture manifest | Public | No fabricated live timestamps |
| Selected match, moment and language | Keep the current viewing context | User interaction | Personal if linked or retained | Current browser session state; no account database |
| User question | Answer a viewing question | User input | Potentially Personal | No application-level question history; optional AI provider receives it when enabled |
| Explanation prose, citations and score breakdown | Show a supported answer | Grounded engine / optional model | Public unless question contains personal data | Returned to current session |
| Provider key and explicit model settings | Optional model-written prose | Deployment owner | Secret | Environment only; never sent to browser or Git |
| Generated venue artwork | Communicate sports context | Built-in image generation | Public illustration | Stored locally, labeled as AI illustration |
| Live feed subscription and event mapping | Future real-time integration | Authorized sports provider | Subscription credentials are Secret | Future work; not represented as implemented |

There is no login, precise location collection, payment data, athlete biometric
collection, durable question history, or analytics tracking in this MVP.
