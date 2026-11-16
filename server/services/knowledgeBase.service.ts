import prisma from '../lib/prisma';
import { blobService } from './blob.service';
import { extractTextFromDocument } from '../utils/documentExtractor';
import { planGuardService } from './billing/planGuard.service';
import { assertSafePublicUrl } from '../lib/ssrfGuard';

export class KnowledgeBaseService {
  async listKnowledgeBases(userId: string) {
    return prisma.knowledgeBase.findMany({
      where: { userId },
      include: {
        resources: { orderBy: { createdAt: 'desc' } },
        _count: { select: { campaigns: true, gongs: true, broadcasts: true, resources: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getOrCreateDefaultKnowledgeBase(userId: string) {
    let kb = await prisma.knowledgeBase.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    if (!kb) {
      kb = await prisma.knowledgeBase.create({
        data: {
          userId,
          name: 'Company Primary Knowledge Base',
          description: 'Default workspace repository of company positioning, services, and playbooks.',
          isDefault: true,
        },
      });
    }

    return kb;
  }

  async createKnowledgeBase(userId: string, input: { name: string; description?: string; isDefault?: boolean }) {
    if (!input.name?.trim()) throw new Error('Knowledge Base name is required');
    await planGuardService.assertKnowledgeBaseCapacity(userId);

    if (input.isDefault) {
      await prisma.knowledgeBase.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    return prisma.knowledgeBase.create({
      data: {
        userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isDefault: Boolean(input.isDefault),
      },
      include: {
        resources: true,
        _count: { select: { campaigns: true, gongs: true, broadcasts: true, resources: true } },
      },
    });
  }

  async updateKnowledgeBase(userId: string, id: string, data: { name?: string; description?: string; isDefault?: boolean }) {
    const existing = await prisma.knowledgeBase.findFirst({ where: { id, userId } });
    if (!existing) throw new Error('Knowledge Base not found');

    if (data.isDefault) {
      await prisma.knowledgeBase.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    return prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(data.isDefault !== undefined ? { isDefault: Boolean(data.isDefault) } : {}),
      },
    });
  }

  async deleteKnowledgeBase(userId: string, id: string) {
    await prisma.knowledgeBase.deleteMany({ where: { id, userId } });
  }

  async addTextResource(userId: string, knowledgeBaseId: string, input: { title: string; content: string }) {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: knowledgeBaseId, userId } });
    if (!kb) throw new Error('Knowledge Base not found');
    if (!input.title?.trim() || !input.content?.trim()) throw new Error('Title and content are required');

    await planGuardService.assertKnowledgeResourceCapacity(userId, knowledgeBaseId);

    return prisma.knowledgeResource.create({
      data: {
        knowledgeBaseId,
        userId,
        title: input.title.trim(),
        sourceType: 'TEXT',
        content: input.content.trim().slice(0, 12000),
      },
    });
  }

  async scrapeUrlResource(userId: string, knowledgeBaseId: string, urlString: string, title?: string) {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: knowledgeBaseId, userId } });
    if (!kb) throw new Error('Knowledge Base not found');
    await planGuardService.assertKnowledgeResourceCapacity(userId, knowledgeBaseId);

    const parsedUrl = await assertSafePublicUrl(urlString);

    const res = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'MidasKnowledgeBot/1.0 (+https://midas-aem.vercel.app)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Website returned HTTP ${res.status}`);

    const rawHtml = await res.text();
    const extractedTitle =
      title?.trim() ||
      rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      parsedUrl.hostname;

    const cleanText = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    if (cleanText.length < 40) {
      throw new Error('Could not extract readable text from that URL. Try uploading a .md/.pdf or pasting text directly.');
    }

