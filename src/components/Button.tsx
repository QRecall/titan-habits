import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  full?: boolean;
};

export function Button({ variant = 'primary', full, children, className, style, ...rest }: Props) {
  return (
    <button
      className={`t-btn t-btn--${variant}${full ? ' t-btn--full' : ''}${className ? ' ' + className : ''}`}
      style={style}
      {...rest}
    >
      {children}
      <style>{css}</style>
    </button>
  );
}

const css = `
.t-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 18px; border-radius: 12px;
  font-family: var(--font-body);
  font-weight: 600; font-size: 14px; letter-spacing: 0.02em;
  transition: transform .15s var(--ease-out), background .2s var(--ease-out), border-color .2s;
  border: 1px solid transparent;
  min-height: 44px;
  user-select: none;
}
.t-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.t-btn:not(:disabled):hover { transform: translateY(-1px); }
.t-btn:not(:disabled):active { transform: translateY(0); }
.t-btn--full { width: 100%; }

.t-btn--primary {
  background: linear-gradient(180deg, var(--gold-bright), var(--gold));
  color: #1a1305;
  box-shadow: 0 8px 24px -12px var(--gold-glow), 0 1px 0 rgba(255,255,255,0.15) inset;
}
.t-btn--primary:hover { filter: brightness(1.05); }

.t-btn--ghost {
  background: transparent;
  border-color: var(--line-strong);
  color: var(--fg-1);
}
.t-btn--ghost:hover { border-color: var(--gold); color: var(--gold); }

.t-btn--quiet {
  background: var(--bg-2);
  color: var(--fg-2);
  border-color: var(--line);
}
.t-btn--quiet:hover { color: var(--fg-1); border-color: var(--line-strong); }

.t-btn--danger {
  background: transparent;
  border-color: rgba(194,75,69,0.3);
  color: var(--danger);
}
.t-btn--danger:hover { background: rgba(194,75,69,0.08); border-color: var(--danger); }
`;
