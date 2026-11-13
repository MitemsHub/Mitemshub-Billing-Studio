import { ArrowRight, BellRing, Plus, Repeat, Send, Trash2 } from 'lucide-react';
import type {
  BrandSettings,
  Client,
  Invoice,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from '../types/billing';
import {
  calculateInvoiceTotals,
  convertCurrency,
  convertToUsdEstimate,
  evaluateReminderEligibility,
  formatMoney,
} from '../utils/billing';
import { StatusLabel } from '../components/StatusLabel';

interface OverviewViewProps {
  invoices: Invoice[];
  clients: Client[];
  recurringSchedules: RecurringSchedule[];
  reminderRules: ReminderRule[];
  reminderLogs: ReminderLog[];
  brand: BrandSettings;
  todayIso: string;
  onCreateInvoice: () => void;
  onOpenInvoice: (invoiceId: string) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onNavigateInvoices: () => void;
  onNavigateAutomation: () => void;
  onSendReminder: (invoiceId: string, ruleName: string) => void;
  onRunRecurring: (scheduleId: string) => void;
}

export function OverviewView({
  invoices,
  clients,
  recurringSchedules,
  reminderRules,
  reminderLogs,
  brand,
  todayIso,
  onCreateInvoice,
  onOpenInvoice,
  onDeleteInvoice,
  onNavigateInvoices,
  onNavigateAutomation,
  onSendReminder,
  onRunRecurring,
}: OverviewViewProps) {
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  let collectedUsd = 0;
  let outstandingUsd = 0;
  let overdueUsd = 0;

  for (const inv of invoices) {
    const totals = calculateInvoiceTotals(
      inv.items,
      inv.taxRatePercent,
      inv.discountPercent,
      inv.exchangeRate,
      inv.primaryCurrency,
      inv.equivalentCurrency,
      inv.whtRatePercent ?? 0
    );
    const usdAmount = convertToUsdEstimate(
      totals.totalPrimary,
      inv.primaryCurrency,
      brand.defaultUsdToNgnRate,
      inv.exchangeRate,
      totals.equivalentCurrency
    );

    if (inv.status === 'paid') {
      collectedUsd += usdAmount;
    } else if (inv.status === 'overdue') {
      outstandingUsd += usdAmount;
      overdueUsd += usdAmount;
    } else if (inv.status === 'sent') {
      outstandingUsd += usdAmount;
    }
  }

  const collectedNgn = convertCurrency(collectedUsd, 'USD', 'NGN', brand.defaultUsdToNgnRate);
  const outstandingNgn = convertCurrency(outstandingUsd, 'USD', 'NGN', brand.defaultUsdToNgnRate);
  const overdueNgn = convertCurrency(overdueUsd, 'USD', 'NGN', brand.defaultUsdToNgnRate);

  const activeRetainersUsd = recurringSchedules
    .filter((s) => s.active)
    .reduce((sum, s) => {
      const t = calculateInvoiceTotals(
        s.items,
        s.taxRatePercent,
        0,
        s.exchangeRate,
        s.primaryCurrency,
        s.equivalentCurrency,
        s.whtRatePercent ?? 0
      );
      return (
        sum +
        convertToUsdEstimate(
          t.totalPrimary,
          s.primaryCurrency,
          brand.defaultUsdToNgnRate,
          s.exchangeRate,
          t.equivalentCurrency
        )
      );
    }, 0);

  const eligibleReminders = invoices
    .map((inv) => {
      const evaluation = evaluateReminderEligibility(inv, reminderRules, todayIso);
      if (!evaluation) return null;
      return { invoice: inv, evaluation, client: clientMap.get(inv.clientId) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const dueRecurring = recurringSchedules.filter((s) => s.active && s.nextRunDate <= todayIso);

  const recentInvoices = [...invoices]
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section
        aria-label="Financial summary"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#5A6065]">Collected Revenue</p>
          <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#111315] mt-1.5">
            {formatMoney(collectedUsd, 'USD')}
          </p>
          <p className="font-mono text-xs tabular-nums text-[#5A6065] mt-1">
            {formatMoney(collectedNgn, 'NGN')} eqv.
          </p>
        </div>

        <div className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#5A6065]">Outstanding Balance</p>
          <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#111315] mt-1.5">
            {formatMoney(outstandingUsd, 'USD')}
          </p>
          <p className="font-mono text-xs tabular-nums text-[#5A6065] mt-1">
            {formatMoney(outstandingNgn, 'NGN')} eqv.
          </p>
        </div>

        <div className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#5A6065]">Overdue Follow-up</p>
          <p
            className={`font-mono text-xl sm:text-2xl font-bold tabular-nums mt-1.5 ${
              overdueUsd > 0 ? 'text-[#B91C1C]' : 'text-[#111315]'
            }`}
          >
            {formatMoney(overdueUsd, 'USD')}
          </p>
          <p className="font-mono text-xs tabular-nums text-[#5A6065] mt-1">
            {formatMoney(overdueNgn, 'NGN')} eqv.
          </p>
        </div>

        <div className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#5A6065]">Active Retainer Run-Rate</p>
          <p className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#111315] mt-1.5">
            {formatMoney(activeRetainersUsd, 'USD')}
          </p>
          <p className="text-xs text-[#5A6065] mt-1">
            {recurringSchedules.filter((s) => s.active).length} active schedule
            {recurringSchedules.filter((s) => s.active).length === 1 ? '' : 's'}
          </p>
        </div>
      </section>

      {/* Main Split: 8/12 Ledger + 4/12 Automation Queue starting at lg (1024px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 8/12: Recent Invoices */}
        <section className="lg:col-span-8 min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-[#E5E5E0] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-[#111315]">
                Recent Invoices
              </h2>
              <p className="text-xs text-[#5A6065] mt-0.5">
                Multi-currency ledger with NGN &amp; USD equivalents
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateInvoices}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline whitespace-nowrap shrink-0"
              style={{ color: brand.accentColor }}
            >
              <span>View all ({invoices.length})</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-[#111315]">No invoices issued yet</p>
              <p className="text-xs text-[#5A6065] mt-1">
                Create your first branded invoice for a Mitemshub client.
              </p>
              <button
                type="button"
                onClick={onCreateInvoice}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: brand.accentColor }}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Create First Invoice</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Card List (< sm) */}
              <div className="sm:hidden divide-y divide-[#F0F0EC]">
                {recentInvoices.map((inv) => {
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
                  return (
                    <div key={inv.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenInvoice(inv.id)}
                              className="font-mono text-xs font-semibold text-[#111315] hover:underline whitespace-nowrap"
                            >
                              {inv.invoiceNumber}
                            </button>
                            <StatusLabel status={inv.status} />
                          </div>
                          <p className="text-sm font-medium text-[#111315] truncate mt-1">
                            {client?.company || client?.name || 'Unknown client'}
                          </p>
                          <p className="text-xs text-[#5A6065] truncate">
                            {client?.name} · Due <span className="font-mono">{inv.dueDate}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                            {formatMoney(totals.totalPrimary, inv.primaryCurrency)}
                          </p>
                          <p className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                            {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(inv.id)}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: brand.accentColor }}
                        >
                          Open / Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteInvoice(inv.id)}
                          aria-label={`Delete ${inv.invoiceNumber}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Delete</span>
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
                      <th className="py-2.5 px-4">Invoice</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3 hidden xl:table-cell">Due</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                      <th className="py-2.5 pr-4 w-9 text-right">
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0EC]">
                    {recentInvoices.map((inv) => {
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
                      return (
                        <tr key={inv.id} className="hover:bg-[#F7F7F5]/60 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onOpenInvoice(inv.id)}
                              className="font-mono text-xs font-semibold text-[#111315] hover:underline whitespace-nowrap"
                            >
                              {inv.invoiceNumber}
                            </button>
                            <p className="font-mono text-[11px] tabular-nums text-[#5A6065] xl:hidden mt-0.5">
                              Due {inv.dueDate}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="text-sm font-medium text-[#111315] truncate max-w-[160px] xl:max-w-[180px]">
                              {client?.company || client?.name || 'Unknown client'}
                            </p>
                            <p className="text-xs text-[#5A6065] truncate max-w-[160px] xl:max-w-[180px]">
                              {client?.name}
                            </p>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs tabular-nums text-[#5A6065] whitespace-nowrap hidden xl:table-cell">
                            {inv.dueDate}
                          </td>
                          <td className="py-3 px-3">
                            <StatusLabel status={inv.status} />
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                              {formatMoney(totals.totalPrimary, inv.primaryCurrency)}
                            </p>
                            <p className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                              {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onDeleteInvoice(inv.id)}
                              aria-label={`Delete ${inv.invoiceNumber}`}
                              title={`Delete ${inv.invoiceNumber}`}
                              className="p-1.5 rounded-md text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

        {/* Right 4/12: Compact Automation Queue */}
        <section className="lg:col-span-4 min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-[#E5E5E0] flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#111315]">
                Automation Queue
              </h2>
              <p className="text-xs text-[#5A6065] mt-0.5">
                Reminders &amp; recurring runs ready today
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateAutomation}
              className="text-xs font-semibold hover:underline whitespace-nowrap shrink-0"
              style={{ color: brand.accentColor }}
            >
              Configure
            </button>
          </div>

          <div className="divide-y divide-[#F0F0EC]">
            {eligibleReminders.length === 0 && dueRecurring.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5A6065]">
                All payment reminders and recurring billing schedules are up to date.
              </div>
            ) : (
              <>
                {dueRecurring.map((sched) => {
                  const client = clientMap.get(sched.clientId);
                  return (
                    <div key={sched.id} className="p-4 flex flex-col gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111315] flex items-center gap-1.5">
                          <Repeat className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" aria-hidden="true" />
                          <span className="truncate">{sched.title}</span>
                        </p>
                        <p className="text-xs text-[#5A6065] mt-1">
                          {client?.company || client?.name} · Next run {sched.nextRunDate}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-[#5A6065] capitalize">
                          {sched.frequency}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRunRecurring(sched.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E0] bg-white text-xs font-semibold text-[#111315] hover:bg-[#F7F7F5] transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>Generate Invoice</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {eligibleReminders.map(({ invoice, evaluation, client }) => (
                  <div key={invoice.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#111315] flex items-center gap-1.5">
                          <BellRing
                            className={`w-3.5 h-3.5 shrink-0 ${
                              evaluation.daysDeltaFromDue > 0 ? 'text-[#B91C1C]' : 'text-[#B45309]'
                            }`}
                            aria-hidden="true"
                          />
                          <span>
                            {invoice.invoiceNumber} · {evaluation.reason}
                          </span>
                        </p>
                        <p className="text-xs text-[#5A6065] mt-1 leading-relaxed">
                          {client?.name} ({client?.company}) · {evaluation.rule.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(invoice.id)}
                        className="text-xs font-medium text-[#5A6065] hover:text-[#111315] hover:underline whitespace-nowrap"
                      >
                        View Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendReminder(invoice.id, evaluation.rule.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                        style={{ backgroundColor: brand.accentColor }}
                      >
                        <Send className="w-3 h-3" aria-hidden="true" />
                        <span>Send Reminder</span>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {reminderLogs.length > 0 && (
            <div className="px-5 py-3 bg-[#F7F7F5] border-t border-[#E5E5E0] text-[11px] text-[#5A6065]">
              Last activity: {reminderLogs[0].invoiceNumber} · {reminderLogs[0].ruleName}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
