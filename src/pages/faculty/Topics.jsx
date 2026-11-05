import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge";
import { CopyIcon, CheckIcon } from "../../components/Icons";
import { listFacultyTopics, createTopic, reorderTopics, updateTopic, deleteTopic } from "../../api/topics";
import { getFacultySubject, regenerateJoinCode } from "../../api/subjects";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString(); } catch { return value; }
}

export default function FacultyTopics() {
  const { id: subjectId } = useParams();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingIndex, setAddingIndex] = useState(null);
  const [addForm, setAddForm] = useState({ title: "", status: "draft" });
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [topicsData, subjectData] = await Promise.all([
          listFacultyTopics(subjectId),
          getFacultySubject(subjectId),
        ]);
        if (!cancelled) {
          setTopics(Array.isArray(topicsData) ? topicsData : []);
          setSubject(subjectData);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load topics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subjectId]);

  const getNextDate = () => {
    if (topics.length === 0 && subject?.startDate) {
      try {
        const [y, m, d] = String(subject.startDate).split('T')[0].split('-').map(Number);
        if (!y || !m || !d) return "";
        const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        if (Number.isNaN(date.getTime())) return "";
        if (subject.meetingDay !== null && subject.meetingDay !== undefined && subject.meetingDay !== '') {
          const diff = (Number(subject.meetingDay) - date.getUTCDay() + 7) % 7;
          date.setUTCDate(date.getUTCDate() + diff);
        }
        return date.toISOString().slice(0, 10);
      } catch {
        return "";
      }
    }
    if (topics.length > 0) {
      const last = topics[topics.length - 1];
      if (last.availableFrom) {
        try {
          const [y, m, d] = String(last.availableFrom).split('T')[0].split('-').map(Number);
          if (!y || !m || !d) return "";
          const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
          if (Number.isNaN(date.getTime())) return "";
          date.setUTCDate(date.getUTCDate() + 7);
          return date.toISOString().slice(0, 10);
        } catch {
          return "";
        }
      }
    }
    return "";
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const availableFrom = getNextDate();
      if (!availableFrom) {
        setError("Set a term start date and meeting day for this subject first.");
        return;
      }
      await createTopic(subjectId, { ...addForm, availableFrom });
      setAddingIndex(null);
      setAddForm({ title: "", status: "draft" });
      const [topicsData, subjectData] = await Promise.all([
        listFacultyTopics(subjectId),
        getFacultySubject(subjectId),
      ]);
      setTopics(Array.isArray(topicsData) ? topicsData : []);
      setSubject(subjectData);
    } catch (err) { setError(err?.message || "Failed to create topic."); }
  };

  const handleReorder = async (index, dir) => {
    const next = [...topics];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    const ids = next.map((t) => t.id);
    try {
      const updated = await reorderTopics(subjectId, ids);
      setTopics(Array.isArray(updated) ? updated : next);
    } catch (err) { setError(err?.message || "Reorder failed."); }
  };

  const handleTogglePublish = async (topic) => {
    try {
      const newStatus = topic.status === "published" ? "draft" : "published";
      await updateTopic(topic.id, { status: newStatus });
      const [topicsData, subjectData] = await Promise.all([listFacultyTopics(subjectId), getFacultySubject(subjectId)]);
      setTopics(Array.isArray(topicsData)?topicsData:[]); setSubject(subjectData);
    } catch (err) { setError(err?.message || "Update failed."); }
  };

  const handleDelete = async (topic) => {
    if (!window.confirm(`Delete topic "${topic.title}"?`)) return;
    try { await deleteTopic(topic.id); const [topicsData, subjectData] = await Promise.all([listFacultyTopics(subjectId), getFacultySubject(subjectId)]); setTopics(Array.isArray(topicsData)?topicsData:[]); setSubject(subjectData); }
    catch (err) { setError(err?.message || "Delete failed."); }
  };

  const handleCopyCode = async () => {
    const code = subject?.joinCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const handleRegenerate = async () => {
    if (!window.confirm("Regenerate join code? The old code will stop working.")) return;
    setError("");
    try {
      const updated = await regenerateJoinCode(subjectId);
      setSubject(updated);
    } catch (err) { setError(err?.message || "Failed to regenerate code."); }
  };

  if (loading) return <div className="page-shell"><p>Loading topics…</p></div>;

  return (
    <div className="page-shell">
      <div className="ft-header">
        <div className="ft-header-main">
          <div className="page-back">
            <Link className="page-back-link" to="/faculty">← Back to subjects</Link>
          </div>
          <h1>Topics</h1>
          {subject && <p className="ft-subject-meta">{subject.code} · {subject.name}</p>}
          {subject && (
            <div className="ft-join-row">
              <div className="ft-join-code" aria-label="Join code">
                <span className="ft-join-label">Join code</span>
                <button type="button" className="ft-join-copy" onClick={handleCopyCode} title={copied ? 'Copied' : 'Copy join code'} aria-label={copied ? 'Join code copied' : 'Copy join code'}>
                  <strong className="ft-join-value">{subject.joinCode || '—'}</strong>
                  <span className="ft-join-icon" aria-hidden="true">{copied ? <CheckIcon width="14" height="14" /> : <CopyIcon width="14" height="14" />}</span>
                </button>
                <button type="button" className="btn btn-line ft-join-regen" onClick={handleRegenerate}>Regenerate</button>
              </div>
              <div className="ft-header-actions ft-header-actions-inline">
                <Link className="btn btn-line" to={`/faculty/subjects/${subjectId}/grading`}>Grading</Link>
                <Link className="btn btn-line" to={`/faculty/subjects/${subjectId}/report`}>Report</Link>
                <Link className="btn btn-line" to={`/faculty/subjects/${subjectId}/students`}>Students</Link>
                <Link className="btn btn-line" to={`/faculty/subjects/${subjectId}/settings`}>Settings</Link>
              </div>
            </div>
          )}
        </div>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}

      {topics.length === 0 ? (
        <ul className="te-block-list ft-topic-list">
          <li className="ft-empty te-block-item">No topics yet.</li>
          <li className="ft-add-item">
            <button type="button" className="ft-add-row" onClick={() => { setAddingIndex(0); setAddForm({ title: "", status: "draft" }); }} aria-label="Add topic">
              <span className="ft-plus">+</span>
            </button>
          </li>
          {addingIndex === 0 && (
            <li className="te-block-item">
              <form onSubmit={handleAdd} className="ft-inline-form ft-inline-form-row">
                <input className="input" placeholder="Topic title" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} required />
                <select className="input" value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}><option value="draft">draft</option><option value="published">published</option></select>
                <button type="submit" className="btn btn-solid">Add</button>
                <button type="button" className="btn btn-line" onClick={() => setAddingIndex(null)}>Cancel</button>
              </form>
            </li>
          )}
        </ul>
      ) : (
        <ul className="te-block-list ft-topic-list">
          {topics.map((t, idx) => (
            <li key={t.id} className="te-block-item ft-topic-item">
              <div className="ft-topic-row">
                <div className="ft-topic-reorder" aria-label="Reorder">
                  <button type="button" className="btn btn-line ft-reorder-btn" onClick={() => handleReorder(idx, -1)} disabled={idx === 0} aria-disabled={idx === 0} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-line ft-reorder-btn" onClick={() => handleReorder(idx, 1)} disabled={idx === topics.length - 1} aria-disabled={idx === topics.length - 1} aria-label="Move down">↓</button>
                </div>
                <div className="ft-topic-body">
                  <div className="te-block-header ft-topic-header">
                    <strong className="ft-topic-title"><span className="ft-row-num">{t.position}.</span> {t.title}</strong>
                    <span className="ft-topic-meta">{formatDate(t.availableFrom)} <StatusBadge status={t.status} /></span>
                  </div>
                  <div className="te-block-actions ft-topic-actions">
                    <button type="button" className="btn btn-line" onClick={() => handleTogglePublish(t)}>{t.status === "published" ? "Unpublish" : "Publish"}</button>
                    <Link className="btn btn-line" to={`/faculty/topics/${t.id}`}>Edit</Link>
                    <Link className="btn btn-line" to={`/faculty/topics/${t.id}/quiz`}>Quiz</Link>
                    <button type="button" className="btn btn-line ft-btn-danger" onClick={() => handleDelete(t)}>Delete</button>
                  </div>
                </div>
              </div>
            </li>
          ))}
          <li className="ft-add-item">
            <button type="button" className="ft-add-row" onClick={() => { setAddingIndex(topics.length); setAddForm({ title: "", status: "draft" }); }} aria-label="Add topic">
              <span className="ft-plus">+</span>
            </button>
          </li>
          {addingIndex === topics.length && (
            <li className="te-block-item">
              <form onSubmit={handleAdd} className="ft-inline-form ft-inline-form-row">
                <input className="input" placeholder="Topic title" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} required />
                <select className="input" value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}><option value="draft">draft</option><option value="published">published</option></select>
                <button type="submit" className="btn btn-solid">Add</button>
                <button type="button" className="btn btn-line" onClick={() => setAddingIndex(null)}>Cancel</button>
              </form>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
