// src/api/topics.js
import { del, get, patch, post, put } from './client.js';

// Faculty
export async function listFacultyTopics(subjectId) {
  return get(`/faculty/subjects/${subjectId}/topics`);
}

export async function createTopic(subjectId, payload) {
  return post(`/faculty/subjects/${subjectId}/topics`, payload);
}

export async function bulkCreateTopics(subjectId, payload) {
  return post(`/faculty/subjects/${subjectId}/topics/bulk`, payload);
}

export async function reorderTopics(subjectId, topicIds) {
  return put(`/faculty/subjects/${subjectId}/topics/order`, { topicIds });
}

export async function updateTopic(id, payload) {
  return patch(`/faculty/topics/${id}`, payload);
}

export async function deleteTopic(id) {
  return del(`/faculty/topics/${id}`);
}

export async function listTopicContent(topicId) {
  return get(`/faculty/topics/${topicId}/content`);
}

export async function createContentBlock(topicId, payload) {
  return post(`/faculty/topics/${topicId}/content`, payload);
}

export async function updateContentBlock(id, payload) {
  return patch(`/faculty/content/${id}`, payload);
}

export async function deleteContentBlock(id) {
  return del(`/faculty/content/${id}`);
}

export async function reorderContentBlocks(topicId, blockIds) {
  return put(`/faculty/topics/${topicId}/content/order`, { blockIds });
}

export async function getUploadUrl(topicId, { fileName, mime, size, kind }) {
  return post(`/faculty/topics/${topicId}/content/upload-url`, { fileName, mime, size, kind });
}

export async function getTopic(id) {
  // falls back to student shape not available; faculty endpoint added server-side if needed
  return get(`/faculty/topics/${id}`);
}

// Student
export async function listStudentTopics(subjectId) {
  return get(`/student/subjects/${subjectId}/topics`);
}

export async function getStudentTopic(id) {
  return get(`/student/topics/${id}`);
}

export async function listStudentTopicContent(id) {
  return get(`/student/topics/${id}/content`);
}

export async function completeTopic(id) {
  return post(`/student/topics/${id}/complete`);
}