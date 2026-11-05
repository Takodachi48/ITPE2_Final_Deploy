// src/pages/faculty/Roster.jsx
// Faculty progress view: grid of students × topics with state icons.
// Filters for "failed" and "pending" students.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getFacultyProgress } from "../../api/subjects";
import StatusBadge from "../../components/StatusBadge";

export default function Roster() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | failed | pending

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await getFacultyProgress(id);
      setData(d);
    } catch (err) {
      setError(err?.message || "Failed to load progress.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const { subject, students = [] } = data || {};
  const topicIds = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    for (const s of students) {
      for (const t of s.topics) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          ordered.push(t);
        }
      }
    }
    return ordered;
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (filter === "all") return students;
    return students.filter((s) =>
      s.topics.some((t) =>
        filter === "failed" ? t.state === "failed" : t.state === "pending_review"
      )
    );
  }, [students, filter]);

  const cellFor = (studentId, topicId) => {
    const student = students.find((s) => s.studentId === studentId);
    if (!student) return null;
    return student.topics.find((t) => t.id === topicId);
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
        <p>Loading progress…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
        <div className="auth-error" role="alert">{error}</div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
        <h1>{subject ? subject.name : "Progress"}</h1>
        <p>No students enrolled yet.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px" }}>{subject ? subject.name : "Progress"}</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem" }}>
            {students.length} student{students.length !== 1 ? "s" : ""} ×{" "}
            {topicIds.length} topic{topicIds.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="filters">
          <button
            type="button"
            className={`btn ${filter === "all" ? "btn-solid" : "btn-line"}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={`btn ${filter === "failed" ? "btn-solid" : "btn-line"}`}
            onClick={() => setFilter("failed")}
          >
            Failed
          </button>
          <button
            type="button"
            className={`btn ${filter === "pending" ? "btn-solid" : "btn-line"}`}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
        </div>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <div className="rv-grid">
        <div className="rv-cell rv-header">Student</div>
        {topicIds.map((t) => (
          <div key={t.id} className="rv-cell rv-topic">
            {t.position}. {t.title}
          </div>
        ))}
        {filteredStudents.map((s) => (
          <div key={s.studentId} className="rv-row">
            <div className="rv-cell rv-student">
              <div style={{ fontWeight: 600 }}>
                {s.student?.lastName}, {s.student?.firstName}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {s.student?.studentNumber}
              </div>
            </div>
            {topicIds.map((t) => {
              const cell = cellFor(s.studentId, t.id);
              return (
                <div key={t.id} className="rv-cell rv-state">
                  {cell ? (
                    <StatusBadge status={cell.state} />
                  ) : (
                    <span className="rv-state-empty">—</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && students.length > 0 && (
        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: 24 }}>
          No students match the &ldquo;{filter}&rdquo; filter.
        </p>
      )}
    </div>
  );
}
