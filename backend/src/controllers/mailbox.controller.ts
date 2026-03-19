import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { mailboxService } from '../services/mailbox.service';
import { logger } from '../config/logger';

/**
 * GET /api/mailboxes
 * List all mailboxes for the authenticated user.
 */
export const getMailboxes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const mailboxes = await mailboxService.getUserMailboxes(userId);
    res.json(mailboxes);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/mailboxes
 * Create a new mailbox.
 */
export const createMailbox = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const mailbox = await mailboxService.createMailbox(userId, req.body);
    res.status(201).json(mailbox);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/mailboxes/:id
 * Update a mailbox.
 */
export const updateMailbox = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updated = await mailboxService.updateMailbox(userId, id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/mailboxes/:id
 * Delete (deactivate) a mailbox.
 */
export const deleteMailbox = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await mailboxService.deleteMailbox(userId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};