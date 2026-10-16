# Matchlight

## Intro

Matchlight helps spectators understand the game in front of them. Take or upload a photo of a sports broadcast or venue, connect it to an event, and tap markers on the photo to see scores, context, and explanations.

[Try the prototype](https://matchlight-eng170.uclae2e12.chatgpt.site/) — ChatGPT sign-in required.

## How It Works

1. **Read the photo.** A vision model through OpenRouter identifies the sport and visible clues, such as team names, printed athlete names, and scoreboard text.
2. **Find current events.** The server queries connected ESPN and World Aquatics feeds using the current time. Replay mode searches historical records using the original event date.
3. **Compare candidates.** TypeSafe JEV evaluates eligible events against the extracted clues. Conflicting clues block a match; ambiguous results may need your confirmation.
4. **Explain the game.** Available event data and rules become tappable markers on the photo, with source links and timestamps.

## Process

1. Take a photo or upload an image. Keep the scoreboard and participant names visible when possible.
2. Use **Live now** for a current broadcast, or select **Replay / past event** and enter the original event date.
3. Run the analysis and choose a matching event if prompted.
4. Tap the photo markers, then open **Match statistics** and **Sources** for more detail.

For a quick demo, choose **Current match sample**. It creates a scorecard image from real current ESPN data; it is not a venue photograph. Historical samples automatically select Replay mode.

## Can Dos (Current Prototype)

- Extract the sport and readable clues from an uploaded photo.
- Look up in-progress events in supported ESPN competitions, including NBA and cricket, and connected World Aquatics feeds.
- Show available scores, competitors, countries, player statistics, and scoring breakdowns with their sources.
- Explain basic rules and selected recorded scores, including diving score calculations.
- Keep live and historical results separate, and distinguish an uncertain match, no current results, and an unavailable data source.
- Offer English and Chinese interfaces with mobile layouts.

## Can't Dos (Current Prototype)

- Reliably identify every match from any photo, especially when names or scoreboards are missing, blurred, or from an old broadcast. Linking the only compatible current event is a contextual association, not proof that the photo depicts it.
- Identify any athlete by face alone or reliably confirm the exact play or dive from a single image.
- Guarantee complete statistics, instant updates, or coverage of every sport and competition. Full Olympic or LA28 live coverage is not available.
- Explain a judge's specific reason for a deduction without a supporting record.
- Watch a continuous video stream or automatically follow every play. The current flow analyzes one photo at a time.
