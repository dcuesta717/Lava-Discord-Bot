import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';

export const MODELS_DIR = join(process.cwd(), 'models');

const channels = z.object({
  general: z.string(),
  reels_board: z.string(), // forum channel id
  custom: z.string().default(''),
  notification: z.string(),
  resources: z.string(),
  invoices: z.string().default(''),
});

export const modelSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  display_name: z.string(),
  code: z.string().regex(/^[A-Z]{3}$/), // e.g. AMA — used in file names / invoice numbers
  timezone: z.string().default('America/New_York'),
  active: z.boolean().default(true),

  discord: z.object({
    guild_id: z.string().optional(), // omit → shared Lava guild from .env
    category_id: z.string(),
    role_id: z.string(),
    user_id: z.string(), // the model's Discord user id
    manager_ids: z.array(z.string()).default([]),
    channels,
  }),

  socials: z
    .object({
      instagram: z.string().default(''),
      tiktok: z.string().default(''),
      x: z.string().default(''),
      onlyfans: z.string().default(''),
    })
    .default({}),

  drive: z
    .object({
      root_folder_id: z.string().default(''),
      raw_folder_id: z.string().default(''),
      ready_to_post_folder_id: z.string().default(''),
    })
    .default({}),

  zernio: z
    .object({
      accounts: z
        .array(z.object({ platform: z.enum(['instagram', 'tiktok', 'twitter', 'threads', 'youtube']), accountId: z.string() }))
        .default([]),
      best_times: z.array(z.string()).default(['11:00', '19:00']), // local HH:mm slots
    })
    .default({}),

  live: z
    .object({
      check_in_after_min: z.number().default(40),
      repeat_every_min: z.number().default(30),
      auto_end_after_min: z.number().default(120),
    })
    .default({}),

  insights: z
    .object({
      cron: z.string().default('0 9 * * 1'), // Monday 09:00 model-local
      reminder_cron: z.string().default('0 12 * * 2'), // Tuesday noon if nothing received
    })
    .default({}),

  earnings: z
    .object({
      best_month_usd: z.number().default(0),
      goal_month_usd: z.number().default(0),
    })
    .default({}),

  caption: z
    .object({
      max_hashtags: z.number().default(3),
      max_emoji: z.number().default(3),
      max_chars: z.number().default(150),
      lowercase: z.boolean().default(true),
    })
    .default({}),
});

export type ModelConfig = z.infer<typeof modelSchema>;

export interface ModelFiles {
  voice: string; // voice/voice.md
  examples: string; // voice/caption-examples.md
  banned: string[]; // voice/banned-phrases.md (one per line, # comments allowed)
  hooks: string; // voice/hooks.md
  notes: string; // notes.md (private context for the persona)
  sourcing: unknown; // sourcing/reels-sources.yaml
}

export interface Model extends ModelConfig {
  dir: string;
  files: () => ModelFiles;
}

function readIf(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

export function loadModels(): Model[] {
  if (!existsSync(MODELS_DIR)) return [];
  const models: Model[] = [];
  for (const entry of readdirSync(MODELS_DIR)) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const dir = join(MODELS_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    const yamlPath = join(dir, 'model.yaml');
    if (!existsSync(yamlPath)) continue;
    const raw = YAML.parse(readFileSync(yamlPath, 'utf8'));
    const parsed = modelSchema.safeParse({ slug: entry, ...raw });
    if (!parsed.success) {
      throw new Error(`models/${entry}/model.yaml is invalid: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    const cfg = parsed.data;
    models.push({
      ...cfg,
      dir,
      files: () => ({
        voice: readIf(join(dir, 'voice', 'voice.md')),
        examples: readIf(join(dir, 'voice', 'caption-examples.md')),
        banned: readIf(join(dir, 'voice', 'banned-phrases.md'))
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#')),
        hooks: readIf(join(dir, 'voice', 'hooks.md')),
        notes: readIf(join(dir, 'notes.md')),
        sourcing: YAML.parse(readIf(join(dir, 'sourcing', 'reels-sources.yaml')) || '{}'),
      }),
    });
  }
  return models.filter((m) => m.active);
}

export class ModelRegistry {
  private bySlug = new Map<string, Model>();
  private byChannel = new Map<string, Model>();
  constructor(models: Model[]) {
    for (const m of models) {
      this.bySlug.set(m.slug, m);
      for (const id of Object.values(m.discord.channels)) if (id) this.byChannel.set(id, m);
    }
  }
  all(): Model[] {
    return [...this.bySlug.values()];
  }
  get(slug: string): Model | undefined {
    return this.bySlug.get(slug);
  }
  forChannel(channelId: string): Model | undefined {
    return this.byChannel.get(channelId);
  }
  /** Threads inside a model's forum board resolve to the model via parentId. */
  forChannelOrParent(channelId: string, parentId?: string | null): Model | undefined {
    return this.byChannel.get(channelId) ?? (parentId ? this.byChannel.get(parentId) : undefined);
  }
}
