// src/decisionDiamond/dropdowns.ts
// All dropdown options for the Decision Diamond editor.
// Extracted from the live Keap Max Classic editor (campaign "DD Test").
// Safe to import as the single source of truth for the rule-builder UI.

export type Option<T = string> = { value: T; label: string }

/* ---------------------------------------------------------------------------
 * 1) SUBJECT  ("If the ___")
 * ------------------------------------------------------------------------- */
export const SUBJECT_OPTIONS: Option[] = [
  { value: 'contact', label: "Contact's" },
]

/* ---------------------------------------------------------------------------
 * 2) FIELD CATEGORY
 * ------------------------------------------------------------------------- */
export const FIELD_CATEGORY_OPTIONS: Option[] = [
  { value: 'tags', label: 'Tags' },
  { value: 'contactFields', label: 'Contact Fields' },
  { value: 'constantContactImport', label: 'Constant Contact Fields (From Import)' },
  { value: 'customFields', label: 'Custom Fields' },
]

/* ---------------------------------------------------------------------------
 * 3) CONTACT FIELDS  (system fields)
 * ------------------------------------------------------------------------- */
export const CONTACT_FIELD_OPTIONS: Option[] = [
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'city', label: 'City' },
  { value: 'country', label: 'Country' },
  { value: 'email', label: 'Email' },
  { value: 'emailAddress2', label: 'Email Address 2' },
  { value: 'emailAddress3', label: 'Email Address 3' },
  { value: 'emailStatus', label: 'Email Status' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'firstName', label: 'First Name' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'language', label: 'Language' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'leadsource', label: 'Leadsource' },
  { value: 'linkedIn', label: 'LinkedIn' },
  { value: 'owner', label: 'Owner' },
  { value: 'personType', label: 'Person Type' },
  { value: 'phone1', label: 'Phone 1' },
  { value: 'phone2', label: 'Phone 2' },
  { value: 'phone3', label: 'Phone 3' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'spouseName', label: 'Spouse Name' },
  { value: 'state', label: 'State' },
  { value: 'title', label: 'Title' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'website', label: 'Website' },
  { value: 'youtube', label: 'YouTube' },
]

/* ---------------------------------------------------------------------------
 * 4) OPERATORS  (canonical set used in live UI)
 * ------------------------------------------------------------------------- */
export const OPERATOR_OPTIONS: Option[] = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'does not equal' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  // Numeric comparisons — needed for case 4 (lostDealsLast6mo >= 3) and any
  // currency / count / duration field branching.
  { value: 'greaterThan', label: 'is greater than' },
  { value: 'greaterOrEqual', label: 'is at least' },
  { value: 'lessThan', label: 'is less than' },
  { value: 'lessOrEqual', label: 'is at most' },
  // Date-relative — needed for case 1 (estimate sent 3+ days ago) and
  // case 3 (appointment date is tomorrow). Values for these ops are a
  // single integer (days) for the *Ago / *Next family; the *Today / *Tomorrow
  // entries are unary.
  { value: 'isToday', label: 'is today' },
  { value: 'isTomorrow', label: 'is tomorrow' },
  { value: 'isInThePast', label: 'is in the past' },
  { value: 'isInTheFuture', label: 'is in the future' },
  { value: 'daysAgoAtLeast', label: 'is at least N days ago' },
  { value: 'daysAgoAtMost', label: 'is within last N days' },
  { value: 'daysFromNowAtMost', label: 'is within next N days' },
]

/** Unary operators ignore the value field (no value picker shown). */
export const UNARY_OPERATORS = new Set([
  'isEmpty',
  'isNotEmpty',
  'isToday',
  'isTomorrow',
  'isInThePast',
  'isInTheFuture',
])

/* ---------------------------------------------------------------------------
 * 5) DEFAULT ROUTING  ("If contacts don't meet any of the rules…")
 *    The first item is always present; the rest are dynamically generated
 *    from the diamond's connected outgoing sequences.
 * ------------------------------------------------------------------------- */
export const DEFAULT_ROUTING_STATIC_OPTIONS: Option[] = [
  { value: 'drop', label: "Don't put them in a sequence" },
  // …then append one Option per connected outgoing sequence:
  // { value: `flow:${flowId}`, label: sequenceName }
]

/* ---------------------------------------------------------------------------
 * 6) CARD OVERFLOW MENU  (per Rules-for card)
 * ------------------------------------------------------------------------- */
export const RULE_CARD_MENU_OPTIONS: Option[] = [
  { value: 'importRules', label: 'Import rules from…' },
  { value: 'deleteAllRules', label: 'Delete all rules' },
]

/* ---------------------------------------------------------------------------
 * 7) COUNTRY  (value list shown when fieldId === 'country')
 *    Full ISO list as rendered by the live UI.
 * ------------------------------------------------------------------------- */
