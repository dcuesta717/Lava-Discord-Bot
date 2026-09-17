import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The lens every content decision looks through, injected into scouting / research / ideas prompts as {{industry}}:
 *   knowledge/industry.md — the agency's playbook (what works for OF creators on IG/TikTok, what "library material" means)
 *   knowledge/taste.md    — "what the owner saves", written by the bot from Dan's saved collections (modules/library/saved.ts)
 * The taste profile gets up to 40 % of the budget when it exists, so the classifier sees both.
 */
const INDUSTRY = join(process.cwd(), 'knowledge', 'industry.md');
const TASTE = join(process.cwd(), 'knowledge', 'taste.md');
let cache: { at: number; industry: string; taste: string } | undefined;

function read(file: string) {
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
}

export function industryLens(maxChars = 6000): string {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), industry: read(INDUSTRY), taste: read(TASTE) };
  const taste = cache.taste ? cache.taste.slice(0, Math.floor(maxChars * 0.4)) : '';
  const industry = cache.industry.slice(0, Math.max(0, maxChars - taste.length - 8));
  return [industry || '(no industry playbook file)', taste].filter(Boolean).join('\n\n---\n\n');
}
