import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';
import { ENV } from '../config/environment';

const algorithm = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  return Buffer.from(hkdfSync('sha256', ENV.JWT_SECRET, Buffer.alloc(0), 'outbox-smtp-credentials', 32));
}

export function encryptSmtpPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSmtpPassword(value: string): string {
  if (!value.startsWith('v1:')) return value;

  const [, encodedIv, encodedTag, encodedPassword] = value.split(':');
  if (!encodedIv || !encodedTag || !encodedPassword) {
    throw new Error('Stored SMTP credential has an invalid format.');
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedPassword, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
