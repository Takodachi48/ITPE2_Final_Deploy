// server/services/grading.js
// Pure grading helpers for built-in quizzes (BR-01, BR-09).

export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function gradeQuestion(question, answer) {
  if (!question) return 0;
  const points = Number(question.points) > 0 ? Number(question.points) : 0;

  if (question.type === 'choice') {
    if (answer === null || answer === undefined || answer === '') return 0;
    const given = String(answer);
    if (question.correctOptionId && given === String(question.correctOptionId)) {
      return points;
    }
    return 0;
  }

  if (question.type === 'text') {
    const accepted = Array.isArray(question.acceptedAnswers)
      ? question.acceptedAnswers
      : [];
    if (accepted.length === 0) return 0;
    const norm = normalizeText(answer);
    if (!norm) return 0;
    for (const x of accepted) {
      if (normalizeText(x) === norm) return points;
    }
    return 0;
  }

  return 0;
}

export function gradeAttempt(questions, answers) {
  const qs = Array.isArray(questions) ? questions : [];
  let score = 0;
  let total = 0;

  const isAnswersArray = Array.isArray(answers);
  const answerMap = isAnswersArray ? null : (answers || {});

  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const points = Number(q.points) > 0 ? Number(q.points) : 0;
    total += points;

    let ans;
    if (isAnswersArray) {
      const entry = answers[i];
      if (entry && typeof entry === 'object') {
        ans = entry.answer !== undefined ? entry.answer : entry.optionId !== undefined ? entry.optionId : entry.text;
      } else {
        ans = entry;
      }
    } else if (answerMap) {
      const entry = answerMap[q.id];
      if (entry && typeof entry === 'object') {
        ans = entry.answer !== undefined ? entry.answer : entry.optionId !== undefined ? entry.optionId : entry.text;
      } else {
        ans = entry;
      }
    }

    score += gradeQuestion(q, ans);
  }

  // round to 2 decimals to avoid float drift
  score = Math.round(score * 100) / 100;
  total = Math.round(total * 100) / 100;
  return { score, total };
}

export function isPassed(score, total, passingPercent) {
  const s = Number(score);
  const t = Number(total);
  const p = Number(passingPercent);
  if (!Number.isFinite(s) || !Number.isFinite(t) || !Number.isFinite(p)) return false;
  if (t <= 0) return false;
  return Math.round(s * 100) * 100 >= p * Math.round(t * 100);
}

export function computePercent(score, total) {
  const s = Number(score);
  const t = Number(total);
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.round((s / t) * 100 * 100) / 100;
}