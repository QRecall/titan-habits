import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUploadQueue, createWriteGate, realClock } from './writeQueue';

describe('createWriteGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja pasar la primera llamada sin esperar', async () => {
    const runSpaced = createWriteGate(1200, realClock);
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await runSpaced(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('espera al menos 1200 ms desde que terminó la anterior antes de empezar la siguiente', async () => {
    const runSpaced = createWriteGate(1200, realClock);
    const order: string[] = [];
    const first = runSpaced(async () => {
      order.push('first-start');
      await Promise.resolve();
      order.push('first-end');
    });
    await first;

    const secondStart = vi.fn(() => order.push('second-start'));
    const secondPromise = runSpaced(async () => {
      secondStart();
    });

    // Justo después de terminar la primera, la segunda todavía no debe haber arrancado.
    await Promise.resolve();
    expect(secondStart).not.toHaveBeenCalled();

    // A los 1199 ms tampoco.
    await vi.advanceTimersByTimeAsync(1199);
    expect(secondStart).not.toHaveBeenCalled();

    // Al llegar a 1200 ms, sí.
    await vi.advanceTimersByTimeAsync(1);
    await secondPromise;
    expect(secondStart).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('cuenta el espaciado también cuando la llamada anterior falla', async () => {
    const runSpaced = createWriteGate(1200, realClock);
    await expect(
      runSpaced(async () => {
        throw new Error('fallo de red');
      })
    ).rejects.toThrow('fallo de red');

    const second = vi.fn().mockResolvedValue(undefined);
    const secondPromise = runSpaced(second);
    await vi.advanceTimersByTimeAsync(1199);
    expect(second).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await secondPromise;
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('createUploadQueue', () => {
  function setup() {
    let lastSentKey: string | null = null;
    const send = vi.fn(async (_value: number[]) => undefined);
    const queue = createUploadQueue<number[]>({
      send,
      key: (rows) => JSON.stringify(rows),
      getLastSentKey: () => lastSentKey,
      onSent: (key) => {
        lastSentKey = key;
      },
    });
    return { queue, send, getLastSentKey: () => lastSentKey };
  }

  it('coalesca varias llamadas seguidas: nunca sube el valor intermedio, sí el más reciente', async () => {
    let resolveFirstSend: (() => void) | null = null;
    const seen: number[][] = [];
    const send = vi.fn((rows: number[]) => {
      seen.push(rows);
      if (seen.length === 1) {
        return new Promise<void>((resolve) => {
          resolveFirstSend = resolve;
        });
      }
      return Promise.resolve();
    });
    let lastSentKey: string | null = null;
    const queue = createUploadQueue<number[]>({
      send,
      key: (rows) => JSON.stringify(rows),
      getLastSentKey: () => lastSentKey,
      onSent: (key) => {
        lastSentKey = key;
      },
    });

    queue.request([1]);
    queue.request([2]);
    queue.request([3]);

    // Mientras el primer envío sigue en curso, solo debe haberse llamado una vez.
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
    expect(seen[0]).toEqual([1]);

    resolveFirstSend?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Tras terminar, sube directamente lo último pedido ([3]), nunca [2].
    expect(send).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([[1], [3]]);
    expect(seen).not.toContainEqual([2]);
  });

  it('no sube nada si la clave no cambió desde la última subida', async () => {
    const { queue, send, getLastSentKey } = setup();
    // Simula que ya se subió [1,2] antes.
    queue.request([1, 2]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(getLastSentKey()).toBe(JSON.stringify([1, 2]));
    send.mockClear();

    queue.request([1, 2]);
    await Promise.resolve();
    await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
  });

  it('si el envío falla, no reintenta solo (no hay bucle infinito)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('sin red'));
    let lastSentKey: string | null = null;
    const queue = createUploadQueue<number[]>({
      send,
      key: (rows) => JSON.stringify(rows),
      getLastSentKey: () => lastSentKey,
      onSent: (key) => {
        lastSentKey = key;
      },
    });

    queue.request([1]);
    // Deja correr varias vueltas de microtareas: si hubiera bucle, send se
    // llamaría muchas veces aquí mismo.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(1);
    expect(lastSentKey).toBeNull();
  });

  it('tras un fallo, una nueva petición sí vuelve a intentarlo', async () => {
    let shouldFail = true;
    const send = vi.fn(() => (shouldFail ? Promise.reject(new Error('sin red')) : Promise.resolve()));
    let lastSentKey: string | null = null;
    const queue = createUploadQueue<number[]>({
      send,
      key: (rows) => JSON.stringify(rows),
      getLastSentKey: () => lastSentKey,
      onSent: (key) => {
        lastSentKey = key;
      },
    });

    queue.request([1]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
    expect(lastSentKey).toBeNull();

    shouldFail = false;
    queue.request([1]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(2);
    expect(lastSentKey).toBe(JSON.stringify([1]));
  });
});
