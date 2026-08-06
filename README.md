# L'Escalier — Oh Hell score keeper

A score keeper for **Oh Hell** and its many cousins (Wizard, Skull King, Rikiki, Chorão, Stiche
Raten…), built for the table rather than for the browser: one hand, poor light, and somebody
already dealing the next round.

**→ [Play it](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)**

It works completely offline, keeps every game on your own device, and can hand a finished game to
the rest of the table as a single link.

---

## Why it exists

Most score keepers assume the game is decided before it starts: a fixed ladder of rounds, a fixed
list of players, and no way back once a round is recorded. Real games are not like that. Somebody
arrives late, somebody has to leave, the table decides to add one more hand at one card, or a round
gets entered wrong three rounds ago.

So the round list here — the *escalier*, the staircase — is a first-class, editable thing for the
whole life of the game.

## What it does

**The staircase.** The round plan is drawn as an actual flight of stairs and stays editable at any
point: insert a round, resize a hand to any number of cards, duplicate one, skip one, jump the play
head forward, or rebuild the whole unplayed tail from a new shape. Rounds already played are always
preserved.

**Two explicit phases per round.** First every bid, in bidding order with the dealer last. Then, and
only then, the tricks each player actually won, with a live counter that must reach zero before the
round can be recorded. The two are never mixed on one screen.

**The deal, shown plainly.** Every round names its dealer and its opener, badged on the player cards
and listed on every step of the staircase. Tap either to change it — designating the dealer and
designating the opener are two views of the same fact, so the app offers both and keeps them
consistent.

**The dealer's burden.** The "screw the dealer" rule (bids may not total the number of tricks) is
enforced from a configurable hand size upwards. The forbidden number is struck out on the dealer's
own chips, so nobody has to do the arithmetic. It can be overridden deliberately, and switched off.

**Mid-game reality.** Add a latecomer with any starting score, sit a player out for one round, apply
a one-off bonus or penalty, remove a player, reorder the table, rename anyone, or correct any round
already played. Changes that silently rewrite recorded results sit behind an editing lock; changes
that are just part of playing do not.

**Configurable scoring.** Bonus for a made bid, points per trick, penalty per trick of deviation,
and whether tricks still count on a missed bid. Setup shows a worked example that updates as you
turn the dials.

**Six languages.** English, French, German, Spanish, Italian and Portuguese, picked from the browser
by default and overridable in settings. Numbers, dates, lists and plurals all go through `Intl`, so
each language gets its own correct plural rules.

**Two themes.** Ruled ledger paper by day, card-table baize by night, following the system by
default.

**Sharing and export.** The whole game — players, staircase, every bid and trick, the scoring rules —
is packed, deflated and base64url-encoded into the URL fragment. A finished six-player, twenty-round
game lands in roughly 400 characters, so it fits in any chat message and needs no server, no account
and no database. Scores also export as CSV (long form plus a summary block) or JSON.

**Genuinely offline.** Every module, font and icon is precached by a service worker; the typefaces
are self-hosted rather than pulled from a CDN. Once the page has loaded once, going offline changes
nothing at all. Games are stored in `localStorage`, which is synchronous — so a save completes even
if the phone is locked mid-round.

## Privacy

There is no backend. No analytics, no cookies, no network requests to anywhere. Your games stay in
your browser until you choose to share one, and a shared link travels in the URL *fragment*, which
browsers never send to a server.

## Running it locally

No build step, no dependencies. Any static file server will do:

```sh
npm run serve          # or: python -m http.server 8000
```

Then open the printed URL. A service worker needs `localhost` or HTTPS, so opening `index.html`
straight off the filesystem will work but will not exercise offline caching.

## Tests

```sh
npm test
```

Plain `node --test`, no framework. Coverage is on the parts where a bug would quietly corrupt
somebody's score: the scoring engine, dealer rotation, staircase edits, the share codec's
round-trip, CSV escaping, translation completeness, and a build-integrity suite that fails if a new
module is not added to the service worker's precache list — because that is the mistake that would
work perfectly online and break only offline.

## How it is put together

Vanilla ES modules, no framework and no bundler, because a static score pad should still run in five
years without a toolchain.

| Path | What lives there |
| --- | --- |
| `src/model.js` | The engine: scoring, dealer rotation, staircase edits, validation. Pure, DOM-free, fully tested. |
| `src/store.js` | The single mutable state object and every action that changes it. |
| `src/dom.js` | Element builder and the icon set. No `innerHTML` anywhere in the app. |
| `src/views/` | One module per screen, each returning a DOM node. |
| `src/i18n.js`, `src/locales/` | Messages and `Intl`-backed plurals for the six languages. |
| `src/share.js` | The compact wire format, deflate, base64url. |
| `tools/gen-icons.mjs` | Generates the PNG icons from source with no image library. |

Two conventions worth knowing:

- **Round results are keyed by player id, never by seat index.** Reordering, adding or removing a
  player therefore cannot shift somebody else's score onto the wrong row.
- **Recorded rounds anchor the deal.** Re-deriving dealers after an edit never rewrites a round that
  has already been played.

## Credits

Feature parity was informed by [bdhoine/oh-hell-score](https://github.com/bdhoine/oh-hell-score).

Typefaces: [Fraunces](https://fonts.google.com/specimen/Fraunces) and
[Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans), both under the SIL Open Font
License and bundled in `assets/fonts/`.

## Licence

[MIT](LICENSE).
