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
  /** False when the backend could not be reached at all, as opposed to a signed-out session. */
  reachable?: boolean;
  /** False when the build shipped without an Appwrite endpoint/project id. */
  configured?: boolean;
}

let onUnauthorized: (() => void) | null = null;
let onConnectionProblem: (() => void) | null = null;

/** Lets the app drop back to the sign-in screen when a session expires. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Lets the app say "cannot reach the server" instead of pretending a request succeeded. */
export function setConnectionProblemHandler(handler: (() => void) | null): void {
  onConnectionProblem = handler;
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
    // fetch only throws when the request never completed (offline, server down).
    onConnectionProblem?.();
    return null;
  }
}

export async function fetchAuthSession(): Promise<AuthSession | null> {
  // Written out rather than reusing apiRequest: a null there means both "session
  // expired" and "server never answered", and only the second one may claim the
  // server is unreachable.
  try {
    const res = await fetch('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status === 401) {
      onUnauthorized?.();
      return { authEnabled: true, authenticated: false, user: null };
    }
    if (!res.ok) return { authEnabled: true, authenticated: false, user: null };
    return (await res.json()) as AuthSession;
  } catch {
    onConnectionProblem?.();
    return { authEnabled: true, authenticated: false, user: null, reachable: false };
  }
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
