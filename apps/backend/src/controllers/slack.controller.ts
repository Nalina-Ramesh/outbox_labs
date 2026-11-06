import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/environment';

const prisma = new PrismaClient();
const slackStateIssuer = 'reachinbox';
const slackStateAudience = 'reachinbox-slack-oauth';

export function startSlackOAuthHandler(_req: Request, res: Response): void {
  const state = jwt.sign(
    { sub: res.locals.userId as string },
    ENV.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '10m',
      issuer: slackStateIssuer,
      audience: slackStateAudience,
    },
  );
  const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize');
  authorizeUrl.searchParams.set('client_id', ENV.SLACK_CLIENT_ID);
  authorizeUrl.searchParams.set('scope', 'incoming-webhook');
  authorizeUrl.searchParams.set('redirect_uri', ENV.SLACK_REDIRECT_URI);
  authorizeUrl.searchParams.set('state', state);
  res.redirect(authorizeUrl.toString());
}

export async function handleSlackOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send('Slack authorization was incomplete. Please try again.');
    return;
  }

  let stateUserId: string;
  try {
    const claims = jwt.verify(state, ENV.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: slackStateIssuer,
      audience: slackStateAudience,
    });
    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      res.status(400).send('Slack authorization state is invalid. Please try again.');
      return;
    }
    stateUserId = claims.sub;
  } catch {
    res.status(400).send('Slack authorization state expired or invalid. Please try again.');
    return;
  }

  const userId = res.locals.userId as string;
  if (stateUserId !== userId) {
    res.status(403).send('Slack authorization does not match the signed-in user.');
    return;
  }

  try {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: ENV.SLACK_CLIENT_ID,
        client_secret: ENV.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: ENV.SLACK_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const { ok, access_token: accessToken, incoming_webhook: incomingWebhook } = response.data;
    if (!ok || typeof accessToken !== 'string') {
      res.status(400).send('Slack could not complete authorization. Please try again.');
      return;
    }

    await prisma.slackAuth.upsert({
      where: { userId },
      update: {
        accessToken,
        webhookUrl: incomingWebhook?.url,
        channelName: incomingWebhook?.channel,
      },
      create: {
        userId,
        accessToken,
        webhookUrl: incomingWebhook?.url,
        channelName: incomingWebhook?.channel,
      },
    });

    res.send('<!doctype html><html><body>Slack connected. You can close this window.<script>window.close();</script></body></html>');
  } catch (error) {
    next(error);
  }
}

export async function disconnectSlackChannel(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await prisma.slackAuth.deleteMany({ where: { userId: res.locals.userId as string } });
    res.json({ success: true, message: 'Slack integration disconnected.' });
  } catch (error) { next(error); }
}

export async function checkSlackStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await prisma.slackAuth.findUnique({ where: { userId: res.locals.userId as string } });
    res.json({ connected: !!entry, channelName: entry?.channelName || null });
  } catch (error) { next(error); }
}
