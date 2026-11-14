import { Client as AppwriteClient, Query, TablesDB } from 'node-appwrite';
import {
  DEFAULT_BRAND_SETTINGS,
  INITIAL_CLIENTS,
  INITIAL_INVOICES,
  INITIAL_RECURRING_SCHEDULES,
  INITIAL_REMINDER_LOGS,
  INITIAL_REMINDER_RULES,
} from '../src/data/seedData.ts';
import {
  deserializeBrand,
  deserializeClient,
  deserializeInvoice,
  deserializeLog,
  deserializeRecurring,
  deserializeRule,
  normalizeLogoVariant,
  serializeBrand,
  serializeClient,
  serializeInvoice,
  serializeLog,
  serializeRecurring,
  serializeRule,
  toRowId,
} from '../src/data/appwriteRows.ts';
import type {
  BrandSettings,
  Client,
  Invoice,
  InvoiceLineItem,
  LogoVariant,
  PersistedState,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from '../src/types/billing.ts';

const TABLES = {
  META: 'studio_meta',
  BRAND: 'brand_settings',
  CLIENTS: 'clients',
  INVOICES: 'invoices',
  RECURRING: 'recurring_schedules',
  RULES: 'reminder_rules',
  LOGS: 'reminder_logs',
} as const;

type ColDef =
  | { type: 'string'; key: string; size: number; required: boolean }
  | { type: 'mediumtext'; key: string; required: boolean }
  | { type: 'float'; key: string; required: boolean }
  | { type: 'integer'; key: string; required: boolean }
  | { type: 'boolean'; key: string; required: boolean };


function getConfig() {
  return {
    endpoint: process.env.APPWRITE_ENDPOINT?.trim() || '',
    projectId: process.env.APPWRITE_PROJECT_ID?.trim() || '',
    apiKey: process.env.APPWRITE_API_KEY?.trim() || '',
    databaseId: process.env.APPWRITE_DATABASE_ID?.trim() || 'mitemshub_billing',
  };
}

export function isAppwriteConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.endpoint && cfg.projectId && cfg.apiKey);
}

function getTablesDB(): { tables: TablesDB; databaseId: string } {
  const cfg = getConfig();
  if (!cfg.endpoint || !cfg.projectId || !cfg.apiKey) {
    throw new Error('Appwrite credentials are not configured in environment variables.');
  }
  const client = new AppwriteClient()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId)
    .setKey(cfg.apiKey);

  return { tables: new TablesDB(client), databaseId: cfg.databaseId };
}

function getErrorCode(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'number' ? code : undefined;
  }
  return undefined;
}



async function ensureColumn(
  tables: TablesDB,
  databaseId: string,
  tableId: string,
  def: ColDef
): Promise<boolean> {
  try {
    if (def.type === 'string') {
      await tables.createStringColumn({
        databaseId,
        tableId,
        key: def.key,
        size: def.size,
        required: def.required,
      });
    } else if (def.type === 'mediumtext') {
      await tables.createMediumtextColumn({
        databaseId,
        tableId,
        key: def.key,
        required: def.required,
      });
    } else if (def.type === 'float') {
      await tables.createFloatColumn({
        databaseId,
        tableId,
        key: def.key,
        required: def.required,
      });
    } else if (def.type === 'integer') {
      await tables.createIntegerColumn({
        databaseId,
        tableId,
        key: def.key,
        required: def.required,
      });
    } else if (def.type === 'boolean') {
      await tables.createBooleanColumn({
        databaseId,
        tableId,
        key: def.key,
        required: def.required,
      });
    }
    return true;
  } catch (err) {
    if (getErrorCode(err) === 409) {
      return false;
    }
    throw err;
  }
}

