import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './config/logger';
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
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.trim().replace(/\/$/, '');

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

// Request Logger: Logs every incoming request and its completion status & latency
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Immediate Liveness Probe (Zero upstream dependencies, resolves before guards)
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Body parsing with support for JSON and URL-encoded forms
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Timeout guard backstop (15s default)
app.use(requestTimeoutGuard(15000));

// Public Webhook Receivers (Mailgun & Clerk)
app.use('/api/webhooks', webhookRoutes);

// Automated Cron Triggers (Guarded by Bearer CRON_SECRET)
app.use('/api/cron', cronRoutes);

// Public Feature Flags
app.use('/api/config', configRoutes);

// Public One-Click Unsubscribe
app.use('/api/unsubscribe', unsubscribeRoutes);

// Protected Core Application Routes
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/domains', requireAuth, domainRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/user', requireAuth, userRoutes);
app.use('/api/user/settings', requireAuth, userSettingsRoutes);
app.use('/api/diagnostics', requireAuth, diagnosticRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

export default app;