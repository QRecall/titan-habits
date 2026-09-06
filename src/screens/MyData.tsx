import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { useStore } from '../state/store';
import {
  backupFilename,
  createBackup,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  type Backup,
  type BackupSummary,
} from '../state/backup';
import { defaultStorage, readRaw } from '../state/storage';
import type { Screen } from '../types';

type Props = { onNavigate: (s: Screen) => void };

type Pending =
  | { kind: 'none' }
  | { kind: 'invalid'; fileName: string; error: string }
  | { kind: 'ready'; fileName: string; backup: Backup; summary: BackupSummary };

function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatExportedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
}

export function MyData({ onNavigate }: Props) {
  const { state, restore, storage } = useStore();
  const [pending, setPending] = useState<Pending>({ kind: 'none' });
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = summarizeBackup(createBackup(state));
  const origin = typeof location !== 'undefined' ? location.origin : '';

  function downloadCurrent() {
    const now = new Date();
    downloadText(backupFilename(now), serializeBackup(createBackup(state, now)));
    setNotice('Copia descargada. Guárdala en un sitio seguro.');
  }

  function downloadUnreadable() {
    if (!storage.preservedKey) return;
    const raw = readRaw(defaultStorage(), storage.preservedKey);
    if (raw === null) {
      setNotice('No se pudo leer el contenido conservado.');
      return;
    }
    downloadText(`${storage.preservedKey}.txt`, raw, 'text/plain');
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setPending({ kind: 'invalid', fileName: file.name, error: 'No se pudo leer el archivo.' });
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setPending({ kind: 'invalid', fileName: file.name, error: result.error });
    } else {
      setPending({
        kind: 'ready',
        fileName: file.name,
        backup: result.backup,
        summary: summarizeBackup(result.backup),
      });
    }
  }

  function cancel() {
    setPending({ kind: 'none' });
    if (fileRef.current) fileRef.current.value = '';
  }

  function confirmRestore() {
    if (pending.kind !== 'ready') return;
    restore(pending.backup.data);
    cancel();
    setNotice('Copia restaurada. Tus datos actuales son los de la copia.');
  }

  return (
    <section className="t-data">
      <header className="t-data__head">
        <p className="eyebrow eyebrow--gold">Mis datos</p>
        <h1 className="display t-data__title">Tus datos, en tus manos.</h1>
        <p className="t-data__lead">
          TITAN guarda todo sólo en este navegador y en esta dirección
          {origin && <> (<code className="t-data__origin">{origin}</code>)</>}. Si cambias de
          navegador, dispositivo o dirección, no verás estos datos. Descarga una copia de vez en
          cuando.
        </p>
      </header>

      {storage.loadError && (
        <div className="t-data__alert" role="alert">
          <p className="t-data__alert-title">Aviso al arrancar</p>
          <p>{storage.loadError}</p>
          {storage.preservedKey ? (
            <>
              <p>
                El contenido original se ha conservado sin cambios bajo la clave{' '}
                <code>{storage.preservedKey}</code>.{' '}
                {storage.untouched
                  ? 'Nada se sobrescribirá hasta que hagas un cambio en la app.'
                  : 'Los datos actuales ya se han guardado de nuevo; esa copia sigue conservada.'}
              </p>
              <Button variant="ghost" onClick={downloadUnreadable}>
                Descargar el contenido ilegible
              </Button>
            </>
          ) : (
            <p>No se pudo conservar una copia del contenido original.</p>
          )}
        </div>
      )}

      {storage.lastSaveFailed && (
        <div className="t-data__alert" role="alert">
          <p className="t-data__alert-title">El último guardado falló</p>
          <p>
            El navegador rechazó guardar los cambios. Descarga una copia ahora para no perderlos.
          </p>
        </div>
      )}

      <div className="t-data__panel">
        <p className="eyebrow">Descargar copia</p>
        <SummaryList summary={current} showExportedAt={false} />
        <Button full onClick={downloadCurrent}>
          Descargar copia
        </Button>
        <p className="t-data__hint">
          Archivo JSON con tu perfil, contratos, registros diarios y revisiones.
        </p>
      </div>

      <div className="t-data__panel">
        <p className="eyebrow">Restaurar copia</p>
        <p className="t-data__hint">
          Elige un archivo descargado desde TITAN. Antes de tocar nada se comprueba que sea válido y
          se te pedirá confirmación.
        </p>
        <label className="t-data__file">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="visually-hidden"
          />
          <span className="t-btn t-btn--ghost t-btn--full" aria-hidden="true">
            Elegir archivo de copia
          </span>
        </label>

        {pending.kind === 'invalid' && (
          <div className="t-data__alert" role="alert">
            <p className="t-data__alert-title">Copia no válida</p>
            <p>
              <strong>{pending.fileName}</strong>: {pending.error}
            </p>
            <p>Tus datos actuales no se han modificado.</p>
            <Button variant="quiet" onClick={cancel}>
              Cerrar
            </Button>
          </div>
        )}

        {pending.kind === 'ready' && (
          <div className="t-data__confirm" role="region" aria-label="Confirmar restauración">
            <p className="t-data__alert-title">Copia válida · {pending.fileName}</p>
            <SummaryList summary={pending.summary} />
            <p className="t-data__warning">
              Al restaurar se <strong>reemplazarán todos los datos actuales</strong> de este
              navegador por los de la copia. Esta acción no se puede deshacer, salvo que descargues
              antes la copia actual.
            </p>
            <div className="t-data__actions">
              <Button full variant="ghost" onClick={downloadCurrent}>
                Descargar primero la copia actual
              </Button>
              <Button full variant="danger" onClick={confirmRestore}>
                Restaurar y reemplazar mis datos
              </Button>
              <Button full variant="quiet" onClick={cancel}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {notice && (
        <p className="t-data__notice" role="status">
          {notice}
        </p>
      )}

      <div className="t-data__back">
        <Button variant="quiet" onClick={() => onNavigate('arranque')}>
          Volver
        </Button>
      </div>

      <style>{css}</style>
    </section>
  );
}

function SummaryList({
  summary,
  showExportedAt = true,
}: {
  summary: BackupSummary;
  showExportedAt?: boolean;
}) {
  return (
    <dl className="t-data__summary">
      <div>
        <dt>Perfil</dt>
        <dd>{summary.profileName ?? 'Sin perfil'}</dd>
      </div>
      <div>
        <dt>Contratos</dt>
        <dd>
          {summary.contracts}
          {summary.weeks.length > 0 && (
            <span className="t-data__weeks"> · {summary.weeks.join(', ')}</span>
          )}
        </dd>
      </div>
      <div>
        <dt>Días con registro</dt>
        <dd>
          {summary.days} · {summary.marks} marcas · {summary.notes} notas
        </dd>
      </div>
      <div>
        <dt>Revisiones</dt>
        <dd>{summary.reviews}</dd>
      </div>
      {showExportedAt && (
        <div>
          <dt>Exportada</dt>
          <dd>{formatExportedAt(summary.exportedAt)}</dd>
        </div>
      )}
    </dl>
  );
}

const css = `
.t-data { display: flex; flex-direction: column; gap: 22px; }
.t-data__head { display: flex; flex-direction: column; gap: 8px; }
.t-data__title { font-size: clamp(28px, 6vw, 36px); }
.t-data__lead { color: var(--fg-2); font-size: 14px; line-height: 1.55; }
.t-data__origin { font-size: 12px; color: var(--fg-1); word-break: break-all; }

.t-data__panel {
  display: flex; flex-direction: column; gap: 14px;
  padding: 18px; background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius-l);
}
.t-data__hint { color: var(--fg-2); font-size: 13px; line-height: 1.5; }

.t-data__summary { display: grid; gap: 8px; margin: 0; }
.t-data__summary > div { display: grid; grid-template-columns: 120px 1fr; gap: 10px; align-items: baseline; }
.t-data__summary dt { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-2); }
.t-data__summary dd { margin: 0; font-size: 14px; color: var(--fg-1); }
.t-data__weeks { color: var(--fg-2); }

.t-data__file { display: block; cursor: pointer; }
.t-data__file:focus-within .t-btn { outline: 2px solid var(--gold); outline-offset: 2px; }

.t-data__alert, .t-data__confirm {
  display: flex; flex-direction: column; gap: 10px;
  padding: 16px; border-radius: 14px; font-size: 14px; line-height: 1.5; color: var(--fg-1);
}
.t-data__alert { background: rgba(194,75,69,0.08); border: 1px solid rgba(194,75,69,0.4); }
.t-data__confirm { background: var(--gold-dim); border: 1px solid var(--gold); }
.t-data__alert-title { font-family: var(--font-display); font-size: 17px; }
.t-data__alert code { font-size: 12px; word-break: break-all; }
.t-data__warning { color: var(--fg-1); }
.t-data__actions { display: flex; flex-direction: column; gap: 10px; }

.t-data__notice { text-align: center; color: var(--gold); font-size: 14px; }
.t-data__back { display: flex; justify-content: center; padding-top: 6px; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
`;
