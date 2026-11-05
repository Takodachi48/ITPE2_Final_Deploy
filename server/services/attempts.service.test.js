import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../lib/errors.js";

import * as attemptsMod from "../services/attempts.service.js";
import * as quizzesMod from "../services/quizzes.service.js";

const { setDeps: setAttemptsDeps } = attemptsMod;
const { setDeps: setQuizzesDeps } = quizzesMod;

const state = {
  quiz: null,
  topic: null,
  subject: null,
  enrollment: null,
  questions: [],
  attempts: [],
  inProgress: null,
};

function reset() {
  state.quiz = null;
  state.topic = null;
  state.subject = null;
  state.enrollment = null;
  state.questions = [];
  state.attempts = [];
  state.inProgress = null;
}

const fakeQuizzesRepo = {
  findQuizById: async (id) => (state.quiz && state.quiz.id === id ? state.quiz : null),
  listQuestionsByQuiz: async () => state.questions,
  countQuestions: async () => state.questions.length,
  hasAttempts: async () => state.attempts.length > 0,
  findQuizByTopic: async () => state.quiz,
  updateQuiz: async (id, data) => { state.quiz = { ...state.quiz, ...data }; return state.quiz; },
  createQuiz: async (data) => { state.quiz = { id: "quiz-1", ...data, status: data.status || "draft" }; return state.quiz; },
};

const fakeTopicsRepo = {
  findTopicById: async (id) => (state.topic && state.topic.id === id ? state.topic : null),
};

const fakeSubjectsRepo = {
  findSubjectById: async (id) => (state.subject && state.subject.id === id ? state.subject : null),
  findEnrollment: async (subjectId, studentId) =>
    state.enrollment && state.enrollment.subjectId === subjectId && state.enrollment.studentId === studentId
      ? state.enrollment
      : null,
};

const fakeAttemptsRepo = {
  countAttempts: async () => state.attempts.length,
  findInProgressAttempt: async () => state.inProgress,
  findPendingReviewAttempt: async (quizId, studentId) =>
    state.attempts.find((a) => a.quizId === quizId && a.studentId === studentId && a.status === 'pending_review') || null,
  createAttempt: async (data) => {
    const a = { id: `att-${state.attempts.length + 1}`, ...data, score: null, total: null, submittedAt: null };
    state.attempts.push(a);
    state.inProgress = a;
    return a;
  },
  findAttemptById: async (id) => state.attempts.find((a) => a.id === id) || null,
  updateAttempt: async (id, data) => {
    const a = state.attempts.find((x) => x.id === id);
    if (a) Object.assign(a, data);
    if (a && data.status && data.status !== "in_progress") state.inProgress = null;
    return a;
  },
  listAttemptsByStudentQuiz: async () => [...state.attempts],
  listAllAttemptsByQuiz: async () => [...state.attempts],
  findAttemptWithContext: async (id) => {
    const a = state.attempts.find((x) => x.id === id);
    if (!a) return null;
    return {
      attempt: a,
      quiz: state.quiz,
      topic: state.topic,
      subject: state.subject,
      student: { id: a.studentId, firstName: "Test", lastName: "Student", studentNumber: "S-1" },
    };
  },
};

setAttemptsDeps({ attemptsRepo: fakeAttemptsRepo, quizzesRepo: fakeQuizzesRepo, topicsRepo: fakeTopicsRepo, subjectsRepo: fakeSubjectsRepo });
setQuizzesDeps({ quizzesRepo: fakeQuizzesRepo, topicsRepo: fakeTopicsRepo, subjectsRepo: fakeSubjectsRepo });

const { startAttempt, submitAttempt, getAttemptHistory, gradeManualAttempt } = attemptsMod;

const SUBJECT_ID = "subj-1";
const STUDENT_ID = "student-1";
const TOPIC_ID = "topic-1";
const QUIZ_ID = "quiz-1";

