import { EventEmitter } from 'node:events';
import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Message,
  type MessageCreateOptions,
  type ModalSubmitInteraction,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
  type StringSelectMenuInteraction,
  type TextBasedChannel,
} from 'discord.js';
import { CronJob } from 'cron';
import type { Env } from '../config/env.js';
import type { Model, ModelRegistry } from '../config/models.js';
import type { DB } from '../db/client.js';
import { logEvent } from '../db/client.js';
import type { Claude } from '../integrations/anthropic.js';
import type { Notion } from '../integrations/notion.js';
import type { Drive } from '../integrations/drive.js';
import type { Apify } from '../integrations/apify.js';
import type { Zernio } from '../integrations/zernio.js';
import type { Logger } from '../lib/logger.js';
import type { Timers } from '../lib/timers.js';
import type { Settings } from '../lib/settings.js';

export type CommandBuilder = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
export type CommandHandler = (i: ChatInputCommandInteraction, model: Model | undefined) => Promise<unknown>;
export type ComponentHandler = (i: ButtonInteraction | StringSelectMenuInteraction, parts: string[], model: Model | undefined) => Promise<unknown>;
export type ModalHandler = (i: ModalSubmitInteraction, parts: string[], model: Model | undefined) => Promise<unknown>;

export interface Integrations {
  claude: Claude;
  notion: Notion;
  drive: Drive;
  apify: Apify;
  zernio: Zernio;
}

/**
 * Everything a module needs. Modules never import each other; they talk through `bus` events.
 * Custom ids: `module:action:modelSlug:entityId` — the router splits on ':' and dispatches on `module:action`.
 */
/**
 * An action = one thing the bot can do, exposed to BOTH slash commands and the operator chat ("@Lava Bot onboard Jane…").
 * `input` is a JSON schema (Claude tool input); `run` returns a short human-readable result.
 */
export interface Action {
  description: string;
  input: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  ownersOnly?: boolean;
  slow?: boolean; // takes > 10 s (onboarding, scouting) — the operator says "on it" first
  run: (input: Record<string, unknown>, actor: { userId: string; channelId?: string; progress: (text: string) => Promise<void> }) => Promise<string>;
}

export class BotContext {
  readonly bus = new EventEmitter();
  readonly actions = new Map<string, Action>();
  readonly commands = new Map<string, { builder: CommandBuilder; handler: CommandHandler }>();
  readonly components = new Map<string, ComponentHandler>();
  readonly modals = new Map<string, ModalHandler>();
  readonly crons: CronJob[] = [];

  constructor(
    readonly client: Client,
    readonly env: Env,
    readonly models: ModelRegistry,
    readonly db: DB,
    readonly timers: Timers,
    readonly log: Logger,
    readonly api: Integrations,
    readonly settings: Settings,
  ) {}

  /** Staff/agency channel id: bot-created (settings) first, .env override second. */
  ch(name: 'live_alerts' | 'content_requests_inbox' | 'reels_inbox' | 'questions' | 'daily_report' | 'ops_log' | 'bot_dev' | 'agency_lounge' | 'announcements'): string {
    const envKey: Record<string, string> = {
      live_alerts: this.env.STAFF_LIVE_ALERTS_CHANNEL_ID,
      content_requests_inbox: this.env.STAFF_REQUESTS_INBOX_CHANNEL_ID,
      reels_inbox: this.env.STAFF_REELS_INBOX_CHANNEL_ID,
      ops_log: this.env.STAFF_OPS_LOG_CHANNEL_ID,
      daily_report: '',
      questions: '',
      bot_dev: '',
      agency_lounge: this.env.AGENCY_LOUNGE_CHANNEL_ID,
      announcements: '',
    };
    return envKey[name] || this.settings.getString(`channels.${name}`);
  }

  /** Owners = guild owner + /owners list + .env OWNER_IDS + admins. */
  ownerIds(): string[] {
    return [...new Set([this.settings.getString('guild.owner_id'), ...this.settings.getList('owners'), ...this.env.OWNER_IDS, ...this.env.BOT_ADMIN_IDS].filter(Boolean))];
  }

  command(builder: CommandBuilder, handler: CommandHandler) {
    this.commands.set(builder.name, { builder, handler });
  }

  /** Register a chat-callable action (see Action). Names are snake_case. */
  action(name: string, a: Action) {
    this.actions.set(name, a);
  }

  /** `prefix` = "module:action" */
  component(prefix: string, handler: ComponentHandler) {
    this.components.set(prefix, handler);
  }

  modal(prefix: string, handler: ModalHandler) {
    this.modals.set(prefix, handler);
  }

  /** Cron per model, in the model's timezone. */
  cron(name: string, spec: string, tz: string, fn: () => Promise<void>) {
    const job = CronJob.from({
      cronTime: spec,
      timeZone: tz,
      start: true,
      onTick: () => {
        fn().catch((err) => this.log.error({ err, cron: name }, 'cron failed'));
      },
    });
    this.crons.push(job);
    this.log.info({ cron: name, spec, tz }, 'cron registered');
  }

  isAdmin(userId: string) {
    return this.env.BOT_ADMIN_IDS.includes(userId) || userId === this.settings.getString('guild.owner_id');
  }

  isOwner(userId: string) {
    return this.ownerIds().includes(userId);
  }

  /** Staff for a model = owners + that model's managers. */
  isStaffFor(userId: string, model: Model) {
    return this.isOwner(userId) || model.discord.manager_ids.includes(userId);
  }

  async channel(id: string): Promise<TextBasedChannel | undefined> {
    if (!id) return undefined;
    const ch = await this.client.channels.fetch(id).catch(() => null);
    return ch && ch.isTextBased() ? ch : undefined;
  }

  async send(channelId: string, payload: string | MessageCreateOptions): Promise<Message | undefined> {
    const ch = await this.channel(channelId);
    if (!ch || !('send' in ch)) return undefined;
    return ch.send(payload);
  }

  /** Mirror an important action to #ops-log and the event_log table. */
  async ops(module: string, event: string, opts: { model?: Model; actor?: string; data?: unknown; text?: string } = {}) {
    await logEvent(this.db, { module, model: opts.model?.slug, actor: opts.actor, event, data: opts.data }).catch((err) => this.log.warn({ err }, 'event_log write failed'));
    const line = `\`${module}\` **${event}**${opts.model ? ` · ${opts.model.display_name}` : ''}${opts.text ? ` — ${opts.text}` : ''}`;
    await this.send(this.ch('ops_log'), { content: line.slice(0, 1900) });
  }

  ownerMentions() {
    return this.ownerIds().map((id) => `<@${id}>`).join(' ');
  }
}
