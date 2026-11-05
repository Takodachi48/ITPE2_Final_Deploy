// src/pages/faculty/Report.jsx
// Report preview page: header block, sort controls, passing % live recompute,
// column picker, failed cells with color + symbol, footer totals,
// loading/empty/error states.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getFacultyReport } from '../../api/reports';
import { toTable } from '../../lib/reportTable';
import { exportPdf } from '../../lib/exportPdf';
import { exportXlsx } from '../../lib/exportXlsx';
import { exportCsv } from '../../lib/exportCsv';
import StatusBadge from '../../components/StatusBadge';

export default function Report() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state (not stored, per BR-06 / spec 05).
  const [sort, setSort] = useState('surname');
  const [dir, setDir] = useState('asc');
  const [passingPercent, setPassingPercent] = useState(75);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await getFacultyReport(id, { sort, dir });
      if (!d) throw new Error('No report returned.');
      setReport(d);
      setPassingPercent(d.subject?.passingPercent ?? 75);
    } catch (err) {
      setError(err?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [id, sort, dir]);

  useEffect(() => { load(); }, [load]);

  const handleRetry = () => {
    setError('');
    load();
  };

  const handleSortChange = (newSort) => {
    if (newSort === sort) {
      setDir(dir === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(newSort);
      setDir('asc');
    }
  };

  const columns = useMemo(() => ([
    { key: 'num', label: '#' },
    { key: 'studentNumber', label: 'Student number' },
    { key: 'lastName', label: 'Surname' },
    { key: 'firstName', label: 'First name' },
    { key: 'total', label: 'Total (all quizzes)' },
    { key: 'average', label: 'Average' },
    { key: 'passedCount', label: 'Passed' },
    { key: 'remark', label: 'Remark' },
  ]), []);

  const table = useMemo(() => {
    if (!report) return { columns: [], rows: [], summary: null };
    return toTable(report, {
      passingPercent,
      columns: columns.map((c) => c.key),
      mode: 'summary',
    });
  }, [report, passingPercent, columns]);

  const handlePassingPercentChange = (e) => {
    const value = Number(e.target.value);
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
      setPassingPercent(value);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    try {
      await exportPdf(report, {
        passingPercent,
        columns: columns.map((c) => c.key),
        mode: 'summary',
      });
    } catch (err) {
      setError(err?.message || 'Failed to generate PDF.');
    }
  };

  const handleDownloadExcel = async () => {
    if (!report) return;
    try {
      await exportXlsx(report, {
        passingPercent,
        mode: 'detail',
      });
    } catch (err) {
      setError(err?.message || 'Failed to generate Excel.');
    }
  };

  const handleDownloadCsv = () => {
    if (!report) return;
    try {
      exportCsv(report, {
        passingPercent,
        mode: 'detail',
      });
    } catch (err) {
      setError(err?.message || 'Failed to generate CSV.');
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <p className="sr-only" role="status">Loading report…</p>
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

  if (error && !report) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
        <div className="auth-error" role="alert">{error}</div>
        <button type="button" className="btn btn-solid" onClick={handleRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.rows.length === 0) {
    return (
      <div className="page-shell">
        <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
        <div className="state-panel">
          <p className="eyebrow">
            <span className="eyebrow-dot" />
            Report
          </p>
          <h1 className="state-panel-title">No report data yet</h1>
          <p className="state-panel-text">
            This report fills in once students are enrolled and their quizzes
            have scores. If the roster is empty, add students first; otherwise
            reload to check again.
          </p>
          <div className="state-panel-actions">
            <button type="button" className="btn btn-solid" onClick={handleRetry}>
              Reload report
            </button>
            <Link className="btn btn-line" to={`/faculty/subjects/${id}/topics`}>
              Back to topics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { subject, summary } = report;
  const passingPct = passingPercent !== undefined ? passingPercent : subject.passingPercent;

  return (
    <div className="page-shell">
      <div className="page-back"><Link className="page-back-link" to={`/faculty/subjects/${id}/topics`}>← Back to topics</Link></div>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}

      {/* Header block */}
      <div className="rv-report-header-block">
        <div>
          <h1 style={{ margin: "0 0 4px" }}>{subject ? subject.name : "Report"}</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.92rem" }}>
            {subject ? subject.code : ""}{" · "}
            {subject ? subject.term : ""}{" · "}
            {subject ? subject.schoolYear : ""}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.92rem", color: "var(--ink-soft)" }}>
            Faculty: {subject ? subject.faculty : "—"}{" · "}
            Passing: {passingPct}%
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "inline-block", marginBottom: "8px" }}>
            <StatusBadge status={subject?.status || "active"} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rv-report-controls">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
            Sort by
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className={`btn ${sort === "surname" ? "btn-solid" : "btn-line"}`}
              aria-pressed={sort === "surname"}
              onClick={() => handleSortChange("surname")}
            >
              Surname
            </button>
            <button
              type="button"
              className={`btn ${sort === "score" ? "btn-solid" : "btn-line"}`}
              aria-pressed={sort === "score"}
              onClick={() => handleSortChange("score")}
            >
              Score
            </button>
            <button
              type="button"
              className={`btn ${dir === "asc" ? "btn-solid" : "btn-line"}`}
              aria-pressed={dir === "asc"}
              onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
            >
              {dir === "asc" ? "A→Z / Low→High" : "Z→A / High→Low"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
            Passing %
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min="0"
              max="100"
              value={passingPct}
              onChange={handlePassingPercentChange}
              className="input"
              style={{ width: "6rem" }}
              aria-label="Passing percent"
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
            Quizzes
          </label>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--ink-soft)" }}>
            Total includes all current quizzes ({report.quizzes.length}). Updates when quizzes change.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <button type="button" className="btn btn-solid" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="btn btn-solid" onClick={handleDownloadPdf}>
            Download PDF
          </button>
          <button type="button" className="btn btn-solid" onClick={handleDownloadExcel}>
            Download Excel
          </button>
          <button type="button" className="btn" onClick={handleDownloadCsv}>
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rv-report-table-wrap">
        <table className="rv-report-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="rv-report-th">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
              {table.rows.map((r) => (
                <tr key={`${r.studentId}-${r.studentNumber}`} className="rv-report-row">
                  {columns.map((c) => {
                    const cell = r.cells[c.key];
                    if (!cell) return <td key={c.key} className="rv-report-td" />;
                    return <td key={c.key} className="rv-report-td">{cell.value}</td>;
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="rv-report-footer">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
            Class summary
          </p>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--ink)" }}>
            Students: {summary.students}{" · "}
            Class average: {summary.classAverage}%{" · "}
            Pass rate: {summary.passRate}%
          </p>
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
            Legend
          </p>
          <p style={{ margin: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>×</span>
              Failed cell (below {passingPct}% passing mark)
            </span>
            {" · "}
            <span style={{ color: "var(--muted)" }}>—</span> Missing quiz
          </p>
        </div>
      </div>
    </div>
  );
}
