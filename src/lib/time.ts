import { DateTime } from 'luxon';

export const nowIso = () => new Date().toISOString();

export const minutesFromNow = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

/** Monday..Sunday of the previous week in the model's timezone, formatted for humans ("8–14 September"). */
export function previousWeekRange(tz: string): { start: DateTime; end: DateTime; label: string } {
  const now = DateTime.now().setZone(tz);
  const thisMonday = now.startOf('week'); // luxon weeks start on Monday
  const start = thisMonday.minus({ weeks: 1 });
  const end = thisMonday.minus({ days: 1 });
  const label =
    start.month === end.month
      ? `${start.day}–${end.day} ${end.toFormat('LLLL')}`
      : `${start.toFormat('d LLLL')} – ${end.toFormat('d LLLL')}`;
  return { start, end, label };
}

export const fmtLocal = (iso: string, tz: string) => DateTime.fromISO(iso).setZone(tz).toFormat('ccc d LLL, h:mm a');
