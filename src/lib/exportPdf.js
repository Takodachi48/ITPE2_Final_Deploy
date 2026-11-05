// src/lib/exportPdf.js
// PDF export via jspdf + jspdf-autotable (lazy-loaded). Same columns and
// order as the preview; failed cells in red text; page numbers "Page x of y";
// header block on page 1. File name per spec 05.

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
  return `${code}_${term}_${sy}_report_${date}.pdf`;
}

function cellText(cell) {
  if (!cell) return '';
  if (cell.missing) return '—';
  const symbol = cell.failed ? '× ' : '';
  return `${symbol}${cell.value}`;
}

export async function exportPdf(report, options = {}) {
  const { passingPercent = report.subject?.passingPercent ?? 75, columns, mode = 'summary' } = options;
  const { jsPDF } = await import('jspdf');
  const { default: autotable } = await import('jspdf-autotable');

  const table = toTable(report, { passingPercent, columns, mode });
  const { columns: tblColumns, rows: tblRows, summary } = table;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // ---- Header block (page 1) ----
  const subject = report.subject || {};
  const passingPct = passingPercent ?? 75;
  const now = new Date(report.generatedAt || Date.now());

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(subject.name || 'Report', margin, margin + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${subject.code || ''} · ${subject.term || ''} · ${subject.schoolYear || ''}`,
    margin,
    margin + 16,
  );
  doc.text(
    `Faculty: ${subject.faculty || '—'}  ·  Passing: ${passingPct}%`,
    margin,
    margin + 23,
  );
  doc.text(
    `Generated ${now.toLocaleString()}`,
    margin,
    margin + 30,
  );

  // ---- Table via autotable ----
  const head = [tblColumns.map((c) => c.label)];
  const body = tblRows.map((r) =>
    tblColumns.map((c) => {
      const cell = r.cells[c.key];
      if (!cell) return '';
      if (c.key.startsWith('quiz-')) {
        return cellText(cell);
      }
      return cell.value;
    }),
  );

  const tableStartY = margin + 42;

  autotable(doc, {
    head,
    body,
    startY: tableStartY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [60, 60, 60],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 24 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index >= 4) {
        const colKey = tblColumns[data.column.index]?.key;
        if (colKey && colKey.startsWith('quiz-')) {
          const row = tblRows[data.row.index];
          const cell = row.cells[colKey];
          if (cell && cell.failed) {
            doc.setTextColor(200, 30, 30);
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(30, 30, 30);
            doc.setFont('helvetica', 'normal');
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - margin + 4,
        { align: 'right' },
      );
    },
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : tableStartY + 10;

  // ---- Footer summary ----
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Students: ${summary.students}  ·  Class average: ${summary.classAverage}%  ·  Pass rate: ${summary.passRate}%`,
    margin,
    finalY + 10,
  );

  doc.save(buildFileName(report));
}
