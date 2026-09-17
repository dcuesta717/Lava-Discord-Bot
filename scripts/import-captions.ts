/**
 * Pull a model's real Instagram/TikTok captions through Apify into models/<slug>/voice/caption-examples.md,
 * top performers first, so the caption generator learns from what actually worked.
 *   npm run import-captions -- jane [limit=80]
 * Uses socials.instagram / socials.tiktok from model.yaml. Idempotent: rewrites the "## Imported" section only.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { loadModels } from '../src/config/models.js';
import { Apify, type ReelCandidate } from '../src/integrations/apify.js';

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
if (model.socials.instagram) posts.push(...(await apify.instagram({ seed_accounts: [model.socials.instagram], results_per_query: limit })));
if (model.socials.tiktok) posts.push(...(await apify.tiktok({ seed_accounts: [model.socials.tiktok], results_per_query: limit })));

const clean = posts
  .filter((p) => p.caption && p.caption.trim().length > 0)
  .sort((a, b) => b.views - a.views);

const median = clean.length ? clean.map((p) => p.caption.length).sort((a, b) => a - b)[Math.floor(clean.length / 2)] : 0;
const hashtagRate = clean.length ? clean.filter((p) => /#\w+/.test(p.caption)).length / clean.length : 0;
const emojiRate = clean.length ? clean.filter((p) => /\p{Extended_Pictographic}/u.test(p.caption)).length / clean.length : 0;
const lowercaseRate = clean.length ? clean.filter((p) => p.caption === p.caption.toLowerCase()).length / clean.length : 0;

const section = [
  '## Imported (auto — rewritten by import-captions; do not edit)',
  `<!-- stats: n=${clean.length} · median length ${median} chars · ${Math.round(hashtagRate * 100)}% use hashtags · ${Math.round(emojiRate * 100)}% use emoji · ${Math.round(lowercaseRate * 100)}% all-lowercase -->`,
  ...clean.slice(0, limit).map((p) => `- ${p.caption.replace(/\s+/g, ' ').trim()}  <!-- ${p.platform} · ${p.views.toLocaleString()} views -->`),
  '',
].join('\n');

const path = join(model.dir, 'voice', 'caption-examples.md');
let file = existsSync(path) ? readFileSync(path, 'utf8') : '# Caption examples\n\n';
file = file.replace(/## Imported[\s\S]*?(?=\n## |\s*$)/, '').trimEnd() + '\n\n' + section;
writeFileSync(path, file);
console.log(`wrote ${clean.length} captions → ${path}
  median length ${median} chars · hashtags ${Math.round(hashtagRate * 100)}% · emoji ${Math.round(emojiRate * 100)}% · lowercase ${Math.round(lowercaseRate * 100)}%
  → set caption.max_chars / max_emoji / max_hashtags / lowercase in model.yaml to match these stats.`);
process.exit(0);
