import { useMemo } from 'react';
import { useStore } from '../state/store';
import { CommitmentCard } from '../components/CommitmentCard';
import { Button } from '../components/Button';
import { coachMessage } from '../state/coach';
import { fullDayLabel, longDate, saludoHora, today } from '../state/date';
import type { Screen } from '../types';

type Props = { onNavigate: (s: Screen) => void };

export function Arranque({ onNavigate }: Props) {
  const { state, activeContract, todayEntry } = useStore();
  const coach = useMemo(() => coachMessage(state), [state]);
  const iso = today();

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

  return (
    <section className="t-arranque">
      <header className="t-arranque__head">
        <p className="eyebrow">{saludoHora()}, {state.profile?.name}</p>
        <h1 className="display t-arranque__hello">
          {fullDayLabel(iso)}, <span className="t-arranque__date">{longDate(iso)}</span>
        </h1>
        <blockquote className="t-arranque__identity identity-quote">
          <span className="t-arranque__q">“</span>
          Me estoy convirtiendo en {state.profile?.identity}
          <span className="t-arranque__q">”</span>
        </blockquote>
      </header>

      <div className={`t-coach t-coach--${coach.tone}`}>
        <span className="t-coach__spark" aria-hidden="true" />
        <p className="t-coach__text">{coach.text}</p>
      </div>

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
.t-arranque { display: flex; flex-direction: column; gap: 22px; }
.t-arranque__head { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.t-arranque__hello {
  font-size: clamp(28px, 6vw, 38px);
  color: var(--fg-1);
}
.t-arranque__date { color: var(--gold); font-style: italic; }
.t-arranque__identity {
  font-size: clamp(18px, 3.8vw, 22px);
  color: var(--fg-1);
  padding: 18px 20px;
  background: linear-gradient(180deg, rgba(212,166,74,0.06), transparent);
  border-left: 2px solid var(--gold);
  border-radius: 0 12px 12px 0;
  margin: 6px 0 0;
}
.t-arranque__q { color: var(--gold); font-size: 26px; padding: 0 4px; vertical-align: -6px; }

.t-coach {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--line);
  border-radius: 14px;
  position: relative; overflow: hidden;
}
.t-coach::before {
  content: 'Coach';
  position: absolute; right: 12px; top: 10px;
  font-size: 9px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--fg-3);
}
.t-coach__spark {
  width: 8px; height: 8px; border-radius: 999px; background: var(--gold);
  box-shadow: 0 0 12px var(--gold-glow);
  margin-top: 8px; flex-shrink: 0;
}
.t-coach__text {
  font-family: var(--font-display); font-variation-settings: 'opsz' 144, 'SOFT' 60;
  font-size: 16px; line-height: 1.45; color: var(--fg-1);
  padding-right: 60px;
}
.t-coach--firme { border-color: color-mix(in oklab, var(--gold) 45%, var(--line)); }
.t-coach--firme::before { color: var(--gold); }
.t-coach--reconducir { border-color: color-mix(in oklab, var(--danger) 30%, var(--line)); }
.t-coach--racha { border-color: var(--gold); background: linear-gradient(180deg, var(--gold-dim), var(--bg-1)); }

.t-arranque__list { display: flex; flex-direction: column; gap: 14px; }

.t-arranque__foot {
  color: var(--fg-3); font-size: 13px; line-height: 1.55;
  text-align: center; margin-top: 8px;
  font-family: var(--font-display); font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 100;
}
.t-arranque__foot em { color: var(--minimum); font-style: italic; }
`;

const emptyCss = `
.t-empty {
  padding: 60px 0; display: flex; flex-direction: column; gap: 18px;
  align-items: flex-start;
}
.t-empty__title { font-size: clamp(30px, 6vw, 40px); max-width: 20ch; }
.t-empty__lead { color: var(--fg-2); font-size: 15px; max-width: 42ch; line-height: 1.55; }
`;
