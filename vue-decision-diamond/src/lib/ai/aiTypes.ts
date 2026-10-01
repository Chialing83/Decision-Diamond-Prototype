/**
 * Anthropic Messages API wire format — typed.
 *
 * These types mirror the official @anthropic-ai/sdk shapes so the stub
 * backend, the real Lambda backend, and a future direct-SDK integration
 * all speak the same protocol. Swap one transport for another by changing
 * `VITE_AI_API_URL` — nothing in the editor changes.
 *
 * If/when we install `@anthropic-ai/sdk` we can re-export Anthropic.* types
 * from here verbatim and keep call sites unchanged.
 */

// -------------------------------------------------------------------
// Tool definitions (what we send TO the model)
// -------------------------------------------------------------------

export type JsonSchemaType =
  | 'object'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'null';

export interface JsonSchema {
  type: JsonSchemaType;
  description?: string;
  enum?: (string | number)[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

// -------------------------------------------------------------------
// Content blocks (assistant response payload)
// -------------------------------------------------------------------

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlockParam {
  type: 'tool_result';
  tool_use_id: string;
  content: string | TextBlock[];
  is_error?: boolean;
}

export type AssistantContentBlock = TextBlock | ToolUseBlock;
export type UserContentBlock = TextBlock | ToolResultBlockParam;

// -------------------------------------------------------------------
// Messages
// -------------------------------------------------------------------

export type Role = 'user' | 'assistant';

export interface MessageParam {
  role: Role;
  content: string | UserContentBlock[] | AssistantContentBlock[];
}

// -------------------------------------------------------------------
// System prompt with cache control
// -------------------------------------------------------------------

export interface CacheControlEphemeral {
  type: 'ephemeral';
  ttl?: '5m' | '1h';
}

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControlEphemeral;
}

// -------------------------------------------------------------------
// Request envelope (what the frontend POSTs to the backend)
// -------------------------------------------------------------------

export interface ChatRequest {
  model: string;
  max_tokens: number;
  system: SystemBlock[];
  messages: MessageParam[];
  tools: ToolDefinition[];
  stream?: boolean;
}

// -------------------------------------------------------------------
// Non-streaming response (what the backend returns when stream=false)
// -------------------------------------------------------------------

export type StopReason =
  | 'end_turn'
  | 'tool_use'
  | 'max_tokens'
  | 'stop_sequence'
  | 'pause_turn'
  | 'refusal';

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ChatResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AssistantContentBlock[];
  stop_reason: StopReason;
  stop_sequence: string | null;
  usage: Usage;
}

// -------------------------------------------------------------------
// Streaming SSE events (exact Anthropic shape)
// -------------------------------------------------------------------

export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

export interface MessageStartEvent {
  type: 'message_start';
  message: Omit<ChatResponse, 'content' | 'stop_reason' | 'stop_sequence'> & {
    content: [];
    stop_reason: null;
    stop_sequence: null;
  };
}

export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block:
    | { type: 'text'; text: '' }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta:
    | { type: 'text_delta'; text: string }
    | { type: 'input_json_delta'; partial_json: string };
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: { stop_reason: StopReason; stop_sequence: string | null };
  usage: Pick<Usage, 'output_tokens'>;
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export interface PingEvent {
  type: 'ping';
}

export interface ErrorEvent {
  type: 'error';
  error: { type: string; message: string };
}

// -------------------------------------------------------------------
// Convenience: a single parsed turn (after stream is fully consumed)
// -------------------------------------------------------------------

export interface ChatTurn {
  text: string;
  toolUses: ToolUseBlock[];
  stop_reason: StopReason;
  usage: Usage;
}
