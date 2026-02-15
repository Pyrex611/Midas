import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import leadRoutes from './routes/lead.routes';
import { errorHandler } from './middleware/error.middleware';
import { env } from './config/env';
import { logger } from './config/logger';
import campaignRoutes from './routes/campaign.routes';
import diagnosticRoutes from './routes/diagnostic.routes';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/leads', leadRoutes);

app.use('/api/campaigns', campaignRoutes);
app.use('/api/diagnostics', diagnosticRoutes);

// Global error handler – must be last
app.use(errorHandler);

export default app;