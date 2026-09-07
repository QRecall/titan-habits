import type { ReactNode } from 'react';
import type { Screen } from '../types';

type Props = {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  children: ReactNode;
};

const NAV: { key: Screen; label: string; icon: ReactNode }[] = [
  { key: 'arranque', label: 'Arranque', icon: <IconArranque /> },
  { key: 'progreso', label: 'Progreso', icon: <IconProgress /> },
  { key: 'contrato', label: 'Contrato', icon: <IconContract /> },
  { key: 'revision', label: 'Revisión', icon: <IconReview /> },
];

export function Layout({ screen, onNavigate, children }: Props) {
  return (
    <div className="t-shell">
      <header className="t-topbar">
        <div className="t-brand">
          <span className="t-brand__mark" aria-hidden="true">
            <span className="t-brand__filet" />
          </span>
          <span className="t-brand__word">TITAN</span>
          <span className="t-brand__version">v0.1</span>
          <button
            type="button"
            className={`t-topbar__data${screen === 'datos' ? ' is-active' : ''}`}
            onClick={() => onNavigate('datos')}
            aria-current={screen === 'datos' ? 'page' : undefined}
          >
            Mis datos
          </button>
        </div>
      </header>

      <main className="t-main">{children}</main>

      <nav className="t-nav" aria-label="Navegación principal">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`t-nav__btn${screen === n.key ? ' is-active' : ''}`}
            onClick={() => onNavigate(n.key)}
            aria-current={screen === n.key ? 'page' : undefined}
          >
            <span className="t-nav__icon" aria-hidden="true">{n.icon}</span>
            <span className="t-nav__label">{n.label}</span>
          </button>
        ))}
      </nav>
      <style>{css}</style>
    </div>
  );
}

function IconArranque() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l6 12H6L12 3z" />
      <path d="M9 20h6" />
    </svg>
  );
}
function IconProgress() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </svg>
  );
}
function IconContract() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
    </svg>
  );
}
function IconReview() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

const css = `
.t-shell {
  position: relative; z-index: 1;
  min-height: 100dvh;
  display: flex; flex-direction: column;
  max-width: 620px;
  margin: 0 auto;
  /* barra inferior (~72px) + zona segura del iPhone + margen */
  padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px));
}

.t-topbar {
  position: sticky; top: 0; z-index: 5;
  padding: 18px 22px 14px;
  background: linear-gradient(180deg, var(--bg-0) 70%, transparent);
  backdrop-filter: blur(4px);
}
.t-brand {
  display: flex; align-items: center; gap: 14px;
}
.t-brand__mark {
  width: 8px; height: 34px; position: relative; display: inline-block;
}
.t-brand__filet {
  position: absolute; inset: 0; background: linear-gradient(180deg, var(--gold-bright), var(--gold) 60%, transparent);
  border-radius: 2px;
  box-shadow: 0 0 12px var(--gold-glow);
}
.t-brand__word {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 22px;
  letter-spacing: 0.34em;
  color: var(--fg-1);
  font-variation-settings: 'opsz' 144;
}
.t-brand__version {
  margin-left: auto;
  font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--fg-3);
  border: 1px solid var(--line-strong); border-radius: 999px;
  padding: 3px 8px;
}

.t-topbar__data {
  min-height: 44px; padding: 0 10px; margin-right: -10px;
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600;
  color: var(--fg-2); border-radius: 10px;
  transition: color .2s, background .2s;
}
.t-topbar__data:hover { color: var(--fg-1); }
.t-topbar__data.is-active { color: var(--gold); background: var(--gold-dim); }

.t-main {
  padding: 8px 22px 22px;
  flex: 1;
  animation: fade .3s var(--ease-out) both;
}

.t-nav {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0));
  background: linear-gradient(180deg, transparent, rgba(11,11,13,0.9) 30%, var(--bg-0));
  backdrop-filter: blur(10px);
  max-width: 620px; margin: 0 auto;
}
.t-nav__btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: 12px;
  color: var(--fg-3);
  transition: color .2s var(--ease-out), background .2s;
  min-height: 52px;
}
.t-nav__btn:hover { color: var(--fg-1); }
.t-nav__btn.is-active {
  color: var(--gold);
  background: linear-gradient(180deg, var(--gold-dim), transparent);
}
.t-nav__label {
  font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600;
}

@media (min-width: 640px) {
  .t-topbar { padding-top: 32px; }
  .t-main { padding: 16px 32px 40px; }
}
`;
