import type { BrandSettings, Client, Invoice } from '../types/billing';
import {
  calculateInvoiceTotals,
  calculateLineItemTotal,
  convertCurrency,
  formatMoney,
  formatPairRateLabel,
} from '../utils/billing';
import { BrandLogo } from './BrandLogo';
import { StatusLabel } from './StatusLabel';

interface InvoicePaperProps {
  invoice: Invoice;
  client?: Client;
  brand: BrandSettings;
  compact?: boolean;
}

export function InvoicePaper({ invoice, client, brand, compact = false }: InvoicePaperProps) {
  const whtRatePercent = invoice.whtRatePercent ?? 0;
  const totals = calculateInvoiceTotals(
    invoice.items,
    invoice.taxRatePercent,
    invoice.discountPercent,
    invoice.exchangeRate,
    invoice.primaryCurrency,
    invoice.equivalentCurrency,
    whtRatePercent
  );

  const showDualColumns = invoice.dualDisplayMode === 'dual_columns';
  const showEquivalentSummary = invoice.dualDisplayMode !== 'primary_only';
  const eqCurrency = totals.equivalentCurrency;

  return (
    <article
      aria-label={`Invoice ${invoice.invoiceNumber} preview`}
      className={`print-only-sheet min-w-0 bg-white border border-[#E5E5E0] text-[#111315] rounded-xl ${
        compact ? 'p-4 sm:p-8' : 'p-5 sm:p-10'
      }`}
    >
      {/* Top accent bar */}
      <div
        className="h-1.5 w-full rounded-sm mb-5 sm:mb-7"
        style={{ backgroundColor: brand.accentColor || '#0F5C4D' }}
      />

      {/* Brand + Invoice Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 sm:gap-6 pb-5 sm:pb-7 border-b border-[#E5E5E0]">
        <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
          <BrandLogo
            variant={brand.logoVariant}
            accentColor={brand.accentColor}
            customLogoDataUrl={brand.customLogoDataUrl}
            size={44}
          />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold tracking-tight text-[#111315] break-words">
              {brand.businessName}
            </h2>
            <p className="text-xs text-[#5A6065] mt-0.5 break-words">{brand.tagline}</p>
            <div className="text-xs text-[#5A6065] mt-2 space-y-0.5 leading-relaxed break-words">
              <p>{brand.address}</p>
              <p>
                {brand.email} · {brand.phone}
                {brand.website ? ` · ${brand.website}` : ''}
              </p>
              {brand.taxId && <p className="font-mono text-[11px]">Tax ID: {brand.taxId}</p>}
            </div>
          </div>
        </div>

        <div className="sm:text-right shrink-0">
          <p
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color: brand.accentColor || '#0F5C4D' }}
          >
            Invoice
          </p>
          <p className="font-mono text-sm font-semibold text-[#111315] mt-1 tabular-nums">
            {invoice.invoiceNumber}
          </p>
          <div className="mt-2 sm:flex sm:justify-end">
            <StatusLabel status={invoice.status} />
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs">
            <dt className="text-[#5A6065]">Issued</dt>
            <dd className="font-mono tabular-nums text-[#111315]">{invoice.issueDate}</dd>
            <dt className="text-[#5A6065]">Due</dt>
            <dd className="font-mono tabular-nums font-semibold text-[#111315]">{invoice.dueDate}</dd>
            <dt className="text-[#5A6065]">Terms</dt>
            <dd className="text-[#111315]">{invoice.paymentTerms}</dd>
          </dl>
        </div>
      </div>

      {/* Bill To & Exchange Rate Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-[#E5E5E0]">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-[#5A6065]">Billed To</p>
          {client ? (
            <div className="mt-2 space-y-0.5 text-sm">
              <p className="font-semibold text-[#111315]">{client.company || client.name}</p>
              {client.company && <p className="text-xs text-[#374151]">Attn: {client.name}</p>}
              <p className="text-xs text-[#5A6065]">{client.address || client.country}</p>
              <p className="text-xs text-[#5A6065]">
                {client.email}
                {client.phone ? ` · ${client.phone}` : ''}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#5A6065]">Select a client to populate billing address.</p>
          )}
        </div>

        <div className="sm:text-right">
          <p className="text-[11px] font-semibold tracking-wider text-[#5A6065]">
            Currency & Rate Lock
          </p>
          <div className="mt-2 space-y-1 text-xs">
            <p className="text-[#111315]">
              Primary Currency:{' '}
              <span className="font-mono font-semibold">{invoice.primaryCurrency}</span>
            </p>
            {showEquivalentSummary && (
              <p className="text-[#5A6065]">
                FX Reference:{' '}
                <span className="font-mono tabular-nums text-[#111315]">
                  {formatPairRateLabel(invoice.primaryCurrency, eqCurrency, invoice.exchangeRate)}
                </span>
              </p>
            )}
            <p className="text-[#5A6065]">
              Prepared by <span className="text-[#111315] font-medium">{brand.ownerName}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="py-6 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E0] text-[11px] font-semibold text-[#5A6065]">
              <th className="py-2.5 pr-4">Service & Deliverable</th>
              <th className="py-2.5 px-2 text-right whitespace-nowrap">Qty</th>
              <th className="py-2.5 px-2 text-right whitespace-nowrap">
                Rate ({invoice.primaryCurrency})
              </th>
              <th className="py-2.5 pl-2 text-right whitespace-nowrap">
                Total ({invoice.primaryCurrency})
              </th>
              {showDualColumns && (
                <th className="py-2.5 pl-4 text-right whitespace-nowrap">
                  Eqv ({eqCurrency})
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0EC]">
            {invoice.items.length === 0 ? (
              <tr>
                <td colSpan={showDualColumns ? 5 : 4} className="py-6 text-center text-xs text-[#5A6065]">
                  No line items added yet.
                </td>
              </tr>
            ) : (
              invoice.items.map((item) => {
                const lineTotal = calculateLineItemTotal(item.quantity, item.unitPrice);
                const lineEqv = convertCurrency(
                  lineTotal,
                  invoice.primaryCurrency,
                  eqCurrency,
                  invoice.exchangeRate
                );
                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-3.5 pr-4">
                      <p className="text-sm font-medium text-[#111315]">{item.title || 'Untitled item'}</p>
                      <p className="text-xs text-[#5A6065] mt-0.5 leading-relaxed">
                        {item.category}
                        {item.description ? ` — ${item.description}` : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono text-xs tabular-nums text-[#374151]">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-2 text-right font-mono text-xs tabular-nums text-[#374151] whitespace-nowrap">
                      {formatMoney(item.unitPrice, invoice.primaryCurrency)}
                    </td>
                    <td className="py-3.5 pl-2 text-right font-mono text-xs font-semibold tabular-nums text-[#111315] whitespace-nowrap">
                      {formatMoney(lineTotal, invoice.primaryCurrency)}
                    </td>
                    {showDualColumns && (
                      <td className="py-3.5 pl-4 text-right font-mono text-xs tabular-nums text-[#5A6065] whitespace-nowrap">
                        {formatMoney(lineEqv, eqCurrency)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Summary */}
      <div className="flex flex-col sm:flex-row sm:justify-end pt-4 border-t border-[#E5E5E0]">
        <div className="w-full sm:w-80 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[#5A6065]">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums text-[#111315]">
              {formatMoney(totals.subtotal, invoice.primaryCurrency)}
            </span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex items-center justify-between text-[#5A6065]">
              <span>Discount ({invoice.discountPercent}%)</span>
              <span className="font-mono tabular-nums text-[#15803D]">
                -{formatMoney(totals.discountAmount, invoice.primaryCurrency)}
              </span>
            </div>
          )}
          {invoice.taxRatePercent > 0 && (
            <div className="flex items-center justify-between text-[#5A6065]">
              <span>Tax / VAT ({invoice.taxRatePercent}%)</span>
              <span className="font-mono tabular-nums text-[#111315]">
                {formatMoney(totals.taxAmount, invoice.primaryCurrency)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[#5A6065]">
            <span>WHT ({whtRatePercent}%)</span>
            <span
              className={`font-mono tabular-nums ${
                totals.whtAmount > 0 ? 'text-[#B91C1C]' : 'text-[#5A6065]'
              }`}
            >
              {totals.whtAmount > 0
                ? `-${formatMoney(totals.whtAmount, invoice.primaryCurrency)}`
                : formatMoney(0, invoice.primaryCurrency)}
            </span>
          </div>

          <div className="pt-3 border-t border-[#E5E5E0] flex items-baseline justify-between">
            <span className="text-sm font-semibold text-[#111315]">
              Amount Due ({invoice.primaryCurrency})
            </span>
            <span
              className="font-mono text-lg font-bold tabular-nums"
              style={{ color: brand.accentColor || '#0B3B91' }}
            >
              {formatMoney(totals.totalPrimary, invoice.primaryCurrency)}
            </span>
          </div>

          {showEquivalentSummary && (
            <div className="bg-[#F7F7F5] border border-[#E5E5E0] rounded-lg px-3.5 py-2.5 flex items-baseline justify-between">
              <span className="text-xs font-medium text-[#5A6065]">
                {eqCurrency} Equivalent
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#111315]">
                {formatMoney(totals.totalEquivalent, eqCurrency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Settlement Accounts */}
      <div className="mt-8 pt-6 border-t border-[#E5E5E0] grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
        <div className="min-w-0">
          <p className="font-bold text-[#111315] mb-1.5">USD International Settlement</p>
          <pre className="font-mono text-xs font-semibold leading-relaxed text-[#111315] whitespace-pre-wrap break-words">
            {brand.usdBankDetails}
          </pre>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[#111315] mb-1.5">NGN Local Bank Transfer</p>
          <pre className="font-mono text-xs font-semibold leading-relaxed text-[#111315] whitespace-pre-wrap break-words">
            {brand.ngnBankDetails}
          </pre>
        </div>
      </div>

      {invoice.notes.trim().length > 0 && (
        <div className="mt-6 pt-5 border-t border-[#F0F0EC] text-xs text-[#5A6065] leading-relaxed break-words">
          <p className="font-semibold text-[#111315] mb-1">Notes</p>
          <p>{invoice.notes}</p>
        </div>
      )}
    </article>
  );
}
