import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLineItemTotal,
  calculateInvoiceTotals,
  convertCurrency,
  convertToUsdEstimate,
  formatMoney,
  getDefaultPairRate,
  computeNextBillingDate,
  generateNextInvoiceNumber,
  evaluateReminderEligibility,
  renderReminderTemplate,
  invoicesToCsv,
} from './billing';
import type { Client, Invoice, ReminderRule } from '../types/billing';

test('calculateLineItemTotal multiplies and rounds accurately', () => {
  assert.equal(calculateLineItemTotal(3, 19.995), 59.99);
  assert.equal(calculateLineItemTotal(0, 500), 0);
  assert.equal(calculateLineItemTotal(-2, 100), 0);
});

test('convertCurrency converts USD, NGN, GBP, and EUR accurately', () => {
  assert.equal(convertCurrency(1000, 'USD', 'NGN', 1620), 1620000);
  assert.equal(convertCurrency(1620000, 'NGN', 'USD', 1620), 1000);
  assert.equal(convertCurrency(1000, 'GBP', 'NGN', 2076.92), 2076920);
  assert.equal(convertCurrency(500, 'EUR', 'EUR', 1620), 500);
});

test('getDefaultPairRate computes intuitive cross rates for international currencies', () => {
  assert.equal(getDefaultPairRate('USD', 'NGN', 1620), 1620);
  assert.equal(getDefaultPairRate('NGN', 'USD', 1620), 1620);
  const gbpToNgn = getDefaultPairRate('GBP', 'NGN', 1620);
  assert.ok(gbpToNgn > 2000);
});

test('convertToUsdEstimate converts foreign currencies back to USD', () => {
  assert.equal(convertToUsdEstimate(1000, 'USD', 1620), 1000);
  assert.equal(convertToUsdEstimate(1620000, 'NGN', 1620), 1000);
  assert.equal(convertToUsdEstimate(780, 'GBP', 1620), 1000);
});

test('calculateInvoiceTotals applies discount, tax, and custom equivalent currency', () => {
  const totals = calculateInvoiceTotals(
    [
      {
        id: '1',
        title: 'AI Workflow',
        description: 'Agent pipeline',
        category: 'AI Engineering',
        quantity: 1,
        unitPrice: 2000,
      },
      {
        id: '2',
        title: 'Analytics Dashboard',
        description: 'Charts',
        category: 'Data Analysis',
        quantity: 2,
        unitPrice: 500,
      },
    ],
    7.5,
    10,
    1600,
    'USD',
    'NGN'
  );

  assert.equal(totals.subtotal, 3000);
  assert.equal(totals.discountAmount, 300);
  assert.equal(totals.taxableAmount, 2700);
  assert.equal(totals.taxAmount, 202.5);
  assert.equal(totals.whtAmount, 0);
  assert.equal(totals.totalPrimary, 2902.5);
  assert.equal(totals.equivalentCurrency, 'NGN');
  assert.equal(totals.totalEquivalent, 4644000);
});

test('calculateInvoiceTotals deducts WHTax on taxable subtotal accurately', () => {
  const totals = calculateInvoiceTotals(
    [
      {
        id: '1',
        title: 'AI Workflow',
        description: 'Agent pipeline',
        category: 'AI Engineering',
        quantity: 1,
        unitPrice: 2600,
      },
    ],
    7.5,
    0,
    1620,
    'USD',
    'NGN',
    5
  );

  assert.equal(totals.subtotal, 2600);
  assert.equal(totals.taxAmount, 195);
  assert.equal(totals.whtAmount, 130);
  assert.equal(totals.totalPrimary, 2665);
  assert.equal(totals.totalEquivalent, 4317300);
});

test('formatMoney formats USD, NGN, GBP, EUR, CAD cleanly', () => {
  assert.equal(formatMoney(2902.5, 'USD'), '$2,902.50');
  assert.equal(formatMoney(4644000, 'NGN'), '₦4,644,000.00');
  assert.equal(formatMoney(1250, 'GBP'), '£1,250.00');
  assert.equal(formatMoney(980, 'EUR'), '€980.00');
  assert.equal(formatMoney(-150, 'CAD'), '-CA$150.00');
});

test('computeNextBillingDate advances weekly, biweekly, monthly, quarterly', () => {
  assert.equal(computeNextBillingDate('2026-11-01', 'weekly'), '2026-11-08');
  assert.equal(computeNextBillingDate('2026-11-01', 'biweekly'), '2026-11-15');
  assert.equal(computeNextBillingDate('2026-11-01', 'monthly'), '2026-12-01');
  assert.equal(computeNextBillingDate('2026-11-01', 'quarterly'), '2027-02-01');
});

test('generateNextInvoiceNumber increments max existing sequence for year', () => {
  const next = generateNextInvoiceNumber(
    [{ invoiceNumber: 'INV-2026-004' }, { invoiceNumber: 'INV-2026-012' }, { invoiceNumber: 'INV-2025-099' }],
    2026
  );
  assert.equal(next, 'INV-2026-013');
});

