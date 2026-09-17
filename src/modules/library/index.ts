import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
  ForumLayoutType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SortOrderType,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type CategoryChannel,
  type ForumChannel,
  type Guild,
  type GuildForumTagData,
  type Message,
  type OverwriteResolvable,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { loadLibrary, type Genre, type LibraryConfig } from '../../config/library.js';
import { canonicalUrl, type ReelCandidate } from '../../integrations/apify.js';
import { fetchImageAsBase64, type ImageInput } from '../../integrations/anthropic.js';
import { MEMBER, ROLE, clampToBot } from '../../lib/overwrites.js';
import { loadPrompt } from '../../lib/prompts.js';

/**
 * Content Library — the agency-wide inspiration folders (Dan's "saved folder, fixed").
 *
 *   📁 🎬 CONTENT LIBRARY (everyone)
 *     #📥-library-inbox        anyone pastes IG/TikTok links (+ optional folder hint) → bot downloads, classifies, files
 *     ⛳-golf 🏋️-gym-girl …     one FORUM per genre (library/genres.yaml), gallery view: every post = one video
 *                              + "why it works" + "how to copy it" + [🔥] [👎] [📋 Copy this]
 *
 *   scout:  daily per genre — seed accounts (bot.library_sources, added via /library source add) + hashtags (genres.yaml)
 *           through Apify → ranked by comments > likes > views, recency → Claude keeps the top N → posted.
 *   copy:   📋 on a post → bus 'library:copy' → modules/reels posts it to HER reels board with a brief.
 *   learn:  🔥/👎 nudge the weight of the seed account the video came from.
 *
 * Everything is stored in bot.library_items / library_sources / library_votes; channel ids in bot.settings (library.*).
 */
const MODULE = 'library';
const CAT_NAME = '🎬 CONTENT LIBRARY';
const INBOX_NAME = '📥-library-inbox';
const NO_MODEL = '-'; // custom-id slot the router reserves for a model slug; the library is agency-wide
const URL_RE = /https?:\/\/\S+/g;
const SOCIAL_RE = /instagram\.com|tiktok\.com/;

interface Classified {
  url: string;
  keep: boolean;
  genre: string;
  also?: string[];
  score: number;
  title: string;
  why: string;
  copy: string;
  text_on_screen?: boolean;
}

interface ItemRow {
  id: number;
  source_url: string;
  platform: string;
  author: string | null;
  caption: string | null;
  genre: string;
  tags: string[];
  title: string | null;
  why: string | null;
  copy_brief: string | null;
  stats: Record<string, unknown>;
  score: number | null;
  posts: { genre: string; forum_id: string; thread_id: string }[];
  up: number;
  down: number;
  copies: number;
}

interface IngestResult {
  posted: { title: string; genre: string; url: string }[];
  dupes: number;
  skipped: number;
  failed: number;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  let cfg: LibraryConfig = loadLibrary();
  const genres = () => cfg.genres.filter((g) => g.active);
  const genre = (slug: string) => genres().find((g) => g.slug === slug);
  const forumId = (slug: string) => ctx.settings.getString(`library.forum.${slug}`);
  const inboxId = () => ctx.settings.getString('library.inbox');
  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

  // ── boot: make sure the folders exist ──────────────────────────────────────
  ctx.client.once(Events.ClientReady, async () => {
    await ctx.ready;
    try {
      await ensureLibrary();
    } catch (err) {
      ctx.log.error({ err }, 'content library setup failed (bot still runs)');
    }
  });

  ctx.cron('library:scout', cfg.scout.cron, ctx.env.DEFAULT_TIMEZONE, async () => {
    if (!ctx.api.apify.enabled) return;
    const summary = await scout();
    await ctx.ops(MODULE, 'scouted', { data: summary, text: `${summary.posted} posted across ${summary.genres} folders` });
    const picks = await deliverPicks();
    if (picks.delivered) await ctx.ops(MODULE, 'picks-delivered', { data: picks });
    const trends = await radar().catch((err) => {
      ctx.log.warn({ err }, 'trend radar failed');
      return 0;
    });
    if (trends) await ctx.ops(MODULE, 'trends-alerted', { data: { trends } });
  });

  ctx.bus.on('model:live', ({ model }: { model: Model }) => {
    deliverPicks(model.slug).catch((err) => ctx.log.warn({ err, model: model.slug }, 'kickoff picks failed'));
  });

  // ── inbox: paste links, get them filed ─────────────────────────────────────
  ctx.client.on(Events.MessageCreate, (msg: Message) => {
    onInbox(msg).catch((err) => ctx.log.warn({ err }, 'library inbox failed'));
  });

  async function onInbox(msg: Message) {
    if (msg.author.bot || !inboxId() || msg.channelId !== inboxId()) return;
    const urls = [...msg.content.matchAll(URL_RE)].map((m) => m[0]).filter((u) => SOCIAL_RE.test(u));
    if (!urls.length) return;
    const hint = msg.content.replace(URL_RE, '').trim();
    await msg.react('⏳').catch(() => undefined);
    if (!ctx.api.apify.enabled) {
      await msg.react('🚫').catch(() => undefined);
      await msg.reply({ content: "I can't download videos yet — `APIFY_TOKEN` isn't set. Ping the tech team and re-paste after.", allowedMentions: { parse: [] } }).catch(() => undefined);
      return;
    }
    const r = await ingest(urls, { origin: 'inbox', addedBy: msg.author.id, hint });
    await msg.reactions.cache.get('⏳')?.users.remove(ctx.client.user!.id).catch(() => undefined);
    await msg.react(r.posted.length ? '✅' : r.dupes ? '♻️' : '🚫').catch(() => undefined);
    await msg.reply({ content: summarize(r), allowedMentions: { parse: [] } }).catch(() => undefined);
  }

