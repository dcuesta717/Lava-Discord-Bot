import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ForumChannel,
  type Message,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import type { ReelCandidate, SourcingConfig } from '../../integrations/apify.js';
import { loadPrompt } from '../../lib/prompts.js';

/**
 * Reels copy board (docs/source-analysis §2.3):
 *   sourcing: daily Apify scout per model (sourcing/reels-sources.yaml) + manual drops in #reels-inbox ("<slug> <url> [category]")
 *   classify: Claude scores + writes a 1-line recreate brief (prompts/reels.classify.md); score ≥ 0.6 → board
 *   board:    forum post per category in her reels_board channel; message = "🎬 recreate this · <Category>" + link + brief
 *             buttons [✅ on drive] [📤 already posted] [❌ skip] → status in `reels`
 *   nudge:    weekly count of untouched reels.
 */
const MODULE = 'reels';
const SCORE_BAR = 0.6;

interface Classified {
  url: string;
  category: string;
  score: number;
  hook: string;
  brief: string;
  why: string;
}

interface ReelRow {
  id: number;
  model_slug: string;
  source_url: string;
  category: string;
  status: string;
  discord_message_id: string | null;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const exists = async (slug: string, url: string) => (await sql`SELECT 1 FROM bot.reels WHERE model_slug = ${slug} AND source_url = ${url}`).length > 0;
  const byId = async (id: number) => (await sql<ReelRow[]>`SELECT * FROM bot.reels WHERE id = ${id}`)[0];

  // ── daily scout ─────────────────────────────────────────────────────────────
  /** Her personal scout: sourcing/reels-sources.yaml seeds → Apify → Claude → her board. Daily at 10 her time, and right after she goes live. */
  async function scoutModel(model: Model): Promise<number> {
    if (!ctx.api.apify.enabled) return 0;
    const src = (model.files().sourcing ?? {}) as SourcingConfig;
    const candidates: ReelCandidate[] = [];
    if (src.tiktok && ((src.tiktok.hashtags?.length ?? 0) + (src.tiktok.seed_accounts?.length ?? 0)) > 0) candidates.push(...(await ctx.api.apify.tiktok(src.tiktok).catch(() => [])));
    if (src.instagram && ((src.instagram.hashtags?.length ?? 0) + (src.instagram.seed_accounts?.length ?? 0)) > 0) candidates.push(...(await ctx.api.apify.instagram(src.instagram).catch(() => [])));
    const fresh: ReelCandidate[] = [];
    for (const c of candidates) if (c.url && !(await exists(model.slug, c.url))) fresh.push(c);
    if (!fresh.length) return 0;
    const posted = await classifyAndPost(model, fresh.slice(0, 30));
    await ctx.ops(MODULE, 'scouted', { model, data: { candidates: fresh.length, posted } });
    return posted;
  }

  ctx.bus.on('model:live', ({ model }: { model: Model }) => {
    scoutModel(model)
      .then(async (n) => {
        if (n) await ctx.send(model.discord.channels.general, { content: `🎬 first batch is on your 🎬-reels-copy-board — ${n} video${n === 1 ? '' : 's'} to recreate, picked for your lanes. Tap a button on each one when you've done it.` });
      })
      .catch((err) => ctx.log.warn({ err, model: model.slug }, 'kickoff reels scout failed'));
  });

  ctx.action('scout_reels_for_model', {
    description: "Run one creator's personal reels scout now (her sourcing seeds → videos to recreate on her 🎬-reels-copy-board).",
    input: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    ownersOnly: true,
    slow: true,
    run: async (input) => {
      const model = ctx.models.get(String(input.slug));
      if (!model) return `unknown model ${String(input.slug)}`;
      const n = await scoutModel(model);
      return `${model.display_name}: ${n} reel(s) posted to her board${n ? '' : ' (no new candidates — add seeds in sourcing/reels-sources.yaml or lanes)'}`;
    },
  });

