import { redisConnection } from '../queue/connection';

interface RateLimitCheck {
  allowed: boolean;
  currentCount: number;
  retryAfterSeconds: number;
}

export async function checkSenderRateLimit(senderId: string, maxEmailsPerHour: number): Promise<RateLimitCheck> {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const key = `rate:sender:${senderId}`;

  const pipeline = redisConnection.pipeline();
  pipeline.zremrangebyscore(key, 0, oneHourAgo);
  pipeline.zcard(key);
  pipeline.zrange(key, 0, 0, 'WITHSCORES');
  
  const results = await pipeline.exec();
  if (!results) throw new Error('Redis pipeline failure.');

  const currentCount = results[1][1] as number;
  const oldestRecord = results[2][1] as string[];

  if (currentCount >= maxEmailsPerHour) {
    const oldestTimestamp = oldestRecord.length > 1 ? parseInt(oldestRecord[1]) : now;
    const retryAfterSeconds = Math.ceil(((oldestTimestamp + 3600000) - now) / 1000);
    return { allowed: false, currentCount, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  await redisConnection.zadd(key, now, `${now}-${Math.random()}`);
  return { allowed: true, currentCount: currentCount + 1, retryAfterSeconds: 0 };
}

export async function shouldFireSlackAlert(senderId: string): Promise<boolean> {
  const key = `alert:lock:${senderId}`;
  const acquired = await redisConnection.set(key, 'fired', 'EX', 1800, 'NX');
  return acquired === 'OK';
}
