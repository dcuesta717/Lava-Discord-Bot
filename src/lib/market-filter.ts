import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Deterministic pre-filter for scouted videos (Dan: "we don't need foreign content — none of that is useful for our market").
 * Keeps English-language content aimed at the Western (US/UK/CA/AU) market our creators serve. Runs BEFORE Claude so we
 * never pay to classify something the agency can't use. Claude does the finer judgement (female creator, replicable, IG-safe).
 *
 *   - script check: if more than 10 % of the letters in caption + hashtags are outside the Latin alphabet (CJK, Devanagari,
 *     Arabic, Thai, Cyrillic, Hangul, …) the post is made for another language market → skip
 *   - keyword list: library/market-exclude.txt (one per line, case-insensitive substring; '//' comments; '#tag' entries are
 *     literal hashtags) — market-specific terms the owners don't want in the library. Editable without code.
 */
const EXCLUDE_FILE = join(process.cwd(), 'library', 'market-exclude.txt');
let cache: { at: number; words: string[] } | undefined;

function excludeWords(): string[] {
  if (cache && Date.now() - cache.at < 60_000) return cache.words;
  const words = existsSync(EXCLUDE_FILE)
    ? readFileSync(EXCLUDE_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l && !l.startsWith('//'))
    : [];
  cache = { at: Date.now(), words };
  return words;
}

const NON_LATIN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Georgian}\p{Script=Ethiopic}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Sinhala}]/u;
const LETTER = /[\p{L}\p{M}]/u; // letters + combining marks (vowel signs count toward the script)

export interface MarketVerdict {
  ok: boolean;
  reason?: string;
}

export function marketFilter(caption: string | undefined, hashtags: string[] | undefined): MarketVerdict {
  const text = `${caption ?? ''} ${(hashtags ?? []).map((h) => `#${h}`).join(' ')}`;
  let letters = 0;
  let foreign = 0;
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    letters++;
    if (NON_LATIN.test(ch)) foreign++;
  }
  if (letters >= 8 && foreign / letters > 0.1) return { ok: false, reason: 'non-English script' };
  const lower = text.toLowerCase();
  const hit = excludeWords().find((w) => lower.includes(w));
  if (hit) return { ok: false, reason: `market keyword "${hit}"` };
  return { ok: true };
}
