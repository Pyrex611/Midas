import app from './app';
import { logger } from './config/logger';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  logger.info(`🚀 Backend running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
});