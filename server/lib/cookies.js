import { env } from '../config/env.js';

const baseOptions = () => ({
  httpOnly: true,
  secure: env.cookies.secure,
  sameSite: env.cookies.sameSite,
  path: '/',
  ...(env.cookies.domain ? { domain: env.cookies.domain } : {}),
});

export function setAuthCookies(res, session) {
  const accessMaxAge = Math.max(30, Number(session.expires_in) || 3600) * 1000;

  res.cookie(env.cookies.accessName, session.access_token, {
    ...baseOptions(),
    maxAge: accessMaxAge,
  });

  res.cookie(env.cookies.refreshName, session.refresh_token, {
    ...baseOptions(),
    maxAge: env.cookies.refreshMaxAge,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie(env.cookies.accessName, baseOptions());
  res.clearCookie(env.cookies.refreshName, baseOptions());
}

export function getAccessToken(req) {
  const header = req.headers.authorization;

  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  return req.cookies?.[env.cookies.accessName] || null;
}

export function getRefreshToken(req) {
  return req.cookies?.[env.cookies.refreshName] || null;
}
