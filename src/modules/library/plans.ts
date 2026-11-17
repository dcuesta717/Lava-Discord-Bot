import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChannelType, Events, ForumLayoutType, type ForumChannel, type ThreadChannel } from 'discord.js';
import YAML from 'yaml';
import { z } from 'zod';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { canonicalUrl, type ReelCandidate } from '../../integrations/apify.js';
import type { IngestOpts, IngestResult, ItemRow } from './index.js';

/**
 * Content plans — "Content House — December" and any shoot list like it.
 *
 *   input    library/plans/<slug>.yaml: one section per tab of the owners' planning sheet (shared formats + one tab per girl),
 *            every link HAND-PICKED by the owners. Sections can force a folder, steer Claude with a hint, carry the owners'
 *            notes, or hold plain text lines (the caption bank).
 *   queue    bot.plan_items — one row per (plan, section, link): durable, survives restarts, never re-does a link. The same reel
 *            is often on several tabs; it is fetched once and every section row points at the one library post.
 *   run      /library plan  or  "@Lava Bot import the content house plan" → background, paced, progress in #ops-log.
 *            keep_all: Claude still writes the notes, but nothing is rejected — the owners already chose these.
 *   render   one forum under 🎬 CONTENT LIBRARY (🏠-content-house-dec), one thread per section listing every video with its
 *            notes + a link to the library post (the video lives there, with 🔥/👎/📋), and a pinned overview thread.
 *   deliver  a girl's own section lands on her reels board the moment she is onboarded (model slug / first name match).
 */
const MODULE = 'library';
const DIR = join(process.cwd(), 'library', 'plans');
const ACTIVE_KEY = 'library.plan.active';
const OVERVIEW = '__overview';

const urlEntry = z.union([z.string().url(), z.object({ url: z.string().url(), note: z.string().optional() })]);
const sectionSchema = z.object({
  name: z.string().min(1).max(90),
  sheet_tab: z.string().optional(),
  person: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(), // her own list → her board when she is live
  folder: z.string().optional(), // force a library folder (genre slug)
  hint: z.string().optional(), // steer Claude's notes
  ideas: z.array(z.string()).default([]), // text ideas with no link (from the sheet)
  urls: z.array(urlEntry).default([]),
  lines: z.array(z.string()).default([]), // text-only section (caption bank)
});
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(80),
  emoji: z.string().default('🗂️'),
  intro: z.string().default(''),
  keep_all: z.boolean().default(true),
  pace_ms: z.number().int().min(500).max(60_000).default(3500),
  batch: z.number().int().min(1).max(20).default(8),
  sections: z.array(sectionSchema).min(1),
});
export type Plan = z.infer<typeof schema>;
export type PlanSection = z.infer<typeof sectionSchema>;

export function listPlans(): string[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort();
}

export function loadPlan(slug: string): Plan {
  const file = join(DIR, `${slug}.yaml`);
  if (!existsSync(file)) throw new Error(`no plan "${slug}" — have: ${listPlans().join(', ') || 'none'}`);
  const plan = schema.parse(YAML.parse(readFileSync(file, 'utf8')));
  if (plan.slug !== slug) throw new Error(`library/plans/${slug}.yaml says slug: ${plan.slug}`);
  const names = new Set<string>();
  for (const s of plan.sections) {
    if (names.has(s.name)) throw new Error(`plan ${slug}: duplicate section "${s.name}"`);
    names.add(s.name);
  }
  return plan;
}

const entryUrl = (e: z.infer<typeof urlEntry>) => canonicalUrl(typeof e === 'string' ? e : e.url);
const entryNote = (e: z.infer<typeof urlEntry>) => (typeof e === 'string' ? undefined : e.note?.trim() || undefined);

interface PlanRow {
  plan: string;
  section: string;
  url: string;
  position: number | null;
  note: string | null;
  status: string;
  item_id: string | null;
  detail: string | null;
}

