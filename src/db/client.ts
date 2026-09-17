import postgres, { type Sql } from 'postgres';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Supabase Postgres via postgres.js. DATABASE_URL is the project's connection string
 * (Supabase dashboard → Connect → "Transaction pooler" URI, port 6543). `prepare: false` is required
 * on the transaction pooler; `ssl: 'require'` is required by Supabase.
 * All tables live in the `bot` schema (see migrations/). postgres.js does not connect until the first query,
 * so constructing the client is free (scripts/register-commands relies on that).
 */
export type DB = Sql;

const here = dirname(fileURLToPath(import.meta.url));

export function openDb(url: string): DB {
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: isLocal ? false : 'require',
    max: 5,
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 15,
    transform: { undefined: null },
    onnotice: () => undefined, // IF NOT EXISTS notices are noise
  });
}

/** Apply every src/db/migrations/*.sql not yet recorded in bot._migrations, in filename order. */
export async function migrate(sql: DB): Promise<string[]> {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS bot`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS bot._migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const applied = new Set((await sql<{ name: string }[]>`SELECT name FROM bot._migrations`).map((r) => r.name));
  const dir = join(here, 'migrations');
  const ran: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`INSERT INTO bot._migrations (name) VALUES (${file})`;
    });
    ran.push(file);
  }
  return ran;
}

export async function logEvent(sql: DB, e: { module: string; model?: string; actor?: string; event: string; data?: unknown }) {
  await sql`INSERT INTO bot.event_log (module, model_slug, actor, event, data)
            VALUES (${e.module}, ${e.model ?? null}, ${e.actor ?? null}, ${e.event}, ${e.data === undefined ? null : sql.json(e.data as never)})`;
}
