import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { ENV } from './config/environment';
import { requireAuth } from './middlewares/auth.middleware';
import { emailQueue } from './queue/connection';
import { synchronizeSchedulerState } from './queue/init';
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import slackRoutes from './routes/slack.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors({
  origin: ENV.FRONTEND_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// Expose Live BullMQ UI Monitor Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter: serverAdapter,
});
app.use('/admin/queues', requireAuth, serverAdapter.getRouter());

// Application Routing Boundaries
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

app.use(errorHandler);

const startServer = async () => {
  try {
    // Reconcile outstanding state variations before accepting API streams
    await synchronizeSchedulerState();
    
    app.listen(ENV.PORT, () => {
      console.log(`🚀 Scheduler Core Operational at http://localhost:${ENV.PORT}`);
      console.log(`📊 Queue Monitor mounted live at http://localhost:${ENV.PORT}/admin/queues`);
    });
  } catch (error) {
    console.error('System boot failure:', error);
    process.exit(1);
  }
};

startServer();
