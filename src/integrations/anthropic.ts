import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeOpts {
  system?: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

export type ImageInput = { data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' };

export class Claude {
  private client: Anthropic;
  constructor(apiKey: string, private defaultModel: string, private visionModel: string) {
    this.client = new Anthropic({ apiKey });
  }

  /** Plain text completion. */
  async text(prompt: string, opts: ClaudeOpts = {}): Promise<string> {
    const res = await this.client.messages.create({
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  /** Multi-turn chat (persona). `history` is oldest → newest. */
  async chat(history: { role: 'user' | 'assistant'; content: string }[], opts: ClaudeOpts = {}): Promise<string> {
    const res = await this.client.messages.create({
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.8,
      system: opts.system,
      messages: history,
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  /** Vision: one or more base64 images + an instruction. */
  async vision(prompt: string, images: ImageInput[], opts: ClaudeOpts = {}): Promise<string> {
    const res = await this.client.messages.create({
      model: opts.model ?? this.visionModel,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0,
      system: opts.system,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
            })),
            { type: 'text' as const, text: prompt },
          ],
        },
      ],
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  /** Ask for JSON and parse it, tolerating a ```json fence. */
  async json<T>(prompt: string, opts: ClaudeOpts = {}, images?: ImageInput[]): Promise<T> {
    const raw = images?.length ? await this.vision(prompt, images, { temperature: 0, ...opts }) : await this.text(prompt, { temperature: 0, ...opts });
    return parseJson<T>(raw);
  }
}

export function parseJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf('{') >= 0 ? body.indexOf('{') : body.indexOf('[');
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  return JSON.parse(body.slice(start, end + 1)) as T;
}

export async function fetchImageAsBase64(url: string): Promise<ImageInput> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const ct = (res.headers.get('content-type') ?? 'image/png').split(';')[0] as ImageInput['mediaType'];
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString('base64'), mediaType: ct };
}
