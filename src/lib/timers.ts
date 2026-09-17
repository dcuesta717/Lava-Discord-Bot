import type { DB } from '../db/client.js';
import type { Logger } from './logger.js';

/**
 * Durable timers (CLAUDE.md rule 4). Rows live in Postgres; a 15-second tick fires whatever is due.
 * A redeploy in the middle of a live session therefore never loses a check-in.
 *
 * ponytail: polling instead of per-timer setTimeout — simpler, survives restarts, 15 s granularity is fine
 * for everything we schedule (minutes to days). Upgrade path: LISTEN/NOTIFY if we ever need sub-second.
 * Claiming uses UPDATE … RETURNING so two bot instances can't double-fire the same row.
 */
export type TimerHandler = (t: TimerRow) => Promise<void>;

export interface TimerRow {
  id: number;
  kind: string;
  model_slug: string;
  payload: Record<string, unknown>;
  fire_at: Date;
}

export class Timers {
  private handlers = new Map<string, TimerHandler>();
  private interval?: NodeJS.Timeout;
  private ticking = false;

  constructor(private sql: DB, private log: Logger, private tickMs = 15_000) {}

  on(kind: string, handler: TimerHandler) {
    this.handlers.set(kind, handler);
  }

  async schedule(kind: string, modelSlug: string, fireAt: Date | string, payload: Record<string, unknown> = {}): Promise<number> {
    const [row] = await this.sql<{ id: number }[]>`
      INSERT INTO bot.timers (kind, model_slug, payload, fire_at)
      VALUES (${kind}, ${modelSlug}, ${this.sql.json(payload as never)}, ${typeof fireAt === 'string' ? new Date(fireAt) : fireAt})
      RETURNING id`;
    return Number(row.id);
  }

  /** Cancel every pending timer of the given kinds whose payload has payloadKey == payloadValue (e.g. sessionId). */
  async cancelWhere(kinds: string[], modelSlug: string, payloadKey: string, payloadValue: string | number): Promise<number> {
    const res = await this.sql`
      UPDATE bot.timers SET cancelled_at = now()
      WHERE model_slug = ${modelSlug} AND fired_at IS NULL AND cancelled_at IS NULL
        AND kind = ANY(${kinds}) AND payload ->> ${payloadKey} = ${String(payloadValue)}`;
    return res.count;
  }

  start() {
    this.interval = setInterval(() => void this.tick(), this.tickMs);
    void this.tick();
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      // claim first so a crash mid-handler doesn't double-fire
      const due = await this.sql<TimerRow[]>`
        UPDATE bot.timers SET fired_at = now()
        WHERE id IN (
          SELECT id FROM bot.timers
          WHERE fired_at IS NULL AND cancelled_at IS NULL AND fire_at <= now()
          ORDER BY fire_at LIMIT 50
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, kind, model_slug, payload, fire_at`;
      for (const row of due) {
        const handler = this.handlers.get(row.kind);
        if (!handler) {
          this.log.warn({ kind: row.kind }, 'timer fired with no handler');
          continue;
        }
        try {
          await handler({ ...row, id: Number(row.id) });
        } catch (err) {
          this.log.error({ err, timer: row.id, kind: row.kind }, 'timer handler failed');
        }
      }
    } catch (err) {
      this.log.error({ err }, 'timer tick failed');
    } finally {
      this.ticking = false;
    }
  }
}
