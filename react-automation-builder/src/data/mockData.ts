export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  status: 'Lead' | 'Client' | 'Other'
  dateAdded: string
  tags?: string[]
}

export interface Deal {
  id: string
  contactName: string
  contactId: string
  dealName?: string
  amount: number
  currency?: string
  column: string
}

export interface Activity {
  id: string
  type: 'email' | 'tag' | 'note' | 'call'
  description: string
  contactName: string
  time: string
  subject?: string
}

export interface Task {
  id: string
  title: string
  dueDate: string
  contactName: string
  done: boolean
}

export interface Message {
  id: string
  contact: string
  phone: string
  preview: string
  date: string
  unread: boolean
}

export interface Form {
  id: string
  name: string
  dateCreated: string
  lastEdited: string
  type: 'public' | 'internal'
}

export interface Automation {
  id: string
  name: string
  status: 'Draft' | 'Active' | 'Disabled'
  lastUpdated: string
}

export interface AdvancedAutomation {
  id: string
  name: string
  category: string
  status: 'Draft' | 'Published'
  activeContacts: number
  publishDate: string   // free-form (e.g. "Not published" or "1/28/2026, 4:11 pm")
  numericId: number
}

// All people / company / automation names below are whimsical
// placeholders for the locked-down preview build. The original
// names lived in the same shape — swap-back is one-edit-per-row
// once the build is re-opened.
export const contacts: Contact[] = [
  {
    id: '1001',
    firstName: 'Whiskers',
    lastName: 'Pawington',
    email: 'whiskers@catnip.example',
    phone: '+1 (555) 234-5678',
    status: 'Lead',
    dateAdded: 'Jan 9, 2026',
    tags: ['New Lead', 'Prospect'],
  },
  {
    id: '1002',
    firstName: 'Mochi',
    lastName: 'Tofu',
    email: 'mochi.tofu@purrmail.example',
    phone: '+1 (555) 345-6789',
    status: 'Other',
    dateAdded: 'Aug 22, 2025',
    tags: [],
  },
  {
    id: '1003',
    firstName: 'Biscuit',
    lastName: 'Pillow',
    email: 'biscuit.pillow@meowmail.example',
    phone: '+1 (555) 456-7890',
    status: 'Other',
    dateAdded: 'Aug 20, 2025',
    tags: ['VIP'],
  },
  {
    id: '1004',
    firstName: 'Ginger',
    lastName: 'Snaps',
    email: 'ginger.snaps@catnip.example',
    phone: '+1 (555) 567-8901',
    status: 'Lead',
    dateAdded: 'Aug 12, 2025',
    tags: ['Hot Lead'],
  },
  {
    id: '1005',
    firstName: 'Marshmallow',
    lastName: 'Pudding',
    email: 'marshmallow.pudding@purrmail.example',
    phone: '+1 (555) 678-9012',
    status: 'Lead',
    dateAdded: 'Jun 22, 2025',
    tags: ['Cold Lead'],
  },
  {
    id: '1006',
    firstName: 'Pepper',
    lastName: 'Boots',
    email: 'pepper.boots@meowmail.example',
    phone: '+1 (555) 789-0123',
    status: 'Lead',
    dateAdded: 'Feb 12, 2025',
    tags: [],
  },
  {
    id: '1007',
    firstName: 'Salem',
    lastName: 'Nightshade',
    email: 'salem.nightshade@catnip.example',
    phone: '+1 (555) 890-1234',
    status: 'Lead',
    dateAdded: 'Feb 10, 2025',
    tags: ['Adventurer'],
  },
  {
    id: '1008',
    firstName: 'Olive',
    lastName: 'Pawson',
    email: 'olive.pawson@purrmail.example',
    phone: '+1 (555) 901-2345',
    status: 'Other',
    dateAdded: 'Dec 13, 2024',
    tags: [],
  },
  {
    id: '1009',
    firstName: 'Smudge',
    lastName: 'Whiskerfield',
    email: 'smudge.whiskerfield@meowmail.example',
    phone: '+1 (555) 012-3456',
    status: 'Other',
    dateAdded: 'Sep 23, 2024',
    tags: ['Follow Up'],
  },
]

