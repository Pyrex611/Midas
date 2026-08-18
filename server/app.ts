import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requireAuth } from './middleware/auth.middleware';
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

    // Allow configured origins, all Vercel deployments, localhost, and dev environments
    const isAllowed =
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.vercel.app') ||
      /^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(cleanOrigin) ||
      env.NODE_ENV === 'development';

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

// Body parsing with support for JSON and URL-encoded forms (required for Mailgun webhooks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Public Webhook Receivers (Mailgun & Clerk)
app.use('/api/webhooks', webhookRoutes);

// Automated VPS/Vercel Cron Triggers (Guarded by Bearer CRON_SECRET)
app.use('/api/cron', cronRoutes);

// Protected Core Application Routes (Guarded by Clerk RS256 JWKS requireAuth)
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/domains', requireAuth, domainRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/user', requireAuth, userRoutes);
app.use('/api/user/settings', requireAuth, userSettingsRoutes);
app.use('/api/diagnostics', requireAuth, diagnosticRoutes);

// Live Health Endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;