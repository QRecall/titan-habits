import type { FlameLevel, Mood } from '../state/mood';

type Props = { mood: Mood; level: FlameLevel; size?: number };

const LABEL: Record<Mood, string> = {
  espera: 'Titán, tu llama, espera la primera marca del día',
  enmarcha: 'Titán ve que ya has empezado',
  firme: 'Titán arde con fuerza: contrato honrado',
  vivo: 'Titán sigue viva gracias al mínimo',
  reconducir: 'Titán se encoge; rescata el día con el mínimo',
};

const LEVEL_LABEL = ['brasa', 'llama pequeña', 'llama media', 'llama grande', 'llama enorme'];

/**
 * Titán: una llama dorada con cara y bracitos, dibujada con volumen
 * (degradados radiales, brillo y sombra) en SVG. Crece con la racha y
 * cambia de cara y postura según el día. Sin dependencias.
 */
export function Mascot({ mood, level, size = 96 }: Props) {
  const scale = [0.55, 0.72, 0.86, 1, 1.12][level];
  const ember = level === 0;
  const dim = mood === 'reconducir';

  return (
    <span
      className={`t-flame t-flame--${mood} t-flame--l${level}${ember ? ' is-ember' : ''}${dim ? ' is-dim' : ''}`}
      role="img"
      aria-label={`${LABEL[mood]} · ${LEVEL_LABEL[level]}`}
      style={{ width: size, height: size * 1.15 }}
    >
      <svg viewBox="0 0 120 138" width={size} height={size * 1.15} aria-hidden="true">
        <defs>
          <radialGradient id="flOuter" cx="45%" cy="62%" r="60%">
            <stop offset="0%" stopColor="#F3CB74" />
            <stop offset="55%" stopColor="#D4A64A" />
            <stop offset="100%" stopColor="#9C5F1E" />
          </radialGradient>
          <radialGradient id="flInner" cx="48%" cy="70%" r="55%">
            <stop offset="0%" stopColor="#FFF6D6" />
            <stop offset="60%" stopColor="#F5D48A" />
            <stop offset="100%" stopColor="#E0AE4E" />
          </radialGradient>
          <radialGradient id="flCore" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FFF0B8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="flEmber" cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor="#C98A3A" />
            <stop offset="70%" stopColor="#7A4A1E" />
            <stop offset="100%" stopColor="#4A2C12" />
          </radialGradient>
          <radialGradient id="flShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="flGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#EFC66A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#EFC66A" stopOpacity="0" />
          </radialGradient>
          <filter id="flBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* sombra en el suelo */}
        <ellipse className="t-flame__shadow" cx="60" cy="126" rx="30" ry="7" fill="url(#flShadow)" />

        <g className="t-flame__all" style={{ transform: `translate(60px, 122px) scale(${scale}) translate(-60px, -122px)` }}>
          {/* resplandor */}
          <ellipse className="t-flame__glow" cx="60" cy="78" rx="52" ry="58" fill="url(#flGlow)" />

          {/* cuerpo exterior */}
          <path
            className="t-flame__outer"
            d="M60 12c4 14 16 20 24 34 9 15 10 30 2 46-7 14-18 22-26 24-8-2-19-10-26-24-8-16-7-31 2-46 8-14 20-20 24-34z"
            fill={ember ? 'url(#flEmber)' : 'url(#flOuter)'}
          />
          {/* borde oscuro para volumen */}
          <path
            d="M60 12c4 14 16 20 24 34 9 15 10 30 2 46-7 14-18 22-26 24-8-2-19-10-26-24-8-16-7-31 2-46 8-14 20-20 24-34z"
            fill="none"
            stroke={ember ? '#3A2210' : '#8A4F16'}
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />

          {/* llama interior */}
          <path
            className="t-flame__inner"
            d="M60 40c3 9 10 13 15 22 6 10 6 20 1 30-4 8-11 13-16 15-5-2-12-7-16-15-5-10-5-20 1-30 5-9 12-13 15-22z"
            fill={ember ? '#9C5F1E' : 'url(#flInner)'}
            opacity={ember ? 0.7 : 1}
          />
          {/* núcleo caliente */}
          <ellipse className="t-flame__core" cx="60" cy="96" rx="12" ry="14" fill="url(#flCore)" opacity={ember ? 0.25 : 0.9} />
          {/* brillo especular */}
          <path d="M44 58c-4 8-5 16-3 24" stroke="#FFF6D6" strokeOpacity={ember ? 0.15 : 0.55} strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#flBlur)" />

          {/* brazos (delante del cuerpo, para que se vean al levantarlos) */}
          <g className="t-flame__arms" fill={ember ? '#8A5528' : '#E0B255'} stroke={ember ? '#4A2C12' : '#9C5F1E'} strokeWidth="1.2">
            <path className="t-flame__arm t-flame__arm--l" d="M38 90c-9 3-15 9-13 15 2 4 8 3 12-3l6-9z" />
            <path className="t-flame__arm t-flame__arm--r" d="M82 90c9 3 15 9 13 15-2 4-8 3-12-3l-6-9z" />
          </g>

          {/* cara */}
          <g className="t-flame__face">
            <g className="t-flame__brows" stroke="#5A3410" strokeWidth="2.4" strokeLinecap="round" fill="none">
              <path className="t-flame__brow-l" d="M47 74h9" />
              <path className="t-flame__brow-r" d="M64 74h9" />
            </g>
            <g className="t-flame__eyes">
              <ellipse cx="51" cy="84" rx="3.6" ry="4.6" fill="#3A2210" />
              <ellipse cx="69" cy="84" rx="3.6" ry="4.6" fill="#3A2210" />
              <circle cx="52.4" cy="82.2" r="1.3" fill="#FFF6D6" />
              <circle cx="70.4" cy="82.2" r="1.3" fill="#FFF6D6" />
            </g>
            <g fill="none" stroke="#3A2210" strokeWidth="2.6" strokeLinecap="round">
              <path className="t-flame__mouth t-flame__mouth--espera" d="M54 98h12" />
              <path className="t-flame__mouth t-flame__mouth--enmarcha" d="M53 97q7 5 14 0" />
              <path className="t-flame__mouth t-flame__mouth--firme" d="M50 95q10 12 20 0" />
              <path className="t-flame__mouth t-flame__mouth--vivo" d="M53 97q7 6 14 0" />
              <path className="t-flame__mouth t-flame__mouth--reconducir" d="M53 101q7 -5 14 0" />
            </g>
            <path className="t-flame__cheek" d="M43 92a3 2 0 1 0 6 0a3 2 0 1 0 -6 0" fill="#E8875A" opacity="0.35" />
            <path className="t-flame__cheek" d="M71 92a3 2 0 1 0 6 0a3 2 0 1 0 -6 0" fill="#E8875A" opacity="0.35" />
          </g>

          {/* chispas (racha alta) */}
          <g className="t-flame__sparks" fill="#EFC66A">
            <circle className="t-flame__spark" cx="30" cy="40" r="2" />
            <circle className="t-flame__spark" cx="92" cy="34" r="1.6" />
            <circle className="t-flame__spark" cx="84" cy="18" r="1.4" />
            <circle className="t-flame__spark" cx="38" cy="22" r="1.2" />
          </g>
        </g>
      </svg>
      <style>{css}</style>
    </span>
  );
}

