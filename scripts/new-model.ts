/**
 * Copy models/_template → models/<slug> and stamp the slug/display name.
 *   npm run new-model -- amari "Amari Preeti" AMA
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [slug, displayName, code] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: npm run new-model -- <slug> ["Display Name"] [ABC]');
  process.exit(1);
}
const src = join(process.cwd(), 'models', '_template');
const dst = join(process.cwd(), 'models', slug);
if (existsSync(dst)) {
  console.error(`models/${slug} already exists`);
  process.exit(1);
}
cpSync(src, dst, { recursive: true });

const yamlPath = join(dst, 'model.yaml');
let yaml = readFileSync(yamlPath, 'utf8');
yaml = yaml.replace(/^display_name:.*$/m, `display_name: ${JSON.stringify(displayName ?? slug)}`);
yaml = yaml.replace(/^code:.*$/m, `code: ${(code ?? slug.slice(0, 3)).toUpperCase()}`);
writeFileSync(yamlPath, yaml);

console.log(`created models/${slug}/
next:
  1. fill models/${slug}/model.yaml (discord ids come from: npm run setup-server -- ${slug})
  2. npm run import-captions -- ${slug}    (pulls her real captions into voice/caption-examples.md)
  3. write voice/voice.md — 20 minutes with Dan/Marissa, it is the single most important file for captions`);
