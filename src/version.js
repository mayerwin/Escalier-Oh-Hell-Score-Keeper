/**
 * Single source of truth for the app version.
 *
 * `sw.js` carries the same string in its cache name so a release always
 * invalidates the offline cache; `tests/build.test.js` keeps the two in step.
 */
export const VERSION = '2.0.2';
export const REPO_URL = 'https://github.com/mayerwin/Escalier-Oh-Hell-Score-Keeper';
