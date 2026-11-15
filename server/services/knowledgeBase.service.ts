import prisma from '../lib/prisma';

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.')
  ) {
    return true;
  }
  const match172 = h.match(/^172\.(\d+)\./);
  if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) {
    return true;
  }
  return false;
}

export class KnowledgeBaseService {
  async listItems(userId: string, campaignId?: string) {
    return prisma.knowledgeItem.findMany({
      where: {
        userId,
        ...(campaignId ? { OR: [{ campaignId }, { campaignId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(
    userId: string,
    input: {
      title: string;
      content: string;
      sourceType?: 'TEXT' | 'URL' | 'DOCUMENT';
      sourceUrl?: string;
      campaignId?: string | null;
    }
  ) {
    if (!input.title?.trim() || !input.content?.trim()) {
      throw new Error('Title and content are required');
    }

    if (input.campaignId) {
      const owned = await prisma.campaign.findFirst({
        where: { id: input.campaignId, userId },
        select: { id: true },
      });
      if (!owned) throw new Error('Campaign not found');
    }

    return prisma.knowledgeItem.create({
      data: {
        userId,
        campaignId: input.campaignId || null,
        title: input.title.trim(),
        sourceType: input.sourceType || 'TEXT',
        sourceUrl: input.sourceUrl?.trim() || null,
        content: input.content.trim().slice(0, 8000),
      },
    });
  }

  async scrapeUrlAndSave(userId: string, urlString: string, title?: string, campaignId?: string | null) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlString.trim());
    } catch {
      throw new Error('Invalid URL format. Include https://');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol) || isPrivateOrLocalHostname(parsedUrl.hostname)) {
      throw new Error('URL must be a public http:// or https:// webpage');
    }

    const res = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'MidasKnowledgeBot/1.0 (+https://midas-aem.vercel.app)' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      throw new Error(`Website returned HTTP ${res.status}`);
    }

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
      .slice(0, 4500);

    if (cleanText.length < 40) {
      throw new Error('Could not extract readable text content from that URL (may require JS rendering). Try pasting text directly.');
    }

    return this.createItem(userId, {
      title: extractedTitle,
      sourceType: 'URL',
      sourceUrl: parsedUrl.toString(),
      content: cleanText,
      campaignId,
    });
  }

  async toggleOrUpdate(userId: string, id: string, data: { title?: string; content?: string; isActive?: boolean }) {
    const cleanData: any = {};
    if (data.title !== undefined) cleanData.title = data.title.trim();
    if (data.content !== undefined) cleanData.content = data.content.trim().slice(0, 8000);
    if (data.isActive !== undefined) cleanData.isActive = Boolean(data.isActive);

    const res = await prisma.knowledgeItem.updateMany({
      where: { id, userId },
      data: cleanData,
    });
    if (res.count === 0) throw new Error('Knowledge base item not found');
    return prisma.knowledgeItem.findUnique({ where: { id } });
  }

  async deleteItem(userId: string, id: string) {
    await prisma.knowledgeItem.deleteMany({ where: { id, userId } });
  }

  /**
   * Formats active global & campaign-specific Knowledge Base entries into
   * a compact, grounded context block for AI draft & objection synthesis.
   */
  async buildPromptContext(userId: string, campaignId?: string | null): Promise<string | null> {
    const items = await prisma.knowledgeItem.findMany({
      where: {
        userId,
        isActive: true,
        OR: campaignId ? [{ campaignId }, { campaignId: null }] : [{ campaignId: null }],
      },
      orderBy: [{ campaignId: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
    });

    if (items.length === 0) return null;

    let combined = 'COMPANY KNOWLEDGE BASE (Ground claims in these facts only):\n';
    for (const item of items) {
      const snippet = item.content.slice(0, 650);
      const entry = `- [${item.title}]: ${snippet}\n`;
      if (combined.length + entry.length > 2800) break;
      combined += entry;
    }

    return combined.trim();
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();