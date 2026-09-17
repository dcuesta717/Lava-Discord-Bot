import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DateTime } from 'luxon';
import YAML from 'yaml';
import { MODELS_DIR } from '../../config/models.js';
import type { InstagramProfile, ReelCandidate } from '../../integrations/apify.js';
import type { RepoFile } from '../../integrations/github.js';
import { captionBudgets, captionStats, importedSection, withImportedSection } from '../../lib/caption-examples.js';
import type { ModelStructureIds } from '../../lib/model-structure.js';

/** Pure pieces of /model add: stats from her posts and the models/<slug>/ files rendered from the research. */
const TEMPLATE_DIR = join(MODELS_DIR, '_template');
export const STAFF_MARKER = '<!-- staff-notes-below: everything under this line is kept when /model refresh rewrites the file -->';

export interface Research {
  one_liner: string;
  personality: string;
  lanes: { slug: string; confidence: number; why: string }[];
  formats_that_win: { format: string; evidence: string; replicable_weekly?: boolean }[];
  formats_that_flop?: { format: string; evidence: string }[];
  hooks: string[];
  caption_style: {
    case: string;
    median_words: number;
    emoji: string;
    hashtags: string;
    punctuation: string;
    cta: string;
    slang_used: string[];
    slang_avoid: string[];
    perfect_examples: string[];
  };
  cadence: { posts_per_week: number; best_days: string[]; best_hours_local: string[]; note?: string };
  audience: string;
  do: string[];
  dont: string[];
  ideas_next_30_days: { idea: string; lane: string; why: string }[];
  seed_hashtags: string[];
  similar_creators_note?: string;
  risks?: string[];
  gaps?: string[];
}

export interface Stats {
  posts: number;
  reels: number;
  photos: number;
  carousels: number;
  span_days: number;
  posts_per_week: number;
  median_likes: number;
  median_comments: number;
  median_views: number;
  comment_ratio: number; // comments per 100 likes
  best_days: string[];
  best_hours_local: string[];
  top_hashtags: string[];
  top_audios: string[];
  caption: ReturnType<typeof captionStats>;
}


export function tmpl(rel: string): string {
  return existsSync(join(TEMPLATE_DIR, rel)) ? readFileSync(join(TEMPLATE_DIR, rel), 'utf8') : '';
}

export function today(tz = 'America/New_York'): string {
  return DateTime.now().setZone(tz).toFormat('yyyy-LL-dd');
}

