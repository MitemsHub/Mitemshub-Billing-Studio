import type {
  BrandSettings,
  Client,
  Invoice,
  InvoiceLineItem,
  LogoVariant,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from '../types/billing';
import { DEFAULT_BRAND_SETTINGS } from './seedData';

// Row <-> model mapping for the browser backend (src/services/browserApi.ts).
// server/appwrite.ts carries its own copy of these serializers for the Express
// path; when a column changes, update both so the two clients stay compatible.

export function normalizeLogoVariant(variant: unknown): LogoVariant {
  return variant === 'custom' ? 'custom' : 'draft';
}

export function toRowId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[^a-zA-Z0-9]+/, '');
  return (cleaned || `row_${Date.now()}`).slice(0, 36);
}

export function parseJsonArray<T>(raw: unknown, fallback: T[] = []): T[] {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function serializeBrand(brand: BrandSettings): Record<string, unknown> {
  return {
    businessName: brand.businessName || 'Mitemshub',
    tagline: brand.tagline || '',
    ownerName: brand.ownerName || '',
    email: brand.email || '',
    phone: brand.phone || '',
    website: brand.website || '',
    address: brand.address || '',
    taxId: brand.taxId || '',
    logoVariant: normalizeLogoVariant(brand.logoVariant),
    customLogoDataUrl: brand.customLogoDataUrl || null,
    accentColor: brand.accentColor || '#0B3B91',
    defaultUsdToNgnRate: Number(brand.defaultUsdToNgnRate) || 1620,
    defaultTaxRate: Number(brand.defaultTaxRate) || 0,
    defaultNotes: brand.defaultNotes || '',
    usdBankDetails: brand.usdBankDetails || '',
    ngnBankDetails: brand.ngnBankDetails || '',
  };
}

export function deserializeBrand(row: Record<string, unknown>): BrandSettings {
  return {
    businessName: String(row.businessName ?? DEFAULT_BRAND_SETTINGS.businessName),
    tagline: String(row.tagline ?? DEFAULT_BRAND_SETTINGS.tagline),
    ownerName: String(row.ownerName ?? DEFAULT_BRAND_SETTINGS.ownerName),
    email: String(row.email ?? DEFAULT_BRAND_SETTINGS.email),
    phone: String(row.phone ?? DEFAULT_BRAND_SETTINGS.phone),
    website: String(row.website ?? DEFAULT_BRAND_SETTINGS.website),
    address: String(row.address ?? DEFAULT_BRAND_SETTINGS.address),
    taxId: String(row.taxId ?? DEFAULT_BRAND_SETTINGS.taxId),
    logoVariant: normalizeLogoVariant(row.logoVariant),
    customLogoDataUrl:
      typeof row.customLogoDataUrl === 'string' && row.customLogoDataUrl.length > 0
        ? row.customLogoDataUrl
        : undefined,
    accentColor: String(row.accentColor ?? DEFAULT_BRAND_SETTINGS.accentColor),
    defaultUsdToNgnRate: Number(
      row.defaultUsdToNgnRate ?? DEFAULT_BRAND_SETTINGS.defaultUsdToNgnRate
    ),
    defaultTaxRate: Number(row.defaultTaxRate ?? DEFAULT_BRAND_SETTINGS.defaultTaxRate),
    defaultNotes: String(row.defaultNotes ?? ''),
    usdBankDetails: String(row.usdBankDetails ?? DEFAULT_BRAND_SETTINGS.usdBankDetails),
    ngnBankDetails: String(row.ngnBankDetails ?? DEFAULT_BRAND_SETTINGS.ngnBankDetails),
  };
}

export function serializeClient(client: Client): Record<string, unknown> {
  return {
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    country: client.country,
    address: client.address,
    preferredCurrency: client.preferredCurrency,
    defaultTermsDays: Number(client.defaultTermsDays) || 14,
    tagsJson: JSON.stringify(client.tags ?? []),
    createdAt: client.createdAt,
  };
}

export function deserializeClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.$id),
    name: String(row.name ?? ''),
    company: String(row.company ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    country: String(row.country ?? ''),
    address: String(row.address ?? ''),
    preferredCurrency: (row.preferredCurrency as Client['preferredCurrency']) ?? 'USD',
    defaultTermsDays: Number(row.defaultTermsDays ?? 14),
    tags: parseJsonArray<string>(row.tagsJson, []),
    createdAt: String(row.createdAt ?? ''),
  };
}

export function serializeInvoice(invoice: Invoice): Record<string, unknown> {
  return {
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
    primaryCurrency: invoice.primaryCurrency,
    equivalentCurrency: invoice.equivalentCurrency || null,
    exchangeRate: Number(invoice.exchangeRate) || 1620,
    dualDisplayMode: invoice.dualDisplayMode,
    itemsJson: JSON.stringify(invoice.items ?? []),
    taxRatePercent: Number(invoice.taxRatePercent) || 0,
    whtRatePercent: Number(invoice.whtRatePercent ?? 0),
    discountPercent: Number(invoice.discountPercent) || 0,
    notes: invoice.notes || '',
    paymentTerms: invoice.paymentTerms || 'Net 14',
    lastReminderSentAt: invoice.lastReminderSentAt || null,
    reminderCount: Number(invoice.reminderCount) || 0,
    recurringId: invoice.recurringId || null,
    paidAt: invoice.paidAt || null,
  };
}

