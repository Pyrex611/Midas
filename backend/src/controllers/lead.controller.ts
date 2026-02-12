import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { LeadService } from '../services/lead.service';
import { parseLeadFile } from '../utils/fileParser';
import { UploadQuerySchema, ListQuerySchema } from '../types/lead.types';
import { env } from '../config/env';
import { logger } from '../config/logger';

const upload = multer({
  limits: { fileSize: parseInt(env.MAX_FILE_SIZE_MB) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, TXT, XLSX allowed.'));
    }
  },
});

const leadService = new LeadService();

export const uploadLeads = [
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

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

      const result = await leadService.createLeads(leads, skipDuplicates);

      logger.info({ result, parseErrors }, 'File upload processed');

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
      });
    } catch (error) {
      next(error);
    }
  },
];

export const getLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page, pageSize, status } = ListQuerySchema.parse(req.query);
    const result = await leadService.getLeads(
      parseInt(page),
      parseInt(pageSize),
      status as any
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

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