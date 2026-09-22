import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Button } from '../components/Button';
import { TextAreaField } from '../components/Field';
import { currentWeekKey, weekRangeLabel } from '../state/date';
import { computeWeekStats } from '../state/stats';
import { contractsBefore } from '../state/contracts';
import { fragileCommitment } from '../state/fragile';
import type { Screen, WeeklyContract } from '../types';

type Props = { onNavigate: (s: Screen) => void };

type Tab = { key: string; label: string; contract: WeeklyContract };

export function Review({ onNavigate }: Props) {
  const { state, activeContract, previousContract, nextContract } = useStore();

  // Pestañas: la semana actual (si ya está firmada) y la anterior.
  const tabs: Tab[] = [];
  if (activeContract) tabs.push({ key: activeContract.weekKey, label: 'Esta semana', contract: activeContract });
  if (previousContract) tabs.push({ key: previousContract.weekKey, label: 'Semana pasada', contract: previousContract });

  // Semanas más antiguas que «Semana pasada» (o que la semana actual, si no hay pasada).
  const olderKey = previousContract?.weekKey ?? activeContract?.weekKey ?? currentWeekKey();
  const older = contractsBefore(state.contracts, olderKey);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(
    tabs[0]?.key ?? older[0]?.weekKey ?? null
  );

  const selectedContract =
    (selectedWeekKey && state.contracts.find((c) => c.weekKey === selectedWeekKey)) || null;
  const rangeLabel = selectedContract ? weekRangeLabel(selectedContract.startDate) : '';
  const selectValue = older.some((c) => c.weekKey === selectedWeekKey) ? (selectedWeekKey as string) : '';

  if (!selectedContract) {
    return (
      <div className="t-empty">
        <p className="eyebrow eyebrow--gold">Sin contrato</p>
        <h1 className="display t-empty__title">Aún no hay nada que revisar.</h1>
        <Button onClick={() => onNavigate('contrato')}>Firmar contrato</Button>
        <style>{emptyCss}</style>
      </div>
    );
  }

  return (
    <section className="t-review">
      <header className="t-review__head">
        <p className="eyebrow eyebrow--gold">Revisión semanal</p>
        <h1 className="display t-review__title">Mirar antes de firmar la siguiente.</h1>
        <p className="t-review__range">{rangeLabel}</p>
      </header>

      {tabs.length > 1 && (
        <div className="t-review__weeks" role="tablist" aria-label="Semana a revisar">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === selectedWeekKey}
              className={`t-review__week${t.key === selectedWeekKey ? ' is-active' : ''}`}
              onClick={() => setSelectedWeekKey(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {older.length > 0 && (
        <div className="t-review__older">
          <label htmlFor="review-older-week" className="t-field__label">
            Semanas anteriores
          </label>
          <select
            id="review-older-week"
            className="t-review__select"
            value={selectValue}
            onChange={(e) => {
              if (e.target.value) setSelectedWeekKey(e.target.value);
            }}
          >
            <option value="" disabled hidden>
              Semanas anteriores
            </option>
            {older.map((c) => (
              <option key={c.weekKey} value={c.weekKey}>
                {weekRangeLabel(c.startDate)}
              </option>
            ))}
          </select>
        </div>
      )}

      <ReviewForm key={selectedContract.weekKey} contract={selectedContract} />

      <div className="t-review__actions">
        {activeContract ? (
          <Button full variant="ghost" onClick={() => onNavigate('contrato-proxima')}>
            {nextContract ? 'Ajustar la próxima semana' : 'Preparar el contrato de la próxima semana'}
          </Button>
        ) : (
          <Button full variant="ghost" onClick={() => onNavigate('contrato')}>
            Firmar el contrato de esta semana
          </Button>
        )}
      </div>

      <p className="t-review__foot">
        No hay veredicto ni castigo. Solo información para firmar mejor la próxima semana.
      </p>

      <style>{css}</style>
    </section>
  );
}

function ReviewForm({ contract }: { contract: WeeklyContract }) {
  const { state, saveReview } = useStore();
  const existing = useMemo(
    () => state.reviews.find((r) => r.weekKey === contract.weekKey),
    [state.reviews, contract.weekKey]
  );

  const [worked, setWorked] = useState(existing?.worked ?? '');
  const [hindered, setHindered] = useState(existing?.hindered ?? '');
  const [changeNext, setChangeNext] = useState(existing?.changeNext ?? '');
  const [saved, setSaved] = useState(false);

  const summary = useMemo(() => {
    const stats = computeWeekStats(state, contract);
    return contract.commitments.map((c) => {
      const per = stats.perCommitment.find((p) => p.commitmentId === c.id)!;
      return { c, normal: per.normal, minimum: per.minimum, missed: per.missed, blank: per.unmarked };
    });
  }, [contract, state]);

  const fragile = useMemo(() => fragileCommitment(state, contract), [contract, state]);

  function submit() {
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
    <>
      <div className="t-review__summary">
        <p className="eyebrow">Compromisos cumplidos</p>
        <ul className="t-review__list">
          {summary.map(({ c, normal, minimum, missed, blank }) => (
            <li key={c.id} className="t-review__item">
              <div className="t-review__name">
                {c.name}
                {c.removedOn && <span className="t-review__removed"> · quitado</span>}
              </div>
              <div className="t-review__stats">
                <span className="t-review__stat t-review__stat--normal">{normal} <em>normal</em></span>
                <span className="t-review__stat t-review__stat--min">{minimum} <em>mínimo</em></span>
                <span className="t-review__stat t-review__stat--miss">{missed} <em>fallado</em></span>
                {blank > 0 && <span className="t-review__stat t-review__stat--blank">{blank} <em>sin marcar</em></span>}
              </div>
            </li>
          ))}
        </ul>
        {fragile && (
          <p className="t-review__fragile">
            El que más te cuesta: <strong>{fragile.commitment.name}</strong> (no cumplido {fragile.fails} de{' '}
            {fragile.days} {fragile.days === 1 ? 'día' : 'días'}). Si quieres sostenerlo, prueba a bajar su
            versión mínima la semana que viene.
          </p>
        )}
      </div>

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
          Guardar revisión
        </Button>
        {saved && <p className="t-review__saved">Revisión guardada. El historial se mantiene.</p>}
      </div>
    </>
  );
}

const css = `
.t-review { display: flex; flex-direction: column; gap: 24px; }
.t-review__title { font-size: clamp(28px, 6vw, 36px); }
.t-review__range { color: var(--gold); font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; }

.t-review__weeks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.t-review__week {
  min-height: 44px; border-radius: 12px; border: 1px solid var(--line);
  background: var(--bg-2); color: var(--fg-2); font-size: 13px; font-weight: 600;
  transition: color .2s, border-color .2s, background .2s;
}
.t-review__week.is-active { color: var(--gold); border-color: var(--gold); background: var(--gold-dim); }

.t-review__older { display: flex; flex-direction: column; gap: 6px; }
.t-field__label { font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--fg-2); }
.t-review__select {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px;
  padding: 12px 14px; color: var(--fg-1); font-size: 15px; font-family: var(--font-body);
  color-scheme: dark; min-height: 44px; width: 100%;
}
.t-review__select:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 4px var(--gold-dim); }

.t-review__summary {
  display: flex; flex-direction: column; gap: 12px;
  padding: 18px; background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius-l);
}
.t-review__fragile { margin: 0; color: var(--fg-2); font-size: 13px; line-height: 1.5; }
.t-review__fragile strong { color: var(--gold); font-weight: 600; }
.t-review__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.t-review__item {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 12px;
}
.t-review__name { font-family: var(--font-display); font-size: 18px; color: var(--fg-1); }
.t-review__removed { font-family: var(--font-body); font-size: 13px; color: var(--fg-3); }
.t-review__stats { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 13px; color: var(--fg-2); }
.t-review__stat em { font-style: normal; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-2); margin-left: 3px; }
.t-review__stat--normal { color: var(--gold); }
.t-review__stat--min { color: var(--minimum); }
.t-review__stat--miss { color: var(--danger); }

.t-review__form { display: flex; flex-direction: column; gap: 18px; }
.t-review__actions { display: flex; flex-direction: column; gap: 10px; }
.t-review__saved { text-align: center; color: var(--gold); font-size: 13px; margin: 4px 0 0; }
.t-review__foot {
  color: var(--fg-2); font-size: 12px; text-align: center;
  font-family: var(--font-display); font-style: italic; font-variation-settings: 'opsz' 144, 'SOFT' 100;
}
`;

const emptyCss = `
.t-empty { padding: 60px 0; display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
.t-empty__title { font-size: clamp(28px, 6vw, 38px); max-width: 20ch; }
`;
