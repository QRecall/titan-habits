import { useMemo } from 'react';
import { useStore } from '../state/store';
import { CommitmentCard } from '../components/CommitmentCard';
import { Button } from '../components/Button';
import { Mascot } from '../components/Mascot';
import { coachMessage } from '../state/coach';
import { computeStreakAcross, computeWeekStats } from '../state/stats';
import { flameLevel, moodFor, todayStatus } from '../state/mood';
import { fullDayLabel, longDate, saludoHora, today } from '../state/date';
import type { Screen } from '../types';

type Props = { onNavigate: (s: Screen) => void };

export function Arranque({ onNavigate }: Props) {
  const { state, activeContract, todayEntry } = useStore();
  const iso = today();

  const view = useMemo(() => {
    const coach = coachMessage(state, iso);
    const status = todayStatus(state, iso);
    const mood = moodFor(status);
    const streak = computeStreakAcross(state, iso);
    const week = activeContract ? computeWeekStats(state, activeContract, iso) : null;
    return { coach, status, mood, streak, week };
  }, [state, activeContract, iso]);

  if (!activeContract) {
    return (
      <div className="t-empty">
        <p className="eyebrow eyebrow--gold">Sin contrato</p>
        <h1 className="display t-empty__title">Antes de arrancar, firma tu semana.</h1>
        <p className="t-empty__lead">
          Sin compromisos no hay hábitos que sostener. Empieza con uno solo si prefieres.
        </p>
        <Button onClick={() => onNavigate('contrato')}>Ir al contrato</Button>
        <style>{emptyCss}</style>
      </div>
    );
  }

  const { coach, status, mood, streak, week } = view;
  const weekLabel = week ? `${week.daysHonored}/${week.evaluableDays.length}` : '';

  return (
    <section className="t-arranque">
      <header className="t-arranque__head">
        <p className="eyebrow">{saludoHora()}, {state.profile?.name}</p>
        <h1 className="display t-arranque__hello">
          {fullDayLabel(iso)}, <span className="t-arranque__date">{longDate(iso)}</span>
        </h1>
      </header>

      <div className={`t-hero t-hero--${mood}`}>
        <Mascot mood={mood} level={flameLevel(streak)} size={120} />
        <div className="t-hero__body">
          <div className="t-hero__row">
            <div className="t-hero__stat">
              <span className="eyebrow">Racha</span>
              <span className="t-hero__value display">
                {streak}
                <em>{streak === 1 ? 'día' : 'días'}</em>
              </span>
            </div>
            <div className="t-hero__stat">
              <span className="eyebrow">Semana</span>
              <span className="t-hero__value display">
                {weekLabel}
                <em>días</em>
              </span>
            </div>
            <div className="t-hero__stat">
              <span className="eyebrow">Hoy</span>
              <span className="t-hero__value display">
                {status.pending}
                <em>{status.pending === 1 ? 'pendiente' : 'pendientes'}</em>
              </span>
            </div>
          </div>
          <p className="t-hero__coach">{coach.text}</p>
        </div>
      </div>

      <blockquote className="t-arranque__identity identity-quote">
        <span className="t-arranque__q">“</span>
        Me estoy convirtiendo en {state.profile?.identity}
        <span className="t-arranque__q">”</span>
      </blockquote>

      <div className="t-arranque__list">
        {activeContract.commitments.map((c) => {
          const mark = todayEntry?.marks.find((m) => m.commitmentId === c.id);
          return <CommitmentCard key={c.id} commitment={c} mark={mark} />;
        })}
      </div>

      <p className="t-arranque__foot">
        La versión <em>mínima</em> también mantiene vivo el hábito. Un ladrillo hoy
        pesa más que un edificio imaginado mañana.
      </p>

      <style>{css}</style>
    </section>
  );
}

const css = `
.t-arranque { display: flex; flex-direction: column; gap: 20px; }
.t-arranque__head { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.t-arranque__hello {
  font-size: clamp(28px, 6vw, 38px);
  color: var(--fg-1);
}
.t-arranque__date { color: var(--gold); font-style: italic; }
.t-arranque__identity {
  font-size: clamp(17px, 3.6vw, 20px);
  color: var(--fg-1);
  padding: 14px 18px;
  background: linear-gradient(180deg, rgba(212,166,74,0.06), transparent);
  border-left: 2px solid var(--gold);
  border-radius: 0 12px 12px 0;
  margin: 0;
}
.t-arranque__q { color: var(--gold); font-size: 24px; padding: 0 4px; vertical-align: -6px; }

.t-hero {
  display: flex; gap: 16px; align-items: center;
  padding: 16px 18px;
  background: linear-gradient(180deg, #16171B, #131317);
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
  box-shadow: var(--shadow-panel);
  animation: rise .5s var(--ease-out) both;
}
.t-hero--firme { border-color: color-mix(in oklab, var(--gold) 50%, var(--line)); background: linear-gradient(180deg, var(--gold-dim), #131317); }
.t-hero--vivo { border-color: color-mix(in oklab, var(--minimum) 40%, var(--line)); }
.t-hero--reconducir { border-color: color-mix(in oklab, var(--danger) 30%, var(--line)); }
.t-hero__body { display: flex; flex-direction: column; gap: 10px; min-width: 0; flex: 1; }
.t-hero__row { display: flex; gap: 14px; flex-wrap: wrap; }
.t-hero__stat { display: flex; flex-direction: column; gap: 2px; min-width: 64px; }
.t-hero__value { font-size: 26px; line-height: 1; color: var(--gold); font-variation-settings: 'opsz' 144; white-space: nowrap; }
.t-hero__value em { font-style: normal; font-size: 10px; color: var(--fg-2); margin-left: 5px; letter-spacing: 0.12em; text-transform: uppercase; }
.t-hero__coach {
  font-family: var(--font-display); font-variation-settings: 'opsz' 144, 'SOFT' 60;
  font-size: 15px; line-height: 1.4; color: var(--fg-1);
}

.t-arranque__list { display: flex; flex-direction: column; gap: 14px; }

.t-arranque__foot {
  color: var(--fg-2); font-size: 13px; line-height: 1.55;
  text-align: center; margin-top: 8px;
  font-family: var(--font-display); font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 100;
}
.t-arranque__foot em { color: var(--minimum); font-style: italic; }

@media (max-width: 440px) {
  .t-hero { flex-direction: column; align-items: center; text-align: center; }
  .t-hero__row { justify-content: center; }
}
`;

const emptyCss = `
.t-empty {
  padding: 60px 0; display: flex; flex-direction: column; gap: 18px;
  align-items: flex-start;
}
.t-empty__title { font-size: clamp(30px, 6vw, 40px); max-width: 20ch; }
.t-empty__lead { color: var(--fg-2); font-size: 15px; max-width: 42ch; line-height: 1.55; }
`;
