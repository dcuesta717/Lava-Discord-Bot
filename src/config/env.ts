import 'dotenv/config';
import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  BOT_ADMIN_IDS: csv,
  OWNER_IDS: csv,
  STAFF_LIVE_ALERTS_CHANNEL_ID: z.string().default(''),
  STAFF_REQUESTS_INBOX_CHANNEL_ID: z.string().default(''),
  STAFF_REELS_INBOX_CHANNEL_ID: z.string().default(''),
  STAFF_OPS_LOG_CHANNEL_ID: z.string().default(''),
  AGENCY_LOUNGE_CHANNEL_ID: z.string().default(''),

  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-5'),
  CLAUDE_VISION_MODEL: z.string().default('claude-sonnet-4-5'),

  NOTION_TOKEN: z.string().default(''),
  NOTION_DB_MODELS: z.string().default(''),
  NOTION_DB_LIVE_SESSIONS: z.string().default(''),
  NOTION_DB_WEEKLY_METRICS: z.string().default(''),
  NOTION_DB_CONTENT_REQUESTS: z.string().default(''),
  NOTION_DB_REELS_BOARD: z.string().default(''),
  NOTION_DB_POSTS: z.string().default(''),

  GOOGLE_SERVICE_ACCOUNT_B64: z.string().default(''),
  DRIVE_ROOT_FOLDER_ID: z.string().default(''),

  APIFY_TOKEN: z.string().default(''),
  APIFY_TIKTOK_ACTOR: z.string().default('clockworks/tiktok-scraper'),
  APIFY_INSTAGRAM_ACTOR: z.string().default('apify/instagram-scraper'),

  ZERNIO_API_KEY: z.string().default(''),

  REGISTER_COMMANDS_ON_BOOT: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  DATABASE_URL: z.string().min(1), // Supabase → Connect → Transaction pooler URI (port 6543)
  DEFAULT_TIMEZONE: z.string().default('America/New_York'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
