import { Router } from 'express';
import multer from 'multer';
import { 
  scheduleCampaignHandler, 
  getSenderAccountHandler,
  saveSenderAccountHandler,
  fetchScheduledEmails, 
  fetchSentEmails, 
  searchAuditEngineHandler 
} from '../controllers/email.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(requireAuth);
router.get('/sender-account', getSenderAccountHandler);
router.put('/sender-account', saveSenderAccountHandler);
router.post('/schedule', upload.single('file'), scheduleCampaignHandler);
router.get('/scheduled', fetchScheduledEmails);
router.get('/sent', fetchSentEmails);
router.get('/search', searchAuditEngineHandler);

export default router;
