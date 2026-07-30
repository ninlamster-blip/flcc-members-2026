/**
 * Exports — CSV, Excel, PDF, and calendar files.
 *
 * A church must be able to take its records out at any time: to a
 * spreadsheet, to an auditor, to another system, or simply to a printer. None
 * of this needs a server, and none of it needs a library — the formats that
 * matter are text.
 *
 * PDF is produced through the browser's own print pipeline against a
 * purpose-built print stylesheet, which is both smaller and better-looking
 * than anything a client-side PDF library would emit for a table.
 */

import { formatDate } from './format.js';

/** RFC 4180 escaping — quotes doubled, fields with separators quoted. */
export function toCSV(rows, columns) {
  const cols = columns || Object.keys(rows[0] || {}).map((key) => ({ key, label: key }));
  const escape = (value) => {
    if (value == null) return '';
    const str = Array.isArray(value) ? value.join('; ') : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [cols.map((c) => escape(c.label)).join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','));
  }
  return lines.join('\r\n');
}

/**
 * SpreadsheetML — a real .xls Excel opens natively, with typed cells and a
 * bold header row. No dependency, no CSV encoding arguments about Arabic.
 */
export function toExcelXml(sheets) {
  const escape = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (value) => {
    const isNumber = typeof value === 'number' && Number.isFinite(value);
    return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escape(value)}</Data></Cell>`;
  };
  const body = sheets.map(({ name, columns, rows }) => {
    const header = `<Row>${columns.map((c) => `<Cell ss:StyleID="head"><Data ss:Type="String">${escape(c.label)}</Data></Cell>`).join('')}</Row>`;
    const dataRows = rows.map((row) => `<Row>${columns
      .map((c) => cell(typeof c.value === 'function' ? c.value(row) : row[c.key]))
      .join('')}</Row>`).join('');
    return `<Worksheet ss:Name="${escape(name).slice(0, 31)}"><Table>${header}${dataRows}</Table></Worksheet>`;
  }).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="head"><Font ss:Bold="1"/></Style></Styles>
 ${body}
</Workbook>`;
}

/** Trigger a download of `content` in the browser. */
export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(filename, rows, columns) {
  // The BOM is what makes Excel read UTF-8 — without it, Arabic and Tagalog
  // names arrive as mojibake in the church office.
  download(filename, `﻿${toCSV(rows, columns)}`, 'text/csv;charset=utf-8');
}

export function downloadExcel(filename, sheets) {
  download(filename, toExcelXml(sheets), 'application/vnd.ms-excel');
}

export function downloadJSON(filename, data) {
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * Print a report to PDF via the browser. `sections` are already-built DOM
 * nodes so a report looks the same on screen and on paper.
 *
 * @param {{title: string, subtitle?: string, nodes: Node[]}} report
 */
export function printReport({ title, subtitle, nodes }) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { size: A4; margin: 18mm 14mm; }
      body { font: 12px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #18181B; }
      h1 { font-size: 20px; margin: 0 0 2px; }
      .sub { color: #6B7280; font-size: 12px; margin: 0 0 18px; }
      table { width: 100%; border-collapse: collapse; margin: 0 0 18px; font-size: 11px; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
      th { font-weight: 600; background: #F9FAFB; }
      h2 { font-size: 14px; margin: 18px 0 8px; }
      .stat-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
      .stat { border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px 12px; min-width: 120px; }
      .stat b { display: block; font-size: 17px; }
      .muted { color: #6B7280; }
      footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 10px; }
      .ai-badge { display: inline-block; border: 1px solid #C7D2FE; background: #EEF2FF; color: #3730A3;
                  border-radius: 999px; padding: 1px 8px; font-size: 10px; }
    </style></head><body>
    <h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
    <div id="content"></div>
    <footer>Generated by Shepherd on ${formatDate(new Date())}. Figures are as recorded in this church's own records.</footer>
    </body></html>`);
  doc.close();

  const content = doc.getElementById('content');
  for (const node of nodes) content.appendChild(doc.importNode(node, true));

  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}

/* ── calendar ─────────────────────────────────────────────────────────────── */

function icsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(text) {
  return String(text || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

/**
 * An .ics file for one or many events — how a rota reaches someone's phone.
 * @param {{id: string, title: string, startsAt: string, endsAt?: string, venue?: string, description?: string}[]} events
 */
export function toICS(events, calendarName = 'Shepherd') {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shepherd//Church Platform//EN',
    'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  for (const event of events) {
    const start = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 90 * 6e4);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@shepherd.church`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(event.title)}`,
      event.venue ? `LOCATION:${icsEscape(event.venue)}` : '',
      event.description ? `DESCRIPTION:${icsEscape(event.description)}` : '',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

export function downloadICS(filename, events, calendarName) {
  download(filename, toICS(events, calendarName), 'text/calendar;charset=utf-8');
}
