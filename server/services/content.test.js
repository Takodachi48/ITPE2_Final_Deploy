import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../lib/errors.js';

import { setDeps } from '../services/content.service.js';

const state = {
  topic: null,
  subject: null,
  block: null,
  objectInfo: null,
  removed: [],
};

const fakeTopicsRepo = {
  findTopicById: async (id) => (state.topic && state.topic.id === id ? state.topic : null),
};
const fakeSubjectsRepo = {
  findSubjectById: async (id) => (state.subject && state.subject.id === id ? state.subject : null),
};
const fakeContentRepo = {
  findContentBlockById: async (id) => (state.block && state.block.id === id ? state.block : null),
  getNextPosition: async () => 1,
  createContentBlock: async (data) => ({ id: 'new-block', ...data }),
  deleteContentBlock: async (id) => ({ id, file_path: state.block ? state.block.filePath : null }),
  listContentBlocksByTopic: async () => [],
  updateContentBlock: async (id, data) => ({ id, ...data }),
  reorderContentBlocks: async () => true,
};
const fakeStorage = {
  objectInfo: async () => state.objectInfo,
  removeObject: async (bucket, path) => { state.removed.push(path); return true; },
  buildObjectPath: (kind, ids, fileName) => `subjects/${ids.subjectId}/topics/${ids.topicId}/x-${fileName}`,
  createUploadUrl: async () => ({ uploadUrl: 'http://x', token: 't', path: 'p' }),
};

setDeps({ topicsRepo: fakeTopicsRepo, subjectsRepo: fakeSubjectsRepo, contentRepo: fakeContentRepo, storage: fakeStorage });

const { createContentBlock, deleteContentBlock } = await import('../services/content.service.js');

function reset() {
  state.topic = null;
  state.subject = null;
  state.block = null;
  state.objectInfo = null;
  state.removed = [];
}

const FACULTY_ID = 'faculty-1';
const SUBJECT_ID = 'subj-1';
const TOPIC_ID = 'topic-1';

function makeSubject() {
  return { id: SUBJECT_ID, facultyId: FACULTY_ID };
}
function makeTopic() {
  return { id: TOPIC_ID, subjectId: SUBJECT_ID };
}

test('createContentBlock: verifies object exists when filePath given (422 if missing)', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.objectInfo = null; // not found
  await assert.rejects(
    () => createContentBlock(FACULTY_ID, TOPIC_ID, { type: 'presentation', filePath: `subjects/${SUBJECT_ID}/topics/${TOPIC_ID}/file.pdf` }, false),
    (err) => err instanceof AppError && err.code === 'UPLOAD_INVALID' && err.status === 422,
  );
});

test('createContentBlock: verifies path prefix (422 if wrong prefix)', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.objectInfo = { size: 10 };
  await assert.rejects(
    () => createContentBlock(FACULTY_ID, TOPIC_ID, { type: 'presentation', filePath: 'subjects/other/topics/x/file.pdf' }, false),
    (err) => err instanceof AppError && err.code === 'UPLOAD_INVALID' && err.status === 422,
  );
});

test('createContentBlock: succeeds when object exists', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.objectInfo = { size: 10 };
  const path = `subjects/${SUBJECT_ID}/topics/${TOPIC_ID}/file.pdf`;
  const result = await createContentBlock(FACULTY_ID, TOPIC_ID, { type: 'presentation', filePath: path }, false);
  assert.equal(result.type, 'presentation');
});

test('createContentBlock: no verification when no filePath', async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.objectInfo = null;
  const result = await createContentBlock(FACULTY_ID, TOPIC_ID, { type: 'text', body: 'hello' }, false);
  assert.equal(result.type, 'text');
});

test('deleteContentBlock: removes storage object when filePath exists', async () => {
  reset();
  state.block = { id: 'b1', topicId: TOPIC_ID, filePath: `subjects/${SUBJECT_ID}/topics/${TOPIC_ID}/file.pdf` };
  state.topic = makeTopic();
  state.subject = makeSubject();
  await deleteContentBlock(FACULTY_ID, 'b1', false);
  assert.equal(state.removed.length, 1);
  assert.equal(state.removed[0], state.block.filePath);
});

test('deleteContentBlock: throws NOT_FOUND for missing block', async () => {
  reset();
  state.block = null;
  await assert.rejects(
    () => deleteContentBlock(FACULTY_ID, 'nope', false),
    (err) => err instanceof AppError && err.code === 'NOT_FOUND' && err.status === 404,
  );
});
