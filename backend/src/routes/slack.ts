import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { exchangeSlackCode, saveSlackWebhook, disconnectSlack } from '../services/slackService';
import { env } from '../config/env';

const router = Router();

/**
 * GET /auth/slack
 * Redirect user to Slack OAuth consent screen
 */
router.get('/', (req: Request, res: Response) => {
  if (!env.slack.clientId) {
    res.status(503).json({ error: 'Slack integration not configured' });
    return;
  }

  // Store userId in state param for callback
  const state = Buffer.from(JSON.stringify({ userId: (req as unknown as { currentUser?: { id: string } }).currentUser?.id || '' })).toString('base64');

  const params = new URLSearchParams({
    client_id: env.slack.clientId!,
    scope: 'incoming-webhook',
    redirect_uri: env.slack.redirectUri!,
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

/**
 * GET /auth/slack/callback
 * Handle Slack OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code) {
      res.redirect(`${env.frontendUrl}/dashboard?slack_error=no_code`);
      return;
    }

    // Decode state to get userId
    let userId = '';
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        userId = decoded.userId;
      } catch {
        console.warn('Invalid Slack state parameter');
      }
    }

    // Also try to get from session/token
    if (!userId) {
      const token = req.cookies?.token;
      if (token) {
        const { verifyToken } = await import('../middleware/authMiddleware');
        const payload = verifyToken(token);
        userId = payload.userId;
      }
    }

    if (!userId) {
      res.redirect(`${env.frontendUrl}/dashboard?slack_error=not_authenticated`);
      return;
    }

    const { teamId, webhookUrl, channel } = await exchangeSlackCode(code);
    await saveSlackWebhook(userId, teamId, webhookUrl, channel);

    res.redirect(`${env.frontendUrl}/dashboard?slack_connected=true`);
  } catch (error) {
    console.error('Slack OAuth error:', error);
    res.redirect(`${env.frontendUrl}/dashboard?slack_error=oauth_failed`);
  }
});

/**
 * DELETE /api/slack/disconnect
 * Disconnect Slack from the user account
 */
router.delete('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    await disconnectSlack(req.currentUser!.id);
    res.json({ message: 'Slack disconnected successfully' });
  } catch (error) {
    console.error('Slack disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;
