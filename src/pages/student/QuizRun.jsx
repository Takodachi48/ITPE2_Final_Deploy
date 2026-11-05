import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckIcon, CloseIcon, HourglassIcon, LockIcon } from "../../components/Icons";
import { startAttempt, submitAttempt, getAttemptHistory } from "../../api/quizzes";
import { getStudentTopic } from "../../api/topics";
import UploadSubmission from "../../components/UploadSubmission";

function answersStorageKey(quizId, attemptId) {
  return `quiz_answers:${quizId}:${attemptId}`;
}

export default function QuizRun() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [actualQuizId, setActualQuizId] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blockedState, setBlockedState] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedQuiz, setUploadedQuiz] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setBlockedState(null);
    setResult(null);
    setUploadedQuiz(null);

    try {
      let resolvedQuizId = paramId;
      let loadedTopic = null;
      try {
        loadedTopic = await getStudentTopic(paramId);
        setTopic(loadedTopic);
        if (loadedTopic?.quiz?.id) {
          resolvedQuizId = loadedTopic.quiz.id;
        }
      } catch (topicErr) {
        if (topicErr?.code === "TOPIC_NOT_AVAILABLE") {
          setBlockedState({
            type: "scheduled",
            message: topicErr.message || "This topic is not available yet.",
          });
          return;
        } else if (topicErr?.code === "TOPIC_LOCKED") {
          setBlockedState({
            type: "locked",
            message: topicErr.message || "This topic is locked.",
            blockedByTopicId: topicErr.details?.blockedByTopicId,
          });
          return;
        }
      }

      setActualQuizId(resolvedQuizId);

      if (loadedTopic?.quiz?.mode === "uploaded") {
        setUploadedQuiz({
          id: loadedTopic.quiz.id,
          title: loadedTopic.quiz.title || "Quiz",
          instructions: loadedTopic.quiz.instructions || "",
          externalUrl: loadedTopic.quiz.externalUrl || null,
          attachmentPath: loadedTopic.quiz.attachmentPath || null,
          attachmentName: loadedTopic.quiz.attachmentName || null,
          attachmentMime: loadedTopic.quiz.attachmentMime || null,
        });
        return;
      }

      const started = await startAttempt(resolvedQuizId);
      setAttempt(started.attempt);
      setQuestions(Array.isArray(started.questions) ? started.questions : []);

      // Prefill: server-saved answers take precedence; merge with local draft for unsaved refreshes
      const prefilled = {};
      if (started.attempt?.answers && Array.isArray(started.attempt.answers)) {
        for (const a of started.attempt.answers) {
          if (a?.questionId) {
            prefilled[a.questionId] = a.optionId !== undefined ? a.optionId : a.text;
          }
        }
      }
      try {
        const raw = localStorage.getItem(answersStorageKey(resolvedQuizId, started.attempt?.id));
        if (raw) {
          const local = JSON.parse(raw);
          if (local && typeof local === "object") {
            Object.assign(prefilled, local);
          }
        }
      } catch {
        // ignore
      }
      setAnswers(prefilled);

      const h = await getAttemptHistory(resolvedQuizId);
      setHistory(h);
    } catch (err) {
      if (err?.code === "TOPIC_NOT_AVAILABLE") {
        setBlockedState({
          type: "scheduled",
          message: err.message || "Topic not available yet.",
        });
      } else if (err?.code === "TOPIC_LOCKED") {
        setBlockedState({
          type: "locked",
          message: err.message || "Topic is locked.",
          blockedByTopicId: err.details?.blockedByTopicId,
        });
      } else {
        setError(err?.message || "Failed to load quiz.");
      }
    } finally {
      setLoading(false);
    }
  }, [paramId]);

  useEffect(() => {
    load();
  }, [load]);

  const unanswered = questions.filter((q) => {
    const a = answers[q.id];
    return a === undefined || a === null || a === "";
  }).length;

  const handleSubmit = async () => {
    if (unanswered > 0) {
      setError(`Please answer all questions before submitting. ${unanswered} unanswered.`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        ...(q.type === "choice" ? { optionId: answers[q.id] } : { text: answers[q.id] || "" }),
      }));
      const r = await submitAttempt(attempt.id, payload);
      try { localStorage.removeItem(answersStorageKey(actualQuizId, attempt.id)); } catch { void 0; }
      setResult(r);
      if (actualQuizId) {
        const h = await getAttemptHistory(actualQuizId);
        setHistory(h);
      }
    } catch (err) {
      setError(err?.message || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      try {
        if (actualQuizId && attempt?.id) {
          localStorage.setItem(answersStorageKey(actualQuizId, attempt.id), JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="page-shell qr-quiz">
        <p className="sr-only" role="status">Loading quiz…</p>
        <div className="qr-skeleton" aria-hidden="true">
          <span className="skeleton-line qr-skeleton-title" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="qr-skeleton-question">
              <span className="skeleton-line qr-skeleton-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (blockedState) {
    return (
      <div className="page-shell qr-narrow">
        <div className="qr-glyph">
          {blockedState.type === "scheduled" ? (
            <HourglassIcon />
          ) : (
            <LockIcon />
          )}
        </div>
        <h1 className="qr-title">
          {blockedState.type === "scheduled" ? "Topic Not Available Yet" : "Topic Locked"}
        </h1>
        <p className="qr-lead">{blockedState.message}</p>
        <div className="qr-actions">
          {blockedState.blockedByTopicId && (
            <Link to={`/student/topics/${blockedState.blockedByTopicId}`} className="btn btn-solid">
              Go to prerequisite topic
            </Link>
          )}
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error && !attempt) {
    return (
      <div className="page-shell">
        <div className="auth-error" role="alert">{error}</div>
        <div className="qr-cta-top">
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (uploadedQuiz) {
    return (
      <div className="page-shell qr-quiz">
        <div className="page-back">
          <Link
            to={topic ? `/student/topics/${topic.id}` : -1}
            className="page-back-link"
          >
            <ArrowLeft /> Back to topic
          </Link>
        </div>
        <UploadSubmission quiz={uploadedQuiz} onStatusChange={load} />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="page-shell">
        <div className="state-panel">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Quiz
          </p>
          <h1 className="state-panel-title">This quiz has no questions yet</h1>
          <p className="state-panel-text">
            There is nothing to answer right now. Check back after your instructor
            adds the questions, or return to the topic to review the material.
          </p>
          <div className="state-panel-actions">
            <Link
              to={topic ? `/student/topics/${topic.id}` : "/student"}
              className="btn btn-solid"
            >
              Back to topic
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="page-shell qr-result">
        <div className={`qr-result-panel ${result.passed ? "qr-result-passed" : "qr-result-failed"}`}>
          <div className="qr-result-glyph">
            {result.passed ? <CheckIcon /> : <CloseIcon />}
          </div>
          <h1 className={`qr-result-title ${result.passed ? "qr-result-title-passed" : "qr-result-title-failed"}`}>
            {result.passed ? "You passed" : "Needs improvement"}
          </h1>
          <p className="qr-result-score">
            Score: {result.score} / {result.total} ({result.percent}%)
          </p>
          <p className="qr-result-note">
            Passing mark: {result.passingPercent}%
          </p>

          <div className="qr-actions">
            {result.passed ? (
              <Link
                to={topic?.subjectId ? `/student/subjects/${topic.subjectId}` : "/student"}
                className="btn btn-solid"
              >
                Continue to next topic <ArrowRight />
              </Link>
            ) : (
              <>
                <Link
                  to={topic ? `/student/topics/${topic.id}` : -1}
                  className="btn"
                >
                  Repeat this topic
                </Link>
                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={load}
                >
                  Retake Quiz
                </button>
              </>
            )}
          </div>
        </div>

        {result.review && (
          <div className="qr-review">
            <h3>Question Review</h3>
            <ul className="qr-review-list">
              {result.review.map((r, i) => (
                <li key={r.questionId} className="qr-review-item">
                  <span>Question {i + 1}</span>
                  <span className="qr-review-status">
                    {r.correct ? <CheckIcon /> : <CloseIcon />}
                    {r.correct ? " Correct" : " Incorrect"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {history?.attempts?.length > 0 && (
          <div className="qr-history">
            <h3>Attempt History</h3>
            <p className="qr-history-meta">
              Best Score: {history.best?.score}/{history.best?.total} ({history.bestPercent}%) —{" "}
              <strong>{history.passed ? "Passed" : "Failed"}</strong>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-shell qr-quiz">
      <div className="page-back">
        <Link
          to={topic ? `/student/topics/${topic.id}` : -1}
          className="page-back-link"
        >
          <ArrowLeft /> Back to topic
        </Link>
      </div>

      <div className="qr-meta">
        <h1>Quiz</h1>
        {unanswered > 0 ? (
          <span className="qr-unanswered">{unanswered} unanswered</span>
        ) : (
          <span className="qr-all-answered">All questions answered</span>
        )}
      </div>

      {error && (
        <div className="qr-error auth-error" role="alert">
          {error}
        </div>
      )}

      {questions.map((q, idx) => (
        <fieldset key={q.id} className="qr-question">
          <legend className="qr-question-legend">
            Question {idx + 1} ({q.points} {q.points === 1 ? "point" : "points"})
          </legend>
          <p className="qr-question-prompt">{q.prompt}</p>

          {q.type === "choice" && (
            <div className="qr-options">
              {(q.options || []).map((opt, optIdx) => {
                const optionId = opt?.id ?? opt?.optionId ?? `opt-${q.id}-${optIdx}`;
                const selected = Object.prototype.hasOwnProperty.call(answers, q.id) && String(answers[q.id]) === String(optionId);
                return (
                  <label key={String(optionId)} className={`qr-option ${selected ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name={String(q.id)}
                      value={String(optionId)}
                      checked={selected}
                      onChange={() => updateAnswer(q.id, optionId)}
                    />
                    <span>{opt?.label ?? ""}</span>
                  </label>
                );
              })}
            </div>
          )}

          {q.type === "text" && (
            <div>
              <input
                type="text"
                className="input qr-text-input"
                placeholder="Type your answer here…"
                value={answers[q.id] ?? ""}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                required
              />
            </div>
          )}
        </fieldset>
      ))}

      <div className="qr-submit">
        <button
          type="button"
          className="btn btn-solid"
          onClick={handleSubmit}
          disabled={submitting}
          aria-disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit Answers"}
        </button>
      </div>
    </div>
  );
}
