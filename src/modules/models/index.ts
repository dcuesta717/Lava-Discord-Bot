import YAML from 'yaml';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, MessageFlags, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import { loadLibrary } from '../../config/library.js';
import type { InstagramProfile, ReelCandidate } from '../../integrations/apify.js';
import { GitHub, type RepoFile } from '../../integrations/github.js';
import { importedSection, withImportedSection } from '../../lib/caption-examples.js';
import { ensureModelStructure } from '../../lib/model-structure.js';
import { loadPrompt } from '../../lib/prompts.js';
import { industryLens } from '../../lib/industry.js';
import { computeStats, renderFiles, renderProfile, renderSourcing, renderVoice, keepStaffTail, tmpl, today, STAFF_MARKER, type Research, type Stats } from './render.js';

/**
 * Model onboarding — the front door for a new creator, from Discord, no laptop:
 *
 *   /model add name:"Jane Doe" user:@jane instagram:janedoe [tiktok:janedoe] [timezone]
 *     1. her private category + role + channels (lib/model-structure)
 *     2. deep research: Apify → profile + ~65 recent posts (+ TikTok) → computed stats → Claude (prompts/model.research.md)
 *     3. writes models/<slug>/ (model.yaml, profile.md, voice/*, sourcing/*, notes.md, playbooks/) and commits it to GitHub
 *        in one commit → Railway redeploys → she is loaded (~2 min) → welcome message in her #general.
 *   /model refresh slug   re-run the research (profile.md + imported captions + sourcing); hand-written files untouched.
 *   /model lanes slug lanes:"golf, gym-girl"   set her Content Library lanes (model.yaml) — drives routed drops + ideas.
 *   /model list
 *
 * State in bot.model_onboarding. Needs GITHUB_TOKEN (fine-grained PAT, Contents: read/write) — without it the research is
 * saved in the DB and the command tells you how to finish.
 */
const MODULE = 'models';
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'Europe/London'];

interface OnboardingRow {
  slug: string;
  display_name: string;
  user_id: string;
  instagram: string | null;
  tiktok: string | null;
  timezone: string;
  status: string;
  discord: Record<string, unknown>;
  research: { research?: Research; stats?: Stats; profile?: InstagramProfile } | Record<string, never>;
  commit_sha: string | null;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const github = new GitHub(ctx.env.GITHUB_TOKEN, ctx.env.GITHUB_REPO, ctx.env.GITHUB_BRANCH);

  // ── boot: welcome models that went live with this deploy; hand the role to late joiners ───────────────────
  ctx.client.once(Events.ClientReady, async () => {
    await ctx.ready; // #bot-dev etc. exist once setup is done
    resumeInterrupted().catch((err) => ctx.log.warn({ err }, 'onboarding resume failed'));
    postMissingReviews().catch((err) => ctx.log.warn({ err }, 'review backfill failed'));
    try {
      const rows = await sql<OnboardingRow[]>`SELECT * FROM bot.model_onboarding WHERE status = 'committed'`;
      for (const r of rows) {
        const model = ctx.models.get(r.slug);
        if (!model) continue;
        const research = (r.research as { research?: Research }).research;
        const lanes = model.lanes.length ? model.lanes : (research?.lanes ?? []).map((l) => l.slug);
        await ctx.send(model.discord.channels.general, {
          content: [
            `👋 hey <@${model.discord.user_id}> — welcome to Lava HQ. This is your private space; only you, ${ctx.ownerMentions()} and me can see it.`,
            `Here's what I do for you: \`/live-started\` when you go live (I'll check in), \`/caption\` when you need a caption in your voice, \`/my-week\` for your numbers, and your 🎬-reels-copy-board fills up with videos to recreate${lanes.length ? ` in your lanes (${lanes.join(', ')})` : ''}.`,
            `Browse the 🎬 CONTENT LIBRARY folders for ideas anytime — tap 📋 Copy this on anything you want on your board.`,
          ].join('\n'),
        }).catch(() => undefined);
        await ctx.send(ctx.ch('bot_dev'), { content: `✅ **${model.display_name}** is live. Her research and voice draft are in <#${ctx.ch('onboarding') || ctx.ch('bot_dev')}> waiting for an owner's ✅.`, allowedMentions: { parse: [] } });
        await sql`UPDATE bot.model_onboarding SET status = 'live', updated_at = now() WHERE slug = ${r.slug}`;
        await ctx.ops(MODULE, 'live', { model });
        ctx.bus.emit('model:live', { model }); // reels scout + library picks + first report, right now instead of tomorrow 7 AM
      }
    } catch (err) {
      ctx.log.warn({ err }, 'model welcome pass failed');
    }
  });

  /** Models that are live but whose research was never shown to the owners in Discord (older onboardings). */
  async function postMissingReviews() {
    const rows = await sql<{ slug: string }[]>`SELECT slug FROM bot.model_onboarding WHERE status = 'live' AND (research->>'reviewed') IS NULL`;
    for (const r of rows) {
      const model = ctx.models.get(r.slug);
      if (!model) continue;
      const f = model.files();
      if (!f.profile) continue;
      await postReview(r.slug, model.display_name, [
        { path: `models/${r.slug}/profile.md`, content: f.profile },
        { path: `models/${r.slug}/voice/voice.md`, content: f.voice },
      ]);
    }
  }