function makeSubject(passing = 75) {
  return { id: SUBJECT_ID, facultyId: "f1", passingPercent: passing, status: "active" };
}
function makeTopic(availableFrom) {
  return { id: TOPIC_ID, subjectId: SUBJECT_ID, status: "published", availableFrom: availableFrom || new Date(Date.now() - 86400000).toISOString() };
}
function makeQuiz(overrides = {}) {
  return { id: QUIZ_ID, topicId: TOPIC_ID, mode: "built", status: "published", maxAttempts: null, showAnswers: false, ...overrides };
}
function makeQuestion(id, correctId) {
  return { id, quizId: QUIZ_ID, type: "choice", prompt: "q", points: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: correctId || "a" };
}
function makeEnrollment() {
  return { subjectId: SUBJECT_ID, studentId: STUDENT_ID, status: "active" };
}

test("startAttempt: unpublished quiz refused", async () => {
  reset();
  state.quiz = makeQuiz({ status: "draft" });
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  await assert.rejects(
    () => startAttempt(STUDENT_ID, QUIZ_ID),
    (err) => err instanceof AppError && err.code === "QUIZ_NOT_PUBLISHED" && err.status === 403,
  );
});

test("startAttempt: not enrolled", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = null;
  state.questions = [makeQuestion("q1", "a")];
  await assert.rejects(
    () => startAttempt(STUDENT_ID, QUIZ_ID),
    (err) => err instanceof AppError && err.code === "NOT_ENROLLED" && err.status === 403,
  );
});

test("startAttempt: future topic", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic(new Date(Date.now() + 86400000).toISOString());
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  await assert.rejects(
    () => startAttempt(STUDENT_ID, QUIZ_ID),
    (err) => err instanceof AppError && err.code === "TOPIC_NOT_AVAILABLE" && err.status === 403,
  );
});

test("startAttempt: max attempts enforced", async () => {
  reset();
  state.quiz = makeQuiz({ maxAttempts: 1 });
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  state.attempts = [{ id: "att-0", quizId: QUIZ_ID, studentId: STUDENT_ID, attemptNo: 1, source: "auto", status: "graded", score: 1, total: 1, answers: [], startedAt: new Date().toISOString(), submittedAt: new Date().toISOString() }];
  state.inProgress = null;
  await assert.rejects(
    () => startAttempt(STUDENT_ID, QUIZ_ID),
    (err) => err instanceof AppError && err.code === "MAX_ATTEMPTS_REACHED" && err.status === 409,
  );
});

test("startAttempt: returns questions without answer keys", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  const result = await startAttempt(STUDENT_ID, QUIZ_ID);
  assert.ok(result.attempt);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].correctOptionId, undefined);
  assert.equal(result.questions[0].acceptedAnswers, undefined);
});

test("startAttempt: resumes in_progress attempt", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic();
  state.subject = makeSubject();
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  const first = await startAttempt(STUDENT_ID, QUIZ_ID);
  const second = await startAttempt(STUDENT_ID, QUIZ_ID);
  assert.equal(second.attempt.id, first.attempt.id);
});

test("submitAttempt: grades and returns percent/passed/passingPercent", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic();
  state.subject = makeSubject(75);
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a"), makeQuestion("q2", "b")];
  const started = await startAttempt(STUDENT_ID, QUIZ_ID);
  const result = await submitAttempt(STUDENT_ID, started.attempt.id, [{ questionId: "q1", optionId: "a" }, { questionId: "q2", optionId: "b" }]);
  assert.equal(result.score, 2);
  assert.equal(result.total, 2);
  assert.equal(result.percent, 100);
  assert.equal(result.passed, true);
  assert.equal(result.passingPercent, 75);
});

test("submitAttempt: double submit -> 409", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic();
  state.subject = makeSubject(75);
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  const started = await startAttempt(STUDENT_ID, QUIZ_ID);
  await submitAttempt(STUDENT_ID, started.attempt.id, [{ questionId: "q1", optionId: "a" }]);
  await assert.rejects(
    () => submitAttempt(STUDENT_ID, started.attempt.id, [{ questionId: "q1", optionId: "a" }]),
    (err) => err instanceof AppError && err.code === "ATTEMPT_ALREADY_SUBMITTED" && err.status === 409,
  );
});

