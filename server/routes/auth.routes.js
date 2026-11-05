import { Router } from 'express';
import { clearAuthCookies, getRefreshToken, setAuthCookies } from '../lib/cookies.js';
import { asyncHandler, unauthorized } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rateLimit.js';
import {
  refreshSession,
  register,
  requestPasswordReset,
  signIn,
  updateMyProfile,
} from '../services/auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  updateMeSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await register(input);

    res.status(201).json({
      data: {
        profile: result.profile,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
        pendingApproval: result.pendingApproval,
      },
    });
  }),
);

const expiresAt = (session) =>
  session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await signIn(email, password);

    setAuthCookies(res, result.session);

    res.json({
      data: {
        user: result.user,
        profile: result.profile,
        expiresAt: expiresAt(result.session),
      },
    });
  }),
);

router.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = getRefreshToken(req);
    if (!token) throw unauthorized('No refresh session was found. Sign in again.');

    const result = await refreshSession(token);
    setAuthCookies(res, result.session);

    res.json({
      data: {
        user: result.user,
        profile: result.profile,
        expiresAt: expiresAt(result.session),
      },
    });
  }),
);

router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ data: { ok: true } });
});

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const updates = updateMeSchema.parse(req.body);
    const updated = await updateMyProfile(req.auth.user.id, req.auth.profile, updates);
    res.json({ data: { profile: updated } });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      data: {
        user: {
          id: req.auth.user.id,
          email: req.auth.user.email,
          emailConfirmedAt: req.auth.user.email_confirmed_at || null,
        },
        profile: req.auth.profile,
      },
    });
  }),
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(email);

    res.status(202).json({ data: result });
  }),
);

export default router;
