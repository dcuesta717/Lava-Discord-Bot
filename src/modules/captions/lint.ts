import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Model } from '../../config/models.js';

/**
 * Deterministic caption lint — the last line of defence after the LLM critic.
 * Global rules in prompts/slop-blocklist.txt, per-model rules in models/<slug>/voice/banned-phrases.md.
 * A model can whitelist a global rule with a line "allow: <phrase>".
 */
export interface LintResult {
  ok: boolean;
  violations: string[];
}

interface Rule {
  label: string;
  test: (s: string) => boolean;
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HASHTAG_RE = /#\w+/g;

let globalCache: { rules: Rule[]; raw: string[] } | undefined;

function parseLine(line: string): Rule | undefined {
  const l = line.trim();
  if (!l || l.startsWith('#') || l.startsWith('allow:')) return undefined;
  if (l.startsWith('re:')) {
    const re = new RegExp(l.slice(3), 'iu');
    return { label: l, test: (s) => re.test(s) };
  }
  const needle = l.toLowerCase();
  return { label: l, test: (s) => s.toLowerCase().includes(needle) };
}

function globalRules(): { rules: Rule[]; raw: string[] } {
  if (globalCache && process.env.NODE_ENV === 'production') return globalCache;
  const raw = readFileSync(join(process.cwd(), 'prompts', 'slop-blocklist.txt'), 'utf8').split('\n');
  const rules = raw.map(parseLine).filter((r): r is Rule => Boolean(r));
  globalCache = { rules, raw };
  return globalCache;
}

export function lintCaption(text: string, model: Model): LintResult {
  const violations: string[] = [];
  const cfg = model.caption;
  const files = model.files();

  const allow = new Set(
    files.banned
      .filter((l) => l.startsWith('allow:'))
      .map((l) => l.slice(6).trim().toLowerCase()),
  );

  // length / budgets
  if (text.length > cfg.max_chars) violations.push(`too long (${text.length} > ${cfg.max_chars})`);
  const emojiCount = (text.match(EMOJI_RE) ?? []).length;
  if (emojiCount > cfg.max_emoji) violations.push(`too many emoji (${emojiCount} > ${cfg.max_emoji})`);
  const hashtags = text.match(HASHTAG_RE) ?? [];
  if (hashtags.length > cfg.max_hashtags) violations.push(`too many hashtags (${hashtags.length} > ${cfg.max_hashtags})`);
  if (cfg.lowercase && /[A-Z]{2,}/.test(text.replace(/#\w+/g, ''))) violations.push('shouting caps (model writes lowercase)');

  // global blocklist (minus model allow-list)
  for (const r of globalRules().rules) {
    const key = r.label.replace(/^re:/, '').toLowerCase();
    if (allow.has(key)) continue;
    if (r.test(text)) violations.push(`global: ${r.label}`);
  }

  // per-model banned phrases
  for (const line of files.banned) {
    const r = parseLine(line);
    if (r && r.test(text)) violations.push(`model: ${r.label}`);
  }

  return { ok: violations.length === 0, violations };
}
