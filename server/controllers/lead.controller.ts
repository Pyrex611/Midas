import { Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { blobService } from '../services/blob.service';
import { leadQueueService } from '../services/leadQueue.service';
import { enrichmentService } from '../services/enrichment.service';
import { LeadUpdateSchema } from '../types/lead.types';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

const LeadUpdateWithEmailSchema = LeadUpdateSchema.extend({
  email: z.string().email().max(255).optional(),
}).strict();

export const uploadLeads = [
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const userId = req.user!.id;
      const fileExt = req.file.originalname.split('.').pop() || 'csv';
      const safeName = `uploads/${userId}-${Date.now()}.${fileExt}`;

      const blobUrl = await blobService.uploadFile(safeName, req.file.buffer);
      const verifyEmails = req.body.verifyEmails === 'true' || req.body.verifyEmails === true;
      const columnMapping = typeof req.body.columnMapping === 'string' ? req.body.columnMapping : null;
      const campaignId = typeof req.body.campaignId === 'string' && req.body.campaignId.trim() ? req.body.campaignId.trim() : null;

      if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: campaignId, userId },
          select: { id: true },
        });
        if (!campaign) return res.status(404).json({ error: 'Target campaign not found on your account' });
      }

      const job = await prisma.uploadJob.create({
        data: {
          userId,
          filename: req.file.originalname,
          blobUrl,
          status: 'PENDING',
          verifyEmails,
          columnMapping,
          campaignId,
        },
      });

      leadQueueService.processPendingUploads().catch(err => {
        logger.error({ err }, 'Background lead upload worker error');
      });

      res.status(202).json({ success: true, jobId: job.id, status: 'PENDING' });
    } catch (error) {
      next(error);
    }
  },
];

export const getUploadJobs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.uploadJob.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
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
    if (!pattern || typeof pattern !== 'string' || !pattern.trim()) {
      return res.status(400).json({ error: 'Pattern is required' });
    }
    const block = await prisma.blocklist.create({
      data: { userId: req.user!.id, pattern: pattern.toLowerCase().trim() },
    });
    res.status(201).json(block);
  } catch (error) { next(error); }
};

export const deleteBlocklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
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

    const p = Math.max(1, parseInt(pageStr, 10) || 1);
    const s = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 20));

    let where: any = { userId };

    if (campaignIdStr && campaignIdStr !== 'all') {
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
    const lead = await prisma.lead.findFirst({ where: { id, userId: req.user!.id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const enrichLead = async (req: AuthRequest, res: Response) => {
  try {
    const updated = await enrichmentService.enrichLead(req.user!.id, req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Lead enrichment failed' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parsed = LeadUpdateWithEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid lead update fields',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data: Record<string, any> = { ...parsed.data };
    if (data.email) data.email = data.email.toLowerCase().trim();

    const result = await prisma.lead.updateMany({
      where: { id, userId: req.user!.id },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'Lead not found' });

    const lead = await prisma.lead.findUnique({ where: { id } });
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await prisma.lead.deleteMany({ where: { id, userId: req.user!.id } });
    if (result.count === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};