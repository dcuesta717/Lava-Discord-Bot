import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** knowledge/industry.md — the agency's playbook, injected into scouting / research / ideas prompts as {{industry}}. */
const FILE = join(process.cwd(), 'knowledge', 'industry.md');
let cache: { at: number; text: string } | undefined;

export function industryLens(maxChars = 6000): string {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), text: existsSync(FILE) ? readFileSync(FILE, 'utf8') : '' };
  return cache.text.slice(0, maxChars) || '(no industry playbook file)';
}
