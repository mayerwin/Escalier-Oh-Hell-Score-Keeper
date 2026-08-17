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

function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

/**
 * The smallest step this game's scores can actually move in.
 *
 * With the default 5/5/5 every score is a multiple of five, so an axis with a
 * gridline at 41 is labelling a number nobody can reach. The unit is the gcd
 * of the scoring dials, narrowed by any manual adjustment or carry-in actually
 * present — one +3 bonus somewhere in the game genuinely does make every whole
 * number reachable, and the axis should say so rather than lie tidily.
 */
export function scoreUnit(game) {
  let unit = 0;
  for (const key of ['ptsBid', 'ptsTrick', 'ptsMiss']) unit = gcd(unit, game.cfg[key] || 0);
  for (const round of game.rounds) {
    // Entries are keyed by player id, not indexed by seat.
    for (const entry of Object.values(round.entries || {})) {
      if (entry && Number.isFinite(entry.adj) && entry.adj !== 0) unit = gcd(unit, entry.adj);
    }
  }
  for (const player of game.players) {
    if (Number.isFinite(player.carryIn) && player.carryIn !== 0) unit = gcd(unit, player.carryIn);
  }
  return unit || 1;
}

/**
 * Gridlines on whole units, at a readable spacing.
 *
 * The step is the unit times 1, 2 or 5 (times a power of ten) — the multiples
 * people read without doing arithmetic — chosen as the smallest that keeps the
 * line count down. The bounds then snap outwards to that step, which is also
 * what gives the plot its breathing room; there is no separate padding, so
 * every edge of the chart is a labelled value rather than an arbitrary one.
 */
function candidateSteps(unit) {
  const steps = new Set();
  for (let power = 0; power < 10; power += 1) {
    for (const m of [1, 2, 5]) {
      const nice = m * 10 ** power;
      // A round number that happens to land on whole units — 20 when scores
      // move in fives — is the best of both, and beats 25.
      if (nice % unit === 0) steps.add(nice);
      // Always available, and the only option when the unit is something like
      // 3, which no round number is a multiple of.
      steps.add(unit * nice);
    }
  }
  return [...steps].sort((a, b) => a - b);
}

export function axisTicks(lo, hi, unit, maxLines = 6) {
  const snap = (step) => ({ step, lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step });

  // A range of zero height would divide by zero when values are projected
  // onto it, so it is opened out by a step either side before anything else.
  const widen = (bounds) =>
    bounds.hi > bounds.lo ? bounds : { step: bounds.step, lo: bounds.lo - bounds.step, hi: bounds.hi + bounds.step };

  for (const step of candidateSteps(unit)) {
    const bounds = widen(snap(step));
    if ((bounds.hi - bounds.lo) / step + 1 <= maxLines) return bounds;
  }
  return widen(snap(unit * 10 ** 10));
}

function axisFor(values, mode, unit) {
  const all = values.slice();
  // Cumulative totals are read against zero, so it is always on the chart.
  if (mode === 'cumulative') all.push(0);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = unit;
  }
  if (lo === hi) {
    lo -= unit;
    hi += unit;
  }
  return axisTicks(lo, hi, unit);
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
  const { lo, hi, step } = axisFor(flat, mode, scoreUnit(game));

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

  // Horizontal gridlines with value labels, every one of them a score that
  // can actually be reached.
  for (let value = lo; value <= hi + step / 2; value += step) {
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
        // `|| 0` collapses negative zero, which Intl faithfully prints as "-0".
        formatNumber(value || 0)
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
  const everyNth = Math.max(1, Math.ceil(n / 7));
  for (let r = 1; r <= n; r += everyNth) {
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
