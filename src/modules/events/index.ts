import { DateTime } from 'luxon';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { loadEvents, nextOccurrence, type EventDef } from '../../config/events.js';
import { loadLibrary } from '../../config/library.js';
import { loadPrompt } from '../../lib/prompts.js';
import { industryLens } from '../../lib/industry.js';

/**
 * Events → ideas (Dan: "on Memorial Day they need video ideas for that specific thing, five or six at a time").
 *
 *   07:30 DEFAULT_TIMEZONE  for every event inside its lead window (knowledge/events.yaml + bot.events): every model in
 *                           the event's lanes (or all) who hasn't received ideas for this occurrence gets N ideas in her
 *                           #general — hook, what to film, text on screen, a caption in her voice — generated from her
 *                           profile.md + voice.md (prompts/event.ideas.md). Owners get a one-line digest in #daily-report.
 *   /event list             what's coming (next 45 days) and who got ideas
 *   /event add              one-off moment (a trend, a local thing, a brand week): name, date, angle, lanes, lead days
 *   /event ideas            send ideas for an event now (one model or all)
 */
const MODULE = 'events';
const CRON = '30 7 * * *';

interface Idea {
  title: string;
  hook: string;
  film: string;
  text_on_screen?: string;
  caption?: string;
  why_men_comment?: string;
}

interface Occurrence {
  key: string;
  name: string;
  date: DateTime;
  days: number;
  leadDays: number;
  ideas: number;
  lanes: string[];
  angle: string;
  source: 'yaml' | 'db';
}

