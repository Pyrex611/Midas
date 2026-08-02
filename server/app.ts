import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.middleware';
import authRoutes from './routes/auth.routes';
import cronRoutes from './routes/cron.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import domainRoutes from './routes/domain.routes';
import webhookRoutes from './routes/webhooks.routes';
import inboxRoutes from './routes/inbox.routes';
import aiRoutes from './routes/ai.routes';
import diagnosticRoutes from './routes/diagnostic.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Public Webhook Receivers
app.use('/api/webhooks', webhookRoutes);

// Auth Routes (Public)
app.use('/api/auth', authRoutes);

// Cron Routes
app.use('/api/cron', cronRoutes);

// Protected API Routes
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/domains', requireAuth, domainRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/diagnostics', requireAuth, diagnosticRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

export default app;