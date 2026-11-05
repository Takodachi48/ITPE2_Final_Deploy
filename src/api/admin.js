// src/api/admin.js
import { get, patch } from './client.js';

export async function listProfiles(queryString) {
  const path = queryString ? `/admin/profiles?${queryString}` : '/admin/profiles';
  return get(path);
}

export async function updateProfile(id, payload) {
  return patch(`/admin/profiles/${id}`, payload);
}