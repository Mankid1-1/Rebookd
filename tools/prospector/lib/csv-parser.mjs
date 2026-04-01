/**
 * Minimal CSV parser — zero dependencies.
 * Handles quoted fields, commas inside quotes, and normalizes headers.
 */

import { readFileSync } from 'fs';

export function parseCSV(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = splitCSVLines(raw);
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(normalizeHeader);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function splitCSVLines(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseCSVRow(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

export function writeCSV(rows, headers) {
  if (rows.length === 0) return '';
  const h = headers || Object.keys(rows[0]);
  const lines = [h.join(',')];
  for (const row of rows) {
    const vals = h.map(k => escapeCSV(String(row[k] ?? '')));
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function escapeCSV(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}
