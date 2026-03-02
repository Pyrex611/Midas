import { Request, Response, NextFunction } from 'express';
import { imapService } from '../services/imap.service';
import { logger } from '../config/logger';

export const triggerImapPoll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual IMAP poll triggered');
    // Run poll in background, don't block response
    imapService.manualPoll().catch(err => logger.error({ err }, 'Manual poll error'));
    res.json({ success: true, message: 'IMAP poll started' });
  } catch (error) {
    next(error);
  }
};