export function deserializeInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.$id),
    invoiceNumber: String(row.invoiceNumber ?? ''),
    clientId: String(row.clientId ?? ''),
    issueDate: String(row.issueDate ?? ''),
    dueDate: String(row.dueDate ?? ''),
    status: (row.status as Invoice['status']) ?? 'draft',
    primaryCurrency: (row.primaryCurrency as Invoice['primaryCurrency']) ?? 'USD',
    equivalentCurrency:
      typeof row.equivalentCurrency === 'string' && row.equivalentCurrency.length > 0
        ? (row.equivalentCurrency as Invoice['equivalentCurrency'])
        : undefined,
    exchangeRate: Number(row.exchangeRate ?? 1620),
    dualDisplayMode:
      (row.dualDisplayMode as Invoice['dualDisplayMode']) ?? 'primary_with_summary',
    items: parseJsonArray<InvoiceLineItem>(row.itemsJson, []),
    taxRatePercent: Number(row.taxRatePercent ?? 0),
    whtRatePercent: Number(row.whtRatePercent ?? 0),
    discountPercent: Number(row.discountPercent ?? 0),
    notes: String(row.notes ?? ''),
    paymentTerms: String(row.paymentTerms ?? 'Net 14'),
    lastReminderSentAt:
      typeof row.lastReminderSentAt === 'string' && row.lastReminderSentAt.length > 0
        ? row.lastReminderSentAt
        : undefined,
    reminderCount: Number(row.reminderCount ?? 0),
    recurringId:
      typeof row.recurringId === 'string' && row.recurringId.length > 0
        ? row.recurringId
        : undefined,
    paidAt: typeof row.paidAt === 'string' && row.paidAt.length > 0 ? row.paidAt : undefined,
  };
}

export function serializeRecurring(sched: RecurringSchedule): Record<string, unknown> {
  return {
    clientId: sched.clientId,
    title: sched.title,
    frequency: sched.frequency,
    primaryCurrency: sched.primaryCurrency,
    equivalentCurrency: sched.equivalentCurrency || null,
    exchangeRate: Number(sched.exchangeRate) || 1620,
    dualDisplayMode: sched.dualDisplayMode,
    itemsJson: JSON.stringify(sched.items ?? []),
    taxRatePercent: Number(sched.taxRatePercent) || 0,
    whtRatePercent: Number(sched.whtRatePercent ?? 0),
    nextRunDate: sched.nextRunDate,
    lastGeneratedDate: sched.lastGeneratedDate || null,
    active: Boolean(sched.active),
    autoSendReminder: Boolean(sched.autoSendReminder),
    notes: sched.notes || '',
  };
}

export function deserializeRecurring(row: Record<string, unknown>): RecurringSchedule {
  return {
    id: String(row.$id),
    clientId: String(row.clientId ?? ''),
    title: String(row.title ?? ''),
    frequency: (row.frequency as RecurringSchedule['frequency']) ?? 'monthly',
    primaryCurrency: (row.primaryCurrency as RecurringSchedule['primaryCurrency']) ?? 'USD',
    equivalentCurrency:
      typeof row.equivalentCurrency === 'string' && row.equivalentCurrency.length > 0
        ? (row.equivalentCurrency as RecurringSchedule['equivalentCurrency'])
        : undefined,
    exchangeRate: Number(row.exchangeRate ?? 1620),
    dualDisplayMode:
      (row.dualDisplayMode as RecurringSchedule['dualDisplayMode']) ?? 'primary_with_summary',
    items: parseJsonArray<InvoiceLineItem>(row.itemsJson, []),
    taxRatePercent: Number(row.taxRatePercent ?? 0),
    whtRatePercent: Number(row.whtRatePercent ?? 0),
    nextRunDate: String(row.nextRunDate ?? ''),
    lastGeneratedDate:
      typeof row.lastGeneratedDate === 'string' && row.lastGeneratedDate.length > 0
        ? row.lastGeneratedDate
        : undefined,
    active: Boolean(row.active),
    autoSendReminder: Boolean(row.autoSendReminder),
    notes: String(row.notes ?? ''),
  };
}

export function serializeRule(rule: ReminderRule): Record<string, unknown> {
  return {
    name: rule.name,
    triggerType: rule.triggerType,
    daysOffset: Number(rule.daysOffset) || 0,
    enabled: Boolean(rule.enabled),
    subjectTemplate: rule.subjectTemplate,
    bodyTemplate: rule.bodyTemplate,
  };
}

export function deserializeRule(row: Record<string, unknown>): ReminderRule {
  return {
    id: String(row.$id),
    name: String(row.name ?? ''),
    triggerType: (row.triggerType as ReminderRule['triggerType']) ?? 'before_due',
    daysOffset: Number(row.daysOffset ?? 0),
    enabled: Boolean(row.enabled),
    subjectTemplate: String(row.subjectTemplate ?? ''),
    bodyTemplate: String(row.bodyTemplate ?? ''),
  };
}

export function serializeLog(log: ReminderLog): Record<string, unknown> {
  return {
    invoiceId: log.invoiceId,
    invoiceNumber: log.invoiceNumber,
    clientId: log.clientId,
    clientName: log.clientName,
    ruleName: log.ruleName,
    channel: log.channel,
    sentAt: log.sentAt,
    subject: log.subject,
    previewText: log.previewText,
  };
}

export function deserializeLog(row: Record<string, unknown>): ReminderLog {
  return {
    id: String(row.$id),
    invoiceId: String(row.invoiceId ?? ''),
    invoiceNumber: String(row.invoiceNumber ?? ''),
    clientId: String(row.clientId ?? ''),
    clientName: String(row.clientName ?? ''),
    ruleName: String(row.ruleName ?? ''),
    channel: (row.channel as ReminderLog['channel']) ?? 'Manual Trigger',
    sentAt: String(row.sentAt ?? ''),
    subject: String(row.subject ?? ''),
    previewText: String(row.previewText ?? ''),
  };
}
