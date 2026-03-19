import { OutreachStatus, CampaignRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { DraftService } from './draft.service';
import { personalisationService } from './personalisation.service';
import { emailService } from './email.service';
import { logger } from '../config/logger';

const draftService = new DraftService();

export class CampaignService {
  /**
   * Create a new campaign (Foundation Level).
   * Note: TargetTool and ExtendedObjective are added later via the detail page.
   */
  async createCampaign(
    userId: string,
    name: string,
    description?: string,
    context?: string,
    reference?: string,
    senderName?: string,
    leadIds?: string[],
    autoReplyEnabled?: boolean,
    sendHourUTC?: number,
    objective?: string
  ) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error(`Invalid userId format: ${userId}.`);
    }

    try {
      const campaign = await prisma.$transaction(async (tx) => {
        const newCampaign = await tx.campaign.create({
          data: {
            userId,
            name,
            description,
            context,
            reference,
            objective,
            status: leadIds?.length ? 'ACTIVE' : 'DRAFT',
            startedAt: leadIds?.length ? new Date() : null,
            autoReplyEnabled: autoReplyEnabled ?? false,
            sendHourUTC: sendHourUTC ?? 9,
            ...(leadIds?.length && {
              leads: { connect: leadIds.map(id => ({ id })) },
            }),
          },
        });

        // Register owner
        await tx.campaignMember.create({
          data: { campaignId: newCampaign.id, userId, role: 'OWNER' }
        });

        if (leadIds?.length) {
          await tx.lead.updateMany({
            where: { id: { in: leadIds }, userId },
            data: { outreachStatus: 'PENDING' as OutreachStatus },
          });
        }

        return newCampaign;
      });

      // 🔥 Trigger the Strategy Generator (Initial Pass)
      await this.generateCampaignStrategy(campaign.id, userId);

      // 🔥 Initial Draft Generation
      await draftService.generateMultipleDrafts(
        userId, 3, 'professional', 'initial', 
        campaign.id, context, reference, undefined, senderName, undefined, objective
      );

			// Strategy Mapping
			await this.generateCampaignStrategy(campaign.id, userId);

			// Generate a "Draft Pool" for each Follow-up Step
			const steps = await prisma.followUpStep.findMany({ where: { campaignId: campaign.id } });
			for (const step of steps) {
					// Generate 3 unique variations for each step to ensure leads don't get identical emails
					// and to allow the system to pick the "best" one later based on performance.
					await draftService.generateMultipleDrafts(
							userId, 
							3, // Count per step
							'professional', 
							'followup', 
							campaign.id, 
							context, 
							reference, 
							undefined, 
							senderName, 
							step.stepNumber, 
							objective,
							step.microObjective // Use the analytical goal for this step
					);
			}

      return campaign;
    } catch (error) {
      logger.error({ error }, 'Failed to create campaign');
      throw new Error('Campaign creation failed');
    }
  }

  /**
   * Strategically break down the campaign goals into a psychological sequence.
   * Can be re-triggered when the user adds a Reference Story or Target Tool later.
   */
  async generateCampaignStrategy(campaignId: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, members: { some: { userId } } }
    });

    if (!campaign) throw new Error("Campaign access denied");

    const hasRef = !!campaign.reference;
    
    // Analytical Strategy Mapping
    const narrativeArc = [
      {
        step: 1,
        delay: 3,
        goal: "The Perspective: Establish empathy with a specific industry observation. Do not sell yet."
      },
      {
        step: 2,
        delay: 6,
        goal: hasRef 
          ? "The Proof: Use the success story of {{reference_company}} to build logical trust."
          : "The Logic: Highlight the negative cost of inaction regarding their current problem."
      },
      {
        step: 3,
        delay: 10,
        goal: "The Transition: Acknowledge they are likely busy. Offer your Conversion Tool/Goal as a low-friction resource."
      }
    ];

    // Atomic Upsert of Steps
    await prisma.$transaction(
      narrativeArc.map(s => prisma.followUpStep.upsert({
        where: { campaignId_stepNumber: { campaignId, stepNumber: s.step } },
        update: { microObjective: s.goal, delayDays: s.delay },
        create: { campaignId, stepNumber: s.step, delayDays: s.delay, microObjective: s.goal }
      }))
    );

    logger.info({ campaignId }, 'Campaign strategy analytically mapped');
  }

  /**
   * Update Campaign Strategy (Used when adding Tool/Reference post-creation)
   */
  async updateStrategy(campaignId: string, userId: string, data: any) {
    // 1. Update the campaign primary data
    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
          objective: data.objective,
          extendedObjective: data.extendedObjective,
          targetTool: data.targetTool,
          // Users might also want to update context/ref here
          context: data.context || undefined,
          reference: data.reference || undefined
      }
    });

    // 2. Re-trigger the analytical strategy generation
    // This updates the FollowUpSteps' microObjectives based on the new data
    await this.generateCampaignStrategy(campaignId, userId);

    logger.info({ campaignId }, 'Strategy DNA updated and sequence re-mapped');
    return campaign;
  }

  /**
   * Add leads to an existing campaign, skipping duplicates.
   */
  async addLeadsToCampaign(userId: string, campaignId: string, leadIds: string[]) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: { leads: { select: { id: true } } },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const existingLeadIds = new Set(campaign.leads.map(l => l.id));
    const newLeadIds = leadIds.filter(id => !existingLeadIds.has(id));

    if (newLeadIds.length === 0) {
      return { added: 0, skipped: leadIds.length };
    }

    await prisma.lead.updateMany({
      where: { id: { in: newLeadIds }, userId },
      data: {
        campaignId,
        outreachStatus: 'PENDING' as OutreachStatus,
      },
    });

    if (campaign.status === 'DRAFT') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          startedAt: new Date(),
        },
      });
    }

    // Process in background
    this.processCampaign(userId, campaignId, newLeadIds).catch(err => {
      logger.error({ err, userId, campaignId }, 'Background lead processing failed');
    });

    return { added: newLeadIds.length, skipped: leadIds.length - newLeadIds.length };
  }

  /**
   * Update auto‑reply setting.
   */
  async updateAutoReplySettings(userId: string, campaignId: string, autoReplyEnabled: boolean) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: { autoReplyEnabled },
    });
  }

  /**
   * Update send hour (UTC).
   */
  async updateSendHour(userId: string, campaignId: string, sendHourUTC: number) {
    if (sendHourUTC < 0 || sendHourUTC > 23) throw new Error('sendHourUTC must be 0-23');
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: { sendHourUTC },
    });
  }

  /**
   * Update active hours.
   */
  async updateActiveHours(
    userId: string,
    campaignId: string,
    activeStartHour?: number | null,
    activeEndHour?: number | null,
    timezone?: string | null
  ) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaign.update({
      where: { id: campaignId },
      data: { activeStartHour, activeEndHour, timezone },
    });
  }

  /**
   * Get all follow‑up steps for a campaign (with draft counts).
   */
  async getFollowUpSteps(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    const steps = await prisma.followUpStep.findMany({
      where: { campaignId },
      orderBy: { stepNumber: 'asc' },
    });

    // Add draft count to each step
    const stepsWithCounts = await Promise.all(
      steps.map(async (step) => {
        const draftCount = await prisma.draft.count({
          where: { userId, campaignId, stepNumber: step.stepNumber, isActive: true },
        });
        return { ...step, draftCount };
      })
    );

    return stepsWithCounts;
  }

  /**
   * Replace all follow‑up steps for a campaign (bulk update).
   */
  async setFollowUpSteps(
    userId: string,
    campaignId: string,
    steps: { stepNumber: number; delayDays: number }[]
  ) {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    // Validate step numbers are unique
    const stepNumbers = steps.map(s => s.stepNumber);
    if (new Set(stepNumbers).size !== steps.length) {
      throw new Error('Duplicate step numbers not allowed');
    }

    // Use transaction to replace all steps
    return prisma.$transaction(async (tx) => {
      await tx.followUpStep.deleteMany({ where: { campaignId } });
      const created = await Promise.all(
        steps.map(step =>
          tx.followUpStep.create({
            data: {
              campaignId,
              stepNumber: step.stepNumber,
              delayDays: step.delayDays,
            },
          })
        )
      );
      return created;
    });
  }

  /**
   * Delete a specific follow‑up step.
   */
  async deleteFollowUpStep(userId: string, stepId: string) {
    const step = await prisma.followUpStep.findUnique({
      where: { id: stepId },
      include: { campaign: true },
    });
    if (!step) throw new Error('Step not found');
    if (step.campaign.userId !== userId) throw new Error('Unauthorized');
    await prisma.followUpStep.delete({ where: { id: stepId } });
  }

  /**
   * Process leads in a campaign (initial outreach).
   */
  private async processCampaign(userId: string, campaignId: string, specificLeadIds?: string[]) {
		try {
			let drafts = await prisma.draft.findMany({
				where: { userId, campaignId, isActive: true, useCase: 'initial' },
			});

			if (drafts.length === 0) {
				logger.info({ campaignId }, 'No initial drafts found, generating 5 new drafts');
				const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
				if (campaign) {
					await draftService.generateMultipleDrafts(
						userId,
						5,
						'professional',
						'initial',
						campaignId,
						campaign.context || undefined,
						campaign.reference || undefined,
						undefined,
						campaign.senderName || undefined
					);
					drafts = await prisma.draft.findMany({ where: { userId, campaignId, isActive: true, useCase: 'initial' } });
				}
			}

			if (drafts.length === 0) {
				logger.error({ campaignId }, 'Failed to generate initial drafts');
				return;
			}

			const whereClause: any = { userId, campaignId };
			if (specificLeadIds) {
				whereClause.id = { in: specificLeadIds };
			} else {
				whereClause.outreachStatus = { in: ['PENDING', 'PROCESSING'] };
			}

			const leads = await prisma.lead.findMany({ where: whereClause });
			const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });

			if (leads.length === 0) return;

			for (const lead of leads) {
				try {
					const randomIndex = Math.floor(Math.random() * drafts.length);
					const draft = drafts[randomIndex];

					logger.info({ leadId: lead.id, selectedDraftId: draft.id }, 'Random draft selected for lead');

					await prisma.lead.update({
						where: { id: lead.id },
						data: { outreachStatus: 'PROCESSING' as OutreachStatus },
					});

					const { subject, body } = personalisationService.personalise(
						lead as any,
						draft.subject,
						draft.body,
						campaign?.reference,
						campaign?.senderName
					);

					// ✅ CORRECT: use campaignId, not lead.id
					await emailService.queueEmail(
						userId,
						campaignId,   // <-- must be the campaign's ID
						lead.id,
						draft.id,
						subject,
						body
					);

					await prisma.lead.update({
						where: { id: lead.id },
						data: { outreachStatus: 'QUEUED' as OutreachStatus },
					});

					logger.info({ leadId: lead.id }, 'Email queued');
				} catch (error: any) {
					logger.error({ error, leadId: lead.id }, 'Error processing lead');
					await prisma.lead.update({
						where: { id: lead.id },
						data: { outreachStatus: 'FAILED' as OutreachStatus },
					});
				}
			}

			if (!specificLeadIds) {
				const remaining = await prisma.lead.count({
					where: { userId, campaignId, outreachStatus: { in: ['PENDING', 'PROCESSING', 'QUEUED'] } },
				});
				if (remaining === 0) {
					await prisma.campaign.update({
						where: { id: campaignId },
						data: { status: 'COMPLETED', completedAt: new Date() },
					});
				}
			}
		} catch (error) {
			logger.error({ error, userId, campaignId }, 'Fatal error in processCampaign');
		}
	}

  /**
   * Get all campaigns for a user.
   */
  async getCampaigns(userId: string) {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            leads: true,
            emails: true,
            drafts: true,
          },
        },
      },
    });
  }

  /**
   * Get detailed campaign information.
   * Updated to support membership access and include member list.
   */
  async getCampaignDetails(userId: string, campaignId: string) {
    // 1. Fetch campaign where user is either the Creator OR a Member
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        OR: [
          { userId: userId },
          { members: { some: { userId: userId } } }
        ]
      },
      include: {
        // Include members and their user profiles for the Team tab
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        },
        leads: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            position: true,
            outreachStatus: true,
            status: true,
          },
        },
        drafts: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        emails: {
          orderBy: { sentAt: 'desc' },
          take: 100,
        },
        followUpSteps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!campaign) return null;

    // 2. Compute draft counts for each step (same as before)
    const stepsWithCounts = await Promise.all(
      campaign.followUpSteps.map(async (step) => {
        const draftCount = await prisma.draft.count({
          where: { campaignId, stepNumber: step.stepNumber, isActive: true },
        });
        return { ...step, draftCount };
      })
    );

    // 3. Compute queued count (same as before)
    const queuedCount = await prisma.pendingEmail.count({
      where: { campaignId, status: 'PENDING' },
    });

    return {
      ...campaign,
      followUpSteps: stepsWithCounts,
      queuedCount,
    };
  }
	
	/**
	 * Get mailboxes linked to a campaign.
	 */
	async getCampaignMailboxes(userId: string, campaignId: string) {
		const campaign = await prisma.campaign.findFirst({
			where: { id: campaignId, userId },
			include: {
				mailboxLinks: {
					include: { mailbox: true },
				},
			},
		});
		if (!campaign) throw new Error('Campaign not found');
		return campaign.mailboxLinks.map(link => link.mailbox);
	}

	/**
	 * Link a mailbox to a campaign.
	 */
	async addMailboxToCampaign(userId: string, campaignId: string, mailboxId: string) {
		// Ensure campaign and mailbox belong to user
		const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
		if (!campaign) throw new Error('Campaign not found');
		const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, userId } });
		if (!mailbox) throw new Error('Mailbox not found');

		return prisma.campaignMailbox.create({
			data: {
				campaignId,
				mailboxId,
			},
		});
	}

	/**
	 * Remove a mailbox from a campaign.
	 */
	async removeMailboxFromCampaign(userId: string, campaignId: string, mailboxId: string) {
		const link = await prisma.campaignMailbox.findFirst({
			where: { campaignId, mailboxId },
			include: { campaign: true },
		});
		if (!link) throw new Error('Link not found');
		if (link.campaign.userId !== userId) throw new Error('Unauthorized');
		await prisma.campaignMailbox.delete({ where: { id: link.id } });
	}
}