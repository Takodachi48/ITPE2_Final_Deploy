// server/services/content.service.js
import { AppError } from "../lib/errors.js";
import { validateUpload } from "../utils/uploads.js";
import * as storageModule from "../lib/storage.js";
import * as contentRepoModule from "../repositories/content-blocks.repository.js";
import * as topicsRepoModule from "../repositories/topics.repository.js";
import * as subjectsRepoModule from "../repositories/subjects.repository.js";
import { assertTopicAccessible } from "./student-topics.service.js";

export const deps = {
  storage: storageModule,
  contentRepo: contentRepoModule,
  topicsRepo: topicsRepoModule,
  subjectsRepo: subjectsRepoModule,
};

export function setDeps(overrides) {
  if (overrides.storage) deps.storage = overrides.storage;
  if (overrides.contentRepo) deps.contentRepo = overrides.contentRepo;
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
}

async function checkOwnership(topicId, facultyId, isAdmin) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");
  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  if (!subject) throw new AppError(404, "NOT_FOUND", "Subject not found.");
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, "NOT_FOUND", "Topic not found.");
  }
  return { topic, subject };
}

export async function listContent(facultyId, topicId, isAdmin) {
  await checkOwnership(topicId, facultyId, isAdmin);
  const blocks = await deps.contentRepo.listContentBlocksByTopic(topicId);
  return blocks;
}

export async function listStudentContent(studentId, topicId) {
  if (deps.topicsRepo === topicsRepoModule || deps.topicsRepo.listTopicsBySubject) {
    await assertTopicAccessible(studentId, topicId);
  } else {
    const topic = await deps.topicsRepo.findTopicById(topicId);
    if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");
  }
  const blocks = await deps.contentRepo.listContentBlocksByTopic(topicId);
  return blocks.filter((b) => b.visibleToStudents);
}

export async function getStudentContentDownloadUrl(studentId, contentId) {
  const block = await deps.contentRepo.findContentBlockById(contentId);
  if (!block || !block.visibleToStudents) {
    throw new AppError(404, "NOT_FOUND", "Content block not found.");
  }
  if (deps.topicsRepo === topicsRepoModule || deps.topicsRepo.listTopicsBySubject) {
    await assertTopicAccessible(studentId, block.topicId);
  }
  if (!block.filePath) {
    throw new AppError(404, "NOT_FOUND", "File not found.");
  }
  const url = await deps.storage.createDownloadUrl("topic-files", block.filePath);
  return { url, expiresAt: new Date(Date.now() + 120 * 1000).toISOString() };
}

export async function createContentBlock(facultyId, topicId, data, isAdmin) {
  const { subject } = await checkOwnership(topicId, facultyId, isAdmin);

  if (data.filePath) {
    const expectedPrefix = `subjects/${subject.id}/topics/${topicId}/`;
    if (!data.filePath.startsWith(expectedPrefix)) {
      throw new AppError(422, "UPLOAD_INVALID", "Uploaded file path prefix is invalid.");
    }
    const info = await deps.storage.objectInfo("topic-files", data.filePath);
    if (!info) {
      throw new AppError(422, "UPLOAD_INVALID", "Uploaded file was not found in storage.");
    }
  }

  const position = data.position || (await deps.contentRepo.getNextPosition(topicId));

  const block = await deps.contentRepo.createContentBlock({
    topicId,
    type: data.type,
    title: data.title,
    body: data.body,
    url: data.url,
    filePath: data.filePath,
    fileName: data.fileName,
    fileMime: data.fileMime,
    fileSize: data.fileSize,
    visibleToStudents: data.visibleToStudents,
    position,
  });
  return block;
}

export async function updateContentBlock(facultyId, blockId, data, isAdmin) {
  const block = await deps.contentRepo.findContentBlockById(blockId);
  if (!block) throw new AppError(404, "NOT_FOUND", "Content block not found.");

  await checkOwnership(block.topicId, facultyId, isAdmin);
  const updated = await deps.contentRepo.updateContentBlock(blockId, data);
  return updated;
}

export async function deleteContentBlock(facultyId, blockId, isAdmin) {
  const block = await deps.contentRepo.findContentBlockById(blockId);
  if (!block) throw new AppError(404, "NOT_FOUND", "Content block not found.");

  await checkOwnership(block.topicId, facultyId, isAdmin);

  if (block.filePath) {
    try {
      await deps.storage.removeObject("topic-files", block.filePath);
    } catch {
      // Ignore storage errors on delete
    }
  }

  const deleted = await deps.contentRepo.deleteContentBlock(blockId);
  return { deleted: !!deleted };
}

export async function reorderContentBlocks(facultyId, topicId, blockIds, isAdmin) {
  await checkOwnership(topicId, facultyId, isAdmin);
  await deps.contentRepo.reorderContentBlocks(topicId, blockIds);
  return deps.contentRepo.listContentBlocksByTopic(topicId);
}

export async function getUploadUrl(facultyId, topicId, kind, fileInfo, isAdmin) {
  await checkOwnership(topicId, facultyId, isAdmin);

  const validation = validateUpload(kind === "presentation" ? "presentation" : kind, fileInfo);
  if (!validation.ok) {
    throw new AppError(422, "UPLOAD_INVALID", validation.reason);
  }

  const subject = await deps.subjectsRepo.findSubjectById((await deps.topicsRepo.findTopicById(topicId)).subjectId);
  const path = deps.storage.buildObjectPath("topic-file", {
    subjectId: subject.id,
    topicId,
  }, fileInfo.fileName);

  const uploadInfo = await deps.storage.createUploadUrl("topic-files", path);
  return { ...uploadInfo, path };
}
