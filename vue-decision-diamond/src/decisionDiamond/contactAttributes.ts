/**
 * Contact attribute catalogue + type → operator mapping for the
 * cross-entity Contact category in Decision Diamond rules.
 *
 * Source of truth: DECISION-DIAMOND-LOGIC.md §3 ("Available conditions")
 * extended per the AI-assistant follow-ups spec ("Contact as a Shared
 * Cross-Entity Category"). Operator sets are TYPE-dependent, not
 * category-dependent — the same operators apply to a text field
 * whether it's standard, custom, or imported.
 */

/** The four sub-categories under "Contact's". */
export type ContactCategory = 'tags' | 'standard' | 'constant' | 'custom';

/** Field type drives which operators are available. */
export type ContactFieldType =
  | 'tags'
  | 'text'
  | 'date'
  | 'enum'
  | 'numeric'
  | 'boolean'
  | 'reference';

export interface ContactAttribute {
  /** Stable id — used in `DDCondition.field`. */
  id: string;
  /** Display label. */
  label: string;
  /** Sub-category — must match the row's `DDCondition.category`. */
  category: ContactCategory;
  /** Drives operator + value-input rendering. */
  type: ContactFieldType;
  /** Enum values when type === 'enum'. */
  enumValues?: string[];
}

// -------------------------------------------------------------------
// Standard Contact Fields — the 29 listed in the source doc.
// -------------------------------------------------------------------

const TEXT = (id: string, label: string): ContactAttribute => ({
  id,
  label,
  category: 'standard',
  type: 'text',
});
const DATE = (id: string, label: string): ContactAttribute => ({
  id,
  label,
  category: 'standard',
  type: 'date',
});
const ENUM = (
  id: string,
  label: string,
  values: string[],
): ContactAttribute => ({
  id,
  label,
  category: 'standard',
  type: 'enum',
  enumValues: values,
});

export const STANDARD_CONTACT_FIELDS: ContactAttribute[] = [
  DATE('contact.anniversary', 'Anniversary'),
  DATE('contact.birthday', 'Birthday'),
  TEXT('contact.city', 'City'),
  TEXT('contact.country', 'Country'),
  TEXT('contact.email', 'Email'),
  TEXT('contact.emailAddress2', 'Email Address 2'),
  TEXT('contact.emailAddress3', 'Email Address 3'),
  ENUM('contact.emailStatus', 'Email Status', [
    'Confirmed',
    'Opted In',
    'Opted Out',
    'Bounced',
    'Unsubscribed',
  ]),
  TEXT('contact.facebook', 'Facebook'),
  TEXT('contact.firstName', 'First Name'),
  TEXT('contact.instagram', 'Instagram'),
  TEXT('contact.jobTitle', 'Job Title'),
  ENUM('contact.language', 'Language', [
    'English',
    'Spanish',
    'French',
    'German',
    'Other',
  ]),
  TEXT('contact.lastName', 'Last Name'),
  TEXT('contact.leadsource', 'Leadsource'),
  TEXT('contact.linkedin', 'LinkedIn'),
  TEXT('contact.owner', 'Owner'),
  ENUM('contact.personType', 'Person Type', [
    'Lead',
    'Customer',
    'Vendor',
    'Partner',
    'Other',
  ]),
  TEXT('contact.phone1', 'Phone 1'),
  TEXT('contact.phone2', 'Phone 2'),
  TEXT('contact.phone3', 'Phone 3'),
  TEXT('contact.pinterest', 'Pinterest'),
  TEXT('contact.snapchat', 'Snapchat'),
  TEXT('contact.spouseName', 'Spouse Name'),
  TEXT('contact.state', 'State'),
  TEXT('contact.title', 'Title'),
  TEXT('contact.twitter', 'Twitter'),
  TEXT('contact.website', 'Website'),
  TEXT('contact.youtube', 'YouTube'),
];

// -------------------------------------------------------------------
// Tags — special category. Tags IS the attribute; no sub-attribute pick.
// -------------------------------------------------------------------

export const TAGS_ATTRIBUTE: ContactAttribute = {
  id: 'contact.tags',
  label: 'Tags',
  category: 'tags',
  type: 'tags',
};

// -------------------------------------------------------------------
// Constant Contact Fields (From Import) — tenant-specific. We stub a
// short list for the prototype; production would query tenant config.
// -------------------------------------------------------------------

export const CONSTANT_CONTACT_FIELDS: ContactAttribute[] = [
  TEXT('contact.constant.jakesDateTest', 'Jakes date test'),
];

// -------------------------------------------------------------------
// Custom Fields — tenant-specific. We stub a representative sample
// covering common types (text, date, enum, numeric, boolean).
// -------------------------------------------------------------------

export const CUSTOM_CONTACT_FIELDS: ContactAttribute[] = [
  TEXT('contact.custom.vipTier', 'VIP Tier'),
  ENUM('contact.custom.industry', 'Industry', [
    'Construction',
    'Retail',
    'Services',
    'Professional',
    'Healthcare',
    'Other',
  ]),
  DATE('contact.custom.firstPurchaseDate', 'First Purchase Date'),
  {
    id: 'contact.custom.lifetimeValue',
    label: 'Lifetime Value',
    category: 'custom',
    type: 'numeric',
  },
  {
    id: 'contact.custom.optedInSms',
    label: 'Opted In SMS',
    category: 'custom',
    type: 'boolean',
  },
];

// Bind the imported fields to the right category
STANDARD_CONTACT_FIELDS.forEach((f) => (f.category = 'standard'));
CONSTANT_CONTACT_FIELDS.forEach((f) => (f.category = 'constant'));
CUSTOM_CONTACT_FIELDS.forEach((f) => (f.category = 'custom'));

