import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../lib/errors.js";

import * as quizzesMod from "../services/quizzes.service.js";
const { setDeps } = quizzesMod;

const state = { quiz: null, topic: null, subject: null, questions: [] };
function reset() { state.quiz = null; state.topic = null; state.subject = null; state.questions = []; }

const fakeQuizzesRepo = {
  findQuizById: async (id) => (state.quiz && state.quiz.id === id ? state.quiz : null),
  findQuizByTopic: async () => state.quiz,
  countQuestions: async () => state.questions.length,
  updateQuiz: async (id, data) => { state.quiz = { ...state.quiz, ...data }; return state.quiz; },
  listQuestionsByQuiz: async () => state.questions,
  listAllAttemptsByQuiz: async () => [],
};
const fakeTopicsRepo = { findTopicById: async (id) => (state.topic && state.topic.id === id ? state.topic : null) };
const fakeSubjectsRepo = { findSubjectById: async (id) => (state.subject && state.subject.id === id ? state.subject : null) };
setDeps({ quizzesRepo: fakeQuizzesRepo, topicsRepo: fakeTopicsRepo, subjectsRepo: fakeSubjectsRepo });

const { updateQuizStatus } = quizzesMod;

const TOPIC_ID = "topic-1";
const QUIZ_ID = "quiz-1";
function makeTopic() { return { id: TOPIC_ID, subjectId: "subj-1", status: "published" }; }
function makeSubject() { return { id: "subj-1", facultyId: "f1", passingPercent: 75 }; }
function makeQuiz(mode = "built", status = "draft") { return { id: QUIZ_ID, topicId: TOPIC_ID, mode, status, totalItems: 10 }; }

test("publish built quiz with 9 questions -> 422 QUIZ_QUESTION_COUNT", async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.quiz = makeQuiz("built", "draft");
  state.questions = Array.from({ length: 9 }, (_, i) => ({ id: `q${i}` }));
  await assert.rejects(
    () => updateQuizStatus("f1", QUIZ_ID, "published", false),
    (err) => err instanceof AppError && err.code === "QUIZ_QUESTION_COUNT" && err.status === 422,
  );
});

test("publish built quiz with 10 questions -> ok", async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.quiz = makeQuiz("built", "draft");
  state.questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));
  const q = await updateQuizStatus("f1", QUIZ_ID, "published", false);
  assert.equal(q.status, "published");
});

test("publish built quiz with 21 questions -> 422", async () => {
  reset();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.quiz = makeQuiz("built", "draft");
  state.questions = Array.from({ length: 21 }, (_, i) => ({ id: `q${i}` }));
  await assert.rejects(
    () => updateQuizStatus("f1", QUIZ_ID, "published", false),
    (err) => err instanceof AppError && err.code === "QUIZ_QUESTION_COUNT" && err.status === 422,
  );
});