  /** A deploy/restart in the middle of /model add leaves a row at started|structured|researched — finish it. */
  async function resumeInterrupted() {
    const rows = await sql<OnboardingRow[]>`SELECT * FROM bot.model_onboarding WHERE status IN ('started','structured','researched') AND updated_at > now() - interval '3 hours'`;
    for (const r of rows) {
      if (ctx.models.get(r.slug) || !r.instagram) continue;
      const progress = async (t: string) => {
        await ctx.send(ctx.ch('bot_dev'), { content: `↻ resuming ${r.display_name}'s onboarding after a restart — ${t}`, allowedMentions: { parse: [] } });
      };
      try {
        const result = await onboard({ name: r.display_name, userId: r.user_id, instagram: r.instagram, tiktok: r.tiktok ?? '', timezone: r.timezone, slug: r.slug, requestedBy: 'resume', actorId: ctx.client.user!.id, progress });
        await ctx.send(ctx.ch('bot_dev'), { content: result, allowedMentions: { parse: [] } });
      } catch (err) {
        await ctx.send(ctx.ch('bot_dev'), { content: `❌ could not resume ${r.display_name}: ${err instanceof Error ? err.message : String(err)}`, allowedMentions: { parse: [] } });
      }
    }
  }

  // Weekly: re-research every creator so profiles, imported captions and sourcing never go stale (voice.md untouched).
  ctx.cron('models:weekly-refresh', '0 6 * * 0', ctx.env.DEFAULT_TIMEZONE, async () => {
    if (!ctx.api.apify.enabled || !github.enabled) return;
    const lines: string[] = [];
    for (const model of ctx.models.all()) {
      if (!model.socials.instagram) continue;
      try {
        const { research, stats, profile, posts } = await runResearch({ displayName: model.display_name, instagram: model.socials.instagram, tiktok: model.socials.tiktok, timezone: model.timezone });
        const existingProfile = (await github.read(`models/${model.slug}/profile.md`)) ?? '';
        const existingExamples = (await github.read(`models/${model.slug}/voice/caption-examples.md`)) ?? tmpl('voice/caption-examples.md');
        await github.commitFiles(
          [
            { path: `models/${model.slug}/profile.md`, content: renderProfile({ name: model.display_name, instagram: model.socials.instagram, tiktok: model.socials.tiktok, research, stats, profile }, keepStaffTail(existingProfile), ctx.env.DEFAULT_TIMEZONE) },
            { path: `models/${model.slug}/voice/caption-examples.md`, content: withImportedSection(existingExamples, importedSection(posts)) },
            { path: `models/${model.slug}/sourcing/reels-sources.yaml`, content: renderSourcing(research, model.socials.tiktok, ctx.env.DEFAULT_TIMEZONE) },
          ],
          `Weekly refresh: ${model.display_name} (${model.slug})`,
        );
        await sql`UPDATE bot.model_onboarding SET research = ${sql.json({ research, stats, profile: { ...profile, latestPosts: undefined }, reviewed: true } as never)}, updated_at = now() WHERE slug = ${model.slug}`;
        lines.push(`${model.display_name}: ${stats.posts} posts · ${stats.posts_per_week}/wk · lanes ${research.lanes.map((l) => l.slug).join('/') || '—'}`);
      } catch (err) {
        ctx.log.warn({ err, model: model.slug }, 'weekly refresh failed');
        lines.push(`${model.display_name}: failed`);
      }
    }
    if (lines.length) await ctx.send(ctx.ch('daily_report') || ctx.ch('bot_dev'), { content: `🔄 **weekly profile refresh** — ${lines.join(' · ')}`, allowedMentions: { parse: [] } });
    await ctx.ops(MODULE, 'weekly-refresh', { data: { models: lines.length } });
  });

