// server/services/topics.service.js
import { AppError, notFound } from "../lib/errors.js";
import { generateSchedule } from "../utils/schedule.js";
import * as topicsRepoModule from "../repositories/topics.repository.js";
import * as subjectsRepoModule from "../repositories/subjects.repository.js";
import { withTransaction } from "../db/pool.js";

export const deps = {
  topicsRepo: topicsRepoModule,
  subjectsRepo: subjectsRepoModule,
};

export function setDeps(overrides) {
  if (overrides.topicsRepo) deps.topicsRepo = overrides.topicsRepo;
  if (overrides.subjectsRepo) deps.subjectsRepo = overrides.subjectsRepo;
}

function requireSubjectOwnerCheck(subject, facultyId, isAdmin) {
  if (!subject) throw new AppError(404, "NOT_FOUND", "Subject not found.");
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, "NOT_FOUND", "Subject not found.");
  }
}

export async function listTopics(facultyId, subjectId, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);
  return deps.topicsRepo.listTopicsBySubject(subjectId);
}

export async function createTopic(facultyId, subjectId, data, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);

  const maxPos = await deps.topicsRepo.getMaxPosition(subjectId);
  const topic = await deps.topicsRepo.createTopic({
    subjectId,
    position: maxPos + 1,
    title: data.title,
    description: data.description,
    availableFrom: `${data.availableFrom}T00:00:00.000Z`,
    status: data.status,
  });
  return topic;
}

export async function updateTopic(facultyId, topicId, data, isAdmin) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");

  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);

  const updates = { ...data };
  if (updates.availableFrom) {
    updates.availableFrom = `${updates.availableFrom}T00:00:00.000Z`;
  }
  return deps.topicsRepo.updateTopic(topicId, updates);
}

export async function deleteTopic(facultyId, topicId, isAdmin) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, "NOT_FOUND", "Topic not found.");

  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);

  const has = await deps.topicsRepo.hasAttempts(topicId);
  if (has) {
    throw new AppError(409, "TOPIC_HAS_ATTEMPTS", "Cannot delete a topic that has student attempts.");
  }

  await deps.topicsRepo.deleteTopic(topicId);
  return { deleted: true };
}

export async function bulkCreateTopics(facultyId, subjectId, data, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);

  const maxPos = await deps.topicsRepo.getMaxPosition(subjectId);
  const timezone = subject.timezone || "Asia/Manila";

  const dates = generateSchedule(data.count, data.startDate, data.meetingDays, timezone);

  const topics = dates.map((date, i) => ({
    subjectId,
    position: maxPos + i + 1,
    title: `${data.titlePrefix || "Topic"} ${maxPos + i + 1}`,
    description: null,
    availableFrom: `${date}T00:00:00.000Z`,
    status: "draft",
  }));

  return deps.topicsRepo.createTopicsBulk(topics);
}

export async function reorderTopics(facultyId, subjectId, topicIds, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);

  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  const existingIds = new Set(topics.map((t) => t.id));
  if (topicIds.length !== existingIds.size) {
    throw new AppError(422, "VALIDATION_ERROR", "Topic list must include exactly all subject topics.");
  }
  for (const id of topicIds) {
    if (!existingIds.has(id)) {
      throw new AppError(422, "VALIDATION_ERROR", "Topic list must include exactly all subject topics.");
    }
  }

  await deps.topicsRepo.reorderTopics(subjectId, topicIds);
  return deps.topicsRepo.listTopicsBySubject(subjectId);
}

export async function rescheduleTopicsFromStart(facultyId, subjectId, startDate, meetingDay, isAdmin) {
  const subject = await deps.subjectsRepo.findSubjectById(subjectId);
  requireSubjectOwnerCheck(subject, facultyId, isAdmin);
  if (!startDate) throw new AppError(422, "VALIDATION_ERROR", "startDate is required.");

  const topics = await deps.topicsRepo.listTopicsBySubject(subjectId);
  if (!topics.length) return [];

  const timezone = subject.timezone || "Asia/Manila";
  let dates;
  if (meetingDay !== null && meetingDay !== undefined && meetingDay !== "") {
    dates = generateSchedule(topics.length, startDate, [Number(meetingDay)], timezone);
  } else {
    // Fallback: startDate for first, then +7 days
    dates = [];
    const [y, m, d] = String(startDate).split("-").map(Number);
    const base = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
    for (let i = 0; i < topics.length; i++) {
      const dt = new Date(base);
      dt.setUTCDate(dt.getUTCDate() + i * 7);
      dates.push(dt.toISOString().slice(0, 10));
    }
  }

  await withTransaction(async (client) => {
    for (let i = 0; i < topics.length; i++) {
      const date = dates[i] || dates[dates.length - 1];
      await client.query(
        `update public.topics set available_from = $1, updated_at = now() where id = $2`,
        [`${date}T00:00:00.000Z`, topics[i].id],
      );
    }
  });

  return deps.topicsRepo.listTopicsBySubject(subjectId);
}
export async function getFacultyTopic(facultyId, topicId, isAdmin=false){
  const t = await deps.topicsRepo.findTopicById(topicId);
  if(!t) throw notFound('Topic not found');
  const subj = await deps.subjectsRepo.findSubjectById(t.subjectId);
  if(!subj) throw notFound('Subject not found');
  if(!isAdmin && subj.facultyId !== facultyId) throw notFound('Topic not found');
  return t;
}
