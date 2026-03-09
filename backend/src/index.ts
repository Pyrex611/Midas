import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { imapService } from './services/imap.service';
import { emailQueueService } from './services/emailQueue.service';

const port = env.PORT;

app.listen(port, () => {
	imapService.startPolling();
  logger.info(`🚀 Backend running on port ${port} in ${env.NODE_ENV} mode`);
	emailQueueService.start();
});