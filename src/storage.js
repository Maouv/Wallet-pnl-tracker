import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'snapshots.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    total_usd REAL NOT NULL,
    breakdown TEXT NOT NULL,
    partial INTEGER NOT NULL DEFAULT 0
  )
`);

/**
 * Save a new baseline snapshot. `partial` = true if any position/token
 * could not be priced (see edge case rules) — surfaced later so PnL
 * numbers are never silently wrong.
 */
export function saveSnapshot(totalUsd, breakdown, partial) {
  const stmt = db.prepare(
    'INSERT INTO snapshots (ts, total_usd, breakdown, partial) VALUES (?, ?, ?, ?)'
  );
  const info = stmt.run(Date.now(), totalUsd, JSON.stringify(breakdown), partial ? 1 : 0);
  return info.lastInsertRowid;
}

export function getLatestSnapshot() {
  const row = db.prepare('SELECT * FROM snapshots ORDER BY ts DESC LIMIT 1').get();
  return row ? { ...row, breakdown: JSON.parse(row.breakdown) } : null;
}

export function getFirstSnapshot() {
  const row = db.prepare('SELECT * FROM snapshots ORDER BY ts ASC LIMIT 1').get();
  return row ? { ...row, breakdown: JSON.parse(row.breakdown) } : null;
}

export function countSnapshots() {
  return db.prepare('SELECT COUNT(*) as c FROM snapshots').get().c;
}
