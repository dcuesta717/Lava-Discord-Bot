import type { DB } from '../db/client.js';

/**
 * Bot-managed settings in bot.settings (Postgres). Loaded once at boot, kept in memory, written through.
 * Keys in use:
 *   guild.owner_id            string     — Discord guild owner (always an owner/admin)
 *   owners                    string[]   — extra owner user ids (/owners add)
 *   channels.<name>           string     — staff/agency channel ids created by modules/setup
 *   categories.<name>         string
 */
export class Settings {
  private cache = new Map<string, unknown>();

  constructor(private sql: DB) {}

  async load() {
    const rows = await this.sql<{ key: string; value: unknown }[]>`SELECT key, value FROM bot.settings`;
    this.cache.clear();
    for (const r of rows) this.cache.set(r.key, r.value);
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  getString(key: string, fallback = ''): string {
    const v = this.cache.get(key);
    return typeof v === 'string' && v ? v : fallback;
  }

  getList(key: string): string[] {
    const v = this.cache.get(key);
    return Array.isArray(v) ? (v as string[]) : [];
  }

  async set(key: string, value: unknown) {
    await this.sql`INSERT INTO bot.settings (key, value, updated_at) VALUES (${key}, ${this.sql.json(value as never)}, now())
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    this.cache.set(key, value);
  }
}