// -------------------------------------------------------------------
// Lookup helpers
// -------------------------------------------------------------------

export function attributesForCategory(
  category: ContactCategory,
): ContactAttribute[] {
  switch (category) {
    case 'tags':
      return [TAGS_ATTRIBUTE];
    case 'standard':
      return STANDARD_CONTACT_FIELDS;
    case 'constant':
      return CONSTANT_CONTACT_FIELDS;
    case 'custom':
      return CUSTOM_CONTACT_FIELDS;
  }
}

const ALL_BY_ID = new Map<string, ContactAttribute>();
[
  TAGS_ATTRIBUTE,
  ...STANDARD_CONTACT_FIELDS,
  ...CONSTANT_CONTACT_FIELDS,
  ...CUSTOM_CONTACT_FIELDS,
].forEach((a) => ALL_BY_ID.set(a.id, a));

export function getContactAttribute(id: string): ContactAttribute | undefined {
  return ALL_BY_ID.get(id);
}

// -------------------------------------------------------------------
// Operators by type (per the spec — operator support is TYPE-dependent)
// -------------------------------------------------------------------

export interface ContactOperator {
  id: string;
  label: string;
  /** How many value inputs this operator takes (0 for "is empty" etc.). */
  arity: 0 | 1 | 2;
}

export const OPERATORS_BY_TYPE: Record<ContactFieldType, ContactOperator[]> = {
  tags: [
    { id: 'contains', label: 'contains', arity: 1 },
    { id: 'doesNotContain', label: 'does not contain', arity: 1 },
    { id: 'isEmpty', label: 'is empty', arity: 0 },
    { id: 'isNotEmpty', label: 'is not empty', arity: 0 },
  ],
  text: [
    { id: 'equals', label: 'equals', arity: 1 },
    { id: 'doesNotEqual', label: 'does not equal', arity: 1 },
    { id: 'contains', label: 'contains', arity: 1 },
    { id: 'doesNotContain', label: 'does not contain', arity: 1 },
    { id: 'beginsWith', label: 'begins with', arity: 1 },
    { id: 'endsWith', label: 'ends with', arity: 1 },
    { id: 'isEmpty', label: 'is empty', arity: 0 },
    { id: 'isNotEmpty', label: 'is not empty', arity: 0 },
  ],
  date: [
    { id: 'equals', label: 'is on', arity: 1 },
    { id: 'before', label: 'is before', arity: 1 },
    { id: 'after', label: 'is after', arity: 1 },
    { id: 'between', label: 'is between', arity: 2 },
    { id: 'isEmpty', label: 'is empty', arity: 0 },
    { id: 'isNotEmpty', label: 'is not empty', arity: 0 },
  ],
  enum: [
    { id: 'equals', label: 'is', arity: 1 },
    { id: 'doesNotEqual', label: 'is not', arity: 1 },
    { id: 'isEmpty', label: 'is empty', arity: 0 },
    { id: 'isNotEmpty', label: 'is not empty', arity: 0 },
  ],
  numeric: [
    { id: 'equals', label: 'equals', arity: 1 },
    { id: 'doesNotEqual', label: 'does not equal', arity: 1 },
    { id: 'exceeds', label: 'is greater than', arity: 1 },
    { id: 'lessThan', label: 'is less than', arity: 1 },
    { id: 'between', label: 'is between', arity: 2 },
    { id: 'isEmpty', label: 'is empty', arity: 0 },
    { id: 'isNotEmpty', label: 'is not empty', arity: 0 },
  ],
  boolean: [
    { id: 'isTrue', label: 'is yes', arity: 0 },
    { id: 'isFalse', label: 'is no', arity: 0 },
  ],
  reference: [
    { id: 'equals', label: 'is', arity: 1 },
    { id: 'doesNotEqual', label: 'is not', arity: 1 },
    { id: 'isEmpty', label: 'is empty', arity: 0 },
    { id: 'isNotEmpty', label: 'is not empty', arity: 0 },
  ],
};

export function operatorsForAttribute(
  attribute: ContactAttribute,
): ContactOperator[] {
  return OPERATORS_BY_TYPE[attribute.type];
}

export function defaultOperatorForType(
  type: ContactFieldType,
): string {
  switch (type) {
    case 'tags':
      return 'contains';
    case 'text':
      return 'equals';
    case 'date':
      return 'between';
    case 'enum':
      return 'equals';
    case 'numeric':
      return 'exceeds';
    case 'boolean':
      return 'isTrue';
    case 'reference':
      return 'equals';
  }
}

// -------------------------------------------------------------------
// Display helpers
// -------------------------------------------------------------------

export function categoryLabel(category: ContactCategory): string {
  switch (category) {
    case 'tags':
      return 'Tags';
    case 'standard':
      return 'Contact Fields';
    case 'constant':
      return 'Constant Contact Fields';
    case 'custom':
      return 'Custom Fields';
  }
}

/** Plain-English description of a contact-scoped condition, used in
 *  AI confirmation messages and the assistant's state summary. */
export function describeContactCondition(c: {
  category: string;
  field: string;
  operator: string;
  values: string[];
}): string {
  const attr = getContactAttribute(c.field);
  const op = attr ? operatorsForAttribute(attr).find((o) => o.id === c.operator) : null;
  const opLabel = op?.label ?? c.operator;
  const valStr =
    op?.arity === 0
      ? ''
      : op?.arity === 2
        ? ` ${c.values[0] ?? ''}–${c.values[1] ?? ''}`
        : c.values[0]
          ? ` "${c.values[0]}"`
          : '';
  const attrLabel = attr?.label ?? c.field;
  if (c.category === 'tags') {
    return `Contact's Tags ${opLabel}${valStr}`;
  }
  return `Contact's ${attrLabel} ${opLabel}${valStr}`;
}
