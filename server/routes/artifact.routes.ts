import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/auth.middleware';
import { artifactService } from '../services/artifact.service';

const router = Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const gongId = req.query.gongId as string | undefined;
    const list = await artifactService.listArtifacts(req.user!.id, { campaignId, gongId });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/link', async (req: AuthRequest, res: Response) => {
  try {
    const { title, slug, url, type, campaignId, gongId } = req.body;
    const artifact = await artifactService.createLinkArtifact(req.user!.id, {
      title,
      slug,
      url,
      type,
      campaignId,
      gongId,
    });
    res.status(201).json(artifact);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An artifact with this token slug already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { title, slug, campaignId, gongId } = req.body;
    const artifact = await artifactService.uploadFileArtifact(req.user!.id, req.file, {
      title,
      slug,
      campaignId: campaignId || null,
      gongId: gongId || null,
    });
    res.status(201).json(artifact);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An artifact with this token slug already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await artifactService.deleteArtifact(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;