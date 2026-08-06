/**
 * The progression view: one curve per player, either running totals or points
 * scored in each round.
 */

import { el } from './../dom.js';
import { formatNumber, t } from './../i18n.js';
import { buildSeries, renderChart } from './../chart.js';
import * as store from './../store.js';
import { emptyState, heading, panel, seg } from './../ui.js';

export function renderChartView() {
  const game = store.state.game;
  if (!game) return emptyState(t('play.noGame.body'));

  const mode = store.state.settings.chartMode;
  const root = el('div', null, heading(t('chart.title'), true));

  root.appendChild(
    seg({
      block: true,
      label: t('chart.title'),
      value: mode,
      onChange: (value) => {
        store.setSetting('chartMode', value);
        store.render();
      },
      options: [
        { value: 'cumulative', label: t('chart.mode.cumulative') },
        { value: 'round', label: t('chart.mode.round') },
      ],
    })
  );

  const figure = renderChart(game, mode);
  if (!figure) {
    root.appendChild(el('div', { style: { 'margin-top': '0.625rem' } }, emptyState(t('chart.empty'))));
    return root;
  }

  const { series } = buildSeries(game, mode);
  const legend = el('div', { class: 'legend' });
  for (const s of series) {
    const last = s.values.length ? s.values[s.values.length - 1] : 0;
    legend.appendChild(
      el(
        'span',
        { class: 'legend__item' },
        el('span', { class: 'legend__swatch', style: { background: s.color } }),
        el('span', { text: s.name }),
        el('span', {
          class: 'legend__value',
          text: mode === 'round' && last > 0 ? `+${formatNumber(last)}` : formatNumber(last),
        })
      )
    );
  }

  root.appendChild(
    el(
      'div',
      { style: { 'margin-top': '0.625rem' } },
      panel(el('div', { class: 'chartbox' }, figure), legend)
    )
  );

  return root;
}
