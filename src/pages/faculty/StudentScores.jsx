// src/pages/faculty/StudentScores.jsx
// RPT-10: Per-student summary page for faculty. All quizzes and attempts for
// one student; Print, PDF and Excel buttons reuse the exporters.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getStudentScores } from '../../api/subjects';
import { exportPdf } from '../../lib/exportPdf';
import { exportXlsx } from '../../lib/exportXlsx';
import { exportCsv } from '../../lib/exportCsv';
import StatusBadge from '../../components/StatusBadge';

export default function StudentScores() {
  const { id: subjectId, studentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [passingPercent, setPassingPercent] = useState(75);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await getStudentScores(subjectId, studentId);
      if (!d) throw new Error('No scores returned.');
      setData(d);
      setPassingPercent(d.subject?.passingPercent ?? 75);
    } catch (err) {
      setError(err?.message || 'Failed to load student scores.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, studentId]);

  useEffect(() => { load(); }, [load]);

  const { subject, student } = data ?? {};
  const quizzes = data?.quizzes ?? [];
  const reportLike = student ? buildReportLike({ subject, student, quizzes }) : null;
  const exportColumns = quizzes.map((q) => `quiz-${q.quizId}`);

  const handleDownloadPdf = async () => {
    if (!reportLike) return;
    try {
      await exportPdf(reportLike, { passingPercent, columns: exportColumns });
    } catch (err) {
      setError(err?.message || 'Failed to generate PDF.');
    }
  };

  const handleDownloadExcel = async () => {
    if (!reportLike) return;
    try {
      await exportXlsx(reportLike, { passingPercent, columns: exportColumns });
    } catch (err) {
      setError(err?.message || 'Failed to generate Excel.');
    }
  };

  const handleDownloadCsv = () => {
    if (!reportLike) return;
    try {
      exportCsv(reportLike, { passingPercent, columns: exportColumns });
    } catch (err) {
      setError(err?.message || 'Failed to generate CSV.');
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <p className="sr-only" role="status">Loading student scores…</p>
        <div className="rv-report-skeleton" aria-hidden="true">
          <div className="rv-report-skeleton-head">
            <span className="skeleton-line rv-skeleton-title" />
            <span className="skeleton-line rv-skeleton-meta" />
            <span className="skeleton-line rv-skeleton-meta rv-skeleton-short" />
          </div>
          <div className="rv-report-skeleton-controls">
            <span className="skeleton-line" />
            <span className="skeleton-line" />
            <span className="skeleton-line" />
            <span className="skeleton-line" />
          </div>
          <div className="rv-report-skeleton-table">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="skeleton-line" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${subjectId}/report`}>← Back to report</Link></div>
        <div className="auth-error" role="alert">{error}</div>
        <button type="button" className="btn btn-solid" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${subjectId}/report`}>← Back to report</Link></div>
        <div className="state-panel">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Student report
          </p>
          <h1 className="state-panel-title">No scores for this student</h1>
          <p className="state-panel-text">
            This student is not enrolled, or their record is no longer available.
            Check the roster, then reload the page.
          </p>
          <div className="state-panel-actions">
            <button type="button" className="btn btn-solid" onClick={load}>
              Reload
            </button>
            <Link className="btn btn-line" to={`/faculty/subjects/${subjectId}/report`}>
              Back to report
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${subjectId}/report`}>← Back to report</Link></div>
      {error && <div className="auth-error" role="alert">{error}</div>}

      <div className="rv-report-header-block">
        <div>
          <h1 style={{ margin: "0 0 4px" }}>Student scores</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem" }}>
            {subject.code} · {subject.term} · {subject.schoolYear}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.92rem" }}>
            {student.lastName}, {student.firstName}{" · "}
            {student.studentNumber}{" · "}
            Faculty: {subject.faculty}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
            Passing: {passingPercent}%{" · "}
            Average: {student.average}%{" · "}
            Remark: {student.remark}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          {quizzes.length > 0 && (
            <StatusBadge status={student.remark === "Passed" ? "passed" : "not_passed"} />
          )}
        </div>
      </div>

      {quizzes.length > 0 && (
        <div className="rv-report-actions">
          <button type="button" className="btn btn-solid" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="btn btn-line" onClick={handleDownloadPdf}>
            Download PDF
          </button>
          <button type="button" className="btn btn-line" onClick={handleDownloadExcel}>
            Download Excel
          </button>
          <button type="button" className="btn btn-line" onClick={handleDownloadCsv}>
            Download CSV
          </button>
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="state-panel">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Report
          </p>
          <h2 className="state-panel-title">No quizzes yet</h2>
          <p className="state-panel-text">
            Scores appear here once the subject has published quizzes and their
            topics are open. Publish a quiz from the topic editor, then reload
            this page.
          </p>
          <div className="state-panel-actions">
            <Link className="btn btn-line" to={`/faculty/subjects/${subjectId}/topics`}>
              Back to topics
            </Link>
            <button type="button" className="btn" onClick={load}>
              Reload
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rv-report-table-wrap">
            <table className="rv-report-table">
              <thead>
                <tr>
                  <th className="rv-report-th">#</th>
                  <th className="rv-report-th">Topic / Quiz</th>
                  <th className="rv-report-th">Best score</th>
                  <th className="rv-report-th">Percent</th>
                  <th className="rv-report-th">Result</th>
                  <th className="rv-report-th">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((q, i) => {
                  const score = student.scores.find((s) => s && s.quizId === q.quizId);
                  return (
                    <tr key={q.quizId} className="rv-report-row">
                      <td className="rv-report-td">{i + 1}</td>
                      <td className="rv-report-td">{q.topicTitle}</td>
                      <td className="rv-report-td">
                        {score ? `${score.score}/${score.total}` : '—'}
                      </td>
                      <td className="rv-report-td">
                        {score ? `${score.percent}%` : '—'}
                      </td>
                      <td className="rv-report-td">
                        {score ? (
                          <StatusBadge status={score.passed ? "passed" : "not_passed"} />
                        ) : '—'}
                      </td>
                      <td className="rv-report-td">{score ? score.attempts : 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rv-report-footer">
            <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--ink)" }}>
              Quizzes: {student.passedCount}/{student.quizCount} passed · Average:{" "}
              {student.average}% · Remark: <strong>{student.remark}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function buildReportLike(data) {
  const { subject, student, quizzes } = data;
  return {
    subject,
    generatedAt: new Date().toISOString(),
    quizzes,
    rows: [student],
    summary: {
      students: 1,
      classAverage: student.average,
      passRate:
        student.quizCount > 0
          ? Math.round((student.passedCount / student.quizCount) * 100)
          : 0,
    },
  };
}
