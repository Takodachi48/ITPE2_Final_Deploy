// src/api/reports.js
import { get } from './client.js';

export async function getFacultyReport(id, { sort = 'surname', dir = 'asc' } = {}) {
  const qs = `?sort=${encodeURIComponent(sort)}&dir=${encodeURIComponent(dir)}`;
  return get(`/faculty/subjects/${id}/report${qs}`);
}
