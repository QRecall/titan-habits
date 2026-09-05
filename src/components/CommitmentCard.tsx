import { useState } from 'react';
import type { Commitment, CommitmentStatus, DayMark } from '../types';
import { useStore } from '../state/store';

type Props = {
  commitment: Commitment;
  mark?: DayMark;
};

export function CommitmentCard({ commitment, mark }: Props) {
  const { mark: setMark, setNote } = useStore();
  const [noteOpen, setNoteOpen] = useState(!!mark?.note);
  const [draft, setDraft] = useState(mark?.note ?? '');
  const status: CommitmentStatus = mark?.status ?? null;

  function choose(next: CommitmentStatus) {
    // Toggle: pulsar el estado activo lo limpia
    setMark(commitment.id, status === next ? null : next);
  }

  function saveNote() {
    setNote(commitment.id, draft.trim());
  }

  return (
    <article className={`t-card t-card--${status ?? 'idle'}`}>
      <header className="t-card__head">
        <div>
          <p className="eyebrow">Compromiso</p>
          <h3 className="t-card__title display">{commitment.name}</h3>
        </div>
        {status && <StatusBadge status={status} />}
      </header>

      <p className="t-card__reason">
        <span className="t-quote">“</span>
        {commitment.reason}
        <span className="t-quote">”</span>
      </p>

      <dl className="t-versions">
        <div className={`t-versions__row${status === 'normal' ? ' is-active' : ''}`}>
          <dt>Normal</dt>
          <dd>{commitment.normal}</dd>
        </div>
        <div className={`t-versions__row t-versions__row--min${status === 'minimum' ? ' is-active' : ''}`}>
          <dt>Mínimo</dt>
          <dd>{commitment.minimum}</dd>
        </div>
      </dl>

      <div className="t-actions" role="group" aria-label={`Marcar ${commitment.name}`}>
        <button
          className={`t-choice t-choice--normal${status === 'normal' ? ' is-on' : ''}`}
          onClick={() => choose('normal')}
          aria-pressed={status === 'normal'}
        >
          <Dot kind="normal" /> Normal
        </button>
        <button
          className={`t-choice t-choice--min${status === 'minimum' ? ' is-on' : ''}`}
          onClick={() => choose('minimum')}
          aria-pressed={status === 'minimum'}
        >
          <Dot kind="minimum" /> Mínimo
        </button>
        <button
          className={`t-choice t-choice--miss${status === 'missed' ? ' is-on' : ''}`}
          onClick={() => choose('missed')}
          aria-pressed={status === 'missed'}
        >
          <Dot kind="missed" /> Hoy no
        </button>
      </div>

      <div className="t-note">
        {!noteOpen && (
          <button className="t-note__toggle" onClick={() => setNoteOpen(true)}>
            + Añadir evidencia
          </button>
        )}
        {noteOpen && (
          <div className="t-note__wrap">
            <label htmlFor={`note-${commitment.id}`} className="eyebrow">Evidencia (opcional)</label>
            <textarea
              id={`note-${commitment.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Una frase, una prueba, un detalle."
              rows={2}
              className="t-note__input"
            />
          </div>
        )}
      </div>

      <style>{css}</style>
    </article>
  );
}

function StatusBadge({ status }: { status: CommitmentStatus }) {
  const map: Record<Exclude<CommitmentStatus, null>, { label: string; className: string }> = {
    normal: { label: 'Normal', className: 't-badge--normal' },
    minimum: { label: 'Mínimo · vivo', className: 't-badge--min' },
    missed: { label: 'Hoy no', className: 't-badge--miss' },
  };
  if (!status) return null;
  const info = map[status];
  return <span className={`t-badge ${info.className}`}>{info.label}</span>;
}

function Dot({ kind }: { kind: 'normal' | 'minimum' | 'missed' }) {
  return <span className={`t-dot t-dot--${kind}`} />;
}

const css = `
.t-card {
  position: relative;
  background: linear-gradient(180deg, #16171B 0%, #131317 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-l);
  padding: 22px 20px 18px;
  display: flex; flex-direction: column; gap: 14px;
  box-shadow: var(--shadow-panel);
  overflow: hidden;
  animation: rise .5s var(--ease-out) both;
}
.t-card::before {
  content: '';
  position: absolute; inset: 0 auto 0 0; width: 3px;
  background: linear-gradient(180deg, transparent, var(--gold-dim), transparent);
  opacity: 0.7;
}
.t-card--normal { border-color: color-mix(in oklab, var(--gold) 40%, var(--line)); }
.t-card--normal::before { background: linear-gradient(180deg, transparent, var(--gold), transparent); opacity: 0.9; }
.t-card--minimum { border-color: color-mix(in oklab, var(--minimum) 30%, var(--line)); }
.t-card--missed { opacity: 0.85; }

.t-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.t-card__title { font-size: 26px; margin-top: 2px; }

.t-badge {
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  padding: 6px 10px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--line-strong);
}
.t-badge--normal { color: var(--gold); border-color: var(--gold); background: var(--gold-dim); }
.t-badge--min { color: var(--minimum); border-color: color-mix(in oklab, var(--minimum) 60%, transparent); }
.t-badge--miss { color: var(--fg-2); border-color: var(--line-strong); }

.t-card__reason {
  color: var(--fg-2); font-size: 14px; line-height: 1.5;
  font-family: var(--font-display); font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 80;
}
.t-quote { color: var(--gold); font-size: 20px; vertical-align: -4px; padding: 0 2px; }

.t-versions {
  display: grid; gap: 8px; margin: 0;
  padding: 12px; border: 1px dashed var(--line-strong); border-radius: 14px;
  background: rgba(255,255,255,0.015);
}
.t-versions__row { display: grid; grid-template-columns: 82px 1fr; gap: 12px; align-items: baseline; }
.t-versions__row dt {
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--fg-3);
}
.t-versions__row dd { margin: 0; color: var(--fg-1); font-size: 14px; line-height: 1.4; }
.t-versions__row--min dt { color: var(--minimum); }
.t-versions__row.is-active dt { color: var(--gold); }
.t-versions__row.is-active dd { color: var(--fg-1); }

.t-actions {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
}
.t-choice {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--bg-2); border: 1px solid var(--line);
  padding: 12px 8px; border-radius: 12px;
  color: var(--fg-2); font-size: 13px; font-weight: 600;
  transition: all .2s var(--ease-out);
  min-height: 44px;
}
.t-choice:hover { color: var(--fg-1); border-color: var(--line-strong); }
.t-choice.is-on { color: var(--fg-1); }
.t-choice--normal.is-on { background: var(--gold-dim); border-color: var(--gold); color: var(--gold-bright); }
.t-choice--min.is-on { background: rgba(201,166,108,0.10); border-color: var(--minimum); color: var(--minimum); }
.t-choice--miss.is-on { background: rgba(255,255,255,0.02); border-color: var(--line-strong); color: var(--fg-1); }

.t-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
.t-dot--normal { background: var(--gold); box-shadow: 0 0 8px var(--gold-glow); }
.t-dot--minimum { background: var(--minimum); }
.t-dot--missed { background: var(--fg-3); }

.t-note { border-top: 1px solid var(--line); padding-top: 12px; }
.t-note__toggle {
  color: var(--fg-3); font-size: 12px; font-weight: 600; letter-spacing: 0.1em;
  transition: color .2s;
}
.t-note__toggle:hover { color: var(--gold); }
.t-note__wrap { display: flex; flex-direction: column; gap: 6px; }
.t-note__input {
  background: transparent; border: none; border-bottom: 1px solid var(--line-strong);
  color: var(--fg-1); padding: 6px 0; resize: vertical; font-family: var(--font-body); font-size: 14px;
  min-height: 36px;
}
.t-note__input:focus { outline: none; border-bottom-color: var(--gold); }
`;
