import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { imapService } from './services/imap.service';
import { emailQueueService } from './services/emailQueue.service';
import { followUpService } from './services/followUp.service'; 

const port = env.PORT;

app.listen(port, () => {
	imapService.startPolling();
  logger.info(`🚀 Backend running on port ${port} in ${env.NODE_ENV} mode`);
	emailQueueService.start();
	
  const followUpInterval = parseInt(env.FOLLOW_UP_INTERVAL || '3600000'); // 1 hour in ms
  followUpService.start(followUpInterval);
});