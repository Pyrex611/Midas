import crypto from 'crypto';
import prisma from '../lib/prisma';
import { env } from '../config/env';
import { isEmailBlocked } from '../lib/blocklist';
import { planGuardService } from './billing/planGuard.service';
import { sandboxService } from './sandbox.service';
import { artifactService } from './artifact.service';

export interface McpActor {
  userId: string;
  userEmail: string;
  scopes?: string[];
  baseUrl: string;
}

interface McpToolDef {
  name: string;
  description: string;
  requiredScope: string;
  inputSchema: object;
}

const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'midas_create_gong_channel',
    description: 'Create a Town Crier Gong newsletter publication channel with optional welcome autoresponder.',
    requiredScope: 'town_crier:write',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Channel display name' },
        slug: { type: 'string', description: 'URL-friendly channel slug (e.g. weekly-alpha)' },
        cadence: { type: 'string', enum: ['daily', 'weekly', 'biweekly', 'monthly'] },
        welcomeEmailEnabled: { type: 'boolean' },
        welcomeSubject: { type: 'string' },
        welcomeBody: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'midas_get_embed_snippet',
    description: 'Generate ready-to-paste HTML Shadow-DOM modal and React <MidasModal /> snippets for a Gong slug.',
    requiredScope: 'town_crier:read',
    inputSchema: {
      type: 'object',
      properties: {
        gongSlug: { type: 'string', description: 'Target Gong slug or ID' },
        headline: { type: 'string' },
        accentColor: { type: 'string' },
      },
      required: ['gongSlug'],
    },
  },
  {
    name: 'midas_subscribe_contact',
    description: 'Subscribe or update a contact onto a Town Crier Gong newsletter channel.',
    requiredScope: 'town_crier:write',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        name: { type: 'string' },
        gongSlug: { type: 'string' },
        cadence: { type: 'string', enum: ['daily', 'weekly', 'biweekly', 'monthly'] },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['email'],
    },
  },
  {
    name: 'midas_send_sandbox_test',
    description: 'Send a guarded Zero-Setup Sandbox test email strictly to the authenticated workspace owner email.',
    requiredScope: 'campaigns:write',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
    },
  },
  {
    name: 'midas_get_campaign_health',
    description: 'Inspect active cold outreach campaigns, queue counts, sender assignment, and health diagnostics.',
    requiredScope: 'campaigns:read',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Optional campaign ID; omit to list all campaigns' },
      },
    },
  },
  {
    name: 'midas_create_artifact',
    description: 'Register a tracked {{artifact:slug}} smart link resource scoped optionally to a campaign or Gong.',
    requiredScope: 'campaigns:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        url: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        usagePrompt: { type: 'string' },
        campaignId: { type: 'string' },
        gongId: { type: 'string' },
      },
      required: ['title', 'url'],
    },
  },
];

export class McpService {
  private hasScope(scopes: string[] | undefined, requiredScope: string): boolean {
    if (!scopes) return true; // Session JWT authenticated users pass
    if (scopes.includes('*') || scopes.includes(requiredScope)) return true;
    const [domain] = requiredScope.split(':');
    return scopes.includes(`${domain}:*`);
  }

