import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import MarkdownView from "../../components/MarkdownView";
import SlidesEmbed from "../../components/SlidesEmbed";
import StatusBadge from "../../components/StatusBadge";
import { ArrowLeft, CheckIcon, CloseIcon, HourglassIcon, LockIcon, RotateIcon } from "../../components/Icons";
import {
  getStudentTopic,
  listStudentTopicContent,
  completeTopic,
} from "../../api/topics";

function percentOf(score, total) {
  if (!total || total <= 0) return 0;
  return Math.round((score / total) * 100 * 100) / 100;
}

export default function TopicView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blockedState, setBlockedState] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setBlockedState(null);
      try {
        const t = await getStudentTopic(id);
        const b = await listStudentTopicContent(id);
        if (!cancelled) {
          setTopic(t);
          setBlocks(Array.isArray(b) ? b : []);
          if (t.state === "completed") setCompleted(true);
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.code === "TOPIC_NOT_AVAILABLE") {
          setBlockedState({
            type: "scheduled",
            message: err.message || "This topic has not opened yet.",
            availableFrom: err.details?.availableFrom,
          });
        } else if (err?.code === "TOPIC_LOCKED") {
          setBlockedState({
            type: "locked",
            message: err.message || "This topic is locked until earlier requirements are met.",
            blockedByTopicId: err.details?.blockedByTopicId,
          });
        } else {
          setError(err?.message || "Failed to load topic.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await completeTopic(id);
      setCompleted(true);
    } catch (err) {
      setError(err?.message || "Failed to mark complete.");
    } finally {
      setCompleting(false);
    }
  };

  const latestGradedAttempt =
    topic?.attempts?.find((a) => a.status === "graded") ?? null;

  if (loading) {
    return (
      <div className="page-shell">
        <p className="sr-only" role="status">Loading topic…</p>
        <div className="tv-skeleton" aria-hidden="true">
          <span className="skeleton-line tv-skeleton-title" />
          <span className="skeleton-line tv-skeleton-meta" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="tv-skeleton-block">
              <span className="skeleton-line tv-skeleton-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line tv-skeleton-short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (blockedState) {
    return (
      <div className="page-shell tv-blocked">
        <div className="tv-glyph">
          {blockedState.type === "scheduled" ? (
            <HourglassIcon />
          ) : (
            <LockIcon />
          )}
        </div>
        <h1 className="tv-title">
          {blockedState.type === "scheduled" ? "Topic Not Available Yet" : "Topic Locked"}
        </h1>
        <p className="tv-lead">{blockedState.message}</p>

        {blockedState.availableFrom && (
          <p className="tv-scheduled">
            Scheduled to open on: <strong>{new Date(blockedState.availableFrom).toLocaleString()}</strong>
          </p>
        )}

        <div className="tv-actions">
          {blockedState.blockedByTopicId && (
            <Link
              to={`/student/topics/${blockedState.blockedByTopicId}`}
              className="btn btn-solid"
            >
              Go to prerequisite topic
            </Link>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error && !topic) {
    return (
      <div className="page-shell">
        <div className="auth-error" role="alert">{error}</div>
        <div className="tv-back">
          <button type="button" className="btn" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" id="content">
      <div className="page-back">
        <Link
          to={`/student/subjects/${topic?.subjectId}`}
          className="page-back-link"
        >
          <ArrowLeft /> Back to subject
        </Link>
      </div>

      <div className="tv-meta">
        <div>
          <h1 className="tv-topic-title">{topic?.title}</h1>
          <p className="tv-available">
            Available from: {topic ? new Date(topic.availableFrom).toLocaleDateString() : ""}
          </p>
        </div>
        {topic?.state && <StatusBadge status={topic.state} />}
      </div>

      {topic?.description && (
        <p className="tv-description">{topic.description}</p>
      )}

      <div className="tv-blocks">
        {blocks.length === 0 && (
          <div className="empty-state">
            No lesson content has been posted for this topic yet.
          </div>
        )}
        {blocks.map((b) => (
          <div key={b.id} className="tv-block">
            {b.title && <h3 className="tv-block-title">{b.title}</h3>}
            {b.type === "presentation" && (
              <section className="media-block">
                <div className="block-head">
                  <p className="block-label">
                    <span className="block-index">01</span>
                    Presentation
                  </p>
                  {(b.url || b.filePath) && (
                    <a href={b.url || '#'} target="_blank" rel="noreferrer" className="block-link">Open</a>
                  )}
                </div>
                <div className="frame">
                  <div className="frame-bar">
                    <span className="frame-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                    <span>Slides / Embedded</span>
                  </div>
                  <div className="frame-body">
                    <SlidesEmbed
                      url={b.url}
                      fileUrl={b.filePath ? `/api/v1/student/content/${b.id}/download-url` : null}
                      fileName={b.fileName}
                      title={b.title}
                    />
                  </div>
                </div>
              </section>
            )}
            {b.type === "video" && b.url && (
              <section className="media-block">
                <div className="block-head">
                  <p className="block-label">
                    <span className="block-index">02</span>
                    Video discussion
                  </p>
                  <a href={b.url} target="_blank" rel="noreferrer" className="block-link">Watch on YouTube</a>
                </div>
                <div className="frame">
                  <div className="frame-bar">
                    <span className="frame-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                    <span>Video</span>
                  </div>
                  <div className="frame-body">
                    <iframe
                      src={b.url.includes('youtu') || b.url.includes('youtube') ? 
                        (function(){
                          try{
                            const u=new URL(b.url);
                            if(u.hostname.includes('youtu.be')) return 'https://www.youtube.com/embed/'+u.pathname.slice(1);
                            if(u.hostname.includes('youtube.com')){
                              if(u.pathname.startsWith('/embed/')) return b.url;
                              if(u.pathname.startsWith('/shorts/')) return 'https://www.youtube.com/embed/'+u.pathname.split('/')[2];
                              const v=u.searchParams.get('v'); if(v) return 'https://www.youtube.com/embed/'+v;
                            }
                          } catch { void 0; }
                          return b.url;
                        })() : b.url}
                      title={b.title || "Video"}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>
              </section>
            )}
            {b.type === "file" && b.filePath && (
              <section className="media-block">
                <div className="block-head">
                  <p className="block-label">
                    <span className="block-index">03</span>
                    File
                  </p>
                </div>
                <div className="file-preview">
                  <div className="file-preview-row">
                    <div>
                      <div className="file-name">{b.title || b.fileName || "File"}</div>
                      {b.fileName && <div className="file-meta">{b.fileName}</div>}
                    </div>
                    <button type="button" className="btn btn-solid" onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const res = await fetch(`/api/v1/student/content/${b.id}/download-url`, { credentials: 'include' });
                        const json = await res.json();
                        const url = json?.data?.url;
                        if (url) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      } catch { void 0; }
                    }}>Download</button>
                  </div>
                </div>
              </section>
            )}

          </div>
        ))}
      </div>

      <div className="tv-completion">
        {topic?.quiz ? (
          <div className="tv-quiz">
            <div className="tv-quiz-head">
              <h2 className="tv-quiz-title">Quiz: {topic.quiz.title}</h2>
              <span className="tv-quiz-mode">
                {topic.quiz.mode === "uploaded" ? "Manual Review" : "Built-in"}
              </span>
            </div>

            {topic.quiz.instructions && (
              <p className="tv-lead">{topic.quiz.instructions}</p>
            )}

            {topic.state === "pending_review" && (
              <div>
                <StatusBadge status="pending_review" />
                <p className="tv-pending-text">
                  Waiting for your instructor to grade.
                </p>
              </div>
            )}

            {topic.attempts && (
              <div>
                {topic.state === "completed" && (
                  <div className="qr-result-panel qr-result-passed">
                    <div className="qr-result-glyph">
                      <CheckIcon />
                    </div>
                    <h2 className="qr-result-title qr-result-title-passed">Passed</h2>
                    <p className="qr-result-score">
                      {latestGradedAttempt.score}/{latestGradedAttempt.total}{" "}
                      ({percentOf(latestGradedAttempt.score, latestGradedAttempt.total)}%)
                    </p>
                    {latestGradedAttempt.feedback && (
                      <div className="tv-feedback">
                        <p className="tv-feedback-label">Feedback</p>
                        <p className="tv-feedback-text">{latestGradedAttempt.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
                {topic.state === "failed" && (
                  <div className="qr-result-panel qr-result-failed">
                    <div className="qr-result-glyph">
                      <RotateIcon />
                    </div>
                    <h2 className="qr-result-title qr-result-title-failed">Repeat Topic</h2>
                    <p className="qr-result-score">
                      {latestGradedAttempt.score}/{latestGradedAttempt.total}{" "}
                      ({percentOf(latestGradedAttempt.score, latestGradedAttempt.total)}%)
                    </p>
                    <p className="qr-result-note">Score below passing mark. Retake allowed.</p>
                    {latestGradedAttempt.feedback && (
                      <div className="tv-feedback">
                        <p className="tv-feedback-label">Feedback</p>
                        <p className="tv-feedback-text">{latestGradedAttempt.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {topic.quiz.mode === "built" ? (
              <div className="tv-actions">
                <Link
                  to={`/student/topics/${topic.id}/quiz`}
                  className="btn btn-solid"
                >
                  {topic.state === "completed"
                    ? "Retake Quiz"
                    : topic.state === "failed"
                    ? "Repeat Quiz"
                    : "Take Quiz"}
                </Link>
              </div>
            ) : (
              <div className="tv-actions">
                <Link
                  to={`/student/topics/${topic.id}/quiz`}
                  className="btn btn-solid"
                >
                  Submit Quiz Image
                </Link>
              </div>
            )}

            {topic.attempts && topic.attempts.length > 1 && (
              <div className="qr-history">
                <h3>Attempts</h3>
                <ul className="qr-review-list">
                  {topic.attempts.map((a) => (
                    <li key={a.id} className="qr-review-item">
                      <span>Attempt {a.attemptNo}</span>
                      <span>
                        {a.status === "graded"
                          ? `${a.score}/${a.total} (${percentOf(a.score, a.total)}%)`
                          : a.status === "pending_review"
                          ? "Pending review"
                          : a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="tv-completion-heading">Topic Completion</h2>
            <p className="tv-completion-text">
              This topic has no quiz. Mark it as done when you have reviewed all the material.
            </p>
            {completed ? (
              <p className="tv-completed">
                <CheckIcon /> You have completed this topic.
              </p>
            ) : (
              <button
                className="btn btn-solid"
                onClick={handleComplete}
                disabled={completing}
                aria-disabled={completing}
              >
                {completing ? "Saving…" : "Mark as done"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="tv-error auth-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
