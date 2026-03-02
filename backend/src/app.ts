import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import authRoutes from './routes/auth.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import diagnosticRoutes from './routes/diagnostic.routes';
import imapRoutes from './routes/imap.routes';
import { errorHandler } from './middleware/error.middleware';
import { requireAuth } from './middleware/auth.middleware';
import { env } from './config/env';
import { logger } from './config/logger';
import userRoutes from './routes/user.routes';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Public auth routes
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/diagnostics', requireAuth, diagnosticRoutes);
app.use('/api/imap', requireAuth, imapRoutes);
app.use('/api/user', requireAuth, userRoutes);

app.use(errorHandler);

export default app;