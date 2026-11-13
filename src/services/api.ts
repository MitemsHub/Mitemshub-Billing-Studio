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

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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
