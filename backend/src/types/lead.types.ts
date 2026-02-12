import { z } from 'zod';

export const LeadCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  company: z.string().max(255).nullable().optional(),
  position: z.string().max(255).nullable().optional(),
});

export type LeadCreateInput = z.infer<typeof LeadCreateSchema>;

export const LeadUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).nullable().optional(),
  position: z.string().max(255).nullable().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
});

export type LeadUpdateInput = z.infer<typeof LeadUpdateSchema>;

export const UploadQuerySchema = z.object({
  skipDuplicates: z.enum(['true', 'false']).default('true'),
});

export const ListQuerySchema = z.object({
  page: z.string().default('1'),
  pageSize: z.string().default('20'),
  status: z.enum(['NEW', 'CONTACTED', 'FOLLOW_UP', 'REPLIED', 'UNSUBSCRIBED', 'BOUNCED']).optional(),
});