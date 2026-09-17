import { DateTime } from 'luxon';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { loadLibrary } from '../../config/library.js';
import type { ReelCandidate } from '../../integrations/apify.js';
import { canonicalUrl } from '../../integrations/apify.js';
import { loadPrompt } from '../../lib/prompts.js';

/**
 * Daily analytics (Dan: "scrape the creators' accounts every morning and send their numbers").
 *
 *   06:15 (DEFAULT_TIMEZONE)  snapshot: one Apify "details" call per model → bot.account_snapshots (followers)
 *                             + bot.model_posts (her latest ~12 posts, metrics history) → new posts labelled by Claude
 *                             (prompts/post.classify.md: lane + format).
 *   07:00 (her timezone)      her report in #🔔-notification: followers ±, yesterday's posts, 7-day averages, best post.
 *   07:00 (DEFAULT_TIMEZONE)  owners' digest in #daily-report: who didn't post yesterday (+streak), who did (what),
 *                             engagement leaderboard (7-day avg per post, comments per 100 likes), follower movers,
 *                             content mix per model.
 *   /report [model]           regenerate now (owners).
 *
 * Instagram only for now (TikTok: add a tiktok snapshot the same way). Costs ≈ 1 Apify result per model per day.
 */
const MODULE = 'reports';
const SNAPSHOT_CRON = '15 6 * * *';
const REPORT_CRON = '0 7 * * *';

interface PostRow {
  model_slug: string;
  source_url: string;
  kind: string | null;
  caption: string | null;
  posted_at: string | Date | null;
  pinned: boolean;
  genre: string | null;
  format: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
}