  public listTools() {
    return MCP_TOOLS.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  public async callTool(name: string, args: Record<string, any> = {}, actor: McpActor) {
    const tool = MCP_TOOLS.find((t) => t.name === name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown MCP tool "${name}"` }],
      };
    }

    if (!this.hasScope(actor.scopes, tool.requiredScope)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Forbidden: API key lacks required permission scope "${tool.requiredScope}".`,
          },
        ],
      };
    }

    try {
      let result: any;

      switch (name) {
        case 'midas_create_gong_channel': {
          const rawName = String(args.name || '').trim();
          if (!rawName) throw new Error('name is required');
          await planGuardService.assertGongCapacity(actor.userId);
          const slug = String(args.slug || rawName)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_-]/g, '-');
          const gong = await prisma.gong.create({
            data: {
              userId: actor.userId,
              name: rawName,
              slug,
              cadence: ['daily', 'weekly', 'biweekly', 'monthly'].includes(args.cadence) ? args.cadence : 'weekly',
              welcomeEmailEnabled: Boolean(args.welcomeEmailEnabled),
              welcomeSubject: args.welcomeSubject ? String(args.welcomeSubject).trim() : null,
              welcomeBody: args.welcomeBody ? String(args.welcomeBody).trim() : null,
            },
          });
          result = { success: true, gong };
          break;
        }

        case 'midas_get_embed_snippet': {
          const gongSlug = String(args.gongSlug || '').trim();
          if (!gongSlug) throw new Error('gongSlug is required');
          const gong = await prisma.gong.findFirst({
            where: {
              userId: actor.userId,
              OR: [{ id: gongSlug }, { slug: gongSlug.toLowerCase() }],
            },
          });
          const resolvedSlug = gong?.slug || gongSlug;
          const headline = String(args.headline || gong?.headline || 'Join our newsletter');
          const accent = String(args.accentColor || gong?.accentColor || '#4A2559');
          const origin = actor.baseUrl || env.APP_URL || 'https://midas-aem.vercel.app';

          result = {
            gongSlug: resolvedSlug,
            htmlModalSnippet: `<script src="${origin}/api/public/town-crier/widget.js" async></script>\n<button data-town-crier-modal data-key="midas_live_YOUR_KEY" data-gong="${resolvedSlug}" data-fields="name,email,cadence" data-headline="${headline}" data-accent="${accent}">Subscribe</button>`,
            reactSnippet: `import { MidasModal } from '@midas-aem/client/react';\n\n<MidasModal gongId="${resolvedSlug}" headline="${headline}" accent="${accent}">Subscribe</MidasModal>`,
          };
          break;
        }

        case 'midas_subscribe_contact': {
          const email = String(args.email || '').trim().toLowerCase();
          if (!email || !email.includes('@')) throw new Error('Valid email is required');

          const blocklist = await prisma.blocklist.findMany({ where: { userId: actor.userId } });
          if (isEmailBlocked(email, blocklist)) {
            throw new Error('Recipient email matches workspace blocklist rules');
          }

          const existing = await prisma.newsletterRecipient.findUnique({
            where: { userId_email: { userId: actor.userId, email } },
            select: { id: true },
          });
          if (!existing) {
            await planGuardService.assertSubscriberCapacity(actor.userId, 1);
          }

          let gongId: string | null = null;
          if (args.gongSlug) {
            const g = await prisma.gong.findFirst({
              where: {
                userId: actor.userId,
                OR: [{ id: String(args.gongSlug) }, { slug: String(args.gongSlug).toLowerCase() }],
              },
              select: { id: true },
            });
            gongId = g?.id || null;
          }

          const subscriber = await prisma.newsletterRecipient.upsert({
            where: { userId_email: { userId: actor.userId, email } },
            update: {
              name: args.name ? String(args.name).trim() : undefined,
              cadence: args.cadence || undefined,
              status: 'SUBSCRIBED',
              ...(gongId ? { gongId } : {}),
            },
            create: {
              userId: actor.userId,
              email,
              name: args.name ? String(args.name).trim() : null,
              cadence: args.cadence || 'weekly',
              gongId,
              source: 'mcp',
              status: 'SUBSCRIBED',
              tags: Array.isArray(args.tags) ? args.tags.map(String) : ['mcp'],
              unsubscribeToken: crypto.randomBytes(16).toString('hex'),
            },
          });
          result = { success: true, subscriber };
          break;
        }

        case 'midas_send_sandbox_test': {
          result = await sandboxService.sendSandboxTest({
            userId: actor.userId,
            userEmail: actor.userEmail,
            subject: args.subject,
            body: args.body,
          });
          break;
        }

        case 'midas_get_campaign_health': {
          if (args.campaignId) {
            const campaign = await prisma.campaign.findFirst({
              where: { id: String(args.campaignId), userId: actor.userId },
              include: {
                senderLinks: { include: { sender: { include: { domain: true } } } },
                _count: { select: { leads: true, pendingEmails: true, emails: true } },
              },
            });
            if (!campaign) throw new Error('Campaign not found');
            const activeSenders = campaign.senderLinks
              .map((l) => l.sender)
              .filter((s) => s.status === 'active' && s.domain.status === 'active');
            result = {
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              leadsCount: campaign._count.leads,
              queuedCount: campaign._count.pendingEmails,
              sentEmailsCount: campaign._count.emails,
              activeSendersCount: activeSenders.length,
            };
          } else {
            const campaigns = await prisma.campaign.findMany({
              where: { userId: actor.userId },
              include: { _count: { select: { leads: true, pendingEmails: true, emails: true } } },
              orderBy: { createdAt: 'desc' },
              take: 25,
            });
            result = { campaigns };
          }
          break;
        }

        case 'midas_create_artifact': {
          const artifact = await artifactService.createLinkArtifact(actor.userId, {
            title: String(args.title || ''),
            url: String(args.url || ''),
            slug: args.slug ? String(args.slug) : undefined,
            description: args.description ? String(args.description) : undefined,
            usagePrompt: args.usagePrompt ? String(args.usagePrompt) : undefined,
            campaignId: args.campaignId ? String(args.campaignId) : null,
            gongId: args.gongId ? String(args.gongId) : null,
          });
          result = { success: true, token: `{{artifact:${artifact.slug}}}`, artifact };
          break;
        }

        default:
          throw new Error(`Unsupported tool "${name}"`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: err?.message || 'Tool execution failed' }],
      };
    }
  }
}

export const mcpService = new McpService();