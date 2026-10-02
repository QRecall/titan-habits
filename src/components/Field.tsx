import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type BaseProps = {
  label: string;
  hint?: string;
  id: string;
};

export function TextField(
  props: BaseProps & InputHTMLAttributes<HTMLInputElement>
) {
  const { label, hint, id, ...rest } = props;
  return (
    <div className="t-field">
      <label htmlFor={id} className="t-field__label">{label}</label>
      <input id={id} className="t-field__input" {...rest} />
      {hint && <p className="t-field__hint">{hint}</p>}
      <style>{css}</style>
    </div>
  );
}

export function TextAreaField(
  props: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const { label, hint, id, ...rest } = props;
  return (
    <div className="t-field">
      <label htmlFor={id} className="t-field__label">{label}</label>
      <textarea id={id} className="t-field__input t-field__input--area" rows={3} {...rest} />
      {hint && <p className="t-field__hint">{hint}</p>}
      <style>{css}</style>
    </div>
  );
}

const css = `
.t-field { display: flex; flex-direction: column; gap: 6px; }
.t-field__label {
  font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--fg-3);
}
.t-field__input {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 14px;
  color: var(--fg-1);
  font-size: 16px; /* < 16px hace zoom en iOS al tocar el campo */
  transition: border-color .2s var(--ease-out), background .2s;
  font-family: var(--font-body);
  width: 100%;
}
.t-field__input::placeholder { color: var(--fg-3); }
.t-field__input:hover { border-color: var(--line-strong); }
.t-field__input:focus {
  outline: none;
  border-color: var(--gold);
  background: var(--bg-1);
  box-shadow: 0 0 0 4px var(--gold-dim);
}
.t-field__input--area { min-height: 84px; resize: vertical; line-height: 1.45; }
.t-field__hint { font-size: 12px; color: var(--fg-3); margin: 0; }
`;
