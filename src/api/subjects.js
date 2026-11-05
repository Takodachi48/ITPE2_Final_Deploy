// src/api/subjects.js
import { del, get, patch, post } from './client.js';

export async function listFacultySubjects(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return get(`/faculty/subjects${qs}`);
}

export async function getFacultySubject(id) {
  return get(`/faculty/subjects/${id}`);
}

export async function createSubject(payload) {
  return post('/faculty/subjects', payload);
}

export async function updateSubject(id, payload) {
  return patch(`/faculty/subjects/${id}`, payload);
}

export async function regenerateJoinCode(id) {
  return post(`/faculty/subjects/${id}/join-code`);
}

export async function toggleEnrollment(id, open) {
  return patch(`/faculty/subjects/${id}/enrollment`, { open });
}

export async function archiveSubject(id) {
  return patch(`/faculty/subjects/${id}/archive`);
}

export async function getRoster(id) {
  return get(`/faculty/subjects/${id}/students`);
}

export async function getFacultyProgress(id) {
  return get(`/faculty/subjects/${id}/progress`);
}

export async function removeStudent(subjectId, studentId) {
  return del(`/faculty/subjects/${subjectId}/students/${studentId}`);
}

export async function getStudentScores(subjectId, studentId) {
  return get(`/faculty/subjects/${subjectId}/students/${studentId}/scores`);
}

export async function getStudentGrades(subjectId) {
  return get(`/student/subjects/${subjectId}/grades`);
}

export async function enroll(joinCode) {
  return post('/student/enrollments', { joinCode });
}

export async function listStudentSubjects() {
  return get('/student/subjects');
}

export async function getStudentSubject(id) {
  return get(`/student/subjects/${id}`);
}