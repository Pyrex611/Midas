import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/auth.middleware';
import { knowledgeBaseService } from '../services/knowledgeBase.service';

const router = Router();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const bases = await knowledgeBaseService.listKnowledgeBases(req.user!.id);
    res.json(bases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bases', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isDefault } = req.body;
    const kb = await knowledgeBaseService.createKnowledgeBase(req.user!.id, { name, description, isDefault });
    res.status(201).json(kb);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/bases/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isDefault } = req.body;
    const updated = await knowledgeBaseService.updateKnowledgeBase(req.user!.id, req.params.id, {
      name,
      description,
      isDefault,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/bases/:id', async (req: AuthRequest, res: Response) => {
  try {
    await knowledgeBaseService.deleteKnowledgeBase(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/bases/:id/resources/text', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const item = await knowledgeBaseService.addTextResource(req.user!.id, req.params.id, { title, content });
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/bases/:id/resources/url', async (req: AuthRequest, res: Response) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const item = await knowledgeBaseService.scrapeUrlResource(req.user!.id, req.params.id, url, title);
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/bases/:id/resources/file', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No document file uploaded (.md, .txt, .docx, .pdf)' });
    const item = await knowledgeBaseService.uploadFileResource(
      req.user!.id,
      req.params.id,
      req.file,
      req.body?.title
    );
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/resources/:resourceId', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, isActive } = req.body;
    const updated = await knowledgeBaseService.toggleOrUpdateResource(req.user!.id, req.params.resourceId, {
      title,
      content,
      isActive,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/resources/:resourceId', async (req: AuthRequest, res: Response) => {
  try {
    await knowledgeBaseService.deleteResource(req.user!.id, req.params.resourceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/attach', async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, knowledgeBaseId } = req.body;
    if (!['campaign', 'gong', 'broadcast'].includes(targetType) || !targetId) {
      return res.status(400).json({ error: 'targetType (campaign|gong|broadcast) and targetId are required' });
    }
    await knowledgeBaseService.attachToEntity(req.user!.id, targetType, targetId, knowledgeBaseId || null);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;