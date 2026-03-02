import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { imapService } from './services/imap.service';

const port = env.PORT;

app.listen(port, () => {
	imapService.startPolling();
  logger.info(`🚀 Backend running on port ${port} in ${env.NODE_ENV} mode`);
});