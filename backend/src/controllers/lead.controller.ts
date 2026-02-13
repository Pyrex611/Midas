import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { LeadService } from '../services/lead.service';
import { parseLeadFile } from '../utils/fileParser';
import { UploadQuerySchema, UploadPreviewResponse } from '../types/lead.types';
import { env } from '../config/env';
import { logger } from '../config/logger';

const upload = multer({
  limits: { fileSize: parseInt(env.MAX_FILE_SIZE_MB) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, TXT, XLSX allowed.'));
    }
  },
});

const leadService = new LeadService();

// Temporary in‑memory storage for upload sessions (for development)
// In production, replace with Redis or similar.
const uploadSessions = new Map<string, {
  leads: any[];
  emailCandidates: any[];
  skipDuplicates: boolean;
  expires: number;
}>();

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * POST /api/leads/upload
 * Upload and parse lead file. If email conflicts exist, returns preview and session.
 */
export const uploadLeads = [
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const query = UploadQuerySchema.parse(req.query);
      const skipDuplicates = query.skipDuplicates === 'true';

      const { leads, emailCandidates, errors: parseErrors } = await parseLeadFile(
        req.file.buffer,
        req.file.mimetype
      );

      if (leads.length === 0) {
        return res.status(400).json({
          error: 'No valid leads found in file',
          parseErrors,
        });
      }

      const response: UploadPreviewResponse = {
        success: true,
        summary: {
          totalRows: leads.length + parseErrors.length,
          valid: leads.length,
          created: 0, // not yet created
          duplicates: 0,
          failed: 0,
          parseErrors,
          dbErrors: [],
        },
        needsEmailSelection: false,
      };

      // If there are email conflicts, store session and ask for selection
      if (emailCandidates && emailCandidates.length > 0) {
        const sessionId = generateSessionId();
        uploadSessions.set(sessionId, {
          leads,
          emailCandidates: emailCandidates.map((item, idx) => ({
            ...item,
            leadPreview: {
              name: leads[item.rowIndex]?.name || 'Unknown',
              company: leads[item.rowIndex]?.company,
              position: leads[item.rowIndex]?.position,
            },
          })),
          skipDuplicates,
          expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        });

        response.needsEmailSelection = true;
        response.emailCandidates = uploadSessions.get(sessionId)!.emailCandidates;
        res.setHeader('X-Upload-Session', sessionId);
      } else {
        // No conflicts – save immediately
        const result = await leadService.createLeads(leads, skipDuplicates);
        response.summary.created = result.created;
        response.summary.duplicates = result.duplicates;
        response.summary.failed = result.failed;
        response.summary.dbErrors = result.errors;
      }

      logger.info({ response }, 'File upload processed');
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
];

/**
 * POST /api/leads/confirm-email-selection
 * Finalize upload after user selects emails.
 */
export const confirmEmailSelection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.headers['x-upload-session'] as string;
    if (!sessionId || !uploadSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or expired upload session' });
    }

    const session = uploadSessions.get(sessionId)!;
    const { selections } = req.body; // array of { rowIndex, selectedEmail }

    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'Invalid selections format' });
    }

    // Update leads with chosen emails
    const updatedLeads = session.leads.map((lead, idx) => {
      const selection = selections.find((s: any) => s.rowIndex === idx);
      if (selection) {
        return { ...lead, email: selection.selectedEmail };
      }
      return lead;
    });

    const result = await leadService.createLeads(updatedLeads, session.skipDuplicates);
    uploadSessions.delete(sessionId);

    res.json({
      success: true,
      summary: {
        created: result.created,
        duplicates: result.duplicates,
        failed: result.failed,
        errors: result.errors,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leads
 * List leads with pagination and optional status filter.
 */
export const getLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, pageSize, status } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const size = parseInt(pageSize as string) || 20;

    const result = await leadService.getLeads(
      pageNum,
      size,
      status as any
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
export const getLead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const lead = await leadService.getLead(req.params.id);
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/leads/:id
 * Update a lead.
 */
export const updateLead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const lead = await leadService.updateLead(req.params.id, req.body);
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/leads/:id
 * Delete a lead.
 */
export const deleteLead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await leadService.deleteLead(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/leads/debug/stats
 * Database health check – returns lead count.
 */
export const getDbStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const prisma = new (await import('@prisma/client')).PrismaClient();
    const count = await prisma.lead.count();
    await prisma.$disconnect();
    res.json({ database: 'SQLite', leadCount: count, status: 'healthy' });
  } catch (error) {
    next(error);
  }
};