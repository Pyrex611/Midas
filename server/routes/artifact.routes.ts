import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/auth.middleware';
import { requireScopeIfApiKey } from '../middleware/dualAuth.middleware';
import { artifactService } from '../services/artifact.service';

const router = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', requireScopeIfApiKey('campaigns:read'), async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const gongId = req.query.gongId as string | undefined;
    const broadcastId = req.query.broadcastId as string | undefined;
    const list = await artifactService.listArtifacts(req.user!.id, { campaignId, gongId, broadcastId });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/link', requireScopeIfApiKey('campaigns:write'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      slug,
      description,
      usagePrompt,
      url,
      type,
      attachmentMode,
      isOneTime,
      campaignId,
      gongId,
      broadcastId,
    } = req.body;

    const artifact = await artifactService.createLinkArtifact(req.user!.id, {
      title,
      slug,
      description,
      usagePrompt,
      url,
      type,
      attachmentMode,
      isOneTime,
      campaignId,
      gongId,
      broadcastId,
    });
    res.status(201).json(artifact);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An artifact with this token slug already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/upload', requireScopeIfApiKey('campaigns:write'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const {
      title,
      slug,
      description,
      usagePrompt,
      attachmentMode,
      isOneTime,
      campaignId,
      gongId,
      broadcastId,
    } = req.body;

    const artifact = await artifactService.uploadFileArtifact(req.user!.id, req.file, {
      title,
      slug,
      description,
      usagePrompt,
      attachmentMode,
      isOneTime: isOneTime === 'true' || isOneTime === true,
      campaignId: campaignId || null,
      gongId: gongId || null,
      broadcastId: broadcastId || null,
    });
    res.status(201).json(artifact);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An artifact with this token slug already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireScopeIfApiKey('campaigns:write'), async (req: AuthRequest, res: Response) => {
  try {
    await artifactService.deleteArtifact(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;