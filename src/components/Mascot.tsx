import type { FlameLevel, Heat, Mood } from '../state/mood';

type Props = { mood: Mood; level: FlameLevel; heat: Heat; size?: number };

const LABEL: Record<Mood, string> = {
  espera: 'Titán, tu llama, espera la primera marca del día',
  enmarcha: 'Titán ve que ya has empezado',
  firme: 'Titán arde con fuerza: contrato honrado',
  vivo: 'Titán sigue viva gracias al mínimo',
  reconducir: 'Titán se encoge; rescata el día con el mínimo',
};

const LEVEL_LABEL = ['brasa', 'llama pequeña', 'llama media', 'llama grande', 'llama enorme'];
const HEAT_LABEL: Record<Heat, string> = { amarillo: 'amarilla', rojo: 'roja', azul: 'azul' };

type Palette = {
  outer: [string, string, string];
  inner: [string, string, string];
  core: string;
  glow: string;
  rim: string;
  arm: string;
  armStroke: string;
  face: string;
  glint: string;
  cheek: string;
};

/* Como un fuego que se calienta: amarillo → rojo → azul. */
const PALETTE: Record<Heat, Palette> = {
  amarillo: {
    outer: ['#FFE38F', '#F3C044', '#B86F12'],
    inner: ['#FFFBE6', '#FFE9A6', '#F0C25A'],
    core: '#FFFFFF',
    glow: '#FFD56A',
    rim: '#9A5E10',
    arm: '#F2C24F',
    armStroke: '#A56A12',
    face: '#3A2210',
    glint: '#FFF6D6',
    cheek: '#E8875A',
  },
  rojo: {
    outer: ['#FFB067', '#F1552E', '#7E140C'],
    inner: ['#FFE6C2', '#FFB56A', '#F07A36'],
    core: '#FFF4E3',
    glow: '#FF6A3A',
    rim: '#6A120A',
    arm: '#F2713C',
    armStroke: '#7E140C',
    face: '#3A1008',
    glint: '#FFEEDD',
    cheek: '#FFD1A6',
  },
  azul: {
    outer: ['#B9E4FF', '#3F8CFF', '#163A94'],
    inner: ['#F4FBFF', '#C4E8FF', '#72B7FF'],
    core: '#FFFFFF',
    glow: '#5FAAFF',
    rim: '#122F78',
    arm: '#4F9BFF',
    armStroke: '#163A94',
    face: '#0D1F4A',
    glint: '#F4FBFF',
    cheek: '#9CCBFF',
  },
};

const EMBER: Palette = {
  outer: ['#C98A3A', '#7A4A1E', '#4A2C12'],
  inner: ['#B07A3C', '#8A5528', '#6A3F1C'],
  core: '#D9A05A',
  glow: '#C98A3A',
  rim: '#3A2210',
  arm: '#8A5528',
  armStroke: '#4A2C12',
  face: '#2A1608',
  glint: '#E8C9A0',
  cheek: '#B0663A',
};

/**
 * Titán: una llama gordita con cara y bracitos, dibujada con volumen
 * (degradados radiales, brillo y sombra) en SVG. Crece con la racha,
 * cambia de color según lo hecho hoy y de cara y postura según el día.
 */
