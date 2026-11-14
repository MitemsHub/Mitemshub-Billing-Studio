import { useCallback, useEffect, useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import {
  DEFAULT_BRAND_SETTINGS,
  INITIAL_CLIENTS,
  INITIAL_INVOICES,
  INITIAL_RECURRING_SCHEDULES,
  INITIAL_REMINDER_LOGS,
  INITIAL_REMINDER_RULES,
} from './data/seedData';
import type {
  BrandSettings,
  Client,
  Invoice,
  InvoiceStatus,
  PersistedState,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from './types/billing';
import {
  clearReminderLogsRemote,
  createReminderLogRemote,
  deleteClientRemote,
  deleteInvoiceRemote,
  deleteRecurringRemote,
  deleteReminderLogRemote,
  fetchAuthSession,
  fetchBackendState,
  setUnauthorizedHandler,
  signOut,
  type SessionUser,
  syncBrand,
  syncClient,
  syncInvoice,
  syncRecurring,
  syncReminderRule,
  updateInvoiceStatusRemote,
} from './services/api';
import {
  addDaysIso,
  calculateInvoiceTotals,
  computeNextBillingDate,
  convertCurrency,
  evaluateReminderEligibility,
  formatIsoDate,
  formatMoney,
  generateNextInvoiceNumber,
  getDefaultEquivalentCurrency,
  getDefaultPairRate,
  renderReminderTemplate,
} from './utils/billing';
import { Sidebar, type NavSection } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { OverviewView } from './views/OverviewView';
import { InvoicesView } from './views/InvoicesView';
import { ClientsView } from './views/ClientsView';
import { RecurringRemindersView } from './views/RecurringRemindersView';
import { BrandStudioView } from './views/BrandStudioView';

// Bumped from v1: those caches held the old demo rows, which no longer ship, so the
// stale key is dropped on load instead of being shown as if it were real data.
const STORAGE_KEY = 'mitemshub_billing_studio_v2';
const LEGACY_STORAGE_KEY = 'mitemshub_billing_studio_v1';

function normalizeBrand(brand: BrandSettings): BrandSettings {
  const merged: BrandSettings = { ...DEFAULT_BRAND_SETTINGS, ...brand };
  if (merged.logoVariant !== 'draft' && merged.logoVariant !== 'custom') {
    merged.logoVariant = 'draft';
  }
  return merged;
}

function loadInitialState(): PersistedState {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.brand && Array.isArray(parsed.clients) && Array.isArray(parsed.invoices)) {
        return {
          brand: normalizeBrand(parsed.brand),
          clients: parsed.clients,
          invoices: parsed.invoices,
          recurringSchedules: parsed.recurringSchedules ?? INITIAL_RECURRING_SCHEDULES,
          reminderRules: parsed.reminderRules ?? INITIAL_REMINDER_RULES,
          reminderLogs: parsed.reminderLogs ?? INITIAL_REMINDER_LOGS,
        };
      }
    }
  } catch {
    // Fallback to default seed data if storage is unavailable or corrupt
  }
  return {
    brand: DEFAULT_BRAND_SETTINGS,
    clients: INITIAL_CLIENTS,
    invoices: INITIAL_INVOICES,
    recurringSchedules: INITIAL_RECURRING_SCHEDULES,
    reminderRules: INITIAL_REMINDER_RULES,
    reminderLogs: INITIAL_REMINDER_LOGS,
  };
}

const SECTION_LABELS: Record<NavSection, string> = {
  overview: 'Overview',
  invoices: 'Invoices',
  clients: 'Clients',
  automation: 'Recurring & Reminders',
  branding: 'Brand Studio',
};