async function waitForColumns(
  tables: TablesDB,
  databaseId: string,
  tableId: string,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  const maxAttempts = 40;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statuses = await Promise.all(
      keys.map(async (key) => {
        try {
          const col = await tables.getColumn({ databaseId, tableId, key });
          return (col as { status?: string }).status;
        } catch {
          return 'processing';
        }
      })
    );
    if (statuses.every((s) => s === 'available')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

async function ensureTableSchema(
  tables: TablesDB,
  databaseId: string,
  tableId: string,
  name: string,
  cols: ColDef[]
): Promise<void> {
  let existingKeys = new Set<string>();
  try {
    const tbl = await tables.getTable({ databaseId, tableId });
    const rawCols = (tbl as { columns?: Array<{ key?: string }> }).columns;
    if (Array.isArray(rawCols)) {
      existingKeys = new Set(
        rawCols.map((c) => c.key).filter((k): k is string => typeof k === 'string')
      );
    }
  } catch (err) {
    if (getErrorCode(err) !== 404) {
      throw err;
    }
    try {
      await tables.createTable({
        databaseId,
        tableId,
        name,
        rowSecurity: false,
        enabled: true,
      });
    } catch (createErr) {
      if (getErrorCode(createErr) !== 409) {
        throw createErr;
      }
    }
  }

  const createdKeys: string[] = [];
  for (const col of cols) {
    if (!existingKeys.has(col.key)) {
      const created = await ensureColumn(tables, databaseId, tableId, col);
      if (created) {
        createdKeys.push(col.key);
      }
    }
  }

  await waitForColumns(tables, databaseId, tableId, createdKeys);
}

async function upsertRow(
  tables: TablesDB,
  databaseId: string,
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<void> {
  const safeId = toRowId(rowId);
  try {
    await tables.updateRow({
      databaseId,
      tableId,
      rowId: safeId,
      data,
    });
  } catch (err) {
    if (getErrorCode(err) !== 404) {
      throw err;
    }
    await tables.createRow({
      databaseId,
      tableId,
      rowId: safeId,
      data,
    });
  }
}













let initPromise: Promise<void> | null = null;

export async function ensureAppwriteReady(): Promise<void> {
  if (!isAppwriteConfigured()) return;
  if (!initPromise) {
    initPromise = (async () => {
      const { tables, databaseId } = getTablesDB();

      try {
        await tables.get({ databaseId });
      } catch (err) {
        if (getErrorCode(err) !== 404) {
          throw err;
        }
        try {
          await tables.create({
            databaseId,
            name: 'Mitemshub Billing Studio',
            enabled: true,
          });
        } catch (createErr) {
          if (getErrorCode(createErr) !== 409) {
            throw createErr;
          }
        }
      }

      await ensureTableSchema(tables, databaseId, TABLES.META, 'Studio Metadata', [
        { type: 'boolean', key: 'initialized', required: true },
        { type: 'string', key: 'updatedAt', size: 64, required: true },
      ]);

      await ensureTableSchema(tables, databaseId, TABLES.BRAND, 'Brand Settings', [
        { type: 'string', key: 'businessName', size: 120, required: true },
        { type: 'string', key: 'tagline', size: 255, required: false },
        { type: 'string', key: 'ownerName', size: 120, required: false },
        { type: 'string', key: 'email', size: 160, required: false },
        { type: 'string', key: 'phone', size: 64, required: false },
        { type: 'string', key: 'website', size: 160, required: false },
        { type: 'string', key: 'address', size: 255, required: false },
        { type: 'string', key: 'taxId', size: 120, required: false },
        { type: 'string', key: 'logoVariant', size: 32, required: true },
        { type: 'mediumtext', key: 'customLogoDataUrl', required: false },
        { type: 'string', key: 'accentColor', size: 32, required: true },
        { type: 'float', key: 'defaultUsdToNgnRate', required: true },
        { type: 'float', key: 'defaultTaxRate', required: true },
        { type: 'string', key: 'defaultNotes', size: 4000, required: false },
        { type: 'string', key: 'usdBankDetails', size: 4000, required: false },
        { type: 'string', key: 'ngnBankDetails', size: 4000, required: false },
      ]);

      await ensureTableSchema(tables, databaseId, TABLES.CLIENTS, 'Clients', [
        { type: 'string', key: 'name', size: 160, required: true },
        { type: 'string', key: 'company', size: 180, required: false },
        { type: 'string', key: 'email', size: 180, required: true },
        { type: 'string', key: 'phone', size: 64, required: false },
        { type: 'string', key: 'country', size: 120, required: false },
        { type: 'string', key: 'address', size: 512, required: false },
        { type: 'string', key: 'preferredCurrency', size: 16, required: true },
        { type: 'integer', key: 'defaultTermsDays', required: true },
        { type: 'string', key: 'tagsJson', size: 4000, required: false },
        { type: 'string', key: 'createdAt', size: 64, required: true },
      ]);

      await ensureTableSchema(tables, databaseId, TABLES.INVOICES, 'Invoices', [
        { type: 'string', key: 'invoiceNumber', size: 64, required: true },
        { type: 'string', key: 'clientId', size: 64, required: true },
        { type: 'string', key: 'issueDate', size: 32, required: true },
        { type: 'string', key: 'dueDate', size: 32, required: true },
        { type: 'string', key: 'status', size: 32, required: true },
        { type: 'string', key: 'primaryCurrency', size: 16, required: true },
        { type: 'string', key: 'equivalentCurrency', size: 16, required: false },
        { type: 'float', key: 'exchangeRate', required: true },
        { type: 'string', key: 'dualDisplayMode', size: 48, required: true },
        { type: 'mediumtext', key: 'itemsJson', required: true },
        { type: 'float', key: 'taxRatePercent', required: true },
        { type: 'float', key: 'whtRatePercent', required: false },
        { type: 'float', key: 'discountPercent', required: true },
        { type: 'string', key: 'notes', size: 8000, required: false },
        { type: 'string', key: 'paymentTerms', size: 120, required: false },
        { type: 'string', key: 'lastReminderSentAt', size: 64, required: false },
        { type: 'integer', key: 'reminderCount', required: true },
        { type: 'string', key: 'recurringId', size: 64, required: false },
        { type: 'string', key: 'paidAt', size: 32, required: false },
      ]);

      await ensureTableSchema(
        tables,
        databaseId,
        TABLES.RECURRING,
        'Recurring Schedules',
        [
          { type: 'string', key: 'clientId', size: 64, required: true },
          { type: 'string', key: 'title', size: 255, required: true },
          { type: 'string', key: 'frequency', size: 32, required: true },
          { type: 'string', key: 'primaryCurrency', size: 16, required: true },
          { type: 'string', key: 'equivalentCurrency', size: 16, required: false },
          { type: 'float', key: 'exchangeRate', required: true },
          { type: 'string', key: 'dualDisplayMode', size: 48, required: true },
          { type: 'mediumtext', key: 'itemsJson', required: true },
          { type: 'float', key: 'taxRatePercent', required: true },
          { type: 'float', key: 'whtRatePercent', required: false },
          { type: 'string', key: 'nextRunDate', size: 32, required: true },
          { type: 'string', key: 'lastGeneratedDate', size: 32, required: false },
          { type: 'boolean', key: 'active', required: true },
          { type: 'boolean', key: 'autoSendReminder', required: true },
          { type: 'string', key: 'notes', size: 4000, required: false },
        ]
      );

      await ensureTableSchema(tables, databaseId, TABLES.RULES, 'Reminder Rules', [
        { type: 'string', key: 'name', size: 180, required: true },
        { type: 'string', key: 'triggerType', size: 32, required: true },
        { type: 'integer', key: 'daysOffset', required: true },
        { type: 'boolean', key: 'enabled', required: true },
        { type: 'string', key: 'subjectTemplate', size: 1000, required: true },
        { type: 'string', key: 'bodyTemplate', size: 8000, required: true },
      ]);

      await ensureTableSchema(
        tables,
        databaseId,
        TABLES.LOGS,
        'Reminder Dispatch Logs',
        [
          { type: 'string', key: 'invoiceId', size: 64, required: true },
          { type: 'string', key: 'invoiceNumber', size: 64, required: true },
          { type: 'string', key: 'clientId', size: 64, required: true },
          { type: 'string', key: 'clientName', size: 180, required: true },
          { type: 'string', key: 'ruleName', size: 180, required: true },
          { type: 'string', key: 'channel', size: 64, required: true },
          { type: 'string', key: 'sentAt', size: 64, required: true },
          { type: 'string', key: 'subject', size: 1000, required: true },
          { type: 'string', key: 'previewText', size: 4000, required: false },
        ]
      );

      let initialized = false;
      try {
        const metaRow = await tables.getRow({
          databaseId,
          tableId: TABLES.META,
          rowId: 'init',
        });
        initialized = Boolean((metaRow as { initialized?: boolean }).initialized);
      } catch (err) {
        if (getErrorCode(err) !== 404) {
          throw err;
        }
      }

      if (!initialized) {
        await upsertRow(
          tables,
          databaseId,
          TABLES.BRAND,
          'default',
          serializeBrand(DEFAULT_BRAND_SETTINGS)
        );
        for (const client of INITIAL_CLIENTS) {
          await upsertRow(tables, databaseId, TABLES.CLIENTS, client.id, serializeClient(client));
        }
        for (const invoice of INITIAL_INVOICES) {
          await upsertRow(
            tables,
            databaseId,
            TABLES.INVOICES,
            invoice.id,
            serializeInvoice(invoice)
          );
        }
        for (const sched of INITIAL_RECURRING_SCHEDULES) {
          await upsertRow(
            tables,
            databaseId,
            TABLES.RECURRING,
            sched.id,
            serializeRecurring(sched)
          );
        }
        for (const rule of INITIAL_REMINDER_RULES) {
          await upsertRow(tables, databaseId, TABLES.RULES, rule.id, serializeRule(rule));
        }
        for (const log of INITIAL_REMINDER_LOGS) {
          await upsertRow(tables, databaseId, TABLES.LOGS, log.id, serializeLog(log));
        }
        await upsertRow(tables, databaseId, TABLES.META, 'init', {
          initialized: true,
          updatedAt: new Date().toISOString(),
        });
      }
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

export async function getFullState(): Promise<PersistedState> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();

  const [brandRows, clientRows, invoiceRows, recurringRows, ruleRows, logRows] =
    await Promise.all([
      tables.listRows({
        databaseId,
        tableId: TABLES.BRAND,
        queries: [Query.limit(10)],
      }),
      tables.listRows({
        databaseId,
        tableId: TABLES.CLIENTS,
        queries: [Query.limit(200), Query.orderDesc('createdAt')],
      }),
      tables.listRows({
        databaseId,
        tableId: TABLES.INVOICES,
        queries: [Query.limit(200), Query.orderDesc('issueDate')],
      }),
      tables.listRows({
        databaseId,
        tableId: TABLES.RECURRING,
        queries: [Query.limit(200)],
      }),
      tables.listRows({
        databaseId,
        tableId: TABLES.RULES,
        queries: [Query.limit(100)],
      }),
      tables.listRows({
        databaseId,
        tableId: TABLES.LOGS,
        queries: [Query.limit(200), Query.orderDesc('sentAt')],
      }),
    ]);

  const rawBrand = brandRows.rows.find((r) => r.$id === 'default') ?? brandRows.rows[0];

  return {
    brand: rawBrand
      ? deserializeBrand(rawBrand as unknown as Record<string, unknown>)
      : DEFAULT_BRAND_SETTINGS,
    clients: clientRows.rows.map((r) =>
      deserializeClient(r as unknown as Record<string, unknown>)
    ),
    invoices: invoiceRows.rows.map((r) =>
      deserializeInvoice(r as unknown as Record<string, unknown>)
    ),
    recurringSchedules: recurringRows.rows.map((r) =>
      deserializeRecurring(r as unknown as Record<string, unknown>)
    ),
    reminderRules: ruleRows.rows.map((r) =>
      deserializeRule(r as unknown as Record<string, unknown>)
    ),
    reminderLogs: logRows.rows.map((r) =>
      deserializeLog(r as unknown as Record<string, unknown>)
    ),
  };
}

export async function saveBrand(brand: BrandSettings): Promise<BrandSettings> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  const normalized: BrandSettings = {
    ...brand,
    logoVariant: normalizeLogoVariant(brand.logoVariant),
  };
  await upsertRow(tables, databaseId, TABLES.BRAND, 'default', serializeBrand(normalized));
  return normalized;
}

export async function upsertClient(client: Client): Promise<Client> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  await upsertRow(tables, databaseId, TABLES.CLIENTS, client.id, serializeClient(client));
  return client;
}

export async function removeClient(clientId: string): Promise<void> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  try {
    await tables.deleteRow({
      databaseId,
      tableId: TABLES.CLIENTS,
      rowId: toRowId(clientId),
    });
  } catch (err) {
    if (getErrorCode(err) !== 404) throw err;
  }
}

export async function upsertInvoice(invoice: Invoice): Promise<Invoice> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  await upsertRow(tables, databaseId, TABLES.INVOICES, invoice.id, serializeInvoice(invoice));
  return invoice;
}

export async function updateInvoiceFields(
  invoiceId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  await tables.updateRow({
    databaseId,
    tableId: TABLES.INVOICES,
    rowId: toRowId(invoiceId),
    data: patch,
  });
}

export async function removeInvoice(invoiceId: string): Promise<void> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  try {
    await tables.deleteRow({
      databaseId,
      tableId: TABLES.INVOICES,
      rowId: toRowId(invoiceId),
    });
  } catch (err) {
    if (getErrorCode(err) !== 404) throw err;
  }
}

export async function upsertRecurring(schedule: RecurringSchedule): Promise<RecurringSchedule> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  await upsertRow(tables, databaseId, TABLES.RECURRING, schedule.id, serializeRecurring(schedule));
  return schedule;
}

