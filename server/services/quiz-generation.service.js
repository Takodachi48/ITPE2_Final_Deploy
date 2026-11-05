// server/services/quiz-generation.service.js
import { AppError } from '../lib/errors.js';
import * as topicsRepoModule from '../repositories/topics.repository.js';
import * as subjectsRepoModule from '../repositories/subjects.repository.js';
import * as contentRepoModule from '../repositories/content-blocks.repository.js';
import * as quizzesRepoModule from '../repositories/quizzes.repository.js';
import * as storageModule from '../lib/storage.js';
import * as pptQuizModule from './ppt-quiz.service.js';

export const deps = {
  topicsRepo: topicsRepoModule,
  subjectsRepo: subjectsRepoModule,
  contentRepo: contentRepoModule,
  quizzesRepo: quizzesRepoModule,
  storage: storageModule,
  pptQuiz: pptQuizModule,
};

export function setDeps(overrides) {
  Object.assign(deps, overrides);
}

async function checkTopicOwner(topicId, facultyId, isAdmin) {
  const topic = await deps.topicsRepo.findTopicById(topicId);
  if (!topic) throw new AppError(404, 'NOT_FOUND', 'Topic not found.');
  const subject = await deps.subjectsRepo.findSubjectById(topic.subjectId);
  if (!subject) throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Topic not found.');
  }
  return { topic, subject };
}

function genOptionId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeGeneratedQuestions(questions) {
  return questions.map((q) => {
    const options = q.options.map((o) => ({ id: genOptionId(), label: o.label }));
    return {
      type: 'choice',
      prompt: q.prompt,
      options,
      correctOptionId: options[q.correctOptionIndex]?.id || options[0].id,
      acceptedAnswers: null,
      points: q.points ?? 1,
    };
  });
}

async function getPptBlock(topicId, contentBlockId) {
  const blocks = await deps.contentRepo.listContentBlocksByTopic(topicId);
  const sources = deps.pptQuiz.listPptSources(blocks);
  const block = sources.find((b) => b.id === contentBlockId);
  if (!block) throw new AppError(404, 'NOT_FOUND', 'PPTX content block not found for this topic.');
  if (!block.filePath) throw new AppError(422, 'PPT_PARSE_FAILED', 'Selected presentation has no file.');
  return block;
}

export async function listPptSources(facultyId, topicId, isAdmin) {
  await checkTopicOwner(topicId, facultyId, isAdmin);
  const blocks = await deps.contentRepo.listContentBlocksByTopic(topicId);
  return deps.pptQuiz.listPptSources(blocks);
}

export async function previewGeneratedQuiz(facultyId, topicId, data, isAdmin) {
  await checkTopicOwner(topicId, facultyId, isAdmin);
  const block = await getPptBlock(topicId, data.contentBlockId);
  let buffer;
  try {
    buffer = await deps.storage.downloadObject('topic-files', block.filePath);
  } catch (err) {
    throw new AppError(422, 'PPT_PARSE_FAILED', 'Could not download the selected presentation from storage.', {
      reason: err?.message || 'Storage download failed',
    });
  }
  if (!buffer) throw new AppError(422, 'PPT_PARSE_FAILED', 'Could not download the selected presentation.');
  const questions = await deps.pptQuiz.generateQuestionsFromPpt(buffer, data.count || 10, block.fileName || 'presentation.pptx');
  return {
    topicId,
    contentBlockId: block.id,
    fileName: block.fileName,
    questions,
  };
}

export async function saveGeneratedQuiz(facultyId, topicId, data, isAdmin) {
  await checkTopicOwner(topicId, facultyId, isAdmin);
  let quiz = await deps.quizzesRepo.findQuizByTopic(topicId);
  if (quiz) {
    const has = await deps.quizzesRepo.hasAttempts(quiz.id);
    if (has) throw new AppError(409, 'QUIZ_HAS_ATTEMPTS', 'Cannot replace generated questions because this quiz already has attempts.');
    if (quiz.mode !== 'built') {
      quiz = await deps.quizzesRepo.updateQuiz(quiz.id, { mode: 'built', status: 'draft' });
    }
  } else {
    quiz = await deps.quizzesRepo.createQuiz({ topicId, title: 'Quiz', mode: 'built', status: 'draft' });
  }
  const items = normalizeGeneratedQuestions(data.questions);
  const questions = await deps.quizzesRepo.replaceQuestions(quiz.id, items);
  const updated = await deps.quizzesRepo.updateQuiz(quiz.id, { status: 'draft', mode: 'built' });
  return { quiz: updated, questions };
}