export const deals: Deal[] = [
  { id: 'd1',  contactName: 'Mochi Tofu',         contactId: 'c1',  amount: 0,    column: 'new-leads' },
  { id: 'd2',  contactName: 'Pepper Boots',       contactId: 'c2',  dealName: 'Pepper deal',     amount: 129,  column: 'new-leads' },
  { id: 'd3',  contactName: 'Bramble Whiskerton', contactId: 'c3',  amount: NaN,  column: 'new-leads' },
  { id: 'd4',  contactName: 'Marshmallow Pudding', contactId: 'c4', dealName: 'Welcome series LP', amount: 0, column: 'new-leads' },
  { id: 'd5',  contactName: 'Biscuit Pillow',     contactId: 'c5',  amount: 1000, column: 'new-leads' },
  { id: 'd6',  contactName: 'Biscuit Pillow',     contactId: 'c5',  amount: 1000, column: 'new-leads' },
  { id: 'd7',  contactName: 'Toasted Marshmallow', contactId: 'c6', amount: 1000, column: 'new-leads' },
  { id: 'd8',  contactName: 'Sample Tester',      contactId: 'c7',  amount: 0,    currency: 'CA$', column: 'qualified-leads' },
  { id: 'd9',  contactName: 'Olive Pawson',       contactId: 'c8',  dealName: 'Deal in progress', amount: 1000, column: 'qualified-leads' },
  { id: 'd10', contactName: 'Salem Nightshade',   contactId: 'c9',  amount: 1000, column: 'quote-sent' },
  { id: 'd11', contactName: 'Smudge Whiskerfield', contactId: 'c10', dealName: 'Deal test 1', amount: 100,  column: 'quote-sent' },
  { id: 'd12', contactName: 'Ginger Snaps',       contactId: 'c11', dealName: 'Trial run',        amount: 10,   column: 'quote-sent' },
  { id: 'd13', contactName: 'Demo Contact',       contactId: 'c12', dealName: 'Welcome series LP', amount: 0, column: 'quote-sent' },
  { id: 'd14', contactName: 'Whiskers Pawington', contactId: 'c13', dealName: 'Pepper deal',      amount: 0,    column: 'quote-sent' },
]

export const recentActivity: Activity[] = [
  { id: 'a1', type: 'email', description: 'Email sent to Smudge Whiskerfield', contactName: 'Smudge Whiskerfield', subject: 'Email 2', time: '12:10 pm' },
  { id: 'a2', type: 'email', description: 'Email sent to Smudge Whiskerfield', contactName: 'Smudge Whiskerfield', subject: 'Welcome', time: '12:10 pm' },
  { id: 'a3', type: 'tag',   description: 'Tag applied to Smudge Whiskerfield', contactName: 'Smudge Whiskerfield', subject: '[Action] Start Post-Consult Follow Up | 1663745055', time: '12:10 pm' },
  { id: 'a4', type: 'note',  description: 'Note created for Smudge Whiskerfield', contactName: 'Smudge Whiskerfield', subject: 'Path A Added for...', time: '12:10 pm' },
]

export const tasks: Task[] = [
  { id: 't1', title: 'Task Outcome',              dueDate: 'Tue, Mar 16, 2021', contactName: 'Mittens Marlowe',      done: false },
  { id: 't2', title: 'Only Task Sequence',        dueDate: 'Wed, Mar 17, 2021', contactName: 'Tabby Featherton',     done: false },
  { id: 't3', title: 'Only Task Sequence',        dueDate: 'Thu, Mar 18, 2021', contactName: 'Captain Whiskers',     done: false },
  { id: 't4', title: 'New task',                  dueDate: 'Tue, Jun 8, 2021',  contactName: 'Olive Pawson',         done: false },
  { id: 't5', title: 'merge-apiUS-AZ85296-1508',  dueDate: 'Tue, Aug 24, 2021', contactName: 'Biscuit Pillow',       done: false },
  { id: 't6', title: 'Follow up with Tester One', dueDate: 'Wed, Oct 27, 2021', contactName: 'Sample Tester One',    done: false },
  { id: 't7', title: 'Follow up with Tester Two', dueDate: 'Wed, Oct 27, 2021', contactName: 'Sample Tester Two',    done: false },
  { id: 't8', title: 'Task Outcome',              dueDate: 'Tue, Nov 2, 2021',  contactName: 'Biscuit Pillow',       done: false },
]

export const messages: Message[] = [
  { id: 'm1', contact: '+1 (206) 555-0147',  phone: '+12065550147', preview: 'Hey, I wanted to follow up on our last conversation...', date: 'Apr 15', unread: true },
  { id: 'm2', contact: 'Whiskers Pawington', phone: '+15552345678', preview: 'Thanks for reaching out! I\'m interested in learning more.', date: 'Apr 14', unread: false },
  { id: 'm3', contact: '+1 (425) 555-0199',  phone: '+14255550199', preview: 'Can we schedule a call for next week?', date: 'Apr 12', unread: false },
  { id: 'm4', contact: 'Ginger Snaps',       phone: '+15555678901', preview: 'I reviewed the proposal you sent over.',                   date: 'Apr 10', unread: false },
  { id: 'm5', contact: '+1 (360) 309-0700',  phone: '+13603090700', preview: 'Please call me when you get a chance.',                    date: 'Mar 28', unread: false },
]

