import { describe, expect, it } from 'vitest';
import type { AppState, WeeklyContract } from '../types';
import { coachMessage } from './coach';

const A = { id: 'a', name: 'A', normal: 'n', minimum: 'm', reason: '' };
const w36: WeeklyContract = { weekKey: '2026-W36', startDate: '2026-08-31', signedAt: '2026-08-31', createdAt: 'x', commitments: [A] };
const w37: WeeklyContract = { weekKey: '2026-W37', startDate: '2026-09-07', signedAt: '2026-09-07', createdAt: 'x', commitments: [A] };

describe('coachMessage', () => {
  it('usa el contrato de la semana en curso aunque exista el de la próxima', () => {
    const state: AppState = {
      profile: null,
      contracts: [w36, w37],
      days: [{ date: '2026-09-03', weekKey: '2026-W36', marks: [{ commitmentId: 'a', status: 'normal' }] }],
      reviews: [],
    };
    expect(coachMessage(state, '2026-09-03').tone).toBe('firme');
  });

  it('sin contrato para la semana en curso pide firmar', () => {
    const state: AppState = { profile: null, contracts: [w36], days: [], reviews: [] };
    expect(coachMessage(state, '2026-09-08').tone).toBe('salida');
    expect(coachMessage(state, '2026-09-08').text).toContain('contrato');
  });
});
