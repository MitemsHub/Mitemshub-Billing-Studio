import type {
  BillingFrequency,
  Client,
  CurrencyCode,
  Invoice,
  InvoiceLineItem,
  ReminderRule,
} from '../types/billing';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** Approximate units per 1 USD used solely as an editable starting default for cross-rate prefill */
  defaultPerUsd: number;
}

export const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', defaultPerUsd: 1 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', defaultPerUsd: 1620 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', defaultPerUsd: 0.78 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', defaultPerUsd: 0.92 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', defaultPerUsd: 1.39 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', defaultPerUsd: 1.53 },
  GHS: { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', defaultPerUsd: 15.8 },
  KES: { code: 'KES', symbol: 'KSh ', name: 'Kenyan Shilling', defaultPerUsd: 129 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', defaultPerUsd: 18.1 },
};

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = Object.values(CURRENCY_META);

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineItemTotal(quantity: number, unitPrice: number): number {
  const safeQty = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  const safePrice = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  return roundMoney(safeQty * safePrice);
}

export function getDefaultEquivalentCurrency(primary: CurrencyCode): CurrencyCode {
  return primary === 'NGN' ? 'USD' : 'NGN';
}

/**
 * Returns a sensible editable FX rate for a currency pair.
 * Note: For NGN -> USD, returns NGN per 1 USD (e.g. 1620) because Naira rates are quoted as 1 USD = X NGN.
 * For all other pairs (primary -> equivalent), returns equivalent units per 1 primary unit.
 */
export function getDefaultPairRate(
  primary: CurrencyCode,
  equivalent: CurrencyCode,
  usdToNgnRate = 1620
): number {
  if (primary === equivalent) return 1;
  const safeUsdToNgn = usdToNgnRate > 0 ? usdToNgnRate : 1620;

  if (primary === 'NGN' && equivalent === 'USD') {
    return roundMoney(safeUsdToNgn);
  }

  const perUsd = (code: CurrencyCode) =>
    code === 'NGN' ? safeUsdToNgn : CURRENCY_META[code]?.defaultPerUsd ?? 1;

  return roundMoney(perUsd(equivalent) / perUsd(primary));
}

export function isInverseNgnToUsdPair(primary: CurrencyCode, equivalent: CurrencyCode): boolean {
  return primary === 'NGN' && equivalent === 'USD';
}

export function formatPairRateLabel(
  primary: CurrencyCode,
  equivalent: CurrencyCode,
  rate: number
): string {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const fmtRate = safeRate.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  if (isInverseNgnToUsdPair(primary, equivalent)) {
    return `1 USD = ₦${fmtRate}`;
  }
  const eqSym = CURRENCY_META[equivalent]?.symbol ?? '';
  return `1 ${primary} = ${eqSym}${fmtRate} ${equivalent}`;
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  pairRate: number
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeRate = Number.isFinite(pairRate) && pairRate > 0 ? pairRate : 1;

  if (from === to) return roundMoney(safeAmount);
  if (isInverseNgnToUsdPair(from, to)) {
    return roundMoney(safeAmount / safeRate);
  }
  return roundMoney(safeAmount * safeRate);
}

export function convertToUsdEstimate(
  amount: number,
  currency: CurrencyCode,
  usdToNgnRate: number,
  invoiceRate?: number,
  invoiceEquivalentCurrency?: CurrencyCode
): number {
  if (currency === 'USD') return roundMoney(amount);
  if (currency === 'NGN') {
    const rate =
      invoiceEquivalentCurrency === 'USD' && invoiceRate && invoiceRate > 0
        ? invoiceRate
        : usdToNgnRate > 0
        ? usdToNgnRate
        : 1620;
    return roundMoney(amount / rate);
  }
  const perUsd = CURRENCY_META[currency]?.defaultPerUsd ?? 1;
  return roundMoney(amount / perUsd);
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  whtAmount: number;
  totalPrimary: number;
  equivalentCurrency: CurrencyCode;
  totalEquivalent: number;
}

export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  taxRatePercent: number,
  discountPercent: number,
  exchangeRate: number,
  primaryCurrency: CurrencyCode,
  explicitEquivalentCurrency?: CurrencyCode,
  whtRatePercent = 0
): InvoiceTotals {
  const subtotal = roundMoney(
    items.reduce((acc, item) => acc + calculateLineItemTotal(item.quantity, item.unitPrice), 0)
  );
  const clampedDiscount = Math.min(
    100,
    Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0)
  );
  const clampedTax = Math.min(100, Math.max(0, Number.isFinite(taxRatePercent) ? taxRatePercent : 0));
  const clampedWht = Math.min(100, Math.max(0, Number.isFinite(whtRatePercent) ? whtRatePercent : 0));

  const discountAmount = roundMoney(subtotal * (clampedDiscount / 100));
  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  const taxAmount = roundMoney(taxableAmount * (clampedTax / 100));
  const whtAmount = roundMoney(taxableAmount * (clampedWht / 100));
  const totalPrimary = roundMoney(Math.max(0, taxableAmount + taxAmount - whtAmount));

  const equivalentCurrency: CurrencyCode =
    explicitEquivalentCurrency ?? getDefaultEquivalentCurrency(primaryCurrency);
  const totalEquivalent = convertCurrency(
    totalPrimary,
    primaryCurrency,
    equivalentCurrency,
    exchangeRate
  );

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    whtAmount,
    totalPrimary,
    equivalentCurrency,
    totalEquivalent,
  };
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const symbol = CURRENCY_META[currency]?.symbol ?? `${currency} `;
  const absFormatted = Math.abs(safe).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `-${symbol}${absFormatted}` : `${symbol}${absFormatted}`;
}

