# Sports interface references

Public pages inspected on 14 October 2026. These references inform Matchlight's
visual direction and interactions; Matchlight keeps its own content, wordmark,
type choices, and component implementation.

## LA28

Reference: [LA28 homepage](https://la28.org/).

The inspected page combines a black-and-white navigation framework, large bold
uppercase headings, photographic sections, and vivid accent colors. Colors
observed in the public homepage's rendered styles include:

| Color | Observed use | Matchlight direction |
| --- | --- | --- |
| `#ff018f` | Bright pink announcement area | Event accents and prominent highlights |
| `#009ed6` | Cyan links and accents | Secondary highlights and sports graphics |
| `#ff470f` | Orange news accent | Small emphasis elements |
| Black and white | Main navigation and text framework | High-contrast masthead, headings, and score cards |

These are observations of that page, rather than a claim to reproduce an official
brand specification. Matchlight does not include LA28's official logo or its
proprietary font files. Its Los Angeles 2028 theme is a spectator prototype, and
does not imply official affiliation or current Games coverage.

## ESPN

Reference: [ESPN homepage](https://www.espn.com/).

The inspected desktop page places a compact score strip above a dark sports
navigation bar. Each score item groups event status, competitor identities, and
scores into a short, clickable summary. The league selector changes the set of
events in the strip; previous/next controls let viewers browse it horizontally.
Games link to their detailed coverage. White content cards and strong headings
keep a dense sports page easy to scan.

Matchlight adapts those interaction patterns to its own supported sports and
saved fixtures: sport filtering, clickable match summaries, compact standings,
and navigation into an explanation of a selected moment. It does not import
ESPN articles, imagery, logos, or current score data.

## Athlete photographs and competition data

The real athlete images are official World Aquatics profile portraits for all
12 finalists in the Paris 2024 women's individual 3m springboard final. They are
not photographs taken during that final. See
[athlete-media.md](./athlete-media.md) for each identity, country, local asset,
official profile link, original image URL, and image credit.

Ranks, countries, and scores come from the saved
[World Aquatics official result endpoint](https://api.worldaquatics.com/fina/events/ef62ff76-092c-4d34-882d-e247cd6a0310).
The final's provider timestamp is 9 August 2024 at 13:00:23 UTC. The top three
recorded totals are CHEN Yiwen (China, 376.00), KEENEY Maddison (Australia,
343.10), and CHANG Yani (China, 318.75). Score-strip previews use the same saved
standings as the detailed results, rather than maintaining a separate set of
scores.

The interface must label this event as historical and the fictional fixtures as
demo data. No live feed is connected. Fictional participants keep neutral
avatars; the AI-generated venue images remain illustrations and do not stand
in for event photography. Country labels use the fixture's country code, with
English and Chinese names. Unknown or fictional country codes do not receive a
borrowed flag.
