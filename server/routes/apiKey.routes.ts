import { Router } from 'express';
import {
  listWorkspaceApiKeys,
  createWorkspaceApiKey,
  revokeWorkspaceApiKey,
} from '../controllers/apiKey.controller';

const router = Router();

router.get('/', listWorkspaceApiKeys);
router.post('/', createWorkspaceApiKey);
router.delete('/:id', revokeWorkspaceApiKey);

export default router;