    return prisma.knowledgeResource.create({
      data: {
        knowledgeBaseId,
        userId,
        title: extractedTitle,
        sourceType: 'URL',
        sourceUrl: parsedUrl.toString(),
        content: cleanText,
      },
    });
  }

  async uploadFileResource(userId: string, knowledgeBaseId: string, file: Express.Multer.File, title?: string) {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: knowledgeBaseId, userId } });
    if (!kb) throw new Error('Knowledge Base not found');
    await planGuardService.assertKnowledgeResourceCapacity(userId, knowledgeBaseId);

    const extractedText = extractTextFromDocument(file.buffer, file.originalname, file.mimetype);
    const safeName = `kb/${userId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fileUrl = await blobService.uploadFile(safeName, file.buffer);

    return prisma.knowledgeResource.create({
      data: {
        knowledgeBaseId,
        userId,
        title: title?.trim() || file.originalname,
        sourceType: 'FILE',
        fileUrl,
        mimeType: file.mimetype,
        content: extractedText,
      },
    });
  }

  async toggleOrUpdateResource(userId: string, resourceId: string, data: { title?: string; content?: string; isActive?: boolean }) {
    const cleanData: any = {};
    if (data.title !== undefined) cleanData.title = data.title.trim();
    if (data.content !== undefined) cleanData.content = data.content.trim().slice(0, 12000);
    if (data.isActive !== undefined) cleanData.isActive = Boolean(data.isActive);

    const res = await prisma.knowledgeResource.updateMany({
      where: { id: resourceId, userId },
      data: cleanData,
    });
    if (res.count === 0) throw new Error('Knowledge resource not found');
    return prisma.knowledgeResource.findUnique({ where: { id: resourceId } });
  }

  async deleteResource(userId: string, resourceId: string) {
    await prisma.knowledgeResource.deleteMany({ where: { id: resourceId, userId } });
  }

  async attachToEntity(
    userId: string,
    targetType: 'campaign' | 'gong' | 'broadcast',
    targetId: string,
    knowledgeBaseId: string | null
  ) {
    if (knowledgeBaseId) {
      const kb = await prisma.knowledgeBase.findFirst({ where: { id: knowledgeBaseId, userId } });
      if (!kb) throw new Error('Knowledge Base not found');
    }

    if (targetType === 'campaign') {
      const res = await prisma.campaign.updateMany({ where: { id: targetId, userId }, data: { knowledgeBaseId } });
      if (res.count === 0) throw new Error('Campaign not found');
    } else if (targetType === 'gong') {
      const res = await prisma.gong.updateMany({ where: { id: targetId, userId }, data: { knowledgeBaseId } });
      if (res.count === 0) throw new Error('Gong channel not found');
    } else if (targetType === 'broadcast') {
      const res = await prisma.newsletterBroadcast.updateMany({ where: { id: targetId, userId }, data: { knowledgeBaseId } });
      if (res.count === 0) throw new Error('Broadcast not found');
    }
  }

  async buildPromptContext(
    userId: string,
    options?: {
      campaignId?: string | null;
      gongId?: string | null;
      broadcastId?: string | null;
      knowledgeBaseId?: string | null;
    }
  ): Promise<string | null> {
    let targetKbId = options?.knowledgeBaseId || null;

    if (!targetKbId && options?.campaignId) {
      const camp = await prisma.campaign.findUnique({ where: { id: options.campaignId }, select: { knowledgeBaseId: true } });
      targetKbId = camp?.knowledgeBaseId || null;
    }

    if (!targetKbId && options?.broadcastId) {
      const b = await prisma.newsletterBroadcast.findUnique({
        where: { id: options.broadcastId },
        select: { knowledgeBaseId: true, gong: { select: { knowledgeBaseId: true } } },
      });
      targetKbId = b?.knowledgeBaseId || b?.gong?.knowledgeBaseId || null;
    }

    if (!targetKbId && options?.gongId) {
      const g = await prisma.gong.findUnique({ where: { id: options.gongId }, select: { knowledgeBaseId: true } });
      targetKbId = g?.knowledgeBaseId || null;
    }

    if (!targetKbId) {
      const defKb = await prisma.knowledgeBase.findFirst({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      targetKbId = defKb?.id || null;
    }

    if (!targetKbId) return null;

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: targetKbId },
      include: {
        resources: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        },
      },
    });

    if (!kb || kb.resources.length === 0) return null;

    let combined = `KNOWLEDGE BASE ("${kb.name}" — Ground claims strictly in these facts):\n`;
    for (const r of kb.resources) {
      const snippet = r.content.slice(0, 750);
      const entry = `- [${r.title} (${r.sourceType})]: ${snippet}\n`;
      if (combined.length + entry.length > 3500) break;
      combined += entry;
    }

    return combined.trim();
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();