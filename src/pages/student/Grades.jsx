// src/pages/student/Grades.jsx
// RPT-11: Student grades page. Own scores, best per quiz, pass/fail,
// average and remark.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getStudentGrades } from '../../api/subjects';

export default function Grades() {
  const { id: subjectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await getStudentGrades(subjectId);
      if (!d) throw new Error('No grades returned.');
      setData(d);
    } catch (err) {
      setError(err?.message || 'Failed to load grades.');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/student/subjects/${subjectId}`}>← Back to subject</Link></div>
        <p>Loading grades…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/student/subjects/${subjectId}`}>← Back to subject</Link></div>
        <div className="auth-error" role="alert">{error}</div>
        <button type="button" className="btn btn-solid" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.student) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/student/subjects/${subjectId}`}>← Back to subject</Link></div>
        <h1>My grades</h1>
        <p>No grades available.</p>
        <button type="button" className="btn btn-solid" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  const { subject, student, quizzes } = data;

  return (
    <div className="page-shell">
      <div className="page-back"><Link className="page-back-link" to={`/student/subjects/${subjectId}`}>← Back to subject</Link></div>
      <div className="rv-report-header-block">
        <div>
          <h1 style={{ margin: "0 0 4px" }}>My grades</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem" }}>
            {subject.code} · {subject.term} · {subject.schoolYear}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.92rem" }}>
            Average: {student.average}% · Remark:{" "}
            <strong>{student.remark}</strong>
          </p>
        </div>
      </div>

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
              const passed = score
                ? Math.round(score.score * 100) * 100 >=
                  subject.passingPercent * Math.round(score.total * 100)
                : false;
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
                  <td className={`rv-report-td ${passed ? "" : "rv-report-td-failed"}`}>
                    {score ? (passed ? "Passed" : "Failed") : "—"}
                  </td>
                  <td className="rv-report-td">{score ? score.attempts : 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--ink)", marginTop: "1rem" }}>
        Quizzes: {student.passedCount}/{student.quizCount} passed · Average:{" "}
        {student.average}% · Remark: <strong>{student.remark}</strong>
      </p>
    </div>
  );
}
