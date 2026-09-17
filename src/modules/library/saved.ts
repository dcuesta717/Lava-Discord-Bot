import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Events } from 'discord.js';
import YAML from 'yaml';
import { z } from 'zod';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { canonicalUrl, type ReelCandidate } from '../../integrations/apify.js';
import { GitHub } from '../../integrations/github.js';
import { industryLens } from '../../lib/industry.js';
import { loadPrompt } from '../../lib/prompts.js';
import type { IngestOpts, IngestResult, ItemRow } from './index.js';

/**
 * Saved-collections import — "Dan's saved folder, learned".
 *
 *   input   the Google Sheet in library/collections.yaml (collection, url, author, kind, position) — one row per video
 *           Dan saved on Instagram. A browser session fills it (Claude in Chrome); owners can add/delete rows any time.
 *   queue   bot.saved_imports — durable, one row per link, so the run survives restarts and never re-does a link.
 *   run     /library import [collection]  or  "@Lava Bot import my saved collections" → background, paced, progress in #ops-log.
 *           Each link: Apify (video, caption, author, numbers) → Claude classify with the collection as a hint (rules in
 *           collections.yaml can force a folder) → posted in the Content Library like any other video, tagged with the collection.
 *   learn   after a run: authors he saved twice+ become scout seed accounts (bot.library_sources); Claude writes
 *           knowledge/taste.md ("what the owner saves") from the whole set and it is injected into every classify/idea prompt
 *           through industryLens(). Per-girl collections ("Leah", "Ideas for Bryce") land on her board when she is onboarded.
 */
const MODULE = 'library';
const FILE = join(process.cwd(), 'library', 'collections.yaml');
const TASTE_FILE = join(process.cwd(), 'knowledge', 'taste.md');
const ACTIVE_KEY = 'library.import.active';

const schema = z.object({
  sheet: z.string().url(),
  pace_ms: z.number().int().min(500).max(60_000).default(3500),
  batch: z.number().int().min(1).max(20).default(8),
  people: z.array(z.string().min(1)).default([]),
  rules: z.array(z.object({ match: z.string().min(1), genre: z.string().optional(), hint: z.string().optional() })).default([]),
});
export type CollectionsConfig = z.infer<typeof schema>;

export function loadCollections(): CollectionsConfig {
  return schema.parse(YAML.parse(readFileSync(FILE, 'utf8')));
}

export interface SavedRow {
  url: string; // canonical
  collection: string;
  author?: string;
  kind?: string;
  position?: number;
}

interface QueueRow {
  url: string;
  collection: string;
  author: string | null;
  kind: string | null;
  position: number | null;
}

export interface SavedDeps {
  ingest(urls: string[], opts: IngestOpts): Promise<IngestResult>;
  genreExists(slug: string): boolean;
  itemByUrl(canonical: string): Promise<ItemRow | undefined>;
  sendToBoard(item: ItemRow, slug: string, actor: string): Promise<void>;
}

