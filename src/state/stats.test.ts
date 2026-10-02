import { describe, expect, it } from 'vitest';
import type { AppState, Commitment, DayEntry, WeeklyContract } from '../types';
import {
  bestStreak,
  computeStreak,
  computeStreakAcross,
  computeWeekStats,
  evaluableDates,
  pendingToday,
} from './stats';
import { parseISODate, toISODate, weekKey } from './date';

function makeContract(signedAt: string, startDate = '2026-08-31'): WeeklyContract {
  return {
    weekKey: '2026-W36',
    startDate,
    signedAt,
    commitments: [
      { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' },
      { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' },
      { id: 'c', name: 'C', normal: 'n', minimum: 'm', reason: 'r' },
    ],
    createdAt: '2026-09-04T00:00:00.000Z',
  };
}

function makeState(days: DayEntry[]): AppState {
  return { profile: null, contracts: [], days, reviews: [] };
}

describe('date helpers · fechas locales', () => {
  it('toISODate usa componentes locales, no UTC', () => {
    const d = new Date(2026, 8, 4, 23, 59, 59); // 4 sept 2026 23:59 local
    expect(toISODate(d)).toBe('2026-09-04');
  });
});

describe('evaluableDates', () => {
  it('sólo incluye días entre signedAt y hoy dentro de la semana', () => {
    const c = makeContract('2026-09-02'); // firmado miércoles
    expect(evaluableDates(c, '2026-09-04')).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  it('no incluye días futuros', () => {
    const c = makeContract('2026-08-31');
    expect(evaluableDates(c, '2026-09-01')).toEqual([
      '2026-08-31',
      '2026-09-01',
    ]);
  });
});

describe('computeWeekStats · escenario reportado', () => {
  it('1 normal + 1 mínimo + 1 fallado hoy → 67 % y 0/1 días cumplidos', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'missed' },
        ],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    expect(stats.evaluableDays).toEqual(['2026-09-04']);
    expect(stats.normalCount).toBe(1);
    expect(stats.minimumCount).toBe(1);
    expect(stats.missedCount).toBe(1);
    expect(stats.unmarkedCount).toBe(0);
    expect(stats.percent).toBeCloseTo(2 / 3, 5);
    expect(stats.daysHonored).toBe(0);
  });

  it('mínimo cuenta plenamente para el porcentaje', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'minimum' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'minimum' },
        ],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    expect(stats.percent).toBe(1);
    expect(stats.daysHonored).toBe(1);
  });

  it('ignora registros anteriores a signedAt', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-01',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'normal' },
          { commitmentId: 'c', status: 'normal' },
        ],
      },
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [{ commitmentId: 'a', status: 'missed' }],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    expect(stats.evaluableDays).toEqual(['2026-09-04']);
    expect(stats.normalCount).toBe(0);
    expect(stats.missedCount).toBe(1);
    expect(stats.unmarkedCount).toBe(2);
  });

  it('resumen por compromiso solo cuenta días evaluables (sin 6 “sin marcar” extra)', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'missed' },
        ],
      },
    ]);
    const stats = computeWeekStats(s, c, '2026-09-04');
    for (const per of stats.perCommitment) {
      expect(per.normal + per.minimum + per.missed + per.unmarked).toBe(1);
    }
  });
});