export function parseIsoDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
}

export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso).getTime();
  const to = parseIsoDate(toIso).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function addDaysIso(dateIso: string, days: number): string {
  const dt = parseIsoDate(dateIso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDate(dt);
}

export function computeNextBillingDate(currentDateIso: string, frequency: BillingFrequency): string {
  const dt = parseIsoDate(currentDateIso);
  switch (frequency) {
    case 'weekly':
      dt.setUTCDate(dt.getUTCDate() + 7);
      break;
    case 'biweekly':
      dt.setUTCDate(dt.getUTCDate() + 14);
      break;
    case 'monthly':
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      break;
    case 'quarterly':
      dt.setUTCMonth(dt.getUTCMonth() + 3);
      break;
  }
  return formatIsoDate(dt);
}

export function generateNextInvoiceNumber(
  existingInvoices: Pick<Invoice, 'invoiceNumber'>[],
  year = 2026
): string {
  let maxSeq = 0;
  const pattern = new RegExp(`^INV-${year}-(\\d+)$`);
  for (const inv of existingInvoices) {
    const match = inv.invoiceNumber.match(pattern);
    if (match) {
      const seq = Number.parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const next = String(maxSeq + 1).padStart(3, '0');
  return `INV-${year}-${next}`;
}

export interface ReminderEvaluation {
  rule: ReminderRule;
  daysDeltaFromDue: number;
  reason: string;
}

export function evaluateReminderEligibility(
  invoice: Invoice,
  rules: ReminderRule[],
  referenceDateIso: string
): ReminderEvaluation | null {
  if (invoice.status === 'paid' || invoice.status === 'draft') {
    return null;
  }

  const daysDelta = daysBetweenIso(invoice.dueDate, referenceDateIso);
  const enabledRules = rules.filter((r) => r.enabled);
  for (const rule of enabledRules) {
    if (rule.triggerType === 'before_due' && daysDelta < 0 && Math.abs(daysDelta) <= rule.daysOffset) {
      return {
        rule,
        daysDeltaFromDue: daysDelta,
        reason: `Due in ${Math.abs(daysDelta)} day${Math.abs(daysDelta) === 1 ? '' : 's'}`,
      };
    }
    if (rule.triggerType === 'on_due' && daysDelta === 0) {
      return {
        rule,
        daysDeltaFromDue: 0,
        reason: 'Due today',
      };
    }
    if (rule.triggerType === 'after_due' && daysDelta >= rule.daysOffset) {
      return {
        rule,
        daysDeltaFromDue: daysDelta,
        reason: `${daysDelta} day${daysDelta === 1 ? '' : 's'} overdue`,
      };
    }
  }

  return null;
}

export function renderReminderTemplate(
  template: string,
  invoice: Invoice,
  client: Client,
  brandName: string
): string {
  const totals = calculateInvoiceTotals(
    invoice.items,
    invoice.taxRatePercent,
    invoice.discountPercent,
    invoice.exchangeRate,
    invoice.primaryCurrency,
    invoice.equivalentCurrency,
    invoice.whtRatePercent ?? 0
  );
  const primaryAmount = formatMoney(totals.totalPrimary, invoice.primaryCurrency);
  const equivalentAmount = formatMoney(totals.totalEquivalent, totals.equivalentCurrency);
  const rateLabel = formatPairRateLabel(
    invoice.primaryCurrency,
    totals.equivalentCurrency,
    invoice.exchangeRate
  );

  return template
    .replaceAll('{{client_name}}', client.name)
    .replaceAll('{{company_name}}', client.company || client.name)
    .replaceAll('{{invoice_number}}', invoice.invoiceNumber)
    .replaceAll('{{due_date}}', invoice.dueDate)
    .replaceAll('{{amount_primary}}', primaryAmount)
    .replaceAll('{{amount_equivalent}}', equivalentAmount)
    .replaceAll('{{exchange_rate}}', rateLabel)
    .replaceAll('{{brand_name}}', brandName);
}

export function invoicesToCsv(invoices: Invoice[], clients: Client[]): string {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const headers = [
    'Invoice Number',
    'Client',
    'Company',
    'Issue Date',
    'Due Date',
    'Status',
    'Primary Currency',
    'Primary Total',
    'Equivalent Currency',
    'Equivalent Total',
    'Exchange Rate',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };

  const rows = invoices.map((inv) => {
    const client = clientMap.get(inv.clientId);
    const totals = calculateInvoiceTotals(
      inv.items,
      inv.taxRatePercent,
      inv.discountPercent,
      inv.exchangeRate,
      inv.primaryCurrency,
      inv.equivalentCurrency,
      inv.whtRatePercent ?? 0
    );
    return [
      inv.invoiceNumber,
      client?.name || 'Unknown',
      client?.company || '',
      inv.issueDate,
      inv.dueDate,
      inv.status,
      inv.primaryCurrency,
      totals.totalPrimary.toFixed(2),
      totals.equivalentCurrency,
      totals.totalEquivalent.toFixed(2),
      inv.exchangeRate.toFixed(2),
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
