import type {
  BrandSettings,
  Client,
  Invoice,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
  ServicePreset,
} from '../types/billing';

// Starter profile for a fresh clone. Contact and payout details are placeholders on
// purpose: real values live in Appwrite (or the browser cache) and are edited in
// Brand Studio. Never commit real bank details, routing numbers or tax IDs here.
export const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  businessName: 'Mitemshub',
  tagline: 'Data Analysis · AI Systems · Custom Web Engineering',
  ownerName: 'Emmanuel Mitti',
  email: 'billing@mitemshub.studio',
  phone: '+000 0000 0000',
  website: 'mitemshub.studio',
  address: 'Lekki Phase 1, Lagos, Nigeria',
  taxId: 'TIN-00000000-0000',
  logoVariant: 'draft',
  accentColor: '#0B3B91',
  defaultUsdToNgnRate: 1620,
  defaultTaxRate: 0,
  defaultNotes: '',
  usdBankDetails:
    'Bank: Your USD bank\nAccount Name: Your account name\nRouting (ABA): 000000000\nAccount No: 0000000000\nSWIFT: XXXXXXXX',
  ngnBankDetails:
    'Bank: Your local bank\nAccount Name: Your account name\nAccount Number: 0000000000\nTransfer Reference: Quote Invoice Number',
};

export const SERVICE_PRESETS: ServicePreset[] = [
  {
    id: 'preset-data-audit',
    title: 'Exploratory Data Analysis & BI Reporting',
    description: 'Dataset cleaning, SQL modeling, KPI telemetry, and interactive executive dashboard setup.',
    category: 'Data Analysis',
    defaultUsdPrice: 850,
  },
  {
    id: 'preset-ai-agent',
    title: 'Custom AI Workflow & LLM Integration',
    description: 'Document extraction pipeline, structured prompt orchestration, evaluation harness, and API setup.',
    category: 'AI Engineering',
    defaultUsdPrice: 1400,
  },
  {
    id: 'preset-web-app',
    title: 'Custom Full-Stack Web Application',
    description: 'Responsive React/TypeScript frontend, REST API integration, authentication, and deployment.',
    category: 'Web Development',
    defaultUsdPrice: 1850,
  },
  {
    id: 'preset-retainer-ops',
    title: 'Monthly Analytics & Web Maintenance Retainer',
    description: 'Ongoing data pipeline monitoring, feature iterations, security patches, and priority support.',
    category: 'Infrastructure',
    defaultUsdPrice: 600,
  },
];

// A new studio starts with an empty ledger: every client, invoice, retainer and
// reminder log is created by the user. Demo rows used to ship here, which made a
// fresh install look like it already had history (and money on the dashboard).
// Keep these empty — the dashboard, invoice list and client directory all have
// first-run empty states built for exactly this.
export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_RECURRING_SCHEDULES: RecurringSchedule[] = [];
export const INITIAL_REMINDER_LOGS: ReminderLog[] = [];

// Automation templates, not records: these ship enabled so reminders work out of
// the box, and they carry no client, invoice or amount data.
export const INITIAL_REMINDER_RULES: ReminderRule[] = [
  {
    id: 'rule-before-3',
    name: 'Friendly Pre-Due Nudge',
    triggerType: 'before_due',
    daysOffset: 3,
    enabled: true,
    subjectTemplate: 'Upcoming invoice {{invoice_number}} due {{due_date}} — {{brand_name}}',
    bodyTemplate:
      'Hi {{client_name}},\n\nThis is a quick reminder that invoice {{invoice_number}} for {{amount_primary}} (equivalent to {{amount_equivalent}} at {{exchange_rate}}) is due on {{due_date}}.\n\nPlease let me know if you need any extra documentation from {{brand_name}}.\n\nBest regards,\nEmmanuel Mitti',
  },
  {
    id: 'rule-on-due',
    name: 'Due Date Notice',
    triggerType: 'on_due',
    daysOffset: 0,
    enabled: true,
    subjectTemplate: 'Payment due today: {{invoice_number}} ({{amount_primary}})',
    bodyTemplate:
      'Hi {{client_name}},\n\nInvoice {{invoice_number}} for {{amount_primary}} ({{amount_equivalent}}) is due today ({{due_date}}). You can settle via either the USD wire instructions or the NGN account listed on the invoice.\n\nThank you,\n{{brand_name}}',
  },
  {
    id: 'rule-after-7',
    name: '7-Day Overdue Follow-up',
    triggerType: 'after_due',
    daysOffset: 7,
    enabled: true,
    subjectTemplate: 'Overdue reminder: {{invoice_number}} — {{company_name}}',
    bodyTemplate:
      'Hi {{client_name}},\n\nFollowing up on invoice {{invoice_number}} for {{amount_primary}} ({{amount_equivalent}}), which was due on {{due_date}}. Kindly share an update on your payout schedule or transfer reference.\n\nWarm regards,\nEmmanuel Mitti · {{brand_name}}',
  },
];
