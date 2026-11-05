import test from 'node:test';
import assert from 'node:assert/strict';
import * as generation from './quiz-generation.service.js';
import * as ppt from './ppt-quiz.service.js';

const TOPIC_ID = '11111111-1111-4111-8111-111111111111';
const BLOCK_ID = '22222222-2222-4222-8222-222222222222';

function reset() {
  generation.setDeps({
    topicsRepo: { findTopicById: async () => ({ id: TOPIC_ID, subjectId: 's1' }) },
    subjectsRepo: { findSubjectById: async () => ({ id: 's1', facultyId: 'f1' }) },
    contentRepo: {
      listContentBlocksByTopic: async () => [{
        id: BLOCK_ID, topicId: TOPIC_ID, type: 'file', filePath: 'x.pptx', fileName: 'lesson.pptx',
        fileMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }],
    },
    quizzesRepo: {
      findQuizByTopic: async () => null,
      createQuiz: async (d) => ({ id: 'q1', ...d }),
      updateQuiz: async (id, d) => ({ id, topicId: TOPIC_ID, mode: 'built', status: 'draft', ...d }),
      hasAttempts: async () => false,
      replaceQuestions: async (_id, items) => items.map((it, i) => ({ id: `q-${i}`, ...it })),
    },
    storage: { downloadObject: async () => Buffer.from('pptx') },
    pptQuiz: {
      listPptSources: ppt.listPptSources,
      generateQuestionsFromPpt: async () => Array.from({ length: 10 }, (_, i) => ({
        type: 'choice',
        prompt: `Q${i + 1}`,
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
        correctOptionIndex: 0,
        points: 1,
      })),
    },
  });
}

test('listPptSources returns PPTX blocks', async () => {
  reset();
  const rows = await generation.listPptSources('f1', TOPIC_ID, false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, BLOCK_ID);
});

test('previewGeneratedQuiz returns draft questions', async () => {
  reset();
  const result = await generation.previewGeneratedQuiz('f1', TOPIC_ID, { contentBlockId: BLOCK_ID, count: 10 }, false);
  assert.equal(result.questions.length, 10);
  assert.equal(result.questions[0].type, 'choice');
});

test('saveGeneratedQuiz blocks replacement when attempts exist', async () => {
  reset();
  generation.setDeps({
    quizzesRepo: {
      findQuizByTopic: async () => ({ id: 'q1', mode: 'built', status: 'draft' }),
      hasAttempts: async () => true,
    },
  });
  await assert.rejects(
    () => generation.saveGeneratedQuiz('f1', TOPIC_ID, { questions: Array.from({ length: 10 }, () => ({ type: 'choice', prompt: 'P', options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }], correctOptionIndex: 0, points: 1 })) }, false),
    (err) => err?.code === 'QUIZ_HAS_ATTEMPTS',
  );
});
