import { Readable } from 'stream';

/**
 * Fast processing sequence for line-separated or CSV raw buffers
 */
export function extractEmailsFromBuffer(buffer: Buffer): string[] {
  const fileContent = buffer.toString('utf-8');
  const lines = fileContent.split(/\r?\n/);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const discoveredEmails = new Set<string>();

  for (const line of lines) {
    // Split by commas, tabs or spaces to extract pure address tokens
    const tokens = line.split(/[,\s\t]+/);
    for (const token of tokens) {
      const cleanToken = token.trim();
      if (emailRegex.test(cleanToken)) {
        discoveredEmails.add(cleanToken);
      }
    }
  }

  return Array.from(discoveredEmails);
}
