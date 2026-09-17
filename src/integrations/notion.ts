import { Client } from '@notionhq/client';
import type { Logger } from '../lib/logger.js';

/**
 * Optional mirror. Every method is a no-op when NOTION_TOKEN or the target database id is empty,
 * so the bot runs fine before Notion is wired up. Property names must match docs/notion-schema.md.
 */
export class Notion {
  private client?: Client;
  constructor(token: string, private dbs: Record<string, string>, private log: Logger) {
    if (token) this.client = new Client({ auth: token });
  }

  private enabled(db: string): boolean {
    return Boolean(this.client && this.dbs[db]);
  }

  /** Generic "create a page in database X" with a title + simple properties. */
  async createRow(db: string, title: string, props: Record<string, string | number | boolean | null | undefined>): Promise<string | undefined> {
    if (!this.enabled(db)) return undefined;
    const properties: Record<string, unknown> = { Name: { title: [{ text: { content: title } }] } };
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'number') properties[k] = { number: v };
      else if (typeof v === 'boolean') properties[k] = { checkbox: v };
      else if (/^\d{4}-\d{2}-\d{2}/.test(v)) properties[k] = { date: { start: v } };
      else if (v.startsWith('http')) properties[k] = { url: v };
      else properties[k] = { rich_text: [{ text: { content: v.slice(0, 1900) } }] };
    }
    try {
      const page = await this.client!.pages.create({
        parent: { database_id: this.dbs[db] },
        properties: properties as never,
      });
      return page.id;
    } catch (err) {
      this.log.warn({ err, db }, 'notion createRow failed (non-fatal)');
      return undefined;
    }
  }

  async setSelect(pageId: string | undefined, prop: string, value: string) {
    if (!pageId || !this.client) return;
    try {
      await this.client.pages.update({ page_id: pageId, properties: { [prop]: { select: { name: value } } } as never });
    } catch (err) {
      this.log.warn({ err, pageId, prop }, 'notion setSelect failed (non-fatal)');
    }
  }
}
