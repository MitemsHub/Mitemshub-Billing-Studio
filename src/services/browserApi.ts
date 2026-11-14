import { Query } from 'appwrite';
import type {
  BrandSettings,
  Client,
  Invoice,
  InvoiceStatus,
  PersistedState,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from '../types/billing';
import { DEFAULT_BRAND_SETTINGS } from '../data/seedData';
import {
  deserializeBrand,
  deserializeClient,
  deserializeInvoice,
  deserializeLog,
  deserializeRecurring,
  deserializeRule,
  serializeBrand,
  serializeClient,
  serializeInvoice,
  serializeLog,
  serializeRecurring,
  serializeRule,
  toRowId,
} from '../data/appwriteRows';
import {
  DATABASE_ID,
  TABLE_IDS,
  account,
  isAppwriteConfigured,
  tables,
} from './appwriteClient';
import type { AuthSession, SessionUser } from './serverApi';

// Browser backend for builds with no Express server (GitHub Pages). It talks to
// Appwrite directly using the signed-in user's own session — never an API key —
// so the table permissions, not this code, decide who can read the ledger.

let onUnauthorized: (() => void) | null = null;
let onConnectionProblem: (() => void) | null = null;

/** Lets the app drop back to the sign-in screen when a session expires. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Lets the app say "cannot reach Appwrite" instead of pretending a request succeeded. */
export function setConnectionProblemHandler(handler: (() => void) | null): void {
  onConnectionProblem = handler;
}

interface AppwriteErrorShape {
  code?: number;
  message?: string;
}

const errorCode = (error: unknown): number | undefined =>
  (error as AppwriteErrorShape | null)?.code;

const errorMessage = (error: unknown): string =>
  (error as AppwriteErrorShape | null)?.message ??
  (error instanceof Error ? error.message : 'Unexpected error.');

const isNotFound = (error: unknown): boolean => errorCode(error) === 404;

/**
 * Appwrite throws an exception carrying an HTTP status for real API answers. A
 * request that never reached the service has no status at all — that is a
 * connection problem, and must not be reported as a bad password.
 */
const isConnectionError = (error: unknown): boolean => {
  if (typeof errorCode(error) === 'number') return false;
  const message = errorMessage(error);
  return /fetch|network|load failed|connection|offline|timed? ?out/i.test(message);
};

async function listRows(tableId: string): Promise<Array<Record<string, unknown>>> {
  const result = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [Query.limit(200)],
  });
  return result.rows as unknown as Array<Record<string, unknown>>;
}

async function upsert(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<null> {
  try {
    await tables.upsertRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: toRowId(rowId),
      data,
    });
  } catch (error) {
    if (errorCode(error) === 401) onUnauthorized?.();
  }
  return null;
}

async function removeRow(tableId: string, rowId: string): Promise<null> {
  try {
    await tables.deleteRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: toRowId(rowId),
    });
  } catch (error) {
    if (errorCode(error) === 401) onUnauthorized?.();
    else if (!isNotFound(error)) throw error;
  }
  return null;
}