export async function removeRecurring(scheduleId: string): Promise<void> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  try {
    await tables.deleteRow({
      databaseId,
      tableId: TABLES.RECURRING,
      rowId: toRowId(scheduleId),
    });
  } catch (err) {
    if (getErrorCode(err) !== 404) throw err;
  }
}

export async function upsertReminderRule(rule: ReminderRule): Promise<ReminderRule> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  await upsertRow(tables, databaseId, TABLES.RULES, rule.id, serializeRule(rule));
  return rule;
}

export async function createReminderLog(log: ReminderLog): Promise<ReminderLog> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  await upsertRow(tables, databaseId, TABLES.LOGS, log.id, serializeLog(log));
  return log;
}

export async function removeReminderLog(logId: string): Promise<void> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  try {
    await tables.deleteRow({
      databaseId,
      tableId: TABLES.LOGS,
      rowId: toRowId(logId),
    });
  } catch (err) {
    if (getErrorCode(err) !== 404) throw err;
  }
}

export async function clearReminderLogs(): Promise<number> {
  await ensureAppwriteReady();
  const { tables, databaseId } = getTablesDB();
  const list = await tables.listRows({
    databaseId,
    tableId: TABLES.LOGS,
    queries: [Query.limit(200)],
  });
  await Promise.all(
    list.rows.map((row) =>
      tables
        .deleteRow({
          databaseId,
          tableId: TABLES.LOGS,
          rowId: row.$id,
        })
        .catch(() => undefined)
    )
  );
  return list.rows.length;
}
