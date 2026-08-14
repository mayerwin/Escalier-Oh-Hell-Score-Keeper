/**
 * The progression chart.
 *
 * Plain inline SVG, no library. Gridlines and labels use CSS custom properties
 * so the chart re-themes with the rest of the app for free; series keep their
 * player colour, which is the one thing that must stay constant between the
 * standings, the entry cards and this curve.
 */

import { svg } from './dom.js';
import { PHASE, entryOf, entryPoints } from './model.js';
import { formatNumber, t } from './i18n.js';

const W = 340;
const H = 210;
const PAD = { top: 12, right: 14, bottom: 24, left: 34 };

/**
 * Build the plotted series. Only recorded rounds appear — a round in progress
 * would otherwise make every line twitch while bids are being typed.
 */
export function buildSeries(game, mode) {
  const rounds = game.rounds.filter((r) => r.phase === PHASE.DONE);
  return {
    rounds,
    series: game.players.map((player) => {
      const opening = Number.isFinite(player.carryIn) ? player.carryIn : 0;
      const values = [];
      let running = opening;
      for (const round of rounds) {
        const points = entryPoints(entryOf(round, player.id), game.cfg);
        running += points;
        values.push(mode === 'cumulative' ? running : points);
      }
      return { id: player.id, name: player.name, color: player.color, opening, values };
    }),
  };
}

function niceBounds(values, mode) {
  const all = values.slice();
  if (mode === 'cumulative') all.push(0);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo === hi) {
    lo -= 5;
    hi += 5;
  }
  const pad = (hi - lo) * 0.12;
  return { lo: lo - pad, hi: hi + pad };
}

/**
 * Render the chart. Returns an `<svg>` element, or null when there is nothing
 * to plot yet.
 */
export function renderChart(game, mode) {
  const { rounds, series } = buildSeries(game, mode);
  const n = rounds.length;
  if (n === 0) return null;

  // Opening scores are plotted too in cumulative mode, so they must be inside
  // the bounds — a late joiner with a negative carry-in would otherwise start
  // off the top of the chart.
  const flat = series.flatMap((s) => (mode === 'cumulative' ? [s.opening, ...s.values] : s.values));
  const { lo, hi } = niceBounds(flat, mode);

  // Cumulative lines start from the opening score at x=0, so they need one
  // more slot than there are rounds.
  const slots = mode === 'cumulative' ? n : Math.max(1, n - 1);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i * plotW) / slots;
  const y = (v) => PAD.top + ((hi - v) / (hi - lo)) * plotH;

  const summary = series
    .map((s) => t('a11y.scoreOf', { name: s.name, score: formatNumber(s.values[s.values.length - 1] ?? 0) }))
    .join('. ');

  const root = svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': `${t('chart.title')}. ${summary}`,
    preserveAspectRatio: 'xMidYMid meet',
  });

  // Horizontal gridlines with value labels.
  for (let k = 0; k <= 4; k += 1) {
    const value = lo + ((hi - lo) * k) / 4;
    const gy = y(value);
    root.appendChild(
      svg('line', {
        x1: PAD.left,
        y1: gy.toFixed(1),
        x2: W - PAD.right,
        y2: gy.toFixed(1),
        stroke: 'var(--line-2)',
        'stroke-width': 1,
      })
    );
    root.appendChild(
      svg(
        'text',
        {
          x: PAD.left - 6,
          y: (gy + 3.4).toFixed(1),
          'text-anchor': 'end',
          'font-size': 9,
          fill: 'var(--ink-4)',
          'font-family': 'var(--font-ui)',
        },
        // `|| 0` collapses negative zero: a gridline just below the axis
        // rounds to -0, which Intl faithfully prints as "-0".
        formatNumber(Math.round(value) || 0)
      )
    );
  }

  // The zero line matters more than the rest — a player crossing it is news.
  if (lo < 0 && hi > 0) {
    root.appendChild(
      svg('line', {
        x1: PAD.left,
        y1: y(0).toFixed(1),
        x2: W - PAD.right,
        y2: y(0).toFixed(1),
        stroke: 'var(--line)',
        'stroke-width': 1.6,
      })
    );
  }

  // Round numbers along the bottom, thinned out so they never collide.
  const step = Math.max(1, Math.ceil(n / 7));
  for (let r = 1; r <= n; r += step) {
    const px = mode === 'cumulative' ? x(r) : x(r - 1);
    root.appendChild(
      svg(
        'text',
        {
          x: px.toFixed(1),
          y: H - 7,
          'text-anchor': 'middle',
          'font-size': 9,
          fill: 'var(--ink-4)',
          'font-family': 'var(--font-ui)',
        },
        formatNumber(r)
      )
    );
  }

  for (const s of series) {
    const points = [];
    if (mode === 'cumulative') {
      points.push([x(0), y(s.opening)]);
      s.values.forEach((v, i) => points.push([x(i + 1), y(v)]));
    } else {
      s.values.forEach((v, i) => points.push([x(i), y(v)]));
    }

    const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    root.appendChild(
      svg('path', {
        d,
        fill: 'none',
        stroke: s.color,
        'stroke-width': 2.2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        opacity: 0.94,
      })
    );

    points.forEach(([px, py], i) => {
      if (mode === 'cumulative' && i === 0) return;
      root.appendChild(svg('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 2.4, fill: s.color }));
    });

    const last = points[points.length - 1];
    root.appendChild(
      svg('circle', {
        cx: last[0].toFixed(1),
        cy: last[1].toFixed(1),
        r: 4,
        fill: s.color,
        stroke: 'var(--panel)',
        'stroke-width': 1.8,
      })
    );
  }

  return root;
}