/** Minimal RFC-4180 parser (quotes, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Read the public sheet as CSV. Header names are matched loosely (collection|folder, url|link, author|account, kind|type, position|order|#). */
export async function readSheet(sheetUrl: string): Promise<SavedRow[]> {
  const id = sheetUrl.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
  if (!id) throw new Error('collections.yaml → sheet is not a Google Sheets url');
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Google Sheet returned ${res.status} — is it shared as "anyone with the link"?`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const cUrl = col('url', 'link', 'post', 'video');
  const cCol = col('collection', 'folder', 'saved collection', 'list');
  const cAuthor = col('author', 'account', 'handle', 'creator');
  const cKind = col('kind', 'type');
  const cPos = col('position', 'order', '#', 'index');
  if (cUrl < 0 || cCol < 0) throw new Error(`sheet needs "collection" and "url" columns (found: ${header.join(', ')})`);
  const out: SavedRow[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const raw = (r[cUrl] ?? '').trim();
    const collection = (r[cCol] ?? '').trim();
    if (!raw || !collection || !/instagram\.com|tiktok\.com/.test(raw)) continue;
    const url = canonicalUrl(raw);
    if (seen.has(url)) continue;
    seen.add(url);
    const pos = cPos >= 0 ? Number.parseInt(r[cPos] ?? '', 10) : NaN;
    out.push({ url, collection, author: cAuthor >= 0 ? (r[cAuthor] ?? '').trim().replace(/^@/, '') || undefined : undefined, kind: cKind >= 0 ? (r[cKind] ?? '').trim() || undefined : undefined, position: Number.isNaN(pos) ? out.length : pos });
  }
  return out;
}

export function registerSavedImport(ctx: BotContext, deps: SavedDeps) {
  const sql = ctx.db;
  const github = new GitHub(ctx.env.GITHUB_TOKEN, ctx.env.GITHUB_REPO, ctx.env.GITHUB_BRANCH);
  let running = false;
  let progress = { done: 0, total: 0, collection: '' };

  const cfg = () => loadCollections();
  const rule = (collection: string) => cfg().rules.find((r) => new RegExp(r.match, 'i').test(collection));
  const person = (collection: string) => cfg().people.find((p) => new RegExp(`\\b${p}\\b`, 'i').test(collection))?.toLowerCase();

  // resume an interrupted run after a redeploy
  ctx.client.once(Events.ClientReady, async () => {
    await ctx.ready;
    if (ctx.settings.getString(ACTIVE_KEY) === '1' && ctx.api.apify.enabled) {
      const n = await queued();
      if (n) {
        ctx.log.info({ module: MODULE, n }, 'resuming saved-collections import');
        void run({ resume: true }).catch((err) => ctx.log.error({ err }, 'saved import resume failed'));
      } else await ctx.settings.set(ACTIVE_KEY, '0');
    }
  });

  // her collection → her board when she goes live
  ctx.bus.on('model:live', ({ model }: { model: Model }) => {
    deliverPersonCollection(model).catch((err) => ctx.log.warn({ err, model: model.slug }, 'person collection delivery failed'));
  });

  ctx.action('import_saved_collections', {
    description:
      "Import the owner's Instagram saved collections from the Google Sheet (library/collections.yaml) into the Content Library: every link → Apify → Claude classify (collection name as hint) → posted to its folder, then the bot learns from the whole set (seed accounts + knowledge/taste.md). Runs in the background, paced; progress in #ops-log. Optional `collection` limits it to one collection (partial, case-insensitive match).",
    input: { type: 'object', properties: { collection: { type: 'string', description: 'only this collection (optional)' } } },
    ownersOnly: true,
    slow: true,
    run: async (input, actor) => {
      if (!ctx.api.apify.enabled) return 'APIFY_TOKEN is not set';
      const r = await start({ only: input.collection ? String(input.collection) : undefined, actor: actor.userId });
      return r.message;
    },
  });
  ctx.action('saved_import_status', {
    description: 'How the saved-collections import is going: queued / filed / skipped / failed per collection, and whether a run is active.',
    input: { type: 'object', properties: {} },
    ownersOnly: true,
    run: async () => status(),
  });
  ctx.action('relearn_from_library', {
    description: 'Re-run the learning step only (no new videos): refresh scout seed accounts from what the owner saved and rewrite knowledge/taste.md from everything imported so far.',
    input: { type: 'object', properties: {} },
    ownersOnly: true,
    slow: true,
    run: async () => {
      const l = await learn();
      return `learned: ${l.accounts} seed account(s) refreshed, taste profile ${l.taste ? `rewritten (${l.words} words${l.sha ? `, live after the restart` : ''})` : 'unchanged (nothing imported yet)'}`;
    },
  });

  async function queued(only?: string) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM bot.saved_imports WHERE status = 'queued' ${only ? sql`AND collection ILIKE ${'%' + only + '%'}` : sql``}`;
    return n;
  }

  /** Sync the sheet into the queue and start the background run. */
  async function start(opts: { only?: string; actor?: string }): Promise<{ started: boolean; message: string }> {
    if (running) return { started: false, message: `an import is already running — ${progress.done}/${progress.total} done (${progress.collection}). Check #ops-log.` };
    const c = cfg();
    let rows: SavedRow[];
    try {
      rows = await readSheet(c.sheet);
    } catch (err) {
      return { started: false, message: `couldn't read the sheet: ${(err as Error).message}` };
    }
    let added = 0;
    for (const r of rows) {
      const res = await sql`
        INSERT INTO bot.saved_imports (url, collection, author, kind, position)
        VALUES (${r.url}, ${r.collection}, ${r.author ?? null}, ${r.kind ?? null}, ${r.position ?? null})
        ON CONFLICT (url) DO UPDATE SET collection = EXCLUDED.collection, author = COALESCE(bot.saved_imports.author, EXCLUDED.author), position = EXCLUDED.position
        WHERE bot.saved_imports.status = 'queued'
        RETURNING (xmax = 0) AS inserted`;
      if (res[0]?.inserted) added++;
    }
    const n = await queued(opts.only);
    if (!n) return { started: false, message: `sheet read (${rows.length} links, ${added} new) — nothing queued${opts.only ? ` for "${opts.only}"` : ''}; everything is already imported. \`saved_import_status\` has the breakdown.` };
    await ctx.settings.set(ACTIVE_KEY, '1');
    void run({ only: opts.only, actor: opts.actor }).catch((err) => ctx.log.error({ err }, 'saved import failed'));
    const collections = new Set(rows.map((r) => r.collection)).size;
    return { started: true, message: `on it — ${n} video(s) queued from ${collections} collection(s) (${added} new from the sheet). About ${Math.ceil((n * (c.pace_ms + 9000)) / 60000)} min at the current pace; progress every 25 in #ops-log, and I'll learn from the whole set when it's done.` };
  }

  async function run(opts: { only?: string; actor?: string; resume?: boolean }) {
    if (running) return;
    running = true;
    const c = cfg();
    const t = { filed: 0, dupe: 0, skipped: 0, failed: 0 };
    try {
      const queue = await sql<QueueRow[]>`SELECT url, collection, author, kind, position FROM bot.saved_imports WHERE status = 'queued' ${opts.only ? sql`AND collection ILIKE ${'%' + opts.only + '%'}` : sql``} ORDER BY collection, position NULLS LAST, created_at`;
      progress = { done: 0, total: queue.length, collection: '' };
      await ctx.ops(MODULE, 'saved-import-started', { actor: opts.actor, data: { total: queue.length, only: opts.only ?? null, resume: Boolean(opts.resume) }, text: `${opts.resume ? 'resuming' : 'starting'} the saved-collections import: ${queue.length} video(s)` });

      for (let i = 0; i < queue.length; i += c.batch) {
        const batch = queue.slice(i, i + c.batch);
        // already in the library (inbox, scout, earlier run) → just tag the item with the collection
        const fresh: QueueRow[] = [];
        for (const row of batch) {
          const existing = await deps.itemByUrl(row.url);
          if (existing) {
            await sql`UPDATE bot.library_items SET collection = COALESCE(collection, ${row.collection}), for_person = COALESCE(for_person, ${person(row.collection) ?? null}) WHERE id = ${existing.id}`;
            await mark(row.url, 'dupe', { item_id: existing.id, genre: existing.genre });
            t.dupe++;
            progress.done++;
          } else fresh.push(row);
        }
        if (!fresh.length) continue;

        const cands = await ctx.api.apify.byUrls(fresh.map((r) => r.url)).catch((err) => {
          ctx.log.warn({ err }, 'saved import: apify batch failed');
          return [] as ReelCandidate[];
        });
        const byUrl = new Map<string, ReelCandidate>();
        for (const cand of cands) {
          byUrl.set(canonicalUrl(cand.url), cand);
          if (cand.inputUrl) byUrl.set(canonicalUrl(cand.inputUrl), cand);
        }

        for (const row of fresh) {
          progress.collection = row.collection;
          const cand = byUrl.get(row.url);
          if (!cand) {
            await mark(row.url, 'failed', { note: 'not returned by Apify (private account, deleted, or a hiccup — re-run later)' });
            t.failed++;
            progress.done++;
            continue;
          }
          if (!cand.author && row.author) cand.author = row.author;
          const r = rule(row.collection);
          const who = person(row.collection);
          const hint = [`the owner saved this in his "${row.collection}" folder — it is by definition something he wants the girls to copy; keep it unless it is unusable`, r?.hint, who ? `saved specifically for ${who}` : ''].filter(Boolean).join(' · ');
          const forceGenre = r?.genre && deps.genreExists(r.genre) ? r.genre : undefined;
          try {
            const res = await deps.ingest([row.url], { origin: 'saved', addedBy: opts.actor, hint, forceGenre, candidates: [cand] });
            if (res.posted.length) {
              const item = await deps.itemByUrl(canonicalUrl(cand.url));
              if (item) await sql`UPDATE bot.library_items SET collection = ${row.collection}, for_person = ${who ?? null} WHERE id = ${item.id}`;
              await mark(row.url, 'filed', { item_id: item?.id ?? null, genre: item?.genre ?? forceGenre ?? null });
              t.filed++;
            } else if (res.dupes) {
              await mark(row.url, 'dupe', {});
              t.dupe++;
            } else if (res.skipped) {
              await mark(row.url, 'skipped', { note: 'Claude: not library material' });
              t.skipped++;
            } else {
              await mark(row.url, 'failed', { note: 'download/post failed' });
              t.failed++;
            }
          } catch (err) {
            await mark(row.url, 'failed', { note: (err as Error).message.slice(0, 200) });
            t.failed++;
          }
          progress.done++;
          if (progress.done % 25 === 0) await ctx.ops(MODULE, 'saved-import-progress', { data: { ...t, done: progress.done, total: progress.total }, text: `${progress.done}/${progress.total} — ${t.filed} filed, ${t.dupe} already in, ${t.skipped} skipped, ${t.failed} failed (now: ${row.collection})` });
          await new Promise((r) => setTimeout(r, c.pace_ms));
        }
      }

      const left = await queued();
      if (!left) await ctx.settings.set(ACTIVE_KEY, '0');
      await ctx.ops(MODULE, 'saved-import-done', { actor: opts.actor, data: { ...t, total: progress.total, left }, text: `saved-collections import done: ${t.filed} filed, ${t.dupe} already in, ${t.skipped} skipped, ${t.failed} failed${left ? ` · ${left} still queued (other collections)` : ''} — learning from the set now` });
      const l = await learn();
      await ctx.ops(MODULE, 'learned', { data: l, text: `learned from the saves: ${l.accounts} seed account(s) → the scout, taste profile ${l.taste ? `written (${l.words} words)${l.sha ? ' — live after the restart' : ''}` : 'unchanged'}` });
    } finally {
      running = false;
    }
  }

  async function mark(url: string, status: string, extra: { item_id?: number | null; genre?: string | null; note?: string }) {
    await sql`UPDATE bot.saved_imports SET status = ${status}, item_id = ${extra.item_id ?? null}, genre = ${extra.genre ?? null}, note = ${extra.note ?? null}, imported_at = now() WHERE url = ${url}`;
  }

  async function status() {
    const rows = await sql<{ collection: string; status: string; n: number }[]>`SELECT collection, status, count(*)::int AS n FROM bot.saved_imports GROUP BY 1, 2 ORDER BY 1, 2`;
    if (!rows.length) return 'nothing imported yet — fill the sheet and run `/library import`';
    const by = new Map<string, Record<string, number>>();
    for (const r of rows) by.set(r.collection, { ...(by.get(r.collection) ?? {}), [r.status]: r.n });
    const lines = [...by.entries()].map(([c, s]) => `• ${c}: ${Object.entries(s).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    return [`${running ? `▶️ running — ${progress.done}/${progress.total} (${progress.collection})` : '⏸ not running'}`, ...lines].join('\n').slice(0, 1900);
  }

  /** Seed accounts from repeat authors + Claude-written taste profile → knowledge/taste.md (committed so it survives redeploys). */
  async function learn(): Promise<{ accounts: number; taste: boolean; words: number; sha?: string }> {
    const authors = await sql<{ author: string; genre: string; n: number }[]>`
      SELECT author, genre, count(*)::int AS n FROM bot.library_items
      WHERE collection IS NOT NULL AND author IS NOT NULL AND author <> ''
      GROUP BY 1, 2 HAVING count(*) >= 2 ORDER BY n DESC LIMIT 200`;
    for (const a of authors) {
      const weight = Math.min(1.5, 0.9 + 0.1 * a.n);
      await sql`INSERT INTO bot.library_sources (genre, kind, value, weight, added_by) VALUES (${a.genre}, 'account', ${a.author.toLowerCase()}, ${weight}, 'saved-import')
                ON CONFLICT (genre, kind, value) DO UPDATE SET weight = GREATEST(bot.library_sources.weight, EXCLUDED.weight)`;
    }

    const items = await sql<{ collection: string; genre: string; title: string | null; why: string | null; copy_brief: string | null; author: string | null; stats: Record<string, unknown>; score: number | null; for_person: string | null }[]>`
      SELECT collection, genre, title, why, copy_brief, author, stats, score, for_person FROM bot.library_items
      WHERE collection IS NOT NULL ORDER BY collection, COALESCE(score, 0) DESC, created_at DESC LIMIT 260`;
    if (items.length < 5) return { accounts: authors.length, taste: false, words: 0 };
    const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
    const byCol = new Map<string, string[]>();
    for (const it of items) {
      const nums = [it.stats?.likes ? `❤️${compact.format(Number(it.stats.likes))}` : '', it.stats?.comments ? `💬${compact.format(Number(it.stats.comments))}` : ''].filter(Boolean).join(' ');
      const line = `  - [${it.genre}] ${it.title ?? ''} — why: ${it.why ?? ''} — copy: ${it.copy_brief ?? ''}${it.author ? ` (@${it.author}` + (nums ? ` ${nums}` : '') + ')' : ''}`;
      byCol.set(it.collection, [...(byCol.get(it.collection) ?? []), line]);
    }
    const saves = [...byCol.entries()].map(([c, lines]) => `${c}${items.find((i) => i.collection === c)?.for_person ? ` (for ${items.find((i) => i.collection === c)?.for_person})` : ''}:\n${lines.slice(0, 25).join('\n')}`).join('\n\n').slice(0, 60_000);
    const md = await ctx.api.claude.text(loadPrompt('library.taste', { industry: industryLens(2500), saves, max_words: '900', date: new Date().toISOString().slice(0, 10) }), { maxTokens: 2500, temperature: 0.3 });
    if (!md.trim().startsWith('#')) return { accounts: authors.length, taste: false, words: 0 };
    mkdirSync(dirname(TASTE_FILE), { recursive: true });
    writeFileSync(TASTE_FILE, md.trim() + '\n');
    let sha: string | undefined;
    if (github.enabled) sha = await github.commitFiles([{ path: 'knowledge/taste.md', content: md.trim() + '\n' }], `Taste profile from the owner's saved collections (${items.length} videos)`).catch((err) => {
      ctx.log.warn({ err }, 'taste.md commit failed (kept locally until the next restart)');
      return undefined;
    });
    return { accounts: authors.length, taste: true, words: md.split(/\s+/).length, sha };
  }

  /** "Leah" / "Ideas for Bryce" → her reels board when she is onboarded. */
  async function deliverPersonCollection(model: Model) {
    const names = [...new Set([model.slug, model.slug.split('-')[0], model.display_name.split(/\s+/)[0].toLowerCase()])].filter(Boolean);
    const items = await sql<ItemRow[]>`
      SELECT i.* FROM bot.library_items i
      WHERE i.for_person = ANY(${names})
        AND NOT EXISTS (SELECT 1 FROM bot.library_deliveries d WHERE d.item_id = i.id AND d.model_slug = ${model.slug})
      ORDER BY COALESCE(i.score, 0) DESC, i.created_at DESC LIMIT 25`;
    if (!items.length) return;
    for (const it of items) {
      await deps.sendToBoard(it, model.slug, 'saved-import');
      await sql`INSERT INTO bot.library_deliveries (item_id, model_slug) VALUES (${it.id}, ${model.slug}) ON CONFLICT DO NOTHING`;
      await new Promise((r) => setTimeout(r, 2500));
    }
    await ctx.send(model.discord.channels.general, { content: `📌 ${items.length} video(s) the owners saved specifically for you are on your **reels board** — those are the ones to start with.`, allowedMentions: { parse: [] } });
    await ctx.ops(MODULE, 'person-collection-delivered', { model, data: { items: items.length } });
  }

  return { start, status, learn, taste: () => (existsSync(TASTE_FILE) ? readFileSync(TASTE_FILE, 'utf8') : '') };
}
