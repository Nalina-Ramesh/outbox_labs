import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  ELASTICSEARCH_URL: z.string().default('http://127.0.0.1:9200'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long.'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  WORKER_CONCURRENCY: z.string().transform(Number).default(10),
  SLACK_CLIENT_ID: z.string().default('your-slack-client-id'),
  SLACK_CLIENT_SECRET: z.string().default('your-slack-client-secret'),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:4000/api/slack/callback'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const ENV = parsed.data;
