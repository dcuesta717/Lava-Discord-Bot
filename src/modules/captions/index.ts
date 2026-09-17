import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { BotContext } from '../../discord/context.js';
import type { Model } from '../../config/models.js';
import { generateCaption, type CaptionRun } from './generate.js';
import { learnCaption } from './learn.js';
import { lintCaption } from './lint.js';

/**
 * /caption brief:<what's in the post> [platform] → approval card:
 *   [✅ use it] [✏️ edit] [🔁 regen] [❌]
 * ✅ / ✏️ → caption row → status approved|edited, learnCaption(), bus.emit('caption:approved') so posting can attach it.
 */
const MODULE = 'captions';

interface CaptionRow {
  id: number;
  model_slug: string;
  brief: string;
  platform: string;
  candidates: string[];
  chosen: string | null;
  status: string;
}

export function register(ctx: BotContext) {
  const sql = ctx.db;
  const byId = async (id: number) => (await sql<CaptionRow[]>`SELECT * FROM bot.captions WHERE id = ${id}`)[0];
  const insert = async (model: Model, brief: string, platform: string, run: CaptionRun) => {
    const [{ id }] = await sql<{ id: number }[]>`
      INSERT INTO bot.captions (model_slug, brief, platform, candidates, chosen, critic_json)
      VALUES (${model.slug}, ${brief}, ${platform}, ${sql.json(run.candidates)}, ${run.chosen}, ${sql.json(run.critic as never)}) RETURNING id`;
    return Number(id);
  };
  const finalize = (id: number, status: string, text: string | null, by: string) =>
    sql`UPDATE bot.captions SET status = ${status}, final_text = ${text}, approved_by = ${by}, updated_at = now() WHERE id = ${id}`;

  ctx.command(
    new SlashCommandBuilder()
      .setName('caption')
      .setDescription('Write a caption in this creator’s voice')
      .addStringOption((o) => o.setName('brief').setDescription("What's in the post (2–15 words)").setRequired(true))
      .addStringOption((o) =>
        o.setName('platform').setDescription('Platform').addChoices({ name: 'Instagram', value: 'instagram' }, { name: 'TikTok', value: 'tiktok' }, { name: 'X', value: 'twitter' }),
      )
      .addStringOption((o) => o.setName('model').setDescription('Model slug (staff only, when running outside her channel)')),
    async (i, channelModel) => {
      const slug = i.options.getString('model');
      const model = slug ? ctx.models.get(slug) : channelModel;
      if (!model) return i.reply({ content: 'run this in a model channel or pass `model:`', flags: MessageFlags.Ephemeral });
      if (slug && !ctx.isStaffFor(i.user.id, model)) return i.reply({ content: 'staff only', flags: MessageFlags.Ephemeral });

      const brief = i.options.getString('brief', true);
      const platform = i.options.getString('platform') ?? 'instagram';
      await i.deferReply();

      const run = await generateCaption(ctx.api.claude, model, brief, platform);
      const id = await insert(model, brief, platform, run);
      const msg = await i.editReply(card(model, id, brief, platform, run));
      await sql`UPDATE bot.captions SET discord_message_id = ${msg.id} WHERE id = ${id}`;
      await ctx.ops(MODULE, 'generated', { model, actor: i.user.id, data: { id, brief, chosen: run.chosen, attempts: run.attempts } });
    },
  );

  ctx.component('captions:use', async (i, parts, model) => {
    const row = await byId(Number(parts[3]));
    if (!model || !row || !row.chosen) return i.reply({ content: 'nothing to approve here', flags: MessageFlags.Ephemeral });
    await finalize(row.id, 'approved', row.chosen, i.user.id);
    learnCaption(model, row.chosen, 'approved');
    ctx.bus.emit('caption:approved', { model, captionId: row.id, text: row.chosen, platform: row.platform });
    await i.update({ content: `✅ approved by <@${i.user.id}>\n\n> ${row.chosen}`, embeds: [], components: [] });
    await ctx.ops(MODULE, 'approved', { model, actor: i.user.id, data: { id: row.id } });
  });

  ctx.component('captions:edit', async (i, parts, model) => {
    const row = await byId(Number(parts[3]));
    if (!model || !row) return;
    const modal = new ModalBuilder().setCustomId(`captions:edit:${model.slug}:${row.id}`).setTitle('Edit caption');
    const input = new TextInputBuilder()
      .setCustomId('caption')
      .setLabel('Caption')
      .setStyle(TextInputStyle.Paragraph)
      .setValue((row.chosen ?? row.candidates[0] ?? '').slice(0, 4000))
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await i.showModal(modal);
  });

  ctx.modal('captions:edit', async (i, parts, model) => {
    const row = await byId(Number(parts[3]));
    if (!model || !row) return;
    const text = i.fields.getTextInputValue('caption').trim();
    const lint = lintCaption(text, model);
    await finalize(row.id, 'edited', text, i.user.id);
    learnCaption(model, text, 'edited');
    ctx.bus.emit('caption:approved', { model, captionId: row.id, text, platform: row.platform });
    await i.reply({
      content: `✏️ edited + approved by <@${i.user.id}>\n\n> ${text}${lint.ok ? '' : `\n\n⚠️ lint notes (posted anyway because a human wrote it): ${lint.violations.join(', ')}`}`,
    });
    await ctx.ops(MODULE, 'edited', { model, actor: i.user.id, data: { id: row.id } });
  });

  ctx.component('captions:regen', async (i, parts, model) => {
    const row = await byId(Number(parts[3]));
    if (!model || !row) return;
    await i.deferUpdate();
    const run = await generateCaption(ctx.api.claude, model, row.brief, row.platform);
    const id = await insert(model, row.brief, row.platform, run);
    await finalize(row.id, 'rejected', null, i.user.id);
    await i.editReply(card(model, id, row.brief, row.platform, run));
  });

  ctx.component('captions:reject', async (i, parts) => {
    const row = await byId(Number(parts[3]));
    if (!row) return;
    await finalize(row.id, 'rejected', null, i.user.id);
    await i.update({ content: `❌ rejected by <@${i.user.id}>`, embeds: [], components: [] });
  });
}

function card(model: Model, id: number, brief: string, platform: string, run: CaptionRun) {
  const critic = run.critic;
  const lines = run.candidates.map((c, idx) => {
    const s = critic?.scores?.[idx];
    const lint = run.lint.find((l) => l.text === c);
    const flags = lint && lint.violations.length ? ` ⚠️ ${lint.violations.length}` : '';
    return `**${idx + 1}.** ${c}${s ? `  ·  voice ${s.voice}/10 · slop ${s.slop}/10${flags}` : ''}`;
  });
  const embed = new EmbedBuilder()
    .setTitle(`caption · ${model.display_name} · ${platform}`)
    .setDescription(`**brief:** ${brief}\n\n${lines.join('\n')}${critic?.reason ? `\n\n_critic: ${critic.reason}_` : ''}`)
    .setFooter({ text: `#${id} · attempts ${run.attempts}` });
  const content = run.chosen ? `**pick:**\n> ${run.chosen}` : '⚠️ nothing passed the voice/lint bar — edit one or regen';
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`captions:use:${model.slug}:${id}`).setLabel('use it').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(!run.chosen),
    new ButtonBuilder().setCustomId(`captions:edit:${model.slug}:${id}`).setLabel('edit').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`captions:regen:${model.slug}:${id}`).setLabel('regen').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`captions:reject:${model.slug}:${id}`).setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
  return { content, embeds: [embed], components: [row] };
}
