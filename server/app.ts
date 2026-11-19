import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './config/logger';
import { requireAuth } from './middleware/auth.middleware';
import { requireAdmin } from './middleware/requireAdmin.middleware';
import { requireAuthOrApiKey } from './middleware/dualAuth.middleware';
import { requestTimeoutGuard } from './middleware/requestTimeoutGuard.middleware';
import { createRateLimiter, limitMetadataSize } from './middleware/rateLimit.middleware';
import cronRoutes from './routes/cron.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import domainRoutes from './routes/domain.routes';
import webhookRoutes from './routes/webhooks.routes';
import webhookSubscriptionRoutes from './routes/webhookSubscription.routes';
import inboxRoutes from './routes/inbox.routes';
import aiRoutes from './routes/ai.routes';
import diagnosticRoutes from './routes/diagnostic.routes';
import userRoutes from './routes/user.routes';
import userSettingsRoutes from './routes/userSettings.routes';
import configRoutes from './routes/config.routes';
import unsubscribeRoutes from './routes/unsubscribe.routes';
import adminRoutes from './routes/admin.routes';
import migrationRoutes from './routes/migration.routes';
import trackRoutes from './routes/track.routes';
import townCrierRoutes from './routes/townCrier.routes';
import townCrierPublicRoutes from './routes/public/townCrier.public.routes';
import notificationRoutes from './routes/notification.routes';
import apiKeyRoutes from './routes/apiKey.routes';
import sandboxRoutes from './routes/sandbox.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import artifactRoutes from './routes/artifact.routes';
import billingRoutes from './routes/billing.routes';
import authChallengeRoutes from './routes/authChallenge.routes';

const app = express();

const allowedOrigins = (env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const dashboardCors = cors({
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-operator-token', 'x-action-passphrase'],
});

const publicWildcardCors = cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
});

app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/public/town-crier') ||
    req.path.startsWith('/api/track') ||
    req.path.startsWith('/api/unsubscribe')
  ) {
    return publicWildcardCors(req, res, next);
  }
  return dashboardCors(req, res, next);
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestTimeoutGuard(15000));

const publicSubscribeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'tc_sub',
  message: 'Subscription rate limit exceeded. Please wait a minute before retrying.',
});

const publicTelemetryLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  keyPrefix: 'pub_tel',
});

app.use('/api/auth', authChallengeRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/config', configRoutes);
app.use('/api/unsubscribe', publicTelemetryLimiter, unsubscribeRoutes);
app.use('/api/track', publicTelemetryLimiter, trackRoutes);

app.post('/api/public/town-crier/subscribe', publicSubscribeLimiter, limitMetadataSize(16384));
app.post('/api/public/town-crier/recipients/import', publicSubscribeLimiter);
app.use('/api/public/town-crier', townCrierPublicRoutes);

app.use('/api/campaigns', requireAuthOrApiKey, campaignRoutes);
app.use('/api/leads', requireAuthOrApiKey, leadRoutes);
app.use('/api/sandbox', requireAuthOrApiKey, sandboxRoutes);
app.use('/api/artifacts', requireAuthOrApiKey, artifactRoutes);

app.use('/api/domains', requireAuth, domainRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/knowledge', requireAuth, knowledgeRoutes);
app.use('/api/billing', requireAuth, billingRoutes);
app.use('/api/user', requireAuth, userRoutes);
app.use('/api/user/settings', requireAuth, userSettingsRoutes);
app.use('/api/user/webhooks', requireAuth, webhookSubscriptionRoutes);
app.use('/api/diagnostics', requireAuth, diagnosticRoutes);
app.use('/api/town-crier', requireAuth, townCrierRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/api-keys', requireAuth, apiKeyRoutes);
app.use('/api/admin/migration', requireAuth, requireAdmin, migrationRoutes);
app.use('/api/admin', requireAuth, adminRoutes);

export default app;