  // ── /library ───────────────────────────────────────────────────────────────
  const genreChoices = () => genres().map((g) => ({ name: `${g.emoji} ${g.name}`, value: g.slug }));
  ctx.command(
    new SlashCommandBuilder()
      .setName('library')
      .setDescription('Content Library — the agency inspiration folders')
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription('File an Instagram / TikTok video into the library')
          .addStringOption((o) => o.setName('url').setDescription('Reel / TikTok link').setRequired(true))
          .addStringOption((o) => o.setName('folder').setDescription('Force a folder (otherwise the bot decides)').addChoices(...genreChoices()))
          .addStringOption((o) => o.setName('note').setDescription('Why you saved it (helps the notes)')),
      )
      .addSubcommandGroup((g) =>
        g
          .setName('source')
          .setDescription('Seed accounts / hashtags the daily scout scans')
          .addSubcommand((s) =>
            s
              .setName('add')
              .setDescription('Add an @account or #hashtag to a folder’s scout list (owners)')
              .addStringOption((o) => o.setName('folder').setDescription('Folder').setRequired(true).addChoices(...genreChoices()))
              .addStringOption((o) => o.setName('value').setDescription('@handle or #hashtag — several separated by spaces').setRequired(true)),
          )
          .addSubcommand((s) =>
            s
              .setName('remove')
              .setDescription('Remove an @account or #hashtag from a folder (owners)')
              .addStringOption((o) => o.setName('folder').setDescription('Folder').setRequired(true).addChoices(...genreChoices()))
              .addStringOption((o) => o.setName('value').setDescription('@handle or #hashtag').setRequired(true)),
          )
          .addSubcommand((s) => s.setName('list').setDescription('Show the scout list').addStringOption((o) => o.setName('folder').setDescription('Folder').addChoices(...genreChoices()))),
      )
      .addSubcommand((s) => s.setName('scout').setDescription('Run the scout now (owners)').addStringOption((o) => o.setName('folder').setDescription('One folder only').addChoices(...genreChoices())))
      .addSubcommand((s) => s.setName('stats').setDescription('What’s in the library and what’s hot'))
      .addSubcommand((s) => s.setName('picks').setDescription('Send each creator her top picks from the library now (owners)').addStringOption((o) => o.setName('model').setDescription('One creator (slug)'))),
    async (i) => {
      const group = i.options.getSubcommandGroup(false);
      const sub = i.options.getSubcommand();

      if (!group && sub === 'add') {
        if (!ctx.api.apify.enabled) return i.reply({ content: '`APIFY_TOKEN` is not set yet — I can’t download videos.', flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const folder = i.options.getString('folder');
        const note = i.options.getString('note') ?? '';
        const hint = [folder ? `folder: ${folder}` : '', note].filter(Boolean).join(' · ');
        const r = await ingest([i.options.getString('url', true)], { origin: 'command', addedBy: i.user.id, hint, forceGenre: folder ?? undefined });
        return i.editReply(summarize(r));
      }

      if (group === 'source') {
        if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
        const slug = i.options.getString('folder') ?? '';
        if (sub === 'list') {
          const rows = await sql<{ genre: string; kind: string; value: string; weight: number }[]>`
            SELECT genre, kind, value, weight FROM bot.library_sources ${slug ? sql`WHERE genre = ${slug}` : sql``} ORDER BY genre, kind, weight DESC, value`;
          const lines: string[] = [];
          for (const g of genres()) {
            if (slug && g.slug !== slug) continue;
            const mine = rows.filter((r) => r.genre === g.slug);
            const accounts = mine.filter((r) => r.kind === 'account').map((r) => `@${r.value}${r.weight !== 1 ? ` (${r.weight.toFixed(1)})` : ''}`);
            const tags = [...g.hashtags.map((h) => `#${h}`), ...mine.filter((r) => r.kind === 'hashtag').map((r) => `#${r.value}`)];
            lines.push(`${g.emoji} **${g.name}** — accounts: ${accounts.join(' ') || '_none yet_'} · hashtags: ${tags.join(' ') || '_none_'}`);
          }
          return i.reply({ content: lines.join('\n').slice(0, 1900), flags: MessageFlags.Ephemeral });
        }
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const values = i.options.getString('value', true).split(/[\s,]+/).filter(Boolean);
        const parsed = values.map((v) => ({ kind: v.startsWith('#') ? 'hashtag' : 'account', value: v.replace(/^[@#]/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase() })).filter((p) => p.value);
        if (!parsed.length) return i.editReply('give me @handles or #hashtags');
        if (sub === 'add') {
          for (const p of parsed)
            await sql`INSERT INTO bot.library_sources (genre, kind, value, added_by) VALUES (${slug}, ${p.kind}, ${p.value}, ${i.user.id}) ON CONFLICT (genre, kind, value) DO NOTHING`;
          await ctx.ops(MODULE, 'source-added', { actor: i.user.id, data: { genre: slug, sources: parsed } });
          return i.editReply(`added to ${genre(slug)?.name}: ${parsed.map((p) => (p.kind === 'hashtag' ? '#' : '@') + p.value).join(' ')} — the scout picks them up tomorrow (or run \`/library scout\`)`);
        }
        for (const p of parsed) await sql`DELETE FROM bot.library_sources WHERE genre = ${slug} AND kind = ${p.kind} AND value = ${p.value}`;
        return i.editReply(`removed from ${genre(slug)?.name}: ${parsed.map((p) => (p.kind === 'hashtag' ? '#' : '@') + p.value).join(' ')}`);
      }

      if (sub === 'scout') {
        if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
        if (!ctx.api.apify.enabled) return i.reply({ content: '`APIFY_TOKEN` is not set yet.', flags: MessageFlags.Ephemeral });
        const only = i.options.getString('folder') ?? undefined;
        await i.reply({ content: `running the scout${only ? ` for ${only}` : ''} — this takes a few minutes; the summary lands in <#${ctx.ch('ops_log')}> and picks go out to the girls after.`, flags: MessageFlags.Ephemeral });
        void (async () => {
          const s = await scout(only);
          await ctx.ops(MODULE, 'scouted', { actor: i.user.id, data: s, text: `${s.genres} folder(s): ${s.candidates} candidates → ${s.posted} posted, ${s.dupes} dupes, ${s.skipped} skipped${s.errors ? `, ${s.errors} source errors` : ''}` });
          const p = await deliverPicks();
          if (p.delivered) await ctx.ops(MODULE, 'picks-delivered', { data: p });
        })().catch((err) => ctx.log.error({ err }, 'manual scout failed'));
        return;
      }

      if (sub === 'picks') {
        if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const r = await deliverPicks(i.options.getString('model') ?? undefined);
        return i.editReply(`picks: ${r.delivered} video(s) sent to ${r.models} creator(s)${r.skipped ? ` · ${r.skipped} creator(s) had no lanes or nothing new` : ''}`);
      }

      if (sub === 'stats') {
        const counts = await sql<{ genre: string; n: number; fire: number }[]>`SELECT genre, COUNT(*)::int AS n, COALESCE(SUM(up),0)::int AS fire FROM bot.library_items GROUP BY genre`;
        const hot = await sql<ItemRow[]>`SELECT * FROM bot.library_items ORDER BY (up - down) DESC, copies DESC, created_at DESC LIMIT 5`;
        const folders = genres().map((g) => {
          const c = counts.find((x) => x.genre === g.slug);
          return `${g.emoji} ${g.name}: **${c?.n ?? 0}**${c?.fire ? ` · 🔥${c.fire}` : ''}`;
        });
        const top = hot.filter((h) => h.up - h.down > 0).map((h) => `🔥${h.up - h.down} · ${h.title} — ${threadUrl(h) ?? h.source_url}`);
        return i.reply({ content: [folders.join('  ·  '), top.length ? '\n**hottest:**\n' + top.join('\n') : ''].join('\n').slice(0, 1900), flags: MessageFlags.Ephemeral });
      }
    },
  );

  // ── chat-callable actions (operator) ────────────────────────────────────────
  ctx.action('run_library_scout', {
    description: 'Run the Content Library scout now: scan seed accounts + hashtags per folder, post the best new videos, then send each creator her picks. Takes a few minutes and costs Apify credits.',
    input: { type: 'object', properties: { folder: { type: 'string', description: 'one genre slug, or omit for all' } } },
    ownersOnly: true,
    slow: true,
    run: async (input) => {
      if (!ctx.api.apify.enabled) return 'APIFY_TOKEN is not set';
      const s = await scout(input.folder ? String(input.folder) : undefined);
      const p = await deliverPicks();
      return `scouted ${s.genres} folder(s): ${s.candidates} candidates → ${s.posted} posted, ${s.dupes} already in, ${s.skipped} not library material; picks: ${p.delivered} sent to ${p.models} creator(s)`;
    },
  });
  ctx.action('send_library_picks', {
    description: "Send creators their top new library videos (in their lanes) to their #general with a Copy button. Optionally one creator.",
    input: { type: 'object', properties: { model: { type: 'string', description: 'model slug (optional)' } } },
    ownersOnly: true,
    run: async (input) => {
      const r = await deliverPicks(input.model ? String(input.model) : undefined);
      return `picks: ${r.delivered} video(s) → ${r.models} creator(s)${r.skipped ? `, ${r.skipped} had no lanes or nothing new` : ''}`;
    },
  });
  ctx.action('add_library_source', {
    description: 'Add Instagram accounts (@handles) or #hashtags the daily scout should scan for a Content Library folder.',
    input: { type: 'object', properties: { folder: { type: 'string', description: 'genre slug' }, values: { type: 'array', items: { type: 'string' }, description: '@handles and/or #hashtags' } }, required: ['folder', 'values'] },
    ownersOnly: true,
    run: async (input, actor) => {
      const slug = String(input.folder).toLowerCase();
      if (!genre(slug)) return `unknown folder ${slug} — valid: ${genres().map((g) => g.slug).join(', ')}`;
      const parsed = parseSources((Array.isArray(input.values) ? input.values : []).map(String));
      for (const p of parsed) await sql`INSERT INTO bot.library_sources (genre, kind, value, added_by) VALUES (${slug}, ${p.kind}, ${p.value}, ${actor.userId}) ON CONFLICT (genre, kind, value) DO NOTHING`;
      await ctx.ops(MODULE, 'source-added', { actor: actor.userId, data: { genre: slug, sources: parsed } });
      return `added to ${genre(slug)?.name}: ${parsed.map((p) => (p.kind === 'hashtag' ? '#' : '@') + p.value).join(' ') || 'nothing valid'}`;
    },
  });
  ctx.action('add_library_video', {
    description: 'File an Instagram / TikTok video into the Content Library (download, classify, post with notes). Optionally force a folder.',
    input: { type: 'object', properties: { url: { type: 'string' }, folder: { type: 'string', description: 'genre slug (optional)' }, note: { type: 'string' } }, required: ['url'] },
    slow: true,
    run: async (input, actor) => {
      if (!ctx.api.apify.enabled) return 'APIFY_TOKEN is not set';
      const folder = input.folder ? String(input.folder) : undefined;
      const r = await ingest([String(input.url)], { origin: 'command', addedBy: actor.userId, hint: [folder ? `folder: ${folder}` : '', input.note ? String(input.note) : ''].filter(Boolean).join(' · '), forceGenre: folder });
      return summarize(r);
    },
  });
  ctx.action('library_stats', {
    description: 'How many videos are in each Content Library folder and which are hottest.',
    input: { type: 'object', properties: {} },
    run: async () => {
      const counts = await sql<{ genre: string; n: number; fire: number }[]>`SELECT genre, COUNT(*)::int AS n, COALESCE(SUM(up),0)::int AS fire FROM bot.library_items GROUP BY genre`;
      return genres().map((g) => `${g.name}: ${counts.find((c) => c.genre === g.slug)?.n ?? 0}`).join(', ');
    },
  });

  function parseSources(values: string[]) {
    return values
      .flatMap((v) => v.split(/[\s,]+/))
      .filter(Boolean)
      .map((v) => ({ kind: v.startsWith('#') ? 'hashtag' : 'account', value: v.replace(/^[@#]/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase() }))
      .filter((p) => p.value);
  }

  // ── buttons ────────────────────────────────────────────────────────────────
  const vote = (dir: 1 | -1) => async (i: ButtonInteraction | StringSelectMenuInteraction, parts: string[]) => {
    await i.deferUpdate();
    const id = Number(parts[3]);
    const item = await byId(id);
    if (!item) return;
    await sql`INSERT INTO bot.library_votes (item_id, user_id, vote) VALUES (${id}, ${i.user.id}, ${dir}) ON CONFLICT (item_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, voted_at = now()`;
    const [{ up, down }] = await sql<{ up: number; down: number }[]>`
      UPDATE bot.library_items SET up = (SELECT COUNT(*)::int FROM bot.library_votes WHERE item_id = ${id} AND vote = 1),
                                   down = (SELECT COUNT(*)::int FROM bot.library_votes WHERE item_id = ${id} AND vote = -1)
      WHERE id = ${id} RETURNING up, down`;
    if (item.author) await sql`UPDATE bot.library_sources SET weight = LEAST(2, GREATEST(0, weight + ${dir * 0.1})) WHERE kind = 'account' AND value = ${item.author.toLowerCase()}`;
    await i.editReply({ components: [buttons(id, up, down, item.copies)] });
  };
  ctx.component('library:up', vote(1));
  ctx.component('library:down', vote(-1));

  ctx.component('library:copy', async (i, parts, model) => {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const id = Number(parts[3]);
    const item = await byId(id);
    if (!item) return i.editReply('that video is gone from the library');
    const mine = model ?? ctx.models.all().find((m) => m.discord.user_id === i.user.id);
    if (mine) {
      await sendToBoard(item, mine.slug, i.user.id);
      return i.editReply(`sent to your reels board ✅ — it’s in <#${mine.discord.channels.reels_board}> with a brief`);
    }
    if (!ctx.isOwner(i.user.id)) return i.editReply('ask Dan or Marissa to send this to your board (your Discord isn’t linked to a model yet)');
    const models = ctx.models.all();
    if (!models.length) return i.editReply('no models onboarded yet — once one is, this sends the video to her board');
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`library:copyto:${NO_MODEL}:${id}`)
      .setPlaceholder('send to which model?')
      .addOptions(models.slice(0, 25).map((m) => ({ label: m.display_name, value: m.slug })));
    return i.editReply({ content: 'send this to…', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
  });

  ctx.component('library:copyto', async (i, parts) => {
    if (!i.isStringSelectMenu()) return;
    await i.deferUpdate();
    const id = Number(parts[3]);
    const item = await byId(id);
    const model = ctx.models.get(i.values[0]);
    if (!item || !model) return;
    await sendToBoard(item, model.slug, i.user.id);
    await i.editReply({ content: `sent to ${model.display_name}’s board ✅`, components: [] });
  });

  // ── shared ─────────────────────────────────────────────────────────────────
  async function byId(id: number) {
    return (await sql<ItemRow[]>`SELECT * FROM bot.library_items WHERE id = ${id}`)[0];
  }

  function threadUrl(item: ItemRow) {
    const p = item.posts?.[0];
    return p ? `https://discord.com/channels/${ctx.env.DISCORD_GUILD_ID}/${p.thread_id}` : undefined;
  }

  function buttons(id: number, up: number, down: number, copies: number) {
    const upBtn = new ButtonBuilder().setCustomId(`library:up:${NO_MODEL}:${id}`).setEmoji('🔥').setStyle(ButtonStyle.Secondary);
    const downBtn = new ButtonBuilder().setCustomId(`library:down:${NO_MODEL}:${id}`).setEmoji('👎').setStyle(ButtonStyle.Secondary);
    if (up) upBtn.setLabel(String(up));
    if (down) downBtn.setLabel(String(down));
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      upBtn,
      downBtn,
      new ButtonBuilder().setCustomId(`library:copy:${NO_MODEL}:${id}`).setLabel(copies ? `Copy this · ${copies}` : 'Copy this').setEmoji('📋').setStyle(ButtonStyle.Primary),
    );
  }

  async function sendToBoard(item: ItemRow, slug: string, actor: string) {
    const model = ctx.models.get(slug);
    if (!model) return;
    const candidate: ReelCandidate = {
      url: item.source_url,
      platform: item.platform === 'tiktok' ? 'tiktok' : 'instagram',
      author: item.author ?? '',
      caption: [item.title, item.copy_brief ? `copy: ${item.copy_brief}` : '', item.caption?.slice(0, 200) ?? ''].filter(Boolean).join(' — '),
      views: Number(item.stats?.views ?? 0),
      likes: Number(item.stats?.likes ?? 0),
      thumbnailUrl: typeof item.stats?.thumbnail === 'string' ? (item.stats.thumbnail as string) : undefined,
    };
    await sql`UPDATE bot.library_items SET copies = copies + 1 WHERE id = ${item.id}`;
    ctx.bus.emit('library:copy', { model, candidate, item });
    await ctx.ops(MODULE, 'copied', { model, actor, data: { id: item.id, genre: item.genre } });
  }

  function summarize(r: IngestResult) {
    const parts: string[] = [];
    for (const p of r.posted) parts.push(`✅ filed in ${genre(p.genre)?.emoji ?? ''} **${genre(p.genre)?.name ?? p.genre}** → ${p.url}`);
    if (r.dupes) parts.push(`♻️ ${r.dupes} already in the library`);
    if (r.skipped) parts.push(`🚫 ${r.skipped} not library material (no format to copy / not IG-safe)`);
    if (r.failed) parts.push(`⚠️ ${r.failed} couldn’t be fetched (private account, deleted, or Apify hiccup — try again in a minute)`);
    return parts.join('\n') || 'nothing to file';
  }

  /** Fetch → classify → post → store. Used by the inbox, /library add and the scout. */
  async function ingest(urls: string[], opts: { origin: 'inbox' | 'command' | 'scout'; addedBy?: string; hint?: string; forceGenre?: string; candidates?: ReelCandidate[] }): Promise<IngestResult> {
    const result: IngestResult = { posted: [], dupes: 0, skipped: 0, failed: 0 };
    const wanted = new Map<string, string>(); // canonical → original
    for (const u of urls) {
      const c = canonicalUrl(u);
      if (await exists(c)) result.dupes++;
      else wanted.set(c, u);
    }
    if (!wanted.size) return result;

    let candidates = opts.candidates?.filter((c) => wanted.has(canonicalUrl(c.url))) ?? [];
    if (!candidates.length) {
      candidates = await ctx.api.apify.byUrls([...wanted.values()]).catch((err) => {
        ctx.log.warn({ err }, 'apify byUrls failed');
        return [];
      });
    }
    const found = new Set(candidates.flatMap((c) => [canonicalUrl(c.url), c.inputUrl ? canonicalUrl(c.inputUrl) : '']));
    result.failed += [...wanted.keys()].filter((c) => !found.has(c)).length;

    for (const cand of candidates) {
      try {
        const c = await classify(cand, opts.hint);
        if (!c) {
          result.failed++;
          continue;
        }
        if (opts.forceGenre && genre(opts.forceGenre)) {
          c.genre = opts.forceGenre;
          c.also = (c.also ?? []).filter((s) => s !== c.genre);
        }
        if (!c.keep || !genre(c.genre)) {
          result.skipped++;
          continue;
        }
        const posted = await post(cand, c, opts.origin, opts.addedBy);
        if (posted) result.posted.push(posted);
        else result.failed++;
      } catch (err) {
        ctx.log.warn({ err, url: cand.url }, 'library ingest failed');
        result.failed++;
      }
    }
    return result;
  }

  async function exists(canonical: string) {
    return (await sql`SELECT 1 FROM bot.library_items WHERE source_url = ${canonical}`).length > 0;
  }

  async function classify(cand: ReelCandidate, hint = ''): Promise<Classified | undefined> {
    const desc = genres().map((g) => `- ${g.slug} — ${g.name}: ${g.description}`).join('\n');
    const line = [
      `url: ${cand.url}`,
      `platform: ${cand.platform} · author: @${cand.author || '?'}`,
      `likes: ${cand.likes || '?'} · comments: ${cand.comments ?? '?'} · views: ${cand.views || '?'}${cand.postedAt ? ` · posted: ${cand.postedAt.slice(0, 10)}` : ''}`,
      `caption: ${(cand.caption || '(none)').slice(0, 300).replace(/\n/g, ' ')}`,
    ].join('\n');
    const images: ImageInput[] = [];
    if (cand.thumbnailUrl) await fetchImageAsBase64(cand.thumbnailUrl).then((img) => images.push(img)).catch(() => undefined);
    const prompt = loadPrompt('library.classify', { genres: desc, hint: hint ? `HINT from the person who saved it: ${hint}` : '', candidates: line });
    const out = await ctx.api.claude.json<Classified[] | Classified>(prompt, { maxTokens: 600 }, images.length ? images : undefined);
    const c = Array.isArray(out) ? out[0] : out;
    if (!c || typeof c.genre !== 'string') return undefined;
    c.url = cand.url;
    c.also = (c.also ?? []).filter((s) => s !== c.genre && genre(s)).slice(0, 2);
    c.title = (c.title || cand.caption || 'untitled').replace(/\s+/g, ' ').trim().slice(0, 95);
    return c;
  }

  async function post(cand: ReelCandidate, c: Classified, origin: string, addedBy?: string) {
    const guild = await ctx.client.guilds.fetch(ctx.env.DISCORD_GUILD_ID);
    const limit = uploadLimit(guild);
    const video = cand.videoUrl ? await download(cand.videoUrl, limit) : undefined;
    const cover = !video && cand.thumbnailUrl ? await download(cand.thumbnailUrl, 8 * 1024 * 1024) : undefined;

    const stats = { views: cand.views || null, likes: cand.likes || null, comments: cand.comments ?? null, posted_at: cand.postedAt ?? null, duration: cand.durationSec ?? null, thumbnail: cand.thumbnailUrl ?? null };
    const [{ id }] = await sql<{ id: number }[]>`
      INSERT INTO bot.library_items (source_url, platform, author, caption, genre, tags, title, why, copy_brief, stats, score, origin, added_by, video_attached)
      VALUES (${canonicalUrl(cand.url)}, ${cand.platform}, ${cand.author || null}, ${cand.caption || null}, ${c.genre}, ${c.also ?? []}, ${c.title}, ${c.why}, ${c.copy}, ${sql.json(stats as never)}, ${c.score ?? null}, ${origin}, ${addedBy ?? null}, ${Boolean(video)})
      RETURNING id`;

    const when = cand.postedAt ? new Date(cand.postedAt) : undefined;
    const meta = [
      cand.author ? `👤 @${cand.author}` : '',
      cand.likes ? `❤️ ${compact.format(cand.likes)}` : '',
      cand.comments ? `💬 ${compact.format(cand.comments)}` : '',
      cand.views ? `▶️ ${compact.format(cand.views)}` : '',
      when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const content = [`**why it works:** ${c.why}`, `**how to copy it:** ${c.copy}`, meta, video ? `<${cand.url}>` : cand.url].filter(Boolean).join('\n');
    const files = video ? [new AttachmentBuilder(video, { name: `${c.genre}-${id}.mp4` })] : cover ? [new AttachmentBuilder(cover, { name: `${c.genre}-${id}.jpg` })] : [];

    const posts: ItemRow['posts'] = [];
    for (const slug of [c.genre, ...(c.also ?? [])]) {
      const forum = await ctx.client.channels.fetch(forumId(slug)).catch(() => null);
      if (!forum || forum.type !== ChannelType.GuildForum) continue;
      const tagIds = [c.genre, ...(c.also ?? [])]
        .map((s) => forum.availableTags.find((t) => t.name === genre(s)?.name)?.id)
        .filter((t): t is string => Boolean(t));
      const thread = await forum.threads
        .create({ name: c.title.slice(0, 100), appliedTags: tagIds, message: { content, files, components: [buttons(id, 0, 0, 0)] } })
        .catch((err) => {
          ctx.log.warn({ err, slug }, 'forum post failed');
          return null;
        });
      if (thread) posts.push({ genre: slug, forum_id: forum.id, thread_id: thread.id });
    }
    if (!posts.length) {
      await sql`DELETE FROM bot.library_items WHERE id = ${id}`;
      return undefined;
    }
    await sql`UPDATE bot.library_items SET posts = ${sql.json(posts as never)} WHERE id = ${id}`;
    await ctx.api.notion.createRow('reels', `Library · ${genre(c.genre)?.name} · ${c.title}`, { Category: genre(c.genre)?.name ?? c.genre, Source: cand.url, Score: c.score, Status: 'library', Brief: c.copy }).catch(() => undefined);
    return { title: c.title, genre: c.genre, url: `https://discord.com/channels/${guild.id}/${posts[0].thread_id}` };
  }

  /** Daily: every genre's seed accounts + hashtags → rank → Claude → post the top few. */
  async function scout(only?: string) {
    const s = { genres: 0, candidates: 0, posted: 0, dupes: 0, skipped: 0, errors: 0 };
    const sources = await sql<{ genre: string; kind: 'account' | 'hashtag'; value: string; weight: number }[]>`SELECT genre, kind, value, weight FROM bot.library_sources WHERE weight >= 0.3`;
    for (const g of genres()) {
      if (only && g.slug !== only) continue;
      const mine = sources.filter((r) => r.genre === g.slug);
      const queries = [
        ...mine.filter((r) => r.kind === 'account').map((r) => ({ kind: 'account' as const, value: r.value, n: cfg.scout.per_account })),
        ...[...new Set([...g.hashtags, ...mine.filter((r) => r.kind === 'hashtag').map((r) => r.value)])].map((h) => ({ kind: 'hashtag' as const, value: h, n: cfg.scout.per_hashtag })),
      ];
      if (!queries.length) continue;
      s.genres++;
      const pool: ReelCandidate[] = [];
      for (const q of queries) {
        const items = await ctx.api.apify.instagramPage(q.kind, q.value, q.n, cfg.scout.newer_than).catch((err) => {
          ctx.log.warn({ err, genre: g.slug, q }, 'scout source failed');
          s.errors++;
          return [] as ReelCandidate[];
        });
        pool.push(...items);
      }
      // dedupe within the run + against the library, then rank by engagement
      const seen = new Set<string>();
      const fresh: ReelCandidate[] = [];
      for (const c of pool) {
        const key = canonicalUrl(c.url);
        if (seen.has(key)) continue;
        seen.add(key);
        if (await exists(key)) {
          s.dupes++;
          continue;
        }
        fresh.push(c);
      }
      s.candidates += fresh.length;
      await recordSignals(g.slug, fresh).catch((err) => ctx.log.warn({ err }, 'trend signals failed'));
      fresh.sort((a, b) => engagement(b) - engagement(a));
      const top = fresh.slice(0, cfg.scout.classify_top);
      const classified: { cand: ReelCandidate; c: Classified }[] = [];
      for (const cand of top) {
        const c = await classify(cand, `scouted for the ${g.name} folder`).catch(() => undefined);
        if (!c) continue;
        if (c.keep && genre(c.genre) && c.score >= cfg.scout.min_score) classified.push({ cand, c });
        else s.skipped++;
      }
      classified.sort((a, b) => b.c.score - a.c.score || engagement(b.cand) - engagement(a.cand));
      for (const { cand, c } of classified.slice(0, cfg.scout.keep)) {
        const posted = await post(cand, c, 'scout').catch((err) => {
          ctx.log.warn({ err, url: cand.url }, 'scout post failed');
          return undefined;
        });
        if (posted) s.posted++;
      }
    }
    return s;
  }

  function engagement(c: ReelCandidate) {
    const ageDays = c.postedAt ? (Date.now() - new Date(c.postedAt).getTime()) / 86_400_000 : 7;
    const recency = ageDays <= 3 ? 1 : ageDays <= 7 ? 0.8 : ageDays <= 14 ? 0.5 : 0.25;
    return ((c.comments ?? 0) * 5 + c.likes + c.views * 0.01) * recency;
  }

  function uploadLimit(guild: Guild) {
    const mb = [10, 10, 50, 100][guild.premiumTier] ?? 10;
    return Math.floor(mb * 1024 * 1024 * 0.95);
  }

  async function download(url: string, limit: number): Promise<Buffer | undefined> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!res.ok) return undefined;
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len && len > limit) return undefined;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > limit ? undefined : buf;
    } catch (err) {
      ctx.log.warn({ err, url }, 'download failed');
      return undefined;
    }
  }

  // ── 24h trend radar: sounds / hashtags spiking across everything we scan ───
  async function recordSignals(genreSlug: string, cands: ReelCandidate[]) {
    const day = new Date().toISOString().slice(0, 10);
    const tally = new Map<string, { kind: string; value: string; count: number; sample: string }>();
    for (const c of cands) {
      const sigs: [string, string][] = [];
      if (c.audio) sigs.push(['audio', c.audio]);
      for (const h of c.hashtags ?? []) sigs.push(['hashtag', h.toLowerCase()]);
      for (const [kind, value] of sigs) {
        const k = `${kind}:${value}`;
        const cur = tally.get(k) ?? { kind, value, count: 0, sample: c.url };
        cur.count++;
        tally.set(k, cur);
      }
    }
    for (const t of tally.values()) {
      await sql`INSERT INTO bot.trend_signals (day, kind, value, count, sample_url, genres) VALUES (${day}, ${t.kind}, ${t.value}, ${t.count}, ${t.sample}, ${[genreSlug]})
                ON CONFLICT (day, kind, value) DO UPDATE SET count = bot.trend_signals.count + EXCLUDED.count,
                  genres = (SELECT ARRAY(SELECT DISTINCT unnest(bot.trend_signals.genres || EXCLUDED.genres)))`;
    }
  }

  /** A signal is "trending" when today's count ≥ 4 and ≥ 3× its average over the previous 7 days. Alerts once per signal. */
  async function radar(): Promise<number> {
    const rows = await sql<{ kind: string; value: string; count: number; baseline: number; sample_url: string | null; genres: string[] }[]>`
      WITH today AS (SELECT * FROM bot.trend_signals WHERE day = CURRENT_DATE),
           base AS (SELECT kind, value, AVG(count)::float AS baseline FROM bot.trend_signals WHERE day < CURRENT_DATE AND day >= CURRENT_DATE - 7 GROUP BY kind, value)
      SELECT t.kind, t.value, t.count, COALESCE(b.baseline, 0) AS baseline, t.sample_url, t.genres
      FROM today t LEFT JOIN base b USING (kind, value)
      WHERE t.count >= 4 AND t.count >= 3 * COALESCE(b.baseline, 0.5)
        AND NOT EXISTS (SELECT 1 FROM bot.trend_alerts a WHERE a.kind = t.kind AND a.value = t.value AND a.alerted_at > now() - interval '14 days')
      ORDER BY t.count DESC LIMIT 3`;
    let n = 0;
    for (const r of rows) {
      // skip the genre's own seed hashtags — they are expected to be everywhere
      if (r.kind === 'hashtag' && genres().some((g) => g.hashtags.includes(r.value))) continue;
      const sample = r.sample_url ? await sql<{ caption: string | null }[]>`SELECT caption FROM bot.library_items WHERE source_url = ${canonicalUrl(r.sample_url)}` : [];
      let text = { what: `${r.kind === 'audio' ? 'sound' : '#' + r.value} showing up in ${r.count} reels today`, how: 'film your version of it this week' };
      try {
        text = await ctx.api.claude.json<{ what: string; how: string }>(
          loadPrompt('trend.alert', { kind: r.kind === 'audio' ? 'sound' : 'hashtag', value: r.value, count: String(r.count), baseline: r.baseline.toFixed(1), genres: r.genres.join(', ') || '—', sample: r.sample_url ?? '', sample_caption: (sample[0]?.caption ?? '').replace(/\s+/g, ' ').slice(0, 160) }),
          { maxTokens: 200, temperature: 0.4 },
        );
      } catch (err) {
        ctx.log.warn({ err }, 'trend alert text failed');
      }
      const label = r.kind === 'audio' ? `🎵 **${r.value}**` : `#️⃣ **#${r.value}**`;
      const msg = `🔥 **trending right now** — ${label} · ${r.count} reels today (${r.genres.map((g) => genre(g)?.emoji ?? g).join(' ')})\n${text.what}\n**how to ride it:** ${text.how}${r.sample_url ? `\n<${r.sample_url}>` : ''}`;
      await ctx.send(ctx.ch('agency_lounge'), { content: msg, allowedMentions: { parse: [] } });
      await ctx.send(ctx.ch('daily_report') || ctx.ch('live_alerts'), { content: msg, allowedMentions: { parse: [] } });
      await sql`INSERT INTO bot.trend_alerts (kind, value) VALUES (${r.kind}, ${r.value}) ON CONFLICT (kind, value) DO UPDATE SET alerted_at = now()`;
      n++;
    }
    return n;
  }

  // ── routed drops: her top picks in her own channel ─────────────────────────
  /** For each model with lanes: newest high-scoring library items in her lanes she has not received → her #general with a Copy button. */
  async function deliverPicks(only?: string) {
    const r = { models: 0, delivered: 0, skipped: 0 };
    const n = cfg.scout.picks_per_model;
    if (!n) return r;
    for (const model of ctx.models.all()) {
      if (only && model.slug !== only) continue;
      if (!model.lanes.length) {
        r.skipped++;
        continue;
      }
      const items = await sql<ItemRow[]>`
        SELECT i.* FROM bot.library_items i
        WHERE (i.genre = ANY(${model.lanes}) OR i.tags && ${model.lanes})
          AND i.created_at > now() - interval '3 days'
          AND NOT EXISTS (SELECT 1 FROM bot.library_deliveries d WHERE d.item_id = i.id AND d.model_slug = ${model.slug})
        ORDER BY COALESCE(i.score, 0) DESC, (i.up - i.down) DESC, i.created_at DESC
        LIMIT ${n}`;
      if (!items.length) {
        r.skipped++;
        continue;
      }
      const lines = items.map((it, k) => `**${k + 1}. ${it.title}** · ${genre(it.genre)?.emoji ?? ''} ${genre(it.genre)?.name ?? it.genre}\n${it.why ? `_why:_ ${it.why}\n` : ''}${it.copy_brief ? `_do:_ ${it.copy_brief}\n` : ''}${threadUrl(it) ?? it.source_url}`);
      const rows = items.map((it) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`library:copy:${model.slug}:${it.id}`).setLabel(`Copy #${items.indexOf(it) + 1} to my board`).setEmoji('📋').setStyle(ButtonStyle.Primary),
        ),
      );
      const sent = await ctx.send(model.discord.channels.general, { content: [`🔥 **today's picks for you** — trending in your lanes, tap to put one on your board`, ...lines].join('\n\n').slice(0, 1990), components: rows.slice(0, 5), allowedMentions: { parse: [] } });
      if (!sent) continue;
      for (const it of items) await sql`INSERT INTO bot.library_deliveries (item_id, model_slug) VALUES (${it.id}, ${model.slug}) ON CONFLICT DO NOTHING`;
      r.models++;
      r.delivered += items.length;
    }
    return r;
  }

  // ── structure ──────────────────────────────────────────────────────────────
  async function ensureLibrary() {
    cfg = loadLibrary();
    const guild = await ctx.client.guilds.fetch(ctx.env.DISCORD_GUILD_ID);
    await guild.channels.fetch();
    const me = ctx.client.user!.id;
    const owners = ctx.ownerIds();
    const clamp = await clampToBot(guild);
    const everyone = guild.roles.everyone.id;

    const catOverwrites = clamp([
      { id: everyone, type: ROLE, allow: [PermissionFlagsBits.ViewChannel] },
      { id: me, type: MEMBER, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory] },
    ]);
    const forumOverwrites = clamp([
      { id: everyone, type: ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.SendMessagesInThreads], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads] },
      { id: me, type: MEMBER, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory] },
      ...owners.map((id): OverwriteResolvable => ({ id, type: MEMBER, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageThreads] })),
    ]);
    const inboxOverwrites = clamp([
      { id: everyone, type: ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions] },
      { id: me, type: MEMBER, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions] },
    ]);

