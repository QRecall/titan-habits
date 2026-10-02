/* Escrituras al Worker (POST /register, PUT /table) espaciadas y coalescidas.
 * Cloudflare KV admite ~1 escritura por segundo por clave, y `u:<id>` la
 * comparten el registro de la suscripción y la tabla de previsión: dos
 * escrituras seguidas pueden pisarse (409/500) y dejar la KV con la
 * suscripción pero sin filas. Este módulo no sabe nada de Worker, fetch ni
 * localStorage: es puro y con reloj inyectable para poder probarlo con
 * temporizadores falsos. */

export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Devuelve una función `runSpaced` que ejecuta lo que se le pase, esperando
 * antes lo necesario para que hayan pasado al menos `spacingMs` desde que
 * terminó la ejecución anterior (con éxito o con error). Un único gate
 * compartido entre distintos tipos de escritura basta para que nunca se
 * solapen dos escrituras a la misma clave. */
export function createWriteGate(spacingMs: number, clock: Clock = realClock) {
  let lastFinishedAt = -Infinity;
  return async function runSpaced<T>(fn: () => Promise<T>): Promise<T> {
    const wait = spacingMs - (clock.now() - lastFinishedAt);
    if (wait > 0) await clock.sleep(wait);
    try {
      return await fn();
    } finally {
      lastFinishedAt = clock.now();
    }
  };
}

export type UploadQueueOptions<T> = {
  /** Envía el valor; debe lanzar (o devolver una promesa rechazada) si falla. */
  send: (value: T) => Promise<void>;
  /** Clave estable del valor: si no cambió desde la última subida con éxito, no hace falta subir. */
  key: (value: T) => string;
  /** Clave de la última subida con éxito (persistida fuera, p. ej. en localStorage). */
  getLastSentKey: () => string | null;
  /** Se llama justo después de un envío con éxito, para persistir su clave. */
  onSent: (key: string) => void;
};

export type UploadQueue<T> = {
  /** Registra `value` como el más reciente a subir. Nunca lanza ni bloquea:
   * si ya hay un envío en curso, este valor se recoge cuando termine. */
  request: (value: T) => void;
};

/** Cola de subida de un único valor "más reciente": como mucho un envío en
 * curso a la vez; las llamadas de en medio (mientras ese envío está en
 * marcha) no generan más tráfico, solo actualizan qué se subirá después.
 * Al terminar un envío con éxito, si lo más reciente cambió mientras tanto,
 * se sube otra vez. Si el envío falla, no se reintenta solo: el siguiente
 * `request()` (el próximo cambio de estado o apertura de la app) lo retoma. */
export function createUploadQueue<T>(opts: UploadQueueOptions<T>): UploadQueue<T> {
  let latest: T | null = null;
  let sending = false;

  async function loop(): Promise<void> {
    if (sending || latest === null) return;
    const value = latest;
    const key = opts.key(value);
    if (key === opts.getLastSentKey()) return;
    sending = true;
    let failed = false;
    try {
      await opts.send(value);
      opts.onSent(key);
    } catch {
      failed = true;
    } finally {
      sending = false;
    }
    if (!failed) {
      await loop();
    }
  }

  return {
    request(value: T): void {
      latest = value;
      void loop();
    },
  };
}
