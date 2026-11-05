import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { getAuthClient } from '../lib/supabase.js';
import {
  ensureProfile,
  findProfileById,
  findProfileByStudentNumber,
  updateProfile,
} from '../repositories/profiles.repository.js';

const mapSignInError = (error) => {
  const message = error?.message || '';

  if (/email not confirmed/i.test(message)) {
    return new AppError(
      403,
      'EMAIL_NOT_CONFIRMED',
      'Confirm your email address before signing in.',
    );
  }

  if (/rate limit|too many/i.test(message)) {
    return new AppError(
      429,
      'AUTH_RATE_LIMITED',
      'Too many sign-in attempts. Wait a moment and try again.',
    );
  }

  if (/invalid login credentials|invalid credentials/i.test(message)) {
    return new AppError(
      401,
      'INVALID_CREDENTIALS',
      'That email and password combination is not correct.',
    );
  }

  return new AppError(
    401,
    'AUTH_FAILED',
    'Unable to sign in. Check your credentials and try again.',
  );
};

export async function signIn(email, password) {
  const client = getAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw mapSignInError(error);
  if (!data.session || !data.user) {
    throw new AppError(
      403,
      'SESSION_NOT_CREATED',
      'Sign-in succeeded but no session was created. Check your Supabase Auth settings.',
    );
  }

  const profile = await ensureProfile(data.user);

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      emailConfirmedAt: data.user.email_confirmed_at,
    },
    profile,
    session: data.session,
  };
}

export async function register(input) {
  const { role, email, password, firstName, lastName, studentNumber } = input;
  const fullName = `${firstName} ${lastName}`.trim();

  // Pre-check for duplicate student number to give a clear error.
  if (studentNumber) {
    const existing = await findProfileByStudentNumber(studentNumber);
    if (existing) {
      throw new AppError(409, 'DUPLICATE_RECORD', 'That student number is already registered.');
    }
  }

  const client = getAuthClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        student_number: studentNumber || null,
        full_name: fullName,
      },
    },
  });

  if (error) {
    const message = error?.message || '';
    if (/already registered|already exists|duplicate/i.test(message)) {
      throw new AppError(409, 'DUPLICATE_RECORD', 'That email address is already registered.');
    }
    // Trigger failure (e.g. constraint violation) surfaces here.
    if (/duplicate|unique/i.test(message)) {
      throw new AppError(409, 'DUPLICATE_RECORD', 'That student number is already registered.');
    }
    console.error('[auth] Registration failed:', { email, error: message });
    throw new AppError(400, 'REGISTRATION_FAILED', 'Unable to create account. Try again.');
  }

  if (!data?.user) {
    throw new AppError(400, 'REGISTRATION_FAILED', 'Unable to create account. Try again.');
  }

  const userId = data.user.id;

  // For faculty applicants, upgrade the profile created by the trigger.
  if (role === 'faculty') {
    try {
      await updateProfile(userId, {
        role: 'faculty',
        approvalStatus: 'pending',
        fullName,
        firstName,
        lastName,
      });
    } catch (err) {
      console.error('[auth] Profile upgrade failed after sign-up:', { userId, error: err.message });
      throw new AppError(409, 'DUPLICATE_RECORD', 'Unable to complete registration. Try again.');
    }
  }

  const profile = await findProfileById(userId);

  return {
    profile,
    requiresEmailConfirmation: !data.session,
    pendingApproval: role === 'faculty',
  };
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw new AppError(
      401,
      'SESSION_EXPIRED',
      'Your session has expired. Sign in again.',
    );
  }

  const client = getAuthClient();
  const { data, error } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    throw new AppError(
      401,
      'SESSION_EXPIRED',
      'Your session has expired. Sign in again.',
    );
  }

  const profile = await ensureProfile(data.user);

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      emailConfirmedAt: data.user.email_confirmed_at,
    },
    profile,
    session: data.session,
  };
}

export async function requestPasswordReset(email) {
  const client = getAuthClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: env.passwordResetRedirectUrl,
  });

  // Do not expose whether an account exists for this email address.
  if (error && !/rate limit|too many/i.test(error.message || '')) {
    console.warn('[auth] Password reset request failed:', error.message);
  }

  return { accepted: true };
}

export async function updateMyProfile(userId, currentProfile, updates) {
  const isAdmin = currentProfile?.role === 'admin';
  const changes = {};

  if (updates.firstName !== undefined) changes.firstName = updates.firstName;
  if (updates.lastName !== undefined) changes.lastName = updates.lastName;

  if (updates.studentNumber !== undefined) {
    if (currentProfile?.studentNumber && !isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Student number cannot be changed once set.');
    }
    // Check for duplicate
    const existing = await findProfileByStudentNumber(updates.studentNumber);
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'DUPLICATE_RECORD', 'That student number is already registered.');
    }
    changes.studentNumber = updates.studentNumber;
  }

  // Recompute full_name if names changed
  if (changes.firstName !== undefined || changes.lastName !== undefined) {
    const newFirst = changes.firstName ?? currentProfile?.firstName ?? '';
    const newLast = changes.lastName ?? currentProfile?.lastName ?? '';
    changes.fullName = `${newFirst} ${newLast}`.trim();
  }

  const updated = await updateProfile(userId, changes);
  return updated;
}
export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailConfirmedAt: user.email_confirmed_at || null,
  };
}
