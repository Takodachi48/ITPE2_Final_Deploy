// src/api/auth.js
import { get, patch, post } from './client.js';

export async function login(email, password) {
  return post('/auth/login', { email, password });
}

export async function register(payload) {
  return post('/auth/register', payload);
}

export async function logout() {
  return post('/auth/logout');
}

export async function getMe() {
  return get('/auth/me');
}

export async function updateMe(payload) {
  return patch('/auth/me', payload);
}

export async function forgotPassword(email) {
  return post('/auth/forgot-password', { email });
}

export async function refreshToken() {
  return post('/auth/refresh');
}