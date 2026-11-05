// src/lib/reportTable.js
// Pure helpers for building report tables (RPT-05).
// Same logic is used by the preview page and every exporter (print, PDF, Excel, CSV).

/**
 * Compute percent score (hundredths), matching the server's computePercent.
 */
export function computePercent(score, total) {
  const s = Number(score);
  const t = Number(total);
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.round((s / t) * 100 * 100) / 100;
}

/**
 * Determine pass/fail using the subject's current passing percent,
 * matching the server's isPassed (BR-01).
 */
export function isPassed(score, total, passingPercent) {
  const s = Number(score);
  const t = Number(total);
  const p = Number(passingPercent);
  if (!Number.isFinite(s) || !Number.isFinite(t) || !Number.isFinite(p)) return false;
  if (t <= 0) return false;
  return Math.round(s * 100) * 100 >= p * Math.round(t * 100);
}

/**
 * Live pass/fail recompute. Returns { passed, percent } for a single score.
 * Used when the faculty member changes the passing % control on the preview.
 */
export function recomputePassFail(score, total, passingPercent) {
  return {
    passed: isPassed(score, total, passingPercent),
    percent: computePercent(score, total),
  };
}

/**
 * Convert a report object (from buildReport) into a table used by the preview
 * and every exporter.
 *
 * @param {Object} report      – { subject, generatedAt, quizzes, rows, summary }
 * @param {Object} options
 * @param {number} options.passingPercent – overrides report.subject.passingPercent
 *                                          for live recompute (default: report value)
 * @param {string[]} options.columns – column keys to include (default: all)
 * @returns {Object} { columns, rows, summary }
 */
export function toTable(report, options = {}) {
  const { passingPercent = report.subject?.passingPercent ?? 75, columns, mode = 'detail' } = options;
  const { quizzes = [], rows = [], summary } = report;

  const allColumns = mode === 'summary'
    ? [
        { key: 'num', label: '#' },
        { key: 'studentNumber', label: 'Student number' },
        { key: 'lastName', label: 'Surname' },
        { key: 'firstName', label: 'First name' },
        { key: 'total', label: 'Total (all quizzes)' },
        { key: 'average', label: 'Average' },
        { key: 'passedCount', label: 'Passed' },
        { key: 'remark', label: 'Remark' },
      ]
    : [
        { key: 'num', label: '#' },
        { key: 'studentNumber', label: 'Student number' },
        { key: 'lastName', label: 'Surname' },
        { key: 'firstName', label: 'First name' },
        ...quizzes.map((q) => ({
          key: `quiz-${q.quizId}`,
          label: q.topicTitle,
          quizId: q.quizId,
        })),
        { key: 'average', label: 'Average' },
        { key: 'passedCount', label: 'Passed' },
        { key: 'remark', label: 'Remark' },
      ];

  const visibleColumns = columns
    ? allColumns.filter((c) => columns.includes(c.key))
    : allColumns;

  const tableRows = rows.map((r, i) => {
    const cells = {};
    visibleColumns.forEach((c) => {
      switch (c.key) {
        case 'num':
          cells[c.key] = { value: i + 1 };
          break;
        case 'studentNumber':
          cells[c.key] = { value: r.studentNumber };
          break;
        case 'lastName':
          cells[c.key] = { value: r.lastName };
          break;
        case 'firstName':
          cells[c.key] = { value: r.firstName };
          break;
        case 'average':
          cells[c.key] = { value: r.average };
          break;
        case 'total': {
          let earned = 0;
          let possible = 0;
          quizzes.forEach((q) => {
            const score = r.scores.find((s) => s && s.quizId === q.quizId);
            if (score) {
              earned += Number(score.score) || 0;
              possible += Number(score.total) || 0;
            } else {
              possible += Number(q.totalItems) || 0;
            }
          });
          const totalPct = possible > 0 ? Math.round((earned / possible) * 100 * 100) / 100 : 0;
          cells[c.key] = { value: quizzes.length ? `${earned}/${possible} · ${totalPct}%` : '—' };
          break;
        }
        case 'passedCount':
          cells[c.key] = { value: `${r.passedCount}/${r.quizCount}` };
          break;
        case 'remark':
          cells[c.key] = { value: r.remark, remark: r.remark };
          break;
        default:
          if (c.key.startsWith('quiz-')) {
            const quizId = c.key.slice(5);
            const score = r.scores.find((s) => s && s.quizId === quizId);
            if (!score) {
              cells[c.key] = { value: '—', missing: true };
            } else {
              const passed = isPassed(score.score, score.total, passingPercent);
              const percent = computePercent(score.score, score.total);
              cells[c.key] = {
                value: `${score.score}/${score.total} · ${percent}%`,
                passed,
                failed: !passed,
                score: score.score,
                total: score.total,
                percent,
              };
            }
          }
      }
    });
    return { ...r, cells };
  });

  return { columns: visibleColumns, rows: tableRows, summary };
}
