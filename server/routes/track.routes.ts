import { Router } from 'express';
import { trackOpen, trackClick } from '../controllers/track.controller';

const router = Router();

// Public Telemetry Endpoints
router.get('/open/:token', trackOpen);
router.get('/click/:token', trackClick);

export default router;