interface SnapRow {
  day: string;
  followers: number | null;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n: number | null | undefined) => (n == null ? '—' : compact.format(n));

  ctx.cron('reports:snapshot', SNAPSHOT_CRON, ctx.env.DEFAULT_TIMEZONE, async () => {
    if (!ctx.api.apify.enabled) return;
    const done = await snapshotAll();
    await ctx.ops(MODULE, 'snapshot', { data: done, text: `${done.ok}/${done.total} accounts` });
  });

  for (const model of ctx.models.all()) {
    if (!model.socials.instagram) continue;
    ctx.cron(`reports:model:${model.slug}`, REPORT_CRON, model.timezone, async () => {
      const text = await modelReport(model);
      if (text) await ctx.send(model.discord.channels.notification || model.discord.channels.general, { content: text });
    });
  }

  ctx.bus.on('model:live', ({ model }: { model: Model }) => {
    (async () => {
      if (!ctx.api.apify.enabled || !model.socials.instagram) return;
      await snapshotModel(model);
      const text = await modelReport(model);
      if (text) await ctx.send(model.discord.channels.notification || model.discord.channels.general, { content: `${text}\n_(this is what you'll get here every morning at 7)_` });
    })().catch((err) => ctx.log.warn({ err, model: model.slug }, 'kickoff report failed'));
  });

  ctx.cron('reports:owners', REPORT_CRON, ctx.env.DEFAULT_TIMEZONE, async () => {
    const parts = await ownersDigest();
    for (const p of parts) await ctx.send(ctx.ch('daily_report') || ctx.ch('live_alerts'), { content: p, allowedMentions: { parse: [] } });
  });

  ctx.command(
    new SlashCommandBuilder()
      .setName('report')
      .setDescription('Daily numbers, right now (owners)')
      .addStringOption((o) => o.setName('model').setDescription('One creator (slug) — otherwise the owners digest'))
      .addBooleanOption((o) => o.setName('refresh').setDescription('Re-scrape first (costs an Apify result per model)')),
    async (i) => {
      if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const slug = i.options.getString('model');
      if (i.options.getBoolean('refresh')) {
        if (!ctx.api.apify.enabled) return i.editReply('`APIFY_TOKEN` is not set');
        if (slug) {
          const m = ctx.models.get(slug);
          if (!m) return i.editReply(`unknown model \`${slug}\``);
          await snapshotModel(m).catch((err) => ctx.log.warn({ err, slug }, 'snapshot failed'));
        } else await snapshotAll();
      }
      if (slug) {
        const m = ctx.models.get(slug);
        if (!m) return i.editReply(`unknown model \`${slug}\``);
        return i.editReply((await modelReport(m)) || 'no data yet — run with refresh:true');
      }
      const parts = await ownersDigest();
      await i.editReply(parts[0] ?? 'no data yet');
      for (const p of parts.slice(1)) await i.followUp({ content: p, flags: MessageFlags.Ephemeral });
    },
  );

  // ── chat-callable actions (operator) ────────────────────────────────────────
  ctx.action('daily_report', {
    description: "Today's numbers: the owners' digest (who didn't post, engagement leaderboard, follower movers, content mix) or one creator's report. refresh=true re-scrapes first.",
    input: { type: 'object', properties: { model: { type: 'string', description: 'model slug (optional)' }, refresh: { type: 'boolean' } } },
    ownersOnly: true,
    slow: true,
    run: async (input) => {
      if (input.refresh && ctx.api.apify.enabled) {
        if (input.model) {
          const m = ctx.models.get(String(input.model));
          if (m) await snapshotModel(m).catch(() => undefined);
        } else await snapshotAll();
      }
      if (input.model) {
        const m = ctx.models.get(String(input.model));
        return m ? (await modelReport(m)) || 'no data yet' : `unknown model ${String(input.model)}`;
      }
      return (await ownersDigest()).join('\n');
    },
  });

  // ── snapshot ───────────────────────────────────────────────────────────────
  async function snapshotAll() {
    const models = ctx.models.all().filter((m) => m.socials.instagram);
    let ok = 0;
    for (const m of models) {
      try {
        await snapshotModel(m);
        ok++;
      } catch (err) {
        ctx.log.warn({ err, model: m.slug }, 'snapshot failed');
      }
    }
    return { total: models.length, ok };
  }

  async function snapshotModel(model: Model) {
    const p = await ctx.api.apify.instagramProfile(model.socials.instagram);
    if (!p) throw new Error('profile not returned');
    const day = DateTime.now().setZone(model.timezone).toISODate();
    await sql`INSERT INTO bot.account_snapshots (model_slug, platform, day, followers, follows, posts_count)
              VALUES (${model.slug}, 'instagram', ${day}, ${p.followers}, ${p.follows}, ${p.postsCount})
              ON CONFLICT (model_slug, platform, day) DO UPDATE SET followers = EXCLUDED.followers, follows = EXCLUDED.follows, posts_count = EXCLUDED.posts_count, taken_at = now()`;
    const fresh: ReelCandidate[] = [];
    for (const post of p.latestPosts) {
      const url = canonicalUrl(post.url);
      const point = { at: new Date().toISOString(), likes: post.likes, comments: post.comments ?? 0, views: post.views };
      const rows = await sql<{ genre: string | null }[]>`
        INSERT INTO bot.model_posts (model_slug, platform, source_url, shortcode, kind, caption, posted_at, pinned, audio, hashtags, likes, comments, views, metrics)
        VALUES (${model.slug}, 'instagram', ${url}, ${post.shortcode ?? null}, ${post.kind ?? null}, ${post.caption || null}, ${post.postedAt ?? null}, ${Boolean(post.pinned)}, ${post.audio ?? null}, ${post.hashtags ?? []}, ${post.likes}, ${post.comments ?? 0}, ${post.views}, ${sql.json([point] as never)})
        ON CONFLICT (model_slug, source_url) DO UPDATE SET likes = EXCLUDED.likes, comments = EXCLUDED.comments, views = EXCLUDED.views, pinned = EXCLUDED.pinned,
          metrics = (bot.model_posts.metrics || EXCLUDED.metrics), last_seen = now()
        RETURNING genre`;
      if (rows[0] && rows[0].genre == null) fresh.push({ ...post, url });
    }
    if (fresh.length) await labelPosts(model, fresh).catch((err) => ctx.log.warn({ err, model: model.slug }, 'post labelling failed'));
  }

  async function labelPosts(model: Model, posts: ReelCandidate[]) {
    const genres = loadLibrary()
      .genres.filter((g) => g.active)
      .map((g) => `- ${g.slug} — ${g.name}: ${g.description}`)
      .join('\n');
    const list = posts.map((p) => `url: ${p.url} · ${p.kind ?? 'post'}${p.audio ? ` · audio: ${p.audio}` : ''} · "${(p.caption || '(no caption)').replace(/\s+/g, ' ').slice(0, 200)}"`).join('\n');
    const out = await ctx.api.claude.json<{ url: string; genre: string; format: string }[]>(loadPrompt('post.classify', { genres, model_name: model.display_name, lanes: model.lanes.join(', ') || '(unknown)', posts: list }), { maxTokens: 800 });
    for (const o of Array.isArray(out) ? out : []) {
      if (!o?.url) continue;
      await sql`UPDATE bot.model_posts SET genre = ${o.genre || 'other'}, format = ${(o.format || '').slice(0, 60)} WHERE model_slug = ${model.slug} AND source_url = ${canonicalUrl(o.url)}`;
    }
  }

  // ── reports ────────────────────────────────────────────────────────────────
  async function loadWindow(model: Model, days = 7) {
    const now = DateTime.now().setZone(model.timezone);
    const yStart = now.minus({ days: 1 }).startOf('day');
    const yEnd = now.startOf('day');
    const wStart = now.minus({ days }).startOf('day');
    const posts = await sql<PostRow[]>`SELECT * FROM bot.model_posts WHERE model_slug = ${model.slug} AND pinned = false AND posted_at >= ${wStart.toISO()} ORDER BY posted_at DESC`;
    const at = (v: string | Date | null) => (v ? DateTime.fromJSDate(new Date(v)) : null); // postgres.js returns timestamptz as Date
    const inRange = (p: PostRow, a: DateTime, b: DateTime) => {
      const t = at(p.posted_at);
      return !!t && t >= a && t < b;
    };
    const yesterday = posts.filter((p) => inRange(p, yStart, yEnd));
    const week = posts.filter((p) => inRange(p, wStart, yEnd));
    const snaps = await sql<SnapRow[]>`SELECT day::text, followers FROM bot.account_snapshots WHERE model_slug = ${model.slug} AND platform = 'instagram' ORDER BY day DESC LIMIT 8`;
    const followers = snaps[0]?.followers ?? null;
    const dayDelta = snaps.length > 1 && snaps[0].followers != null && snaps[1].followers != null ? snaps[0].followers - snaps[1].followers : null;
    const last = snaps[snaps.length - 1];
    const weekDelta = snaps.length > 2 && snaps[0].followers != null && last.followers != null ? snaps[0].followers - last.followers : null;
    // streak of days without a post, counting back from yesterday (needs posts beyond the window → separate query)
    const lastPost = await sql<{ posted_at: string | Date | null }[]>`SELECT posted_at FROM bot.model_posts WHERE model_slug = ${model.slug} AND pinned = false ORDER BY posted_at DESC NULLS LAST LIMIT 1`;
    const lastAt = at(lastPost[0]?.posted_at ?? null)?.setZone(model.timezone) ?? null;
    const streak = lastAt ? Math.max(0, Math.floor(yEnd.diff(lastAt.startOf('day'), 'days').days) - 0) : null; // days since her last post (0 = posted yesterday)
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => typeof x === 'number');
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    const wl = avg(week.map((p) => p.likes));
    const wc = avg(week.map((p) => p.comments));
    const ratio = wl && wc != null ? Number(((wc / wl) * 100).toFixed(1)) : null;
    const best = [...week].sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0))[0];
    return { now, yesterday, week, followers, dayDelta, weekDelta, streak, wl, wc, wv: avg(week.map((p) => p.views)), ratio, best, hasData: snaps.length > 0 || posts.length > 0 };
  }

  function describe(p: PostRow) {
    return `${p.kind ?? 'post'}${p.genre && p.genre !== 'other' ? ` · ${p.genre}` : ''}${p.format ? ` · ${p.format}` : ''}`;
  }

  async function modelReport(model: Model): Promise<string | undefined> {
    const w = await loadWindow(model);
    if (!w.hasData) return undefined;
    const sign = (n: number | null) => (n == null ? '' : n >= 0 ? `+${n.toLocaleString()}` : n.toLocaleString());
    const lines = [
      `📊 **your numbers — ${w.now.toFormat('ccc LLL d')}**`,
      `followers: **${w.followers?.toLocaleString() ?? '—'}**${w.dayDelta != null ? ` (${sign(w.dayDelta)} since yesterday${w.weekDelta != null ? `, ${sign(w.weekDelta)} this week` : ''})` : ''}`,
      w.yesterday.length
        ? `yesterday: ${w.yesterday.map((p) => `${describe(p)} — ❤️ ${fmt(p.likes)} 💬 ${fmt(p.comments)}${p.views ? ` ▶️ ${fmt(p.views)}` : ''}`).join(' | ')}`
        : `yesterday: nothing posted${w.streak && w.streak > 1 ? ` — ${w.streak} days since your last post 👀` : ' 👀'}`,
      w.week.length ? `last 7 days: ${w.week.length} post${w.week.length === 1 ? '' : 's'} · avg ❤️ ${fmt(w.wl)} · 💬 ${fmt(w.wc)}${w.wv ? ` · ▶️ ${fmt(w.wv)}` : ''}${w.ratio != null ? ` · ${w.ratio} comments per 100 likes` : ''}` : 'last 7 days: no posts',
      w.best ? `best this week: ${describe(w.best)}${w.best.views ? ` — ▶️ ${fmt(w.best.views)}` : ` — ❤️ ${fmt(w.best.likes)}`}${w.best.caption ? ` · "${w.best.caption.replace(/\s+/g, ' ').slice(0, 60)}"` : ''} → <${w.best.source_url}>` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function ownersDigest(): Promise<string[]> {
    const models = ctx.models.all().filter((m) => m.socials.instagram);
    if (!models.length) return ['☀️ daily report: no creators onboarded yet — `/model add` to start.'];
    const rows = await Promise.all(models.map(async (m) => ({ m, w: await loadWindow(m) })));
    const withData = rows.filter((r) => r.w.hasData);
    const date = DateTime.now().setZone(ctx.env.DEFAULT_TIMEZONE).toFormat('cccc LLL d');
    const silent = withData.filter((r) => !r.w.yesterday.length).sort((a, b) => (b.w.streak ?? 0) - (a.w.streak ?? 0));
    const posted = withData.filter((r) => r.w.yesterday.length);
    const sign = (n: number | null) => (n == null ? '—' : n >= 0 ? `+${n.toLocaleString()}` : n.toLocaleString());

    const out: string[] = [];
    out.push(
      [
        `☀️ **Daily report — ${date}**`,
        `**Didn't post yesterday (${silent.length}):** ${silent.map((r) => `${r.m.display_name}${r.w.streak && r.w.streak > 1 ? ` (${r.w.streak}d)` : ''}`).join(' · ') || 'everyone posted 🎉'}`,
        `**Posted yesterday (${posted.length}):** ${posted.map((r) => `${r.m.display_name} — ${r.w.yesterday.map(describe).join(', ')}`).join(' · ') || '—'}`,
        withData.length < models.length ? `_no data yet for: ${rows.filter((r) => !r.w.hasData).map((r) => r.m.display_name).join(', ')}_` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const board = [...withData].filter((r) => r.w.week.length).sort((a, b) => (b.w.wl ?? 0) + (b.w.wc ?? 0) * 5 - ((a.w.wl ?? 0) + (a.w.wc ?? 0) * 5));
    const movers = [...withData].filter((r) => r.w.dayDelta != null).sort((a, b) => (b.w.dayDelta ?? 0) - (a.w.dayDelta ?? 0));
    out.push(
      [
        `**Engagement (7-day avg per post):**`,
        ...board.slice(0, 15).map((r, i) => `${i + 1}. ${r.m.display_name} — ❤️ ${fmt(r.w.wl)} · 💬 ${fmt(r.w.wc)}${r.w.wv ? ` · ▶️ ${fmt(r.w.wv)}` : ''}${r.w.ratio != null ? ` · ${r.w.ratio}/100` : ''} · ${r.w.week.length} posts`),
        board.length ? '' : '_no posts in the last 7 days_',
        `**Followers (since yesterday):** ${movers.map((r) => `${r.m.display_name} ${sign(r.w.dayDelta)}`).join(' · ') || '—'}`,
      ]
        .filter((l) => l !== '')
        .join('\n'),
    );

    const mix = withData
      .filter((r) => r.w.week.length)
      .map((r) => {
        const byLane = new Map<string, number>();
        for (const p of r.w.week) byLane.set(p.genre ?? 'unlabelled', (byLane.get(p.genre ?? 'unlabelled') ?? 0) + 1);
        const kinds = new Map<string, number>();
        for (const p of r.w.week) kinds.set(p.kind ?? 'post', (kinds.get(p.kind ?? 'post') ?? 0) + 1);
        return `• ${r.m.display_name}: ${[...kinds.entries()].map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ')} — ${[...byLane.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ')}${r.w.best?.format ? ` · best: ${r.w.best.format}` : ''}`;
      });
    if (mix.length) out.push([`**Content mix (last 7 days):**`, ...mix].join('\n'));

    // Discord: 2000 chars per message
    return out.flatMap((p) => chunk(p, 1900));
  }
}

function chunk(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > max) {
      parts.push(cur);
      cur = line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) parts.push(cur);
  return parts;
}