export async function fetchAuthSession(): Promise<AuthSession | null> {
  if (!isAppwriteConfigured) {
    return { authEnabled: true, authenticated: false, user: null, reachable: false };
  }
  try {
    const user = await account.get();
    return {
      authEnabled: true,
      authenticated: true,
      user: { email: user.email, name: user.name || user.email },
    };
  } catch (error) {
    // 401 means "no session" and belongs on the sign-in screen; anything that never
    // reached Appwrite must not be shown as a signed-out studio.
    if (isConnectionError(error)) {
      onConnectionProblem?.();
      return { authEnabled: true, authenticated: false, user: null, reachable: false };
    }
    return { authEnabled: true, authenticated: false, user: null };
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  if (!isAppwriteConfigured) {
    return {
      ok: false,
      error: 'This build has no Appwrite project configured, so sign-in is unavailable.',
    };
  }
  try {
    await account.createEmailPasswordSession({ email, password });
    const user = await account.get();
    return { ok: true, user: { email: user.email, name: user.name || user.email } };
  } catch (error) {
    const code = errorCode(error);
    if (code === 401) return { ok: false, error: 'Email or password is incorrect.' };
    if (code === 403) {
      return {
        ok: false,
        error: 'This domain is not registered as a web platform in your Appwrite project.',
      };
    }
    if (code === 400) return { ok: false, error: 'Enter a valid email and password.' };
    if (isConnectionError(error)) {
      onConnectionProblem?.();
      return {
        ok: false,
        error:
          'Cannot reach Appwrite. Check your internet connection and try again — this is not a password problem.',
      };
    }
    return { ok: false, error: errorMessage(error) };
  }
}

export async function signOut(): Promise<void> {
  try {
    await account.deleteSession({ sessionId: 'current' });
  } catch {
    // Already signed out, or the session expired.
  }
}

export async function fetchBackendState(): Promise<PersistedState | null> {
  if (!isAppwriteConfigured) return null;
  try {
    const [brandRows, clientRows, invoiceRows, recurringRows, ruleRows, logRows] =
      await Promise.all([
        listRows(TABLE_IDS.BRAND),
        listRows(TABLE_IDS.CLIENTS),
        listRows(TABLE_IDS.INVOICES),
        listRows(TABLE_IDS.RECURRING),
        listRows(TABLE_IDS.RULES),
        listRows(TABLE_IDS.LOGS),
      ]);

    const brandRow = brandRows.find((row) => row.$id === 'default') ?? brandRows[0];

    return {
      brand: brandRow ? deserializeBrand(brandRow) : DEFAULT_BRAND_SETTINGS,
      clients: clientRows.map(deserializeClient),
      invoices: invoiceRows.map(deserializeInvoice),
      recurringSchedules: recurringRows.map(deserializeRecurring),
      reminderRules: ruleRows.map(deserializeRule),
      reminderLogs: logRows.map(deserializeLog),
    };
  } catch (error) {
    if (errorCode(error) === 401) onUnauthorized?.();
    if (isConnectionError(error)) onConnectionProblem?.();
    return null;
  }
}

export function syncBrand(brand: BrandSettings): Promise<unknown> {
  return upsert(TABLE_IDS.BRAND, 'default', serializeBrand(brand));
}

export function syncClient(client: Client): Promise<unknown> {
  return upsert(TABLE_IDS.CLIENTS, client.id, serializeClient(client));
}

export function deleteClientRemote(clientId: string): Promise<unknown> {
  return removeRow(TABLE_IDS.CLIENTS, clientId);
}

export function syncInvoice(invoice: Invoice): Promise<unknown> {
  return upsert(TABLE_IDS.INVOICES, invoice.id, serializeInvoice(invoice));
}

export async function updateInvoiceStatusRemote(
  invoiceId: string,
  status: InvoiceStatus,
  paidAt?: string
): Promise<unknown> {
  try {
    await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_IDS.INVOICES,
      rowId: toRowId(invoiceId),
      data: { status, paidAt: paidAt || null },
    });
  } catch (error) {
    if (errorCode(error) === 401) onUnauthorized?.();
  }
  return null;
}

export function deleteInvoiceRemote(invoiceId: string): Promise<unknown> {
  return removeRow(TABLE_IDS.INVOICES, invoiceId);
}

export function syncRecurring(schedule: RecurringSchedule): Promise<unknown> {
  return upsert(TABLE_IDS.RECURRING, schedule.id, serializeRecurring(schedule));
}

export function deleteRecurringRemote(scheduleId: string): Promise<unknown> {
  return removeRow(TABLE_IDS.RECURRING, scheduleId);
}

export function syncReminderRule(rule: ReminderRule): Promise<unknown> {
  return upsert(TABLE_IDS.RULES, rule.id, serializeRule(rule));
}

export function createReminderLogRemote(log: ReminderLog): Promise<unknown> {
  return upsert(TABLE_IDS.LOGS, log.id, serializeLog(log));
}

export function deleteReminderLogRemote(logId: string): Promise<unknown> {
  return removeRow(TABLE_IDS.LOGS, logId);
}

export async function clearReminderLogsRemote(): Promise<unknown> {
  try {
    const rows = await listRows(TABLE_IDS.LOGS);
    await Promise.all(rows.map((row) => removeRow(TABLE_IDS.LOGS, String(row.$id))));
  } catch (error) {
    if (errorCode(error) === 401) onUnauthorized?.();
  }
  return null;
}
