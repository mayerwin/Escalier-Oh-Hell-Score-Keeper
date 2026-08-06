/**
 * Tiny i18n runtime.
 *
 * Messages are flat `key -> string` maps, or `key -> {one, other, ...}` for
 * plurals, which are selected with Intl.PluralRules so every supported
 * language gets its own correct category set (Portuguese and Italian differ
 * from English, and none of them match Russian-style rules — letting the
 * platform decide is both smaller and more correct than hand-rolling it).
 *
 * Placeholders use `{name}` and are substituted verbatim. Callers are
 * responsible for passing already-trusted values; the DOM layer never uses
 * innerHTML, so a translated string can never become markup.
 */

import en from './locales/en.js';
import fr from './locales/fr.js';
import de from './locales/de.js';
import es from './locales/es.js';
import it from './locales/it.js';
import pt from './locales/pt.js';

export const MESSAGES = { en, fr, de, es, it, pt };

/** Display names are written in their own language, as is conventional. */
export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
]);

export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED = LANGUAGES.map((l) => l.code);

let current = DEFAULT_LANGUAGE;
let pluralRules = new Intl.PluralRules(DEFAULT_LANGUAGE);
const listeners = new Set();

export function isSupported(code) {
  return SUPPORTED.includes(code);
}

/** Match a BCP-47 tag such as `pt-BR` down to a supported base language. */
export function normalizeTag(tag) {
  if (typeof tag !== 'string') return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isSupported(base) ? base : null;
}

/** Best supported language for this browser, falling back to English. */
export function detectLanguage(navigatorLike = typeof navigator !== 'undefined' ? navigator : null) {
  const tags = [];
  if (navigatorLike) {
    if (Array.isArray(navigatorLike.languages)) tags.push(...navigatorLike.languages);
    if (navigatorLike.language) tags.push(navigatorLike.language);
  }
  for (const tag of tags) {
    const code = normalizeTag(tag);
    if (code) return code;
  }
  return DEFAULT_LANGUAGE;
}

export function getLanguage() {
  return current;
}

export function setLanguage(code) {
  const next = isSupported(code) ? code : DEFAULT_LANGUAGE;
  if (next === current) return current;
  current = next;
  pluralRules = new Intl.PluralRules(current);
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  listeners.forEach((fn) => fn(current));
  return current;
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

/**
 * Translate `key`. Falls back to English, then to the key itself, so a missing
 * translation degrades to readable text instead of blanking the UI.
 */
export function t(key, params) {
  let entry = MESSAGES[current] ? MESSAGES[current][key] : undefined;
  if (entry === undefined) entry = MESSAGES[DEFAULT_LANGUAGE][key];
  if (entry === undefined) return key;

  if (entry && typeof entry === 'object') {
    const n = params && Number.isFinite(params.n) ? params.n : 0;
    const category = pluralRules.select(n);
    entry = entry[category] ?? entry.other ?? entry.one ?? key;
  }
  return interpolate(String(entry), params);
}

/* --------------------------------------------------------- locale-aware formatting */

export function formatNumber(value, options) {
  return new Intl.NumberFormat(current, options).format(value);
}

/** Scores read better with an explicit sign: `+15`, `−10`, `0`. */
export function formatSigned(value) {
  const n = Math.round(value);
  if (n === 0) return formatNumber(0);
  return new Intl.NumberFormat(current, { signDisplay: 'exceptZero' }).format(n);
}

export function formatDate(ms) {
  return new Intl.DateTimeFormat(current, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));
}

export function formatDateTime(ms) {
  return new Intl.DateTimeFormat(current, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatList(items) {
  if (typeof Intl.ListFormat === 'function') {
    return new Intl.ListFormat(current, { style: 'short', type: 'unit' }).format(items);
  }
  return items.join(', ');
}