const css = `
.t-flame { display: inline-block; flex-shrink: 0; position: relative; }
.t-flame svg { display: block; overflow: visible; }
.t-flame__all { transform-box: view-box; }

.t-flame__mouth { opacity: 0; }
.t-flame--espera .t-flame__mouth--espera,
.t-flame--enmarcha .t-flame__mouth--enmarcha,
.t-flame--firme .t-flame__mouth--firme,
.t-flame--vivo .t-flame__mouth--vivo,
.t-flame--reconducir .t-flame__mouth--reconducir { opacity: 1; }

/* cejas */
.t-flame--reconducir .t-flame__brow-l { transform: rotate(-16deg); transform-origin: 51px 74px; }
.t-flame--reconducir .t-flame__brow-r { transform: rotate(16deg); transform-origin: 69px 74px; }
.t-flame--firme .t-flame__brows, .t-flame--vivo .t-flame__brows { transform: translateY(-2px); }
.is-ember .t-flame__eyes { transform: scaleY(0.6); transform-origin: 60px 84px; }

/* brazos según postura */
.t-flame__arm { transform-origin: 40px 92px; transition: transform .4s var(--ease-out); }
.t-flame__arm--r { transform-origin: 80px 92px; }
.t-flame--enmarcha .t-flame__arm--r { transform: rotate(-70deg); }
.t-flame--firme .t-flame__arm--l { transform: rotate(75deg); }
.t-flame--firme .t-flame__arm--r { transform: rotate(-75deg); }
.t-flame--vivo .t-flame__arm--l { transform: rotate(35deg); }
.t-flame--vivo .t-flame__arm--r { transform: rotate(-35deg); }
.t-flame--reconducir .t-flame__arm--l { transform: rotate(-25deg) translate(6px, -4px); }
.t-flame--reconducir .t-flame__arm--r { transform: rotate(25deg) translate(-6px, -4px); }

/* resplandor y chispas por nivel */
.t-flame__glow { opacity: 0; }
.t-flame--l2 .t-flame__glow { opacity: 0.35; }
.t-flame--l3 .t-flame__glow { opacity: 0.6; }
.t-flame--l4 .t-flame__glow { opacity: 0.85; }
.t-flame__sparks { opacity: 0; }
.t-flame--l3 .t-flame__sparks, .t-flame--l4 .t-flame__sparks { opacity: 1; }
.is-dim .t-flame__outer, .is-dim .t-flame__inner, .is-dim .t-flame__core { filter: saturate(0.6) brightness(0.85); }
.is-dim .t-flame__glow { opacity: 0; }

/* animaciones: parpadeo de llama, respiración y chispas */
.t-flame__outer { animation: t-flicker 1.7s ease-in-out infinite; transform-origin: 60px 116px; }
.t-flame__inner { animation: t-flicker 1.3s ease-in-out infinite reverse; transform-origin: 60px 107px; }
.t-flame__all { animation: t-breathe 3.2s ease-in-out infinite; }
.t-flame__spark { animation: t-spark 2.4s ease-out infinite; }
.t-flame__spark:nth-child(2) { animation-delay: .6s; }
.t-flame__spark:nth-child(3) { animation-delay: 1.2s; }
.t-flame__spark:nth-child(4) { animation-delay: 1.8s; }
.t-flame--firme .t-flame__all { animation: t-jump 1.1s var(--ease-out) 1, t-breathe 3.2s ease-in-out 1.1s infinite; }
.is-ember .t-flame__outer, .is-ember .t-flame__inner { animation-duration: 3.4s; }

@keyframes t-flicker {
  0%, 100% { transform: scale(1, 1) skewX(0deg); }
  30% { transform: scale(1.02, 1.05) skewX(-2deg); }
  60% { transform: scale(0.98, 0.97) skewX(2deg); }
}
@keyframes t-breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes t-jump {
  0% { transform: translateY(0); }
  35% { transform: translateY(-12px); }
  60% { transform: translateY(0); }
  80% { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}
@keyframes t-spark {
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(-26px); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .t-flame * { animation: none !important; }
}
`;