export default function App() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [draftInvoice, setDraftInvoice] = useState<Invoice | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<'checking' | 'signed-in' | 'signed-out'>(
    'checking'
  );
  const [authUser, setAuthUser] = useState<SessionUser | null>(null);

  const todayIso = formatIsoDate(new Date());

  const hydrateFromBackend = useCallback(() => {
    void fetchBackendState().then((remote) => {
      if (!remote) return;
      setState({
        ...remote,
        brand: normalizeBrand(remote.brand),
      });
    });
  }, []);

  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => setAuthStatus('signed-out'));

    fetchAuthSession().then((session) => {
      if (!active) return;
      if (!session?.authenticated) {
        setAuthStatus('signed-out');
        return;
      }
      setAuthUser(session.user);
      setAuthStatus('signed-in');
      hydrateFromBackend();
    });

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [hydrateFromBackend]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((current) => (current === msg ? null : current));
    }, 3200);
  };

  const startNewInvoice = (preselectedClientId?: string) => {
    const client =
      state.clients.find((c) => c.id === preselectedClientId) ?? state.clients[0];
    const termsDays = client?.defaultTermsDays ?? 14;
    const primaryCurrency = client?.preferredCurrency ?? 'USD';
    const equivalentCurrency = getDefaultEquivalentCurrency(primaryCurrency);
    const pairRate = getDefaultPairRate(
      primaryCurrency,
      equivalentCurrency,
      state.brand.defaultUsdToNgnRate
    );
    const usdToPrimaryRate = getDefaultPairRate(
      'USD',
      primaryCurrency,
      state.brand.defaultUsdToNgnRate
    );
    const newInv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: generateNextInvoiceNumber(state.invoices, Number(todayIso.slice(0, 4))),
      clientId: client?.id ?? '',
      issueDate: todayIso,
      dueDate: addDaysIso(todayIso, termsDays),
      status: 'draft',
      primaryCurrency,
      equivalentCurrency,
      exchangeRate: pairRate,
      dualDisplayMode: 'primary_with_summary',
      items: [
        {
          id: `li-${Date.now()}`,
          title: 'Custom Web & Data Engineering Deliverable',
          description: 'Implementation, analytics instrumentation, and QA handoff.',
          category: 'Web Development',
          quantity: 1,
          unitPrice:
            primaryCurrency === 'USD'
              ? 850
              : convertCurrency(850, 'USD', primaryCurrency, usdToPrimaryRate),
        },
      ],
      taxRatePercent: state.brand.defaultTaxRate,
      whtRatePercent: 0,
      discountPercent: 0,
      notes: state.brand.defaultNotes,
      paymentTerms: `Net ${termsDays}`,
      reminderCount: 0,
    };

    setDraftInvoice(newInv);
    setEditingInvoiceId(newInv.id);
    setActiveSection('invoices');
  };

  const openExistingInvoice = (invoiceOrId: Invoice | string | null) => {
    if (!invoiceOrId) {
      setDraftInvoice(null);
      setEditingInvoiceId(null);
      return;
    }
    const target =
      typeof invoiceOrId === 'string'
        ? state.invoices.find((i) => i.id === invoiceOrId) ?? null
        : invoiceOrId;
    setDraftInvoice(target);
    setEditingInvoiceId(target?.id ?? null);
    setActiveSection('invoices');
  };

  const handleSaveInvoice = (saved: Invoice) => {
    setState((prev) => {
      const exists = prev.invoices.some((i) => i.id === saved.id);
      const nextInvoices = exists
        ? prev.invoices.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev.invoices];
      return { ...prev, invoices: nextInvoices };
    });
    setDraftInvoice(saved);
    setEditingInvoiceId(saved.id);
    void syncInvoice(saved);
    notify(`Saved ${saved.invoiceNumber} (${saved.status}).`);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((i) => i.id !== invoiceId),
    }));
    if (editingInvoiceId === invoiceId) {
      setDraftInvoice(null);
      setEditingInvoiceId(null);
    }
    void deleteInvoiceRemote(invoiceId);
    notify('Invoice deleted.');
  };

  const handleUpdateInvoiceStatus = (invoiceId: string, status: InvoiceStatus) => {
    const existing = state.invoices.find((i) => i.id === invoiceId);
    const nextPaidAt = status === 'paid' ? todayIso : existing?.paidAt;
    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              status,
              paidAt: nextPaidAt,
            }
          : i
      ),
    }));
    void updateInvoiceStatusRemote(invoiceId, status, nextPaidAt);
    notify(`Invoice status updated to ${status}.`);
  };

  const handleSaveClient = (client: Client) => {
    setState((prev) => {
      const exists = prev.clients.some((c) => c.id === client.id);
      const nextClients = exists
        ? prev.clients.map((c) => (c.id === client.id ? client : c))
        : [client, ...prev.clients];
      return { ...prev, clients: nextClients };
    });
    void syncClient(client);
    notify(`Saved client ${client.company || client.name}.`);
  };

  const handleDeleteClient = (clientId: string) => {
    setState((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== clientId),
    }));
    void deleteClientRemote(clientId);
    notify('Client removed from directory.');
  };

  const buildReminderLog = (
    inv: Invoice,
    ruleName: string,
    channel: ReminderLog['channel']
  ): ReminderLog => {
    const client = state.clients.find((c) => c.id === inv.clientId);
    const rule =
      state.reminderRules.find((r) => r.name === ruleName) ?? state.reminderRules[0];

    const totals = calculateInvoiceTotals(
      inv.items,
      inv.taxRatePercent,
      inv.discountPercent,
      inv.exchangeRate,
      inv.primaryCurrency,
      inv.equivalentCurrency,
      inv.whtRatePercent ?? 0
    );

    const subject =
      rule && client
        ? renderReminderTemplate(
            rule.subjectTemplate,
            inv,
            client,
            state.brand.businessName
          )
        : `Payment reminder: ${inv.invoiceNumber}`;

    return {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: client?.name || 'Client',
      ruleName,
      channel,
      sentAt: new Date().toISOString(),
      subject,
      previewText: `Reminder logged for ${formatMoney(
        totals.totalPrimary,
        inv.primaryCurrency
      )} (${formatMoney(totals.totalEquivalent, totals.equivalentCurrency)}).`,
    };
  };

  const handleDispatchReminder = (
    invoiceId: string,
    ruleName: string,
    channel: ReminderLog['channel'] = 'Manual Trigger'
  ) => {
    const inv = state.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const newLog = buildReminderLog(inv, ruleName, channel);
    const updatedInvoice: Invoice = {
      ...inv,
      reminderCount: inv.reminderCount + 1,
      lastReminderSentAt: newLog.sentAt,
    };

    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((i) => (i.id === invoiceId ? updatedInvoice : i)),
      reminderLogs: [newLog, ...prev.reminderLogs],
    }));

    void syncInvoice(updatedInvoice);
    void createReminderLogRemote(newLog);
    notify(`Reminder dispatched for ${inv.invoiceNumber}.`);
  };

  const handleRunAutomatedSweep = () => {
    const eligible = state.invoices
      .map((inv) => ({
        inv,
        evalResult: evaluateReminderEligibility(inv, state.reminderRules, todayIso),
      }))
      .filter((x) => x.evalResult !== null);

    if (eligible.length === 0) {
      notify('No invoices match active reminder rules right now.');
      return;
    }

    const newLogs: ReminderLog[] = [];
    const updatedMap = new Map<string, Invoice>();

    for (const item of eligible) {
      if (item.evalResult) {
        const newLog = buildReminderLog(item.inv, item.evalResult.rule.name, 'Auto Queue');
        newLogs.push(newLog);
        const updatedInv: Invoice = {
          ...item.inv,
          reminderCount: item.inv.reminderCount + 1,
          lastReminderSentAt: newLog.sentAt,
        };
        updatedMap.set(item.inv.id, updatedInv);
        void syncInvoice(updatedInv);
        void createReminderLogRemote(newLog);
      }
    }

    setState((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) => updatedMap.get(inv.id) ?? inv),
      reminderLogs: [...newLogs, ...prev.reminderLogs],
    }));

    notify(
      `Processed ${eligible.length} automated payment reminder${eligible.length === 1 ? '' : 's'}.`
    );
  };

  const handleDeleteReminderLog = (logId: string) => {
    setState((prev) => ({
      ...prev,
      reminderLogs: prev.reminderLogs.filter((l) => l.id !== logId),
    }));
    void deleteReminderLogRemote(logId);
    notify('Reminder log entry deleted.');
  };

  const handleClearReminderLogs = () => {
    setState((prev) => ({
      ...prev,
      reminderLogs: [],
    }));
    void clearReminderLogsRemote();
    notify('Cleared all reminder dispatch logs.');
  };

  const handleRunRecurringNow = (scheduleId: string) => {
    const sched = state.recurringSchedules.find((s) => s.id === scheduleId);
    if (!sched) return;
    const client = state.clients.find((c) => c.id === sched.clientId);
    const terms = client?.defaultTermsDays ?? 14;
    const nextInvoiceNumber = generateNextInvoiceNumber(
      state.invoices,
      Number(todayIso.slice(0, 4))
    );

    const eqCurrency =
      sched.equivalentCurrency ?? getDefaultEquivalentCurrency(sched.primaryCurrency);
    const generated: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber,
      clientId: sched.clientId,
      issueDate: todayIso,
      dueDate: addDaysIso(todayIso, terms),
      status: 'sent',
      primaryCurrency: sched.primaryCurrency,
      equivalentCurrency: eqCurrency,
      exchangeRate: sched.exchangeRate,
      dualDisplayMode: sched.dualDisplayMode,
      items: sched.items.map((item) => ({
        ...item,
        id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      })),
      taxRatePercent: sched.taxRatePercent,
      whtRatePercent: sched.whtRatePercent ?? 0,
      discountPercent: 0,
      notes: sched.notes,
      paymentTerms: `Net ${terms}`,
      reminderCount: 0,
      recurringId: sched.id,
    };

    const nextDate = computeNextBillingDate(sched.nextRunDate, sched.frequency);
    const updatedSched: RecurringSchedule = {
      ...sched,
      lastGeneratedDate: todayIso,
      nextRunDate: nextDate,
    };

    setState((prev) => ({
      ...prev,
      invoices: [generated, ...prev.invoices],
      recurringSchedules: prev.recurringSchedules.map((s) =>
        s.id === sched.id ? updatedSched : s
      ),
    }));

    void syncInvoice(generated);
    void syncRecurring(updatedSched);
    notify(`Generated ${generated.invoiceNumber} from "${sched.title}".`);
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mitemshub-billing-backup-${todayIso}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Exported full studio backup JSON.');
  };

  const overdueCount = state.invoices.filter((i) => i.status === 'overdue').length;
  const dueRemindersCount = state.invoices.filter(
    (i) => evaluateReminderEligibility(i, state.reminderRules, todayIso) !== null
  ).length;

  const sampleInvoice = state.invoices[0] ?? {
    id: 'sample',
    invoiceNumber: 'INV-2026-001',
    clientId: state.clients[0]?.id ?? '',
    issueDate: todayIso,
    dueDate: addDaysIso(todayIso, 14),
    status: 'sent',
    primaryCurrency: 'USD',
    exchangeRate: state.brand.defaultUsdToNgnRate,
    dualDisplayMode: 'primary_with_summary',
    items: [
      {
        id: 'sample-li',
        title: 'AI Analytics & Custom Web Platform',
        description: 'End-to-end delivery',
        category: 'Web Development',
        quantity: 1,
        unitPrice: 1500,
      },
    ],
    taxRatePercent: 0,
    discountPercent: 0,
    notes: state.brand.defaultNotes,
    paymentTerms: 'Net 14',
    reminderCount: 0,
  };
  const sampleClient = state.clients.find((c) => c.id === sampleInvoice.clientId);

  const isInsideInvoiceEditor = activeSection === 'invoices' && draftInvoice !== null;

  const handleSignedIn = (user: SessionUser) => {
    setAuthUser(user);
    setAuthStatus('signed-in');
    hydrateFromBackend();
  };

  const handleSignOut = () => {
    void signOut().then(() => {
      setAuthUser(null);
      setAuthStatus('signed-out');
      setMobileNavOpen(false);
    });
  };

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center bg-[#F7F7F5] text-sm text-[#5A6065]">
        Loading workspace…
      </div>
    );
  }

  if (authStatus === 'signed-out') {
    return <LoginScreen onSignedIn={handleSignedIn} />;
  }

  return (
    <div className="min-h-screen flex bg-[#F7F7F5] text-[#111315] overflow-x-clip">
        <Sidebar
          activeSection={activeSection}
          onNavigate={(section) => {
            setActiveSection(section);
            if (section !== 'invoices') {
              setDraftInvoice(null);
              setEditingInvoiceId(null);
            }
          }}
          brand={state.brand}
          overdueCount={overdueCount}
          dueRemindersCount={dueRemindersCount}
          onExportBackup={handleExportBackup}
          user={authUser}
          onSignOut={handleSignOut}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col overflow-x-clip">
          {/* Top Header Bar — Clean Breadcrumb + Single Primary Action */}
          <header className="no-print sticky top-0 z-30 bg-[#F7F7F5]/95 backdrop-blur-xs border-b border-[#E5E5E0] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-md text-[#111315] hover:bg-[#EAEAE4] shrink-0"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-[#5A6065] truncate">{state.brand.businessName}</span>
                <span aria-hidden="true" className="text-[#9CA3AF] shrink-0">
                  /
                </span>
                <h1 className="font-display font-bold text-[#111315] truncate">
                  {isInsideInvoiceEditor
                    ? `Invoice ${draftInvoice.invoiceNumber}`
                    : SECTION_LABELS[activeSection]}
                </h1>
              </div>
            </div>

            {!isInsideInvoiceEditor && (
              <button
                type="button"
                onClick={() => startNewInvoice()}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
                style={{ backgroundColor: state.brand.accentColor }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>New Invoice</span>
              </button>
            )}
          </header>

          {/* Main Workspace Canvas */}
          <main className="flex-1 min-w-0 px-4 sm:px-8 py-5 sm:py-8 max-w-[1440px] w-full mx-auto">
            <div
              key={activeSection + (isInsideInvoiceEditor ? '-editor' : '')}
              className="animate-view-enter min-w-0"
            >
              {activeSection === 'overview' && (
                <OverviewView
                  invoices={state.invoices}
                  clients={state.clients}
                  recurringSchedules={state.recurringSchedules}
                  reminderRules={state.reminderRules}
                  reminderLogs={state.reminderLogs}
                  brand={state.brand}
                  todayIso={todayIso}
                  onCreateInvoice={() => startNewInvoice()}
                  onOpenInvoice={(id) => openExistingInvoice(id)}
                  onDeleteInvoice={handleDeleteInvoice}
                  onNavigateInvoices={() => {
                    setDraftInvoice(null);
                    setEditingInvoiceId(null);
                    setActiveSection('invoices');
                  }}
                  onNavigateAutomation={() => setActiveSection('automation')}
                  onSendReminder={(id, ruleName) =>
                    handleDispatchReminder(id, ruleName, 'Manual Trigger')
                  }
                  onRunRecurring={handleRunRecurringNow}
                />
              )}

              {activeSection === 'invoices' && (
                <InvoicesView
                  invoices={state.invoices}
                  clients={state.clients}
                  brand={state.brand}
                  editingInvoice={draftInvoice}
                  onSelectInvoice={openExistingInvoice}
                  onStartNewInvoice={startNewInvoice}
                  onSaveInvoice={handleSaveInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  onUpdateStatus={handleUpdateInvoiceStatus}
                  onSendReminder={(id, ruleName) =>
                    handleDispatchReminder(id, ruleName, 'Manual Trigger')
                  }
                />
              )}

              {activeSection === 'clients' && (
                <ClientsView
                  clients={state.clients}
                  invoices={state.invoices}
                  brand={state.brand}
                  onSaveClient={handleSaveClient}
                  onDeleteClient={handleDeleteClient}
                  onCreateInvoiceForClient={(clientId) => startNewInvoice(clientId)}
                />
              )}

              {activeSection === 'automation' && (
                <RecurringRemindersView
                  schedules={state.recurringSchedules}
                  clients={state.clients}
                  invoices={state.invoices}
                  reminderRules={state.reminderRules}
                  reminderLogs={state.reminderLogs}
                  brand={state.brand}
                  todayIso={todayIso}
                  onSaveSchedule={(sched) => {
                    setState((prev) => ({
                      ...prev,
                      recurringSchedules: [sched, ...prev.recurringSchedules],
                    }));
                    void syncRecurring(sched);
                    notify(`Created recurring schedule "${sched.title}".`);
                  }}
                  onToggleSchedule={(id) => {
                    const existing = state.recurringSchedules.find((s) => s.id === id);
                    if (!existing) return;
                    const updated = { ...existing, active: !existing.active };
                    setState((prev) => ({
                      ...prev,
                      recurringSchedules: prev.recurringSchedules.map((s) =>
                        s.id === id ? updated : s
                      ),
                    }));
                    void syncRecurring(updated);
                  }}
                  onDeleteSchedule={(id) => {
                    setState((prev) => ({
                      ...prev,
                      recurringSchedules: prev.recurringSchedules.filter((s) => s.id !== id),
                    }));
                    void deleteRecurringRemote(id);
                    notify('Recurring schedule deleted.');
                  }}
                  onRunScheduleNow={handleRunRecurringNow}
                  onUpdateRule={(updatedRule) => {
                    setState((prev) => ({
                      ...prev,
                      reminderRules: prev.reminderRules.map((r) =>
                        r.id === updatedRule.id ? updatedRule : r
                      ),
                    }));
                    void syncReminderRule(updatedRule);
                  }}
                  onDispatchReminder={handleDispatchReminder}
                  onRunAutomatedSweep={handleRunAutomatedSweep}
                  onDeleteReminderLog={handleDeleteReminderLog}
                  onClearReminderLogs={handleClearReminderLogs}
                />
              )}

              {activeSection === 'branding' && (
                <BrandStudioView
                  brand={state.brand}
                  sampleInvoice={sampleInvoice}
                  sampleClient={sampleClient}
                  onUpdateBrand={(nextBrand) => {
                    setState((prev) => ({ ...prev, brand: nextBrand }));
                    void syncBrand(nextBrand);
                  }}
                />
              )}
            </div>
          </main>
        </div>

        {/* Non-intrusive Action Feedback Toast */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="no-print fixed bottom-5 right-4 sm:right-5 z-50 max-w-[calc(100vw-2rem)] bg-[#111315] text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg border border-white/10"
          >
            {toast}
          </div>
        )}
      </div>
  );
}
