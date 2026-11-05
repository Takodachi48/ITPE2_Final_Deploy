// src/lib/exportCsv.js
// CSV export: plain string builder, UTF-8 with BOM so Excel shows accents
// and ñ correctly. Same columns and order as the preview. File name per spec 05.

import { toTable } from './reportTable.js';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDateYyyymmdd(date) {
  const d = new Date(date || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function buildFileName(report) {
  const code = slugify(report.subject?.code || 'subject');
  const term = slugify(report.subject?.term || 'term');
  const sy = slugify(report.subject?.schoolYear || 'year');
  const date = formatDateYyyymmdd(report.generatedAt);
  return `${code}_${term}_${sy}_report_${date}.csv`;
}

function escapeCsv(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function cellText(cell) {
  if (!cell) return '';
  if (cell.missing) return '—';
  const symbol = cell.failed ? '× ' : '';
  return `${symbol}${cell.value}`;
}

export function buildCsv(report, options = {}) {
  const { passingPercent = report.subject?.passingPercent ?? 75, columns, mode = 'detail' } = options;
  const table = toTable(report, { passingPercent, columns, mode });
  const { columns: tblColumns, rows: tblRows, summary } = table;

  const lines = [];
  lines.push(tblColumns.map((c) => escapeCsv(c.label)).join(','));
  for (const r of tblRows) {
    lines.push(
      tblColumns
        .map((c) => {
          const cell = r.cells[c.key];
          if (!cell) return '';
          if (c.key.startsWith('quiz-')) return escapeCsv(cellText(cell));
          return escapeCsv(cell.value);
        })
        .join(','),
    );
  }

  // Summary block.
  lines.push('');
  lines.push('Class summary');
  lines.push(`Students,${summary.students}`);
  lines.push(`Class average,${summary.classAverage}`);
  lines.push(`Pass rate,${summary.passRate}`);

  return lines.join('\r\n');
}

export function exportCsv(report, options = {}) {
  const csv = buildCsv(report, options);
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFileName(report);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
