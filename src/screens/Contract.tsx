import { useState } from 'react';
import { Button } from '../components/Button';
import { TextField, TextAreaField } from '../components/Field';
import { useStore, uid } from '../state/store';
import { currentWeekKey, startOfISOWeek, toISODate, weekRangeLabel } from '../state/date';
import type { Commitment } from '../types';

type Props = { onSaved: () => void };

type Draft = Omit<Commitment, 'id'> & { id?: string };

function emptyDraft(): Draft {
  return { name: '', normal: '', minimum: '', reason: '' };
}

function toDrafts(list: Commitment[]): Draft[] {
  return list.length === 0 ? [emptyDraft()] : list.map((c) => ({ ...c }));
}

export function Contract({ onSaved }: Props) {
  const { activeContract, saveContract } = useStore();
  const currentIsThisWeek = activeContract?.weekKey === currentWeekKey();
  const initial = currentIsThisWeek ? activeContract!.commitments : [];
  const [drafts, setDrafts] = useState<Draft[]>(toDrafts(initial));

  const start = startOfISOWeek(new Date());
  const range = weekRangeLabel(toISODate(start));

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function add() {
    if (drafts.length >= 3) return;
    setDrafts((prev) => [...prev, emptyDraft()]);
  }
  function remove(i: number) {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function submit() {
    const cleaned: Commitment[] = drafts
      .filter((d) => d.name.trim() && d.normal.trim() && d.minimum.trim())
      .slice(0, 3)
      .map((d) => ({
        id: d.id ?? uid(),
        name: d.name.trim(),
        normal: d.normal.trim(),
        minimum: d.minimum.trim(),
        reason: d.reason.trim(),
      }));
    if (cleaned.length === 0) return;
    saveContract(cleaned);
    onSaved();
  }

  const valid = drafts.every(
    (d) => d.name.trim() && d.normal.trim() && d.minimum.trim()
  );

  return (
    <section className="t-contract">
      <header className="t-contract__head">
        <p className="eyebrow eyebrow--gold">Contrato semanal</p>
        <h1 className="display t-contract__title">
          {currentIsThisWeek ? 'Ajusta tu contrato' : 'Firma la semana'}
        </h1>
        <p className="t-contract__range">{range}</p>
        <p className="t-contract__help">
          Elige entre 1 y 3 compromisos. Para cada uno, deja claro qué es la versión
          normal y qué es la versión mínima cuando el día se tuerce.
        </p>
      </header>

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

        {drafts.length < 3 && (
          <button className="t-contract__add" onClick={add}>
            + Añadir otro compromiso ({3 - drafts.length} restantes)
          </button>
        )}
      </div>

      <div className="t-contract__actions">
        <Button full onClick={submit} disabled={!valid}>
          {currentIsThisWeek ? 'Guardar cambios' : 'Firmar contrato'}
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
  margin-left: auto; color: var(--fg-3); font-size: 11px;
  letter-spacing: 0.2em; text-transform: uppercase;
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
