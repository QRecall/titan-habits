import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Button } from '../components/Button';
import { TextAreaField } from '../components/Field';
import { weekRangeLabel } from '../state/date';
import { computeWeekStats } from '../state/stats';
import type { Screen, WeeklyContract } from '../types';

type Props = { onNavigate: (s: Screen) => void };

type Option = { key: string; label: string; contract: WeeklyContract };

export function Review({ onNavigate }: Props) {
  const { activeContract, previousContract, nextContract } = useStore();

  // Semanas revisables: la actual (si ya está firmada) y la anterior.
  const options: Option[] = [];
  if (activeContract) options.push({ key: 'current', label: 'Esta semana', contract: activeContract });
  if (previousContract) options.push({ key: 'previous', label: 'Semana pasada', contract: previousContract });

  const [selectedKey, setSelectedKey] = useState<string>(options[0]?.key ?? 'current');
  const selected = options.find((o) => o.key === selectedKey) ?? options[0] ?? null;

  if (!selected) {
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
        <p className="t-review__range">{weekRangeLabel(selected.contract.startDate)}</p>
      </header>

      {options.length > 1 && (
        <div className="t-review__weeks" role="tablist" aria-label="Semana a revisar">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={o.key === selected.key}
              className={`t-review__week${o.key === selected.key ? ' is-active' : ''}`}
              onClick={() => setSelectedKey(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <ReviewForm key={selected.contract.weekKey} contract={selected.contract} />

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
