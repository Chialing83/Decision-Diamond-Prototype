/**
 * Frontend AI client.
 *
 * Speaks the Anthropic Messages API protocol. Talks to either:
 *   1. The in-process stub backend (default) — Claude-shape SSE.
 *   2. A real HTTPS endpoint (e.g. AWS Lambda Function URL) when
 *      VITE_AI_API_URL is set.
 *
 * Either way it yields the same StreamEvent objects, so the editor's
 * code path is identical for stub vs production.
 *
 * Model and headers default to what we recommended in the architecture
 * review — Sonnet 4.5 with prompt caching enabled by default on the
 * static system block (handled in aiSystemPrompt.ts).
 */

import { AI_SYSTEM_BLOCKS } from './aiSystemPrompt';
import { AI_TOOLS } from './aiTools';
import { stubStreamChat } from './aiStubBackend';
import type {
  ChatRequest,
  ChatTurn,
  MessageParam,
  StreamEvent,
  ToolUseBlock,
} from './aiTypes';

// -------------------------------------------------------------------
// Config
// -------------------------------------------------------------------

const ENDPOINT = (import.meta.env.VITE_AI_API_URL as string | undefined) ?? '';
const USE_STUB = ENDPOINT === '' || ENDPOINT === 'stub';

/**
 * Recommended model. User chose Sonnet 4.5 in the architecture review.
 * `claude-sonnet-4-6` is the newer-gen alternative if you want to upgrade.
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5';

const MAX_TOKENS_PER_TURN = 1024;

// -------------------------------------------------------------------
// Public surface
// -------------------------------------------------------------------

export interface ChatOptions {
  /** Conversation history. First message must be role: "user". */
  messages: MessageParam[];
  /** Override the default model (e.g. "claude-sonnet-4-6"). */
  model?: string;
  /** Abort signal — cancels the stream and the underlying fetch. */
  signal?: AbortSignal;
}

/**
 * Streaming variant. Yields Anthropic-shape SSE events. The caller is
 * responsible for accumulating text deltas / tool_use blocks. Use this
 * when you want to render the assistant's text token-by-token into the
 * chat bubble.
 */
export async function* streamChat(opts: ChatOptions): AsyncGenerator<StreamEvent> {
  const req: ChatRequest = {
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: MAX_TOKENS_PER_TURN,
    system: AI_SYSTEM_BLOCKS,
    messages: opts.messages,
    tools: AI_TOOLS,
    stream: true,
  };

  if (USE_STUB) {
    // Yield directly from the in-process stub. AbortSignal handling — if
    // the caller aborts, the for-await loop in the editor stops pulling
    // and the generator gets garbage-collected.
    for await (const event of stubStreamChat(req)) {
      if (opts.signal?.aborted) return;
      yield event;
    }
    return;
  }

  // Real backend — POST and parse SSE.
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal: opts.signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI backend returned ${response.status}: ${body}`);
  }

  for await (const event of parseSSEStream(response.body)) {
    yield event;
  }
}

/**
 * Convenience: drain the stream and return the final turn as a single
 * structured object. Use this when you don't care about token-by-token
 * rendering and just want the result.
 */
export async function chat(opts: ChatOptions): Promise<ChatTurn> {
  let text = '';
  const toolUses: ToolUseBlock[] = [];
  let stop_reason: ChatTurn['stop_reason'] = 'end_turn';
  let outputTokens = 0;
  let inputTokens = 0;
  let cacheRead = 0;
  let cacheCreation = 0;

  // Track tool_use blocks being assembled across deltas
  const partialToolInputs = new Map<number, { id: string; name: string; json: string }>();

  for await (const event of streamChat(opts)) {
    switch (event.type) {
      case 'message_start':
        inputTokens = event.message.usage.input_tokens;
        cacheRead = event.message.usage.cache_read_input_tokens ?? 0;
        cacheCreation = event.message.usage.cache_creation_input_tokens ?? 0;
        break;
      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          partialToolInputs.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            json: '',
          });
        }
        break;
      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          text += event.delta.text;
        } else if (event.delta.type === 'input_json_delta') {
          const partial = partialToolInputs.get(event.index);
          if (partial) partial.json += event.delta.partial_json;
        }
        break;
      case 'content_block_stop': {
        const partial = partialToolInputs.get(event.index);
        if (partial) {
          let input: Record<string, unknown> = {};
          try {
            input = partial.json ? JSON.parse(partial.json) : {};
          } catch {
            // Malformed tool input — surface as is_error on the next turn.
            input = { __parse_error: partial.json };
          }
          toolUses.push({ type: 'tool_use', id: partial.id, name: partial.name, input });
          partialToolInputs.delete(event.index);
        }
        break;
      }
      case 'message_delta':
        stop_reason = event.delta.stop_reason;
        outputTokens = event.usage.output_tokens;
        break;
      case 'message_stop':
        break;
      case 'error':
        throw new Error(`AI stream error: ${event.error.type} — ${event.error.message}`);
    }
  }

  return {
    text,
    toolUses,
    stop_reason,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: cacheRead,
      cache_creation_input_tokens: cacheCreation,
    },
  };
}

// -------------------------------------------------------------------
// SSE parser (for real backend responses)
// -------------------------------------------------------------------

/**
 * Parse an Anthropic-flavoured SSE stream. Events come in the shape:
 *
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,...}
 *
 *   (blank line)
 *
 * Yields the parsed JSON for each event.
 */
async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events end with a blank line ("\n\n").
    let sepIdx: number;
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);

      // Each event is a sequence of lines; we only care about `data:`.
      let data = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('data:')) {
          data += line.slice(5).trimStart();
        }
      }
      if (!data) continue;
      try {
        yield JSON.parse(data) as StreamEvent;
      } catch (err) {
        // Skip malformed events — log so we can debug if it happens in prod.
        // eslint-disable-next-line no-console
        console.warn('Failed to parse SSE event:', data, err);
      }
    }
  }
}

// -------------------------------------------------------------------
// Diagnostics
// -------------------------------------------------------------------

export const AI_TRANSPORT = USE_STUB ? 'stub' : `http(${ENDPOINT})`;
