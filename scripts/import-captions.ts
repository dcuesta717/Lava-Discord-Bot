/**
 * Pull a model's real Instagram/TikTok captions through Apify into models/<slug>/voice/caption-examples.md,
 * top performers first, so the caption generator learns from what actually worked.
 *   npm run import-captions -- jane [limit=80]
 * Uses socials.instagram / socials.tiktok from model.yaml. Idempotent: rewrites the "## Imported" section only.
 * (/model add does this automatically during onboarding; this script is the manual re-run.)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { loadModels } from '../src/config/models.js';
import { Apify, type ReelCandidate } from '../src/integrations/apify.js';
import { captionBudgets, captionStats, importedSection, withImportedSection } from '../src/lib/caption-examples.js';

const [slug, limitArg] = process.argv.slice(2);
const limit = Number(limitArg ?? 80);
const env = loadEnv();
const model = loadModels().find((m) => m.slug === slug);
if (!model) {
  console.error(`unknown model ${slug}`);
  process.exit(1);
}
const apify = new Apify(env.APIFY_TOKEN, env.APIFY_TIKTOK_ACTOR, env.APIFY_INSTAGRAM_ACTOR);
if (!apify.enabled) {
  console.error('APIFY_TOKEN missing');
  process.exit(1);
}

const posts: ReelCandidate[] = [];
if (model.socials.instagram) posts.push(...(await apify.instagramOwnPosts(model.socials.instagram, { reels: limit, posts: Math.round(limit / 2) })));
if (model.socials.tiktok) posts.push(...(await apify.tiktok({ seed_accounts: [model.socials.tiktok], results_per_query: limit })));

const path = join(model.dir, 'voice', 'caption-examples.md');
const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
writeFileSync(path, withImportedSection(existing, importedSection(posts, limit)));
const s = captionStats(posts);
console.log(`wrote ${s.n} captions → ${path}
  median ${s.medianChars} chars / ${s.medianWords} words · hashtags ${Math.round(s.hashtagRate * 100)}% · emoji ${Math.round(s.emojiRate * 100)}% · lowercase ${Math.round(s.lowercaseRate * 100)}%
  → suggested model.yaml caption budgets: ${JSON.stringify(captionBudgets(s))}`);
process.exit(0);
