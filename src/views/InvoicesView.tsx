import { useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  BrandSettings,
  Client,
  CurrencyCode,
  DualCurrencyDisplayMode,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from '../types/billing';
import { SERVICE_PRESETS } from '../data/seedData';
import {
  SUPPORTED_CURRENCIES,
  calculateInvoiceTotals,
  convertCurrency,
  formatMoney,
  getDefaultEquivalentCurrency,
  getDefaultPairRate,
  invoicesToCsv,
  isInverseNgnToUsdPair,
} from '../utils/billing';
import { InvoicePaper } from '../components/InvoicePaper';
import { StatusLabel } from '../components/StatusLabel';

interface InvoicesViewProps {
  invoices: Invoice[];
  clients: Client[];
  brand: BrandSettings;
  editingInvoice: Invoice | null;
  onSelectInvoice: (invoice: Invoice | null) => void;
  onStartNewInvoice: (clientId?: string) => void;
  onSaveInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onUpdateStatus: (invoiceId: string, status: InvoiceStatus) => void;
  onSendReminder: (invoiceId: string, ruleName: string) => void;
}

export function InvoicesView({
  invoices,
  clients,
  brand,
  editingInvoice,
  onSelectInvoice,
  onStartNewInvoice,
  onSaveInvoice,
  onDeleteInvoice,
  onUpdateStatus,
  onSendReminder,
}: InvoicesViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Invoice | null>(editingInvoice);
  const [validationError, setValidationError] = useState('');
  const [mobileEditorTab, setMobileEditorTab] = useState<'edit' | 'preview'>('edit');
  const [confirmDeleteEditor, setConfirmDeleteEditor] = useState(false);

  if (editingInvoice && (!draft || draft.id !== editingInvoice.id)) {
    setDraft(editingInvoice);
    setValidationError('');
    setConfirmDeleteEditor(false);
  } else if (!editingInvoice && draft) {
    setDraft(null);
    setConfirmDeleteEditor(false);
  }

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const filteredInvoices = invoices
    .filter((inv) => {
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const client = clientMap.get(inv.clientId);
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (client?.name.toLowerCase().includes(q) ?? false) ||
        (client?.company.toLowerCase().includes(q) ?? false);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const handleExportCsv = () => {
    const csv = invoicesToCsv(filteredInvoices, clients);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mitemshub-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- EDITOR / PREVIEW WORKSPACE ---
  if (draft) {
    const activeClient = clientMap.get(draft.clientId);
    const eqCurrency =
      draft.equivalentCurrency ?? getDefaultEquivalentCurrency(draft.primaryCurrency);
    const totals = calculateInvoiceTotals(
      draft.items,
      draft.taxRatePercent,
      draft.discountPercent,
      draft.exchangeRate,
      draft.primaryCurrency,
      eqCurrency,
      draft.whtRatePercent ?? 0
    );

    const handleDownloadPdf = () => {
      const previousTitle = document.title;
      document.title = `${draft.invoiceNumber || 'Invoice'} - ${brand.businessName}`;
      const restoreTitle = () => {
        document.title = previousTitle;
        window.removeEventListener('afterprint', restoreTitle);
      };
      window.addEventListener('afterprint', restoreTitle);
      window.print();
      setTimeout(restoreTitle, 1000);
    };

    const updateDraft = (patch: Partial<Invoice>) => {
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    const handleCurrencyChange = (nextPrimary: CurrencyCode, nextEq?: CurrencyCode) => {
      const resolvedEq =
        nextEq ??
        (nextPrimary === eqCurrency
          ? getDefaultEquivalentCurrency(nextPrimary)
          : eqCurrency);

      const conversionRate = getDefaultPairRate(
        draft.primaryCurrency,
        nextPrimary,
        brand.defaultUsdToNgnRate
      );
      const convertedItems =
        nextPrimary === draft.primaryCurrency
          ? draft.items
          : draft.items.map((item) => ({
              ...item,
              unitPrice: convertCurrency(
                item.unitPrice,
                draft.primaryCurrency,
                nextPrimary,
                conversionRate
              ),
            }));

      const nextPairRate = getDefaultPairRate(
        nextPrimary,
        resolvedEq,
        brand.defaultUsdToNgnRate
      );

      updateDraft({
        primaryCurrency: nextPrimary,
        equivalentCurrency: resolvedEq,
        exchangeRate: nextPairRate,
        items: convertedItems,
      });
    };

    const updateLineItem = (id: string, patch: Partial<InvoiceLineItem>) => {
      updateDraft({
        items: draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      });
    };

    const addLineItem = (preset?: (typeof SERVICE_PRESETS)[number]) => {
      const usdToPrimaryRate = getDefaultPairRate(
        'USD',
        draft.primaryCurrency,
        brand.defaultUsdToNgnRate
      );
      const basePrice = preset
        ? draft.primaryCurrency === 'USD'
          ? preset.defaultUsdPrice
          : convertCurrency(preset.defaultUsdPrice, 'USD', draft.primaryCurrency, usdToPrimaryRate)
        : 0;

      const newItem: InvoiceLineItem = {
        id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: preset?.title || '',
        description: preset?.description || '',
        category: preset?.category || 'Web Development',
        quantity: 1,
        unitPrice: basePrice,
      };
      updateDraft({ items: [...draft.items, newItem] });
    };

    const removeLineItem = (id: string) => {
      updateDraft({ items: draft.items.filter((i) => i.id !== id) });
    };

    const handleSave = (targetStatus?: InvoiceStatus) => {
      if (!draft.clientId) {
        setValidationError('Please select a client before saving.');
        return;
      }
      if (!draft.invoiceNumber.trim()) {
        setValidationError('Invoice number is required.');
        return;
      }
      if (draft.items.length === 0) {
        setValidationError('Add at least one line item to the invoice.');
        return;
      }
      if (draft.exchangeRate <= 0) {
        setValidationError('Exchange rate must be greater than zero.');
        return;
      }
      setValidationError('');
      const toSave: Invoice = {
        ...draft,
        equivalentCurrency: eqCurrency,
        status: targetStatus ?? draft.status,
      };
      setDraft(toSave);
      onSaveInvoice(toSave);
    };

    const rateInputLabel = isInverseNgnToUsdPair(draft.primaryCurrency, eqCurrency)
      ? 'FX Rate (1 USD = ₦ NGN)'
      : `FX Rate (1 ${draft.primaryCurrency} = ${eqCurrency})`;

    return (
      <div className="space-y-5">
        {/* Top Action Ribbon */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E5E0]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onSelectInvoice(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#5A6065] hover:text-[#111315] whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Ledger</span>
            </button>

            {/* Mobile/Tablet View Switcher */}
            <div className="lg:hidden inline-flex items-center gap-1 p-1 bg-[#EAEAE4] rounded-lg">
              <button
                type="button"
                onClick={() => setMobileEditorTab('edit')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mobileEditorTab === 'edit' ? 'bg-white text-[#111315] shadow-xs' : 'text-[#5A6065]'
                }`}
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileEditorTab('preview')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  mobileEditorTab === 'preview'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#5A6065]'
                }`}
              >
                <Eye className="w-3 h-3" aria-hidden="true" />
                <span>Preview</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {confirmDeleteEditor ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onDeleteInvoice(draft.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#B91C1C] text-xs font-semibold text-white hover:opacity-90 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Confirm Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEditor(false)}
                  className="px-2.5 py-2 rounded-lg border border-[#E5E5E0] bg-white text-xs font-medium text-[#5A6065] hover:text-[#111315]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteEditor(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#FECACA] bg-white text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] whitespace-nowrap"
                title="Delete this invoice"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E5E0] bg-white text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] whitespace-nowrap"
              title="Generate clean A4 PDF via browser print dialog"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download PDF</span>
            </button>

            {draft.status !== 'paid' && (
              <button
                type="button"
                onClick={() => handleSave('paid')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E5E0] bg-white text-xs font-medium text-[#15803D] hover:bg-[#F7F7F5] whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mark Paid</span>
              </button>
            )}

            {(draft.status === 'sent' || draft.status === 'overdue') && (
              <button
                type="button"
                onClick={() => onSendReminder(draft.id, 'Manual Follow-up')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E5E0] bg-white text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] whitespace-nowrap"
              >
                <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Send Reminder</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5E5E0] bg-white text-xs font-semibold text-[#111315] hover:bg-[#F7F7F5] whitespace-nowrap"
            >
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave('sent')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90"
              style={{ backgroundColor: brand.accentColor }}
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save &amp; Mark Sent</span>
            </button>
          </div>
        </div>

        {validationError && (
          <div
            role="alert"
            className="no-print p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]"
          >
            {validationError}
          </div>
        )}

        {/* Split Pane starting at lg (1024px) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 cols: Structured Invoice Builder */}
          <div
            className={`no-print lg:col-span-5 min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-5 space-y-6 ${
              mobileEditorTab === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div>
              <h2 className="font-display text-base font-bold text-[#111315]">Invoice Details</h2>
              <p className="text-xs text-[#5A6065] mt-0.5">
                Configure client, dates, and multi-currency conversion
              </p>
            </div>

            {/* Client & Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="inv-client" className="block text-xs font-medium text-[#111315] mb-1">
                  Client *
                </label>
                <select
                  id="inv-client"
                  value={draft.clientId}
                  onChange={(e) => {
                    const nextClient = clientMap.get(e.target.value);
                    updateDraft({ clientId: e.target.value });
                    if (nextClient && nextClient.preferredCurrency !== draft.primaryCurrency) {
                      handleCurrencyChange(nextClient.preferredCurrency);
                    }
                  }}
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company ? `${c.company} (${c.name})` : c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inv-num" className="block text-xs font-medium text-[#111315] mb-1">
                  Invoice Number *
                </label>
                <input
                  id="inv-num"
                  type="text"
                  value={draft.invoiceNumber}
                  onChange={(e) => updateDraft({ invoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                />
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="inv-issue" className="block text-xs font-medium text-[#111315] mb-1">
                  Issue Date
                </label>
                <input
                  id="inv-issue"
                  type="date"
                  value={draft.issueDate}
                  onChange={(e) => updateDraft({ issueDate: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                />
              </div>
              <div>
                <label htmlFor="inv-due" className="block text-xs font-medium text-[#111315] mb-1">
                  Due Date
                </label>
                <input
                  id="inv-due"
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => updateDraft({ dueDate: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                />
              </div>
              <div>
                <label htmlFor="inv-status" className="block text-xs font-medium text-[#111315] mb-1">
                  Status
                </label>
                <select
                  id="inv-status"
                  value={draft.status}
                  onChange={(e) => updateDraft({ status: e.target.value as InvoiceStatus })}
                  className="w-full px-2.5 py-2 border border-[#E5E5E0] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            {/* Multi-Currency Conversion Engine */}
            <div className="pt-4 border-t border-[#E5E5E0] space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#111315]">
                  Multi-Currency &amp; Equivalent
                </p>
                <span className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                  Eqv: {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="inv-primary-curr" className="block text-xs font-medium text-[#111315] mb-1">
                    Primary Currency
                  </label>
                  <select
                    id="inv-primary-curr"
                    value={draft.primaryCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
                    className="w-full px-2.5 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol.trim()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="inv-eq-curr" className="block text-xs font-medium text-[#111315] mb-1">
                    Equivalent Currency
                  </label>
                  <select
                    id="inv-eq-curr"
                    value={eqCurrency}
                    onChange={(e) =>
                      handleCurrencyChange(draft.primaryCurrency, e.target.value as CurrencyCode)
                    }
                    className="w-full px-2.5 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol.trim()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="inv-rate" className="block text-xs font-medium text-[#111315] mb-1 truncate">
                    {rateInputLabel}
                  </label>
                  <input
                    id="inv-rate"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={draft.exchangeRate}
                    onChange={(e) => updateDraft({ exchangeRate: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-[#E5E5E0] rounded-lg text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="inv-dual-mode" className="block text-xs font-medium text-[#111315] mb-1">
                  Invoice Paper Currency Display
                </label>
                <select
                  id="inv-dual-mode"
                  value={draft.dualDisplayMode}
                  onChange={(e) =>
                    updateDraft({ dualDisplayMode: e.target.value as DualCurrencyDisplayMode })
                  }
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                >
                  <option value="primary_with_summary">
                    Primary line items + Equivalent total summary box
                  </option>
                  <option value="dual_columns">
                    Side-by-side {draft.primaryCurrency} &amp; {eqCurrency} columns on every line item
                  </option>
                  <option value="primary_only">Primary currency only</option>
                </select>
              </div>
            </div>

            {/* Quick Mitemshub Service Presets */}
            <div className="pt-4 border-t border-[#E5E5E0] space-y-2.5">
              <p className="text-xs font-semibold text-[#111315]">Quick-Add Mitemshub Services</p>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => addLineItem(preset)}
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E5E0] bg-[#F7F7F5] hover:bg-[#EAEAE4] text-[11px] font-medium text-[#111315] transition-colors whitespace-nowrap"
                  >
                    + {preset.category}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Items Editor */}
            <div className="pt-4 border-t border-[#E5E5E0] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#111315]">
                  Line Items ({draft.items.length})
                </p>
                <button
                  type="button"
                  onClick={() => addLineItem()}
                  className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: brand.accentColor }}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Custom Item</span>
                </button>
              </div>

              <div className="divide-y divide-[#E5E5E0]">
                {draft.items.map((item, idx) => (
                  <div key={item.id} className="py-3.5 first:pt-1 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-[#5A6065]">Item 0{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        aria-label={`Remove line item ${item.title || idx + 1}`}
                        className="p-1 text-[#5A6065] hover:text-[#B91C1C]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateLineItem(item.id, { title: e.target.value })}
                      placeholder="Service title (e.g. Custom Dashboard)"
                      aria-label={`Item ${idx + 1} title`}
                      className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                    />

                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                      placeholder="Scope or deliverable summary"
                      aria-label={`Item ${idx + 1} description`}
                      className="w-full px-3 py-1.5 border border-[#E5E5E0] rounded-lg text-xs text-[#5A6065] focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="col-span-2 sm:col-span-1">
                        <label
                          htmlFor={`cat-${item.id}`}
                          className="block text-[10px] text-[#5A6065] mb-0.5"
                        >
                          Category
                        </label>
                        <select
                          id={`cat-${item.id}`}
                          value={item.category}
                          onChange={(e) =>
                            updateLineItem(item.id, {
                              category: e.target.value as InvoiceLineItem['category'],
                            })
                          }
                          className="w-full px-2 py-1.5 border border-[#E5E5E0] rounded-lg text-[11px] bg-white"
                        >
                          <option value="Data Analysis">Data Analysis</option>
                          <option value="AI Engineering">AI Engineering</option>
                          <option value="Web Development">Web Development</option>
                          <option value="Consulting">Consulting</option>
                          <option value="Infrastructure">Infrastructure</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`qty-${item.id}`}
                          className="block text-[10px] text-[#5A6065] mb-0.5"
                        >
                          Qty
                        </label>
                        <input
                          id={`qty-${item.id}`}
                          type="number"
                          min={0}
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(item.id, { quantity: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`price-${item.id}`}
                          className="block text-[10px] text-[#5A6065] mb-0.5"
                        >
                          Price ({draft.primaryCurrency})
                        </label>
                        <input
                          id={`price-${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(item.id, { unitPrice: Number(e.target.value) })
                          }
                          className="w-full px-2 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax, WHTax, Discount & Notes */}
            <div className="pt-4 border-t border-[#E5E5E0] space-y-3.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="inv-tax" className="block text-xs font-medium text-[#111315] mb-1">
                    Tax / VAT (%)
                  </label>
                  <input
                    id="inv-tax"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={draft.taxRatePercent}
                    onChange={(e) => updateDraft({ taxRatePercent: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="inv-wht" className="block text-xs font-medium text-[#111315] mb-1">
                    WHT (%)
                  </label>
                  <input
                    id="inv-wht"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={draft.whtRatePercent ?? 0}
                    onChange={(e) => updateDraft({ whtRatePercent: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="inv-disc" className="block text-xs font-medium text-[#111315] mb-1">
                    Discount (%)
                  </label>
                  <input
                    id="inv-disc"
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={draft.discountPercent}
                    onChange={(e) => updateDraft({ discountPercent: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 border border-[#E5E5E0] rounded-lg text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="inv-terms" className="block text-xs font-medium text-[#111315] mb-1">
                    Terms
                  </label>
                  <input
                    id="inv-terms"
                    type="text"
                    value={draft.paymentTerms}
                    onChange={(e) => updateDraft({ paymentTerms: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#E5E5E0] rounded-lg text-xs"
                  />
                </div>
              </div>

              {(draft.whtRatePercent ?? 0) > 0 && (
                <p className="text-[11px] text-[#5A6065] font-mono tabular-nums">
                  Computed WHT deduction ({draft.whtRatePercent}%):{' '}
                  <span className="font-semibold text-[#B91C1C]">
                    -{formatMoney(totals.whtAmount, draft.primaryCurrency)}
                  </span>
                </p>
              )}

              <div>
                <label htmlFor="inv-notes" className="block text-xs font-medium text-[#111315] mb-1">
                  Invoice Notes
                </label>
                <textarea
                  id="inv-notes"
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                />
              </div>
            </div>
          </div>

          {/* Right 7 cols: Live Branded A4 Preview */}
          <div
            className={`print-preview-pane lg:col-span-7 min-w-0 ${
              mobileEditorTab === 'edit' ? 'hidden lg:block' : 'block'
            }`}
          >
            <InvoicePaper invoice={draft} client={activeClient} brand={brand} />
          </div>
        </div>
      </div>
    );
  }

  // --- LEDGER TABLE VIEW ---
  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto min-w-0">
          <div className="relative w-full sm:w-64 min-w-0">
            <Search
              className="w-4 h-4 text-[#5A6065] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice # or client..."
              aria-label="Search invoices"
              className="pl-9 pr-3 py-2 bg-white border border-[#E5E5E0] rounded-lg text-sm text-[#111315] placeholder:text-[#5A6065] focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30 w-full"
            />
          </div>

          <div
            className="inline-flex items-center gap-1 p-1 bg-[#EAEAE4] rounded-lg overflow-x-auto max-w-full"
            role="group"
            aria-label="Filter invoices by status"
          >
            {(['all', 'draft', 'sent', 'overdue', 'paid'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#5A6065] hover:text-[#111315]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E5E5E0] bg-white text-xs font-medium text-[#111315] hover:bg-[#F7F7F5] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => onStartNewInvoice()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition-opacity hover:opacity-90"
            style={{ backgroundColor: brand.accentColor }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      <section className="min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-[#111315]">No invoices match your filter</p>
            <p className="text-xs text-[#5A6065] mt-1">
              Reset filters or generate a new multi-currency invoice.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {(statusFilter !== 'all' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearch('');
                  }}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5]"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => onStartNewInvoice()}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: brand.accentColor }}
              >
                New Invoice
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card List (< sm) */}
            <div className="sm:hidden divide-y divide-[#F0F0EC]">
              {filteredInvoices.map((inv) => {
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onSelectInvoice(inv)}
                            className="font-mono text-xs font-semibold text-[#111315] hover:underline whitespace-nowrap"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <StatusLabel
                            status={inv.status}
                            extraText={
                              inv.reminderCount > 0 ? `${inv.reminderCount} reminded` : undefined
                            }
                          />
                        </div>
                        <p className="text-sm font-medium text-[#111315] truncate mt-1">
                          {client?.company || client?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-[#5A6065] truncate">
                          {inv.issueDate} → <span className="text-[#111315]">{inv.dueDate}</span>
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
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectInvoice(inv)}
                          className="px-2.5 py-1.5 rounded-md border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#EAEAE4]"
                        >
                          Edit
                        </button>
                        {inv.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(inv.id, 'paid')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E5E0] text-xs font-medium text-[#15803D] hover:bg-[#EAEAE4]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Mark Paid</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteInvoice(inv.id)}
                        aria-label={`Delete ${inv.invoiceNumber}`}
                        className="p-1.5 rounded-md text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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
                    <th className="py-2.5 px-5">Invoice #</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Issued / Due</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right hidden lg:table-cell">Equivalent</th>
                    <th className="py-2.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0EC]">
                  {filteredInvoices.map((inv) => {
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
                        <td className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() => onSelectInvoice(inv)}
                            className="font-mono text-xs font-semibold text-[#111315] hover:underline whitespace-nowrap"
                          >
                            {inv.invoiceNumber}
                          </button>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-sm font-medium text-[#111315] truncate max-w-[200px]">
                            {client?.company || client?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-[#5A6065] truncate max-w-[200px]">
                            {client?.email}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs tabular-nums text-[#5A6065] whitespace-nowrap hidden md:table-cell">
                          <span>{inv.issueDate}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="text-[#111315]">{inv.dueDate}</span>
                        </td>
                        <td className="py-3.5 px-3">
                          <StatusLabel
                            status={inv.status}
                            extraText={
                              inv.reminderCount > 0 ? `${inv.reminderCount} reminded` : undefined
                            }
                          />
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                            {formatMoney(totals.totalPrimary, inv.primaryCurrency)}
                          </p>
                          <p className="font-mono text-[11px] tabular-nums text-[#5A6065] lg:hidden">
                            {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-[#5A6065] whitespace-nowrap hidden lg:table-cell">
                          {formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectInvoice(inv)}
                              className="px-2.5 py-1.5 rounded-md border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#EAEAE4]"
                            >
                              Edit
                            </button>
                            {inv.status !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(inv.id, 'paid')}
                                className="p-1.5 rounded-md text-[#15803D] hover:bg-[#EAEAE4]"
                                aria-label={`Mark ${inv.invoiceNumber} as paid`}
                                title="Mark as Paid"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteInvoice(inv.id)}
                              className="p-1.5 rounded-md text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#EAEAE4]"
                              aria-label={`Delete ${inv.invoiceNumber}`}
                              title="Delete invoice"
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
    </div>
  );
}
