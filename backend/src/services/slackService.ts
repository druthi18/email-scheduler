import axios from 'axios';
import { prisma } from '../config/database';
import { env } from '../config/env';

/**
 * Exchange Slack OAuth code for access token and webhook URL
 */
export async function exchangeSlackCode(code: string): Promise<{
  teamId: string;
  webhookUrl: string;
  channel: string;
}> {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    null,
    {
      params: {
        client_id: env.slack.clientId,
        client_secret: env.slack.clientSecret,
        code,
        redirect_uri: env.slack.redirectUri,
      },
    }
  );

  const data = response.data;

  if (!data.ok) {
    throw new Error(`Slack OAuth failed: ${data.error}`);
  }

  return {
    teamId: data.team.id,
    webhookUrl: data.incoming_webhook.url,
    channel: data.incoming_webhook.channel,
  };
}

/**
 * Save Slack webhook to user record
 */
export async function saveSlackWebhook(userId: string, teamId: string, webhookUrl: string, channel: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      slackTeamId: teamId,
      slackWebhookUrl: webhookUrl,
      slackChannel: channel,
    },
  });
}

/**
 * Disconnect Slack from a user
 */
export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      slackTeamId: null,
      slackWebhookUrl: null,
      slackChannel: null,
    },
  });
}

/**
 * Send a Slack notification for a specific user.
 * Gracefully silently skips if user has no Slack connected.
 */
export async function notifySlack(userId: string, message: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slackWebhookUrl: true, name: true },
    });

    if (!user?.slackWebhookUrl) {
      console.log(`⚠️ User ${userId} has no Slack webhook — skipping notification`);
      return false;
    }

    await axios.post(user.slackWebhookUrl, {
      text: message,
      username: 'ReachInbox Scheduler',
      icon_emoji: ':email:',
    });

    console.log(`✅ Slack notification sent for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send Slack notification for user ${userId}:`, (error as Error).message);
    return false;
  }
}

/**
 * Notify about rate limit hit
 */
export async function notifyRateLimitHit(
  userId: string,
  sender: string,
  currentCount: number,
  limit: number,
  resetInMs: number
): Promise<void> {
  const resetMinutes = Math.ceil(resetInMs / 60_000);
  const message = [
    `🚨 *Rate Limit Reached* for sender \`${sender}\``,
    `Current hour: *${currentCount}/${limit}* emails sent`,
    `Limit resets in *${resetMinutes} minutes*`,
    `Queued emails will be sent automatically in the next hour window.`,
  ].join('\n');

  await notifySlack(userId, message);
}
