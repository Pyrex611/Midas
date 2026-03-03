import { Router } from 'express';
import { signUp, signIn, signOut, getSession } from '../controllers/auth.controller';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/signout', signOut);
router.get('/session', getSession);

export default router;