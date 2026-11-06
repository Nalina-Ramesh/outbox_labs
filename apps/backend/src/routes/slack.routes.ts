import { Router } from 'express';
import {
  checkSlackStatus,
  disconnectSlackChannel,
  handleSlackOAuthCallback,
  startSlackOAuthHandler,
} from '../controllers/slack.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();
router.get('/connect', requireAuth, startSlackOAuthHandler);
router.get('/callback', requireAuth, handleSlackOAuthCallback);
router.post('/disconnect', requireAuth, disconnectSlackChannel);
router.get('/status', requireAuth, checkSlackStatus);

export default router;
