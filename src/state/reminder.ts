import { pad } from './date';

export type ReminderOptions = {
  hour: number;
  minute: number;
  now?: Date;
  uid?: string;
};

const SUMMARY = 'TITAN · marca tus compromisos';
const DESCRIPTION =
  'Abre TITAN y marca el día. Si el día se ha torcido, la versión mínima también cuenta.';

function localStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

// Escapado mínimo de texto ICS (RFC 5545): coma, punto y coma, barra y saltos.
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Evento diario con alarma a la hora elegida, en hora local "flotante"
 * (sin zona horaria): así suena a esa hora aunque viajes.
 * El calendario del móvil se encarga de avisar; TITAN no necesita servidor.
 */
export function buildReminderICS({ hour, minute, now = new Date(), uid }: ReminderOptions): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  const id = uid ?? `titan-recordatorio-${localStamp(now)}@titan-habits`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TITAN//Recordatorio diario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(start)}`,
    `DTEND:${localStamp(end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText(SUMMARY)}`,
    `DESCRIPTION:${escapeText(DESCRIPTION)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(SUMMARY)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function reminderFilename(hour: number, minute: number): string {
  return `titan-recordatorio-${pad(hour)}-${pad(minute)}.ics`;
}
