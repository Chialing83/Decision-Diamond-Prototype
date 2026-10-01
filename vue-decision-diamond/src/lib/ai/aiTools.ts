/**
 * Tool definitions for the Decision Diamond AI assistant.
 *
 * These are pure declarations — the actual mutators live in
 * DecisionDiamondEditor.vue (they need access to props.config and emit).
 * The editor wires up a dispatcher that maps tool calls to its existing
 * mutation helpers (addSequence, addCondition, etc.).
 *
 * Schemas use the exact Anthropic JSON Schema shape so the same tool list
 * works against the stub backend, the Lambda backend, and a direct Claude
 * SDK call. Enums are kept aligned with the editor's SIMPLE_FIELDS /
 * SIMPLE_OPERATORS / STAGE_ENUM constants — one source of truth.
 */

import type { ToolDefinition } from './aiTypes';

// Keep these in sync with DecisionDiamondEditor.vue (single source of truth).
export const FIELD_ENUM = [
  'dealValue',
  'dealStage',
  'dealCompletionTime',
  'dealExpirationTime',
] as const;

export const OPERATOR_ENUM = [
  'equals',
  'exceeds',
  'lessThan',
  'between',
] as const;

export const STAGE_ENUM = [
  'New',
  'Qualified',
  'Estimate Sent',
  'Scheduled',
  'Won',
  'Lost',
] as const;

// -------------------------------------------------------------------
// Tool definitions
// -------------------------------------------------------------------

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'add_sequence',
    description:
      'Add a new empty sequence (branch) to the decision diamond. A sequence is one routing path with its own AND/OR rule set. Returns the index of the newly-created sequence. Use this when the user asks for "a new rule set", "another branch", "a path for X", etc.',
    input_schema: {
      type: 'object',
      properties: {
        name_hint: {
          type: 'string',
          description:
            'Optional human-readable hint describing what this sequence is for (e.g. "high-value won deals"). Not used as the targetName — that comes from the connected downstream node — but useful for narration.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_sequence',
    description:
      'Remove an entire sequence card and any rules attached to it. The decision diamond must keep at least one sequence — this tool will refuse if it would remove the last one. Confirm with the user before calling if the sequence has rules.',
    input_schema: {
      type: 'object',
      properties: {
        sequence_index: {
          type: 'integer',
          description: '0-based index of the sequence to delete.',
        },
      },
      required: ['sequence_index'],
      additionalProperties: false,
    },
  },
  {
    name: 'clear_sequence',
    description:
      'Remove all rules from a sequence but keep the sequence card itself. Anything matching at this point in the flow will pass through the now-empty sequence. Confirm with the user before calling if the sequence has rules.',
    input_schema: {
      type: 'object',
      properties: {
        sequence_index: {
          type: 'integer',
          description: '0-based index of the sequence to clear.',
        },
      },
      required: ['sequence_index'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_condition',
    description:
      'Add a single AND-joined condition row to one or more sequences. If the diamond has no sequences yet, one will be created first. The condition is appended to the last existing AND block; pass null/empty `field` to open a blank slot for the user to fill in interactively.',
    input_schema: {
      type: 'object',
      properties: {
        sequence_index: {
          type: 'integer',
          description:
            '0-based index of the target sequence. Omit to target the first sequence with existing rules (or sequence 0 if none have rules yet).',
        },
        all_sequences: {
          type: 'boolean',
          description:
            'If true, add this condition to every sequence. Overrides sequence_index.',
        },
        field: {
          type: 'string',
          enum: [...FIELD_ENUM],
          description:
            'Which deal attribute to check. Omit to open an empty row the user will fill in.',
        },
        operator: {
          type: 'string',
          enum: [...OPERATOR_ENUM],
          description:
            'Comparison operator. Defaults: dealStage→equals, dealValue→exceeds, date fields→between.',
        },
        values: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Comparison values. For dealValue use raw numbers as strings ("5000"). For dealStage use one of: ' +
            STAGE_ENUM.join(', ') +
            '. For between operators pass two values [min, max].',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_condition',
    description:
      'Remove a condition row from a sequence. If a field is named, remove the row using that field; otherwise remove the most recently added condition.',
    input_schema: {
      type: 'object',
      properties: {
        sequence_index: {
          type: 'integer',
          description:
            '0-based index. Omit to target the first sequence that has any conditions.',
        },
        field: {
          type: 'string',
          enum: [...FIELD_ENUM],
          description:
            'If provided, remove the row using this field. Otherwise removes the last condition.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'mirror_condition',
    description:
      'Copy a condition from one sequence to one or more others. Useful when the user says "apply the same rule to the other branches". The model should call this only after the user confirms which target sequences.',
    input_schema: {
      type: 'object',
      properties: {
        source_sequence: {
          type: 'integer',
          description: '0-based index of the sequence to copy from.',
        },
        target_sequences: {
          type: 'array',
          items: { type: 'integer' },
          description: '0-based indexes of sequences to copy the condition to.',
        },
      },
      required: ['source_sequence', 'target_sequences'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_default_routing',
    description:
      'Set what happens to deals that match none of the sequences. "drop" silently discards them; a sequence index routes them to that sequence as a fallback.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description:
            'Either the literal string "drop" or a stringified sequence index like "0".',
        },
      },
      required: ['target'],
      additionalProperties: false,
    },
  },
  {
    name: 'explain_current_rules',
    description:
      'Read-only. Return a plain-English summary of every sequence and its conditions. Use this when the user asks what the current setup does.',
    input_schema: {
      type: 'object',
      properties: {
        sequence_index: {
          type: 'integer',
          description:
            'If provided, summarize only this sequence. Omit for a full summary.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'list_available_fields',
    description:
      'Read-only. Return the fields and operators the user can build rules from. Call this when you are unsure what is available — never guess field names.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
];

// -------------------------------------------------------------------
// Tool-call result shape (what the editor reports back after executing)
// -------------------------------------------------------------------

export interface ToolExecutionResult {
  /** The tool_use_id from the Claude tool_use block — must echo back. */
  tool_use_id: string;
  /** Short string the model sees on its next turn. */
  content: string;
  /** If true, the model is told this call failed. */
  is_error?: boolean;
  /** Editor-only metadata — never sent back to Claude. */
  affected_sequence_indexes?: number[];
}
