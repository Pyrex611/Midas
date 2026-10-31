import { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';

export const updateAutoReply = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { autoReplyEnabled } = req.body;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { autoReplyEnabled: !!autoReplyEnabled },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const updateSendHour = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { sendHourUTC } = req.body;
    const hour = Number(sendHourUTC);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'sendHourUTC must be an integer between 0 and 23' });
    }
    const updated = await prisma.campaign.update({
      where: { id },
      data: { sendHourUTC: hour },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const updateActiveHours = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { activeStartHour, activeEndHour, timezone } = req.body;
    const updated = await prisma.campaign.update({
      where: { id },
      data: { activeStartHour, activeEndHour, timezone },
    });
    res.json(updated);
  } catch (error) { next(error); }
};

export const getFollowUpSteps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const steps = await prisma.followUpStep.findMany({
      where: { campaignId: id },
      orderBy: { stepNumber: 'asc' },
    });
    res.json(steps);
  } catch (error) { next(error); }
};

export const setFollowUpSteps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { steps } = req.body;

    if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps must be an array' });

    await prisma.followUpStep.deleteMany({ where: { campaignId: id } });
    const created = await Promise.all(
      steps.map((step: any) =>
        prisma.followUpStep.create({
          data: { campaignId: id, stepNumber: step.stepNumber, delayDays: step.delayDays },
        })
      )
    );

    res.status(201).json(created);
  } catch (error) { next(error); }
};

export const deleteFollowUpStep = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const stepId = req.params.stepId as string;
    await prisma.followUpStep.deleteMany({ where: { id: stepId, campaignId: id } });
    res.status(204).send();
  } catch (error) { next(error); }
};