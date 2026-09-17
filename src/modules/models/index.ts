import YAML from 'yaml';
import { ChannelType, Events, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import { loadLibrary } from '../../config/library.js';
import type { InstagramProfile, ReelCandidate } from '../../integrations/apify.js';
import { GitHub, type RepoFile } from '../../integrations/github.js';
import { importedSection, withImportedSection } from '../../lib/caption-examples.js';
import { ensureModelStructure } from '../../lib/model-structure.js';
import { loadPrompt } from '../../lib/prompts.js';
import { computeStats, renderFiles, renderProfile, renderSourcing, keepStaffTail, tmpl, today, type Research, type Stats } from './render.js';

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
        await ctx.send(ctx.ch('bot_dev'), { content: `✅ **${model.display_name}** is live (models/${model.slug}). Review her \`profile.md\` + \`voice/voice.md\` in GitHub — the voice file is a draft until Dan/Marissa sign off.`, allowedMentions: { parse: [] } });
        await sql`UPDATE bot.model_onboarding SET status = 'live', updated_at = now() WHERE slug = ${r.slug}`;
        await ctx.ops(MODULE, 'live', { model });
      }
    } catch (err) {
      ctx.log.warn({ err }, 'model welcome pass failed');
    }
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
      return [
        `✅ **${name}** onboarded → \`models/${slug}/\` committed (${sha.slice(0, 7)}). She goes live when Railway finishes redeploying (~2 min) — I'll post a welcome in <#${ids.channels.general}>.`,
        `**Research:** ${stats.posts} posts analysed · ${stats.posts_per_week.toFixed(1)} posts/week · ${research.one_liner}`,
        `**Lanes:** ${lanes || '_none found — set with /model lanes_'}`,
        `**What wins:** ${research.formats_that_win.slice(0, 3).map((f) => f.format).join(' · ')}`,
        `**Review in GitHub:** \`profile.md\` (the research), \`voice/voice.md\` (DRAFT — 10 min with her to confirm), \`notes.md\` (questions to ask her: ${(research.gaps ?? []).length}).`,
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
