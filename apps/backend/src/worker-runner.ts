import { emailWorker } from './queue/worker';

console.log('👷 Independent Bulk Processing Worker Instance Spinning Up...');

emailWorker.on('completed', (job) => {
  console.log(`✅ Job reference [${job.id}] processed and executed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Job processing breakdown encountered on [${job?.id}]:`, err.message);
});

// Capture graceful isolation interrupts
process.on('SIGTERM', async () => {
  console.log('Shutting down processing nodes cleanly...');
  await emailWorker.close();
  process.exit(0);
});
