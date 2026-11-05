// src/api/quizzes.js
import { del, get, patch, post, put } from './client.js';

// Faculty
export async function getFacultyQuiz(topicId) {
  return get(`/faculty/topics/${topicId}/quiz`);
}

export async function upsertQuizMeta(topicId, payload) {
  return put(`/faculty/topics/${topicId}/quiz`, payload);
}

export async function updateQuizStatus(quizId, status) {
  return patch(`/faculty/quizzes/${quizId}`, { status });
}

export async function listQuestions(quizId) {
  return get(`/faculty/quizzes/${quizId}/questions`);
}

export async function createQuestion(quizId, payload) {
  return post(`/faculty/quizzes/${quizId}/questions`, payload);
}

export async function updateQuestion(id, payload) {
  return patch(`/faculty/questions/${id}`, payload);
}

export async function deleteQuestion(id) {
  return del(`/faculty/questions/${id}`);
}

export async function reorderQuestions(quizId, questionIds) {
  return put(`/faculty/quizzes/${quizId}/questions/order`, { questionIds });
}

export async function importQuestions(quizId, questions) {
  return post(`/faculty/quizzes/${quizId}/questions/import`, { questions });
}

export async function regradeQuiz(quizId) {
  return post(`/faculty/quizzes/${quizId}/regrade`);
}

export async function getQuizAttachmentUploadUrl(quizId, fileInfo) {
  return post(`/faculty/quizzes/${quizId}/attachment/upload-url`, fileInfo);
}

export async function listFacultySubmissions(subjectId, params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.q) query.set('q', params.q);
  const qStr = query.toString();
  return get(`/faculty/subjects/${subjectId}/submissions${qStr ? `?${qStr}` : ''}`);
}

export async function getFacultyAttemptDetail(attemptId) {
  return get(`/faculty/attempts/${attemptId}`);
}

export async function gradeFacultyAttempt(attemptId, payload) {
  return patch(`/faculty/attempts/${attemptId}/grade`, payload);
}

export async function listQuizPptSources(topicId) {
  return get(`/faculty/topics/${topicId}/ppt-sources`);
}

export async function previewGeneratedQuiz(topicId, payload) {
  return post(`/faculty/topics/${topicId}/quiz/generate-preview`, payload);
}

export async function saveGeneratedQuiz(topicId, payload) {
  return post(`/faculty/topics/${topicId}/quiz/save-generated`, payload);
}

// Student
export async function startAttempt(quizId) {
  return post(`/student/quizzes/${quizId}/attempts`);
}

export async function submitAttempt(attemptId, answers) {
  return post(`/student/attempts/${attemptId}/submit`, { answers });
}

export async function getAttemptHistory(quizId) {
  return get(`/student/quizzes/${quizId}/attempts`);
}

export async function getStudentUploadUrl(quizId, fileInfo) {
  return post(`/student/quizzes/${quizId}/uploads/upload-url`, fileInfo);
}

export async function submitQuizImage(quizId, path) {
  return post(`/student/quizzes/${quizId}/submissions`, { path });
}

export async function deletePendingAttempt(attemptId) {
  return del(`/student/attempts/${attemptId}`);
}

export async function getAttemptImageUrl(attemptId) {
  return get(`/student/attempts/${attemptId}/image-url`);
}

export async function getStudentQuizAttachmentUrl(quizId) {
  return get(`/student/quizzes/${quizId}/attachment/download-url`);
}