test("submitAttempt: review only when showAnswers true", async () => {
  reset();
  state.quiz = makeQuiz({ showAnswers: true });
  state.topic = makeTopic();
  state.subject = makeSubject(75);
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  const started = await startAttempt(STUDENT_ID, QUIZ_ID);
  const result = await submitAttempt(STUDENT_ID, started.attempt.id, [{ questionId: "q1", optionId: "a" }]);
  assert.ok(Array.isArray(result.review));
  assert.equal(result.review[0].correct, true);
});

test("getAttemptHistory: pass flag uses current passing percent", async () => {
  reset();
  state.quiz = makeQuiz();
  state.topic = makeTopic();
  state.subject = makeSubject(90);
  state.enrollment = makeEnrollment();
  state.questions = [makeQuestion("q1", "a")];
  const started = await startAttempt(STUDENT_ID, QUIZ_ID);
  await submitAttempt(STUDENT_ID, started.attempt.id, [{ questionId: "q1", optionId: "a" }]);
  const hist = await getAttemptHistory(STUDENT_ID, QUIZ_ID);
  assert.equal(hist.passed, true); // 1/1 = 100% >= 90
});

test("gradeManualAttempt: rejects non-owner faculty", async () => {
  reset();
  state.quiz = makeQuiz({ totalItems: 20, mode: "uploaded" });
  state.topic = makeTopic();
  state.subject = makeSubject(75); // facultyId is "f1"
  const att = { id: "att-manual", quizId: QUIZ_ID, studentId: STUDENT_ID, source: "manual", status: "pending_review", score: null, total: null };
  state.attempts.push(att);
  await assert.rejects(
    () => gradeManualAttempt("f2", "att-manual", { score: 15 }, false),
    (err) => err instanceof AppError && err.code === "NOT_FOUND" && err.status === 404,
  );
});

test("gradeManualAttempt: rejects score bounds and >2 decimals", async () => {
  reset();
  state.quiz = makeQuiz({ totalItems: 20, mode: "uploaded" });
  state.topic = makeTopic();
  state.subject = makeSubject(75);
  const att = { id: "att-manual", quizId: QUIZ_ID, studentId: STUDENT_ID, source: "manual", status: "pending_review", score: null, total: null };
  state.attempts.push(att);

  // negative
  await assert.rejects(
    () => gradeManualAttempt("f1", "att-manual", { score: -1 }, false),
    (err) => err instanceof AppError && err.code === "VALIDATION_ERROR" && err.status === 422,
  );

  // over total
  await assert.rejects(
    () => gradeManualAttempt("f1", "att-manual", { score: 21 }, false),
    (err) => err instanceof AppError && err.code === "VALIDATION_ERROR" && err.status === 422,
  );

  // >2 decimals
  await assert.rejects(
    () => gradeManualAttempt("f1", "att-manual", { score: 15.123 }, false),
    (err) => err instanceof AppError && err.code === "VALIDATION_ERROR" && err.status === 422,
  );
});

test("gradeManualAttempt: successfully grades and computes pass/fail", async () => {
  reset();
  state.quiz = makeQuiz({ totalItems: 20, mode: "uploaded" });
  state.topic = makeTopic();
  state.subject = makeSubject(75);
  const att = { id: "att-manual", quizId: QUIZ_ID, studentId: STUDENT_ID, source: "manual", status: "pending_review", score: null, total: null };
  state.attempts.push(att);

  const result = await gradeManualAttempt("f1", "att-manual", { score: 15, feedback: "Great job" }, false);
  assert.equal(result.score, 15);
  assert.equal(result.total, 20);
  assert.equal(result.percent, 75);
  assert.equal(result.passed, true);
  assert.equal(att.status, "graded");
  assert.equal(att.feedback, "Great job");
});