export const forms: Form[] = [
  { id: 'f1',  name: 'Contact Us Form',           dateCreated: 'Jan 15, 2024', lastEdited: 'Mar 1, 2024',  type: 'public' },
  { id: 'f2',  name: 'Free Consultation Request', dateCreated: 'Jan 20, 2024', lastEdited: 'Feb 28, 2024', type: 'public' },
  { id: 'f3',  name: 'Newsletter Signup',         dateCreated: 'Feb 1, 2024',  lastEdited: 'Feb 15, 2024', type: 'public' },
  { id: 'f4',  name: 'Quote Request',             dateCreated: 'Feb 10, 2024', lastEdited: 'Apr 1, 2024',  type: 'public' },
  { id: 'f5',  name: 'Event Registration',        dateCreated: 'Feb 14, 2024', lastEdited: 'Mar 20, 2024', type: 'public' },
  { id: 'f6',  name: 'Referral Form',             dateCreated: 'Feb 20, 2024', lastEdited: 'Mar 10, 2024', type: 'public' },
  { id: 'f7',  name: 'Feedback Survey',           dateCreated: 'Mar 1, 2024',  lastEdited: 'Apr 5, 2024',  type: 'public' },
  { id: 'f8',  name: 'Lead Capture - Display',    dateCreated: 'Mar 5, 2024',  lastEdited: 'Apr 10, 2024', type: 'public' },
  { id: 'f9',  name: 'Webinar Registration',      dateCreated: 'Mar 10, 2024', lastEdited: 'Mar 30, 2024', type: 'public' },
  { id: 'f10', name: 'Product Interest Form',     dateCreated: 'Mar 15, 2024', lastEdited: 'Apr 15, 2024', type: 'public' },
  { id: 'f11', name: 'Internal Lead Routing',     dateCreated: 'Jan 10, 2024', lastEdited: 'Feb 1, 2024',  type: 'internal' },
  { id: 'f12', name: 'Sales Intake',              dateCreated: 'Jan 25, 2024', lastEdited: 'Mar 5, 2024',  type: 'internal' },
  { id: 'f13', name: 'Client Onboarding Checklist', dateCreated: 'Feb 5, 2024', lastEdited: 'Apr 2, 2024', type: 'internal' },
]

export const advancedAutomations: AdvancedAutomation[] = [
  { id: 'adv1', name: 'Messy flow_Manual',        category: 'Whiskers', status: 'Draft',     activeContacts: 0, publishDate: 'Not published',      numericId: 3000 },
  { id: 'adv2', name: 'Messy flow_Tidy up tool',  category: 'Whiskers', status: 'Published', activeContacts: 0, publishDate: '1/28/2026, 4:11 pm', numericId: 2888 },
]

export const automations: Automation[] = [
  { id: 'au1', name: 'My automation (13 April 2026)',     status: 'Draft',    lastUpdated: '4/14/2026, 4:30 pm' },
  { id: 'au2', name: 'Internal form: Untitled form 1032', status: 'Draft',    lastUpdated: '3/24/2026, 12:15 pm' },
  { id: 'au3', name: 'My automation (Mar 24, 2026)',      status: 'Draft',    lastUpdated: '3/24/2026, 12:15 pm' },
  { id: 'au4', name: 'My automation (Mar 20, 2026)',      status: 'Draft',    lastUpdated: '3/20/2026, 9:25 am' },
  { id: 'au5', name: 'My automation (Feb 24, 2026)',      status: 'Draft',    lastUpdated: '2/24/2026, 10:43 am' },
  { id: 'au6', name: 'Search LP (Nov 18, 2025)',          status: 'Draft',    lastUpdated: '11/18/2025, 12:33 pm' },
  { id: 'au7', name: 'EASY AUTO (Nov 11, 2025)',          status: 'Active',   lastUpdated: '11/11/2025, 2:44 pm' },
  { id: 'au8', name: 'My automation (11 November 2025)',  status: 'Disabled', lastUpdated: '11/11/2025, 1:15 pm' },
  { id: 'au9', name: 'a_easy_automation (Nov 11, 2025)',  status: 'Active',   lastUpdated: '11/11/2025, 11:36 am' },
]

export const kanbanColumns = [
  { id: 'new-leads', label: 'New leads', totalAmount: 5129, totalDeals: 9, goal: null },
  { id: 'qualified-leads', label: 'Qualified leads', totalAmount: 0, totalDeals: 2, goal: 1000 },
  { id: 'quote-sent', label: 'Quote sent', totalAmount: 1110, totalDeals: 5, goal: null },
  { id: 'negotiating', label: 'Negotiating', totalAmount: 0, totalDeals: 0, goal: null },
]
