import type { Model } from '../../config/models.js';
import type { Claude } from '../../integrations/anthropic.js';
import { loadPrompt } from '../../lib/prompts.js';
import { lintCaption } from './lint.js';

/**
 * examples → 3 candidates (Claude) → critic (Claude, T=0) → deterministic lint → best.
 * Retries once with the lint violations fed back. Returns everything so the approval card can show it.
 */
export interface CaptionRun {
  candidates: string[];
  critic: CriticResult | null;
  chosen: string | null;
  lint: { text: string; violations: string[] }[];
  attempts: number;
}

export interface CriticResult {
  scores: { text: string; voice: number; slop: number; hook: number; tells: string[] }[];
  best_index: number;
  final: string | null;
  reason: string;
}

function sampleExamples(examples: string, n: number): string {
  const lines = examples
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('<!--'));
  // deterministic-ish spread: take every k-th so we cover old and new captions
  if (lines.length <= n) return lines.map((l) => `- ${l}`).join('\n');
  const step = lines.length / n;
  return Array.from({ length: n }, (_, i) => `- ${lines[Math.floor(i * step)]}`).join('\n');
}

export async function generateCaption(claude: Claude, model: Model, brief: string, platform: string): Promise<CaptionRun> {
  const files = model.files();
  const banned = files.banned.filter((l) => !l.startsWith('allow:')).join('\n') || '(none beyond the global list)';
  const run: CaptionRun = { candidates: [], critic: null, chosen: null, lint: [], attempts: 0 };

  let extra = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    run.attempts = attempt;
    const gen = await claude.json<{ candidates: string[] }>(
      loadPrompt('caption.generate', {
        model_name: model.display_name,
        voice: files.voice || '(no voice file yet — write short, plain, lowercase)',
        examples: sampleExamples(files.examples, 40) || '(no examples yet)',
        hooks: files.hooks || '(none recorded)',
        banned,
        platform,
        brief,
        max_chars: String(model.caption.max_chars),
        max_emoji: String(model.caption.max_emoji),
        max_hashtags: String(model.caption.max_hashtags),
        lowercase: String(model.caption.lowercase),
      }) + extra,
      { temperature: 1.0, maxTokens: 600 },
    );
    run.candidates = (gen.candidates ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 3);
    if (!run.candidates.length) continue;

    run.critic = await claude.json<CriticResult>(
      loadPrompt('caption.critic', {
        model_name: model.display_name,
        voice: files.voice || '(no voice file yet)',
        examples: sampleExamples(files.examples, 15) || '(no examples yet)',
        candidates: run.candidates.map((c, i) => `${i}. ${c}`).join('\n'),
      }),
      { temperature: 0, maxTokens: 800 },
    );

    const pick = run.critic.final ?? run.candidates[run.critic.best_index] ?? null;
    run.lint = [...run.candidates, ...(run.critic.final ? [run.critic.final] : [])].map((text) => ({ text, violations: lintCaption(text, model).violations }));

    if (pick && lintCaption(pick, model).ok) {
      run.chosen = pick;
      return run;
    }
    // fall back to the first candidate that passes lint
    const clean = run.candidates.find((c) => lintCaption(c, model).ok);
    if (clean) {
      run.chosen = clean;
      return run;
    }
    extra = `\n\nPREVIOUS ATTEMPT FAILED LINT. Violations:\n${run.lint.map((l) => `- "${l.text}" → ${l.violations.join('; ') || 'ok'}`).join('\n')}\nFix these and try again.`;
  }
  return run; // chosen may be null → caller shows candidates with ✏️ edit
}
