import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TopicCard from "../../components/TopicCard";
import { getStudentSubject } from "../../api/subjects";
import { listStudentTopics } from "../../api/topics";
import Skeleton from "../../components/Skeleton";

export default function SubjectTopics() {
  const { id: subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subj, tops] = await Promise.all([
          getStudentSubject(subjectId),
          listStudentTopics(subjectId),
        ]);
        if (!cancelled) {
          setSubject(subj);
          setTopics(Array.isArray(tops) ? tops : []);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subjectId]);

  if (loading) return <Skeleton lines={4} />;

  return (
    <div className="page-shell">
      <div className="ft-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="page-back">
            <Link className="page-back-link" to="/student">← Back to subjects</Link>
          </div>
          <h1>{subject?.name || "Subject"}</h1>
          {subject && <p>Passing: {subject.passingPercent}%</p>}
        </div>
        <div className="ft-header-actions">
          <Link className="btn btn-line" to={`/student/subjects/${subjectId}/grades`}>My grades</Link>
        </div>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {topics.length === 0 ? (
        <div className="empty-state">No topics yet.</div>
      ) : (
        <div className="subject-grid">
          {topics.map((t) => (
            <TopicCard key={t.id} topic={t} isStudent />
          ))}
        </div>
      )}
    </div>
  );
}