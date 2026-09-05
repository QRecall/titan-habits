import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Button } from '../components/Button';
import { TextAreaField } from '../components/Field';
import { weekRangeLabel } from '../state/date';
import { computeWeekStats } from '../state/stats';
import type { Screen } from '../types';

type Props = { onNavigate: (s: Screen) => void };

export function Review({ onNavigate }: Props) {
  const { state, activeContract, saveReview } = useStore();

  const contract = activeContract;
  const existing = useMemo(
    () => (contract ? state.reviews.find((r) => r.weekKey === contract.weekKey) : undefined),
    [state.reviews, contract]
  );

  const [worked, setWorked] = useState(existing?.worked ?? '');
  const [hindered, setHindered] = useState(existing?.hindered ?? '');
  const [changeNext, setChangeNext] = useState(existing?.changeNext ?? '');
  const [saved, setSaved] = useState(false);

  const summary = useMemo(() => {
    if (!contract) return null;
    const stats = computeWeekStats(state, contract);
    return contract.commitments.map((c) => {
      const per = stats.perCommitment.find((p) => p.commitmentId === c.id)!;
      return { c, normal: per.normal, minimum: per.minimum, missed: per.missed, blank: per.unmarked };
    });
  }, [contract, state]);

  if (!contract) {
    return (
      <div className="t-empty">
        <p className="eyebrow eyebrow--gold">Sin contrato</p>
        <h1 className="display t-empty__title">Aún no hay nada que revisar.</h1>
        <Button onClick={() => onNavigate('contrato')}>Firmar contrato</Button>
        <style>{emptyCss}</style>
      </div>
    );
  }

  function submit() {
    if (!contract) return;
    saveReview({
      weekKey: contract.weekKey,
      worked: worked.trim(),
      hindered: hindered.trim(),
      changeNext: changeNext.trim(),
    });
    setSaved(true);
  }

  const canSave = worked.trim() || hindered.trim() || changeNext.trim();

  return (
    <section className="t-review">
      <header className="t-review__head">
        <p className="eyebrow eyebrow--gold">Revisión semanal</p>
        <h1 className="display t-review__title">Mirar antes de firmar la siguiente.</h1>
        <p className="t-review__range">{weekRangeLabel(contract.startDate)}</p>
      </header>

      {summary && (
        <div className="t-review__summary">
          <p className="eyebrow">Compromisos cumplidos</p>
          <ul className="t-review__list">
            {summary.map(({ c, normal, minimum, missed, blank }) => (
              <li key={c.id} className="t-review__item">
                <div className="t-review__name">{c.name}</div>
                <div className="t-review__stats">
                  <span className="t-review__stat t-review__stat--normal">{normal} <em>normal</em></span>
                  <span className="t-review__stat t-review__stat--min">{minimum} <em>mínimo</em></span>
                  <span className="t-review__stat t-review__stat--miss">{missed} <em>fallado</em></span>
                  {blank > 0 && <span className="t-review__stat t-review__stat--blank">{blank} <em>sin marcar</em></span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="t-review__form">
        <TextAreaField
          id="worked"
          label="Qué funcionó"
          placeholder="Los días que dormí bien no me costó nada."
          value={worked}
          onChange={(e) => setWorked(e.target.value)}
          maxLength={400}
        />
        <TextAreaField
          id="hindered"
          label="Qué dificultó cumplirlos"
          placeholder="Las noches con pantallas me robaron la mañana."
          value={hindered}
          onChange={(e) => setHindered(e.target.value)}
          maxLength={400}
        />
        <TextAreaField
          id="change"
          label="Qué cambiaré la próxima semana"
          placeholder="Bajar el mínimo del entreno a 5 min si tengo menos de 6h de sueño."
          value={changeNext}
          onChange={(e) => setChangeNext(e.target.value)}
          maxLength={400}
        />
      </div>

      <div className="t-review__actions">
        <Button full onClick={submit} disabled={!canSave} variant="primary">
          {existing ? 'Guardar revisión' : 'Guardar revisión'}
        </Button>
        <Button full variant="ghost" onClick={() => onNavigate('contrato')}>
          Firmar contrato de la próxima semana
        </Button>
        {saved && <p className="t-review__saved">Revisión guardada. El historial se mantiene.</p>}
      </div>

      <p className="t-review__foot">
        No hay veredicto ni castigo. Solo información para firmar mejor la próxima semana.
      </p>

      <style>{css}</style>
    </section>
  );
}

const css = `
.t-review { display: flex; flex-direction: column; gap: 24px; }
.t-review__title { font-size: clamp(28px, 6vw, 36px); }
.t-review__range { color: var(--gold); font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; }

.t-review__summary {
  display: flex; flex-direction: column; gap: 12px;
  padding: 18px; background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius-l);
}
.t-review__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.t-review__item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px;
}
.t-review__name { font-family: var(--font-display); font-size: 18px; color: var(--fg-1); }
.t-review__stats { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 13px; color: var(--fg-2); }
.t-review__stat em { font-style: normal; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-3); margin-left: 3px; }
.t-review__stat--normal { color: var(--gold); }
.t-review__stat--min { color: var(--minimum); }
.t-review__stat--miss { color: var(--danger); }

.t-review__form { display: flex; flex-direction: column; gap: 18px; }
.t-review__actions { display: flex; flex-direction: column; gap: 10px; }
.t-review__saved { text-align: center; color: var(--gold); font-size: 13px; margin: 4px 0 0; }
.t-review__foot {
  color: var(--fg-3); font-size: 12px; text-align: center;
  font-family: var(--font-display); font-style: italic; font-variation-settings: 'opsz' 144, 'SOFT' 100;
}
`;

const emptyCss = `
.t-empty { padding: 60px 0; display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
.t-empty__title { font-size: clamp(28px, 6vw, 38px); max-width: 20ch; }
`;
