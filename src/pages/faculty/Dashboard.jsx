// src/pages/faculty/Dashboard.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { listFacultySubjects } from '../../api/subjects';
import Skeleton from '../../components/Skeleton';
import { CloseIcon, SearchIcon } from '../../components/Icons';

const pad = (n) => String(n).padStart(2, '0');

function SubjectRows({ subjects, onOpen, offset = 0 }) {
  return (
    <ol className="index-list subject-list">
      {subjects.map((s, i) => (
        <li key={s.id} style={{ '--row-index': i }}>
          <button type="button" className="index-row subject-row" onClick={() => onOpen(s.id)}>
            <span className="index-num">{pad(offset + i + 1)}</span>
            <span className="index-main">
              <span className="index-title">{s.name}</span>
              <span className="index-desc">{s.code} · {s.term} · {s.schoolYear}</span>
              <span className="index-mobile-meta">{s.studentCount ?? 0} students · {s.passingPercent}% · {s.status}</span>
            </span>
            <span className="subject-cell">{s.studentCount ?? 0}</span>
            <span className="subject-cell">{s.passingPercent}%</span>
            <span className="subject-cell subject-status">{s.status}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listFacultySubjects();
        if (!cancelled) setSubjects(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load subjects.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { active, archived, filteredActive, filteredArchived } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (s) => !q || [s.name, s.code, s.term, s.schoolYear].some((v) => String(v || '').toLowerCase().includes(q));
    const active = subjects.filter((s) => s.status !== 'archived');
    const archived = subjects.filter((s) => s.status === 'archived');
    return { active, archived, filteredActive: active.filter(matches), filteredArchived: archived.filter(matches) };
  }, [subjects, query]);

  const openSubject = (id) => navigate(`/faculty/subjects/${id}/topics`);

  if (loading) return <Skeleton lines={4} />;

  return (
    <div className="page-shell subjects-page">
      <div className="topic-toolbar subjects-toolbar">
        <div className="shell toolbar-inner subjects-toolbar-inner">
          <h1 className="subjects-title">My Subjects</h1>
          <Link to="/faculty/subjects/new" className="btn btn-solid">Create subject</Link>
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
            <span className="result-count" aria-live="polite">{pad(filteredActive.length + (archivedOpen ? filteredArchived.length : 0))} / {pad(active.length + archived.length)}</span>
          </div>
        </div>
      </div>

      {error && <div className="auth-error page-shell" role="alert">{error}</div>}

      <section className="shell index-section" aria-label="Subject list">
        {active.length === 0 && archived.length === 0 ? (
          <div className="index-empty">
            <h2>No subjects yet.</h2>
            <p>Create your first subject to get started.</p>
          </div>
        ) : (
          <>
            <div className="index-head subject-head" aria-hidden="true">
              <span>No.</span>
              <span>Subject</span>
              <span>No. of students</span>
              <span>Passing %</span>
              <span>Status</span>
            </div>

            {filteredActive.length === 0 ? (
              <div className="index-empty"><p>{query ? 'No subjects match your search.' : 'No active subjects.'}</p></div>
            ) : (
              <SubjectRows subjects={filteredActive} onOpen={openSubject} />
            )}

            {archived.length > 0 && (
              <details className="subject-accordion" open={archivedOpen} onToggle={(e) => setArchivedOpen(e.currentTarget.open)}>
                <summary className="subject-accordion-summary">Archived subjects ({filteredArchived.length})</summary>
                <div className="subject-accordion-body">
                  {filteredArchived.length === 0 ? (
                    <div className="index-empty"><p>No archived subjects match your search.</p></div>
                  ) : (
                    <>
                      <div className="index-head subject-head" aria-hidden="true">
                        <span>No.</span><span>Subject</span><span>No. of students</span><span>Passing %</span><span>Status</span>
                      </div>
                      <SubjectRows subjects={filteredArchived} onOpen={openSubject} offset={filteredActive.length} />
                    </>
                  )}
                </div>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}