export function Mascot({ mood, level, heat, size = 120 }: Props) {
  const scale = [0.55, 0.72, 0.86, 1, 1.12][level];
  const ember = level === 0;
  const dim = mood === 'reconducir';
  const p = ember ? EMBER : PALETTE[heat];
  const id = ember ? 'brasa' : heat;

  return (
    <span
      className={`t-flame t-flame--${mood} t-flame--l${level} t-flame--${id}${ember ? ' is-ember' : ''}${dim ? ' is-dim' : ''}`}
      role="img"
      aria-label={`${LABEL[mood]} · ${LEVEL_LABEL[level]}${ember ? '' : `, ${HEAT_LABEL[heat]}`}`}
      style={{ width: size, height: size * 1.15 }}
    >
      <svg viewBox="0 0 120 138" width={size} height={size * 1.15} aria-hidden="true">
        <defs>
          <radialGradient id={`flOuter-${id}`} cx="45%" cy="62%" r="60%">
            <stop offset="0%" stopColor={p.outer[0]} />
            <stop offset="55%" stopColor={p.outer[1]} />
            <stop offset="100%" stopColor={p.outer[2]} />
          </radialGradient>
          <radialGradient id={`flInner-${id}`} cx="48%" cy="70%" r="55%">
            <stop offset="0%" stopColor={p.inner[0]} />
            <stop offset="60%" stopColor={p.inner[1]} />
            <stop offset="100%" stopColor={p.inner[2]} />
          </radialGradient>
          <radialGradient id={`flCore-${id}`} cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor={p.core} />
            <stop offset="100%" stopColor={p.core} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`flGlow-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.glow} stopOpacity="0.6" />
            <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="flShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <filter id="flBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* sombra en el suelo */}
        <ellipse className="t-flame__shadow" cx="60" cy="127" rx="34" ry="7" fill="url(#flShadow)" />

        <g className="t-flame__all" style={{ transform: `translate(60px, 122px) scale(${scale}) translate(-60px, -122px)` }}>
          {/* resplandor */}
          <ellipse className="t-flame__glow" cx="60" cy="80" rx="58" ry="60" fill={`url(#flGlow-${id})`} />

          {/* cuerpo exterior, gordito */}
          <path
            className="t-flame__outer"
            d="M60 10c5 15 20 21 29 36 11 17 11 35 1 51-8 15-21 24-30 27-9-3-22-12-30-27-10-16-10-34 1-51 9-15 24-21 29-36z"
            fill={`url(#flOuter-${id})`}
          />
          {/* borde oscuro para volumen */}
          <path
            d="M60 10c5 15 20 21 29 36 11 17 11 35 1 51-8 15-21 24-30 27-9-3-22-12-30-27-10-16-10-34 1-51 9-15 24-21 29-36z"
            fill="none"
            stroke={p.rim}
            strokeOpacity="0.6"
            strokeWidth="1.6"
          />

          {/* llama interior */}
          <path
            className="t-flame__inner"
            d="M60 42c3 9 12 13 18 22 8 11 8 23 1 33-5 8-13 13-19 15-6-2-14-7-19-15-7-10-7-22 1-33 6-9 15-13 18-22z"
            fill={`url(#flInner-${id})`}
            opacity={ember ? 0.7 : 1}
          />
          {/* núcleo caliente */}
          <ellipse className="t-flame__core" cx="60" cy="98" rx="13" ry="15" fill={`url(#flCore-${id})`} opacity={ember ? 0.25 : 0.9} />
          {/* brillo especular */}
          <path d="M41 56c-5 9-6 18-4 27" stroke={p.glint} strokeOpacity={ember ? 0.15 : 0.6} strokeWidth="3.2" strokeLinecap="round" fill="none" filter="url(#flBlur)" />

          {/* brazos (delante del cuerpo, para que se vean al levantarlos) */}
          <g className="t-flame__arms" fill={p.arm} stroke={p.armStroke} strokeWidth="1.2">
            <path className="t-flame__arm t-flame__arm--l" d="M33 92c-10 3-16 9-14 15 2 4 8 3 13-3l6-9z" />
            <path className="t-flame__arm t-flame__arm--r" d="M87 92c10 3 16 9 14 15-2 4-8 3-13-3l-6-9z" />
          </g>

          {/* cara */}
          <g className="t-flame__face">
            <g className="t-flame__brows" stroke={p.face} strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" fill="none">
              <path className="t-flame__brow-l" d="M46 74h9" />
              <path className="t-flame__brow-r" d="M65 74h9" />
            </g>
            <g className="t-flame__eyes">
              <ellipse cx="50" cy="85" rx="3.8" ry="4.8" fill={p.face} />
              <ellipse cx="70" cy="85" rx="3.8" ry="4.8" fill={p.face} />
              <circle cx="51.4" cy="83.2" r="1.3" fill={p.glint} />
              <circle cx="71.4" cy="83.2" r="1.3" fill={p.glint} />
            </g>
            <g fill="none" stroke={p.face} strokeWidth="2.6" strokeLinecap="round">
              <path className="t-flame__mouth t-flame__mouth--espera" d="M53 99h14" />
              <path className="t-flame__mouth t-flame__mouth--enmarcha" d="M52 98q8 5 16 0" />
              <path className="t-flame__mouth t-flame__mouth--firme" d="M48 96q12 13 24 0" />
              <path className="t-flame__mouth t-flame__mouth--vivo" d="M52 98q8 6 16 0" />
              <path className="t-flame__mouth t-flame__mouth--reconducir" d="M52 102q8 -5 16 0" />
            </g>
            <ellipse cx="42" cy="93" rx="3.5" ry="2" fill={p.cheek} opacity="0.4" />
            <ellipse cx="78" cy="93" rx="3.5" ry="2" fill={p.cheek} opacity="0.4" />
          </g>

          {/* chispas (racha alta) */}
          <g className="t-flame__sparks" fill={p.outer[0]}>
            <circle className="t-flame__spark" cx="26" cy="40" r="2" />
            <circle className="t-flame__spark" cx="96" cy="34" r="1.6" />
            <circle className="t-flame__spark" cx="86" cy="16" r="1.4" />
            <circle className="t-flame__spark" cx="34" cy="20" r="1.2" />
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
.t-flame--reconducir .t-flame__brow-l { transform: rotate(-16deg); transform-origin: 50px 74px; }
.t-flame--reconducir .t-flame__brow-r { transform: rotate(16deg); transform-origin: 70px 74px; }
.t-flame--firme .t-flame__brows, .t-flame--vivo .t-flame__brows { transform: translateY(-2px); }
.is-ember .t-flame__eyes { transform: scaleY(0.6); transform-origin: 60px 85px; }

/* brazos según postura */
.t-flame__arm { transform-origin: 35px 94px; transition: transform .4s var(--ease-out); }
.t-flame__arm--r { transform-origin: 85px 94px; }
.t-flame--enmarcha .t-flame__arm--r { transform: rotate(-70deg); }
.t-flame--firme .t-flame__arm--l { transform: rotate(75deg); }
.t-flame--firme .t-flame__arm--r { transform: rotate(-75deg); }
.t-flame--vivo .t-flame__arm--l { transform: rotate(35deg); }
.t-flame--vivo .t-flame__arm--r { transform: rotate(-35deg); }
.t-flame--reconducir .t-flame__arm--l { transform: rotate(-25deg) translate(6px, -4px); }
.t-flame--reconducir .t-flame__arm--r { transform: rotate(25deg) translate(-6px, -4px); }

/* resplandor y chispas por nivel (el azul brilla más: es el fuego más potente) */
.t-flame__glow { opacity: 0.25; }
.t-flame--l2 .t-flame__glow { opacity: 0.45; }
.t-flame--l3 .t-flame__glow { opacity: 0.65; }
.t-flame--l4 .t-flame__glow { opacity: 0.9; }
.t-flame--azul .t-flame__glow { opacity: 0.9; }
.t-flame__sparks { opacity: 0; }
.t-flame--l3 .t-flame__sparks, .t-flame--l4 .t-flame__sparks, .t-flame--azul .t-flame__sparks { opacity: 1; }
.is-dim .t-flame__outer, .is-dim .t-flame__inner, .is-dim .t-flame__core { filter: saturate(0.6) brightness(0.85); }
.is-dim .t-flame__glow { opacity: 0; }
.is-ember .t-flame__glow { opacity: 0.12; }

/* animaciones: parpadeo de llama, respiración y chispas */
.t-flame__outer { animation: t-flicker 1.7s ease-in-out infinite; transform-origin: 60px 118px; }
.t-flame__inner { animation: t-flicker 1.3s ease-in-out infinite reverse; transform-origin: 60px 110px; }
.t-flame--azul .t-flame__outer { animation-duration: 1.1s; }
.t-flame--azul .t-flame__inner { animation-duration: 0.9s; }
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
