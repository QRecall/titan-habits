import { useMemo } from 'react';
import { useStore } from '../state/store';
import { ProgressRing } from '../components/ProgressRing';
import { Button } from '../components/Button';
import { computeStreakAcross, computeWeekStats } from '../state/stats';
import { daysInWeek, shortDayLabel, today } from '../state/date';
import type { CommitmentStatus, Screen } from '../types';

type Props = { onNavigate: (s: Screen) => void };

export function Progress({ onNavigate }: Props) {
  const { state, activeContract } = useStore();

  const view = useMemo(() => {
    if (!activeContract) return null;
    const todayISO = today();
    const stats = computeWeekStats(state, activeContract, todayISO);
    const streak = computeStreakAcross(state, todayISO);
    const weekDays = daysInWeek(activeContract.startDate);
    return { stats, streak, todayISO, weekDays };
  }, [state, activeContract]);

  if (!activeContract || !view) {
    return (
      <div className="t-empty">
        <p className="eyebrow eyebrow--gold">Sin datos aún</p>
        <h1 className="display t-empty__title">El progreso empieza al firmar el contrato.</h1>
        <Button onClick={() => onNavigate('contrato')}>Firmar contrato</Button>
        <style>{emptyCss}</style>
      </div>
    );
  }

  const { stats, streak, todayISO, weekDays } = view;
  const evaluableCount = stats.evaluableDays.length;
  const percentLabel = Math.round(stats.percent * 100) + '%';

  return (
    <section className="t-prog">
      <header className="t-prog__head">
        <p className="eyebrow eyebrow--gold">Progreso · esta semana</p>
        <h1 className="display t-prog__title">Cómo lo estás sosteniendo.</h1>
      </header>

      <div className="t-prog__hero">
        <ProgressRing value={stats.percent} size={160} stroke={10} label={percentLabel} sub="Cumplimiento" />
        <div className="t-prog__kpis">
          <Kpi
            label="Días cumplidos"
            value={`${stats.daysHonored}/${evaluableCount}`}
            unit={evaluableCount === 1 ? 'día' : 'días'}
          />
          <Kpi
            label="Racha actual"
            value={`${streak}`}
            unit={streak === 1 ? 'día' : 'días'}
            accent
          />
        </div>
      </div>

      <div className="t-prog__breakdown">
        <p className="eyebrow">Distribución</p>
        <div className="t-prog__bar" aria-hidden="true">
          {stats.normalCount + stats.minimumCount + stats.missedCount > 0 ? (
            <>
              <span style={{ flex: stats.normalCount }} className="t-prog__seg t-prog__seg--normal" />
              <span style={{ flex: stats.minimumCount }} className="t-prog__seg t-prog__seg--min" />
              <span style={{ flex: stats.missedCount }} className="t-prog__seg t-prog__seg--miss" />
            </>
          ) : (
            <span className="t-prog__seg t-prog__seg--empty" style={{ flex: 1 }} />
          )}
        </div>
        <ul className="t-prog__legend">
          <li><span className="t-dot t-dot--normal" /> Normal · {stats.normalCount}</li>
          <li><span className="t-dot t-dot--minimum" /> Mínimo · {stats.minimumCount}</li>
          <li><span className="t-dot t-dot--missed" /> Fallado · {stats.missedCount}</li>
        </ul>
      </div>

      <div className="t-prog__week">
        <p className="eyebrow">Semana</p>
        <div className="t-prog__grid" role="table" aria-label="Cuadrícula semanal">
          <div className="t-prog__row t-prog__row--head" role="row">
            <div className="t-prog__cell t-prog__cell--label" role="rowheader" aria-label="compromiso"></div>
            {weekDays.map((iso) => (
              <div key={iso} className={`t-prog__cell t-prog__cell--day${iso === todayISO ? ' is-today' : ''}`} role="columnheader">
                {shortDayLabel(iso)}
              </div>
            ))}
          </div>
          {activeContract.commitments.map((c) => (
            <div key={c.id} className="t-prog__row" role="row">
              <div className="t-prog__cell t-prog__cell--label" role="rowheader">{c.name}</div>
              {weekDays.map((iso) => {
                const evaluable = iso >= activeContract.signedAt && iso <= todayISO;
                const day = state.days.find((d) => d.date === iso);
                const status = (day?.marks.find((m) => m.commitmentId === c.id)?.status ?? null) as CommitmentStatus;
                const cls = !evaluable
                  ? (iso > todayISO ? 'is-future' : 'is-outside')
                  : status
                    ? `is-${status}`
                    : 'is-blank';
                const title = status === 'normal' ? 'Normal' : status === 'minimum' ? 'Mínimo' : status === 'missed' ? 'Hoy no' : '';
                return (
                  <div key={iso} className={`t-prog__cell t-prog__cell--dot ${cls}`} role="cell" title={title}>
                    <span className="t-prog__pip" aria-hidden="true" />
                    <span className="visually-hidden">{c.name} {shortDayLabel(iso)}: {title || (evaluable ? 'sin marcar' : 'fuera del contrato')}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <style>{css}</style>
    </section>
  );
}

function Kpi({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className={`t-kpi${accent ? ' t-kpi--accent' : ''}`}>
      <span className="eyebrow">{label}</span>
      <span className="t-kpi__value display">
        {value}
        {unit && <em className="t-kpi__unit">{unit}</em>}
      </span>
    </div>
  );
}

const css = `
.t-prog { display: flex; flex-direction: column; gap: 24px; }
.t-prog__title { font-size: clamp(28px, 6vw, 36px); }

.t-prog__hero {
  display: grid; grid-template-columns: auto 1fr; gap: 22px; align-items: center;
  padding: 22px 20px;
  background: linear-gradient(180deg, #16171B, #131317);
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
}
.t-prog__kpis { display: flex; flex-direction: column; gap: 14px; }
.t-kpi { display: flex; flex-direction: column; gap: 6px; }
.t-kpi__value { font-size: 34px; color: var(--fg-1); line-height: 1; font-variation-settings: 'opsz' 144; }
.t-kpi__unit { font-style: normal; font-size: 14px; color: var(--fg-3); margin-left: 6px; letter-spacing: 0.1em; text-transform: uppercase; }
.t-kpi--accent .t-kpi__value { color: var(--gold); }

.t-prog__breakdown, .t-prog__week {
  display: flex; flex-direction: column; gap: 12px;
  padding: 18px 18px 20px;
  background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius-l);
}
.t-prog__bar {
  display: flex; height: 10px; border-radius: 999px; overflow: hidden;
  background: var(--bg-3);
}
.t-prog__seg--normal { background: linear-gradient(90deg, var(--gold-bright), var(--gold)); }
.t-prog__seg--min { background: var(--minimum); }
.t-prog__seg--miss { background: color-mix(in oklab, var(--danger) 65%, var(--bg-3)); }
.t-prog__seg--empty { background: repeating-linear-gradient(45deg, transparent 0 6px, rgba(255,255,255,0.03) 6px 12px); }

.t-prog__legend {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-wrap: wrap; gap: 12px 18px;
  color: var(--fg-2); font-size: 13px;
}
.t-prog__legend li { display: inline-flex; align-items: center; gap: 8px; }

.t-prog__grid { display: flex; flex-direction: column; gap: 8px; }
.t-prog__row { display: grid; grid-template-columns: minmax(60px, 1.2fr) repeat(7, 1fr); gap: 6px; align-items: center; }
.t-prog__row--head .t-prog__cell--day {
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-3);
  text-align: center; padding: 4px 0;
}
.t-prog__cell--day.is-today { color: var(--gold); }
.t-prog__cell--label {
  font-size: 12px; color: var(--fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.t-prog__cell--dot {
  aspect-ratio: 1;
  border-radius: 8px;
  background: var(--bg-2);
  display: flex; align-items: center; justify-content: center;
  border: 1px solid transparent;
}
.t-prog__cell--dot.is-normal { background: var(--gold); box-shadow: 0 0 12px var(--gold-glow); }
.t-prog__cell--dot.is-minimum { background: transparent; border-color: var(--minimum); }
.t-prog__cell--dot.is-minimum .t-prog__pip { background: var(--minimum); }
.t-prog__cell--dot.is-missed { background: transparent; border-color: rgba(194,75,69,0.5); }
.t-prog__cell--dot.is-missed .t-prog__pip { background: var(--danger); width: 8px; height: 2px; border-radius: 2px; }
.t-prog__cell--dot.is-blank { background: rgba(255,255,255,0.02); }
.t-prog__cell--dot.is-future { background: transparent; border: 1px dashed var(--line-strong); }
.t-prog__cell--dot.is-outside { background: transparent; border: 1px dashed var(--line); opacity: 0.5; }
.t-prog__pip { width: 6px; height: 6px; border-radius: 999px; background: transparent; display: block; }
.t-prog__cell--dot.is-normal .t-prog__pip { background: #1a1305; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
`;

const emptyCss = `
.t-empty { padding: 60px 0; display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
.t-empty__title { font-size: clamp(28px, 6vw, 38px); max-width: 20ch; }
`;
