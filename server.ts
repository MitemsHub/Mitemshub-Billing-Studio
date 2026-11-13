import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearReminderLogs,
  createReminderLog,
  ensureAppwriteReady,
  getFullState,
  isAppwriteConfigured,
  removeClient,
  removeInvoice,
  removeRecurring,
  removeReminderLog,
  saveBrand,
  updateInvoiceFields,
  upsertClient,
  upsertInvoice,
  upsertRecurring,
  upsertReminderRule,
} from './server/appwrite.ts';
import type {
  BrandSettings,
  Client,
  Invoice,
  RecurringSchedule,
  ReminderLog,
  ReminderRule,
} from './src/types/billing.ts';
import {
  clearLoginFailures,
  clearSessionCookie,
  createSessionToken,
  isAuthEnabled,
  isLoginBlocked,
  noteLoginFailure,
  readSession,
  requireSession,
  setSessionCookie,
  verifyCredentials,
} from './server/auth.ts';

// Load .env.local first (local overrides), then .env. Existing variables win, so
// credentials can live in either file without being overwritten.
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Guard against an inherited PORT of "0"/""/NaN, which would bind a random port.
const parsedPort = Number(process.env.PORT);
const PORT =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', async (_req, res) => {
    const configured = isAppwriteConfigured();
    if (!configured) {
      return res.json({
        ok: true,
        appwriteConfigured: false,
        databaseId: process.env.APPWRITE_DATABASE_ID || 'mitemshub_billing',
      });
    }
    try {
      await ensureAppwriteReady();
      return res.json({
        ok: true,
        appwriteConfigured: true,
        databaseId: process.env.APPWRITE_DATABASE_ID || 'mitemshub_billing',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Appwrite connection failed';
      return res.status(500).json({ ok: false, appwriteConfigured: true, error: message });
    }
  });

  app.get('/api/auth/session', (req, res) => {
    const session = readSession(req);
    res.json({
      authEnabled: isAuthEnabled(),
      // Mirrors requireSession: without Appwrite there is nothing to log in to.
      authenticated: !isAuthEnabled() || session !== null,
      user: session,
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!isAuthEnabled()) {
      return res.status(400).json({ error: 'Appwrite is not configured on this server.' });
    }

    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const attemptKey = req.ip ?? 'unknown';
    if (isLoginBlocked(attemptKey)) {
      return res.status(429).json({ error: 'Too many attempts. Try again in 10 minutes.' });
    }

    try {
      const user = await verifyCredentials(email.trim(), password);
      clearLoginFailures(attemptKey);
      setSessionCookie(res, createSessionToken(user));
      return res.json({ user });
    } catch {
      noteLoginFailure(attemptKey);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  // Everything below this line requires a valid session when Appwrite is configured.
  app.use('/api', requireSession);

  app.get('/api/state', async (_req, res) => {
    if (!isAppwriteConfigured()) {
      return res.status(503).json({ error: 'Appwrite backend not configured' });
    }
    try {
      const state = await getFullState();
      return res.json(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load state from Appwrite';
      return res.status(500).json({ error: message });
    }
  });

  app.put('/api/brand', async (req, res) => {
    try {
      const brand = await saveBrand(req.body as BrandSettings);
      return res.json({ brand });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/clients/:id', async (req, res) => {
    try {
      const payload = { ...(req.body as Client), id: req.params.id };
      const client = await upsertClient(payload);
      return res.json({ client });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      await removeClient(req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/invoices/:id', async (req, res) => {
    try {
      const payload = { ...(req.body as Invoice), id: req.params.id };
      const invoice = await upsertInvoice(payload);
      return res.json({ invoice });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/invoices/:id/status', async (req, res) => {
    try {
      const { status, paidAt } = req.body as { status: Invoice['status']; paidAt?: string };
      await updateInvoiceFields(req.params.id, {
        status,
        paidAt: paidAt || null,
      });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/invoices/:id', async (req, res) => {
    try {
      await removeInvoice(req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/recurring/:id', async (req, res) => {
    try {
      const payload = { ...(req.body as RecurringSchedule), id: req.params.id };
      const schedule = await upsertRecurring(payload);
      return res.json({ schedule });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/recurring/:id', async (req, res) => {
    try {
      await removeRecurring(req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/reminder-rules/:id', async (req, res) => {
    try {
      const payload = { ...(req.body as ReminderRule), id: req.params.id };
      const rule = await upsertReminderRule(payload);
      return res.json({ rule });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/reminder-logs', async (req, res) => {
    try {
      const log = await createReminderLog(req.body as ReminderLog);
      return res.json({ log });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/reminder-logs/:id', async (req, res) => {
    try {
      await removeReminderLog(req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/reminder-logs', async (_req, res) => {
    try {
      const deletedCount = await clearReminderLogs();
      return res.json({ ok: true, deletedCount });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mitemshub Billing Studio listening on http://0.0.0.0:${PORT}`);
  });

  if (isAppwriteConfigured()) {
    ensureAppwriteReady().catch((err) => {
      console.error('Appwrite initialization warning:', err instanceof Error ? err.message : err);
    });
  }
}

startServer();