  for (const model of ctx.models.all()) {
    ctx.cron(`reels:scout:${model.slug}`, '0 10 * * *', model.timezone, async () => {
      await scoutModel(model);
    });

    ctx.cron(`reels:nudge:${model.slug}`, '0 11 * * 5', model.timezone, async () => {
      const [{ n }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM bot.reels WHERE model_slug = ${model.slug} AND status = 'new'`;
      if (n >= 3) await ctx.send(model.discord.channels.general, { content: `👀 ${n} reels waiting on your board — even 1 this weekend keeps the algo warm` });
    });
  }

  // ── manual drops: "<slug> <url> [category]" in #reels-inbox ─────────────────
  ctx.client.on(Events.MessageCreate, async (msg: Message) => {
    if (msg.author.bot || msg.channelId !== ctx.ch('reels_inbox')) return;
    const m = msg.content.match(/^(\S+)\s+(https?:\/\/\S+)\s*(.*)$/);
    if (!m) return;
    const model = ctx.models.get(m[1]);
    if (!model) return void msg.react('❓');
    const url = m[2];
    if (await exists(model.slug, url)) return void msg.react('♻️');
    const posted = await classifyAndPost(model, [{ url, platform: url.includes('tiktok') ? 'tiktok' : 'instagram', author: '', caption: m[3] ?? '', views: 0, likes: 0 }], true);
    await msg.react(posted ? '✅' : '🚫');
  });

  ctx.command(
    new SlashCommandBuilder()
      .setName('reel')
      .setDescription('Add a reel to a model’s board (staff)')
      .addStringOption((o) => o.setName('model').setDescription('Model slug').setRequired(true))
      .addStringOption((o) => o.setName('url').setDescription('TikTok / IG reel URL').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Optional note / category hint')),
    async (i) => {
      const model = ctx.models.get(i.options.getString('model', true));
      if (!model || !ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'staff only / unknown model', flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const url = i.options.getString('url', true);
      const posted = await classifyAndPost(model, [{ url, platform: url.includes('tiktok') ? 'tiktok' : 'instagram', author: '', caption: i.options.getString('note') ?? '', views: 0, likes: 0 }], true);
      await i.editReply(posted ? 'on the board ✅' : 'classified as Skip — not posted');
    },
  );

  // ── buttons ─────────────────────────────────────────────────────────────────
  const act = (status: 'on_drive' | 'posted' | 'skipped', label: string) => async (i: ButtonInteraction | StringSelectMenuInteraction, parts: string[], model: Model | undefined) => {
    const row = await byId(Number(parts[3]));
    if (!model || !row) return;
    await sql`UPDATE bot.reels SET status = ${status}, acted_by = ${i.user.id}, acted_at = now() WHERE id = ${row.id}`;
    await i.update({ components: [] });
    await i.followUp({ content: `${label} — logged 👍`, flags: MessageFlags.Ephemeral });
    await ctx.ops(MODULE, status, { model, actor: i.user.id, data: { id: row.id } });
    ctx.bus.emit('reel:acted', { model, reel: row, status });
  };
  // 📋 "Copy this" on a Content Library post → her board, re-classified into her categories with a brief.
  ctx.bus.on('library:copy', ({ model, candidate }: { model: Model; candidate: ReelCandidate }) => {
    classifyAndPost(model, [candidate], true).catch((err) => ctx.log.warn({ err, model: model.slug }, 'library copy → board failed'));
  });

  ctx.component('reels:on_drive', act('on_drive', '✅ on drive'));
  ctx.component('reels:posted', act('posted', '📤 already posted'));
  ctx.component('reels:skip', act('skipped', '❌ skipped'));

  // ── shared ──────────────────────────────────────────────────────────────────
  async function classifyAndPost(model: Model, candidates: ReelCandidate[], force = false): Promise<number> {
    const files = model.files();
    const list = candidates
      .map((c, i) => `${i + 1}. url: ${c.url}\n   platform: ${c.platform} · author: ${c.author || '?'} · views: ${c.views || '?'}\n   caption: ${c.caption.slice(0, 200).replace(/\n/g, ' ')}`)
      .join('\n');
    const classified = await ctx.api.claude.json<Classified[]>(
      loadPrompt('reels.classify', { model_name: model.display_name, voice_summary: files.voice.slice(0, 1500) || '(no voice file yet)', candidates: list }),
      { maxTokens: 2000 },
    );

    let posted = 0;
    for (const c of classified) {
      const cand = candidates.find((x) => x.url === c.url);
      if (!cand) continue;
      const keep = force ? c.category !== 'Skip' : c.category !== 'Skip' && c.score >= SCORE_BAR;
      if (!keep) continue;
      const [{ id }] = await sql<{ id: number }[]>`
        INSERT INTO bot.reels (model_slug, source_url, source_platform, category, brief, hook, views, score)
        VALUES (${model.slug}, ${c.url}, ${cand.platform}, ${c.category}, ${c.brief}, ${c.hook}, ${cand.views || null}, ${c.score})
        ON CONFLICT (model_slug, source_url) DO UPDATE SET category = EXCLUDED.category, brief = EXCLUDED.brief
        RETURNING id`;
      const msg = await postToBoard(model, Number(id), c, cand);
      if (msg) await sql`UPDATE bot.reels SET discord_thread_id = ${msg.channelId}, discord_message_id = ${msg.id} WHERE id = ${id}`;
      await ctx.api.notion.createRow('reels', `${model.display_name} · ${c.category} · ${c.hook}`, { Model: model.display_name, Category: c.category, Source: c.url, Score: c.score, Status: 'new', Brief: c.brief });
      posted++;
    }
    return posted;
  }

  async function postToBoard(model: Model, id: number, c: Classified, cand: ReelCandidate) {
    const forum = await ctx.client.channels.fetch(model.discord.channels.reels_board).catch(() => null);
    if (!forum || forum.type !== ChannelType.GuildForum) return undefined;
    const thread = await threadForCategory(forum, c.category);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`reels:on_drive:${model.slug}:${id}`).setLabel('on drive').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reels:posted:${model.slug}:${id}`).setLabel('already posted').setEmoji('📤').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`reels:skip:${model.slug}:${id}`).setLabel('skip').setEmoji('❌').setStyle(ButtonStyle.Danger),
    );
    const content = [
      `🎬 **recreate this** · ${c.category}`,
      c.url, // Discord embeds TikTok/IG links; for guaranteed playback re-upload the mp4 (≤25 MB) — see docs/runbook.md
      `**hook:** ${c.hook}`,
      `**do:** ${c.brief}`,
      cand.views ? `_${cand.views.toLocaleString()} views on the original_` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return thread.send({ content, components: [row] });
  }

  async function threadForCategory(forum: ForumChannel, category: string) {
    const active = await forum.threads.fetchActive();
    const existing = active.threads.find((t) => t.name.toLowerCase() === category.toLowerCase());
    if (existing) return existing;
    const archived = await forum.threads.fetchArchived().catch(() => null);
    const old = archived?.threads.find((t) => t.name.toLowerCase() === category.toLowerCase());
    if (old) {
      await old.setArchived(false).catch(() => undefined);
      return old;
    }
    return forum.threads.create({ name: category, message: { content: `**${category}** — reels to recreate. Tap a button on each one when you've done it.` } });
  }
}