export const COUNTRY_OPTIONS: Option[] = [
  'Afghanistan', 'Åland Islands', 'Albania', 'American Samoa', 'Andorra', 'Angola', 'Anguilla',
  'Antarctica', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Aruba', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas (the)', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
  'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bolivia (Plurinational State of)',
  'Bonaire, Sint Eustatius and Saba', 'Bosnia and Herzegovina', 'Botswana', 'Bouvet Island',
  'Brazil', 'British Indian Ocean Territory (the)', 'Brunei Darussalam', 'Bulgaria',
  'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada',
  'Cayman Islands (the)', 'Central African Republic (the)', 'Chad', 'Chile', 'China',
  'Christmas Island', 'Cocos (Keeling) Islands (the)', 'Colombia', 'Comoros (the)',
  'Congo (the Democratic Republic of the)', 'Congo (the)', 'Cook Islands (the)',
  'Costa Rica', "Côte d'Ivoire", 'Croatia', 'Cuba', 'Curaçao', 'Cyprus', 'Czech Republic (the)',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic (the)', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 'Falkland Islands (the) [Malvinas]',
  'Faroe Islands (the)', 'Fiji', 'Finland', 'France', 'French Guiana', 'French Polynesia',
  'French Southern Territories (the)', 'Gabon', 'Gambia (the)', 'Georgia', 'Germany', 'Ghana',
  'Gibraltar', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe', 'Guam', 'Guatemala', 'Guernsey',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Heard Island and McDonald Islands',
  'Holy See (the)', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran (Islamic Republic of)', 'Iraq', 'Ireland', 'Isle of Man', 'Israel', 'Italy', 'Jamaica',
  'Japan', 'Jersey', 'Johnston Island', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  "Korea (the Democratic People's Republic of)", 'Korea (the Republic of)', 'Kuwait',
  'Kyrgyzstan', "Lao People's Democratic Republic (the)", 'Latvia', 'Lebanon', 'Lesotho',
  'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macao',
  'Macedonia (the former Yugoslav Republic of)', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands (the)', 'Martinique', 'Mauritania', 'Mauritius', 'Mayotte',
  'Mexico', 'Micronesia (Federated States of)', 'Midway Islands', 'Moldova (the Republic of)',
  'Monaco', 'Mongolia', 'Montenegro', 'Montserrat', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Nauru', 'Nepal', 'Netherlands (the)', 'New Caledonia', 'New Zealand', 'Nicaragua',
  'Niger (the)', 'Nigeria', 'Niue', 'Norfolk Island', 'Northern Mariana Islands (the)',
  'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine, State of', 'Panama', 'Papua New Guinea',
  'Paraguay', 'Peru', 'Philippines (the)', 'Pitcairn', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar',
  'Réunion', 'Romania', 'Russian Federation (the)', 'Rwanda', 'Saint Barthélemy',
  'Saint Helena, Ascension and Tristan da Cunha', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Martin (French part)', 'Saint Pierre and Miquelon', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Sint Maarten (Dutch part)', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
  'South Georgia and the South Sandwich Islands', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan (the)', 'Suriname', 'Svalbard and Jan Mayen', 'Swaziland', 'Sweden', 'Switzerland',
  'Syrian Arab Republic', 'Taiwan (Province of China)', 'Tajikistan',
  'Tanzania, United Republic of', 'Thailand', 'Timor-Leste', 'Togo', 'Tokelau', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Turks and Caicos Islands (the)',
  'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates (the)',
  'United Kingdom of Great Britain and Northern Ireland (the)',
  'United States Minor Outlying Islands (the)', 'United States of America (the)', 'Uruguay',
  'Uzbekistan', 'Vanuatu', 'Venezuela (Bolivarian Republic of)', 'Viet Nam',
  'Virgin Islands (British)', 'Virgin Islands (U.S.)', 'Wake Island', 'Wallis and Futuna',
  'Western Sahara', 'Yemen', 'Zambia', 'Zimbabwe',
].map((name) => ({ value: name, label: name }))

/* ---------------------------------------------------------------------------
 * 8) CUSTOM FIELDS  (tenant-specific — replace with API-driven list in prod)
 *    Fixture captured from the "DD Test" campaign.
 * ------------------------------------------------------------------------- */
export const CUSTOM_FIELD_OPTIONS: Option[] = []

/* ---------------------------------------------------------------------------
 * 9) HELPERS
 * ------------------------------------------------------------------------- */

/** Returns the field options for a given category. Custom-fields list should
 *  be hydrated from the tenant API in production. */
export function getFieldOptionsForCategory(category: string): Option[] {
  switch (category) {
    case 'contactFields':
      return CONTACT_FIELD_OPTIONS
    case 'customFields':
      return CUSTOM_FIELD_OPTIONS
    case 'tags':
    case 'constantContactImport':
    default:
      return []
  }
}

/** Returns the value-picker options for a given field, or null if the field
 *  takes a free-text/numeric input (no enum). */
export function getValueOptionsForField(fieldId: string): Option[] | null {
  switch (fieldId) {
    case 'country':
      return COUNTRY_OPTIONS
    default:
      return null
  }
}