describe('computeStreak', () => {
  it('un fallado hoy da racha 0', () => {
    const c = makeContract('2026-09-04');
    const s = makeState([
      {
        date: '2026-09-04',
        weekKey: '2026-W36',
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'minimum' },
          { commitmentId: 'c', status: 'missed' },
        ],
      },
    ]);
    expect(computeStreak(s, c, '2026-09-04')).toBe(0);
  });

  it('tres días seguidos completos → 3', () => {
    const c = makeContract('2026-09-01');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      { date: '2026-09-02', weekKey: '2026-W36', marks: full },
      { date: '2026-09-03', weekKey: '2026-W36', marks: full },
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(3);
  });

  it('hoy sin marcar no rompe la racha previa', () => {
    const c = makeContract('2026-09-01');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'minimum' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      { date: '2026-09-02', weekKey: '2026-W36', marks: full },
      // 2026-09-03 sin registro
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(2);
  });

  it('un día anterior sin completar rompe la racha', () => {
    const c = makeContract('2026-09-01');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      // 2026-09-02 en blanco
      { date: '2026-09-03', weekKey: '2026-W36', marks: full },
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(1);
  });

  it('no cuenta días anteriores a signedAt', () => {
    const c = makeContract('2026-09-03');
    const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
    const s = makeState([
      { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      { date: '2026-09-02', weekKey: '2026-W36', marks: full },
      { date: '2026-09-03', weekKey: '2026-W36', marks: full },
    ]);
    expect(computeStreak(s, c, '2026-09-03')).toBe(1);
  });
});

describe('computeStreakAcross · racha continua entre semanas', () => {
  const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));
  const w36 = makeContract('2026-08-31');
  const w37: WeeklyContract = { ...makeContract('2026-09-07', '2026-09-07'), weekKey: '2026-W37' };

  function withContracts(days: DayEntry[], contracts: WeeklyContract[]): AppState {
    return { ...makeState(days), contracts };
  }

  it('el lunes con contrato nuevo y sin marcar, la racha de la semana pasada sigue viva', () => {
    const s = withContracts(
      ['2026-09-04', '2026-09-05', '2026-09-06'].map((date) => ({ date, weekKey: '2026-W36', marks: full })),
      [w36, w37]
    );
    expect(computeStreakAcross(s, '2026-09-07')).toBe(3);
  });

  it('suma días de dos semanas consecutivas', () => {
    const s = withContracts(
      [
        { date: '2026-09-05', weekKey: '2026-W36', marks: full },
        { date: '2026-09-06', weekKey: '2026-W36', marks: full },
        { date: '2026-09-07', weekKey: '2026-W37', marks: full },
        { date: '2026-09-08', weekKey: '2026-W37', marks: full },
      ],
      [w36, w37]
    );
    expect(computeStreakAcross(s, '2026-09-08')).toBe(4);
  });

  it('un día sin contrato corta la racha (fin, no fallo)', () => {
    // W35 sin contrato: el 30 de agosto no es evaluable.
    const s = withContracts(
      [
        { date: '2026-08-30', weekKey: '2026-W35', marks: full },
        { date: '2026-08-31', weekKey: '2026-W36', marks: full },
        { date: '2026-09-01', weekKey: '2026-W36', marks: full },
      ],
      [w36]
    );
    expect(computeStreakAcross(s, '2026-09-01')).toBe(2);
  });

  it('los días previos a signedAt de la primera semana no cuentan ni rompen', () => {
    const late = makeContract('2026-09-03'); // firmado jueves
    const s = withContracts(
      [
        { date: '2026-09-03', weekKey: '2026-W36', marks: full },
        { date: '2026-09-04', weekKey: '2026-W36', marks: full },
      ],
      [late]
    );
    expect(computeStreakAcross(s, '2026-09-04')).toBe(2);
  });

  it('un fallo ayer deja la racha en 0 aunque hoy esté completo', () => {
    const s = withContracts(
      [
        { date: '2026-09-07', weekKey: '2026-W37', marks: [{ commitmentId: 'a', status: 'missed' }, ...full.slice(1)] },
        { date: '2026-09-08', weekKey: '2026-W37', marks: full },
      ],
      [w36, w37]
    );
    expect(computeStreakAcross(s, '2026-09-08')).toBe(1);
  });

  it('sin contrato hoy la racha es 0', () => {
    const s = withContracts(
      [{ date: '2026-09-06', weekKey: '2026-W36', marks: full }],
      [w36]
    );
    expect(computeStreakAcross(s, '2026-09-08')).toBe(0);
  });
});