    // category
    let cat = guild.channels.cache.get(ctx.settings.getString('library.category')) as CategoryChannel | undefined;
    if (!cat || cat.type !== ChannelType.GuildCategory) cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === CAT_NAME) as CategoryChannel | undefined;
    if (!cat) cat = await guild.channels.create({ name: CAT_NAME, type: ChannelType.GuildCategory, permissionOverwrites: catOverwrites });
    else await cat.permissionOverwrites.set(catOverwrites).catch((err) => ctx.log.warn({ err }, 'library category perms'));
    if (ctx.settings.getString('library.category') !== cat.id) await ctx.settings.set('library.category', cat.id);

    // inbox
    let inbox = guild.channels.cache.get(inboxId());
    if (!inbox || inbox.type !== ChannelType.GuildText) inbox = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.parentId === cat!.id && c.name === INBOX_NAME);
    let inboxCreated = false;
    if (!inbox) {
      inbox = await guild.channels.create({ name: INBOX_NAME, type: ChannelType.GuildText, parent: cat.id, topic: 'paste Instagram / TikTok links here → filed into the right folder in about a minute. Add a word or two if you want a specific folder.', permissionOverwrites: inboxOverwrites });
      inboxCreated = true;
    } else if (inbox.type === ChannelType.GuildText) await inbox.permissionOverwrites.set(inboxOverwrites).catch((err) => ctx.log.warn({ err }, 'library inbox perms'));
    if (inboxId() !== inbox.id) await ctx.settings.set('library.inbox', inbox.id);

    // one forum per genre, gallery view, every genre also available as a tag
    const tags: GuildForumTagData[] = genres().map((g) => ({ name: g.name, emoji: { id: null, name: g.emoji.replace(/️/g, '') } }));
    const created: string[] = [];
    for (const g of genres()) {
      const name = channelName(g);
      let forum = guild.channels.cache.get(forumId(g.slug)) as ForumChannel | undefined;
      if (!forum || forum.type !== ChannelType.GuildForum) forum = guild.channels.cache.find((c) => c.type === ChannelType.GuildForum && c.parentId === cat!.id && c.name === name) as ForumChannel | undefined;
      if (!forum) {
        forum = await guild.channels.create({
          name,
          type: ChannelType.GuildForum,
          parent: cat.id,
          topic: `${g.description}\n\nTap a video → 🔥 if you'd copy it · 📋 Copy this puts it on your board with a brief. New links go in #${INBOX_NAME}.`,
          availableTags: tags,
          defaultForumLayout: ForumLayoutType.GalleryView,
          defaultSortOrder: SortOrderType.CreationDate,
          defaultReactionEmoji: { id: null, name: '🔥' },
          permissionOverwrites: forumOverwrites,
        });
        created.push(name);
      } else {
        if (forum.name !== name) await forum.setName(name).catch(() => undefined);
        await forum.permissionOverwrites.set(forumOverwrites).catch((err) => ctx.log.warn({ err, forum: name }, 'library forum perms'));
        const missing = tags.filter((t) => !forum!.availableTags.some((x) => x.name === t.name));
        if (missing.length) await forum.setAvailableTags([...forum.availableTags, ...missing]).catch((err) => ctx.log.warn({ err, forum: name }, 'library forum tags'));
      }
      if (forumId(g.slug) !== forum.id) await ctx.settings.set(`library.forum.${g.slug}`, forum.id);
    }

    if (inboxCreated && inbox.type === ChannelType.GuildText) {
      await inbox.send({
        content: [
          '📥 **Content Library inbox.** Paste an Instagram or TikTok link here and I file it in the right folder with notes on why it works and how to copy it.',
          'Add a word if you want a specific folder — e.g. `https://www.instagram.com/reel/… golf`.',
          `Folders: ${genres().map((g) => `<#${forumId(g.slug)}>`).join(' ')}`,
        ].join('\n'),
        allowedMentions: { parse: [] },
      });
    }
    if (created.length) {
      await ctx.ops(MODULE, 'folders-created', { data: { created } });
      await ctx.send(ctx.ch('bot_dev'), { content: `📚 Content Library ready: ${created.length} folder(s) created under **${CAT_NAME}** + <#${inbox.id}>. Seed accounts: \`/library source add\`.`, allowedMentions: { parse: [] } });
    }
  }

  /** Discord strips variation selectors from channel names; strip them ourselves so the name compares equal on every boot (renames are rate-limited). */
  function channelName(g: Genre) {
    return `${g.emoji.replace(/\uFE0F/g, '')}-${g.slug}`;
  }
}
