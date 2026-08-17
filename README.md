<div align="center">

# L'Escalier

**An offline-first score keeper for Oh Hell and its many cousins**<br>
<sub>Wizard · Skull King · Rikiki · Chorão · Stiche Raten</sub>

[![Play it](https://img.shields.io/badge/play-mayerwin.github.io-a8761f?style=for-the-badge)](https://mayerwin.github.io/Escalier-Oh-Hell-Score-Keeper/)

[![CI](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml/badge.svg)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/ci.yml)
[![Pages](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml/badge.svg)](https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper/actions/workflows/pages.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-2c6a44.svg)](LICENSE)
![Runtime dependencies: none](https://img.shields.io/badge/runtime%20deps-none-2467a8.svg)
![Languages: 6](https://img.shields.io/badge/languages-EN%20FR%20DE%20ES%20IT%20PT-8e44ad.svg)

</div>

---

Built for the table rather than for the browser: one hand, poor light, and somebody already dealing
the next round.

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
a one-off bonus or penalty, remove a player, drag the table into a new order, rename anyone, or
correct any round already played. Changes that silently rewrite recorded results sit behind an
editing lock; changes that are just part of playing do not.

**A table that remembers itself.** The people you play with are kept in settings, in the order they
sit. Tick the regulars and they are already seated when you start a new game; the rest are offered
as autocomplete the moment you start typing a name. Names are learned from the games you play, so
the list fills itself. A new game also arrives already named — *Soirée du vendredi 14 août* — and
with the staircase reaching as high as one deck can deal to however many are playing.

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

**Always the current build.** The precache is content-addressed: `tools/build-sw.mjs` hashes every
file and writes the manifest into `sw.js`, so a cache entry's key changes whenever its bytes do, and
a stale body can never be served. Because the hashes live in the worker, any content change also
changes the worker, which is what makes the browser fetch a new one. Precache requests bypass the
HTTP cache, so a short `max-age` cannot backfill a new release with the previous one's files. Nobody
ever needs to hard refresh, and an update costs one request per changed file rather than a full
re-download.

## Privacy

There is no backend. No analytics, no cookies, no network requests to anywhere. Your games stay in
your browser until you choose to share one, and a shared link travels in the URL *fragment*, which
browsers never send to a server.

## Running it locally

No build step. The app ships zero runtime dependencies — any static file server will do:

```sh
npm run serve          # or: python -m http.server 8000
```

Then open the printed URL. A service worker needs `localhost` or HTTPS, so opening `index.html`
straight off the filesystem will work but will not exercise offline caching.

To reproduce production conditions — the app under a project sub-path, with the `max-age` GitHub
Pages actually sends:

```sh
node tools/serve.mjs 8347 --base=/Escalier-Oh-Hell-Score-Keeper/ --max-age=600
```

If you add, rename or delete a file, refresh the precache manifest:

```sh
npm run build:sw       # npm test fails if it is stale
```

## Tests

```sh
npm install            # dev tooling only; the app itself needs nothing
npm test               # unit tests, node --test, no framework
npm run test:e2e       # browser tests, Playwright
npm run test:all       # both
```

**Unit tests** cover the parts where a bug would quietly corrupt somebody's score: the scoring
engine, dealer rotation, staircase edits, the share codec's round-trip, CSV escaping, translation
completeness, and a build-integrity suite that fails if a new module is not added to the service
worker's precache list — the mistake that would work perfectly online and break only offline.

**Browser tests** drive the real static server, so the service worker, relative paths and offline
behaviour are exercised exactly as GitHub Pages serves them. They cover the two-phase round flow,
the dealer's forbidden bid, staircase edits mid-game, the back-navigation model, a share link
round-tripping into a clean browser profile, CSV download, and a reload with the network cut.

`e2e/deployment.spec.js` runs its own server under a project sub-path with a real `max-age`, which
is the only way to reach the two failure modes production has and a root-served, no-cache test never
will: relative-path and scope errors, and a precache backfilled from the HTTP cache with the
previous release's files.

Both suites gate the deploy.

Playwright is the only dependency in the repo, and it is `devDependencies` — nothing ships to the
browser but the files in `src/`, `styles/` and `assets/`.

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
| `tests/` | Unit tests (`node --test`). |
| `e2e/` | Browser tests (Playwright). |
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

Released under the [MIT Licence](LICENSE). The bundled typefaces keep their own
[SIL Open Font License](assets/fonts/), which is included alongside them.

---

<div align="center">
<sub>

**© 2026 Erwin Mayer** · [github.com/mayerwin](https://github.com/mayerwin)

Made for a card table.

</sub>
</div>