describe('bestStreak', () => {
  const full = ['a', 'b', 'c'].map((id) => ({ commitmentId: id, status: 'normal' as const }));

  it('sin contratos devuelve 0', () => {
    expect(bestStreak(makeState([]), '2026-09-22')).toBe(0);
  });

  it('una racha antigua más larga que la actual: el récord recuerda la más larga, no la actual', () => {
    const c = makeContract('2026-08-31', '2026-08-31');
    const days: DayEntry[] = [
      ...['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].map((date) => ({
        date,
        weekKey: '2026-W36',
        marks: full,
      })),
      { date: '2026-09-05', weekKey: '2026-W36', marks: [{ commitmentId: 'a', status: 'missed' as const }, ...full.slice(1)] },
      { date: '2026-09-06', weekKey: '2026-W36', marks: full },
    ];
    const s: AppState = { ...makeState(days), contracts: [c] };
    expect(computeStreakAcross(s, '2026-09-06')).toBe(1);
    expect(bestStreak(s, '2026-09-06')).toBe(5);
  });

  it('cruce de semana: la racha sigue entre contratos consecutivos', () => {
    const w36 = makeContract('2026-08-31');
    const w37: WeeklyContract = { ...makeContract('2026-09-07', '2026-09-07'), weekKey: '2026-W37' };
    const s: AppState = {
      ...makeState([
        { date: '2026-09-05', weekKey: '2026-W36', marks: full },
        { date: '2026-09-06', weekKey: '2026-W36', marks: full },
        { date: '2026-09-07', weekKey: '2026-W37', marks: full },
        { date: '2026-09-08', weekKey: '2026-W37', marks: full },
      ]),
      contracts: [w36, w37],
    };
    expect(bestStreak(s, '2026-09-08')).toBe(4);
  });

  it('hoy incompleto (sin marcar) no rompe ni suma, pero conserva el récord previo', () => {
    const w36 = makeContract('2026-08-31');
    const w37: WeeklyContract = { ...makeContract('2026-09-07', '2026-09-07'), weekKey: '2026-W37' };
    const s: AppState = {
      ...makeState(
        ['2026-09-04', '2026-09-05', '2026-09-06'].map((date) => ({ date, weekKey: '2026-W36', marks: full }))
      ),
      contracts: [w36, w37],
    };
    expect(bestStreak(s, '2026-09-07')).toBe(3);
  });

  it('compromiso añadido a mitad de semana: cuenta igual que la racha actual', () => {
    const n: Commitment = { id: 'n', name: 'N', normal: 'n', minimum: 'm', reason: 'r', since: '2026-09-23' };
    const A: Commitment = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' };
    const B: Commitment = { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' };
    const wk = weekKey(parseISODate('2026-09-21'));
    const c: WeeklyContract = {
      weekKey: wk,
      startDate: '2026-09-21',
      signedAt: '2026-09-21',
      commitments: [A, B, n],
      createdAt: '2026-09-21T00:00:00.000Z',
    };
    const days: DayEntry[] = [
      { date: '2026-09-21', weekKey: wk, marks: [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }] },
      { date: '2026-09-22', weekKey: wk, marks: [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }] },
      {
        date: '2026-09-23',
        weekKey: wk,
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'normal' },
          { commitmentId: 'n', status: 'normal' },
        ],
      },
    ];
    const s: AppState = { ...makeState(days), contracts: [c] };
    expect(bestStreak(s, '2026-09-23')).toBe(3);
  });

  it('coincide con computeStreakAcross cuando la racha actual es la mejor', () => {
    const w36 = makeContract('2026-08-31');
    const w37: WeeklyContract = { ...makeContract('2026-09-07', '2026-09-07'), weekKey: '2026-W37' };
    const s: AppState = {
      ...makeState([
        { date: '2026-09-05', weekKey: '2026-W36', marks: full },
        { date: '2026-09-06', weekKey: '2026-W36', marks: full },
        { date: '2026-09-07', weekKey: '2026-W37', marks: full },
        { date: '2026-09-08', weekKey: '2026-W37', marks: full },
      ]),
      contracts: [w36, w37],
    };
    expect(bestStreak(s, '2026-09-08')).toBe(computeStreakAcross(s, '2026-09-08'));
  });

  it('compromiso quitado a mitad de semana y sin marcar después no rompe la racha', () => {
    const A: Commitment = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' };
    const B: Commitment = { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' };
    const R: Commitment = { id: 'r', name: 'R', normal: 'n', minimum: 'm', reason: 'r', removedOn: '2026-09-23' };
    const wk = weekKey(parseISODate('2026-09-21'));
    const c: WeeklyContract = {
      weekKey: wk,
      startDate: '2026-09-21',
      signedAt: '2026-09-21',
      commitments: [A, B, R],
      createdAt: '2026-09-21T00:00:00.000Z',
    };
    const days: DayEntry[] = [
      {
        date: '2026-09-21',
        weekKey: wk,
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'normal' },
          { commitmentId: 'r', status: 'normal' },
        ],
      },
      {
        date: '2026-09-22',
        weekKey: wk,
        marks: [
          { commitmentId: 'a', status: 'normal' },
          { commitmentId: 'b', status: 'normal' },
          { commitmentId: 'r', status: 'normal' },
        ],
      },
      // A partir de aquí `r` ya está quitado (removedOn) y se queda sin marcar.
      { date: '2026-09-23', weekKey: wk, marks: [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }] },
      { date: '2026-09-24', weekKey: wk, marks: [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'normal' }] },
    ];
    const s: AppState = { ...makeState(days), contracts: [c] };
    expect(bestStreak(s, '2026-09-24')).toBe(4);
    expect(bestStreak(s, '2026-09-24')).toBe(computeStreakAcross(s, '2026-09-24'));
  });
});

