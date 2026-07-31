import express from 'express';
import cors from 'cors';
import { authMiddleware } from './lib/auth';
import { requireAuth } from './middleware/auth.middleware';
import authRoutes from './routes/auth.routes';
import cronRoutes from './routes/cron.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import domainRoutes from './routes/domain.routes';
import webhookRoutes from './routes/webhooks.routes';
import inboxRoutes from './routes/inbox.routes'; // <-- Added

const app = express();

app.use(cors());
app.use(express.json());

// Public Webhook Receivers
app.use('/api/webhooks', webhookRoutes);

// Auth.js built-in routes
app.use("/api/auth/*", authMiddleware);
app.use('/api/auth/custom', authRoutes);
app.use('/api/cron', cronRoutes);

// Protected API Routes
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/domains', requireAuth, domainRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes); // <-- Added

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

export default app;