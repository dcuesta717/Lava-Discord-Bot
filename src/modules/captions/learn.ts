import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Model } from '../../config/models.js';

/**
 * Every approved or hand-edited caption is appended to models/<slug>/voice/caption-examples.md
 * under a "Bot-era approved" section, so the next generation has fresher, better examples.
 * Edited captions are tagged so we can weight them higher later.
 *
 * ponytail: plain file append, committed by a human/CI later. Upgrade path: write to DB + regenerate file nightly.
 */
const HEADER = '\n## Bot-era approved (auto-appended — do not edit by hand)\n';

export function learnCaption(model: Model, text: string, kind: 'approved' | 'edited') {
  const path = join(model.dir, 'voice', 'caption-examples.md');
  if (!existsSync(path)) writeFileSync(path, '# Caption examples\n');
  const current = readFileSync(path, 'utf8');
  if (!current.includes(HEADER.trim())) appendFileSync(path, HEADER);
  const tag = kind === 'edited' ? ' <!-- edited by human: weight high -->' : '';
  appendFileSync(path, `- ${text.replace(/\n/g, ' ')}${tag}\n`);
}