describe('pendingToday', () => {
  it('cuenta los compromisos de hoy sin marcar', () => {
    const c = makeContract('2026-08-31');
    const s: AppState = {
      ...makeState([{ date: '2026-09-02', weekKey: '2026-W36', marks: [{ commitmentId: 'a', status: 'normal' }, { commitmentId: 'b', status: 'missed' }] }]),
      contracts: [c],
    };
    expect(pendingToday(s, '2026-09-02')).toBe(1);
    expect(pendingToday(s, '2026-09-03')).toBe(3);
  });

  it('sin contrato para hoy devuelve 0', () => {
    const s: AppState = { ...makeState([]), contracts: [makeContract('2026-08-31')] };
    expect(pendingToday(s, '2026-09-08')).toBe(0);
  });
});

describe('compromisos activos por día · añadir y quitar a mitad de semana', () => {
  // Contrato de la semana W39, firmado el lunes 2026-09-21.
  const START = '2026-09-21';
  const WK = weekKey(parseISODate(START));
  const A: Commitment = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: 'r' };
  const B: Commitment = { id: 'b', name: 'B', normal: 'n', minimum: 'm', reason: 'r' };

  function w39(commitments: Commitment[]): WeeklyContract {
    return { weekKey: WK, startDate: START, signedAt: START, commitments, createdAt: `${START}T00:00:00.000Z` };
  }

  function dayFull(date: string, ids: string[]): DayEntry {
    return { date, weekKey: WK, marks: ids.map((id) => ({ commitmentId: id, status: 'normal' as const })) };
  }

  function withContract(days: DayEntry[], contract: WeeklyContract): AppState {
    return { ...makeState(days), contracts: [contract] };
  }

  it('añadir un compromiso a mitad de semana no rompe la racha ni cambia los días previos', () => {
    const n: Commitment = { id: 'n', name: 'N', normal: 'n', minimum: 'm', reason: 'r', since: '2026-09-23' };
    const c = w39([A, B, n]);
    const s = withContract(
      [
        dayFull('2026-09-21', ['a', 'b']),
        dayFull('2026-09-22', ['a', 'b']),
        dayFull('2026-09-23', ['a', 'b', 'n']),
      ],
      c
    );
    expect(computeStreakAcross(s, '2026-09-23')).toBe(3);
    const stats = computeWeekStats(s, c, '2026-09-23');
    expect(stats.daysHonored).toBe(3);
    expect(stats.percent).toBe(1);
  });

  it('si el día del cambio no se marca el nuevo compromiso, corta la racha pero el pasado sigue cumplido', () => {
    const n: Commitment = { id: 'n', name: 'N', normal: 'n', minimum: 'm', reason: 'r', since: '2026-09-23' };
    const c = w39([A, B, n]);
    const s = withContract(
      [
        dayFull('2026-09-21', ['a', 'b']),
        dayFull('2026-09-22', ['a', 'b']),
        dayFull('2026-09-23', ['a', 'b']), // falta 'n', que ya está activo
      ],
      c
    );
    expect(computeStreakAcross(s, '2026-09-23')).toBe(2);
    expect(computeWeekStats(s, c, '2026-09-23').daysHonored).toBe(2);
  });

  it('quitar un compromiso a mitad de semana no cambia los días previos', () => {
    const bRemoved: Commitment = { ...B, removedOn: '2026-09-24' };
    const c = w39([A, bRemoved]);
    const s = withContract(
      [
        dayFull('2026-09-21', ['a', 'b']),
        dayFull('2026-09-22', ['a', 'b']),
        dayFull('2026-09-23', ['a', 'b']),
        dayFull('2026-09-24', ['a']), // 'b' ya no cuenta este día
      ],
      c
    );
    expect(computeStreakAcross(s, '2026-09-24')).toBe(4);
    const stats = computeWeekStats(s, c, '2026-09-24');
    expect(stats.daysHonored).toBe(4);
    expect(stats.totalCommitments).toBe(1);
    const bSummary = stats.perCommitment.find((p) => p.commitmentId === 'b')!;
    expect(bSummary.normal).toBe(3);
    expect(bSummary.unmarked).toBe(0);
  });

  it('pendingToday ignora el compromiso quitado ese mismo día', () => {
    const bRemoved: Commitment = { ...B, removedOn: '2026-09-24' };
    const c = w39([A, bRemoved]);
    const s = withContract([], c);
    expect(pendingToday(s, '2026-09-24')).toBe(1);
  });

  it('el porcentaje usa como denominador la suma de compromisos activos por día', () => {
    const n: Commitment = { id: 'n', name: 'N', normal: 'n', minimum: 'm', reason: 'r', since: '2026-09-22' };
    const c = w39([A, B, n]);

    const full = withContract(
      [dayFull('2026-09-21', ['a', 'b']), dayFull('2026-09-22', ['a', 'b', 'n'])],
      c
    );
    expect(computeWeekStats(full, c, '2026-09-22').percent).toBe(1);

    const partial = withContract(
      [dayFull('2026-09-21', ['a', 'b']), dayFull('2026-09-22', ['a', 'b'])], // falta 'n'
      c
    );
    expect(computeWeekStats(partial, c, '2026-09-22').percent).toBe(4 / 5);
  });

  it('quitar un compromiso ya fallado hoy no borra el fallo (removedOn = mañana)', () => {
    // a, b firmados el lunes; lunes y martes completos; el miércoles 'a' normal
    // y 'b' fallado, y 'b' se quita ese mismo miércoles → removedOn = jueves.
    const bRemoved: Commitment = { ...B, removedOn: '2026-09-24' };
    const c = w39([A, bRemoved]);
    const s = withContract(
      [
        dayFull('2026-09-21', ['a', 'b']),
        dayFull('2026-09-22', ['a', 'b']),
        {
          date: '2026-09-23',
          weekKey: WK,
          marks: [
            { commitmentId: 'a', status: 'normal' },
            { commitmentId: 'b', status: 'missed' },
          ],
        },
      ],
      c
    );
    expect(computeStreakAcross(s, '2026-09-24')).toBe(0); // el miércoles cuenta como fallado
    expect(computeWeekStats(s, c, '2026-09-23').daysHonored).toBe(2);
  });
});
