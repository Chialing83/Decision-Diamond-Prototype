// Operator catalog and value-shape map for the Decision Diamond editor.
// Ported from keap-prototype-x/src/decisionDiamond/dropdowns.ts.

export type Option<T = string> = { value: T; label: string };

export const SUBJECT_OPTIONS: Option[] = [
  { value: 'contact', label: "Contact's" },
];

export const FIELD_CATEGORY_OPTIONS: Option[] = [
  { value: 'tags', label: 'Tags' },
  { value: 'contactFields', label: 'Contact Fields' },
  {
    value: 'constantContactImport',
    label: 'Constant Contact Fields (From Import)',
  },
  { value: 'customFields', label: 'Custom Fields' },
];

export const CONTACT_FIELD_OPTIONS: Option[] = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone1', label: 'Phone 1' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'leadsource', label: 'Leadsource' },
  { value: 'owner', label: 'Owner' },
];

export const OPERATOR_OPTIONS: Option[] = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'does not equal' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  { value: 'greaterThan', label: 'is greater than' },
  { value: 'greaterOrEqual', label: 'is at least' },
  { value: 'lessThan', label: 'is less than' },
  { value: 'lessOrEqual', label: 'is at most' },
  { value: 'isToday', label: 'is today' },
  { value: 'isTomorrow', label: 'is tomorrow' },
  { value: 'isInThePast', label: 'is in the past' },
  { value: 'isInTheFuture', label: 'is in the future' },
  { value: 'daysAgoAtLeast', label: 'is at least N days ago' },
  { value: 'daysAgoAtMost', label: 'is within last N days' },
  { value: 'daysFromNowAtMost', label: 'is within next N days' },
];

export const UNARY_OPERATORS = new Set([
  'isEmpty',
  'isNotEmpty',
  'isToday',
  'isTomorrow',
  'isInThePast',
  'isInTheFuture',
]);

export type OperatorValueShape = 'unary' | 'number' | 'asField';

const OPERATOR_VALUE_SHAPE_BY_VALUE: Record<string, OperatorValueShape> = {
  equals: 'asField',
  notEquals: 'asField',
  isEmpty: 'unary',
  isNotEmpty: 'unary',
  greaterThan: 'asField',
  greaterOrEqual: 'asField',
  lessThan: 'asField',
  lessOrEqual: 'asField',
  isToday: 'unary',
  isTomorrow: 'unary',
  isInThePast: 'unary',
  isInTheFuture: 'unary',
  daysAgoAtLeast: 'number',
  daysAgoAtMost: 'number',
  daysFromNowAtMost: 'number',
};

/** OPERATOR_OPTIONS keys by label since the editor stores op label, not value. */
export const OPERATOR_VALUE_SHAPE_BY_LABEL: Record<string, OperatorValueShape> =
  OPERATOR_OPTIONS.reduce<Record<string, OperatorValueShape>>((acc, op) => {
    acc[op.label] = OPERATOR_VALUE_SHAPE_BY_VALUE[op.value] ?? 'asField';
    return acc;
  }, {});

export const RULE_CARD_MENU_OPTIONS: Option[] = [
  { value: 'importRules', label: 'Import rules from…' },
  { value: 'deleteAllRules', label: 'Delete all rules' },
];
