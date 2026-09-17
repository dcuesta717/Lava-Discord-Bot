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

  /** The underlying SDK client (for the tool-use loop). */
  get raw() {
    return this.client;
  }

  get model() {
    return this.defaultModel;
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

/** A tool the agent loop can call. `run` returns text the model sees as the tool result. */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  run: (input: Record<string, unknown>) => Promise<string>;
}

export interface AgentResult {
  text: string;
  toolCalls: { name: string; input: Record<string, unknown>; result: string }[];
}

/**
 * Tool-use loop: keeps calling Claude until it stops asking for tools (or maxTurns). Used by the operator chat.
 * `onToolStart` lets the caller show "on it…" for slow tools.
 */
export async function runAgent(
  claude: Claude,
  history: { role: 'user' | 'assistant'; content: string }[],
  tools: AgentTool[],
  opts: ClaudeOpts & { maxTurns?: number; onToolStart?: (name: string, input: Record<string, unknown>) => Promise<void> } = {},
): Promise<AgentResult> {
  const client = claude.raw;
  const messages: Anthropic.MessageParam[] = history.map((h) => ({ role: h.role, content: h.content }));
  const toolDefs: Anthropic.Tool[] = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as Anthropic.Tool.InputSchema }));
  const calls: AgentResult['toolCalls'] = [];
  let text = '';
  for (let turn = 0; turn < (opts.maxTurns ?? 6); turn++) {
    const res = await client.messages.create({
      model: opts.model ?? claude.model,
      max_tokens: opts.maxTokens ?? 900,
      temperature: opts.temperature ?? 0.5,
      system: opts.system,
      tools: toolDefs,
      messages,
    });
    const textBlocks = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text.trim()).filter(Boolean);
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (textBlocks.length) text = textBlocks.join('\n');
    if (res.stop_reason !== 'tool_use' || !uses.length) break;
    messages.push({ role: 'assistant', content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const tool = tools.find((t) => t.name === u.name);
      const input = (u.input ?? {}) as Record<string, unknown>;
      let out: string;
      try {
        if (opts.onToolStart) await opts.onToolStart(u.name, input);
        out = tool ? await tool.run(input) : `unknown tool ${u.name}`;
      } catch (err) {
        out = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
      calls.push({ name: u.name, input, result: out });
      results.push({ type: 'tool_result', tool_use_id: u.id, content: out.slice(0, 6000) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text, toolCalls: calls };
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
