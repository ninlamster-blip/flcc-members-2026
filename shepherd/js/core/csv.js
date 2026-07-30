/**
 * CSV, read. `exporters.js` only ever writes one; importing a spreadsheet
 * needs the other half, and it needs no dependency to get it — a CSV is
 * text, and RFC 4180's quoting rules are a small, well-defined state machine.
 *
 * Deliberately not an .xlsx parser: reading the real binary format means
 * inflating a zip and walking its XML, a meaningful chunk of code for a
 * format every spreadsheet tool already exports to CSV in one click. Import
 * screens ask for CSV and say so.
 */

/**
 * @param {string} text
 * @returns {string[][]} rows of raw cell strings, trimmed of a trailing blank row
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { pushField(); continue; }
    if (c === '\n') { pushRow(); continue; }
    field += c;
  }
  if (field !== '' || row.length) pushRow();

  return rows.filter((r) => r.length > 1 || (r[0] || '').trim() !== '');
}

/**
 * Rows keyed by header, matched case/whitespace-insensitively against any of
 * several accepted spellings per field — the same column shows up as
 * "Complete Name" in one export and "Full Name" in another.
 *
 * @param {string[][]} rows including the header row
 * @param {Record<string, string[]>} fieldMap target field -> accepted header names
 * @returns {{records: Record<string,string>[], matchedHeaders: Record<string,string>}}
 */
export function mapColumns(rows, fieldMap) {
  if (!rows.length) return { records: [], matchedHeaders: {} };
  const header = rows[0].map((h) => normalizeHeader(h));
  const matchedHeaders = {};
  const columnFor = {};
  for (const [field, aliases] of Object.entries(fieldMap)) {
    const names = aliases.map(normalizeHeader);
    const index = header.findIndex((h) => names.includes(h));
    if (index !== -1) { columnFor[field] = index; matchedHeaders[field] = rows[0][index]; }
  }
  const records = rows.slice(1).map((cells) => {
    const record = {};
    for (const [field, index] of Object.entries(columnFor)) record[field] = (cells[index] || '').trim();
    return record;
  }).filter((record) => Object.values(record).some((v) => v !== ''));
  return { records, matchedHeaders };
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
