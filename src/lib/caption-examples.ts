import type { ReelCandidate } from '../integrations/apify.js';

/**
 * Builds the "## Imported" section of models/<slug>/voice/caption-examples.md from her real posts (top performers first)
 * plus the caption budgets model.yaml should use. Shared by scripts/import-captions.ts and /model add.
 */
export interface CaptionStats {
  n: number;
  medianChars: number;
  medianWords: number;
  hashtagRate: number;
  emojiRate: number;
  lowercaseRate: number;
  medianEmoji: number;
  medianHashtags: number;
}

const EMOJI = /\p{Extended_Pictographic}/gu;
const HASHTAG = /#\w+/g;

export function captionStats(posts: ReelCandidate[]): CaptionStats {
  const caps = posts.map((p) => (p.caption ?? '').trim()).filter(Boolean);
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
  return {
    n: caps.length,
    medianChars: med(caps.map((c) => c.length)),
    medianWords: med(caps.map((c) => c.split(/\s+/).filter(Boolean).length)),
    hashtagRate: caps.length ? caps.filter((c) => HASHTAG.test(c)).length / caps.length : 0,
    emojiRate: caps.length ? caps.filter((c) => EMOJI.test(c)).length / caps.length : 0,
    lowercaseRate: caps.length ? caps.filter((c) => c === c.toLowerCase()).length / caps.length : 0,
    medianEmoji: med(caps.map((c) => (c.match(EMOJI) ?? []).length)),
    medianHashtags: med(caps.map((c) => (c.match(HASHTAG) ?? []).length)),
  };
}

/** Budgets for model.yaml → caption (loose enough that her median passes, tight enough to catch slop). */
export function captionBudgets(s: CaptionStats) {
  return {
    max_chars: Math.max(60, Math.min(600, Math.round(s.medianChars * 1.6) || 150)),
    max_emoji: Math.max(0, Math.min(8, s.medianEmoji + 1)),
    max_hashtags: Math.max(0, Math.min(10, s.hashtagRate > 0.5 ? s.medianHashtags + 1 : s.hashtagRate > 0 ? 2 : 0)),
    lowercase: s.lowercaseRate >= 0.7,
  };
}

export function importedSection(posts: ReelCandidate[], limit = 80): string {
  const clean = posts.filter((p) => p.caption && p.caption.trim().length > 0).sort((a, b) => (b.likes + (b.comments ?? 0) * 5 || b.views) - (a.likes + (a.comments ?? 0) * 5 || a.views));
  const s = captionStats(clean);
  return [
    '## Imported (auto — rewritten by import-captions / model add; do not edit)',
    `<!-- stats: n=${s.n} · median length ${s.medianChars} chars / ${s.medianWords} words · ${Math.round(s.hashtagRate * 100)}% use hashtags · ${Math.round(s.emojiRate * 100)}% use emoji · ${Math.round(s.lowercaseRate * 100)}% all-lowercase -->`,
    ...clean.slice(0, limit).map((p) => `- ${p.caption.replace(/\s+/g, ' ').trim()}  <!-- ${p.platform}${p.kind ? ` · ${p.kind}` : ''} · ❤️ ${p.likes.toLocaleString()} · 💬 ${(p.comments ?? 0).toLocaleString()}${p.views ? ` · ▶️ ${p.views.toLocaleString()}` : ''} -->`),
    '',
  ].join('\n');
}

/** Replace (or append) the Imported section in an existing caption-examples.md. */
export function withImportedSection(existing: string, section: string): string {
  const base = (existing || '# Caption examples\n\n## Hand-picked\n- \n').replace(/## Imported[\s\S]*?(?=\n## |\s*$)/, '').trimEnd();
  return `${base}\n\n${section}`;
}
