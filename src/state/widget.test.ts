import { describe, expect, it } from 'vitest';
import { widgetScript } from './widget';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (code: string) => unknown;

describe('widgetScript', () => {
  const s = widgetScript('https://titan-push.x.workers.dev', 'AbCdEfGhIjKlMnOpQrSt_-', 'https://qrecall.github.io/titan-habits/');
  it('lleva la URL de datos con el id y la de la app', () => {
    expect(s).toContain('"https://titan-push.x.workers.dev/today?id=AbCdEfGhIjKlMnOpQrSt_-"');
    expect(s).toContain('"https://qrecall.github.io/titan-habits/"');
  });
  it('es JavaScript válido (con await de primer nivel)', () => {
    expect(() => new AsyncFunction(s)).not.toThrow();
  });
});
