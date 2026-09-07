import { useState } from 'react';
import { Button } from '../components/Button';
import { TextField, TextAreaField } from '../components/Field';
import { useStore, type ContractTarget } from '../state/store';
import { startOfISOWeek, toISODate, weekRangeLabel } from '../state/date';
import { nextWeekStart } from '../state/contracts';
import {
  MAX_COMMITMENTS,
  draftsToCommitments,
  emptyDraft,
  toDrafts,
  type Draft,
} from '../state/contractDraft';
import type { WeeklyContract } from '../types';

type Props = { target?: ContractTarget; onSaved: () => void };

export function Contract({ target = 'current', onSaved }: Props) {
  const { activeContract, previousContract, nextContract, saveContract } = useStore();

  // Contrato ya firmado para la semana objetivo (si lo hay) y fuente para
  // prellenar cuando aún no existe: el contrato más reciente. Al prellenar se
  // conservan los ids de los compromisos: son el mismo hábito que continúa.
  const existing: WeeklyContract | null = target === 'next' ? nextContract : activeContract;
  const prefill: WeeklyContract | null = existing
    ? null
    : target === 'next'
      ? (activeContract ?? previousContract)
      : previousContract;

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    toDrafts((existing ?? prefill)?.commitments ?? [])
  );
  const [fromScratch, setFromScratch] = useState(false);

  const weekStart = target === 'next' ? nextWeekStart(new Date()) : toISODate(startOfISOWeek(new Date()));
  const range = weekRangeLabel(weekStart);

  const title = existing
    ? target === 'next'
      ? 'Ajusta la próxima semana'
      : 'Ajusta tu contrato'
    : target === 'next'
      ? 'Prepara la próxima semana'
      : 'Firma la semana';
  const cta = existing
    ? 'Guardar cambios'
    : target === 'next'
      ? 'Dejar preparada la próxima semana'
      : 'Firmar contrato';

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function add() {
    if (drafts.length >= MAX_COMMITMENTS) return;
    setDrafts((prev) => [...prev, emptyDraft()]);
  }
  function remove(i: number) {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function startFromScratch() {
    setDrafts([emptyDraft()]);
    setFromScratch(true);
  }

  function submit() {
    const cleaned = draftsToCommitments(drafts);
    if (cleaned.length === 0) return;
    saveContract(cleaned, target);
    onSaved();
  }

  const valid = drafts.every(
    (d) => d.name.trim() && d.normal.trim() && d.minimum.trim()
  );

  return (
    <section className="t-contract">
      <header className="t-contract__head">
        <p className="eyebrow eyebrow--gold">
          {target === 'next' ? 'Contrato · próxima semana' : 'Contrato semanal'}
        </p>
        <h1 className="display t-contract__title">{title}</h1>
        <p className="t-contract__range">{range}</p>
        <p className="t-contract__help">
          Elige entre 1 y 3 compromisos. Para cada uno, deja claro qué es la versión
          normal y qué es la versión mínima cuando el día se tuerce.
        </p>
      </header>

      {prefill && !fromScratch && (
        <div className="t-contract__prefill" role="note">
          <p>
            Basado en tu contrato de la semana del {weekRangeLabel(prefill.startDate)}. Ajusta lo
            que quieras y firma.
          </p>
          <button type="button" className="t-contract__scratch" onClick={startFromScratch}>
            Empezar de cero
          </button>
        </div>
      )}

      {target === 'next' && (
        <p className="t-contract__note">
          Se activará el lunes. Hasta entonces sigue contando tu contrato actual.
        </p>
      )}

      <div className="t-contract__list">
        {drafts.map((d, i) => (
          <fieldset className="t-cmt" key={i}>
            <legend className="t-cmt__legend">
              <span className="t-cmt__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="eyebrow">Compromiso</span>
              {drafts.length > 1 && (
                <button
                  type="button"
                  className="t-cmt__remove"
                  aria-label={`Quitar compromiso ${i + 1}`}
                  onClick={() => remove(i)}
                >
                  Quitar
                </button>
              )}
            </legend>

            <div className="t-cmt__grid">
              <TextField
                id={`cname-${i}`}
                label="Nombre"
                value={d.name}
                placeholder="ej. Moverme"
                onChange={(e) => update(i, { name: e.target.value })}
                maxLength={40}
              />
              <TextField
                id={`cnorm-${i}`}
                label="Versión normal"
                value={d.normal}
                placeholder="ej. 45 min de entrenamiento"
                onChange={(e) => update(i, { normal: e.target.value })}
                maxLength={120}
              />
              <TextField
                id={`cmin-${i}`}
                label="Versión mínima"
                value={d.minimum}
                placeholder="ej. 10 flexiones y un paseo"
                hint="Debe ser tan pequeña que no puedas justificar saltártela."
                onChange={(e) => update(i, { minimum: e.target.value })}
                maxLength={120}
              />
              <TextAreaField
                id={`creason-${i}`}
                label="Motivo · identidad"
                value={d.reason}
                placeholder="ej. cuido mi cuerpo porque respeto al que despertará mañana"
                onChange={(e) => update(i, { reason: e.target.value })}
                maxLength={160}
              />
            </div>
          </fieldset>
        ))}

        {drafts.length < MAX_COMMITMENTS && (
          <button className="t-contract__add" onClick={add}>
            + Añadir otro compromiso ({MAX_COMMITMENTS - drafts.length} restantes)
          </button>
        )}
      </div>

      <div className="t-contract__actions">
        <Button full onClick={submit} disabled={!valid}>
          {cta}
        </Button>
      </div>

      <style>{css}</style>
    </section>
  );
}

