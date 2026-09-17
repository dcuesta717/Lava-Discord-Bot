import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROMPTS_DIR = join(process.cwd(), 'prompts');
const cache = new Map<string, string>();

/**
 * Load `prompts/<name>.md`. Prompts are markdown files, never string literals in code (see CLAUDE.md).
 * `{{placeholders}}` are replaced from `vars`. Unknown placeholders are left as-is so they are visible.
 */
export function loadPrompt(name: string, vars: Record<string, string> = {}): string {
  let text = cache.get(name);
  if (!text) {
    text = readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');
    if (process.env.NODE_ENV === 'production') cache.set(name, text);
  }
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => (key in vars ? vars[key] : m));
}
