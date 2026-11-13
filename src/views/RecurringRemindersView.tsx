import { useState } from 'react';
import {
  BellRing,
  Copy,
  Mail,
  Play,
  Plus,
  Repeat,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BillingFrequency,
  BrandSettings,
  Client,
  CurrencyCode,
  Invoice,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from '../types/billing';
import {
  SUPPORTED_CURRENCIES,
  calculateInvoiceTotals,
  evaluateReminderEligibility,
  formatMoney,
  getDefaultEquivalentCurrency,
  getDefaultPairRate,
  renderReminderTemplate,
} from '../utils/billing';

interface RecurringRemindersViewProps {
  schedules: RecurringSchedule[];
  clients: Client[];
  invoices: Invoice[];
  reminderRules: ReminderRule[];
  reminderLogs: ReminderLog[];
  brand: BrandSettings;
  todayIso: string;
  onSaveSchedule: (schedule: RecurringSchedule) => void;
  onToggleSchedule: (scheduleId: string) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onRunScheduleNow: (scheduleId: string) => void;
  onUpdateRule: (rule: ReminderRule) => void;
  onDispatchReminder: (invoiceId: string, ruleName: string, channel: ReminderLog['channel']) => void;
  onRunAutomatedSweep: () => void;
  onDeleteReminderLog: (logId: string) => void;
  onClearReminderLogs: () => void;
}

export function RecurringRemindersView({
  schedules,
  clients,
  invoices,
  reminderRules,
  reminderLogs,
  brand,
  todayIso,
  onSaveSchedule,
  onToggleSchedule,
  onDeleteSchedule,
  onRunScheduleNow,
  onUpdateRule,
  onDispatchReminder,
  onRunAutomatedSweep,
  onDeleteReminderLog,
  onClearReminderLogs,
}: RecurringRemindersViewProps) {
  const [activeTab, setActiveTab] = useState<'reminders' | 'recurring'>('reminders');
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string>(reminderRules[0]?.id ?? '');
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string>(
    invoices.find((i) => i.status !== 'paid' && i.status !== 'draft')?.id ?? invoices[0]?.id ?? ''
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Recurring Schedule Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [recForm, setRecForm] = useState({
    clientId: clients[0]?.id ?? '',
    title: '',
    frequency: 'monthly' as BillingFrequency,
    primaryCurrency: 'USD' as CurrencyCode,
    unitPrice: 750,
    itemTitle: 'Monthly Analytics & Web Retainer',
    itemCategory: 'Data Analysis' as const,
    nextRunDate: todayIso,
    taxRatePercent: 0,
  });
  const [recError, setRecError] = useState('');

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const eligibleQueue = invoices
    .map((inv) => {
      const evaluation = evaluateReminderEligibility(inv, reminderRules, todayIso);
      if (!evaluation) return null;
      return { invoice: inv, evaluation, client: clientMap.get(inv.clientId) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const activeRule = reminderRules.find((r) => r.id === editingRuleId) ?? reminderRules[0];
  const sampleInvoice = invoices.find((i) => i.id === previewInvoiceId) ?? invoices[0];
  const sampleClient = sampleInvoice ? clientMap.get(sampleInvoice.clientId) : undefined;

  const renderedSubject =
    activeRule && sampleInvoice && sampleClient
      ? renderReminderTemplate(activeRule.subjectTemplate, sampleInvoice, sampleClient, brand.businessName)
      : '';
  const renderedBody =
    activeRule && sampleInvoice && sampleClient
      ? renderReminderTemplate(activeRule.bodyTemplate, sampleInvoice, sampleClient, brand.businessName)
      : '';

  const handleCopyReminder = async (subject: string, body: string, id: string) => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard restricted fallback ignored cleanly
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recForm.clientId) {
      setRecError('Select a client for this recurring schedule.');
      return;
    }
    if (!recForm.title.trim()) {
      setRecError('Provide a schedule name.');
      return;
    }
    if (recForm.unitPrice <= 0) {
      setRecError('Amount must be greater than zero.');
      return;
    }

    const eqCurrency = getDefaultEquivalentCurrency(recForm.primaryCurrency);
    const newSchedule: RecurringSchedule = {
      id: `rec-${Date.now()}`,
      clientId: recForm.clientId,
      title: recForm.title.trim(),
      frequency: recForm.frequency,
      primaryCurrency: recForm.primaryCurrency,
      equivalentCurrency: eqCurrency,
      exchangeRate: getDefaultPairRate(recForm.primaryCurrency, eqCurrency, brand.defaultUsdToNgnRate),
      dualDisplayMode: 'primary_with_summary',
      items: [
        {
          id: `rec-li-${Date.now()}`,
          title: recForm.itemTitle.trim() || recForm.title.trim(),
          description: 'Recurring freelance service retainer.',
          category: recForm.itemCategory,
          quantity: 1,
          unitPrice: Number(recForm.unitPrice),
        },
      ],
      taxRatePercent: Number(recForm.taxRatePercent) || 0,
      nextRunDate: recForm.nextRunDate,
      active: true,
      autoSendReminder: true,
      notes: 'Recurring billing schedule managed via Mitemshub Billing Studio.',
    };

    onSaveSchedule(newSchedule);
    setModalOpen(false);
    setRecError('');
  };

  return (
    <div className="space-y-6">
      {/* Segmented Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
        <div
          className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto items-center gap-1 p-1 bg-[#EAEAE4] rounded-lg max-w-full"
          role="tablist"
          aria-label="Automation sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reminders'}
            onClick={() => setActiveTab('reminders')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors text-center sm:whitespace-nowrap ${
              activeTab === 'reminders'
                ? 'bg-white text-[#111315] shadow-xs'
                : 'text-[#5A6065] hover:text-[#111315]'
            }`}
          >
            <span className="sm:hidden">Reminders ({eligibleQueue.length})</span>
            <span className="hidden sm:inline">
              Automated Payment Reminders ({eligibleQueue.length} ready)
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recurring'}
            onClick={() => setActiveTab('recurring')}
            className={`px-3 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors text-center sm:whitespace-nowrap ${
              activeTab === 'recurring'
                ? 'bg-white text-[#111315] shadow-xs'
                : 'text-[#5A6065] hover:text-[#111315]'
            }`}
          >
            <span className="sm:hidden">Recurring ({schedules.length})</span>
            <span className="hidden sm:inline">
              Recurring Billing Schedules ({schedules.length})
            </span>
          </button>
        </div>

        {activeTab === 'reminders' ? (
          <button
            type="button"
            onClick={onRunAutomatedSweep}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90 self-start sm:self-auto shrink-0"
            style={{ backgroundColor: brand.accentColor }}
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Run Reminder Sweep ({eligibleQueue.length})</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90 self-start sm:self-auto shrink-0"
            style={{ backgroundColor: brand.accentColor }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Recurring Schedule</span>
          </button>
        )}
      </div>

      {activeTab === 'reminders' ? (
        <div className="space-y-6 min-w-0">
          {/* Top Grid: Pending Queue + Dispatch History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Eligible Queue */}
            <section className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E5E0]">
                <h2 className="font-display text-base font-semibold text-[#111315]">
                  Ready for Reminder Dispatch
                </h2>
                <p className="text-xs text-[#5A6065] mt-0.5">
                  Automatically matched against your active reminder cadence rules
                </p>
              </div>

              {eligibleQueue.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#5A6065]">
                  No sent or overdue invoices currently require a reminder.
                </div>
              ) : (
                <div className="divide-y divide-[#F0F0EC]">
                  {eligibleQueue.map(({ invoice, evaluation, client }) => {
                    const totals = calculateInvoiceTotals(
                      invoice.items,
                      invoice.taxRatePercent,
                      invoice.discountPercent,
                      invoice.exchangeRate,
                      invoice.primaryCurrency,
                      invoice.equivalentCurrency,
                      invoice.whtRatePercent ?? 0
                    );
                    const subject = client
                      ? renderReminderTemplate(
                          evaluation.rule.subjectTemplate,
                          invoice,
                          client,
                          brand.businessName
                        )
                      : '';
                    const body = client
                      ? renderReminderTemplate(
                          evaluation.rule.bodyTemplate,
                          invoice,
                          client,
                          brand.businessName
                        )
                      : '';
                    const mailtoHref = client
                      ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(
                          subject
                        )}&body=${encodeURIComponent(body)}`
                      : '#';

                    return (
                      <div key={invoice.id} className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#111315] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <BellRing
                                className={`w-4 h-4 shrink-0 ${
                                  evaluation.daysDeltaFromDue > 0
                                    ? 'text-[#B91C1C]'
                                    : 'text-[#B45309]'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="font-mono whitespace-nowrap">{invoice.invoiceNumber}</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{client?.company || client?.name}</span>
                            </p>
                            <p className="text-xs text-[#5A6065] mt-1">
                              {evaluation.reason} · Matched rule:{' '}
                              <span className="font-medium text-[#111315]">
                                {evaluation.rule.name}
                              </span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-xs font-bold tabular-nums text-[#111315]">
                              {formatMoney(totals.totalPrimary, invoice.primaryCurrency)}
                            </p>
                            <p className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                              {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onDispatchReminder(invoice.id, evaluation.rule.name, 'Manual Trigger')
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                            style={{ backgroundColor: brand.accentColor }}
                          >
                            <Send className="w-3 h-3" aria-hidden="true" />
                            <span>Log &amp; Send Reminder</span>
                          </button>
                          <a
                            href={mailtoHref}
                            onClick={() =>
                              onDispatchReminder(invoice.id, evaluation.rule.name, 'Email Draft')
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] whitespace-nowrap"
                          >
                            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Open in Mail App</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyReminder(subject, body, invoice.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] whitespace-nowrap"
                          >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{copiedId === invoice.id ? 'Copied!' : 'Copy Email'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Activity Log */}
            <section className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-[#E5E5E0] flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-[#111315]">
                    Reminder Dispatch Log
                  </h2>
                  <p className="text-xs text-[#5A6065] mt-0.5">
                    Audit trail of scheduled and manual client payment nudges
                  </p>
                </div>
                {reminderLogs.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {confirmClearLogs ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onClearReminderLogs();
                            setConfirmClearLogs(false);
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#B91C1C] text-white text-[11px] font-semibold hover:bg-[#991B1B] transition-colors"
                        >
                          Confirm Clear ({reminderLogs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearLogs(false)}
                          className="px-2 py-1 rounded-md border border-[#E5E5E0] text-[11px] font-medium text-[#5A6065] hover:text-[#111315]"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClearLogs(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[11px] font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {reminderLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#5A6065]">
                  No reminders dispatched yet.
                </div>
              ) : (
                <div className="divide-y divide-[#F0F0EC] max-h-[380px] overflow-y-auto">
                  {reminderLogs.map((log) => (
                    <div key={log.id} className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#111315] truncate">
                          {log.invoiceNumber} · {log.clientName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] text-[#5A6065] tabular-nums">
                            {log.sentAt.slice(0, 10)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteReminderLog(log.id)}
                            aria-label={`Delete reminder log ${log.invoiceNumber}`}
                            className="p-1 rounded text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[#374151] break-words">{log.subject}</p>
                      <p className="text-[11px] text-[#5A6065]">
                        {log.ruleName} · {log.channel}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Rule Cadence & Template Editor */}
          <section className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E5E0]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#111315]">
                  Automated Reminder Cadence &amp; Email Templates
                </h2>
                <p className="text-xs text-[#5A6065] mt-0.5">
                  Customize trigger timings and dual-currency message templates
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Rule List */}
              <div className="lg:col-span-4 min-w-0 space-y-2.5">
                {reminderRules.map((rule) => {
                  const selected = activeRule?.id === rule.id;
                  return (
                    <div
                      key={rule.id}
                      className={`p-3.5 rounded-lg border transition-colors ${
                        selected
                          ? 'bg-[#F7F7F5] border-[#111315]'
                          : 'bg-white border-[#E5E5E0] hover:bg-[#F7F7F5]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingRuleId(rule.id)}
                          className="text-left text-xs font-semibold text-[#111315] hover:underline"
                        >
                          {rule.name}
                        </button>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[#5A6065] cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => onUpdateRule({ ...rule, enabled: e.target.checked })}
                            className="rounded border-[#E5E5E0]"
                          />
                          <span>Active</span>
                        </label>
                      </div>
                      <p className="text-[11px] text-[#5A6065] mt-1">
                        {rule.triggerType === 'before_due' && `${rule.daysOffset} days before due date`}
                        {rule.triggerType === 'on_due' && 'On the exact due date'}
                        {rule.triggerType === 'after_due' && `${rule.daysOffset} days after due date`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Template Editor + Live Preview */}
              {activeRule && (
                <div className="lg:col-span-8 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="min-w-0 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="rule-name"
                          className="block text-xs font-medium text-[#111315] mb-1"
                        >
                          Rule Name
                        </label>
                        <input
                          id="rule-name"
                          type="text"
                          value={activeRule.name}
                          onChange={(e) => onUpdateRule({ ...activeRule, name: e.target.value })}
                          className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="rule-days"
                          className="block text-xs font-medium text-[#111315] mb-1"
                        >
                          Days Offset
                        </label>
                        <input
                          id="rule-days"
                          type="number"
                          min={0}
                          max={60}
                          value={activeRule.daysOffset}
                          onChange={(e) =>
                            onUpdateRule({ ...activeRule, daysOffset: Number(e.target.value) })
                          }
                          className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="rule-subject"
                        className="block text-xs font-medium text-[#111315] mb-1"
                      >
                        Subject Template
                      </label>
                      <input
                        id="rule-subject"
                        type="text"
                        value={activeRule.subjectTemplate}
                        onChange={(e) =>
                          onUpdateRule({ ...activeRule, subjectTemplate: e.target.value })
                        }
                        className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="rule-body"
                        className="block text-xs font-medium text-[#111315] mb-1"
                      >
                        Message Template
                      </label>
                      <textarea
                        id="rule-body"
                        rows={7}
                        value={activeRule.bodyTemplate}
                        onChange={(e) =>
                          onUpdateRule({ ...activeRule, bodyTemplate: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-xs leading-relaxed"
                      />
                    </div>

                    <p className="text-[11px] text-[#5A6065]">
                      Tokens: <span className="font-mono">{'{{client_name}}'}</span>,{' '}
                      <span className="font-mono">{'{{invoice_number}}'}</span>,{' '}
                      <span className="font-mono">{'{{amount_primary}}'}</span>,{' '}
                      <span className="font-mono">{'{{amount_equivalent}}'}</span>,{' '}
                      <span className="font-mono">{'{{due_date}}'}</span>
                    </p>
                  </div>

                  {/* Rendered Preview */}
                  <div className="min-w-0 bg-[#F7F7F5] border border-[#E5E5E0] rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5E5E0]">
                      <span className="text-[11px] font-semibold text-[#5A6065]">
                        Live Rendered Preview
                      </span>
                      <select
                        aria-label="Preview invoice for template"
                        value={sampleInvoice?.id ?? ''}
                        onChange={(e) => setPreviewInvoiceId(e.target.value)}
                        className="px-2 py-1 border border-[#E5E5E0] rounded bg-white text-[11px] font-mono max-w-full"
                      >
                        {invoices.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoiceNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs font-semibold text-[#111315] break-words">{renderedSubject}</p>
                    <pre className="text-xs text-[#374151] whitespace-pre-wrap break-words font-sans leading-relaxed">
                      {renderedBody}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        /* Recurring Schedules Tab */
        <section className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
          {schedules.length === 0 ? (
            <div className="p-8 sm:p-10 text-center">
              <p className="text-sm font-medium text-[#111315]">No recurring billing schedules</p>
              <p className="text-xs text-[#5A6065] mt-1">
                Set up monthly or quarterly retainers for ongoing data, AI, or web maintenance clients.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: brand.accentColor }}
              >
                New Recurring Schedule
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Card List (< sm) */}
              <div className="sm:hidden divide-y divide-[#F0F0EC]">
                {schedules.map((sched) => {
                  const client = clientMap.get(sched.clientId);
                  const totals = calculateInvoiceTotals(
                    sched.items,
                    sched.taxRatePercent,
                    0,
                    sched.exchangeRate,
                    sched.primaryCurrency,
                    sched.equivalentCurrency,
                    sched.whtRatePercent ?? 0
                  );
                  const isDue = sched.active && sched.nextRunDate <= todayIso;
                  return (
                    <div key={sched.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#111315] flex items-center gap-2">
                            <Repeat className="w-3.5 h-3.5 text-[#5A6065] shrink-0" aria-hidden="true" />
                            <span className="truncate">{sched.title}</span>
                          </p>
                          <p className="text-xs text-[#5A6065] mt-0.5">
                            {client?.company || client?.name || 'Unknown'} ·{' '}
                            <span className="capitalize">{sched.frequency}</span> ·{' '}
                            {sched.active ? 'Active' : 'Paused'}
                          </p>
                          <p className="text-[11px] font-mono mt-1">
                            Next run:{' '}
                            <span className={isDue ? 'font-semibold text-[#B45309]' : 'text-[#111315]'}>
                              {sched.nextRunDate}
                              {isDue ? ' (Due now)' : ''}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                            {formatMoney(totals.totalPrimary, sched.primaryCurrency)}
                          </p>
                          <p className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                            {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onRunScheduleNow(sched.id)}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold text-white whitespace-nowrap"
                            style={{ backgroundColor: brand.accentColor }}
                          >
                            Generate Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleSchedule(sched.id)}
                            className="px-2.5 py-1.5 rounded-md border border-[#E5E5E0] text-xs font-medium text-[#111315]"
                          >
                            {sched.active ? 'Pause' : 'Resume'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteSchedule(sched.id)}
                          aria-label={`Delete schedule ${sched.title}`}
                          className="p-1.5 rounded-md text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tablet & Desktop Table (sm+) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F7F5] border-b border-[#E5E5E0] text-[11px] font-semibold text-[#5A6065]">
                      <th className="py-2.5 px-5">Retainer Schedule</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Cadence</th>
                      <th className="py-2.5 px-3">Next Run</th>
                      <th className="py-2.5 px-3 text-right">Amount (Dual)</th>
                      <th className="py-2.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0EC]">
                    {schedules.map((sched) => {
                      const client = clientMap.get(sched.clientId);
                      const totals = calculateInvoiceTotals(
                        sched.items,
                        sched.taxRatePercent,
                        0,
                        sched.exchangeRate,
                        sched.primaryCurrency,
                        sched.equivalentCurrency,
                        sched.whtRatePercent ?? 0
                      );
                      const isDue = sched.active && sched.nextRunDate <= todayIso;
                      return (
                        <tr key={sched.id} className="hover:bg-[#F7F7F5]/60">
                          <td className="py-3.5 px-5">
                            <p className="text-sm font-semibold text-[#111315] flex items-center gap-2">
                              <Repeat className="w-3.5 h-3.5 text-[#5A6065] shrink-0" aria-hidden="true" />
                              <span>{sched.title}</span>
                            </p>
                            <p className="text-xs text-[#5A6065] mt-0.5">
                              {sched.active ? 'Active' : 'Paused'}
                              {sched.lastGeneratedDate ? ` · Last run ${sched.lastGeneratedDate}` : ''}
                            </p>
                          </td>
                          <td className="py-3.5 px-3 text-xs text-[#111315]">
                            {client?.company || client?.name || 'Unknown'}
                          </td>
                          <td className="py-3.5 px-3 text-xs capitalize text-[#5A6065] hidden md:table-cell">
                            {sched.frequency}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-xs tabular-nums whitespace-nowrap">
                            <span className={isDue ? 'font-semibold text-[#B45309]' : 'text-[#111315]'}>
                              {sched.nextRunDate}
                            </span>
                            {isDue && <span className="block text-[11px] text-[#B45309]">Due now</span>}
                          </td>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                              {formatMoney(totals.totalPrimary, sched.primaryCurrency)}
                            </p>
                            <p className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                              {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                            </p>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onRunScheduleNow(sched.id)}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold text-white whitespace-nowrap"
                                style={{ backgroundColor: brand.accentColor }}
                              >
                                Generate Invoice
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleSchedule(sched.id)}
                                className="px-2.5 py-1.5 rounded-md border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#EAEAE4]"
                              >
                                {sched.active ? 'Pause' : 'Resume'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteSchedule(sched.id)}
                                aria-label={`Delete schedule ${sched.title}`}
                                className="p-1.5 rounded-md text-[#5A6065] hover:text-[#B91C1C]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* New Recurring Schedule Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rec-modal-title"
        >
          <div className="bg-white border border-[#E5E5E0] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E0]">
              <h2 id="rec-modal-title" className="font-display text-lg font-bold text-[#111315]">
                Create Recurring Schedule
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-2 rounded-md text-[#5A6065] hover:text-[#111315]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="mt-4 space-y-4">
              {recError && (
                <div role="alert" className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
                  {recError}
                </div>
              )}

              <div>
                <label htmlFor="rec-client" className="block text-xs font-medium text-[#111315] mb-1">
                  Client *
                </label>
                <select
                  id="rec-client"
                  value={recForm.clientId}
                  onChange={(e) => setRecForm({ ...recForm, clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm bg-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rec-title" className="block text-xs font-medium text-[#111315] mb-1">
                  Schedule Title *
                </label>
                <input
                  id="rec-title"
                  type="text"
                  value={recForm.title}
                  onChange={(e) => setRecForm({ ...recForm, title: e.target.value })}
                  placeholder="e.g. Monthly AI & BI Ops Retainer"
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rec-freq" className="block text-xs font-medium text-[#111315] mb-1">
                    Frequency
                  </label>
                  <select
                    id="rec-freq"
                    value={recForm.frequency}
                    onChange={(e) =>
                      setRecForm({ ...recForm, frequency: e.target.value as BillingFrequency })
                    }
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm bg-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rec-next" className="block text-xs font-medium text-[#111315] mb-1">
                    First Run Date
                  </label>
                  <input
                    id="rec-next"
                    type="date"
                    value={recForm.nextRunDate}
                    onChange={(e) => setRecForm({ ...recForm, nextRunDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rec-curr" className="block text-xs font-medium text-[#111315] mb-1">
                    Primary Currency
                  </label>
                  <select
                    id="rec-curr"
                    value={recForm.primaryCurrency}
                    onChange={(e) =>
                      setRecForm({ ...recForm, primaryCurrency: e.target.value as CurrencyCode })
                    }
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm bg-white max-w-full"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol.trim()}) — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rec-amt" className="block text-xs font-medium text-[#111315] mb-1">
                    Retainer Amount *
                  </label>
                  <input
                    id="rec-amt"
                    type="number"
                    min={1}
                    step="0.01"
                    value={recForm.unitPrice}
                    onChange={(e) => setRecForm({ ...recForm, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5E5E0] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
