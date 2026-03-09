import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { LeadService } from '../services/lead.service';
import { parseLeadFile } from '../utils/fileParser';
import { UploadQuerySchema } from '../types/lead.types';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AuthRequest } from '../middleware/auth.middleware';

const upload = multer({
  limits: { fileSize: parseInt(env.MAX_FILE_SIZE_MB) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json', // 👈 added JSON support
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, TXT, XLSX, JSON allowed.'));
    }
  },
});

const leadService = new LeadService();

/**
 * POST /api/leads/upload
 * Upload and parse lead file, then save directly to database.
 */
export const uploadLeads = [
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user!.id;
      const query = UploadQuerySchema.parse(req.query);
      const skipDuplicates = query.skipDuplicates === 'true';

      const { leads, errors: parseErrors } = await parseLeadFile(
        req.file.buffer,
        req.file.mimetype
      );

      if (leads.length === 0) {
        return res.status(400).json({
          error: 'No valid leads found in file',
          parseErrors,
        });
      }

      let result;
      try {
        result = await leadService.createLeads(userId, leads, skipDuplicates);
      } catch (saveError: any) {
        logger.error({ saveError }, '❌ Lead creation threw exception');
        return res.status(500).json({
          error: 'Failed to save leads to database',
          details: saveError.message,
          hint: 'Check database connectivity and schema. Run `npx prisma migrate dev`.',
        });
      }

      if (result.created === 0 && leads.length > 0 && result.failed === 0 && result.duplicates === 0) {
        logger.error(
          {
            leads: leads.length,
            result,
          },
          '❌ Zero leads created with no errors – possible schema mismatch'
        );
        return res.status(500).json({
          error: 'Database write succeeded but no records were created',
          hint: 'Run `npx prisma migrate dev` and `npx prisma generate`',
        });
      }

      logger.info({ result, parseErrors }, 'File upload processed successfully');

      res.status(201).json({
        success: true,
        summary: {
          totalRows: leads.length + parseErrors.length,
          valid: leads.length,
          created: result.created,
          duplicates: result.duplicates,
          failed: result.failed,
          parseErrors,
          dbErrors: result.errors,
        },
        createdLeadIds: result.createdLeads.map((l: any) => l.id),
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * GET /api/leads
 * List leads with pagination and optional status/campaign filter.
 */
export const getLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { page, pageSize, status, campaignId } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const size = parseInt(pageSize as string) || 20;

    const result = await leadService.getLeads(
      userId,
      pageNum,
      size,
      status as any,
      campaignId as string | undefined
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leads/:id
 * Retrieve a single lead by ID.
 */
export const getLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const lead = await leadService.getLead(userId, req.params.id);
    res.json(lead);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    next(error);
  }
};

/**
 * PUT /api/leads/:id
 * Update a lead.
 */
export const updateLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const lead = await leadService.updateLead(userId, req.params.id, req.body);
    res.json(lead);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    next(error);
  }
};

/**
 * DELETE /api/leads/:id
 * Delete a lead.
 */
export const deleteLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    await leadService.deleteLead(userId, req.params.id);
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Lead not found' });
    }
    next(error);
  }
};