export interface PlanDeps {
  ingest(urls: string[], opts: IngestOpts): Promise<IngestResult>;
  genreExists(slug: string): boolean;
  genreLabel(slug: string): string;
  itemByUrl(canonical: string): Promise<ItemRow | undefined>;
  sendToBoard(item: ItemRow, slug: string, actor: string): Promise<void>;
  ensureForum(name: string, topic: string, settingsKey: string, layout: ForumLayoutType): Promise<ForumChannel | undefined>;
  learn(): Promise<unknown>;
}

export function registerPlans(ctx: BotContext, deps: PlanDeps) {
  const sql = ctx.db;
  let running = false;
  let progress = { done: 0, total: 0, section: '', plan: '' };

  const defaultPlan = () => (listPlans().length === 1 ? listPlans()[0] : undefined);
  const guildUrl = (threadId: string) => `https://discord.com/channels/${ctx.env.DISCORD_GUILD_ID}/${threadId}`;

  // resume an interrupted run after a restart
  ctx.client.once(Events.ClientReady, async () => {
    await ctx.ready;
    const active = ctx.settings.getString(ACTIVE_KEY);
    if (!active || !ctx.api.apify.enabled) return;
    if (!listPlans().includes(active)) return void (await ctx.settings.set(ACTIVE_KEY, ''));
    const n = await queued(active);
    if (n) {
      ctx.log.info({ module: MODULE, plan: active, n }, 'resuming content plan import');
      void run({ slug: active, resume: true }).catch((err) => ctx.log.error({ err }, 'plan import resume failed'));
    } else await ctx.settings.set(ACTIVE_KEY, '');
  });

  // her section → her board when she goes live
  ctx.bus.on('model:live', ({ model }: { model: Model }) => {
    deliverTo(model).catch((err) => ctx.log.warn({ err, model: model.slug }, 'plan delivery failed'));
  });

  ctx.action('import_content_plan', {
    description:
      'Import a content plan (a hand-picked shoot list such as "Content House — December", library/plans/<slug>.yaml) into the Content Library: every link → Apify → Claude notes → filed in its folder (never rejected), then one forum thread per section of the plan and each girl\'s own section on her reels board. Background, paced; progress in #ops-log. `plan` is the slug; omit when there is only one plan.',
    input: { type: 'object', properties: { plan: { type: 'string', description: 'plan slug (optional when there is one plan)' } } },
    ownersOnly: true,
    slow: true,
    run: async (input, actor) => {
      if (!ctx.api.apify.enabled) return 'APIFY_TOKEN is not set';
      const slug = input.plan ? String(input.plan) : defaultPlan();
      if (!slug) return `which plan? have: ${listPlans().join(', ') || 'none'}`;
      return (await start({ slug, actor: actor.userId })).message;
    },
  });
  ctx.action('content_plan_status', {
    description: 'How a content plan import is going: per section, how many videos are filed / queued / failed, and whether a run is active.',
    input: { type: 'object', properties: { plan: { type: 'string', description: 'plan slug (optional when there is one plan)' } } },
    ownersOnly: true,
    run: async (input) => {
      const slug = input.plan ? String(input.plan) : defaultPlan();
      return slug ? status(slug) : `which plan? have: ${listPlans().join(', ') || 'none'}`;
    },
  });
  ctx.action('render_content_plan', {
    description: 'Rebuild the content plan forum in Discord from what is already imported (one thread per section + overview) without fetching anything. Use after a failed render or when the plan file changed.',
    input: { type: 'object', properties: { plan: { type: 'string', description: 'plan slug (optional when there is one plan)' } } },
    ownersOnly: true,
    slow: true,
    run: async (input) => {
      const slug = input.plan ? String(input.plan) : defaultPlan();
      if (!slug) return `which plan? have: ${listPlans().join(', ') || 'none'}`;
      const r = await render(loadPlan(slug));
      return r ? `rendered ${r.sections} section thread(s) in <#${r.forum}>` : 'could not render — is the Content Library set up?';
    },
  });

  async function queued(slug: string) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM bot.plan_items WHERE plan = ${slug} AND status = 'queued'`;
    return n;
  }

  /** Sync the yaml into the queue (new links only — statuses are never touched) and start the background run. */
  async function start(opts: { slug: string; actor?: string }): Promise<{ started: boolean; message: string }> {
    if (running) return { started: false, message: `a plan import is already running — ${progress.done}/${progress.total} done (${progress.plan}: ${progress.section}). Check #ops-log.` };
    let plan: Plan;
    try {
      plan = loadPlan(opts.slug);
    } catch (err) {
      return { started: false, message: `couldn't read the plan: ${(err as Error).message}` };
    }
    let added = 0;
    for (const s of plan.sections) {
      let pos = 0;
      const seen = new Set<string>();
      for (const e of s.urls) {
        const url = entryUrl(e);
        if (seen.has(url)) continue;
        seen.add(url);
        const res = await sql<{ inserted: boolean }[]>`
          INSERT INTO bot.plan_items (plan, section, url, position, note)
          VALUES (${plan.slug}, ${s.name}, ${url}, ${pos++}, ${entryNote(e) ?? null})
          ON CONFLICT (plan, section, url) DO UPDATE SET position = EXCLUDED.position, note = COALESCE(EXCLUDED.note, bot.plan_items.note)
          RETURNING (xmax = 0) AS inserted`;
        if (res[0]?.inserted) added++;
      }
    }
    const n = await queued(plan.slug);
    const links = plan.sections.reduce((a, s) => a + s.urls.length, 0);
    if (!n) {
      void render(plan).catch((err) => ctx.log.warn({ err }, 'plan render failed'));
      return { started: false, message: `${plan.title}: ${links} link(s) in ${plan.sections.length} section(s), ${added} new — nothing left to fetch; refreshing the forum threads instead. \`content_plan_status\` has the breakdown.` };
    }
    await ctx.settings.set(ACTIVE_KEY, plan.slug);
    void run({ slug: plan.slug, actor: opts.actor }).catch((err) => ctx.log.error({ err }, 'plan import failed'));
    const unique = new Set(plan.sections.flatMap((s) => s.urls.map(entryUrl))).size;
    return { started: true, message: `on it — ${plan.title}: ${n} link(s) queued across ${plan.sections.filter((s) => s.urls.length).length} section(s) (${unique} different videos, ${added} new). About ${Math.ceil((unique * (plan.pace_ms + 9000)) / 60000)} min at the current pace; progress every 25 in #ops-log, then the forum threads and each girl's list on her board.` };
  }

  async function run(opts: { slug: string; actor?: string; resume?: boolean }) {
    if (running) return;
    running = true;
    const plan = loadPlan(opts.slug);
    const order = new Map(plan.sections.map((s, i) => [s.name, i]));
    const section = (name: string) => plan.sections.find((s) => s.name === name);
    const t = { filed: 0, linked: 0, failed: 0 };
    try {
      const rows = await sql<PlanRow[]>`SELECT plan, section, url, position, note, status, item_id::text, detail FROM bot.plan_items WHERE plan = ${plan.slug} AND status = 'queued'`;
      rows.sort((a, b) => (order.get(a.section) ?? 999) - (order.get(b.section) ?? 999) || (a.position ?? 0) - (b.position ?? 0));
      // one fetch per video, however many sections it is on
      const byUrl = new Map<string, PlanRow[]>();
      for (const r of rows) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), r]);
      const urls = [...byUrl.keys()];
      progress = { done: 0, total: urls.length, section: '', plan: plan.slug };
      await ctx.ops(MODULE, 'plan-import-started', { actor: opts.actor, data: { plan: plan.slug, videos: urls.length, rows: rows.length, resume: Boolean(opts.resume) }, text: `${opts.resume ? 'resuming' : 'starting'} the ${plan.title} import: ${urls.length} video(s) across ${rows.length} list entries` });

      for (let i = 0; i < urls.length; i += plan.batch) {
        const batch = urls.slice(i, i + plan.batch);
        const fresh: string[] = [];
        for (const url of batch) {
          const existing = await deps.itemByUrl(url);
          if (existing) {
            await link(plan, byUrl.get(url)!, existing, 'already in the library');
            t.linked++;
            progress.done++;
          } else fresh.push(url);
        }
        if (!fresh.length) continue;

        const cands = await ctx.api.apify.byUrls(fresh).catch((err) => {
          ctx.log.warn({ err }, 'plan import: apify batch failed');
          return [] as ReelCandidate[];
        });
        const found = new Map<string, ReelCandidate>();
        for (const cand of cands) {
          found.set(canonicalUrl(cand.url), cand);
          if (cand.inputUrl) found.set(canonicalUrl(cand.inputUrl), cand);
        }

        for (const url of fresh) {
          const members = byUrl.get(url)!;
          const primary = members[0];
          progress.section = primary.section;
          const cand = found.get(url);
          if (!cand) {
            await markAll(plan.slug, members, 'failed', { detail: 'not returned by Apify (private account, deleted, or a hiccup — re-run later)' });
            t.failed++;
            progress.done++;
            continue;
          }
          const sec = section(primary.section);
          const others = members.slice(1).map((m) => m.section);
          const person = members.map((m) => section(m.section)?.person).find(Boolean);
          const hint = [
            `HAND-PICKED by the owners for "${plan.title}" → section "${primary.section}"${others.length ? ` (also on: ${others.join(', ')})` : ''} — it WILL be filed; write the notes as the version the girls film`,
            sec?.hint,
            members.map((m) => m.note).find(Boolean) ? `owners' note: "${members.map((m) => m.note).find(Boolean)}"` : '',
            person ? `this is on ${person}'s own list` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          const folder = members.map((m) => section(m.section)?.folder).find((f) => f && deps.genreExists(f));
          try {
            const res = await deps.ingest([url], { origin: 'plan', addedBy: opts.actor, hint, forceGenre: folder, keepAll: plan.keep_all, candidates: [cand] });
            const item = await deps.itemByUrl(url);
            if (res.posted.length && item) {
              await link(plan, members, item);
              t.filed++;
            } else if (res.dupes && item) {
              await link(plan, members, item, 'already in the library');
              t.linked++;
            } else if (res.skipped) {
              await markAll(plan.slug, members, 'skipped', { detail: `Claude: ${res.rejected[0]?.reason ?? 'not library material'}` });
              t.failed++;
            } else {
              await markAll(plan.slug, members, 'failed', { detail: 'download/post failed' });
              t.failed++;
            }
          } catch (err) {
            await markAll(plan.slug, members, 'failed', { detail: (err as Error).message.slice(0, 200) });
            t.failed++;
          }
          progress.done++;
          if (progress.done % 25 === 0) await ctx.ops(MODULE, 'plan-import-progress', { data: { plan: plan.slug, ...t, done: progress.done, total: progress.total }, text: `${plan.title}: ${progress.done}/${progress.total} — ${t.filed} filed, ${t.linked} already in, ${t.failed} failed (now: ${primary.section})` });
          await new Promise((r) => setTimeout(r, plan.pace_ms));
        }
      }

      const left = await queued(plan.slug);
      if (!left) await ctx.settings.set(ACTIVE_KEY, '');
      await ctx.ops(MODULE, 'plan-import-done', { actor: opts.actor, data: { plan: plan.slug, ...t, total: progress.total, left }, text: `${plan.title} import done: ${t.filed} filed, ${t.linked} already in, ${t.failed} failed${left ? ` · ${left} still queued` : ''} — building the forum threads now` });

      const r = await render(plan).catch((err) => {
        ctx.log.error({ err }, 'plan render failed');
        return undefined;
      });
      if (r) await ctx.ops(MODULE, 'plan-rendered', { data: { plan: plan.slug, ...r }, text: `${plan.title}: ${r.sections} section thread(s) in <#${r.forum}>` });
      for (const model of ctx.models.all()) await deliverTo(model, plan).catch((err) => ctx.log.warn({ err, model: model.slug }, 'plan delivery failed'));
      await deps.learn().catch((err) => ctx.log.warn({ err }, 'learn after plan import failed'));
    } finally {
      running = false;
    }
  }

  /** Point every section row of this video at the one library post (+ remember the plan on the item for the taste profile). */
  async function link(plan: Plan, members: PlanRow[], item: ItemRow, detail?: string) {
    await markAll(plan.slug, members, 'filed', { item_id: item.id, genre: item.genre, detail });
    await sql`UPDATE bot.library_items SET collection = COALESCE(collection, ${`${plan.title} · ${members[0].section}`}) WHERE id = ${item.id}`;
  }

  async function markAll(slug: string, members: PlanRow[], status: string, extra: { item_id?: number | string | null; genre?: string | null; detail?: string }) {
    for (const m of members)
      await sql`UPDATE bot.plan_items SET status = ${status}, item_id = ${extra.item_id ?? null}, genre = ${extra.genre ?? null}, detail = ${extra.detail ?? null}, imported_at = now() WHERE plan = ${slug} AND section = ${m.section} AND url = ${m.url}`;
  }

  async function status(slug: string) {
    let plan: Plan;
    try {
      plan = loadPlan(slug);
    } catch (err) {
      return (err as Error).message;
    }
    const rows = await sql<{ section: string; status: string; n: number }[]>`SELECT section, status, count(*)::int AS n FROM bot.plan_items WHERE plan = ${slug} GROUP BY 1, 2`;
    if (!rows.length) return `${plan.title}: nothing imported yet — run \`/library plan\``;
    const forum = ctx.settings.getString(`library.plan.${slug}.forum`);
    const lines = plan.sections
      .filter((s) => s.urls.length)
      .map((s) => {
        const mine = rows.filter((r) => r.section === s.name);
        const parts = mine.map((r) => `${r.n} ${r.status}`).join(', ');
        return `• ${s.name}${s.person ? ` (${s.person})` : ''}: ${parts || 'not queued yet'}`;
      });
    const head = running && progress.plan === slug ? `▶️ running — ${progress.done}/${progress.total} (${progress.section})` : `⏸ not running${forum ? ` · <#${forum}>` : ''}`;
    return [head, ...lines].join('\n').slice(0, 1900);
  }

  // ── Discord: one forum, one thread per section, a pinned overview ────────────
  async function render(plan: Plan): Promise<{ forum: string; sections: number } | undefined> {
    const key = `library.plan.${plan.slug}.forum`;
    const forum = await deps.ensureForum(`${plan.emoji.replace(/️/g, '')}-${plan.slug}`, `${plan.title} — the owners' shoot list, one thread per section. ${plan.intro}`.slice(0, 1024), key, ForumLayoutType.ListView);
    if (!forum) return undefined;
    const me = ctx.client.user!.id;
    const known = new Map((await sql<{ section: string; thread_id: string }[]>`SELECT section, thread_id FROM bot.plan_threads WHERE plan = ${plan.slug}`).map((r) => [r.section, r.thread_id]));

    const items = await sql<(PlanRow & { title: string | null; why: string | null; copy_brief: string | null; genre: string | null; posts: ItemRow['posts'] | null; author: string | null })[]>`
      SELECT pi.plan, pi.section, pi.url, pi.position, pi.note, pi.status, pi.item_id::text, pi.detail, li.title, li.why, li.copy_brief, li.genre, li.posts, li.author
      FROM bot.plan_items pi LEFT JOIN bot.library_items li ON li.id = pi.item_id
      WHERE pi.plan = ${plan.slug} ORDER BY pi.position NULLS LAST, pi.created_at`;

    const threadIds = new Map<string, string>();
    // newest-first forum: create in reverse so the sheet's order (shared formats first, then each girl) reads top-down
    const sections = [...plan.sections].reverse();
    for (const s of sections) {
      const mine = items.filter((r) => r.section === s.name);
      if (!mine.length && !s.lines.length && !s.ideas.length) continue;
      const filed = mine.filter((r) => r.status === 'filed' && r.item_id);
      const header = [
        `## ${s.name}${s.person ? ` — ${cap(s.person)}'s own list` : ''}`,
        s.lines.length ? `${s.lines.length} caption(s) the owners wrote — use them as they are or in your own words.` : `**${filed.length}** video(s)${mine.length !== filed.length ? ` (${mine.length - filed.length} still to fetch)` : ''}${s.folder ? ` · folder: ${deps.genreLabel(s.folder)}` : ''}`,
        s.hint && !s.lines.length ? `_${s.hint}_` : '',
        s.ideas.length ? `💡 ideas from the sheet (no link): ${s.ideas.map((i) => `"${i}"`).join(' · ')}` : '',
        `Every number below is a library post — open it for the video, 🔥 it if you'd film it, 📋 Copy this puts it on your board.`,
      ]
        .filter(Boolean)
        .join('\n');

      const lines: string[] = s.lines.length
        ? s.lines.map((l, k) => `**${k + 1}.** ${l}`)
        : mine.map((r, k) => {
            const n = `**${k + 1}.`;
            if (r.status !== 'filed' || !r.item_id) return `${n}** ⚠️ not fetched yet — <${r.url}>${r.note ? ` · 📝 ${r.note}` : ''}${r.detail ? ` _(${r.detail})_` : ''}`;
            const post = r.posts?.[0];
            return [
              `${n} ${r.title ?? 'untitled'}** · ${r.genre ? deps.genreLabel(r.genre) : ''}${r.author ? ` · @${r.author}` : ''}`,
              r.why ? `_why:_ ${r.why}` : '',
              r.copy_brief ? `_do:_ ${r.copy_brief}` : '',
              r.note ? `📝 owners: ${r.note}` : '',
              `${post ? guildUrl(post.thread_id) : ''} · <${r.url}>`,
            ]
              .filter(Boolean)
              .join('\n');
          });

      const thread = await upsertThread(forum, known.get(s.name), `${s.name}${s.person ? ' — her list' : ''}`.slice(0, 100), header, chunk(lines), me);
      if (thread) {
        threadIds.set(s.name, thread.id);
        await sql`INSERT INTO bot.plan_threads (plan, section, thread_id, rendered_at) VALUES (${plan.slug}, ${s.name}, ${thread.id}, now()) ON CONFLICT (plan, section) DO UPDATE SET thread_id = EXCLUDED.thread_id, rendered_at = now()`;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    // overview, pinned, created last so it sits on top
    const total = items.filter((r) => r.status === 'filed').length;
    const toc = plan.sections
      .filter((s) => threadIds.has(s.name))
      .map((s) => {
        const n = s.lines.length || items.filter((r) => r.section === s.name && r.status === 'filed').length;
        return `• <#${threadIds.get(s.name)}> — ${s.lines.length ? `${n} caption(s)` : `${n} video(s)`}${s.person ? ` · ${cap(s.person)}'s own list` : ''}`;
      });
    const overview = await upsertThread(forum, known.get(OVERVIEW), `${plan.emoji} ${plan.title} — start here`.slice(0, 100), [`## ${plan.title}`, plan.intro, `**${total}** videos filed across **${threadIds.size}** sections.`].filter(Boolean).join('\n'), chunk(toc), me);
    if (overview) {
      await sql`INSERT INTO bot.plan_threads (plan, section, thread_id, rendered_at) VALUES (${plan.slug}, ${OVERVIEW}, ${overview.id}, now()) ON CONFLICT (plan, section) DO UPDATE SET thread_id = EXCLUDED.thread_id, rendered_at = now()`;
      if (!overview.flags.has('Pinned')) await overview.pin().catch(() => undefined);
    }
    return { forum: forum.id, sections: threadIds.size };
  }

  /** Create the section thread, or refresh it in place: edit the header, replace the bot's list messages, keep everyone's replies. */
  async function upsertThread(forum: ForumChannel, existingId: string | undefined, name: string, header: string, bodies: string[], me: string): Promise<ThreadChannel | undefined> {
    let thread = existingId ? ((await ctx.client.channels.fetch(existingId).catch(() => null)) as ThreadChannel | null) : null;
    if (thread && (!thread.isThread() || thread.parentId !== forum.id)) thread = null;
    if (!thread) {
      thread = await forum.threads.create({ name, message: { content: header.slice(0, 1990), allowedMentions: { parse: [] } } }).catch((err) => {
        ctx.log.warn({ err, name }, 'plan thread create failed');
        return null;
      });
      if (!thread) return undefined;
    } else {
      if (thread.archived) await thread.setArchived(false).catch(() => undefined);
      if (thread.name !== name) await thread.setName(name).catch(() => undefined);
      const starter = await thread.fetchStarterMessage().catch(() => null);
      if (starter && starter.content !== header.slice(0, 1990)) await starter.edit({ content: header.slice(0, 1990), allowedMentions: { parse: [] } }).catch(() => undefined);
      const msgs = await thread.messages.fetch({ limit: 100 }).catch(() => null);
      for (const m of msgs?.values() ?? []) {
        if (m.author.id !== me || m.id === thread.id) continue;
        await m.delete().catch(() => undefined);
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    for (const body of bodies) {
      await thread.send({ content: body, allowedMentions: { parse: [] } }).catch((err) => ctx.log.warn({ err, name }, 'plan thread message failed'));
      await new Promise((r) => setTimeout(r, 700));
    }
    return thread;
  }

  // ── her list → her board ─────────────────────────────────────────────────────
  async function deliverTo(model: Model, only?: Plan) {
    const names = new Set([model.slug, model.slug.split('-')[0], model.display_name.split(/\s+/)[0].toLowerCase()].filter(Boolean));
    const plans = only ? [only] : listPlans().map((s) => loadPlan(s));
    for (const plan of plans) {
      for (const s of plan.sections.filter((x) => x.person && names.has(x.person))) {
        const items = await sql<ItemRow[]>`
          SELECT li.* FROM bot.plan_items pi JOIN bot.library_items li ON li.id = pi.item_id
          WHERE pi.plan = ${plan.slug} AND pi.section = ${s.name} AND pi.status = 'filed'
            AND NOT EXISTS (SELECT 1 FROM bot.library_deliveries d WHERE d.item_id = li.id AND d.model_slug = ${model.slug})
          ORDER BY pi.position NULLS LAST`;
        if (!items.length) continue;
        for (const it of items) {
          await sql`INSERT INTO bot.library_deliveries (item_id, model_slug) VALUES (${it.id}, ${model.slug}) ON CONFLICT DO NOTHING`;
          await deps.sendToBoard(it, model.slug, 'content-plan');
          await new Promise((r) => setTimeout(r, 2500));
        }
        const thread = (await sql<{ thread_id: string }[]>`SELECT thread_id FROM bot.plan_threads WHERE plan = ${plan.slug} AND section = ${s.name}`)[0]?.thread_id;
        await ctx.send(model.discord.channels.general, { content: `📌 **${items.length} video(s) the owners picked for you** for ${plan.title} are on your **reels board** with a brief each${thread ? ` — the full list with notes is in <#${thread}>` : ''}. Start there.`, allowedMentions: { parse: [] } });
        await ctx.ops(MODULE, 'plan-delivered', { model, data: { plan: plan.slug, section: s.name, items: items.length } });
      }
    }
  }

  return { start, status, render: (slug: string) => render(loadPlan(slug)), deliverTo, list: listPlans };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pack lines into ≤ 1900-char Discord messages, never splitting a line. */
function chunk(lines: string[]): string[] {
  const out: string[] = [];
  let cur = '';
  for (const line of lines) {
    const l = line.length > 1900 ? line.slice(0, 1897) + '…' : line;
    if (cur && cur.length + l.length + 2 > 1900) {
      out.push(cur);
      cur = '';
    }
    cur = cur ? `${cur}\n\n${l}` : l;
  }
  if (cur) out.push(cur);
  return out;
}