test('evaluateReminderEligibility detects due-soon, due-today, and overdue invoices', () => {
  const rules: ReminderRule[] = [
    {
      id: 'r1',
      name: '3 Days Before Due',
      triggerType: 'before_due',
      daysOffset: 3,
      enabled: true,
      subjectTemplate: 'Upcoming: {{invoice_number}}',
      bodyTemplate: 'Hi {{client_name}}',
    },
    {
      id: 'r2',
      name: 'Due Today',
      triggerType: 'on_due',
      daysOffset: 0,
      enabled: true,
      subjectTemplate: 'Due today: {{invoice_number}}',
      bodyTemplate: 'Hi {{client_name}}',
    },
    {
      id: 'r3',
      name: '7 Days Overdue',
      triggerType: 'after_due',
      daysOffset: 7,
      enabled: true,
      subjectTemplate: 'Overdue: {{invoice_number}}',
      bodyTemplate: 'Hi {{client_name}}',
    },
  ];

  const baseInvoice: Invoice = {
    id: 'inv1',
    invoiceNumber: 'INV-2026-001',
    clientId: 'c1',
    issueDate: '2026-11-01',
    dueDate: '2026-11-15',
    status: 'sent',
    primaryCurrency: 'USD',
    exchangeRate: 1620,
    dualDisplayMode: 'primary_with_summary',
    items: [],
    taxRatePercent: 0,
    discountPercent: 0,
    notes: '',
    paymentTerms: 'Net 14',
    reminderCount: 0,
  };

  assert.equal(evaluateReminderEligibility(baseInvoice, rules, '2026-11-13')?.rule.id, 'r1');
  assert.equal(evaluateReminderEligibility(baseInvoice, rules, '2026-11-15')?.rule.id, 'r2');
  assert.equal(
    evaluateReminderEligibility({ ...baseInvoice, status: 'overdue' }, rules, '2026-11-23')?.rule.id,
    'r3'
  );
  assert.equal(
    evaluateReminderEligibility({ ...baseInvoice, status: 'paid' }, rules, '2026-11-23'),
    null
  );
});

test('renderReminderTemplate replaces dual-currency and client tokens', () => {
  const client: Client = {
    id: 'c1',
    name: 'Tunde Adeyemi',
    company: 'Kora Analytics',
    email: 'tunde@kora.example',
    phone: '+234 800 000 0000',
    country: 'Nigeria',
    address: 'Victoria Island, Lagos',
    preferredCurrency: 'USD',
    defaultTermsDays: 14,
    tags: ['Data Analysis'],
    createdAt: '2026-10-01',
  };

  const invoice: Invoice = {
    id: 'inv1',
    invoiceNumber: 'INV-2026-010',
    clientId: 'c1',
    issueDate: '2026-11-01',
    dueDate: '2026-11-15',
    status: 'sent',
    primaryCurrency: 'USD',
    equivalentCurrency: 'NGN',
    exchangeRate: 1620,
    dualDisplayMode: 'primary_with_summary',
    items: [
      {
        id: 'i1',
        title: 'BI Pipeline',
        description: '',
        category: 'Data Analysis',
        quantity: 1,
        unitPrice: 1000,
      },
    ],
    taxRatePercent: 0,
    discountPercent: 0,
    notes: '',
    paymentTerms: 'Net 14',
    reminderCount: 0,
  };

  const msg = renderReminderTemplate(
    'Hello {{client_name}}, {{invoice_number}} for {{amount_primary}} ({{amount_equivalent}}) is due {{due_date}} — {{brand_name}}',
    invoice,
    client,
    'Mitemshub'
  );
  assert.equal(
    msg,
    'Hello Tunde Adeyemi, INV-2026-010 for $1,000.00 (₦1,620,000.00) is due 2026-11-15 — Mitemshub'
  );
});

test('invoicesToCsv exports valid CSV with escaped commas', () => {
  const clients: Client[] = [
    {
      id: 'c1',
      name: 'Ada Obi',
      company: 'Zeta, Ltd',
      email: 'ada@zeta.example',
      phone: '',
      country: 'NG',
      address: '',
      preferredCurrency: 'USD',
      defaultTermsDays: 14,
      tags: [],
      createdAt: '2026-10-01',
    },
  ];
  const invoices: Invoice[] = [
    {
      id: 'inv1',
      invoiceNumber: 'INV-2026-001',
      clientId: 'c1',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      status: 'paid',
      primaryCurrency: 'USD',
      exchangeRate: 1600,
      dualDisplayMode: 'primary_with_summary',
      items: [
        {
          id: '1',
          title: 'Web App',
          description: '',
          category: 'Web Development',
          quantity: 1,
          unitPrice: 500,
        },
      ],
      taxRatePercent: 0,
      discountPercent: 0,
      notes: '',
      paymentTerms: 'Net 14',
      reminderCount: 0,
    },
  ];

  const csv = invoicesToCsv(invoices, clients);
  assert.ok(csv.includes('"Zeta, Ltd"'));
  assert.ok(csv.includes('500.00,NGN,800000.00'));
});
