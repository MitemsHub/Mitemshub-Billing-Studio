export type CurrencyCode =
  | 'USD'
  | 'NGN'
  | 'GBP'
  | 'EUR'
  | 'CAD'
  | 'AUD'
  | 'GHS'
  | 'KES'
  | 'ZAR';

export type DualCurrencyDisplayMode = 'primary_with_summary' | 'dual_columns' | 'primary_only';

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid';

export type BillingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export type LogoVariant = 'draft' | 'custom';

export interface InvoiceLineItem {
  id: string;
  title: string;
  description: string;
  category: 'Data Analysis' | 'AI Engineering' | 'Web Development' | 'Consulting' | 'Infrastructure';
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  primaryCurrency: CurrencyCode;
  equivalentCurrency?: CurrencyCode;
  exchangeRate: number; // By default: units of equivalentCurrency per 1 primaryCurrency (except NGN->USD uses 1 USD = X NGN)
  dualDisplayMode: DualCurrencyDisplayMode;
  items: InvoiceLineItem[];
  taxRatePercent: number;
  whtRatePercent?: number;
  discountPercent: number;
  notes: string;
  paymentTerms: string;
  lastReminderSentAt?: string;
  reminderCount: number;
  recurringId?: string;
  paidAt?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  preferredCurrency: CurrencyCode;
  defaultTermsDays: number;
  tags: string[];
  createdAt: string;
}

export interface RecurringSchedule {
  id: string;
  clientId: string;
  title: string;
  frequency: BillingFrequency;
  primaryCurrency: CurrencyCode;
  equivalentCurrency?: CurrencyCode;
  exchangeRate: number;
  dualDisplayMode: DualCurrencyDisplayMode;
  items: InvoiceLineItem[];
  taxRatePercent: number;
  whtRatePercent?: number;
  nextRunDate: string; // YYYY-MM-DD
  lastGeneratedDate?: string;
  active: boolean;
  autoSendReminder: boolean;
  notes: string;
}

export type ReminderTriggerType = 'before_due' | 'on_due' | 'after_due';

export interface ReminderRule {
  id: string;
  name: string;
  triggerType: ReminderTriggerType;
  daysOffset: number;
  enabled: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface ReminderLog {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  ruleName: string;
  channel: 'Email Draft' | 'Auto Queue' | 'Manual Trigger';
  sentAt: string; // ISO timestamp
  subject: string;
  previewText: string;
}

export interface BrandSettings {
  businessName: string;
  tagline: string;
  ownerName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  taxId: string;
  logoVariant: LogoVariant;
  customLogoDataUrl?: string;
  accentColor: string;
  defaultUsdToNgnRate: number;
  defaultTaxRate: number;
  defaultNotes: string;
  usdBankDetails: string;
  ngnBankDetails: string;
}

export interface ServicePreset {
  id: string;
  title: string;
  description: string;
  category: InvoiceLineItem['category'];
  defaultUsdPrice: number;
}

export interface PersistedState {
  brand: BrandSettings;
  clients: Client[];
  invoices: Invoice[];
  recurringSchedules: RecurringSchedule[];
  reminderRules: ReminderRule[];
  reminderLogs: ReminderLog[];
}