export function register(ctx: BotContext) {
  const sql = ctx.db;

  ctx.cron('events:ideas', CRON, ctx.env.DEFAULT_TIMEZONE, async () => {
    const r = await sendDue();
    if (r.sent) await ctx.ops(MODULE, 'ideas-sent', { data: r, text: r.lines.join(' · ') });
    if (r.lines.length) await ctx.send(ctx.ch('daily_report') || ctx.ch('bot_dev'), { content: `🗓️ **event ideas sent:** ${r.lines.join(' · ')}`, allowedMentions: { parse: [] } });
  });

  ctx.command(
    new SlashCommandBuilder()
      .setName('event')
      .setDescription('Holidays & moments → video ideas per creator (owners)')
      .addSubcommand((s) => s.setName('list').setDescription('Upcoming events (45 days) and who has ideas already'))
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription('Add a one-off moment (a trend, a local thing, a brand week)')
          .addStringOption((o) => o.setName('name').setDescription('e.g. Miami Swim Week').setRequired(true))
          .addStringOption((o) => o.setName('date').setDescription('YYYY-MM-DD').setRequired(true))
          .addStringOption((o) => o.setName('angle').setDescription('What it means for our content, one line').setRequired(true))
          .addStringOption((o) => o.setName('lanes').setDescription('Only girls in these folders, e.g. beach, pool (default: everyone)'))
          .addIntegerOption((o) => o.setName('lead_days').setDescription('Send ideas this many days before (default 7)').setMinValue(0).setMaxValue(60)),
      )
      .addSubcommand((s) =>
        s
          .setName('remove')
          .setDescription('Remove a one-off moment you added')
          .addStringOption((o) => o.setName('name').setDescription('Exact name').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('ideas')
          .setDescription('Send ideas for an event now')
          .addStringOption((o) => o.setName('name').setDescription('Event name (as in /event list)').setRequired(true))
          .addStringOption((o) => o.setName('model').setDescription('One creator (slug) — default: everyone in its lanes'))
          .addBooleanOption((o) => o.setName('again').setDescription('Even if she already got ideas for it')),
      ),
    async (i) => {
      if (!ctx.isOwner(i.user.id)) return i.reply({ content: 'owners only', flags: MessageFlags.Ephemeral });
      const sub = i.options.getSubcommand();

      if (sub === 'list') {
        const occ = (await upcoming(45)).sort((a, b) => a.days - b.days);
        if (!occ.length) return i.reply({ content: 'nothing in the next 45 days', flags: MessageFlags.Ephemeral });
        const sent = await sql<{ event_key: string; n: number }[]>`SELECT event_key, COUNT(*)::int AS n FROM bot.event_ideas WHERE event_key = ANY(${occ.map((o) => o.key)}) GROUP BY event_key`;
        const lines = occ.map((o) => {
          const n = sent.find((s) => s.event_key === o.key)?.n ?? 0;
          return `• **${o.name}** — ${o.date.toFormat('ccc LLL d')} (${o.days}d)${o.lanes.length ? ` · ${o.lanes.join(', ')}` : ''} · ideas go out ${o.days <= o.leadDays ? 'now' : `in ${o.days - o.leadDays}d`}${n ? ` · sent to ${n}` : ''}${o.source === 'db' ? ' · _custom_' : ''}`;
        });
        return i.reply({ content: lines.join('\n').slice(0, 1900), flags: MessageFlags.Ephemeral });
      }

      if (sub === 'add') {
        const name = i.options.getString('name', true).trim();
        const date = DateTime.fromISO(i.options.getString('date', true), { zone: ctx.env.DEFAULT_TIMEZONE });
        if (!date.isValid) return i.reply({ content: 'date must be YYYY-MM-DD', flags: MessageFlags.Ephemeral });
        const lanes = (i.options.getString('lanes') ?? '').split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        const valid = new Set(loadLibrary().genres.map((g) => g.slug));
        const bad = lanes.filter((l) => !valid.has(l));
        if (bad.length) return i.reply({ content: `unknown folder(s): ${bad.join(', ')}`, flags: MessageFlags.Ephemeral });
        await sql`INSERT INTO bot.events (name, on_date, lead_days, ideas, lanes, angle, added_by) VALUES (${name}, ${date.toISODate()}, ${i.options.getInteger('lead_days') ?? 7}, 5, ${lanes}, ${i.options.getString('angle', true)}, ${i.user.id})`;
        await ctx.ops(MODULE, 'event-added', { actor: i.user.id, data: { name, date: date.toISODate(), lanes } });
        return i.reply({ content: `added **${name}** on ${date.toFormat('ccc LLL d')} — ideas go out ${i.options.getInteger('lead_days') ?? 7} days before${lanes.length ? ` to girls in ${lanes.join(', ')}` : ' to everyone'}. \`/event ideas name:${name}\` sends them now.`, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'remove') {
        const name = i.options.getString('name', true).trim();
        const rows = await sql`DELETE FROM bot.events WHERE lower(name) = ${name.toLowerCase()} RETURNING id`;
        return i.reply({ content: rows.length ? `removed ${name}` : `no custom event called "${name}" (yaml events are edited in knowledge/events.yaml)`, flags: MessageFlags.Ephemeral });
      }

      if (sub === 'ideas') {
        const name = i.options.getString('name', true).trim().toLowerCase();
        const occ = (await upcoming(400)).find((o) => o.name.toLowerCase() === name);
        if (!occ) return i.reply({ content: `no upcoming event called "${name}" — see /event list`, flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const only = i.options.getString('model') ?? undefined;
        const r = await sendFor(occ, { only, force: Boolean(i.options.getBoolean('again')) });
        return i.editReply(`${occ.name}: ideas sent to ${r.sent} creator(s)${r.skipped ? `, ${r.skipped} skipped (already had them / not in lanes)` : ''}`);
      }
    },
  );

  // ── chat-callable actions (operator) ────────────────────────────────────────
  ctx.action('list_events', {
    description: 'Upcoming holidays / moments in the next 45 days and when idea drops go out.',
    input: { type: 'object', properties: {} },
    run: async () => (await upcoming(45)).sort((a, b) => a.days - b.days).map((o) => `${o.name} — ${o.date.toISODate()} (${o.days}d)${o.lanes.length ? ` [${o.lanes.join(', ')}]` : ''}, ideas ${o.days <= o.leadDays ? 'due now' : `in ${o.days - o.leadDays}d`}`).join('\n') || 'nothing in 45 days',
  });
  ctx.action('add_event', {
    description: 'Add a one-off moment (a trend, a local event, a brand week) so creators get tailored video ideas before it.',
    input: { type: 'object', properties: { name: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, angle: { type: 'string', description: 'what it means for our content, one line' }, lanes: { type: 'array', items: { type: 'string' }, description: 'genre slugs; omit for everyone' }, lead_days: { type: 'integer' } }, required: ['name', 'date', 'angle'] },
    ownersOnly: true,
    run: async (input, actor) => {
      const date = DateTime.fromISO(String(input.date), { zone: ctx.env.DEFAULT_TIMEZONE });
      if (!date.isValid) return 'date must be YYYY-MM-DD';
      const lanes = (Array.isArray(input.lanes) ? input.lanes : []).map(String).map((l) => l.toLowerCase());
      const valid = new Set(loadLibrary().genres.map((g) => g.slug));
      const bad = lanes.filter((l) => !valid.has(l));
      if (bad.length) return `unknown folder(s): ${bad.join(', ')}`;
      const lead = Number(input.lead_days ?? 7);
      await sql`INSERT INTO bot.events (name, on_date, lead_days, ideas, lanes, angle, added_by) VALUES (${String(input.name)}, ${date.toISODate()}, ${lead}, 5, ${lanes}, ${String(input.angle)}, ${actor.userId})`;
      await ctx.ops(MODULE, 'event-added', { actor: actor.userId, data: { name: input.name, date: date.toISODate(), lanes } });
      return `added ${String(input.name)} on ${date.toISODate()}; ideas go out ${lead} days before${lanes.length ? ` to ${lanes.join(', ')}` : ' to everyone'}`;
    },
  });
  ctx.action('send_event_ideas', {
    description: 'Generate and send video ideas for an upcoming event now (all eligible creators, or one).',
    input: { type: 'object', properties: { name: { type: 'string', description: 'event name as in list_events' }, model: { type: 'string', description: 'model slug (optional)' }, again: { type: 'boolean', description: 'resend even if she already got ideas' } }, required: ['name'] },
    ownersOnly: true,
    slow: true,
    run: async (input) => {
      const occ = (await upcoming(400)).find((o) => o.name.toLowerCase() === String(input.name).toLowerCase());
      if (!occ) return `no upcoming event called ${String(input.name)}`;
      const r = await sendFor(occ, { only: input.model ? String(input.model) : undefined, force: Boolean(input.again) });
      return `${occ.name}: ideas sent to ${r.sent} creator(s), ${r.skipped} skipped`;
    },
  });

  // ── core ───────────────────────────────────────────────────────────────────
  async function upcoming(withinDays: number): Promise<Occurrence[]> {
    const now = DateTime.now().setZone(ctx.env.DEFAULT_TIMEZONE);
    const cfg = loadEvents();
    const out: Occurrence[] = [];
    for (const e of cfg.events) {
      const d = nextOccurrence(e, now);
      if (!d) continue;
      const days = Math.round(d.diff(now.startOf('day'), 'days').days);
      if (days > withinDays) continue;
      out.push(occurrence(e, d, days, cfg.defaults, 'yaml'));
    }
    const custom = await sql<{ name: string; on_date: string; lead_days: number; ideas: number; lanes: string[]; angle: string }[]>`SELECT name, on_date::text AS on_date, lead_days, ideas, lanes, angle FROM bot.events WHERE on_date >= ${now.toISODate()}`;
    for (const c of custom) {
      const d = DateTime.fromISO(c.on_date, { zone: ctx.env.DEFAULT_TIMEZONE }).startOf('day');
      const days = Math.round(d.diff(now.startOf('day'), 'days').days);
      if (days > withinDays) continue;
      out.push({ key: `${c.name}@${d.toISODate()}`, name: c.name, date: d, days, leadDays: c.lead_days, ideas: c.ideas, lanes: c.lanes, angle: c.angle, source: 'db' });
    }
    return out;
  }

  function occurrence(e: EventDef, d: DateTime, days: number, defaults: { lead_days: number; ideas: number }, source: 'yaml' | 'db'): Occurrence {
    return { key: `${e.name}@${d.toISODate()}`, name: e.name, date: d, days, leadDays: e.lead_days ?? defaults.lead_days, ideas: e.ideas ?? defaults.ideas, lanes: e.lanes, angle: e.angle, source };
  }

  async function sendDue() {
    const r = { sent: 0, lines: [] as string[] };
    for (const occ of await upcoming(60)) {
      if (occ.days > occ.leadDays) continue;
      const res = await sendFor(occ, {});
      if (res.sent) {
        r.sent += res.sent;
        r.lines.push(`${occ.name} (${occ.days}d) → ${res.sent}`);
      }
    }
    return r;
  }

  async function sendFor(occ: Occurrence, opts: { only?: string; force?: boolean }) {
    const r = { sent: 0, skipped: 0 };
    for (const model of ctx.models.all()) {
      if (opts.only && model.slug !== opts.only) continue;
      if (occ.lanes.length && !model.lanes.some((l) => occ.lanes.includes(l))) {
        r.skipped++;
        continue;
      }
      if (!opts.force) {
        const had = await sql`SELECT 1 FROM bot.event_ideas WHERE event_key = ${occ.key} AND model_slug = ${model.slug}`;
        if (had.length) {
          r.skipped++;
          continue;
        }
      }
      try {
        const ideas = await generate(model, occ);
        if (!ideas.length) {
          r.skipped++;
          continue;
        }
        const emoji = occ.days === 0 ? '🎉' : '🗓️';
        const body = ideas.map((x, k) => [`**${k + 1}. ${x.title}**`, `hook: ${x.hook}`, `film: ${x.film}`, x.text_on_screen ? `text: "${x.text_on_screen}"` : '', x.caption ? `caption: _${x.caption}_` : ''].filter(Boolean).join('\n'));
        const head = `${emoji} **${occ.name} is ${occ.days === 0 ? 'today' : occ.days === 1 ? 'tomorrow' : `in ${occ.days} days`} (${occ.date.toFormat('ccc LLL d')})** — ${ideas.length} ideas for you. Pick one, film it this week, and it lands while everyone is searching for it.`;
        const sent = await ctx.send(model.discord.channels.general, { content: [head, ...body].join('\n\n').slice(0, 1990), allowedMentions: { parse: [] } });
        if (!sent) continue;
        await sql`INSERT INTO bot.event_ideas (event_key, model_slug, ideas) VALUES (${occ.key}, ${model.slug}, ${sql.json(ideas as never)}) ON CONFLICT (event_key, model_slug) DO UPDATE SET ideas = EXCLUDED.ideas, sent_at = now()`;
        r.sent++;
      } catch (err) {
        ctx.log.warn({ err, model: model.slug, event: occ.name }, 'event ideas failed');
        r.skipped++;
      }
    }
    return r;
  }

  async function generate(model: Model, occ: Occurrence): Promise<Idea[]> {
    const files = model.files();
    const out = await ctx.api.claude.json<Idea[]>(
      loadPrompt('event.ideas', {
        industry: industryLens(3500),
        event_name: occ.name,
        days_until: String(occ.days),
        event_date: occ.date.toFormat('cccc, LLLL d'),
        angle: occ.angle || '(no angle given — use the obvious one)',
        model_name: model.display_name,
        lanes: model.lanes.join(', ') || '(unknown — infer from the profile)',
        profile: (files.profile || '(no profile yet)').slice(0, 5000),
        voice: (files.voice || '(no voice file yet)').slice(0, 2500),
        n: String(occ.ideas),
      }),
      { maxTokens: 1800, temperature: 0.8 },
    );
    return (Array.isArray(out) ? out : []).filter((x) => x?.title && x?.hook && x?.film).slice(0, occ.ideas);
  }
}
