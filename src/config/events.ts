import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DateTime } from 'luxon';
import YAML from 'yaml';
import { z } from 'zod';

/** knowledge/events.yaml — recurring cultural moments; one-offs can also come from bot.events (Discord /event add). */
export const EVENTS_FILE = join(process.cwd(), 'knowledge', 'events.yaml');

const ruleSchema = z.object({ month: z.number().int().min(1).max(12), weekday: z.number().int().min(1).max(7), nth: z.number().int().min(-1).max(5) });

export const eventSchema = z
  .object({
    name: z.string().min(1),
    date: z.string().regex(/^(\d{4}-)?\d{2}-\d{2}$/).optional(),
    rule: ruleSchema.optional(),
    offset_days: z.number().int().default(0),
    lead_days: z.number().int().min(0).max(60).optional(),
    ideas: z.number().int().min(1).max(10).optional(),
    lanes: z.array(z.string()).default([]),
    angle: z.string().default(''),
  })
  .refine((e) => e.date || e.rule, { message: 'event needs a date or a rule' });

const schema = z.object({
  defaults: z.object({ lead_days: z.number().int().default(10), ideas: z.number().int().default(5) }).default({}),
  events: z.array(eventSchema),
});

export type EventDef = z.infer<typeof eventSchema>;
export type EventsConfig = z.infer<typeof schema>;

export function loadEvents(): EventsConfig {
  if (!existsSync(EVENTS_FILE)) return { defaults: { lead_days: 10, ideas: 5 }, events: [] };
  return schema.parse(YAML.parse(readFileSync(EVENTS_FILE, 'utf8')));
}

/** Next occurrence (today or later) of an event, as a local date in `zone`. */
export function nextOccurrence(e: EventDef, from: DateTime): DateTime | undefined {
  const today = from.startOf('day');
  for (const year of [today.year, today.year + 1]) {
    let d: DateTime | undefined;
    if (e.date) {
      const m = e.date.match(/^(?:(\d{4})-)?(\d{2})-(\d{2})$/)!;
      if (m[1] && Number(m[1]) !== year) continue;
      d = DateTime.fromObject({ year, month: Number(m[2]), day: Number(m[3]) }, { zone: from.zone });
    } else if (e.rule) {
      d = nthWeekday(year, e.rule.month, e.rule.weekday, e.rule.nth, from.zone.name);
    }
    if (!d || !d.isValid) continue;
    d = d.plus({ days: e.offset_days ?? 0 });
    if (d >= today) return d;
  }
  return undefined;
}

/** nth (1..4) or last (-1) weekday (1=Mon … 7=Sun) of a month. */
export function nthWeekday(year: number, month: number, weekday: number, nth: number, zone: string): DateTime {
  if (nth > 0) {
    const first = DateTime.fromObject({ year, month, day: 1 }, { zone });
    const delta = (weekday - first.weekday + 7) % 7;
    return first.plus({ days: delta + (nth - 1) * 7 });
  }
  const last = DateTime.fromObject({ year, month, day: 1 }, { zone }).endOf('month').startOf('day');
  const delta = (last.weekday - weekday + 7) % 7;
  return last.minus({ days: delta });
}
