import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getCurrentUserHandler,
  loginHandler,
  signupHandler,
  logoutHandler,
} from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', authRateLimiter, signupHandler);
router.post('/login', authRateLimiter, loginHandler);
router.get('/me', requireAuth, getCurrentUserHandler);
router.post('/logout', requireAuth, logoutHandler);

export default router;
