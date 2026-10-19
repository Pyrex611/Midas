import { Response, NextFunction } from 'express';
import multer from 'multer';
import { blobService } from '../services/blob.service';
import { leadQueueService } from '../services/leadQueue.service';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

export const uploadLeads = [
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const userId = req.user!.id;
      const fileExt = req.file.originalname.split('.').pop() || 'csv';
      const safeName = `uploads/${userId}-${Date.now()}.${fileExt}`;

      const blobUrl = await blobService.uploadFile(safeName, req.file.buffer);

      // multer puts non-file text fields on req.body alongside the file.
      // Coerce string 'true'/'false' from multipart/form-data into a boolean.
      const verifyEmails = req.body.verifyEmails === 'true' || req.body.verifyEmails === true;

      const job = await prisma.uploadJob.create({
        data: {
          userId,
          filename: req.file.originalname,
          blobUrl,
          status: 'PENDING',
          verifyEmails,
        }
      });

      // Trigger background processing asynchronously. Safe to call
      // concurrently with the scheduled/external cron (see leadQueue.service.ts).
      leadQueueService.processPendingUploads().catch(err => {
        logger.error({ err }, 'Background lead upload worker error');
      });

      res.status(202).json({ success: true, jobId: job.id, status: 'PENDING' });
    } catch (error) {
      next(error);
    }
  }
];

export const getUploadJobs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.uploadJob.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    res.json(jobs);
  } catch (error) {
    next(error);
  }
};

export const getBlocklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.blocklist.findMany({ where: { userId: req.user!.id } });
    res.json(list);
  } catch (error) { next(error); }
};

export const addBlocklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pattern } = req.body;
    if (!pattern) return res.status(400).json({ error: 'Pattern is required' });
    const block = await prisma.blocklist.create({
      data: { userId: req.user!.id, pattern: pattern.toLowerCase().trim() }
    });
    res.status(201).json(block);
  } catch (error) { next(error); }
};

export const deleteBlocklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    // Scope by userId — previously any authenticated user could delete any
    // other user's blocklist entry by guessing/enumerating its id.
    const result = await prisma.blocklist.deleteMany({ where: { id, userId: req.user!.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Blocklist entry not found' });
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const getLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const pageStr = (req.query.page as string) || '1';
    const pageSizeStr = (req.query.pageSize as string) || '20';
    const statusStr = req.query.status as string | undefined;
    const campaignIdStr = req.query.campaignId as string | undefined;

    const p = parseInt(pageStr, 10);
    const s = parseInt(pageSizeStr, 10);

    let where: any = { userId };

    if (campaignIdStr && campaignIdStr !== 'all') {
      // A lead's userId is always its uploader (the account owner), but a
      // campaign collaborator (EDITOR/VIEWER, not the owner) legitimately
      // needs to see that campaign's leads too — check membership instead of
      // hard-requiring userId to match when a specific campaign is requested.
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdStr },
        include: { members: { where: { userId }, select: { role: true } } },
      });
      const hasAccess = !!campaign && (campaign.userId === userId || campaign.members.length > 0);
      if (!hasAccess) return res.status(403).json({ error: 'Forbidden: no access to this campaign' });

      where = { campaignId: campaignIdStr };
    }

    if (statusStr && statusStr !== 'all') {
      where.status = statusStr;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (p - 1) * s,
        take: s,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      data: leads,
      pagination: {
        page: p,
        pageSize: s,
        total,
        totalPages: Math.ceil(total / s),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const lead = await prisma.lead.findFirstOrThrow({
      where: { id, userId: req.user!.id },
    });
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

const LEAD_UPDATABLE_FIELDS = ['name', 'email', 'company', 'position', 'status', 'outreachStatus'] as const;

export const updateLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    // Whitelist — `data: req.body` previously allowed setting any column,
    // including userId/campaignId/verificationStatus.
    const data: Record<string, any> = {};
    for (const field of LEAD_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    const lead = await prisma.lead.update({
      where: { id, userId: req.user!.id },
      data,
    });
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.lead.delete({ where: { id, userId: req.user!.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
