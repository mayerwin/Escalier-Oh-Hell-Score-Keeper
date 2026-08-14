/**
 * Sharing, exporting and importing.
 *
 * A shared link carries the entire game in its fragment, so the person keeping
 * score can send the final table to the table without anybody needing an
 * account — or a network, beyond delivering the message itself.
 */

import { copyText, downloadText, el } from './../dom.js';
import { formatNumber, t } from './../i18n.js';
import { openSheet, sheetAction, sheetHeader, toast } from './../sheet.js';
import { exportFilename, gameToCsv, gameToJson } from './../export.js';
import { LONG_URL, buildShareUrl, decodePayload } from './../share.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { hint, panel } from './../ui.js';

function baseUrl() {
  return window.location.href.split('#')[0];
}

export async function openShareSheet(game) {
  let url;
  try {
    url = await buildShareUrl(game, baseUrl());
  } catch {
    toast(t('share.failed'));
    return;
  }

  openSheet(({ close }) => {
    const body = el('div', null, sheetHeader(t('share.title'), t('share.hint')));

    body.appendChild(
      panel(
        el(
          'div',
          { class: 'panel__pad' },
          el('p', {
            class: 'wrapword mono urlbox',
            text: url,
          })
        )
      )
    );

    body.appendChild(hint(t('share.length', { n: formatNumber(url.length) })));
    if (url.length > LONG_URL) body.appendChild(hint(t('share.long')));

    const actions = el('div', { class: 'sheet__actions' });

    if (typeof navigator.share === 'function') {
      actions.appendChild(
        sheetAction({
          label: t('share.native'),
          iconName: 'share',
          onClick: async () => {
            try {
              await navigator.share({ title: game.name || "L'Escalier", url });
              close();
            } catch {
              /* the user dismissed the share sheet */
            }
          },
        })
      );
    }

    actions.appendChild(
      sheetAction({
        label: t('share.copy'),
        iconName: 'copy',
        onClick: async () => {
          const ok = await copyText(url);
          toast(ok ? t('share.copied') : t('share.failed'));
          if (ok) close();
        },
      })
    );

    body.appendChild(actions);
    return body;
  });
}

export function openExportSheet(game) {
  openSheet(({ close }) =>
    el(
      'div',
      null,
      sheetHeader(t('export.title'), t('export.hint')),
      el(
        'div',
        { class: 'sheet__actions' },
        sheetAction({
          label: t('export.csv'),
          iconName: 'download',
          onClick: () => {
            downloadText(exportFilename(game, 'csv'), gameToCsv(game), 'text/csv;charset=utf-8');
            toast(t('export.done'));
            close();
          },
        }),
        sheetAction({
          label: t('export.json'),
          iconName: 'file',
          onClick: () => {
            downloadText(exportFilename(game, 'json'), gameToJson(game), 'application/json;charset=utf-8');
            toast(t('export.done'));
            close();
          },
        }),
        sheetAction({
          label: t('export.copyCsv'),
          iconName: 'copy',
          onClick: async () => {
            const ok = await copyText(gameToCsv(game));
            toast(ok ? t('common.copied') : t('share.failed'));
            if (ok) close();
          },
        })
      )
    )
  );
}

/**
 * Show a decoded shared game and let the user keep or discard it. The imported
 * game always gets a fresh id, so opening the same link twice never silently
 * overwrites a local game that has moved on since.
 */
export function openImportSheet(game) {
  const progress = M.progress(game);
  openSheet(({ close }) =>
    el(
      'div',
      null,
      sheetHeader(
        t('share.import.title'),
        t('share.import.body', {
          name: game.name || "L'Escalier",
          players: t('games.players', { n: game.players.length }),
          rounds: t('games.progress', { done: formatNumber(progress.done), total: formatNumber(progress.total) }),
        })
      ),
      panel(
        el(
          'div',
          { class: 'panel__pad' },
          el(
            'p',
            { class: 'hint' },
            game.players.map((p) => p.name).join(' · ')
          )
        )
      ),
      el(
        'div',
        { class: 'btnrow btnrow--spaced' },
        el('button', {
          type: 'button',
          class: 'btn btn--ghost',
          text: t('share.import.discard'),
          onClick: () => close(false),
        }),
        el('button', {
          type: 'button',
          class: 'btn btn--primary',
          text: t('share.import.add'),
          onClick: () => close(true),
        })
      )
    )
  ).then((keep) => {
    if (keep !== true) return;
    store.adoptGame(game);
    store.setView('board');
    toast(t('share.import.added'));
  });
}

/**
 * Decode a share payload from the URL fragment. Returns the game, or null when
 * there was nothing to decode; throws only on a genuinely broken payload.
 */
export async function importFromPayload(payload) {
  if (!payload) return null;
  return decodePayload(payload);
}

/** Small helper used by the menu to build the share/export actions. */
export function shareMenuActions(game, close) {
  return [
    sheetAction({
      label: t('menu.share'),
      iconName: 'share',
      onClick: () => {
        close();
        openShareSheet(game);
      },
    }),
    sheetAction({
      label: t('menu.export'),
      iconName: 'download',
      onClick: () => {
        close();
        openExportSheet(game);
      },
    }),
  ];
}
