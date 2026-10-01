/**
 * In-process Claude-shape stub backend.
 *
 * Produces real Anthropic SSE event sequences (message_start →
 * content_block_start → content_block_delta → content_block_stop →
 * message_delta → message_stop) so the frontend client can be developed
 * against the exact wire format. Swap this for a real backend call by
 * setting VITE_AI_API_URL and the rest of the app needs no changes.
 *
 * The "brain" is a regex/keyword interpreter that maps user prompts to
 * tool_use blocks. It's deliberately less smart than real Claude — that's
 * the point. When you flip the switch to Lambda + real Sonnet, you trade
 * up to actual reasoning while keeping the same protocol.
 */

import { AI_TOOLS, FIELD_ENUM, OPERATOR_ENUM, STAGE_ENUM } from './aiTools';
import type {
  ChatRequest,
  MessageStartEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockStopEvent,
  MessageDeltaEvent,
  MessageStopEvent,
  StreamEvent,
  StopReason,
  ToolUseBlock,
} from './aiTypes';

// -------------------------------------------------------------------
// Intent → tool_use planning
// -------------------------------------------------------------------

type Plan = {
  /** Narration text the assistant streams to the user. */
  text: string;
  /** Tool calls the assistant emits (executed by the frontend). */
  toolUses: ToolUseBlock[];
  /** stop_reason — "tool_use" if any tools emitted, otherwise "end_turn". */
  stop_reason: StopReason;
};

let toolUseCounter = 0;
function nextToolUseId() {
  return `toolu_stub_${Date.now().toString(36)}_${(++toolUseCounter).toString(36)}`;
}

function lastUserText(req: ChatRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const m = req.messages[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    // user content may contain text and tool_result blocks
    for (const block of m.content as { type: string; text?: string }[]) {
      if (block.type === 'text' && typeof block.text === 'string') {
        return block.text;
      }
    }
  }
  return '';
}

/**
 * Extract a 0-indexed sequence reference from free text.
 * Returns -1 if not found, or 'all' for "every sequence" / "all branches".
 */
function parseSequenceRef(text: string): number | 'all' | null {
  const lower = text.toLowerCase();
  if (/\b(all|every|each)\s+(sequence|branch|path|track)s?\b/.test(lower)) return 'all';
  const m = lower.match(/(sequence|branch|path|track)\s+(\d+)/);
  if (m) return parseInt(m[2], 10) - 1;
  const ord: Record<string, number> = {
    first: 0, '1st': 0, second: 1, '2nd': 1,
    third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4,
  };
  for (const [word, i] of Object.entries(ord)) {
    if (new RegExp(`\\b${word}\\s+(sequence|branch|path|track)\\b`).test(lower)) {
      return i;
    }
  }
  return null;
}

function parseField(text: string): typeof FIELD_ENUM[number] | null {
  const lower = text.toLowerCase();
  if (/\b(deal value|high[- ]value|over\s*\$|above\s*\$|under\s*\$|below\s*\$|value|amount|price)\b/.test(lower)) {
    return 'dealValue';
  }
  if (/\b(deal stage|pipeline stage|stage)\b/.test(lower)) return 'dealStage';
  if (/\b(completion|closed|close date|won on)\b/.test(lower)) return 'dealCompletionTime';
  if (/\b(expir(ation|ing|es?))\b/.test(lower)) return 'dealExpirationTime';
  // bare stage names imply dealStage
  for (const stage of STAGE_ENUM) {
    if (lower.includes(stage.toLowerCase())) return 'dealStage';
  }
  return null;
}

function parseOperator(text: string): typeof OPERATOR_ENUM[number] | null {
  const lower = text.toLowerCase();
  if (/\b(exceeds?|greater than|more than|above|over|>)\b/.test(lower)) return 'exceeds';
  if (/\b(less than|under|below|<)\b/.test(lower)) return 'lessThan';
  if (/\b(between|range|from .* to)\b/.test(lower)) return 'between';
  if (/\b(equals?|is|=|matches?)\b/.test(lower)) return 'equals';
  return null;
}

