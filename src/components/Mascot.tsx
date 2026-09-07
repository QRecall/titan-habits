import type { Mood } from '../state/mood';

type Props = { mood: Mood; size?: number };

const LABEL: Record<Mood, string> = {
  espera: 'Titán espera tu primera marca del día',
  enmarcha: 'Titán ve que ya has empezado',
  firme: 'Titán está orgulloso: contrato honrado',
  vivo: 'Titán sigue vivo gracias al mínimo',
  reconducir: 'Titán te anima a rescatar el día con el mínimo',
};

/**
 * Titán: una piedra redondeada con un filete dorado en la frente.
 * Cambia la cara según el estado del día. Sin dependencias, sólo SVG.
 */
export function Mascot({ mood, size = 84 }: Props) {
  return (
    <span className={`t-mascot t-mascot--${mood}`} role="img" aria-label={LABEL[mood]} style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="mascotBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A2B33" />
            <stop offset="100%" stopColor="#16171B" />
          </linearGradient>
          <linearGradient id="mascotGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EFC66A" />
            <stop offset="100%" stopColor="#D4A64A" />
          </linearGradient>
        </defs>

        {/* resplandor (sólo firme / vivo) */}
        <circle className="t-mascot__glow" cx="48" cy="52" r="40" fill="#D4A64A" opacity="0" />

        {/* cuerpo */}
        <path
          d="M48 14c20 0 34 14 34 34 0 22-14 36-34 36S14 70 14 48c0-20 14-34 34-34z"
          fill="url(#mascotBody)"
          stroke="rgba(245,241,232,0.10)"
          strokeWidth="1.5"
        />

        {/* filete dorado en la frente */}
        <rect className="t-mascot__filet" x="45" y="18" width="6" height="16" rx="3" fill="url(#mascotGold)" />

        {/* cejas */}
        <g className="t-mascot__brows" stroke="#A9A69C" strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path className="t-mascot__brow-l" d="M31 41h10" />
          <path className="t-mascot__brow-r" d="M55 41h10" />
        </g>

        {/* ojos */}
        <g className="t-mascot__eyes" fill="#F5F1E8">
          <circle cx="36" cy="50" r="3.4" />
          <circle cx="60" cy="50" r="3.4" />
          <circle className="t-mascot__spark" cx="37.4" cy="48.6" r="1" fill="#0B0B0D" />
          <circle className="t-mascot__spark" cx="61.4" cy="48.6" r="1" fill="#0B0B0D" />
        </g>

        {/* bocas: una por estado, se muestra sólo la activa */}
        <g fill="none" stroke="#F5F1E8" strokeWidth="2.4" strokeLinecap="round">
          <path className="t-mascot__mouth t-mascot__mouth--espera" d="M41 65h14" />
          <path className="t-mascot__mouth t-mascot__mouth--enmarcha" d="M40 64q8 5 16 0" />
          <path className="t-mascot__mouth t-mascot__mouth--firme" d="M37 62q11 11 22 0" />
          <path className="t-mascot__mouth t-mascot__mouth--vivo" d="M40 64q8 6 16 0" />
          <path className="t-mascot__mouth t-mascot__mouth--reconducir" d="M40 67q8 -5 16 0" />
        </g>

        {/* llama del mínimo (vivo) */}
        <path
          className="t-mascot__flame"
          d="M76 30c0-6 4-8 4-12 3 3 6 7 6 12 0 5-3 8-5 8s-5-3-5-8z"
          fill="url(#mascotGold)"
          opacity="0"
        />
      </svg>
      <style>{css}</style>
    </span>
  );
}

const css = `
.t-mascot { display: inline-block; flex-shrink: 0; }
.t-mascot svg { display: block; overflow: visible; }
.t-mascot__mouth { opacity: 0; }
.t-mascot--espera .t-mascot__mouth--espera,
.t-mascot--enmarcha .t-mascot__mouth--enmarcha,
.t-mascot--firme .t-mascot__mouth--firme,
.t-mascot--vivo .t-mascot__mouth--vivo,
.t-mascot--reconducir .t-mascot__mouth--reconducir { opacity: 1; }

.t-mascot--firme .t-mascot__glow { opacity: 0.18; }
.t-mascot--vivo .t-mascot__glow { opacity: 0.10; }
.t-mascot--vivo .t-mascot__flame { opacity: 1; }
.t-mascot--firme .t-mascot__filet { filter: drop-shadow(0 0 6px rgba(212,166,74,0.8)); }

.t-mascot--reconducir .t-mascot__brow-l { transform: rotate(-12deg); transform-origin: 36px 41px; }
.t-mascot--reconducir .t-mascot__brow-r { transform: rotate(12deg); transform-origin: 60px 41px; }
.t-mascot--firme .t-mascot__brows, .t-mascot--vivo .t-mascot__brows { transform: translateY(-2px); }

.t-mascot--espera .t-mascot__eyes { animation: t-blink 4s infinite; transform-origin: 48px 50px; }
@keyframes t-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  96% { transform: scaleY(0.1); }
}
.t-mascot--firme svg { animation: t-bounce 1.2s var(--ease-out) 1; }
@keyframes t-bounce {
  0% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
  60% { transform: translateY(0); }
  80% { transform: translateY(-2px); }
  100% { transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .t-mascot svg, .t-mascot__eyes { animation: none !important; }
}
`;
