import { useState } from 'react';
import { FilePlus2, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react';
import type { BrandSettings, Client, CurrencyCode, Invoice } from '../types/billing';
import {
  CURRENCY_META,
  SUPPORTED_CURRENCIES,
  calculateInvoiceTotals,
  convertCurrency,
  convertToUsdEstimate,
  formatMoney,
} from '../utils/billing';

interface ClientsViewProps {
  clients: Client[];
  invoices: Invoice[];
  brand: BrandSettings;
  onSaveClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onCreateInvoiceForClient: (clientId: string) => void;
}

const COMMON_COUNTRIES = [
  'Nigeria',
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'France',
  'Netherlands',
  'Australia',
  'Ghana',
  'Kenya',
  'South Africa',
  'United Arab Emirates',
  'Other',
];

const EMPTY_CLIENT_FORM = {
  id: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  country: 'Nigeria',
  customCountry: '',
  address: '',
  preferredCurrency: 'USD' as CurrencyCode,
  defaultTermsDays: 14,
  tagsInput: 'Web Development',
};

export function ClientsView({
  clients,
  invoices,
  brand,
  onSaveClient,
  onDeleteClient,
  onCreateInvoiceForClient,
}: ClientsViewProps) {
  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | CurrencyCode>('ALL');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CLIENT_FORM);
  const [formError, setFormError] = useState('');

  const filteredClients = clients.filter((c) => {
    const matchesCurrency = currencyFilter === 'ALL' || c.preferredCurrency === currencyFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q);
    return matchesCurrency && matchesSearch;
  });

  const selectedClient =
    clients.find((c) => c.id === selectedClientId) ?? filteredClients[0] ?? null;

  const getClientStats = (clientId: string) => {
    const clientInvoices = invoices.filter((inv) => inv.clientId === clientId);
    let billedUsd = 0;
    let outstandingUsd = 0;
    for (const inv of clientInvoices) {
      const totals = calculateInvoiceTotals(
        inv.items,
        inv.taxRatePercent,
        inv.discountPercent,
        inv.exchangeRate,
        inv.primaryCurrency,
        inv.equivalentCurrency
      );
      const usd = convertToUsdEstimate(
        totals.totalPrimary,
        inv.primaryCurrency,
        brand.defaultUsdToNgnRate,
        inv.exchangeRate,
        totals.equivalentCurrency
      );
      billedUsd += usd;
      if (inv.status !== 'paid' && inv.status !== 'draft') {
        outstandingUsd += usd;
      }
    }
    return { count: clientInvoices.length, billedUsd, outstandingUsd, clientInvoices };
  };

  const openAddModal = () => {
    setForm(EMPTY_CLIENT_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    const isKnownCountry = COMMON_COUNTRIES.includes(client.country);
    setForm({
      id: client.id,
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
      country: isKnownCountry ? client.country : 'Other',
      customCountry: isKnownCountry ? '' : client.country,
      address: client.address,
      preferredCurrency: client.preferredCurrency,
      defaultTermsDays: client.defaultTermsDays,
      tagsInput: client.tags.join(', '),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Client contact name is required.');
      return;
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      setFormError('A valid billing email address is required.');
      return;
    }

    const finalCountry =
      form.country === 'Other'
        ? form.customCountry.trim() || 'International'
        : form.country.trim() || 'Nigeria';

    const saved: Client = {
      id: form.id || `cli-${Date.now()}`,
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: finalCountry,
      address: form.address.trim(),
      preferredCurrency: form.preferredCurrency,
      defaultTermsDays: Math.max(0, Number(form.defaultTermsDays) || 14),
      tags: form.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt:
        clients.find((c) => c.id === form.id)?.createdAt ||
        new Date().toISOString().slice(0, 10),
    };

    onSaveClient(saved);
    setSelectedClientId(saved.id);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="relative w-full sm:w-64 min-w-0">
            <Search
              className="w-4 h-4 text-[#5A6065] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, or country..."
              aria-label="Search clients"
              className="pl-9 pr-3 py-2 bg-white border border-[#E5E5E0] rounded-lg text-sm text-[#111315] placeholder:text-[#5A6065] focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30 w-full"
            />
          </div>

          <select
            aria-label="Filter clients by billing currency"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value as 'ALL' | CurrencyCode)}
            className="w-full sm:w-auto max-w-full px-3 py-2 bg-white border border-[#E5E5E0] rounded-lg text-xs font-medium text-[#111315] focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
          >
            <option value="ALL">All Currencies ({clients.length})</option>
            {SUPPORTED_CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.code} ({curr.symbol.trim()}) — {curr.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 self-start sm:self-auto"
          style={{ backgroundColor: brand.accentColor }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Client</span>
        </button>
      </div>

      {/* Directory + Detail Split starting at lg (1024px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 xl:col-span-8 min-w-0 bg-white border border-[#E5E5E0] rounded-xl overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-[#111315]">No matching clients</p>
              <p className="text-xs text-[#5A6065] mt-1">
                {search || currencyFilter !== 'ALL'
                  ? 'Clear your search filter or add a new client record.'
                  : 'Add your first client to start issuing branded invoices.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                {(search || currencyFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCurrencyFilter('ALL');
                    }}
                    className="px-3.5 py-2 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5]"
                  >
                    Reset Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  Add Client
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card List (< sm) */}
              <div className="sm:hidden divide-y divide-[#F0F0EC]">
                {filteredClients.map((client) => {
                  const stats = getClientStats(client.id);
                  const isSelected = selectedClient?.id === client.id;
                  return (
                    <div
                      key={client.id}
                      className={`p-4 space-y-3 transition-colors ${
                        isSelected ? 'bg-[#F7F7F5]' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                          className="text-left min-w-0 flex-1"
                        >
                          <p className="text-sm font-semibold text-[#111315] truncate">
                            {client.company || client.name}
                          </p>
                          <p className="text-xs text-[#5A6065] mt-0.5 truncate">
                            {client.name} · {client.country}
                          </p>
                        </button>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                            {formatMoney(stats.billedUsd, 'USD')}
                          </p>
                          <p className="text-[11px] text-[#5A6065]">
                            <span className="font-mono font-semibold text-[#111315]">
                              {client.preferredCurrency}
                            </span>{' '}
                            · Net {client.defaultTermsDays}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onCreateInvoiceForClient(client.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#E5E5E0] bg-white text-xs font-medium text-[#111315]"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>New Invoice</span>
                        </button>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E5E0] bg-white text-xs font-medium text-[#111315]"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteClient(client.id)}
                            aria-label={`Delete ${client.name}`}
                            className="p-1.5 rounded-md text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
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
                      <th className="py-2.5 px-5">Client / Company</th>
                      <th className="py-2.5 px-3">Billing Pref</th>
                      <th className="py-2.5 px-3 text-right">Billed (USD Eqv)</th>
                      <th className="py-2.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0EC]">
                    {filteredClients.map((client) => {
                      const stats = getClientStats(client.id);
                      const isSelected = selectedClient?.id === client.id;
                      return (
                        <tr
                          key={client.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-[#F7F7F5]' : 'hover:bg-[#F7F7F5]/60'
                          }`}
                        >
                          <td className="py-3.5 px-5 min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedClientId(client.id)}
                              className="text-left group max-w-full"
                            >
                              <p className="text-sm font-semibold text-[#111315] group-hover:underline">
                                {client.company || client.name}
                              </p>
                              <p className="text-xs text-[#5A6065] mt-0.5">
                                {client.name} · {client.country}
                              </p>
                            </button>
                          </td>
                          <td className="py-3.5 px-3 text-xs text-[#5A6065] whitespace-nowrap">
                            <span className="font-mono font-semibold text-[#111315]">
                              {client.preferredCurrency}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>Net {client.defaultTermsDays}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right whitespace-nowrap">
                            <p className="font-mono text-xs font-semibold tabular-nums text-[#111315]">
                              {formatMoney(stats.billedUsd, 'USD')}
                            </p>
                            <p className="text-[11px] text-[#5A6065]">
                              {stats.count} invoice{stats.count === 1 ? '' : 's'}
                            </p>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onCreateInvoiceForClient(client.id)}
                                className="p-2 rounded-md text-[#111315] hover:bg-[#EAEAE4] transition-colors"
                                aria-label={`Create invoice for ${client.name}`}
                                title="Create invoice"
                              >
                                <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(client)}
                                className="p-2 rounded-md text-[#5A6065] hover:text-[#111315] hover:bg-[#EAEAE4] transition-colors"
                                aria-label={`Edit ${client.name}`}
                                title="Edit client"
                              >
                                <Pencil className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteClient(client.id)}
                                className="p-2 rounded-md text-[#5A6065] hover:text-[#B91C1C] hover:bg-[#EAEAE4] transition-colors"
                                aria-label={`Delete ${client.name}`}
                                title="Delete client"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
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

        {/* Client Detail Inspector */}
        <aside className="lg:col-span-5 xl:col-span-4 min-w-0 bg-white border border-[#E5E5E0] rounded-xl p-4 sm:p-6">
          {selectedClient ? (
            (() => {
              const stats = getClientStats(selectedClient.id);
              const billedNgn = convertCurrency(
                stats.billedUsd,
                'USD',
                'NGN',
                brand.defaultUsdToNgnRate
              );
              const currMeta = CURRENCY_META[selectedClient.preferredCurrency];
              return (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E5E5E0]">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold text-[#111315] truncate">
                        {selectedClient.company || selectedClient.name}
                      </h3>
                      <p className="text-xs text-[#5A6065] mt-0.5">
                        {selectedClient.name} · {selectedClient.preferredCurrency} ({currMeta?.name})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedClient)}
                      className="text-xs font-semibold hover:underline shrink-0"
                      style={{ color: brand.accentColor }}
                    >
                      Edit
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs text-[#374151]">
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#5A6065] shrink-0" aria-hidden="true" />
                      <span className="truncate">{selectedClient.email}</span>
                    </p>
                    {selectedClient.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#5A6065] shrink-0" aria-hidden="true" />
                        <span className="font-mono">{selectedClient.phone}</span>
                      </p>
                    )}
                    <p className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#5A6065] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {selectedClient.address
                          ? `${selectedClient.address}, ${selectedClient.country}`
                          : selectedClient.country}
                      </span>
                    </p>
                  </div>

                  {selectedClient.tags.length > 0 && (
                    <div className="pt-3 border-t border-[#F0F0EC] text-xs text-[#5A6065]">
                      Services: {selectedClient.tags.join(' · ')}
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#E5E5E0] grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-[#5A6065]">Lifetime Billed</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-[#111315] mt-0.5">
                        {formatMoney(stats.billedUsd, 'USD')}
                      </p>
                      <p className="font-mono text-[11px] tabular-nums text-[#5A6065]">
                        {formatMoney(billedNgn, 'NGN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#5A6065]">Open Balance</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-[#111315] mt-0.5">
                        {formatMoney(stats.outstandingUsd, 'USD')}
                      </p>
                      <p className="text-[11px] text-[#5A6065]">
                        {stats.count} total invoice{stats.count === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onCreateInvoiceForClient(selectedClient.id)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                      style={{ backgroundColor: brand.accentColor }}
                    >
                      <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                      <span>Invoice {selectedClient.name.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="text-xs text-[#5A6065] text-center py-8">
              Select a client from the directory to view billing history and contact details.
            </p>
          )}
        </aside>
      </div>

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-modal-title"
        >
          <div className="bg-white border border-[#E5E5E0] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E0]">
              <h2 id="client-modal-title" className="font-display text-lg font-bold text-[#111315]">
                {form.id ? 'Edit Client Record' : 'Add New Client'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-2 rounded-md text-[#5A6065] hover:text-[#111315] hover:bg-[#F7F7F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cli-name" className="block text-xs font-medium text-[#111315] mb-1">
                    Contact Name *
                  </label>
                  <input
                    id="cli-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Client name"
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
                <div>
                  <label htmlFor="cli-company" className="block text-xs font-medium text-[#111315] mb-1">
                    Company / Organization
                  </label>
                  <input
                    id="cli-company"
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Company name"
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cli-email" className="block text-xs font-medium text-[#111315] mb-1">
                    Billing Email *
                  </label>
                  <input
                    id="cli-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="accounts@company.com"
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
                <div>
                  <label htmlFor="cli-phone" className="block text-xs font-medium text-[#111315] mb-1">
                    Phone Number
                  </label>
                  <input
                    id="cli-phone"
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+44 / +1 / +234 ..."
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="cli-currency" className="block text-xs font-medium text-[#111315] mb-1">
                    Primary Currency
                  </label>
                  <select
                    id="cli-currency"
                    value={form.preferredCurrency}
                    onChange={(e) =>
                      setForm({ ...form, preferredCurrency: e.target.value as CurrencyCode })
                    }
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol.trim()}) — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cli-terms" className="block text-xs font-medium text-[#111315] mb-1">
                    Default Terms (Days)
                  </label>
                  <input
                    id="cli-terms"
                    type="number"
                    min={0}
                    max={90}
                    value={form.defaultTermsDays}
                    onChange={(e) =>
                      setForm({ ...form, defaultTermsDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
                <div>
                  <label htmlFor="cli-country" className="block text-xs font-medium text-[#111315] mb-1">
                    Country
                  </label>
                  <select
                    id="cli-country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  >
                    {COMMON_COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.country === 'Other' && (
                <div>
                  <label
                    htmlFor="cli-custom-country"
                    className="block text-xs font-medium text-[#111315] mb-1"
                  >
                    Specify Country
                  </label>
                  <input
                    id="cli-custom-country"
                    type="text"
                    value={form.customCountry}
                    onChange={(e) => setForm({ ...form, customCountry: e.target.value })}
                    placeholder="e.g. Singapore, Switzerland, Ireland"
                    className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                  />
                </div>
              )}

              <div>
                <label htmlFor="cli-address" className="block text-xs font-medium text-[#111315] mb-1">
                  Street / Office Address
                </label>
                <input
                  id="cli-address"
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street address, city, postal code"
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                />
              </div>

              <div>
                <label htmlFor="cli-tags" className="block text-xs font-medium text-[#111315] mb-1">
                  Service Tags (comma-separated)
                </label>
                <input
                  id="cli-tags"
                  type="text"
                  value={form.tagsInput}
                  onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
                  placeholder="Data Analysis, AI Engineering, Web Development"
                  className="w-full px-3 py-2 border border-[#E5E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5C4D]/30"
                />
              </div>

              <div className="pt-4 border-t border-[#E5E5E0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E5E5E0] text-xs font-medium text-[#111315] hover:bg-[#F7F7F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: brand.accentColor }}
                >
                  {form.id ? 'Save Changes' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
