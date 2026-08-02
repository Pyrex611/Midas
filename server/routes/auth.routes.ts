import { Router } from 'express';
import { signUp, signIn, getSession, signOut } from '../controllers/auth.controller';

const router = Router();

router.post('/signup', signUp);
router.post('/callback/credentials', signIn); 
router.get('/session', getSession);
router.post('/signout', signOut);

export default router;