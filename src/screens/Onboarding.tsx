import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { TextField, TextAreaField } from '../components/Field';
import { useStore, uid } from '../state/store';

export function Onboarding() {
  const { setProfile, saveContract } = useStore();
  const [name, setName] = useState('');
  const [identity, setIdentity] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !identity.trim()) return;
    setProfile({
      name: name.trim(),
      identity: identity.trim(),
      onboardedAt: new Date().toISOString(),
    });
    // El Shell detecta que falta contrato para esta semana y navega a Contrato.
  }

  function loadDemo() {
    setProfile({
      name: name.trim() || 'Explorador',
      identity: identity.trim() || 'alguien que construye lo suyo, un ladrillo al día',
      onboardedAt: new Date().toISOString(),
    });
    saveContract([
      {
        id: uid(),
        name: 'Escribir',
        normal: '30 min sin distracciones al levantarme',
        minimum: '3 frases en el cuaderno',
        reason: 'porque escribo, luego soy escritor',
      },
      {
        id: uid(),
        name: 'Moverme',
        normal: '45 min de entrenamiento',
        minimum: '10 flexiones y un paseo',
        reason: 'mi cuerpo es la primera herramienta',
      },
      {
        id: uid(),
        name: 'Leer',
        normal: '20 páginas antes de dormir',
        minimum: '1 página, aunque sea de pie',
        reason: 'leo lo que quiero llegar a pensar',
      },
    ]);
  }

  return (
    <div className="t-onb">
      <div className="t-onb__wordmark">
        <span className="t-onb__filet" />
        <span className="t-onb__word">TITAN</span>
      </div>

      <form className="t-onb__panel" onSubmit={submit}>
        <p className="eyebrow eyebrow--gold">Paso 1 · Identidad</p>
        <h1 className="display t-onb__title">
          Pocos compromisos.<br />
          <span className="t-onb__title--gold">Siempre honrados.</span>
        </h1>
        <p className="t-onb__lead">
          No vas a rellenar una lista de veinte hábitos. Vas a firmar un contrato
          corto contigo y a cumplirlo, incluso en los días duros.
        </p>

        <div className="t-onb__fields">
          <TextField
            id="name"
            label="Tu nombre"
            placeholder="Cómo te llamas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            maxLength={40}
            required
          />
          <TextAreaField
            id="identity"
            label="Me estoy convirtiendo en alguien que…"
            placeholder="ej. cuida su cuerpo y respeta a quien despertará mañana"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            maxLength={140}
            required
          />
          <p className="t-onb__hint">
            Escríbelo en presente. La identidad se construye actuando como quien
            quieres ser, no esperando a serlo.
          </p>
        </div>

        <div className="t-onb__actions">
          <Button type="submit" full disabled={!name.trim() || !identity.trim()}>
            Continuar al contrato
          </Button>
          <button type="button" className="t-onb__demo" onClick={loadDemo}>
            O cargar datos de ejemplo para explorar
          </button>
        </div>
      </form>

      <style>{css}</style>
    </div>
  );
}

const css = `
.t-onb {
  min-height: 100dvh;
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 22px 60px;
  max-width: 560px; margin: 0 auto;
  animation: fade .5s var(--ease-out);
  position: relative; z-index: 1;
}
.t-onb__wordmark {
  display: flex; align-items: center; gap: 14px; margin-bottom: 48px;
}
.t-onb__filet {
  width: 6px; height: 30px;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold));
  border-radius: 2px; box-shadow: 0 0 14px var(--gold-glow);
}
.t-onb__word {
  font-family: var(--font-display); font-size: 22px;
  font-weight: 600; letter-spacing: 0.36em; color: var(--fg-1);
}
.t-onb__panel {
  width: 100%;
  display: flex; flex-direction: column; gap: 24px;
  animation: rise .5s var(--ease-out);
}
.t-onb__title {
  font-size: clamp(38px, 8vw, 54px);
  line-height: 1.02;
  letter-spacing: -0.015em;
}
.t-onb__title--gold { color: var(--gold); font-style: italic; }
.t-onb__lead {
  color: var(--fg-2); font-size: 15px; line-height: 1.6;
  max-width: 42ch;
}
.t-onb__fields { display: flex; flex-direction: column; gap: 18px; margin-top: 4px; }
.t-onb__hint {
  color: var(--fg-3); font-size: 13px; line-height: 1.55;
  font-family: var(--font-display); font-style: italic;
  font-variation-settings: 'opsz' 144, 'SOFT' 100;
  padding: 12px 14px; border-left: 2px solid var(--gold); background: var(--gold-dim);
  border-radius: 0 10px 10px 0;
}
.t-onb__actions { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.t-onb__demo {
  color: var(--fg-3); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 8px; transition: color .2s;
}
.t-onb__demo:hover { color: var(--gold); }
`;
