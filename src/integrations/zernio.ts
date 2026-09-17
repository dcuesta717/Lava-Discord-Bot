/**
 * Zernio — one REST API for ~16 networks. Verified against https://docs.zernio.com (Sept 2026):
 *   base:  https://zernio.com/api/v1
 *   auth:  Authorization: Bearer sk_...
 *   GET  /accounts                 → { accounts: [{ _id, platform, username, isActive }] }
 *   POST /media/presign            → { uploadUrl, publicUrl }   (PUT bytes to uploadUrl, then reference publicUrl)
 *   POST /posts                    → { id }
 *      { content, mediaItems:[{url,type}], platforms:[{platform, accountId, platformSpecificData?}],
 *        scheduledFor?: "2027-01-01T12:00:00", timezone?: "America/New_York", publishNow?: boolean }
 * Instagram reel: mediaItems type "video", 9:16, ≤90 s, ≤300 MB; platformSpecificData.shareToFeed etc.
 */
const BASE = 'https://zernio.com/api/v1';

export interface ZernioAccount {
  _id: string;
  platform: string;
  username: string;
  isActive: boolean;
}

export interface ZernioPlatformTarget {
  platform: string;
  accountId: string;
  platformSpecificData?: Record<string, unknown>;
}

export interface ZernioCreatePost {
  content: string;
  mediaItems?: { url: string; type: 'image' | 'video' | 'gif' | 'document' }[];
  platforms: ZernioPlatformTarget[];
  scheduledFor?: string; // local wall-clock ISO without offset, interpreted in `timezone`
  timezone?: string;
  publishNow?: boolean;
}

export class Zernio {
  constructor(private apiKey: string) {}

  get enabled() {
    return Boolean(this.apiKey);
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Zernio ${method} ${path} → ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  accounts() {
    return this.req<{ accounts: ZernioAccount[] }>('GET', '/accounts');
  }

  /** Upload a file from a public URL (e.g. Drive export link) into Zernio's media store and return the public media URL. */
  async uploadFromUrl(sourceUrl: string, filename: string, contentType: string): Promise<string> {
    const src = await fetch(sourceUrl);
    if (!src.ok) throw new Error(`media source fetch failed: ${src.status}`);
    const bytes = Buffer.from(await src.arrayBuffer());
    const presign = await this.req<{ uploadUrl: string; publicUrl: string }>('POST', '/media/presign', {
      filename,
      contentType,
      size: bytes.byteLength,
    });
    const put = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
    if (!put.ok) throw new Error(`media upload failed: ${put.status}`);
    return presign.publicUrl;
  }

  createPost(post: ZernioCreatePost) {
    return this.req<{ id: string }>('POST', '/posts', post);
  }
}
