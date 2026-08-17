/**
 * The roster: the people who actually play, remembered between games.
 *
 * Two jobs, and they are deliberately the same list. The entries marked
 * `always` are the regulars — they are seated automatically, in this order,
 * when a new game is set up. The rest are people who have played before, and
 * they exist so that typing two letters into a seat is enough.
 *
 * Pure and DOM-free, like `model.js`: everything here is exercised by unit
 * tests, and nothing here knows that a screen exists.
 */

export const MAX_ROSTER = 40;
export const MAX_NAME = 24;

/** Collapse a name to what two spellings of the same person share. */
export function key(name) {
  return String(name)
    .trim()
    .toLocaleLowerCase()
    // Strip accents, so "Cléo" finds "Cleo" and the roster does not end up
    // holding both.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function cleanName(name) {
  return String(name == null ? '' : name)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

/**
 * Coerce anything that came out of storage into a valid roster.
 *
 * Settings are as untrusted as any other stored blob: a hand-edited or
 * half-written value must not be able to put the setup screen into a state it
 * cannot render.
 */
export function sanitize(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const name = cleanName(entry.name);
    if (!name) continue;
    const k = key(name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, always: entry.always === true });
    if (out.length >= MAX_ROSTER) break;
  }
  return out;
}

/** The regulars, in roster order — the seating a new game starts from. */
export function regulars(roster) {
  return sanitize(roster).filter((entry) => entry.always);
}

/**
 * Add a name, or return the roster unchanged if it is already known.
 *
 * `always` only applies to a genuinely new entry: learning a name from a game
 * that has just started must never promote someone to a regular behind the
 * user's back.
 */
export function add(roster, name, always = false) {
  const list = sanitize(roster);
  const clean = cleanName(name);
  if (!clean || list.length >= MAX_ROSTER) return list;
  if (list.some((entry) => key(entry.name) === key(clean))) return list;
  return [...list, { name: clean, always }];
}

/** Remember everyone who played, so the next game can autofill them. */
export function learn(roster, names) {
  let list = sanitize(roster);
  for (const name of names) list = add(list, name);
  return list;
}

/**
 * Rename an entry, or refuse.
 *
 * Two renames are refused rather than applied: to nothing, and to a name
 * somebody else in the list already has. Both would leave a row that cannot be
 * told apart from another, and emptying a name is what the delete button is
 * for. The caller is told, so the refusal is not silent.
 */
export function rename(roster, index, name) {
  const list = sanitize(roster);
  const clean = cleanName(name);
  if (index < 0 || index >= list.length) return { list, ok: false };
  if (!clean) return { list, ok: false };
  if (list.some((entry, i) => i !== index && key(entry.name) === key(clean))) return { list, ok: false };
  return { list: list.map((entry, i) => (i === index ? { ...entry, name: clean } : entry)), ok: true };
}

export function setAlways(roster, index, always) {
  const list = sanitize(roster);
  if (index < 0 || index >= list.length) return list;
  return list.map((entry, i) => (i === index ? { ...entry, always: always === true } : entry));
}

export function remove(roster, index) {
  const list = sanitize(roster);
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

export function move(roster, from, to) {
  const list = sanitize(roster);
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Names to offer for a partly typed seat.
 *
 * Ranked the way a person would expect: what starts with what you typed comes
 * before what merely contains it, and within each group the roster's own order
 * wins — so the regulars, which sit at the top, are offered first.
 *
 * `taken` are the names already seated. Offering someone who is visibly two
 * rows above is noise at best and a duplicate at worst.
 */
export function suggest(roster, query, taken = [], limit = 6) {
  const list = sanitize(roster);
  const used = new Set(taken.map(key).filter(Boolean));
  const q = key(query);

  const starts = [];
  const contains = [];
  for (const entry of list) {
    const k = key(entry.name);
    if (used.has(k)) continue;
    if (!q) starts.push(entry);
    else if (k.startsWith(q)) starts.push(entry);
    else if (k.includes(q)) contains.push(entry);
  }

  // An exact and unique match is not a suggestion, it is what is already
  // typed; offering it would leave a popup open over a finished field.
  const all = [...starts, ...contains];
  if (q && all.length === 1 && key(all[0].name) === q) return [];
  return all.slice(0, limit);
}