const css = `
.t-contract { display: flex; flex-direction: column; gap: 24px; padding-top: 4px; }
.t-contract__head { display: flex; flex-direction: column; gap: 8px; }
.t-contract__title { font-size: clamp(30px, 6vw, 40px); }
.t-contract__range {
  color: var(--gold); font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase;
}
.t-contract__help { color: var(--fg-2); font-size: 14px; line-height: 1.55; }

.t-contract__prefill {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px;
  padding: 12px 14px; border-left: 2px solid var(--gold); background: var(--gold-dim);
  border-radius: 0 12px 12px 0; color: var(--fg-1); font-size: 14px; line-height: 1.5;
}
.t-contract__scratch {
  color: var(--fg-2); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;
  min-height: 44px; padding: 0 4px; transition: color .2s;
}
.t-contract__scratch:hover { color: var(--gold); }
.t-contract__note { color: var(--fg-2); font-size: 13px; line-height: 1.5; }

.t-contract__list { display: flex; flex-direction: column; gap: 16px; }

.t-cmt {
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
  padding: 20px;
  background: linear-gradient(180deg, #16171B, #131317);
  display: flex; flex-direction: column; gap: 16px;
}
.t-cmt__legend {
  display: flex; align-items: center; gap: 12px; padding: 0;
}
.t-cmt__num {
  font-family: var(--font-display); font-variation-settings: 'opsz' 144;
  font-size: 22px; color: var(--gold); min-width: 32px;
}
.t-cmt__remove {
  margin-left: auto; color: var(--fg-2); font-size: 11px;
  letter-spacing: 0.2em; text-transform: uppercase;
  min-height: 44px; padding: 0 8px;
  transition: color .2s;
}
.t-cmt__remove:hover { color: var(--danger); }
.t-cmt__grid { display: flex; flex-direction: column; gap: 14px; }

.t-contract__add {
  padding: 14px; border-radius: 14px;
  border: 1px dashed var(--line-strong);
  color: var(--fg-2); font-size: 13px; letter-spacing: 0.05em;
  transition: color .2s, border-color .2s, background .2s;
}
.t-contract__add:hover { color: var(--gold); border-color: var(--gold); background: var(--gold-dim); }

.t-contract__actions { display: flex; flex-direction: column; gap: 10px; padding-top: 8px; }
`;
