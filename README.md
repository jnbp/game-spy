# Wer ist der Spion? (Who is the spy?)

A party game for 3 to 20 people sharing one phone. Everyone knows the location except the spy. Ask each other clever questions to unmask the spy, while the spy tries to guess the location without blowing their cover.

The game itself is in German.

**Play:** [spy.bapo.me](https://spy.bapo.me)

## How a round works

1. Set the number of players, spies and the round time, then pick location packs.
2. The phone goes around. Before each player, a big "Spieler 4 – bereit?" (player 4 – ready?) screen appears, and the role only shows up after that player confirms. Press and hold the fingerprint: while you hold it, your secret file opens and shows the location and your role, or the "Spion" stamp.
3. The timer starts and the game picks who asks the first question. Tap "Auflösen" (reveal) at the end and confirm to show the location and the spies.

## What's new in version 2

- 2,500 locations in 25 packs (100 each), no duplicates
- No location repeats until every selected location has been played
- A role for every player at the location, can be turned off
- A "ready?" gate before each player so nobody taps through by accident
- Press and hold to reveal your role
- Round timer with sound and vibration, random starting player, optional player names
- Revealing the solution needs a confirmation
- "Lokale Daten zurücksetzen" (reset local data) at the bottom of the setup screen clears played locations, settings and names on this device
- New design with animations; settings are saved in the browser

## Adding locations

All locations live in `packs/`, one file per pack, one location per line:

```
🛒 Supermarkt: Kassiererin, Kunde, Filialleiter, Regalauffüller, Ladendetektiv, Kind an der Quengelkasse
```

Each line starts with one emoji, then the location name. After the colon come the roles, separated by commas. Location names must not contain a colon or a comma. Lines starting with `#` are comments.

- **Add a location:** add one line to the matching pack file. That's it.
- **Add a pack:** create `packs/mypack.js` following an existing file and add the id `'mypack'` to `packs/_list.js`.
- **Check:** `node scripts/check-packs.mjs` reports format errors and duplicate locations across all packs.

The game is plain HTML, CSS and JavaScript with no build step. Locally, any static server works, e.g. `python3 -m http.server`. It is hosted on GitHub Pages (`.nojekyll` keeps files starting with an underscore, such as `packs/_list.js`).

## Structure

| File | Contents |
|---|---|
| `index.html` | Screens: setup, ready gate, role reveal, round, "what's new" dialog, reveal confirmation |
| `css/style.css` | Design and animations |
| `js/app.js` | Game logic |
| `js/parse.js` | Parses the pack line format |
| `packs/_list.js` | Which packs are loaded, in which order |
| `packs/*.js` | The location packs |
| `scripts/check-packs.mjs` | Pack validation script |
