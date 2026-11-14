import { Account, Client, TablesDB } from 'appwrite';

// Public client configuration. The endpoint and project id are not secrets — they
// ship inside every Appwrite web app — but they are injected at build time so the
// same source can point at another project.
const endpoint = (import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined)?.trim() ?? '';
const projectId = (import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined)?.trim() ?? '';

export const DATABASE_ID =
  (import.meta.env.VITE_APPWRITE_DATABASE_ID as string | undefined)?.trim() ||
  'mitemshub_billing';

export const TABLE_IDS = {
  META: 'studio_meta',
  BRAND: 'brand_settings',
  CLIENTS: 'clients',
  INVOICES: 'invoices',
  RECURRING: 'recurring_schedules',
  RULES: 'reminder_rules',
  LOGS: 'reminder_logs',
} as const;

export const isAppwriteConfigured = Boolean(endpoint && projectId);

const client = new Client();
if (isAppwriteConfigured) {
  client.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(client);
export const tables = new TablesDB(client);
