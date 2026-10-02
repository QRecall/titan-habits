import { useLayoutEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { FACT_MAX } from '../types';

/**
 * Hecho relevante del día: una línea libre que se guarda al escribir.
 * Es un textarea sólo para que el texto largo se lea entero; Enter no
 * inserta salto de línea sino que termina la edición.
 */
export function DayFact() {
  const { todayEntry, setFact } = useStore();
  const value = todayEntry?.fact ?? '';
  const ref = useRef<HTMLTextAreaElement>(null);

  // Altura según el contenido (sin barra de desplazamiento).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`; // + borde
  }, [value]);

  return (
    <div className="t-fact">
      <label htmlFor="day-fact" className="eyebrow">Hecho relevante del día</label>
      <textarea
        ref={ref}
        id="day-fact"
        className="t-fact__input"
        rows={1}
        value={value}
        maxLength={FACT_MAX}
        placeholder="Qué ha pasado hoy, en una línea"
        enterKeyHint="done"
        autoComplete="off"
        onChange={(e) => setFact(e.target.value)}
        onBlur={() => setFact(value.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-describedby="day-fact-count"
      />
      <span id="day-fact-count" className={`t-fact__count${value.length >= FACT_MAX ? ' is-full' : ''}`}>
        {value.length}/{FACT_MAX}
      </span>
      <style>{css}</style>
    </div>
  );
}

const css = `
.t-fact {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 18px;
  background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius-l);
}
.t-fact__input {
  background: transparent; border: none; border-bottom: 1px solid var(--line-strong); border-radius: 0;
  color: var(--fg-1); font-family: var(--font-body);
  font-size: 16px; /* < 16px hace zoom en iOS al tocar el campo */
  line-height: 1.4; padding: 10px 0; min-height: 44px; width: 100%;
  resize: none; overflow: hidden;
}
.t-fact__input::placeholder { color: var(--fg-3); }
.t-fact__input:focus { outline: none; border-bottom-color: var(--gold); }
.t-fact__count { align-self: flex-end; font-size: 11px; color: var(--fg-3); font-variant-numeric: tabular-nums; }
.t-fact__count.is-full { color: var(--gold); }
`;
