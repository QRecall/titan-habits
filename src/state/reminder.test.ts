import { describe, expect, it } from 'vitest';
import { buildReminderICS, reminderFilename } from './reminder';

const NOW = new Date(2026, 8, 7, 12, 0, 0); // 7 sept 2026, 12:00 local

describe('buildReminderICS', () => {
  const ics = buildReminderICS({ hour: 21, minute: 30, now: NOW, uid: 'titan-test' });
  const lines = ics.split('\r\n');

  it('es un calendario con un único evento diario', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('usa finales de línea CRLF como exige el formato', () => {
    expect(ics.includes('\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('empieza hoy a la hora elegida, en hora local (sin zona)', () => {
    expect(ics).toContain('DTSTART:20260907T213000');
    expect(ics).toContain('DTEND:20260907T214000');
    expect(ics).not.toContain('DTSTART:20260907T213000Z');
  });

  it('lleva una alarma a la hora del evento', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:PT0M');
    expect(ics).toContain('ACTION:DISPLAY');
  });

  it('incluye título, descripción, uid y sello de creación', () => {
    expect(ics).toContain('SUMMARY:TITAN · marca tus compromisos');
    expect(ics).toContain('UID:titan-test');
    expect(ics).toContain('DTSTAMP:20260907T');
    expect(ics).toMatch(/DESCRIPTION:.*mínima/);
  });

  it('acepta horas con un dígito', () => {
    const early = buildReminderICS({ hour: 7, minute: 5, now: NOW, uid: 'x' });
    expect(early).toContain('DTSTART:20260907T070500');
  });
});

describe('reminderFilename', () => {
  it('nombra el archivo con la hora', () => {
    expect(reminderFilename(21, 30)).toBe('titan-recordatorio-21-30.ics');
  });
});
