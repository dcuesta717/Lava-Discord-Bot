import { google, type drive_v3 } from 'googleapis';
import type { Logger } from '../lib/logger.js';

/**
 * Google Drive via a service account. Share the "Lava Content" shared drive (or each model's folder)
 * with the service-account email. Used by the requests module (new-upload detection) and posting
 * (Ready-to-Post folder → media URL).
 */
export class Drive {
  private api?: drive_v3.Drive;
  constructor(serviceAccountB64: string, private log: Logger) {
    if (!serviceAccountB64) return;
    const creds = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive'] });
    this.api = google.drive({ version: 'v3', auth });
  }

  get enabled() {
    return Boolean(this.api);
  }

  /** Files in a folder modified after `sinceIso` (newest first). */
  async newFiles(folderId: string, sinceIso: string): Promise<{ id: string; name: string; mimeType: string; modifiedTime: string; webViewLink?: string }[]> {
    if (!this.api) return [];
    const res = await this.api.files.list({
      q: `'${folderId}' in parents and trashed = false and modifiedTime > '${sinceIso}'`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      modifiedTime: f.modifiedTime!,
      webViewLink: f.webViewLink ?? undefined,
    }));
  }

  /** Create a subfolder (for a content request) and return its id + link. */
  async createFolder(parentId: string, name: string): Promise<{ id: string; url: string }> {
    if (!this.api) throw new Error('Drive not configured');
    const res = await this.api.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    });
    return { id: res.data.id!, url: res.data.webViewLink ?? `https://drive.google.com/drive/folders/${res.data.id}` };
  }

  /** Direct-download URL usable by Zernio's uploader (file must be readable by the service account). */
  async downloadUrl(fileId: string): Promise<string> {
    if (!this.api) throw new Error('Drive not configured');
    // Files shared with "anyone with the link" can be fetched at this URL without auth.
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  /** Rename (the ✅ / 1-5 workflow) */
  async rename(fileId: string, name: string) {
    if (!this.api) return;
    await this.api.files.update({ fileId, requestBody: { name }, supportsAllDrives: true });
  }
}
