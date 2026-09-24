import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requireAuth } from './middleware/auth.middleware';
import { requireAdmin } from './middleware/requireAdmin.middleware';
import { requestTimeoutGuard } from './middleware/requestTimeoutGuard.middleware';
import cronRoutes from './routes/cron.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import domainRoutes from './routes/domain.routes';
import webhookRoutes from './routes/webhooks.routes';
import inboxRoutes from './routes/inbox.routes';
import aiRoutes from './routes/ai.routes';
import diagnosticRoutes from './routes/diagnostic.routes';
import userRoutes from './routes/user.routes';
import userSettingsRoutes from './routes/userSettings.routes';
import configRoutes from './routes/config.routes';
import unsubscribeRoutes from './routes/unsubscribe.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// Parse and clean configured allowed origins
const allowedOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server-to-server, webhooks, curl, VPS crons)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.trim().replace(/\/$/, '');

    // Allow: explicitly configured origins, this project's own Vercel preview
    // deployments (scoped by prefix — NOT every *.vercel.app site, which
    // would let any unrelated Vercel-hosted page make credentialed requests
    // against this API), and localhost for local dev.
    const isOwnVercelPreview =
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(cleanOrigin) &&
      cleanOrigin.includes(`${env.CORS_VERCEL_PROJECT_PREFIX}-`);

    const isAllowed =
      allowedOrigins.includes(cleanOrigin) ||
      isOwnVercelPreview ||
      /^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(cleanOrigin);

    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

// Body parsing with support for JSON and URL-encoded forms (required for Mailgun webhooks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Turns a hung upstream dependency (database, AI provider, Mailgun, etc.)
// into a fast, clear 503 instead of every page silently hanging until
// Vercel's own ~300s hard limit kills the function with no useful signal.
app.use(requestTimeoutGuard(15000));

// Public Webhook Receivers (Mailgun & Clerk)
app.use('/api/webhooks', webhookRoutes);

// Automated VPS/Vercel Cron Triggers (Guarded by Bearer CRON_SECRET)
app.use('/api/cron', cronRoutes);

// Public, non-sensitive feature flags (e.g. "is real email verification available")
app.use('/api/config', configRoutes);

// Public one-click/manual unsubscribe (recipients are never logged into Midas)
app.use('/api/unsubscribe', unsubscribeRoutes);

// Protected Core Application Routes (Guarded by Clerk RS256 JWKS requireAuth)
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/domains', requireAuth, domainRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/user', requireAuth, userRoutes);
app.use('/api/user/settings', requireAuth, userSettingsRoutes);
app.use('/api/diagnostics', requireAuth, diagnosticRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

// Live Health Endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;
