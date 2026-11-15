import prisma from '../lib/prisma';
import { blobService } from './blob.service';

export class ArtifactService {
  private cleanSlug(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || `asset-${Date.now()}`;
  }

  async listArtifacts(userId: string, filters?: { campaignId?: string; gongId?: string }) {
    return prisma.artifact.findMany({
      where: {
        userId,
        ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters?.gongId ? { gongId: filters.gongId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLinkArtifact(
    userId: string,
    input: {
      title: string;
      slug?: string;
      url: string;
      type?: 'LINK' | 'DOCUMENT' | 'IMAGE';
      campaignId?: string | null;
      gongId?: string | null;
    }
  ) {
    if (!input.title?.trim() || !input.url?.trim()) {
      throw new Error('Title and URL are required');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url.trim());
    } catch {
      throw new Error('Provide a valid https:// URL');
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only http:// and https:// URLs are permitted');
    }

    const slug = this.cleanSlug(input.slug || input.title);

    return prisma.artifact.create({
      data: {
        userId,
        campaignId: input.campaignId || null,
        gongId: input.gongId || null,
        title: input.title.trim(),
        slug,
        type: input.type || 'LINK',
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
      campaignId?: string | null;
      gongId?: string | null;
    }
  ) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
    const artifactType = isImage ? 'IMAGE' : 'DOCUMENT';

    const title = input.title?.trim() || file.originalname;
    const slug = this.cleanSlug(input.slug || title.replace(/\.[^.]+$/, ''));
    const safePath = `artifacts/${userId}/${Date.now()}-${slug}.${ext}`;

    const blobUrl = await blobService.uploadFile(safePath, file.buffer);

    return prisma.artifact.create({
      data: {
        userId,
        campaignId: input.campaignId || null,
        gongId: input.gongId || null,
        title,
        slug,
        type: artifactType,
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
}

export const artifactService = new ArtifactService();