import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export async function dispatchSlackRateLimitAlert(userId: string, senderEmail: string, currentLimit: number) {
  const integration = await prisma.slackAuth.findUnique({ where: { userId } });
  if (!integration || !integration.webhookUrl) return;

  try {
    await axios.post(integration.webhookUrl, {
      text: `🚨 *ReachInbox Rate Limit Alert* 🚨`,
      attachments: [{
        color: '#FF0000',
        fields: [
          { title: 'Sender Account', value: senderEmail, short: true },
          { title: 'Hourly Threshold', value: `${currentLimit} emails/hr`, short: true },
          { title: 'Status', value: 'Threshold reached. Dynamic worker shifting activated.', short: false }
        ],
        ts: Math.floor(Date.now() / 1000)
      }]
    });
  } catch (err) {
    console.error('Failed to dispatch Slack alert:', err);
  }
}
