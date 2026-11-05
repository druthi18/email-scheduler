import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { generateToken } from '../middleware/authMiddleware';

const router = Router();

// Configure Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: env.google.clientId,
      clientSecret: env.google.clientSecret,
      callbackURL: env.google.callbackUrl,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? '';
        const avatar = profile.photos?.[0]?.value ?? undefined;

        // Upsert user — create or update on login
        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: { name: profile.displayName, avatar, email },
          create: {
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatar,
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return done(null, user as any);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => done(null, user));
passport.deserializeUser((user: Express.User, done) => done(null, user));

// ── Routes ──────────────────────────────────────────────────────

/**
 * GET /auth/google
 * Redirect user to Google consent screen
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * GET /auth/google/callback
 * Handle OAuth callback, generate JWT, redirect to frontend
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.frontendUrl}/login?error=oauth_failed` }),
  (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = req.user as unknown as { id: string; email: string; name: string };
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Set HTTP-only cookie + redirect to dashboard
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${env.frontendUrl}/dashboard?token=${token}`);
  }
);

/**
 * POST /auth/logout
 * Clear the auth cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Get current user info from token
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.slice(7);
    if (!token) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { verifyToken } = await import('../middleware/authMiddleware');
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackTeamId: true,
        slackWebhookUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: { ...user, hasSlack: !!user.slackWebhookUrl } });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
