import { createClient } from '@supabase/supabase-js';
import {
  env,
  supabaseConfigured,
  supabaseServiceConfigured,
} from '../config/env.js';
import { AppError } from './errors.js';

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export function getAuthClient() {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'AUTH_NOT_CONFIGURED',
      'Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.',
    );
  }

  return createClient(env.supabase.url, env.supabase.anonKey, clientOptions);
}

let serviceClient;

export function getServiceClient() {
  if (!supabaseServiceConfigured) {
    throw new AppError(
      503,
      'AUTH_ADMIN_NOT_CONFIGURED',
      'Supabase service credentials are not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.',
    );
  }

  if (!serviceClient) {
    serviceClient = createClient(
      env.supabase.url,
      env.supabase.serviceRoleKey,
      clientOptions,
    );
  }

  return serviceClient;
}

export async function verifyAccessToken(token) {
  if (!supabaseConfigured) {
    throw new AppError(
      503,
      'AUTH_NOT_CONFIGURED',
      'Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.',
    );
  }

  const client = supabaseServiceConfigured ? getServiceClient() : getAuthClient();
  return client.auth.getUser(token);
}
