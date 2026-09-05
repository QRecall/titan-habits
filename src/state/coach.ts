import type { AppState, WeeklyContract } from '../types';
import { today } from './date';
import { computeStreak } from './stats';

type CoachTone = 'salida' | 'firme' | 'sostén' | 'reconducir' | 'racha';

export type CoachMessage = {
  tone: CoachTone;
  text: string;
};

function activeContract(state: AppState): WeeklyContract | null {
  if (state.contracts.length === 0) return null;
  return state.contracts[state.contracts.length - 1];
}

function statusOfToday(state: AppState) {
  const contract = activeContract(state);
  if (!contract) return { marked: 0, normal: 0, minimum: 0, missed: 0, total: 0 };
  const day = state.days.find((d) => d.date === today());
  const total = contract.commitments.length;
  if (!day) return { marked: 0, normal: 0, minimum: 0, missed: 0, total };
  let normal = 0, minimum = 0, missed = 0;
  for (const c of contract.commitments) {
    const m = day.marks.find((x) => x.commitmentId === c.id);
    if (!m || !m.status) continue;
    if (m.status === 'normal') normal++;
    else if (m.status === 'minimum') minimum++;
    else if (m.status === 'missed') missed++;
  }
  return { marked: normal + minimum + missed, normal, minimum, missed, total };
}

// Selecciona el mensaje del día. Firme, breve, no culpabiliza.
export function coachMessage(state: AppState): CoachMessage {
  const contract = activeContract(state);
  if (!contract) {
    return { tone: 'salida', text: 'Antes de arrancar, firma tu contrato de la semana.' };
  }
  const s = statusOfToday(state);
  const streak = computeStreak(state, contract);

  if (s.total === 0) {
    return { tone: 'salida', text: 'Sin compromisos todavía. Añade uno y empieza pequeño.' };
  }

  if (streak >= 7) {
    return { tone: 'racha', text: `${streak} días sostenidos. Empieza a pesar.` };
  }

  if (s.marked === 0) {
    const opts = [
      'Nuevo día. La versión mínima ya cuenta.',
      'No hace falta épica. Solo empezar.',
      'Un ladrillo al día levanta el muro.',
    ];
    return { tone: 'salida', text: pick(opts) };
  }

  if (s.normal === s.total) {
    return { tone: 'firme', text: 'Contrato honrado. Así se construye quien te propones ser.' };
  }

  if (s.missed > 0 && s.normal + s.minimum === 0) {
    return { tone: 'reconducir', text: 'Un mal día no es una identidad. Elige el mínimo antes de dormir.' };
  }

  if (s.minimum > 0 && s.missed === 0) {
    return { tone: 'sostén', text: 'El mínimo también es un ladrillo. Sigue vivo el hábito.' };
  }

  if (s.missed > 0) {
    return { tone: 'reconducir', text: 'Rescata la jornada con la versión mínima de lo que falta.' };
  }

  return { tone: 'sostén', text: 'Sigue sumando. Pequeño, pero real.' };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