export function computeStats(posts: ReelCandidate[], tz: string): Stats {
  const dated = posts.filter((p) => p.postedAt && !p.pinned).map((p) => ({ ...p, t: DateTime.fromISO(p.postedAt!, { zone: 'utc' }).setZone(tz) })).filter((p) => p.t.isValid);
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
  const times = dated.map((p) => p.t.toMillis());
  const span = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 86_400_000 : 0;
  const count = (f: (p: ReelCandidate) => boolean) => posts.filter(f).length;
  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();
  for (const p of dated) {
    dayCounts.set(p.t.toFormat('ccc'), (dayCounts.get(p.t.toFormat('ccc')) ?? 0) + 1);
    hourCounts.set(p.t.toFormat('HH:00'), (hourCounts.get(p.t.toFormat('HH:00')) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const tagCounts = new Map<string, number>();
  for (const p of posts) for (const h of p.hashtags ?? []) tagCounts.set(h.toLowerCase(), (tagCounts.get(h.toLowerCase()) ?? 0) + 1);
  const audioCounts = new Map<string, number>();
  for (const p of posts) if (p.audio) audioCounts.set(p.audio, (audioCounts.get(p.audio) ?? 0) + 1);
  const likes = posts.map((p) => p.likes).filter((n) => n > 0);
  const comments = posts.map((p) => p.comments ?? 0);
  const medLikes = med(likes);
  return {
    posts: posts.length,
    reels: count((p) => p.kind === 'reel'),
    photos: count((p) => p.kind === 'photo'),
    carousels: count((p) => p.kind === 'carousel'),
    span_days: Math.round(span),
    posts_per_week: span > 0 ? Number(((dated.length / span) * 7).toFixed(1)) : dated.length,
    median_likes: medLikes,
    median_comments: med(comments),
    median_views: med(posts.map((p) => p.views).filter((n) => n > 0)),
    comment_ratio: medLikes ? Number(((med(comments) / medLikes) * 100).toFixed(1)) : 0,
    best_days: top(dayCounts, 3),
    best_hours_local: top(hourCounts, 3),
    top_hashtags: top(tagCounts, 8),
    top_audios: top(audioCounts, 5),
    caption: captionStats(posts),
  };
}

export function renderFiles(o: {
  slug: string;
  name: string;
  userId: string;
  instagram: string;
  tiktok: string;
  timezone: string;
  ids: ModelStructureIds;
  research: Research;
  stats: Stats;
  profile: InstagramProfile;
  posts: ReelCandidate[];
}, tz = 'America/New_York'): RepoFile[] {
  const { research, stats } = o;
  const budgets = captionBudgets(stats.caption);
  const yamlObj = {
    display_name: o.name,
    code: (o.slug.replace(/[^a-z]/g, '').slice(0, 3) || 'xxx').toUpperCase().padEnd(3, 'X'),
    timezone: o.timezone,
    active: true,
    lanes: research.lanes.map((l) => l.slug),
    discord: {
      category_id: o.ids.category_id,
      role_id: o.ids.role_id,
      user_id: o.userId,
      manager_ids: [],
      channels: { general: o.ids.channels.general, reels_board: o.ids.channels.reels_board, custom: o.ids.channels.custom, notification: o.ids.channels.notification, resources: o.ids.channels.resources },
    },
    socials: { instagram: o.instagram, tiktok: o.tiktok, x: '', onlyfans: '' },
    drive: { root_folder_id: '', raw_folder_id: '', ready_to_post_folder_id: '' },
    zernio: { accounts: [], best_times: research.cadence?.best_hours_local?.length ? research.cadence.best_hours_local.slice(0, 2) : ['11:00', '19:00'] },
    live: { check_in_after_min: 40, repeat_every_min: 30, auto_end_after_min: 120 },
    insights: { cron: '0 9 * * 1', reminder_cron: '0 12 * * 2' },
    earnings: { best_month_usd: 0, goal_month_usd: 0 },
    caption: budgets,
  };
  const yaml = `# ${o.name} — generated by /model add on ${today(tz)}. Edit freely; ids came from the bot. Voice lives in voice/, research in profile.md.\n${YAML.stringify(yamlObj)}`;
  const dir = `models/${o.slug}`;
  return [
    { path: `${dir}/model.yaml`, content: yaml },
    { path: `${dir}/profile.md`, content: renderProfile({ name: o.name, instagram: o.instagram, tiktok: o.tiktok, research, stats, profile: o.profile }, '', tz) },
    { path: `${dir}/voice/voice.md`, content: renderVoice(o.name, research, stats, tz) },
    { path: `${dir}/voice/caption-examples.md`, content: withImportedSection(tmpl('voice/caption-examples.md'), importedSection(o.posts)) },
    { path: `${dir}/voice/hooks.md`, content: `# Hooks / openers that have worked for her\n\nFrom the onboarding research (${today(tz)}). Add a line each time a post pops; remove stale ones.\n\n${research.hooks.map((h) => `- ${h}`).join('\n')}\n` },
    { path: `${dir}/voice/banned-phrases.md`, content: `${tmpl('voice/banned-phrases.md')}\n# from research — words that would sound wrong for her\n${(research.caption_style?.slang_avoid ?? []).map((w) => w.trim()).filter(Boolean).join('\n')}\n` },
    { path: `${dir}/sourcing/reels-sources.yaml`, content: renderSourcing(research, o.tiktok, tz) },
    { path: `${dir}/notes.md`, content: renderNotes(o.name, research, tz) },
    { path: `${dir}/playbooks/README.md`, content: tmpl('playbooks/README.md') || '# Playbooks\n' },
  ];
}

export function renderProfile(o: { name: string; instagram: string; tiktok: string; research: Research; stats: Stats; profile: InstagramProfile }, staffTail: string, tz = 'America/New_York'): string {
  const { research: r, stats: s, profile: p } = o;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const md = [
    `# ${o.name} — profile`,
    '',
    `_Deep research generated by the bot on ${today(tz)} from ${s.posts} public posts (@${o.instagram}${o.tiktok ? `, @${o.tiktok} on TikTok` : ''}). Re-run with \`/model refresh\`. Everything above the staff line is overwritten on refresh._`,
    '',
    `**${r.one_liner}**`,
    '',
    `- Instagram: @${p.username} · ${p.followers.toLocaleString()} followers · ${p.postsCount} posts${p.category ? ` · ${p.category}` : ''}${p.verified ? ' · verified' : ''}`,
    `- Bio: ${p.biography.replace(/\s+/g, ' ') || '—'}`,
    '',
    '## Personality on camera',
    r.personality,
    '',
    '## Lanes (Content Library folders)',
    ...r.lanes.map((l) => `- **${l.slug}** (${pct(l.confidence)}) — ${l.why}`),
    '',
    '## Formats that win',
    ...r.formats_that_win.map((f, i) => `${i + 1}. **${f.format}** — ${f.evidence}${f.replicable_weekly === false ? ' _(not weekly-replicable)_' : ''}`),
    ...(r.formats_that_flop?.length ? ['', '### Formats that flop', ...r.formats_that_flop.map((f) => `- ${f.format} — ${f.evidence}`)] : []),
    '',
    '## Hooks she uses',
    ...r.hooks.map((h) => `- ${h}`),
    '',
    '## Numbers (computed)',
    `- ${s.posts} posts analysed over ${s.span_days} days → **${s.posts_per_week} posts/week** (${s.reels} reels · ${s.photos} photos · ${s.carousels} carousels)`,
    `- Median ❤️ ${s.median_likes.toLocaleString()} · 💬 ${s.median_comments.toLocaleString()} · ▶️ ${s.median_views.toLocaleString()} · **${s.comment_ratio} comments per 100 likes**`,
    `- Posts most on ${s.best_days.join(', ') || '—'} around ${s.best_hours_local.join(', ') || '—'} (her local time)`,
    `- Top hashtags: ${s.top_hashtags.map((h) => `#${h}`).join(' ') || '—'}`,
    `- Audios she reuses: ${s.top_audios.join(' · ') || '—'}`,
    `- Cadence read: ${r.cadence?.note ?? ''}`,
    '',
    '## Audience',
    r.audience,
    '',
    '## Do',
    ...r.do.map((d) => `- ${d}`),
    '',
    "## Don't",
    ...r.dont.map((d) => `- ${d}`),
    '',
    '## Ideas for the next 30 days',
    ...r.ideas_next_30_days.map((x, i) => `${i + 1}. ${x.idea} _(${x.lane} — ${x.why})_`),
    '',
    '## Scout seeds',
    `- Hashtags: ${r.seed_hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`,
    `- Accounts: ${r.similar_creators_note ?? ''} → add with \`/library source add\` and in sourcing/reels-sources.yaml`,
    ...(r.risks?.length ? ['', '## Risks', ...r.risks.map((x) => `- ${x}`)] : []),
    ...(r.gaps?.length ? ['', '## Ask her (gaps in public data)', ...r.gaps.map((x) => `- ${x}`)] : []),
    '',
    STAFF_MARKER,
    '',
    '## Staff additions',
    staffTail || '_(anything Dan/Marissa add here survives refreshes)_',
    '',
  ];
  return md.join('\n');
}

export function keepStaffTail(existing: string): string {
  const i = existing.indexOf(STAFF_MARKER);
  if (i < 0) return '';
  return existing
    .slice(i + STAFF_MARKER.length)
    .replace(/^\s*## Staff additions\s*/i, '')
    .trim();
}

export function renderVoice(name: string, r: Research, s: Stats, tz = 'America/New_York'): string {
  const c = r.caption_style ?? ({} as Research['caption_style']);
  return [
    `# Voice — ${name}`,
    '',
    `> DRAFT written by the bot from her real captions on ${today(tz)}. Dan/Marissa: read it with her posts open, fix anything wrong, delete anything you can't confirm. This file is injected verbatim into every caption prompt.`,
    '',
    '## Who she is in one line',
    r.one_liner,
    '',
    '## How she actually types',
    `- Case: ${c.case ?? '?'}`,
    `- Length: median caption is ${c.median_words ?? s.caption.medianWords} words (${s.caption.medianChars} chars); longest she goes: ~${Math.round(s.caption.medianChars * 2.5)} chars`,
    `- Punctuation: ${c.punctuation ?? '?'}`,
    `- Emoji: ${c.emoji ?? '?'}`,
    `- Slang she uses: ${(c.slang_used ?? []).join(', ') || '—'}`,
    `- Slang she does NOT use: ${(c.slang_avoid ?? []).join(', ') || '—'}`,
    `- Hashtags: ${c.hashtags ?? '?'}`,
    `- CTAs: ${c.cta ?? '?'}`,
    '',
    '## What her captions are usually about',
    r.formats_that_win.map((f) => f.format).join(' · '),
    '',
    '## Things she would never say',
    ...r.dont.map((d) => `- ${d}`),
    '',
    '## Platform differences',
    '- Instagram: (as above)',
    '- TikTok: <fill in — usually shorter>',
    '',
    '## 5 captions of hers that are PERFECT examples of her voice (verbatim)',
    ...(c.perfect_examples ?? []).slice(0, 5).map((x, i) => `${i + 1}. ${x.replace(/\s+/g, ' ').trim()}`),
    '',
    '## 3 captions someone wrote for her that she HATED (so we know the failure mode)',
    '1. ',
    '2. ',
    '3. ',
    '',
  ].join('\n');
}

export function renderSourcing(r: Research, tiktok: string, tz = 'America/New_York'): string {
  const tags = r.seed_hashtags.map((h) => h.replace(/^#/, '').toLowerCase()).filter(Boolean);
  return [
    '# Where the daily reels scout (Apify) looks for videos worth recreating for THIS model.',
    `# Seeded by /model add on ${today(tz)} from her lanes. Keep it tight: 5–10 seed accounts in her exact lane beat 50 hashtags.`,
    '',
    YAML.stringify({
      tiktok: { hashtags: tiktok ? tags.slice(0, 5) : [], seed_accounts: [], min_views: 30000, results_per_query: 20 },
      instagram: { hashtags: tags, seed_accounts: [], min_views: 5000, results_per_query: 20 },
    }),
  ].join('\n');
}

export function renderNotes(name: string, r: Research, tz = 'America/New_York'): string {
  return [
    `# Staff notes — ${name} (private — fed to the persona as background, never quoted to her)`,
    '',
    `- Onboarded: ${today(tz)} via /model add`,
    '- Manager: ',
    '- Goals this quarter: ',
    '- Things to be careful about: ',
    '- Content she is NOT comfortable with: ',
    '',
    '## Ask her (from the research gaps)',
    ...(r.gaps ?? []).map((g) => `- [ ] ${g}`),
    '',
  ].join('\n');
}

