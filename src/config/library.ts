import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';

/** library/genres.yaml — the agency-wide Content Library folders (one forum per genre). */
export const LIBRARY_FILE = join(process.cwd(), 'library', 'genres.yaml');

const genreSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(40),
  emoji: z.string().min(1),
  description: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

const schema = z.object({
  scout: z
    .object({
      cron: z.string().default('0 9 * * *'),
      per_hashtag: z.number().int().min(1).max(50).default(15),
      per_account: z.number().int().min(1).max(30).default(6),
      newer_than: z.string().default('7 days'),
      classify_top: z.number().int().min(1).max(20).default(8),
      keep: z.number().int().min(1).max(10).default(3),
      min_score: z.number().min(0).max(1).default(0.55),
    })
    .default({}),
  genres: z.array(genreSchema).min(1).max(20), // 20 = Discord's forum-tag limit (every genre is also a tag)
});

export type Genre = z.infer<typeof genreSchema>;
export type LibraryConfig = z.infer<typeof schema>;

export function loadLibrary(): LibraryConfig {
  const raw = YAML.parse(readFileSync(LIBRARY_FILE, 'utf8'));
  const cfg = schema.parse(raw);
  const slugs = new Set<string>();
  for (const g of cfg.genres) {
    if (slugs.has(g.slug)) throw new Error(`library/genres.yaml: duplicate genre slug ${g.slug}`);
    slugs.add(g.slug);
  }
  return cfg;
}
