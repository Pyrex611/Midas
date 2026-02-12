import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const port = env.PORT;

app.listen(port, () => {
  logger.info(`🚀 Backend running on port ${port} in ${env.NODE_ENV} mode`);
});