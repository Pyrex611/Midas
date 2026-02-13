import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import leadRoutes from './routes/lead.routes';
import { errorHandler } from './middleware/error.middleware';
import { env } from './config/env';
import { logger } from './config/logger';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/leads', leadRoutes);

// Global error handler – must be last
app.use(errorHandler);

export default app;