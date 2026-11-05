// src/pages/student/Dashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listStudentSubjects } from '../../api/subjects';
import Skeleton from '../../components/Skeleton';
import { CloseIcon, SearchIcon } from '../../components/Icons';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const scheduleLabel = (v) => (v === null || v === undefined || v === '' ? '—' : (WEEKDAYS[Number(v)] || '—'));

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listStudentSubjects();
        if (!cancelled) setSubjects(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load subjects.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => [s.name, s.code, s.term, s.schoolYear, s.facultyName, s.meetingDay].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [subjects, query]);

  if (loading) return <Skeleton lines={4} />;

  return (
    <div className="page-shell subjects-page">
      <div className="topic-toolbar subjects-toolbar">
        <div className="shell toolbar-inner subjects-toolbar-inner">
          <h1 className="subjects-title">My Subjects</h1>
          <Link to="/student/join" className="btn btn-solid">Join subject</Link>
          <div className="toolbar-right">
            <label className="search-field">
              <span className="sr-only">Search subjects</span>
              <SearchIcon className="search-icon" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subjects" autoComplete="off" />
              {query && (
                <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                  <CloseIcon />
                </button>
              )}
            </label>
            <span className="result-count" aria-live="polite">{pad(filtered.length)} / {pad(subjects.length)}</span>
          </div>
        </div>
      </div>

      {error && <div className="auth-error page-shell" role="alert">{error}</div>}

      <section className="shell index-section" aria-label="Subject list">
        {subjects.length === 0 ? (
          <div className="index-empty">
            <h2>No subjects yet.</h2>
            <p>Use a join code from your faculty to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="index-empty"><p>No subjects match your search.</p></div>
        ) : (
          <>
            <div className="index-head subject-head subject-head-student" aria-hidden="true">
              <span>No.</span>
              <span>Subject</span>
              <span>Schedule</span>
              <span>Passing %</span>
              <span>Status</span>
            </div>
            <ol className="index-list subject-list">
              {filtered.map((s, i) => (
                <li key={s.id} style={{ '--row-index': i }}>
                  <button type="button" className="index-row subject-row subject-row-student" onClick={() => navigate(`/student/subjects/${s.id}`)}>
                    <span className="index-num">{pad(i + 1)}</span>
                    <span className="index-main">
                      <span className="index-title">{s.name}</span>
                      <span className="index-desc">{s.code} · {s.term} · {s.schoolYear}{s.facultyName ? ` · ${s.facultyName}` : ''}</span>
                      <span className="index-mobile-meta">{s.meetingDay !== null && s.meetingDay !== undefined && s.meetingDay !== '' ? scheduleLabel(s.meetingDay) : 'No schedule'} · {s.passingPercent}% · {s.status || 'active'}</span>
                    </span>
                    <span className="subject-cell subject-schedule">{scheduleLabel(s.meetingDay)}</span>
                    <span className="subject-cell">{s.passingPercent}%</span>
                    <span className="subject-cell subject-status">{s.status || 'active'}</span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}