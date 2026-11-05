import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';

import { setDeps } from '../services/topics.service.js';

const state = {
  subject: null,
  topic: null,
  topics: [],
  maxPos: 0,
  attempts: false,
  deleted: false,
  reordered: null,
};

const fakeSubjectsRepo = {
  findSubjectById: async (id) => (state.subject && state.subject.id === id ? state.subject : null),
};

const fakeTopicsRepo = {
  findTopicById: async (id) => state.topics.find((t) => t.id === id) || (state.topic && state.topic.id === id ? state.topic : null),
  getMaxPosition: async () => state.maxPos,
  listTopicsBySubject: async (sid) => state.topics.filter((t) => t.subjectId === sid),
  createTopic: async (data) => ({ id: 'new-topic', ...data }),
  createTopicsBulk: async (topics) => topics.map((t, i) => ({ id: `bulk-${i}`, ...t })),
  deleteTopic: async (id) => { state.deleted = true; return id; },
  hasAttempts: async () => state.attempts,
  updateTopic: async (id, data) => ({ id, ...data }),
  reorderTopics: async (subjectId, topicIds) => { state.reordered = topicIds; return true; },
};

setDeps({ topicsRepo: fakeTopicsRepo, subjectsRepo: fakeSubjectsRepo });

const {
  listTopics, createTopic, deleteTopic, bulkCreateTopics, reorderTopics,
} = await import('../services/topics.service.js');

function reset() {
  state.subject = null;
  state.topic = null;
  state.topics = [];
  state.maxPos = 0;
  state.attempts = false;
  state.deleted = false;
  state.reordered = null;
}

const FACULTY_ID = 'faculty-1';
const ADMIN_ID = 'admin-1';
const SUBJECT_ID = 'subj-1';

function makeSubject(ownerId = FACULTY_ID) {
  return { id: SUBJECT_ID, facultyId: ownerId, timezone: 'Asia/Manila' };
}

test('listTopics: throws NOT_FOUND for non-owner', async () => {
  reset();
  state.subject = makeSubject('other-faculty');
  await assert.rejects(
    () => listTopics(FACULTY_ID, SUBJECT_ID, false),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND' && err.status === 404,
  );
});

test('listTopics: returns topics for owner', async () => {
  reset();
  state.subject = makeSubject();
  state.topics = [{ id: 't1', subjectId: SUBJECT_ID, position: 1 }];
  const result = await listTopics(FACULTY_ID, SUBJECT_ID, false);
  assert.equal(result.length, 1);
});

test('createTopic: appends position after max', async () => {
  reset();
  state.subject = makeSubject();
  state.maxPos = 3;
  const result = await createTopic(FACULTY_ID, SUBJECT_ID, { title: 'T', availableFrom: '2026-11-03', status: 'draft' }, false);
  assert.equal(result.position, 4);
});

test('createTopic: throws NOT_FOUND for non-owner', async () => {
  reset();
  state.subject = makeSubject('other');
  await assert.rejects(
    () => createTopic(FACULTY_ID, SUBJECT_ID, { title: 'T', availableFrom: '2026-11-03' }, false),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND',
  );
});

test('deleteTopic: throws TOPIC_HAS_ATTEMPTS when attempts exist', async () => {
  reset();
  state.topic = { id: 't1', subjectId: SUBJECT_ID };
  state.subject = makeSubject();
  state.attempts = true;
  await assert.rejects(
    () => deleteTopic(FACULTY_ID, 't1', false),
    (err) => err instanceof AppError && err.code === 'TOPIC_HAS_ATTEMPTS' && err.status === 409,
  );
});

test('deleteTopic: deletes when no attempts', async () => {
  reset();
  state.topic = { id: 't1', subjectId: SUBJECT_ID };
  state.subject = makeSubject();
  state.attempts = false;
  const result = await deleteTopic(FACULTY_ID, 't1', false);
  assert.deepEqual(result, { deleted: true });
  assert.equal(state.deleted, true);
});

test('bulkCreateTopics: positions continue after existing', async () => {
  reset();
  state.subject = makeSubject();
  state.maxPos = 2;
  const result = await bulkCreateTopics(FACULTY_ID, SUBJECT_ID, {
    count: 2,
    startDate: '2026-11-03',
    meetingDays: [2, 4],
    titlePrefix: 'Topic',
  }, false);
  assert.equal(result.length, 2);
  assert.equal(result[0].position, 3);
  assert.equal(result[1].position, 4);
});

test('reorderTopics: rejects id list not matching subject topics', async () => {
  reset();
  state.subject = makeSubject();
  state.topics = [
    { id: 't1', subjectId: SUBJECT_ID },
    { id: 't2', subjectId: SUBJECT_ID },
  ];
  await assert.rejects(
    () => reorderTopics(FACULTY_ID, SUBJECT_ID, ['t1'], false),
    (err) => err instanceof AppError && err.code === 'VALIDATION_ERROR' && err.status === 422,
  );
});

test('reorderTopics: succeeds with exact id list', async () => {
  reset();
  state.subject = makeSubject();
  state.topics = [
    { id: 't1', subjectId: SUBJECT_ID },
    { id: 't2', subjectId: SUBJECT_ID },
  ];
  const result = await reorderTopics(FACULTY_ID, SUBJECT_ID, ['t2', 't1'], false);
  assert.equal(result.length, 2);
  assert.deepEqual(state.reordered, ['t2', 't1']);
});
