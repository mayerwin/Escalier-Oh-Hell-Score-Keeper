/**
 * The round editor sheet.
 *
 * This is where "change anything, any time" lives. Reachable in one tap from
 * both the staircase and the round header, it can resize a hand, hand the deal
 * to somebody else, insert or drop rounds, or reopen a recorded round — with a
 * confirmation on exactly the operations that would rewrite history.
 */

import { el } from './../dom.js';
import { t } from './../i18n.js';
import { confirmSheet, openSheet, sheetAction, sheetHeader, toast } from './../sheet.js';
import * as M from './../model.js';
import * as store from './../store.js';
import { hint, playerPicker, row, stepper } from './../ui.js';

/** Open the editor for the round at `index`. */
export function openRoundSheet(index) {
  const game = store.state.game;
  if (!game || !game.rounds[index]) return;

  openSheet(({ close }) => {
    const round = game.rounds[index];
    const deckMax = M.maxCardsFor(game.players.length);
    const isDone = round.phase === M.PHASE.DONE;
    const isSkipped = round.phase === M.PHASE.SKIPPED;

    const body = el('div', null, sheetHeader(t('stairs.detail.title', { n: index + 1 })));

    /* ---- hand size ----
       Resizing a recorded round would clamp its bids and tricks, quietly
       rewriting a result and leaving the round failing its own validation.
       Reopen it first; the action to do that is right below. */
    const cardsRow = isDone
      ? row(
          t('stairs.detail.cards'),
          t('stairs.resizeLocked'),
          el('span', { class: 'row__value', text: String(round.cards) })
        )
      : row(
          t('stairs.detail.cards'),
          round.cards > deckMax ? t('stairs.deckLimit', { players: game.players.length }) : null,
          stepper({
            value: round.cards,
            min: 1,
            max: M.MAX_CARDS,
            label: t('stairs.detail.cards'),
            onChange: (value) => {
              store.setRoundCards(index, value);
              close();
              openRoundSheet(index);
            },
          })
        );
    body.appendChild(el('section', { class: 'panel' }, cardsRow));

    /* ---- who deals, who opens ----
       Two pickers over the same underlying fact: the opener always sits after
       the dealer, so choosing one places the other. Both are offered because
       tables think in both terms. */
    const reopenSheet = () => {
      close();
      openRoundSheet(index);
    };

    const dealBlock = el('div', { class: 'panel__pad' });
    dealBlock.appendChild(el('div', { class: 'picker__label', text: t('stairs.detail.dealer') }));
    dealBlock.appendChild(
      playerPicker({
        players: game.players,
        selectedId: round.dealerId,
        labelFor: (p) => t('a11y.setDealer', { name: p.name }),
        onPick: (playerId) => {
          store.setDealer(index, playerId);
          reopenSheet();
        },
      })
    );

    dealBlock.appendChild(
      el('div', { class: 'picker__label', text: t('stairs.detail.lead') })
    );
    dealBlock.appendChild(
      playerPicker({
        players: game.players,
        selectedId: M.leadOf(game, round),
        labelFor: (p) => t('a11y.setLead', { name: p.name }),
        onPick: (playerId) => {
          store.setOpener(index, playerId);
          reopenSheet();
        },
      })
    );
    dealBlock.appendChild(hint(t('stairs.detail.leadAuto')));
    body.appendChild(el('section', { class: 'panel' }, dealBlock));

    /* ---- structural actions ---- */
    const actions = el('div', { class: 'sheet__actions' });

    actions.appendChild(
      sheetAction({
        label: t('stairs.insertBefore'),
        iconName: 'plus',
        onClick: () => {
          store.insertRound(index, round.cards);
          close();
          toast(t('stairs.added'));
        },
      })
    );
    actions.appendChild(
      sheetAction({
        label: t('stairs.insertAfter'),
        iconName: 'plus',
        onClick: () => {
          store.insertRound(index + 1, round.cards);
          close();
          toast(t('stairs.added'));
        },
      })
    );
    actions.appendChild(
      sheetAction({
        label: t('stairs.duplicate'),
        iconName: 'copy',
        onClick: () => {
          store.duplicateRound(index);
          close();
          toast(t('stairs.added'));
        },
      })
    );

    if (!isDone) {
      actions.appendChild(
        sheetAction({
          label: isSkipped ? t('stairs.unskip') : t('stairs.skip'),
          iconName: 'skip',
          onClick: () => {
            store.toggleSkip(index);
            close();
          },
        })
      );
    }

    if (isDone) {
      actions.appendChild(
        sheetAction({
          label: t('stairs.reopen'),
          iconName: 'pencil',
          onClick: async () => {
            const ok = await confirmSheet({
              title: t('stairs.reopen.confirm', { n: index + 1 }),
              confirmLabel: t('common.edit'),
              danger: false,
            });
            if (!ok) return;
            store.reopenRound(index);
            close();
          },
        })
      );
    } else if (M.currentRoundIndex(game) !== index) {
      // "Play this next" is the bulk form of skipping: everything unplayed
      // before this round is marked skipped so the play head lands here.
      actions.appendChild(
        sheetAction({
          label: t('stairs.jump'),
          iconName: 'arrowRight',
          onClick: () => {
            store.playNext(index);
            close();
            store.setView('play');
          },
        })
      );
    }

    actions.appendChild(
      sheetAction({
        label: t('stairs.delete'),
        iconName: 'trash',
        danger: true,
        disabled: game.rounds.length <= 1,
        onClick: async () => {
          const ok = await confirmSheet({
            title: isDone ? t('stairs.delete.confirmPlayed', { n: index + 1 }) : t('stairs.delete.confirm', { n: index + 1 }),
            confirmLabel: t('common.delete'),
          });
          if (!ok) return;
          store.removeRound(index);
          close();
          toast(t('stairs.removed'));
        },
      })
    );

    body.appendChild(actions);
    return body;
  });
}

/**
 * Per-player sheet for the round in play: sit a player out, deal them back in,
 * or apply a one-off bonus/penalty.
 */
export function openPlayerRoundSheet(index, playerId) {
  const game = store.state.game;
  if (!game) return;
  const player = M.playerById(game, playerId);
  if (!player) return;

  openSheet(({ close }) => {
    const round = game.rounds[index];
    const entry = round ? round.entries[playerId] : null;
    if (!entry) return el('div', null, sheetHeader(player.name));

    const body = el('div', null, sheetHeader(player.name, t('stairs.detail.title', { n: index + 1 })));

    body.appendChild(
      el(
        'section',
        { class: 'panel' },
        row(
          t('play.adjust'),
          t('play.adjust.hint'),
          stepper({
            value: entry.adj || 0,
            min: -999,
            max: 999,
            label: t('play.adjust'),
            onChange: (value) => {
              store.setAdjustment(index, playerId, value);
              close();
              openPlayerRoundSheet(index, playerId);
            },
          })
        )
      )
    );

    body.appendChild(
      el(
        'div',
        { class: 'sheet__actions' },
        sheetAction({
          label: entry.out ? t('play.dealIn') : t('play.sitOut'),
          iconName: entry.out ? 'userPlus' : 'skip',
          onClick: () => {
            store.setOut(index, playerId, !entry.out);
            close();
          },
        })
      )
    );

    return body;
  });
}
