// src/lib/exportXlsx.js
// Excel export via exceljs (lazy-loaded). Same columns and order as the
// preview; frozen header row; failed cells light red fill; numeric cells
// stored as numbers; auto column widths. File name per spec 05.

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
  return `${code}_${term}_${sy}_report_${date}.xlsx`;
}

function cellValue(cell) {
  if (!cell) return '';
  if (cell.missing) return '—';
  const symbol = cell.failed ? '× ' : '';
  return `${symbol}${cell.value}`;
}

export async function exportXlsx(report, options = {}) {
  const { passingPercent = report.subject?.passingPercent ?? 75, columns, mode = 'detail' } = options;
  const Excel = (await import('exceljs')).default;

  const table = toTable(report, { passingPercent, columns, mode });
  const { columns: tblColumns, rows: tblRows, summary } = table;

  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet('Summary');

  const headerRow = sheet.addRow(tblColumns.map((c) => c.label));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF3C3C3C' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });

  const FAILED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };

  for (const r of tblRows) {
    const values = tblColumns.map((c) => {
      const cell = r.cells[c.key];
      if (!cell) return '';
      if (c.key.startsWith('quiz-')) {
        if (cell.missing) return '—';
        return cell.value;
      }
      return cell.value;
    });
    const row = sheet.addRow(values);

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      const colKey = tblColumns[colNumber - 1]?.key;
      if (colKey && colKey.startsWith('quiz-')) {
        const rc = r.cells[colKey];
        if (rc && rc.failed) {
          cell.fill = FAILED_FILL;
          cell.font = { bold: true, size: 10, color: { argb: 'FF9C1C1C' } };
        } else {
          cell.font = { size: 10, color: { argb: 'FF212529' } };
        }
      } else if (colKey === 'average') {
        cell.numFmt = '0.00';
        cell.font = { size: 10 };
      } else {
        cell.font = { size: 10 };
      }
    });
  }

  // Freeze header row.
  sheet.freezePanes = 'A2';

  // Summary block below the table.
  const startRow = tblRows.length + 3;
  sheet.getCell(`A${startRow}`).value = 'Class summary';
  sheet.getCell(`A${startRow}`).font = { bold: true, size: 10, color: { argb: 'FF3C3C3C' } };
  sheet.getCell(`A${startRow + 1}`).value = `Students: ${summary.students} · Class average: ${summary.classAverage}% · Pass rate: ${summary.passRate}%`;
  sheet.getCell(`A${startRow + 1}`).font = { size: 10, color: { argb: 'FF212529' } };

  // Auto column widths.
  for (let i = 0; i < tblColumns.length; i++) {
    let maxWidth = tblColumns[i].label.length;
    for (const r of tblRows) {
      const v = cellValue(r.cells[tblColumns[i].key]);
      maxWidth = Math.max(maxWidth, String(v).length);
    }
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxWidth + 2, 8), 40);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFileName(report);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
