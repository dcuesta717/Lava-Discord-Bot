import { ApifyClient } from 'apify-client';

/**
 * Reels sourcing via Apify actors. The two default actors are the most-used public ones;
 * swap ids in .env if you buy a different one. Output field names differ per actor, so `normalize()`
 * maps whatever comes back onto one shape — extend the field lists there, not the callers.
 */
export interface ReelCandidate {
  url: string;
  platform: 'tiktok' | 'instagram';
  author: string;
  caption: string;
  views: number;
  likes: number;
  comments?: number;
  shortcode?: string;
  durationSec?: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  postedAt?: string;
}

export interface SourcingConfig {
  tiktok?: { hashtags?: string[]; seed_accounts?: string[]; min_views?: number; results_per_query?: number };
  instagram?: { hashtags?: string[]; seed_accounts?: string[]; min_views?: number; results_per_query?: number };
}

export class Apify {
  private client?: ApifyClient;
  constructor(token: string, private tiktokActor: string, private instagramActor: string) {
    if (token) this.client = new ApifyClient({ token });
  }

  get enabled() {
    return Boolean(this.client);
  }

  async tiktok(cfg: NonNullable<SourcingConfig['tiktok']>): Promise<ReelCandidate[]> {
    if (!this.client) return [];
    const n = cfg.results_per_query ?? 20;
    // Input keys follow clockworks/tiktok-scraper. ⚠ ASSUMED for other actors — check the actor's input schema.
    const run = await this.client.actor(this.tiktokActor).call({
      hashtags: cfg.hashtags ?? [],
      profiles: cfg.seed_accounts ?? [],
      resultsPerPage: n,
      shouldDownloadVideos: false,
      shouldDownloadCovers: true,
    });
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    return items.map((it) => normalize(it as Record<string, unknown>, 'tiktok')).filter((c) => c.views >= (cfg.min_views ?? 0));
  }

  async instagram(cfg: NonNullable<SourcingConfig['instagram']>): Promise<ReelCandidate[]> {
    if (!this.client) return [];
    const n = cfg.results_per_query ?? 20;
    const directUrls = [
      ...(cfg.hashtags ?? []).map((h) => `https://www.instagram.com/explore/tags/${h.replace('#', '')}/`),
      ...(cfg.seed_accounts ?? []).map((a) => `https://www.instagram.com/${a.replace('@', '')}/reels/`),
    ];
    // Input keys follow apify/instagram-scraper. ⚠ ASSUMED for other actors.
    const run = await this.client.actor(this.instagramActor).call({
      directUrls,
      resultsType: 'posts',
      resultsLimit: n,
      onlyPostsNewerThan: '14 days',
    });
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    return items
      .map((it) => normalize(it as Record<string, unknown>, 'instagram'))
      .filter((c) => c.url && c.views >= (cfg.min_views ?? 0));
  }

  /** Recent reels from one IG profile or hashtag page (Content Library scout). `newerThan` e.g. "7 days". */
  async instagramPage(kind: 'account' | 'hashtag', value: string, limit: number, newerThan = '7 days'): Promise<ReelCandidate[]> {
    if (!this.client) return [];
    const v = value.replace(/^[@#]/, '');
    const url = kind === 'account' ? `https://www.instagram.com/${v}/reels/` : `https://www.instagram.com/explore/tags/${v}/`;
    const run = await this.client.actor(this.instagramActor).call({ directUrls: [url], resultsType: 'posts', resultsLimit: limit, onlyPostsNewerThan: newerThan });
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    return items.map((it) => normalize(it as Record<string, unknown>, 'instagram')).filter((c) => c.url && c.videoUrl);
  }

  /** Fetch specific posts by URL (inbox drops). Instagram and TikTok links can be mixed. */
  async byUrls(urls: string[]): Promise<ReelCandidate[]> {
    if (!this.client || !urls.length) return [];
    const ig = urls.filter((u) => /instagram\.com/.test(u));
    const tt = urls.filter((u) => /tiktok\.com/.test(u));
    const out: ReelCandidate[] = [];
    if (ig.length) {
      const run = await this.client.actor(this.instagramActor).call({ directUrls: ig, resultsType: 'posts', resultsLimit: ig.length });
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      out.push(...items.map((it) => normalize(it as Record<string, unknown>, 'instagram')));
    }
    if (tt.length) {
      // clockworks/tiktok-scraper: postURLs. ⚠ ASSUMED for other actors.
      const run = await this.client.actor(this.tiktokActor).call({ postURLs: tt, shouldDownloadVideos: false, shouldDownloadCovers: true });
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      out.push(...items.map((it) => normalize(it as Record<string, unknown>, 'tiktok')));
    }
    return out.filter((c) => c.url);
  }
}

/** Canonical form for dedupe: no query string, no trailing slash, https, no "www.". */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    u.hostname = u.hostname.replace(/^www\./, '');
    u.protocol = 'https:';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Map actor-specific field names → ReelCandidate. Add aliases here as you meet new actors. */
export function normalize(it: Record<string, unknown>, platform: 'tiktok' | 'instagram'): ReelCandidate {
  const author = (it.authorMeta as Record<string, unknown> | undefined) ?? {};
  return {
    url: str(it.webVideoUrl) || str(it.url) || str(it.postUrl),
    platform,
    author: str(author.name) || str(it.ownerUsername) || str(it.author),
    caption: str(it.text) || str(it.caption) || str(it.desc),
    views: num(it.playCount) || num(it.videoPlayCount) || num(it.videoViewCount) || num(it.views),
    likes: num(it.diggCount) || num(it.likesCount) || num(it.likes),
    comments: num(it.commentCount) || num(it.commentsCount) || num(it.comments) || undefined,
    shortcode: str(it.shortCode) || str(it.id) || undefined,
    durationSec: num((it.videoMeta as Record<string, unknown> | undefined)?.duration) || num(it.videoDuration) || undefined,
    thumbnailUrl: str((it.videoMeta as Record<string, unknown> | undefined)?.coverUrl) || str(it.displayUrl) || str(it.coverUrl) || undefined,
    videoUrl: str(it.videoUrl) || str((it.videoMeta as Record<string, unknown> | undefined)?.downloadAddr) || undefined,
    postedAt: str(it.createTimeISO) || str(it.timestamp) || undefined,
  };
}
