import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { knowledgeBaseService } from '../services/knowledgeBase.service';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const items = await knowledgeBaseService.listItems(req.user!.id, campaignId);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, sourceType, sourceUrl, campaignId } = req.body;
    const item = await knowledgeBaseService.createItem(req.user!.id, {
      title,
      content,
      sourceType,
      sourceUrl,
      campaignId,
    });
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/scrape-url', async (req: AuthRequest, res: Response) => {
  try {
    const { url, title, campaignId } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const item = await knowledgeBaseService.scrapeUrlAndSave(req.user!.id, url, title, campaignId);
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, isActive } = req.body;
    const updated = await knowledgeBaseService.toggleOrUpdate(req.user!.id, req.params.id, {
      title,
      content,
      isActive,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await knowledgeBaseService.deleteItem(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;