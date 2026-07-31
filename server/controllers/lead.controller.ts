import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { blobService } from '../services/blob.service';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

export const uploadLeads = [
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      
      const userId = req.user!.id;
      const fileExt = req.file.originalname.split('.').pop() || 'csv';
      const safeName = `uploads/${userId}-${Date.now()}.${fileExt}`;
      
      // Upload to Vercel Blob
      const blobUrl = await blobService.uploadFile(safeName, req.file.buffer);

      // Create Async Job
      const job = await prisma.uploadJob.create({
        data: {
          userId,
          filename: req.file.originalname,
          blobUrl,
          status: 'PENDING'
        }
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
    const block = await prisma.blocklist.create({ data: { userId: req.user!.id, pattern: pattern.toLowerCase().trim() } });
    res.status(201).json(block);
  } catch (error) { next(error); }
};

export const deleteBlocklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.blocklist.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const getLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { page = '1', pageSize = '20', campaignId } = req.query;
    const p = parseInt(page as string);
    const s = parseInt(pageSize as string);

    const where: any = { userId };
    if (campaignId) where.campaignId = campaignId;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({ where, skip: (p - 1) * s, take: s, orderBy: { createdAt: 'desc' } }),
      prisma.lead.count({ where }),
    ]);
    res.json({ data: leads, pagination: { page: p, pageSize: s, total, totalPages: Math.ceil(total / s) } });
  } catch (error) { next(error); }
};

export const deleteLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id, userId: req.user!.id } });
    res.json({ success: true });
  } catch (error) { next(error); }
};