/**
 * Raw score export.
 *
 * Two shapes are produced from the same game:
 *   - CSV, one row per round per player, for spreadsheets;
 *   - JSON, the full structured game, for anything else.
 *
 * Column headers follow the interface language so the file reads the same way
 * the app does; the underlying values stay language-neutral (plain integers and
 * a fixed set of status tokens).
 */

import { PHASE, bidOrder, entryOf, entryPoints, leadOf, playerById, scoresAfter, totals } from './model.js';
import { t } from './i18n.js';

/**
 * RFC 4180 quoting. Also guards against CSV injection: a field starting with
 * =, +, - or @ is interpreted as a formula by Excel and Sheets, so it gets a
 * leading apostrophe. Player names are user input and end up in these cells.
 */
export function csvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // A negative score is an ordinary number and must stay one: prefixing "-8"
  // with an apostrophe would import it as text and break every sum in the
  // sheet. The pattern is deliberately stricter than Number(), which tolerates
  // surrounding whitespace — Number("5\r\n") is 5, and letting that through
  // unquoted would split the row in two and corrupt the whole file.
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;

  // Spreadsheets strip leading whitespace before deciding whether a cell is a
  // formula, so " =cmd|..." is just as dangerous as "=cmd|...".
  if (/^[\s ]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

function statusToken(round) {
  switch (round.phase) {
    case PHASE.DONE:
      return 'played';
    case PHASE.SKIPPED:
      return 'skipped';
    case PHASE.BIDDING:
    case PHASE.TRICKS:
      return 'in_progress';
    default:
      return 'pending';
  }
}

/**
 * Long-form table: one row per (round, player), plus the running total after
 * that round. This is the shape people actually pivot on.
 */
export function gameToRows(game) {
  const header = [
    t('export.header.round'),
    t('export.header.cards'),
    t('export.header.status'),
    t('export.header.dealer'),
    t('export.header.lead'),
    t('common.player'),
    t('export.header.bid'),
    t('export.header.tricks'),
    t('export.header.adjust'),
    t('export.header.points'),
    t('export.header.running'),
  ];

  const rows = [header];
  game.rounds.forEach((round, index) => {
    const running = scoresAfter(game, index + 1);
    const dealer = playerById(game, round.dealerId);
    const lead = playerById(game, leadOf(game, round));
    for (const playerId of bidOrder(game, round)) {
      const player = playerById(game, playerId);
      const entry = entryOf(round, playerId);
      const out = entry && entry.out;
      rows.push([
        index + 1,
        round.cards,
        out ? 'sat_out' : statusToken(round),
        dealer ? dealer.name : '',
        lead ? lead.name : '',
        player.name,
        out || !entry || entry.bid === null ? '' : entry.bid,
        out || !entry || entry.tricks === null ? '' : entry.tricks,
        entry && entry.adj ? entry.adj : 0,
        round.phase === PHASE.DONE ? entryPoints(entry, game.cfg) : '',
        running[playerId],
      ]);
    }
  });
  return rows;
}

/** Wide summary: players as columns, final standings at the bottom. */
export function gameToSummaryRows(game) {
  const finals = totals(game);
  const rows = [[t('export.header.round'), t('export.header.cards'), ...game.players.map((p) => p.name)]];
  game.rounds.forEach((round, index) => {
    rows.push([
      index + 1,
      round.cards,
      ...game.players.map((p) => {
        const entry = entryOf(round, p.id);
        if (!entry || entry.out) return '';
        if (round.phase !== PHASE.DONE) return '';
        return `${entry.bid ?? ''}/${entry.tricks ?? ''}=${entryPoints(entry, game.cfg)}`;
      }),
    ]);
  });
  rows.push([t('common.total'), '', ...game.players.map((p) => finals[p.id])]);
  return rows;
}

export function gameToCsv(game) {
  return `${toCsv(gameToRows(game))}\r\n\r\n${toCsv(gameToSummaryRows(game))}\r\n`;
}

export function gameToJson(game) {
  const finals = totals(game);
  return JSON.stringify(
    {
      app: "L'Escalier",
      schema: game.v,
      exported: new Date().toISOString(),
      game: {
        id: game.id,
        name: game.name,
        created: new Date(game.created).toISOString(),
        updated: new Date(game.updated).toISOString(),
        finished: game.finished,
        scoring: game.cfg,
      },
      players: game.players.map((p) => ({
        name: p.name,
        seat: game.players.indexOf(p) + 1,
        carryIn: p.carryIn,
        total: finals[p.id],
      })),
      rounds: game.rounds.map((round, index) => ({
        number: index + 1,
        cards: round.cards,
        status: statusToken(round),
        dealer: (playerById(game, round.dealerId) || {}).name || null,
        opens: (playerById(game, leadOf(game, round)) || {}).name || null,
        results: game.players.map((p) => {
          const entry = entryOf(round, p.id) || {};
          return {
            player: p.name,
            satOut: !!entry.out,
            bid: entry.out ? null : entry.bid,
            tricks: entry.out ? null : entry.tricks,
            adjustment: entry.adj || 0,
            points: round.phase === PHASE.DONE ? entryPoints(entry, game.cfg) : null,
          };
        }),
      })),
    },
    null,
    2
  );
}

const COMBINING_LO = 0x300;
const COMBINING_HI = 0x36f;

/**
 * Fold accents down to ASCII so "Soirée" becomes "soiree" rather than
 * "soir-e". NFD splits an accented letter into base + combining mark; dropping
 * the marks by code point leaves the bare letter behind.
 */
function asciiFold(text) {
  return Array.from(text.normalize('NFD'))
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return code < COMBINING_LO || code > COMBINING_HI;
    })
    .join('');
}

/** A filesystem-safe base name derived from the game name and date. */
export function exportFilename(game, extension) {
  const stamp = new Date(game.updated || Date.now()).toISOString().slice(0, 10);
  const slug =
    asciiFold(game.name || 'escalier')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'escalier';
  return `${slug}-${stamp}.${extension}`;
}
