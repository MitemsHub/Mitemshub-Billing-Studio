// Vite resolves '@backend' at build time to the Express-backed client
// (serverApi.ts) or the browser Appwrite client (browserApi.ts), so a build ships
// only the backend it actually uses. See the alias in vite.config.ts.
import * as backend from '@backend';

export type { AuthSession, SessionUser } from './serverApi';

export const {
  setUnauthorizedHandler,
  fetchAuthSession,
  signIn,
  signOut,
  fetchBackendState,
  syncBrand,
  syncClient,
  deleteClientRemote,
  syncInvoice,
  updateInvoiceStatusRemote,
  deleteInvoiceRemote,
  syncRecurring,
  deleteRecurringRemote,
  syncReminderRule,
  createReminderLogRemote,
  deleteReminderLogRemote,
  clearReminderLogsRemote,
} = backend;
