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

export interface SessionUser {
  email: string;
  name: string;
}

export interface AuthSession {
  authEnabled: boolean;
  authenticated: boolean;
  user: SessionUser | null;
}

let onUnauthorized: (() => void) | null = null;

/** Lets the app drop back to the sign-in screen when a session expires. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
    });
    if (res.status === 401) {
      onUnauthorized?.();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAuthSession(): Promise<AuthSession | null> {
  return apiRequest<AuthSession>('/api/auth/session');
}

export async function signIn(
  email: string,
  password: string
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => null)) as
      | { user?: SessionUser; error?: string }
      | null;
    if (res.ok && data?.user) return { ok: true, user: data.user };
    return { ok: false, error: data?.error || 'Sign in failed.' };
  } catch {
    return { ok: false, error: 'Cannot reach the server.' };
  }
}

export async function signOut(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function fetchBackendState(): Promise<PersistedState | null> {
  return apiRequest<PersistedState>('/api/state');
}

export function syncBrand(brand: BrandSettings): Promise<unknown> {
  return apiRequest('/api/brand', {
    method: 'PUT',
    body: JSON.stringify(brand),
  });
}

export function syncClient(client: Client): Promise<unknown> {
  return apiRequest(`/api/clients/${encodeURIComponent(client.id)}`, {
    method: 'PUT',
    body: JSON.stringify(client),
  });
}

export function deleteClientRemote(clientId: string): Promise<unknown> {
  return apiRequest(`/api/clients/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
  });
}

export function syncInvoice(invoice: Invoice): Promise<unknown> {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoice.id)}`, {
    method: 'PUT',
    body: JSON.stringify(invoice),
  });
}

export function updateInvoiceStatusRemote(
  invoiceId: string,
  status: InvoiceStatus,
  paidAt?: string
): Promise<unknown> {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, paidAt }),
  });
}

export function deleteInvoiceRemote(invoiceId: string): Promise<unknown> {
  return apiRequest(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'DELETE',
  });
}

export function syncRecurring(schedule: RecurringSchedule): Promise<unknown> {
  return apiRequest(`/api/recurring/${encodeURIComponent(schedule.id)}`, {
    method: 'PUT',
    body: JSON.stringify(schedule),
  });
}

export function deleteRecurringRemote(scheduleId: string): Promise<unknown> {
  return apiRequest(`/api/recurring/${encodeURIComponent(scheduleId)}`, {
    method: 'DELETE',
  });
}

export function syncReminderRule(rule: ReminderRule): Promise<unknown> {
  return apiRequest(`/api/reminder-rules/${encodeURIComponent(rule.id)}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
  });
}

export function createReminderLogRemote(log: ReminderLog): Promise<unknown> {
  return apiRequest('/api/reminder-logs', {
    method: 'POST',
    body: JSON.stringify(log),
  });
}

export function deleteReminderLogRemote(logId: string): Promise<unknown> {
  return apiRequest(`/api/reminder-logs/${encodeURIComponent(logId)}`, {
    method: 'DELETE',
  });
}

export function clearReminderLogsRemote(): Promise<unknown> {
  return apiRequest('/api/reminder-logs', {
    method: 'DELETE',
  });
}