  ctx.client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    const rows = await sql<{ slug: string; discord: { role_id?: string } }[]>`SELECT slug, discord FROM bot.model_onboarding WHERE user_id = ${member.id}`.catch(() => []);
    for (const r of rows) {
      const roleId = r.discord?.role_id ?? ctx.models.get(r.slug)?.discord.role_id;
      if (roleId) await member.roles.add(roleId).catch((err) => ctx.log.warn({ err, slug: r.slug }, 'late role add failed'));
    }
  });

  // ── /model ─────────────────────────────────────────────────────────────────
  ctx.command(
    new SlashCommandBuilder()
      .setName('model')
      .setDescription('Onboard and manage creators (owners)')
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription('Onboard a new creator: channels + deep research + files in GitHub')
          .addStringOption((o) => o.setName('name').setDescription('Display name, e.g. Jane Doe').setRequired(true))
          .addUserOption((o) => o.setName('user').setDescription('Her Discord account').setRequired(true))
          .addStringOption((o) => o.setName('instagram').setDescription('Her IG handle (no @)').setRequired(true))
          .addStringOption((o) => o.setName('tiktok').setDescription('Her TikTok handle (no @)'))
          .addStringOption((o) => o.setName('timezone').setDescription('Where she lives (default New York)').addChoices(...TIMEZONES.map((t) => ({ name: t.replace('America/', '').replace('Europe/', '').replace('_', ' '), value: t }))))
          .addStringOption((o) => o.setName('slug').setDescription('Folder name, lowercase (default from her name)')),
      )
      .addSubcommand((s) => s.setName('refresh').setDescription('Re-run the research for a creator').addStringOption((o) => o.setName('slug').setDescription('Model slug').setRequired(true)))
      .addSubcommand((s) =>
        s
          .setName('lanes')
          .setDescription('Set which Content Library folders she belongs to')
          .addStringOption((o) => o.setName('slug').setDescription('Model slug').setRequired(true))
          .addStringOption((o) => o.setName('lanes').setDescription('e.g. golf, words-on-screen (see /library stats for slugs)').setRequired(true)),
      )
      .addSubcommand((s) => s.setName('list').setDescription('Loaded creators + onboardings in progress'))
      .addSubcommand((s) =>
        s
          .setName('remove')
          .setDescription('Off-board a creator: delete her channels + role and her models/<slug>/ folder in GitHub')
          .addStringOption((o) => o.setName('slug').setDescription('Model slug').setRequired(true))
          .addBooleanOption((o) => o.setName('confirm').setDescription('Set to True — this deletes her channels').setRequired(true)),
      ),
    async (i) => {
      if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
      const sub = i.options.getSubcommand();
      if (sub === 'list') return list(i);
      if (sub === 'add') return add(i);
      if (sub === 'refresh') return refresh(i);
      if (sub === 'lanes') return setLanes(i);
      if (sub === 'remove') {
        if (!i.options.getBoolean('confirm', true)) return i.reply({ content: 'set confirm: True to off-board her', flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        return i.editReply(await offboard(i.options.getString('slug', true).toLowerCase(), i.user.id).catch((err) => `❌ ${err instanceof Error ? err.message : String(err)}`));
      }
    },
  );

  /** Off-boarding: delete her channels/category/role and models/<slug>/ in GitHub (data rows stay for history). */
  async function offboard(slug: string, actorId: string): Promise<string> {
    const model = ctx.models.get(slug);
    const row = (await sql<OnboardingRow[]>`SELECT * FROM bot.model_onboarding WHERE slug = ${slug}`)[0];
    if (!model && !row) throw new Error(`unknown model \`${slug}\``);
    const guild = await ctx.client.guilds.fetch(ctx.env.DISCORD_GUILD_ID);
    await guild.channels.fetch();
    const ids = (model?.discord ?? (row?.discord as { category_id?: string; role_id?: string } | undefined)) as { category_id?: string; role_id?: string } | undefined;
    const done: string[] = [];
    if (ids?.category_id) {
      const cat = guild.channels.cache.get(ids.category_id);
      if (cat && cat.type === ChannelType.GuildCategory) {
        for (const ch of [...cat.children.cache.values()]) await ch.delete('off-boarded').catch(() => undefined);
        await cat.delete('off-boarded').catch(() => undefined);
        done.push('channels');
      }
    }
    if (ids?.role_id) {
      await guild.roles.delete(ids.role_id, 'off-boarded').catch(() => undefined);
      done.push('role');
    }
    if (github.enabled) {
      const paths = await github.listDir(`models/${slug}`).catch(() => [] as string[]);
      if (paths.length) {
        const sha = await github.commitFiles(paths.map((path) => ({ path, content: null })), `Off-board ${model?.display_name ?? slug} (${slug}) — /model remove`);
        done.push(`GitHub (${sha.slice(0, 7)})`);
      }
    } else done.push('GitHub NOT touched (no GITHUB_TOKEN) — delete models/' + slug + ' by hand');
    await sql`UPDATE bot.model_onboarding SET status = 'removed', updated_at = now() WHERE slug = ${slug}`;
    await ctx.ops(MODULE, 'offboarded', { actor: actorId, data: { slug, done } });
    return `🗑️ ${model?.display_name ?? slug} off-boarded — removed: ${done.join(', ')}. Her data rows (posts, reports, library votes) are kept for history. She disappears from the bot after the redeploy (~2 min).`;
  }

  // ── chat-callable actions (operator) ────────────────────────────────────────
  ctx.action('onboard_model', {
    description: 'Onboard a new creator: build her private channels, research her Instagram/TikTok, write models/<slug>/ to GitHub. Takes ~2 minutes. Needs her display name, her Discord user id (from an @mention, digits only), and her Instagram handle. Confirm the details with the owner once before calling.',
    input: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name, e.g. "Jane Doe"' },
        discord_user_id: { type: 'string', description: 'Her Discord user id (digits). In chat an @mention appears as <@123…>; pass the digits.' },
        instagram: { type: 'string', description: 'Instagram handle without @' },
        tiktok: { type: 'string', description: 'TikTok handle without @ (optional)' },
        timezone: { type: 'string', description: 'IANA timezone, e.g. America/Los_Angeles (optional, default New York)' },
      },
      required: ['name', 'discord_user_id', 'instagram'],
    },
    ownersOnly: true,
    slow: true,
    run: (input, actor) =>
      onboard({ name: String(input.name), userId: String(input.discord_user_id), instagram: String(input.instagram), tiktok: input.tiktok ? String(input.tiktok) : '', timezone: input.timezone ? String(input.timezone) : undefined, requestedBy: `chat:${actor.userId}`, actorId: actor.userId, progress: actor.progress }),
  });
  ctx.action('remove_model', {
    description: "Off-board a creator: delete her private channels, her role, and her models/<slug>/ folder in GitHub. Destructive — confirm with the owner once before calling.",
    input: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    ownersOnly: true,
    slow: true,
    run: (input, actor) => offboard(String(input.slug).toLowerCase(), actor.userId),
  });
  ctx.action('kickoff_model', {
    description: "Run everything for one creator right now instead of waiting for the morning jobs: her reels scout (board), her library picks, her analytics snapshot + report.",
    input: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    ownersOnly: true,
    slow: true,
    run: async (input) => {
      const model = ctx.models.get(String(input.slug));
      if (!model) return `unknown model ${String(input.slug)} — is she onboarded and has the redeploy finished?`;
      ctx.bus.emit('model:live', { model });
      return `kicked off for ${model.display_name}: reels scout → her board, library picks → her #general, snapshot → her #notification. Results land in her channels over the next few minutes.`;
    },
  });
  ctx.action('list_models', {
    description: 'List onboarded creators (slug, name, Instagram, lanes) and onboardings in progress.',
    input: { type: 'object', properties: {} },
    run: async () => {
      const rows = await sql<OnboardingRow[]>`SELECT slug, display_name, status FROM bot.model_onboarding ORDER BY created_at`;
      const loaded = ctx.models.all().map((m) => `${m.display_name} (${m.slug}) — @${m.socials.instagram || '?'} · lanes: ${m.lanes.join(', ') || 'none'} · tz ${m.timezone}`);
      const pending = rows.filter((r) => !ctx.models.get(r.slug)).map((r) => `${r.display_name} (${r.slug}) — ${r.status}`);
      return [`live (${loaded.length}): ${loaded.join(' | ') || 'none'}`, pending.length ? `in progress: ${pending.join(' | ')}` : ''].filter(Boolean).join('\n');
    },
  });
  ctx.action('set_model_lanes', {
    description: 'Set which Content Library folders (lanes) a creator belongs to; drives her daily picks and event ideas. Applies after a redeploy.',
    input: { type: 'object', properties: { slug: { type: 'string' }, lanes: { type: 'array', items: { type: 'string' }, description: 'genre slugs, e.g. ["golf","words-on-screen"]' } }, required: ['slug', 'lanes'] },
    ownersOnly: true,
    run: async (input, actor) => {
      const model = ctx.models.get(String(input.slug));
      if (!model) return `unknown model ${String(input.slug)}`;
      if (!github.enabled) return 'GITHUB_TOKEN is not set';
      const valid = new Set(loadLibrary().genres.map((g) => g.slug));
      const lanes = (Array.isArray(input.lanes) ? input.lanes : []).map(String).map((s) => s.toLowerCase());
      const bad = lanes.filter((l) => !valid.has(l));
      if (bad.length) return `unknown folder(s): ${bad.join(', ')} — valid: ${[...valid].join(', ')}`;
      const path = `models/${model.slug}/model.yaml`;
      const raw = await github.read(path);
      if (!raw) return `${path} not found in GitHub`;
      const doc = YAML.parseDocument(raw);
      doc.set('lanes', lanes);
      const sha = await github.commitFiles([{ path, content: doc.toString() }], `${model.display_name}: lanes → ${lanes.join(', ')} (chat, ${actor.userId})`);
      await ctx.ops(MODULE, 'lanes', { model, actor: actor.userId, data: { lanes } });
      return `${model.display_name} → lanes ${lanes.join(', ')} (${sha.slice(0, 7)}; live after the redeploy, ~2 min)`;
    },
  });

  async function list(i: ChatInputCommandInteraction) {
    const rows = await sql<OnboardingRow[]>`SELECT * FROM bot.model_onboarding ORDER BY created_at`;
    const loaded = ctx.models.all().map((m) => `• **${m.display_name}** (\`${m.slug}\`) — @${m.socials.instagram || '?'} · lanes: ${m.lanes.join(', ') || '_none_'} · <#${m.discord.channels.general}>`);
    const pending = rows.filter((r) => !ctx.models.get(r.slug)).map((r) => `• ${r.display_name} (\`${r.slug}\`) — ${r.status}${r.status === 'committed' ? ' (waiting for the redeploy, ~2 min)' : ''}`);
    return i.reply({ content: [loaded.length ? `**Live (${loaded.length})**\n${loaded.join('\n')}` : '_no creators loaded yet_', pending.length ? `\n**In progress**\n${pending.join('\n')}` : ''].join('\n').slice(0, 1900), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  }

  async function add(i: ChatInputCommandInteraction) {
    const o = {
      name: i.options.getString('name', true),
      userId: i.options.getUser('user', true).id,
      instagram: i.options.getString('instagram', true),
      tiktok: i.options.getString('tiktok') ?? '',
      timezone: i.options.getString('timezone') ?? undefined,
      slug: i.options.getString('slug') ?? undefined,
    };
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const progress = (t: string) => i.editReply(t).then(() => undefined).catch(() => undefined);
    try {
      await i.editReply(await onboard({ ...o, requestedBy: i.user.tag, actorId: i.user.id, progress }));
    } catch (err) {
      await i.editReply(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** The whole onboarding, shared by /model add and the operator chat. Throws with a readable message on failure. */
  async function onboard(o: { name: string; userId: string; instagram: string; tiktok?: string; timezone?: string; slug?: string; requestedBy: string; actorId: string; progress: (t: string) => Promise<void> }): Promise<string> {
    const name = o.name.trim();
    const user = { id: o.userId.replace(/[<@!>]/g, '') };
    const instagram = clean(o.instagram);
    const tiktok = clean(o.tiktok ?? '');
    const timezone = o.timezone ?? ctx.env.DEFAULT_TIMEZONE;
    const slug = (o.slug ?? slugify(name)).toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(slug)) throw new Error(`slug must be lowercase letters/numbers/dashes (got \`${slug}\`)`);
    if (!/^\d{15,22}$/.test(user.id)) throw new Error('I need her Discord account (an @mention) to give her the role and channels');
    if (!instagram) throw new Error('I need her Instagram handle to research her');
    if (!ctx.api.apify.enabled) throw new Error('`APIFY_TOKEN` is not set — I need it to research her account.');
    if (ctx.models.get(slug)) throw new Error(`\`${slug}\` is already onboarded — use \`/model refresh slug:${slug}\``);
    if (github.enabled && (await github.exists(`models/${slug}/model.yaml`).catch(() => false))) throw new Error(`models/${slug}/ already exists in GitHub (it goes live on the next deploy)`);

    const say = o.progress;
    await sql`INSERT INTO bot.model_onboarding (slug, display_name, user_id, instagram, tiktok, timezone, status, requested_by)
              VALUES (${slug}, ${name}, ${user.id}, ${instagram}, ${tiktok || null}, ${timezone}, 'started', ${o.actorId})
              ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, user_id = EXCLUDED.user_id, instagram = EXCLUDED.instagram, tiktok = EXCLUDED.tiktok, timezone = EXCLUDED.timezone, status = 'started', error = NULL, requested_by = EXCLUDED.requested_by, updated_at = now()`;

    try {
      // 1. Discord home
      await say(`⏳ 1/3 building ${name}'s private channels…`);
      const guild = await ctx.client.guilds.fetch(ctx.env.DISCORD_GUILD_ID);
      const ids = await ensureModelStructure(guild, { slug, displayName: name, userId: user.id, botId: ctx.client.user!.id, staffIds: ctx.ownerIds() });
      await sql`UPDATE bot.model_onboarding SET discord = ${sql.json(ids as never)}, status = 'structured', updated_at = now() WHERE slug = ${slug}`;
      const inGuild = await guild.members.fetch(user.id).then(() => true).catch(() => false);

      // 2. Research
      await say(`⏳ 2/3 researching @${instagram}${tiktok ? ` + @${tiktok} (TikTok)` : ''} — profile, recent posts, what performs… (about a minute)`);
      const { research, stats, profile, posts } = await runResearch({ displayName: name, instagram, tiktok, timezone });
      await sql`UPDATE bot.model_onboarding SET research = ${sql.json({ research, stats, profile: { ...profile, latestPosts: undefined } } as never)}, status = 'researched', updated_at = now() WHERE slug = ${slug}`;

      // 3. Files → GitHub
      const files = renderFiles({ slug, name, userId: user.id, instagram, tiktok, timezone, ids, research, stats, profile, posts }, ctx.env.DEFAULT_TIMEZONE);
      if (!github.enabled) {
        return `⚠️ research done for ${name} and saved, but \`GITHUB_TOKEN\` isn't set so I can't write her files into the repo. Add it in Railway (docs/runbook.md) and run \`/model refresh slug:${slug}\` — it will commit everything then.`;
      }
      await say(`⏳ 3/3 writing models/${slug}/ to GitHub…`);
      const sha = await github.commitFiles(files, `Onboard ${name} (${slug}) — /model add by ${o.requestedBy}\n\nProfile, voice draft, ${stats.posts} imported captions, sourcing seeds. Generated by the bot; review voice/voice.md.`);
      await sql`UPDATE bot.model_onboarding SET commit_sha = ${sha}, status = 'committed', updated_at = now() WHERE slug = ${slug}`;
      await ctx.ops(MODULE, 'onboarded', { actor: o.actorId, data: { slug, sha, posts: stats.posts, lanes: research.lanes.map((l) => l.slug) } });

      const lanes = research.lanes.map((l) => `${l.slug} (${Math.round(l.confidence * 100)}%)`).join(', ');
      await postReview(slug, name, files).catch((err) => ctx.log.warn({ err, slug }, 'review post failed'));
      return [
        `✅ **${name}** is onboarded. Her channels are up and she goes live in about 2 minutes — I'll welcome her in <#${ids.channels.general}> and drop her first videos, picks and numbers right after.`,
        `**Research:** ${stats.posts} posts analysed · ${stats.posts_per_week.toFixed(1)} posts/week · ${research.one_liner}`,
        `**Lanes:** ${lanes || '_none found — tell me which folders she belongs in_'}`,
        `**What wins:** ${research.formats_that_win.slice(0, 3).map((f) => f.format).join(' · ')}`,
        `📋 **Her full research + voice draft is in <#${ctx.ch('onboarding') || ctx.ch('bot_dev')}>** — read it there and tap ✅ Approve, ✏️ Notes (tell me what's wrong or what you know about her) or 🔁 Redo.`,
        inGuild ? '' : `⚠️ <@${user.id}> isn't in the server yet — invite her; her role and channels attach automatically when she joins.`,
      ]
        .filter(Boolean)
        .join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log.error({ err, slug }, 'onboarding failed');
      await sql`UPDATE bot.model_onboarding SET status = 'failed', error = ${msg.slice(0, 500)}, updated_at = now() WHERE slug = ${slug}`;
      throw new Error(`onboarding ${name} failed: ${msg.slice(0, 300)} — run it again; channels already created are reused.`);
    }
  }

  async function refresh(i: ChatInputCommandInteraction) {
    const slug = i.options.getString('slug', true).toLowerCase();
    const model = ctx.models.get(slug);
    const row = (await sql<OnboardingRow[]>`SELECT * FROM bot.model_onboarding WHERE slug = ${slug}`)[0];
    if (!model && !row) return i.reply({ content: `unknown model \`${slug}\``, flags: MessageFlags.Ephemeral });
    if (!ctx.api.apify.enabled || !github.enabled) return i.reply({ content: 'needs `APIFY_TOKEN` and `GITHUB_TOKEN` set in Railway', flags: MessageFlags.Ephemeral });
    const instagram = model?.socials.instagram || row?.instagram || '';
    const tiktok = model?.socials.tiktok || row?.tiktok || '';
    const name = model?.display_name ?? row!.display_name;
    const timezone = model?.timezone ?? row!.timezone;
    if (!instagram) return i.reply({ content: 'no instagram handle on file for her', flags: MessageFlags.Ephemeral });
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { research, stats, profile, posts } = await runResearch({ displayName: name, instagram, tiktok, timezone });
      const files: RepoFile[] = [];
      const existingProfile = (await github.read(`models/${slug}/profile.md`)) ?? '';
      files.push({ path: `models/${slug}/profile.md`, content: renderProfile({ name, instagram, tiktok, research, stats, profile }, keepStaffTail(existingProfile), ctx.env.DEFAULT_TIMEZONE) });
      const existingExamples = (await github.read(`models/${slug}/voice/caption-examples.md`)) ?? tmpl('voice/caption-examples.md');
      files.push({ path: `models/${slug}/voice/caption-examples.md`, content: withImportedSection(existingExamples, importedSection(posts)) });
      files.push({ path: `models/${slug}/sourcing/reels-sources.yaml`, content: renderSourcing(research, tiktok) });
      if (!model) {
        // researched earlier without a token — write the whole folder now
        const ids = row!.discord as unknown as Awaited<ReturnType<typeof ensureModelStructure>>;
        if (!ids?.channels?.general) throw new Error('her channels were never created — run /model add again');
        files.length = 0;
        files.push(...renderFiles({ slug, name, userId: row!.user_id, instagram, tiktok, timezone, ids, research, stats, profile, posts }, ctx.env.DEFAULT_TIMEZONE));
      }
      const sha = await github.commitFiles(files, `Refresh research for ${name} (${slug}) — /model refresh by ${i.user.tag}`);
      await sql`INSERT INTO bot.model_onboarding (slug, display_name, user_id, instagram, tiktok, timezone, status, research, commit_sha, requested_by)
                VALUES (${slug}, ${name}, ${model?.discord.user_id ?? row!.user_id}, ${instagram}, ${tiktok || null}, ${timezone}, ${model ? 'live' : 'committed'}, ${sql.json({ research, stats, profile: { ...profile, latestPosts: undefined } } as never)}, ${sha}, ${i.user.id})
                ON CONFLICT (slug) DO UPDATE SET research = EXCLUDED.research, commit_sha = EXCLUDED.commit_sha, status = ${model ? 'live' : 'committed'}, error = NULL, updated_at = now()`;
      await ctx.ops(MODULE, 'refreshed', { model, actor: i.user.id, data: { slug, sha, posts: stats.posts } });
      await i.editReply(`✅ refreshed ${name}: ${stats.posts} posts analysed → profile.md, imported captions and sourcing updated (${sha.slice(0, 7)}). Lanes now suggested: ${research.lanes.map((l) => l.slug).join(', ')}${model?.lanes.length ? ` (model.yaml keeps: ${model.lanes.join(', ')})` : ''}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log.error({ err, slug }, 'refresh failed');
      await i.editReply(`❌ refresh failed: ${msg.slice(0, 300)}`);
    }
  }

  async function setLanes(i: ChatInputCommandInteraction) {
    const slug = i.options.getString('slug', true).toLowerCase();
    const model = ctx.models.get(slug);
    if (!model) return i.reply({ content: `unknown model \`${slug}\``, flags: MessageFlags.Ephemeral });
    if (!github.enabled) return i.reply({ content: 'needs `GITHUB_TOKEN` set in Railway', flags: MessageFlags.Ephemeral });
    const valid = new Set(loadLibrary().genres.map((g) => g.slug));
    const lanes = i.options.getString('lanes', true).split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = lanes.filter((l) => !valid.has(l));
    if (bad.length) return i.reply({ content: `unknown folder(s): ${bad.join(', ')} — valid: ${[...valid].join(', ')}`, flags: MessageFlags.Ephemeral });
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const path = `models/${slug}/model.yaml`;
    const raw = await github.read(path);
    if (!raw) return i.editReply(`${path} not found in GitHub`);
    const doc = YAML.parseDocument(raw);
    doc.set('lanes', lanes);
    const sha = await github.commitFiles([{ path, content: doc.toString() }], `${model.display_name}: lanes → ${lanes.join(', ')} (/model lanes by ${i.user.tag})`);
    await ctx.ops(MODULE, 'lanes', { model, actor: i.user.id, data: { lanes } });
    return i.editReply(`✅ ${model.display_name} → lanes: ${lanes.join(', ')} (${sha.slice(0, 7)}; live after the redeploy)`);
  }

  // ── owner review in Discord (owners never open GitHub) ─────────────────────
  /** Post her profile + voice draft into #new-girl-reviews with Approve / Notes / Redo buttons. */
  async function postReview(slug: string, name: string, files: RepoFile[]) {
    const ch = ctx.ch('onboarding') || ctx.ch('bot_dev');
    if (!ch) return;
    const profile = files.find((f) => f.path.endsWith('/profile.md'))?.content ?? '';
    const voice = files.find((f) => f.path.endsWith('/voice/voice.md'))?.content ?? '';
    await ctx.send(ch, { content: `🧾 **${name} — research report** (read it, then use the buttons at the bottom)`, allowedMentions: { parse: [] } });
    for (const part of chunk(discordify(profile.split(STAFF_MARKER)[0]), 1900)) await ctx.send(ch, { content: part, allowedMentions: { parse: [] } });
    await ctx.send(ch, { content: `🗣️ **${name} — how she writes (voice draft)** — this is what the caption writer will imitate. Fix anything that's off.`, allowedMentions: { parse: [] } });
    for (const part of chunk(discordify(voice), 1900)) await ctx.send(ch, { content: part, allowedMentions: { parse: [] } });
    await ctx.send(ch, {
      content: `**${name}** — what do you think?\n✅ Approve = the voice is her, captions can use it · ✏️ Notes = tell me what's wrong or what you know about her, I'll fix the files · 🔁 Redo = research her again from scratch`,
      components: [reviewButtons(slug)],
      allowedMentions: { parse: [] },
    });
    await sql`UPDATE bot.model_onboarding SET research = research || ${sql.json({ reviewed: true } as never)} WHERE slug = ${slug}`.catch(() => undefined);
  }

  function reviewButtons(slug: string) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`models:approve:${slug}`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`models:notes:${slug}`).setLabel('Notes').setEmoji('✏️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`models:redo:${slug}`).setLabel('Redo research').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    );
  }

  /** Markdown → what Discord renders well: keep headings/bold/lists, drop html comments and the staff marker. */
  function discordify(md: string) {
    return md
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^# (.*)$/gm, '# $1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  ctx.component('models:approve', async (i, parts) => {
    if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
    await i.deferReply();
    const slug = parts[2];
    if (!github.enabled) return i.editReply('GitHub write is not set up — ask the tech team');
    const path = `models/${slug}/voice/voice.md`;
    const voice = await github.read(path);
    if (!voice) return i.editReply(`I can't find the voice file for ${slug}`);
    const stamped = voice.replace(/^> DRAFT written by the bot[^\n]*$/m, `> ✅ Approved by ${i.user.displayName} on ${today(ctx.env.DEFAULT_TIMEZONE)}. Edit with ✏️ Notes in #new-girl-reviews or /model refresh.`);
    await github.commitFiles([{ path, content: stamped }], `${slug}: voice approved by ${i.user.tag}`);
    await sql`UPDATE bot.model_onboarding SET research = research || ${sql.json({ approved_by: i.user.id, approved_at: new Date().toISOString() } as never)}, updated_at = now() WHERE slug = ${slug}`;
    await ctx.ops(MODULE, 'voice-approved', { model: ctx.models.get(slug), actor: i.user.id, data: { slug } });
    await i.message.edit({ components: [] }).catch(() => undefined);
    return i.editReply(`✅ ${ctx.models.get(slug)?.display_name ?? slug}'s voice approved by ${i.user.displayName} — captions will use it as-is.`);
  });

  ctx.component('models:notes', async (i, parts) => {
    if (!i.isButton()) return;
    if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
    const modal = new ModalBuilder()
      .setCustomId(`models:notesmodal:${parts[2]}`)
      .setTitle('What should I fix or add?')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('notes').setLabel('Your notes (plain English)').setStyle(TextInputStyle.Paragraph).setPlaceholder("e.g. she's a golf girl not funny · she never uses hashtags · she lives in Miami · add: gym content").setRequired(true).setMaxLength(2000),
        ),
      );
    await i.showModal(modal);
  });

  ctx.modal('models:notesmodal', async (i, parts) => {
    await i.deferReply();
    const slug = parts[2];
    const notes = i.fields.getTextInputValue('notes');
    if (!github.enabled) return i.editReply('GitHub write is not set up — ask the tech team');
    try {
      const [profile, voice] = await Promise.all([github.read(`models/${slug}/profile.md`), github.read(`models/${slug}/voice/voice.md`)]);
      if (!profile || !voice) return i.editReply(`I can't find the files for ${slug}`);
      const out = await ctx.api.claude.json<{ profile: string; voice: string; lanes: string[]; summary: string }>(loadPrompt('model.apply-notes', { owner: i.user.displayName, notes, profile, voice }), { maxTokens: 8000, temperature: 0.2 });
      if (!out?.profile || !out?.voice) return i.editReply('I could not apply those notes — try rephrasing');
      const files: RepoFile[] = [
        { path: `models/${slug}/profile.md`, content: out.profile },
        { path: `models/${slug}/voice/voice.md`, content: out.voice },
      ];
      const valid = new Set(loadLibrary().genres.map((g) => g.slug));
      const lanes = (out.lanes ?? []).filter((l) => valid.has(l));
      const yamlPath = `models/${slug}/model.yaml`;
      const raw = await github.read(yamlPath);
      if (raw && lanes.length) {
        const doc = YAML.parseDocument(raw);
        doc.set('lanes', lanes);
        files.push({ path: yamlPath, content: doc.toString() });
      }
      const sha = await github.commitFiles(files, `${slug}: owner notes applied (${i.user.tag})\n\n${notes.slice(0, 500)}`);
      await sql`UPDATE bot.model_onboarding SET research = research || ${sql.json({ notes: notes.slice(0, 2000), notes_by: i.user.id } as never)}, updated_at = now() WHERE slug = ${slug}`;
      await ctx.ops(MODULE, 'notes-applied', { model: ctx.models.get(slug), actor: i.user.id, data: { slug, sha } });
      await postReview(slug, ctx.models.get(slug)?.display_name ?? slug, files).catch(() => undefined);
      return i.editReply(`✏️ applied: ${out.summary}${lanes.length ? ` · lanes now: ${lanes.join(', ')}` : ''}. Updated report is below — ✅ when it's right. (Changes are live after the next restart, ~2 min.)`);
    } catch (err) {
      ctx.log.error({ err, slug }, 'apply notes failed');
      return i.editReply(`❌ couldn't apply the notes: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
    }
  });

  ctx.component('models:redo', async (i, parts) => {
    if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
    await i.deferReply();
    const slug = parts[2];
    const model = ctx.models.get(slug);
    const row = (await sql<OnboardingRow[]>`SELECT * FROM bot.model_onboarding WHERE slug = ${slug}`)[0];
    const instagram = model?.socials.instagram || row?.instagram || '';
    if (!instagram || !ctx.api.apify.enabled || !github.enabled) return i.editReply('cannot redo right now (missing handle or a connection)');
    try {
      const name = model?.display_name ?? row!.display_name;
      const { research, stats, profile, posts } = await runResearch({ displayName: name, instagram, tiktok: model?.socials.tiktok || row?.tiktok || '', timezone: model?.timezone ?? row!.timezone });
      const existingProfile = (await github.read(`models/${slug}/profile.md`)) ?? '';
      const files: RepoFile[] = [
        { path: `models/${slug}/profile.md`, content: renderProfile({ name, instagram, tiktok: model?.socials.tiktok || '', research, stats, profile }, keepStaffTail(existingProfile), ctx.env.DEFAULT_TIMEZONE) },
        { path: `models/${slug}/voice/voice.md`, content: renderVoice(name, research, stats, ctx.env.DEFAULT_TIMEZONE) },
        { path: `models/${slug}/sourcing/reels-sources.yaml`, content: renderSourcing(research, model?.socials.tiktok || '', ctx.env.DEFAULT_TIMEZONE) },
      ];
      const sha = await github.commitFiles(files, `Redo research for ${name} (${slug}) — ${i.user.tag}`);
      await sql`UPDATE bot.model_onboarding SET research = ${sql.json({ research, stats, profile: { ...profile, latestPosts: undefined } } as never)}, commit_sha = ${sha}, updated_at = now() WHERE slug = ${slug}`;
      await postReview(slug, name, files);
      await i.editReply(`🔁 re-researched ${name} from ${stats.posts} posts — new report below.`);
    } catch (err) {
      await i.editReply(`❌ redo failed: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
    }
  });

  ctx.action('show_model_profile', {
    description: "Post a creator's research report and voice draft in the current channel (with Approve / Notes / Redo buttons). Use when an owner wants to see or review what the bot knows about her.",
    input: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    ownersOnly: true,
    run: async (input) => {
      const slug = String(input.slug).toLowerCase();
      const model = ctx.models.get(slug);
      if (!model) return `unknown model ${slug}`;
      const f = model.files();
      await postReview(slug, model.display_name, [
        { path: `models/${slug}/profile.md`, content: f.profile || '(no profile yet — run a refresh)' },
        { path: `models/${slug}/voice/voice.md`, content: f.voice || '(no voice file yet)' },
      ]);
      return `posted ${model.display_name}'s report in <#${ctx.ch('onboarding') || ctx.ch('bot_dev')}>`;
    },
  });

  // ── research ───────────────────────────────────────────────────────────────
  async function runResearch(o: { displayName: string; instagram: string; tiktok: string; timezone: string }) {
    const profile = await ctx.api.apify.instagramProfile(o.instagram);
    if (!profile) throw new Error(`could not load instagram.com/${o.instagram} — private, misspelled, or Apify hiccup`);
    if (profile.isPrivate) throw new Error(`@${o.instagram} is private — research needs a public account`);
    const own = await ctx.api.apify.instagramOwnPosts(o.instagram, { reels: 40, posts: 25 }).catch((err) => {
      ctx.log.warn({ err }, 'own posts fetch failed; using latestPosts only');
      return [] as ReelCandidate[];
    });
    const seen = new Set<string>();
    const posts = [...profile.latestPosts, ...own]
      .filter((p) => {
        if (!p.url || seen.has(p.url)) return false;
        seen.add(p.url);
        return true;
      })
      .sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
    let tiktokPosts: ReelCandidate[] = [];
    if (o.tiktok) tiktokPosts = await ctx.api.apify.tiktok({ seed_accounts: [o.tiktok], results_per_query: 30 }).catch(() => []);

    const stats = computeStats(posts, o.timezone);
    const genres = loadLibrary()
      .genres.filter((g) => g.active)
      .map((g) => `- ${g.slug} — ${g.name}: ${g.description}`)
      .join('\n');
    const lines = posts.slice(0, 70).map((p) => {
      const d = p.postedAt ? p.postedAt.slice(0, 10) : '????-??-??';
      return `${p.pinned ? '★ ' : ''}${d} · ${p.kind ?? 'post'} · ❤️ ${p.likes} · 💬 ${p.comments ?? 0}${p.views ? ` · ▶️ ${p.views}` : ''}${p.audio ? ` · audio: ${p.audio}` : ''} · "${(p.caption || '(no caption)').replace(/\s+/g, ' ').slice(0, 220)}"`;
    });
    const ttBlock = tiktokPosts.length
      ? `TIKTOK POSTS (@${o.tiktok}, newest first):\n${tiktokPosts
          .slice(0, 30)
          .map((p) => `${p.postedAt?.slice(0, 10) ?? ''} · ▶️ ${p.views} · ❤️ ${p.likes} · 💬 ${p.comments ?? 0} · "${(p.caption || '').replace(/\s+/g, ' ').slice(0, 160)}"`)
          .join('\n')}`
      : '';
    const prompt = loadPrompt('model.research', {
      industry: industryLens(4500),
      display_name: o.displayName,
      instagram: o.instagram,
      followers: profile.followers.toLocaleString(),
      posts_count: String(profile.postsCount),
      bio: profile.biography.replace(/\s+/g, ' ').slice(0, 300),
      stats: JSON.stringify({ ...stats, caption: undefined, caption_median_words: stats.caption.medianWords, emoji_rate: stats.caption.emojiRate, hashtag_rate: stats.caption.hashtagRate, lowercase_rate: stats.caption.lowercaseRate }),
      genres,
      tiktok_note: o.tiktok ? ' and TikTok' : '',
      tiktok_block: ttBlock,
      posts: lines.join('\n') || '(no posts found)',
    });
    const research = await ctx.api.claude.json<Research>(prompt, { maxTokens: 3500, temperature: 0.3 });
    if (!research || !Array.isArray(research.lanes)) throw new Error('research came back malformed — try again');
    const valid = new Set(loadLibrary().genres.map((g) => g.slug));
    research.lanes = research.lanes.filter((l) => valid.has(l.slug)).slice(0, 4);
    return { research, stats, profile, posts: [...posts, ...tiktokPosts] };
  }

  // ── files ──────────────────────────────────────────────────────────────────
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function clean(handle: string) {
  return handle
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/, '')
    .replace(/[/?].*$/, '')
    .toLowerCase();
}

function chunk(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > max) {
      if (cur) parts.push(cur);
      cur = line.length > max ? line.slice(0, max) : line;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) parts.push(cur);
  return parts;
}
