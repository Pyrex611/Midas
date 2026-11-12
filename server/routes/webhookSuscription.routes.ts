import { Router } from 'express';
import {
  listSubscriptions,
  createSubscription,
  deleteSubscription,
  testSubscription,
  listDeliveries,
} from '../controllers/webhookSubscription.controller';

const router = Router();

router.get('/', listSubscriptions);
router.post('/', createSubscription);
router.delete('/:id', deleteSubscription);
router.post('/:id/test', testSubscription);
router.get('/:id/deliveries', listDeliveries);

export default router;