import prisma from '../lib/prisma';
import { blobService } from './blob.service';
import { planGuardService } from './billing/planGuard.service';
import { assertSafePublicUrl } from '../lib/ssrfGuard';
import { EspAttachment } from './esp/types';

export class ArtifactService {
  private cleanSlug(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || `asset-${Date.now()}`;
  }

  async listArtifacts(
    userId: string,
    filters?: { campaignId?: string; gongId?: string; broadcastId?: string }
  ) {
    return prisma.artifact.findMany({
      where: {
        userId,
        ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters?.gongId ? { gongId: filters.gongId } : {}),
        ...(filters?.broadcastId ? { broadcastId: filters.broadcastId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLinkArtifact(
    userId: string,
    input: {
      title: string;
      slug?: string;
      description?: string;
      usagePrompt?: string;
      url: string;
      type?: 'LINK' | 'DOCUMENT' | 'IMAGE';
      attachmentMode?: 'LINK' | 'MIME_ATTACHMENT';
      isOneTime?: boolean;
      campaignId?: string | null;
      gongId?: string | null;
      broadcastId?: string | null;
    }
  ) {
    if (!input.title?.trim() || !input.url?.trim()) {
      throw new Error('Title and URL are required');
    }

    const parsedUrl = await assertSafePublicUrl(input.url);

    await planGuardService.assertArtifactCapacity(userId, {
      campaignId: input.campaignId,
      gongId: input.gongId,
      broadcastId: input.broadcastId,
    });

    const slug = this.cleanSlug(input.slug || input.title);
    const attachmentMode = input.attachmentMode === 'MIME_ATTACHMENT' ? 'MIME_ATTACHMENT' : 'LINK';

    return prisma.artifact.create({
      data: {
        userId,
        campaignId: input.campaignId || null,
        gongId: input.gongId || null,
        broadcastId: input.broadcastId || null,
        title: input.title.trim(),
        slug,
        description: input.description?.trim() || null,
        usagePrompt: input.usagePrompt?.trim() || null,
        type: input.type || 'LINK',
        attachmentMode,
        isOneTime: Boolean(input.isOneTime),
        url: parsedUrl.toString(),
      },
    });
  }

  async uploadFileArtifact(
    userId: string,
    file: Express.Multer.File,
    input: {
      title?: string;
      slug?: string;
      description?: string;
      usagePrompt?: string;
      attachmentMode?: 'LINK' | 'MIME_ATTACHMENT';
      isOneTime?: boolean;
      campaignId?: string | null;
      gongId?: string | null;
      broadcastId?: string | null;
    }
  ) {
    await planGuardService.assertArtifactCapacity(
      userId,
      {
        campaignId: input.campaignId,
        gongId: input.gongId,
        broadcastId: input.broadcastId,
      },
      file.size
    );

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
    const artifactType = isImage ? 'IMAGE' : 'DOCUMENT';

    const title = input.title?.trim() || file.originalname;
    const slug = this.cleanSlug(input.slug || title.replace(/\.[^.]+$/, ''));
    const safePath = `artifacts/${userId}/${Date.now()}-${slug}.${ext}`;

    const blobUrl = await blobService.uploadFile(safePath, file.buffer);
    const attachmentMode = input.attachmentMode === 'MIME_ATTACHMENT' ? 'MIME_ATTACHMENT' : 'LINK';

    return prisma.artifact.create({
      data: {
        userId,
        campaignId: input.campaignId || null,
        gongId: input.gongId || null,
        broadcastId: input.broadcastId || null,
        title,
        slug,
        description: input.description?.trim() || null,
        usagePrompt: input.usagePrompt?.trim() || null,
        type: artifactType,
        attachmentMode,
        isOneTime: Boolean(input.isOneTime),
        url: blobUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }

  async deleteArtifact(userId: string, id: string) {
    await prisma.artifact.deleteMany({ where: { id, userId } });
  }

  async getArtifactMapForUser(userId: string): Promise<Record<string, { url: string; type: string; title: string }>> {
    const rows = await prisma.artifact.findMany({
      where: { userId },
      select: { slug: true, url: true, type: true, title: true },
    });

    const map: Record<string, { url: string; type: string; title: string }> = {};
    for (const row of rows) {
      map[row.slug.toLowerCase()] = { url: row.url, type: row.type, title: row.title };
    }
    return map;
  }

  async resolveMimeAttachmentsForScope(
    userId: string,
    scope: { broadcastId?: string | null; gongId?: string | null }
  ): Promise<EspAttachment[]> {
    const orFilters: any[] = [];
    if (scope.broadcastId) orFilters.push({ broadcastId: scope.broadcastId });
    if (scope.gongId) orFilters.push({ gongId: scope.gongId });
    if (orFilters.length === 0) return [];

    const rows = await prisma.artifact.findMany({
      where: {
        userId,
        attachmentMode: 'MIME_ATTACHMENT',
        OR: orFilters,
      },
    });

    return rows.map((r) => {
      const extMatch = r.url.split('?')[0].match(/\.([a-z0-9]+)$/i);
      const ext = extMatch ? `.${extMatch[1]}` : '';
      const filename = r.title.includes('.') ? r.title : `${r.slug}${ext}`;
      return {
        filename,
        url: r.url,
        contentType: r.mimeType || undefined,
      };
    });
  }

  async buildArtifactsPromptContext(
    userId: string,
    scope?: { campaignId?: string | null; gongId?: string | null; broadcastId?: string | null }
  ): Promise<string | null> {
    const rows = await prisma.artifact.findMany({
      where: {
        userId,
        ...(scope?.campaignId
          ? { OR: [{ campaignId: scope.campaignId }, { campaignId: null, gongId: null, broadcastId: null }] }
          : scope?.gongId
          ? { OR: [{ gongId: scope.gongId }, { campaignId: null, gongId: null, broadcastId: null }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (rows.length === 0) return null;

    const lines = [
      'AVAILABLE ARTIFACTS (Insert exact token {{artifact:slug}} when relevant to the recipient):',
      ...rows.map((r) => {
        const desc = r.description ? ` — ${r.description}` : '';
        const rule = r.usagePrompt ? ` | When to use: ${r.usagePrompt}` : '';
        return `- {{artifact:${r.slug}}} [${r.type}] "${r.title}"${desc}${rule}`;
      }),
    ];

    return lines.join('\n');
  }
}

export const artifactService = new ArtifactService();