function parseCurrencyValue(text: string): string | null {
  const m = text.match(/\$?\s*([0-9][0-9,]*)\s*(k|K)?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (m[2]) n *= 1000;
  if (Number.isNaN(n) || n === 0) return null;
  return String(n);
}

function parseStageValue(text: string): string | null {
  const lower = text.toLowerCase();
  for (const stage of STAGE_ENUM) {
    if (lower.includes(stage.toLowerCase())) return stage;
  }
  return null;
}

/**
 * Turn the user's last message into a structured plan.
 *
 * Real Claude would do this with reasoning. The stub does it with regex —
 * but the OUTPUT shape is identical so the frontend can't tell.
 */
function planFromUserMessage(text: string): Plan {
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      text: "I didn't catch that — what would you like to change?",
      toolUses: [],
      stop_reason: 'end_turn',
    };
  }

  // Affirmative / negative — handled by the editor as confirmation flow
  if (/^(yes|yep|yeah|y|do it|confirm|sure|ok(ay)?|please|go ahead)\b/.test(lower)) {
    return {
      text: 'Got it.',
      toolUses: [],
      stop_reason: 'end_turn',
    };
  }
  if (/^(no|nope|nah|cancel|stop|don'?t|never mind|nm)\b/.test(lower)) {
    return {
      text: 'OK, leaving things as they are.',
      toolUses: [],
      stop_reason: 'end_turn',
    };
  }

  // Help / explain
  if (/^(help|how do|what can)\b/.test(lower)) {
    return {
      text:
        'I can add or remove sequences, add conditions ("deal value over $5,000 to sequence 1"), mirror rules across sequences, change default routing, or summarize what\'s set up.',
      toolUses: [],
      stop_reason: 'end_turn',
    };
  }

  if (/\b(explain|describe|summari[sz]e|what'?s in|tell me about|what does this do|what'?s set up)\b/.test(lower)) {
    const seqRef = parseSequenceRef(text);
    const input: Record<string, unknown> = {};
    if (typeof seqRef === 'number') input.sequence_index = seqRef;
    return {
      text: 'Let me read the current setup for you.',
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'explain_current_rules', input },
      ],
      stop_reason: 'tool_use',
    };
  }

  if (/\b(list|what|which)\b.*\b(field|operator|attribute)s?\b/.test(lower)) {
    return {
      text: 'Here are the fields and operators you can build rules from.',
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'list_available_fields', input: {} },
      ],
      stop_reason: 'tool_use',
    };
  }

  // Add a new sequence / rule set. The "rules?" form tolerates plural
  // typos ("rules set" / "new rules set"). The second branch only fires
  // when "new"/"another"/"additional"/"more" qualifies the noun — that
  // way "add a NEW sequence" matches but "add X TO sequence 1" doesn't
  // get misclassified as creating a brand new sequence.
  const isRuleSetRequest =
    /\b(rules?\s?set|rulesets?|rules? group|sets? of rules?)\b/.test(lower) ||
    (/\b(new|another|additional|more|fresh)\s+(sequence|branch|path|track)\b/.test(lower) &&
      !/\b(condition|rules?)\b/.test(lower));

  if (isRuleSetRequest) {
    return {
      text: "Adding a new sequence — tell me which condition to put on it.",
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'add_sequence', input: {} },
      ],
      stop_reason: 'tool_use',
    };
  }

  const seqRef = parseSequenceRef(text);

  // Delete / clear
  if (typeof seqRef === 'number' && /\b(delete|remove|drop)\b.+\b(sequence|branch|path)\b/.test(lower) && !/\b(condition|rules?)\b/.test(lower)) {
    return {
      text: `If Sequence ${seqRef + 1} has rules I'll need you to confirm — reply "yes" to delete or pick a different sequence.`,
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'delete_sequence', input: { sequence_index: seqRef } },
      ],
      stop_reason: 'tool_use',
    };
  }

  if (typeof seqRef === 'number' && /\b(clear|empty|reset|wipe)\b/.test(lower)) {
    return {
      text: `Clearing Sequence ${seqRef + 1}.`,
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'clear_sequence', input: { sequence_index: seqRef } },
      ],
      stop_reason: 'tool_use',
    };
  }

  // Mirror
  if (/\b(mirror|copy|apply)\b.+\b(other|all|every|both)\b/.test(lower)) {
    const src = typeof seqRef === 'number' ? seqRef : 0;
    return {
      text: 'Reply "yes" to mirror that condition to the other sequences, or name the target sequence.',
      toolUses: [],
      stop_reason: 'end_turn',
    };
  }

  // Routing
  if (/\b(default|route|fallback|else|otherwise)\b/.test(lower)) {
    if (/\b(drop|nothing|nowhere|discard)\b/.test(lower)) {
      return {
        text: 'Setting default routing to drop.',
        toolUses: [
          { type: 'tool_use', id: nextToolUseId(), name: 'set_default_routing', input: { target: 'drop' } },
        ],
        stop_reason: 'tool_use',
      };
    }
    if (typeof seqRef === 'number') {
      return {
        text: `Setting default routing to Sequence ${seqRef + 1}.`,
        toolUses: [
          { type: 'tool_use', id: nextToolUseId(), name: 'set_default_routing', input: { target: String(seqRef) } },
        ],
        stop_reason: 'tool_use',
      };
    }
  }

  // Remove a condition
  if (/\b(remove|delete|drop)\b/.test(lower) && (parseField(text) || /\b(condition|rules?)\b/.test(lower))) {
    const input: Record<string, unknown> = {};
    if (typeof seqRef === 'number') input.sequence_index = seqRef;
    const field = parseField(text);
    if (field) input.field = field;
    return {
      text: `Removing that condition${typeof seqRef === 'number' ? ` from Sequence ${seqRef + 1}` : ''}.`,
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'remove_condition', input },
      ],
      stop_reason: 'tool_use',
    };
  }

  // Add a condition (field-bearing OR field-less)
  const field = parseField(text);
  const operator = parseOperator(text);
  const verbHit = /\b(add|set|use|apply|change|update|make|create|build|route|i (?:want|need|'?d like))\b/.test(lower);
  // `rules?` tolerates plural typos ("a new rules", "another rules").
  const singleRuleHit = /\b(new rules?|another rules?|a rules?|one more rules?)\b/.test(lower);

  if (field || singleRuleHit || (verbHit && /\b(condition|rules?)\b/.test(lower))) {
    const input: Record<string, unknown> = {};
    if (seqRef === 'all') input.all_sequences = true;
    else if (typeof seqRef === 'number') input.sequence_index = seqRef;
    if (field) input.field = field;
    if (operator) input.operator = operator;

    if (field === 'dealValue') {
      const v = parseCurrencyValue(text);
      if (v) input.values = [v];
    } else if (field === 'dealStage') {
      const v = parseStageValue(text);
      if (v) input.values = [v];
    }

    const opPhrase = field
      ? operator
        ? ` ${operator}`
        : ''
      : '';
    const valuePhrase = (input.values as string[] | undefined)?.length
      ? ` ${(input.values as string[]).join('–')}`
      : '';
    const wherePhrase = seqRef === 'all'
      ? ' to every sequence'
      : typeof seqRef === 'number'
        ? ` to Sequence ${seqRef + 1}`
        : '';

    return {
      text: field
        ? `Adding ${field}${opPhrase}${valuePhrase}${wherePhrase}.`
        : `Opening a new condition row${wherePhrase}. Pick a field — try "deal value", "deal stage", or a date field.`,
      toolUses: [
        { type: 'tool_use', id: nextToolUseId(), name: 'add_condition', input },
      ],
      stop_reason: 'tool_use',
    };
  }

  // Fallback
  return {
    text:
      "I'm not sure what to do with that yet. Try \"add deal value over $5,000 to sequence 1\", \"clear sequence 2\", \"explain my rules\", or \"add a new rule set\".",
    toolUses: [],
    stop_reason: 'end_turn',
  };
}

// -------------------------------------------------------------------
// Streaming — replay the plan as Anthropic-shape SSE events
// -------------------------------------------------------------------

const STUB_MESSAGE_ID = () => `msg_stub_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Convert a plan into a real Anthropic SSE event sequence. The frontend
 * client iterates this generator with the same code that would consume
 * the production Lambda's stream.
 *
 * Real Claude sends `text_delta` events word-by-word. We chunk by ~3-char
 * groups with small async gaps so the chat bubble feels typed — same UX
 * as the real thing.
 */
export async function* stubStreamChat(req: ChatRequest): AsyncGenerator<StreamEvent> {
  const userText = lastUserText(req);
  const plan = planFromUserMessage(userText);

  const messageId = STUB_MESSAGE_ID();

  // 1. message_start — the empty assistant message envelope
  const start: MessageStartEvent = {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      model: req.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: estimateInputTokens(req),
        output_tokens: 1,
        // Pretend we cached the system prompt — this is what real Claude
        // would report on a warm cache.
        cache_read_input_tokens: Math.max(0, estimateInputTokens(req) - 200),
        cache_creation_input_tokens: 0,
      },
    },
  };
  yield start;

  // 2. Text content block
  if (plan.text) {
    const startBlock: ContentBlockStartEvent = {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    };
    yield startBlock;

    // Chunk the narration into small pieces with realistic latency
    const CHUNK = 4;
    const chunks: string[] = [];
    for (let i = 0; i < plan.text.length; i += CHUNK) {
      chunks.push(plan.text.slice(i, i + CHUNK));
    }
    for (const chunk of chunks) {
      await sleep(18 + Math.random() * 22); // 18–40ms per chunk → smooth typing
      const delta: ContentBlockDeltaEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: chunk },
      };
      yield delta;
    }

    const stop0: ContentBlockStopEvent = { type: 'content_block_stop', index: 0 };
    yield stop0;
  }

  // 3. One tool_use block per planned tool call. Anthropic streams the
  // input as input_json_delta chunks; we emit the full JSON as a single
  // chunk for simplicity (parsers handle that fine — partial_json is
  // concatenated before json.parse on close).
  let blockIndex = plan.text ? 1 : 0;
  for (const tu of plan.toolUses) {
    const startTool: ContentBlockStartEvent = {
      type: 'content_block_start',
      index: blockIndex,
      content_block: {
        type: 'tool_use',
        id: tu.id,
        name: tu.name,
        input: {},
      },
    };
    yield startTool;

    await sleep(50);
    const inputDelta: ContentBlockDeltaEvent = {
      type: 'content_block_delta',
      index: blockIndex,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify(tu.input) },
    };
    yield inputDelta;

    const stopTool: ContentBlockStopEvent = { type: 'content_block_stop', index: blockIndex };
    yield stopTool;

    blockIndex += 1;
  }

  // 4. message_delta with stop_reason + usage
  const messageDelta: MessageDeltaEvent = {
    type: 'message_delta',
    delta: { stop_reason: plan.stop_reason, stop_sequence: null },
    usage: { output_tokens: Math.ceil(plan.text.length / 4) + plan.toolUses.length * 20 },
  };
  yield messageDelta;

  // 5. message_stop — terminal event
  const stop: MessageStopEvent = { type: 'message_stop' };
  yield stop;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function estimateInputTokens(req: ChatRequest): number {
  // Rough heuristic — system + tools + each message ÷ 4 chars/token.
  let chars = 0;
  for (const sys of req.system) chars += sys.text.length;
  for (const t of req.tools) chars += t.name.length + t.description.length + 200;
  for (const m of req.messages) {
    if (typeof m.content === 'string') chars += m.content.length;
    else for (const b of m.content as { text?: string }[]) chars += (b.text ?? '').length;
  }
  return Math.ceil(chars / 4);
}

// Suppress unused-import warning — AI_TOOLS is re-exported to ensure the
// stub stays in sync with the canonical tool list.
void AI_TOOLS;
