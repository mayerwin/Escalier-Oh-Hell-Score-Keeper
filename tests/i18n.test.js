import test from 'node:test';
import assert from 'node:assert/strict';

import { MESSAGES, LANGUAGES, SUPPORTED, DEFAULT_LANGUAGE, t, setLanguage, detectLanguage, normalizeTag } from '../src/i18n.js';

const BASE = MESSAGES[DEFAULT_LANGUAGE];
const BASE_KEYS = Object.keys(BASE).sort();

function placeholders(value) {
  return [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

test('every language in the picker has a message table, and vice versa', () => {
  assert.deepEqual(
    LANGUAGES.map((l) => l.code).sort(),
    Object.keys(MESSAGES).sort()
  );
  assert.deepEqual(SUPPORTED.slice().sort(), Object.keys(MESSAGES).sort());
});

test('English defines a non-trivial message set', () => {
  assert.ok(BASE_KEYS.length > 150, `expected a full message set, got ${BASE_KEYS.length}`);
});

for (const lang of Object.keys(MESSAGES)) {
  test(`${lang}: key set matches English exactly`, () => {
    const keys = Object.keys(MESSAGES[lang]).sort();
    const missing = BASE_KEYS.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !BASE_KEYS.includes(k));
    assert.deepEqual(missing, [], `${lang} is missing keys`);
    assert.deepEqual(extra, [], `${lang} has keys English does not`);
  });

  test(`${lang}: plural entries use categories this language actually has`, () => {
    const valid = new Set(new Intl.PluralRules(lang).resolvedOptions().pluralCategories);
    for (const key of BASE_KEYS) {
      const base = BASE[key];
      const value = MESSAGES[lang][key];
      const baseIsPlural = base !== null && typeof base === 'object';
      const valueIsPlural = value !== null && typeof value === 'object';
      assert.equal(valueIsPlural, baseIsPlural, `${lang}.${key} plural shape differs from English`);
      if (!valueIsPlural) continue;

      const cats = Object.keys(value);
      assert.ok(cats.includes('other'), `${lang}.${key} must define the "other" category`);
      for (const cat of cats) {
        assert.ok(valid.has(cat), `${lang}.${key} uses category "${cat}" which ${lang} does not have`);
      }
    }
  });

  test(`${lang}: placeholders match English`, () => {
    for (const key of BASE_KEYS) {
      const base = BASE[key];
      const value = MESSAGES[lang][key];
      if (base !== null && typeof base === 'object') {
        // A plural form may legitimately omit a placeholder — "The single trick is
        // placed" reads better than "1 trick is placed". What it may never do is
        // invent a placeholder the caller does not pass, so require a subset of
        // the placeholders English uses across all of its forms.
        const allowed = new Set(Object.values(base).flatMap(placeholders));
        for (const [cat, form] of Object.entries(value)) {
          for (const name of placeholders(form)) {
            assert.ok(allowed.has(name), `${lang}.${key}.${cat} uses unknown placeholder {${name}}`);
          }
        }
      } else {
        assert.deepEqual(placeholders(value), placeholders(base), `${lang}.${key}`);
      }
    }
  });

  test(`${lang}: no message is left empty`, () => {
    for (const key of BASE_KEYS) {
      const value = MESSAGES[lang][key];
      const forms = value !== null && typeof value === 'object' ? Object.values(value) : [value];
      for (const form of forms) {
        assert.equal(typeof form, 'string', `${lang}.${key} should be a string`);
        assert.ok(form.trim().length > 0, `${lang}.${key} is empty`);
      }
    }
  });
}

test('t() interpolates, pluralises and falls back', () => {
  setLanguage('en');
  assert.equal(t('play.round', { n: 3 }), 'Round 3');
  assert.equal(t('play.tricks.remaining', { n: 1 }), '1 trick still to place');
  assert.equal(t('play.tricks.remaining', { n: 4 }), '4 tricks still to place');
  assert.equal(t('this.key.does.not.exist'), 'this.key.does.not.exist');
  assert.equal(t('play.round', {}), 'Round {n}', 'unknown placeholders are left alone');

  setLanguage('fr');
  assert.equal(t('play.round', { n: 3 }), 'Manche 3');
  assert.equal(t('play.tricks.remaining', { n: 0 }), 'Il reste 0 pli à placer', 'French treats 0 as singular');
  assert.equal(t('play.tricks.remaining', { n: 2 }), 'Il reste 2 plis à placer');

  setLanguage('en');
});

test('language detection prefers the first supported browser language', () => {
  assert.equal(detectLanguage({ languages: ['nl-BE', 'fr-BE', 'en'] }), 'fr');
  assert.equal(detectLanguage({ languages: ['pt-BR'] }), 'pt');
  assert.equal(detectLanguage({ languages: [], language: 'de-CH' }), 'de');
  assert.equal(detectLanguage({ languages: ['ja', 'ko'] }), 'en', 'falls back to English');
  assert.equal(detectLanguage(null), 'en');
});

test('tag normalisation is case and separator insensitive', () => {
  assert.equal(normalizeTag('IT_CH'), 'it');
  assert.equal(normalizeTag('  es-419 '), 'es');
  assert.equal(normalizeTag('zz'), null);
  assert.equal(normalizeTag(42), null);
});

test('setLanguage rejects unknown codes without throwing', () => {
  setLanguage('klingon');
  assert.equal(t('common.ok'), 'OK');
  setLanguage('en');
});
