type Props = {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
};

export function ProgressRing({ value, size = 128, stroke = 8, label, sub }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = circ * clamped;

  return (
    <div className="t-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-bright)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .6s var(--ease-out)' }}
        />
      </svg>
      <div className="t-ring__label">
        <span className="t-ring__value display">{label}</span>
        {sub && <span className="t-ring__sub">{sub}</span>}
      </div>
      <style>{css}</style>
    </div>
  );
}

const css = `
.t-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.t-ring__label {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px;
}
.t-ring__value { font-size: 30px; color: var(--fg-1); font-variation-settings: 'opsz' 144; }
.t-ring__sub { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--fg-3); }
`;
