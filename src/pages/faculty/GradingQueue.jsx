import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "../../components/Icons";
import {
  listFacultySubmissions,
  getFacultyAttemptDetail,
  gradeFacultyAttempt,
} from "../../api/quizzes";
import { getFacultySubject as getSubject } from "../../api/subjects";
import ImageViewer from "../../components/ImageViewer";
import StatusBadge from "../../components/StatusBadge";

export default function GradingQueue() {
  const { id: subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSubmissions = async (keepSelection = true, overrides = {}) => {
    const status = overrides.status ?? statusFilter;
    const q = overrides.q ?? searchTerm;
    try {
      const subs = await listFacultySubmissions(subjectId, {
        status: status === "all" ? undefined : status,
        q: q || undefined,
      });
      setSubmissions(Array.isArray(subs) ? subs : []);

      if (keepSelection && selectedAttemptId) {
        try {
          const d = await getFacultyAttemptDetail(selectedAttemptId);
          setDetail(d);
          setScore(d?.attempt?.score !== null ? String(d.attempt.score) : "");
          setFeedback(d?.attempt?.feedback || "");
        } catch {
          // Keep the detail already on screen; the refreshed list shows the latest state.
        }
      } else if (subs?.length > 0) {
        const first = subs[0];
        setSelectedAttemptId(first.id);
        const d = await getFacultyAttemptDetail(first.id);
        setDetail(d);
        setScore(d?.attempt?.score !== null ? String(d.attempt.score) : "");
        setFeedback(d?.attempt?.feedback || "");
      } else {
        setSelectedAttemptId(null);
        setDetail(null);
      }
    } catch (err) {
      setError(err?.message || "Failed to load submissions.");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await getSubject(subjectId);
        setSubject(s);
      } catch {
        // The subject line is a header only; the queue is still usable without it.
      }
      await loadSubmissions(false);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, statusFilter]);

  const handleSelectSubmission = async (attId) => {
    setSelectedAttemptId(attId);
    setError("");
    setSuccess("");
    try {
      const d = await getFacultyAttemptDetail(attId);
      setDetail(d);
      setScore(d?.attempt?.score !== null ? String(d.attempt.score) : "");
      setFeedback(d?.attempt?.feedback || "");
    } catch (err) {
      setError(err?.message || "Failed to load submission details.");
    }
  };

  const handleSaveGrade = async (andNext = false) => {
    if (!detail) return;
    const total = detail.totalItems;
    const num = Number(score);

    if (score === "" || isNaN(num) || num < 0 || num > total) {
      setError(`Score must be a number between 0 and ${total}.`);
      return;
    }

    if (Math.round(num * 100) / 100 !== num) {
      setError("Score can have at most 2 decimal places.");
      return;
    }

    setGrading(true);
    setError("");
    setSuccess("");

    try {
      await gradeFacultyAttempt(detail.attempt.id, {
        score: num,
        feedback: feedback || null,
      });
      setSuccess("Grade saved successfully.");

      const updatedSubs = await listFacultySubmissions(subjectId, {
        status: statusFilter === "all" ? undefined : statusFilter,
        q: searchTerm || undefined,
      });
      setSubmissions(Array.isArray(updatedSubs) ? updatedSubs : []);

      if (andNext) {
        const currentIndex = updatedSubs.findIndex((s) => s.id === detail.attempt.id);
        const nextSub = updatedSubs[currentIndex + 1] || updatedSubs[0];
        if (nextSub && nextSub.id !== detail.attempt.id) {
          await handleSelectSubmission(nextSub.id);
        } else {
          setSuccess("Grade saved! Queue complete.");
        }
      } else {
        const d = await getFacultyAttemptDetail(detail.attempt.id);
        setDetail(d);
      }
    } catch (err) {
      setError(err?.message || "Failed to save grade.");
    } finally {
      setGrading(false);
    }
  };

  const pendingCount = submissions.filter((s) => s.status === "pending_review").length;
  const filtersActive = searchTerm !== "" || statusFilter !== "all";

  const handleClearFilters = () => {
    setSearchTerm("");
    if (statusFilter !== "all") {
      setStatusFilter("all");
    } else {
      loadSubmissions(false, { q: "" });
    }
  };

  if (loading) {
    return (
      <div className="page-shell gq-shell">
        <p className="sr-only" role="status">Loading grading queue…</p>
        <div className="gq-skeleton" aria-hidden="true">
          <div className="gq-skeleton-head">
            <span className="skeleton-line gq-skeleton-title" />
            <span className="skeleton-line gq-skeleton-sub" />
          </div>
          <div className="gq-skeleton-layout">
            <div className="gq-skeleton-list">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="gq-skeleton-item" key={i}>
                  <span className="skeleton-line" />
                  <span className="skeleton-line gq-skeleton-short" />
                </div>
              ))}
            </div>
            <div className="gq-skeleton-detail">
              <span className="skeleton-line gq-skeleton-title" />
              <span className="skeleton-line gq-skeleton-short" />
              <span className="skeleton-line gq-skeleton-block" />
              <span className="skeleton-line gq-skeleton-block" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell gq-shell">
      <div className="page-back">
        <Link
          to={`/faculty/subjects/${subjectId}/topics`}
          className="page-back-link"
        >
          <ArrowLeft /> Back to topics
        </Link>
      </div>

      <div className="gq-header">
        <div className="gq-header-left">
          <h1 className="gq-header-title">Grading Queue</h1>
          <p className="gq-header-sub">
            {subject?.name} ({subject?.code}) · Passing: {subject?.passingPercent}%
          </p>
        </div>
        <div className="gq-header-right">
          <span className={`gq-pending-badge ${pendingCount > 0 ? "gq-pending-has" : "gq-pending-none"}`}>
            {pendingCount} Pending Review
          </span>
        </div>
      </div>

      {error && <div className="gq-error auth-error" role="alert">{error}</div>}
      {success && <div className="gq-success">{success}</div>}

      <div className="gq-filters">
        <div className="gq-filter-group">
          <button
            type="button"
            className={`btn ${statusFilter === "pending_review" ? "btn-solid" : ""}`}
            onClick={() => setStatusFilter("pending_review")}
          >
            Pending Review
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === "graded" ? "btn-solid" : ""}`}
            onClick={() => setStatusFilter("graded")}
          >
            Graded
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === "all" ? "btn-solid" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All Submissions
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadSubmissions(false);
          }}
          className="gq-search-form"
        >
          <input
            type="text"
            className="input gq-search-input"
            placeholder="Search by student name or ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn">
            Search
          </button>
        </form>
      </div>

      <div className="gq-layout">
        <div className="gq-list-card">
          {submissions.length === 0 ? (
            <div className="gq-empty">
              <p className="gq-empty-title">
                {filtersActive ? "No submissions match filters" : "No submissions yet"}
              </p>
              <p className="gq-empty-text">
                {filtersActive
                  ? "Try another status, or clear the filters to see the whole queue."
                  : "Student submissions will appear here once they upload their work."}
              </p>
              {filtersActive && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            submissions.map((sub) => {
              const isSelected = sub.id === selectedAttemptId;
              return (
                <div
                  key={sub.id}
                  onClick={() => handleSelectSubmission(sub.id)}
                  className={`gq-submission-item ${isSelected ? "selected" : ""}`}
                >
                  <div className="gq-sub-header">
                    <strong className="gq-student-name">
                      {sub.student?.lastName}, {sub.student?.firstName}
                    </strong>
                    <StatusBadge status={sub.status} />
                  </div>
                  <div className="gq-student-meta">
                    {sub.student?.studentNumber} · {sub.topic?.title}
                  </div>
                  <div className="gq-sub-footer">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : "Date unknown"}
                    {sub.score !== null && (
                      <span className="gq-score">
                        Score: {sub.score}/{sub.total}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {detail ? (
          <div className="gq-detail-card">
            <div className="gq-detail-header">
              <div className="gq-detail-left">
                <h2 className="gq-detail-name">
                  {detail.student?.lastName}, {detail.student?.firstName}
                </h2>
                <p className="gq-detail-meta">
                  ID: {detail.student?.studentNumber} · Quiz: {detail.quiz?.title} ({detail.topic?.title})
                </p>
              </div>
              <StatusBadge status={detail.attempt?.status} />
            </div>

            <div className="gq-image-wrapper">
              <ImageViewer src={detail.imageUrl} alt="Student submission score proof" />
            </div>

            <div className="gq-form-card">
              <h3 className="gq-form-title">Enter Score</h3>

              <div className="gq-form-grid">
                <div className="gq-score-field">
                  <label className="gq-score-label">
                    Score (out of {detail.totalItems}) *
                  </label>
                  <div className="gq-score-input-wrapper">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={detail.totalItems}
                      className="input"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      placeholder={`0 - ${detail.totalItems}`}
                      required
                    />
                    <span className="gq-score-total">/ {detail.totalItems}</span>
                  </div>
                </div>

                <div className="gq-feedback-field">
                  <label className="gq-feedback-label">
                    Optional Feedback for Student
                  </label>
                  <input
                    type="text"
                    className="input gq-feedback-input"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="e.g. Great job on the quiz!"
                  />
                </div>
              </div>

              <div className="gq-save-actions">
                <button
                  type="button"
                  className="btn btn-solid"
                  onClick={() => handleSaveGrade(false)}
                  disabled={grading}
                  aria-disabled={grading}
                >
                  {grading ? "Saving…" : "Save Grade"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleSaveGrade(true)}
                  disabled={grading}
                  aria-disabled={grading}
                >
                  Save and Next <ArrowRight />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="gq-no-selection">
            Select a submission from the list on the left to review and grade.
          </div>
        )}
      </div>
    </div>
  );
}
