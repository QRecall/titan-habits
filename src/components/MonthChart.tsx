import { useMemo, useState } from 'react';
import type { AppState } from '../types';
import { computeMonth, monthKeyOf, shiftMonth, type MonthDay } from '../state/month';
import { longDate } from '../state/date';

type Props = { state: AppState; todayISO: string };

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Geometría en unidades del viewBox; el SVG se escala al ancho disponible.
// Ancho pensado para ~280 px reales (móvil de 360 px) → texto a escala ~1.
const W = 280;
const H = 160;
const PAD = { left: 20, right: 8, top: 10, bottom: 24 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function decimal(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

/** Tramos de días consecutivos con punto, para no unir por encima de huecos. */
function segments(days: MonthDay[]): MonthDay[][] {
  const out: MonthDay[][] = [];
  let run: MonthDay[] = [];
  for (const d of days) {
    if (d.done === null) {
      if (run.length) out.push(run);
      run = [];
    } else run.push(d);
  }
  if (run.length) out.push(run);
  return out;
}

export function MonthChart({ state, todayISO }: Props) {
  const currentMonth = monthKeyOf(todayISO);
  const [monthKey, setMonthKey] = useState(currentMonth);
  const month = useMemo(() => computeMonth(state, monthKey, todayISO), [state, monthKey, todayISO]);

  const n = month.days.length;
  const yMax = Math.max(month.maxActive, 1);
  const x = (day: number) => PAD.left + ((day - 1) / (n - 1)) * PLOT_W;
  const y = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H;

  const ticksY = Array.from({ length: yMax + 1 }, (_, i) => i);
  const ticksX = [1, 5, 10, 15, 20, 25, n];
  const today = month.days.find((d) => d.isToday) ?? null;

  // Techo de compromisos activos por día (escalón discontinuo).
  const capPath = month.days
    .map((d, i) => {
      const x0 = i === 0 ? x(d.day) : x(d.day - 0.5);
      const x1 = i === n - 1 ? x(d.day) : x(d.day + 0.5);
      return d.active > 0 ? `M${x0.toFixed(1)},${y(d.active).toFixed(1)}H${x1.toFixed(1)}` : '';
    })
    .join('');

  const summary =
    month.maxActive === 0
      ? 'Sin compromisos activos este mes.'
      : month.averageDone === null
        ? 'Aún no hay días completos que promediar.'
        : `Media ${decimal(month.averageDone)} cumplidos/día (${Math.round(month.averageRatio! * 100)} %)` +
          (month.best ? ` · Mejor día: ${longDate(month.best.date)}, ${month.best.done}/${month.best.active}` : '');

  const isCurrent = monthKey === currentMonth;

  return (
    <div className="t-month">
      <div className="t-month__head">
        <p className="eyebrow">Mes · {monthLabel(monthKey)}</p>
        <div className="t-month__nav">
          <button type="button" className="t-month__btn" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} aria-label="Mes anterior">‹</button>
          <button
            type="button"
            className="t-month__btn"
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
            disabled={isCurrent}
            aria-label="Mes siguiente"
          >›</button>
        </div>
      </div>

      <svg
        className="t-month__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Compromisos cumplidos por día en ${monthLabel(monthKey)}. ${summary}`}
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="t-month__grid" />
            <text x={PAD.left - 7} y={y(t)} className="t-month__label" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        {ticksX.map((d) => (
          <text key={d} x={x(d)} y={H - 6} className="t-month__label" textAnchor="middle">{d}</text>
        ))}

        {capPath && <path d={capPath} className="t-month__cap" />}

        {today && <line x1={x(today.day)} x2={x(today.day)} y1={PAD.top} y2={PAD.top + PLOT_H} className="t-month__today-line" />}

        {segments(month.days).map((run) =>
          run.length > 1 ? (
            <polyline
              key={run[0].date}
              points={run.map((d) => `${x(d.day).toFixed(1)},${y(d.done!).toFixed(1)}`).join(' ')}
              className="t-month__line"
            />
          ) : null
        )}

        {month.days.map((d) =>
          d.done === null ? null : (
            <circle
              key={d.date}
              cx={x(d.day)}
              cy={y(d.done)}
              r={d.isToday ? 4.5 : 3}
              className={d.isToday ? 't-month__dot t-month__dot--today' : 't-month__dot'}
            >
              <title>{`${longDate(d.date)}: ${d.done}/${d.active}${d.fact ? ` · ${d.fact}` : ''}`}</title>
            </circle>
          )
        )}
      </svg>

      <p className="t-month__summary">{summary}</p>
      <style>{css}</style>
    </div>
  );
}

const css = `
.t-month {
  display: flex; flex-direction: column; gap: 10px;
  padding: 18px 18px 20px;
  background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius-l);
}
.t-month__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.t-month__nav { display: flex; gap: 4px; }
.t-month__btn {
  width: 44px; height: 44px; border-radius: var(--radius-s);
  background: transparent; border: 1px solid var(--line); color: var(--fg-2);
  font-size: 20px; line-height: 1; cursor: pointer;
}
.t-month__btn:disabled { opacity: 0.3; cursor: default; }
.t-month__svg { width: 100%; height: auto; display: block; overflow: visible; }
.t-month__grid { stroke: var(--line-strong); stroke-width: 0.6; }
.t-month__label { fill: var(--fg-3); font-size: 11px; font-family: var(--font-body); }
.t-month__cap { stroke: var(--fg-3); stroke-width: 1; stroke-dasharray: 2 2; fill: none; opacity: 0.6; }
.t-month__today-line { stroke: var(--gold); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5; }
.t-month__line { fill: none; stroke: var(--gold); stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; }
.t-month__dot { fill: var(--gold); stroke: var(--bg-1); stroke-width: 1.2; }
.t-month__dot--today { fill: var(--gold-bright); stroke: var(--bg-1); stroke-width: 1.5; filter: drop-shadow(0 0 4px var(--gold-glow)); }
.t-month__summary { margin: 0; font-size: 13px; color: var(--fg-2); }
`;
