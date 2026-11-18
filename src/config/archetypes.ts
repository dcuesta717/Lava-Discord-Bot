import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';

/**
 * library/archetypes.yaml — creator "buckets" and the roster of girls (Dan, Sep 18 / Nov 18 2026).
 *
 * Folders (library/genres.yaml) are FORMATS. A bucket is a creator PROFILE: the folders it pulls from (her lanes) and the
 * reference creators who do it best (her personal seed accounts). The roster maps each girl — onboarded or not yet — to a
 * bucket plus her own "inspirational pages" (Dan: "add vivylue to pull content for Madi").
 *
 * Used in three places: (1) boot — every reference creator is seeded into the daily scout under the bucket's lanes;
 * (2) /model add — a girl on the roster gets the bucket's lanes and all reference creators as her seed accounts instead of
 * the research guess; (3) the weekly refresh keeps those seeds (it used to wipe them — backlog N).
 */
export const ARCHETYPES_FILE = join(process.cwd(), 'library', 'archetypes.yaml');

const handle = z.string().regex(/^[A-Za-z0-9._]+$/);
const bucketSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  lanes: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1), // genre slugs; the first one is the primary folder
  references: z.array(handle).default([]), // creators who define the bucket (handles without @)
  note: z.string().optional(),
});
const girlSchema = z.object({
  bucket: z.string().regex(/^[a-z0-9-]+$/).optional(),
  lanes: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(), // overrides the bucket's lanes when set
  references: z.array(handle).default([]), // her own inspirational pages, on top of the bucket's
  note: z.string().optional(),
});
const schema = z.object({
  buckets: z.array(bucketSchema).default([]),
  girls: z.record(z.string().regex(/^[a-z0-9-]+$/), girlSchema).default({}), // key = model slug, its first part, or her first name (lowercase)
});
export type Bucket = z.infer<typeof bucketSchema>;
export type ArchetypesConfig = z.infer<typeof schema>;

export function loadArchetypes(): ArchetypesConfig {
  if (!existsSync(ARCHETYPES_FILE)) return { buckets: [], girls: {} };
  const cfg = schema.parse(YAML.parse(readFileSync(ARCHETYPES_FILE, 'utf8')) ?? {});
  const slugs = new Set<string>();
  for (const b of cfg.buckets) {
    if (slugs.has(b.slug)) throw new Error(`library/archetypes.yaml: duplicate bucket ${b.slug}`);
    slugs.add(b.slug);
  }
  for (const [name, g] of Object.entries(cfg.girls)) if (g.bucket && !slugs.has(g.bucket)) throw new Error(`library/archetypes.yaml: girl "${name}" names unknown bucket ${g.bucket}`);
  return cfg;
}

/** What the roster says about a girl: her lanes and every seed creator (bucket references + her own). Matches slug, its first part, or her first name. */
export function rosterFor(slug: string, displayName = ''): { key: string; bucket?: Bucket; lanes: string[]; seeds: string[]; note?: string } | undefined {
  const cfg = loadArchetypes();
  const keys = [...new Set([slug, slug.split('-')[0], displayName.split(/\s+/)[0]?.toLowerCase()].filter(Boolean).map((k) => k.toLowerCase()))];
  const key = keys.find((k) => cfg.girls[k]);
  if (!key) return undefined;
  const g = cfg.girls[key];
  const bucket = g.bucket ? cfg.buckets.find((b) => b.slug === g.bucket) : undefined;
  const lanes = g.lanes?.length ? g.lanes : (bucket?.lanes ?? []);
  const seeds = [...new Set([...(bucket?.references ?? []), ...g.references].map((h) => h.toLowerCase()))];
  return { key, bucket, lanes, seeds, note: g.note };
}

/**
 * Every reference creator with the ONE folder it is scouted under: the bucket's primary lane (first in the list); a girl's own
 * pages → her first lane. One folder per creator keeps Apify spend flat (each seed costs ~6 results/day per folder) — the judge
 * still files her videos wherever they belong and tags the secondary folders.
 */
export function referenceSeeds(): { genre: string; account: string; who: string }[] {
  const cfg = loadArchetypes();
  const out = new Map<string, { genre: string; account: string; who: string }>();
  const add = (genre: string, account: string, who: string) => {
    const k = `${genre}:${account.toLowerCase()}`;
    if (!out.has(k)) out.set(k, { genre, account: account.toLowerCase(), who });
  };
  for (const b of cfg.buckets) for (const a of b.references) add(b.lanes[0], a, `bucket:${b.slug}`);
  for (const [name, g] of Object.entries(cfg.girls)) {
    const bucket = g.bucket ? cfg.buckets.find((b) => b.slug === g.bucket) : undefined;
    const lane = g.lanes?.[0] ?? bucket?.lanes[0];
    if (lane) for (const a of g.references) add(lane, a, `girl:${name}`);
  }
  return [...out.values()];
}
