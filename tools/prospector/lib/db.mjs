/**
 * SQLite local cache for discovered prospects.
 * Uses better-sqlite3 (already installed).
 * Prevents duplicate API calls and stores enrichment results.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

let _db = null;

export function getDb(dbPath) {
  if (_db) return _db;

  const dir = join(dbPath || process.cwd(), '.prospector-cache');
  mkdirSync(dir, { recursive: true });
  const fullPath = join(dir, 'prospects.db');

  _db = new Database(fullPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Create tables
  _db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      business_type TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      website TEXT,
      rating REAL,
      review_count INTEGER,
      lat REAL,
      lng REAL,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT REFERENCES businesses(id),
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      job_title TEXT,
      email TEXT,
      email_source TEXT,
      phone TEXT,
      linkedin TEXT,
      enriched INTEGER DEFAULT 0,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      subreddit TEXT,
      title TEXT,
      url TEXT,
      body TEXT,
      author TEXT,
      score INTEGER,
      industry TEXT,
      pain_point TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT,
      source TEXT,
      result_count INTEGER,
      searched_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
    CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(business_type);
    CREATE INDEX IF NOT EXISTS idx_businesses_source ON businesses(source);
    CREATE INDEX IF NOT EXISTS idx_prospects_business ON prospects(business_id);
    CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
  `);

  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ── Business operations ─────────────────────────────────

export function upsertBusiness(db, biz) {
  const stmt = db.prepare(`
    INSERT INTO businesses (id, source, name, business_type, address, city, state, zip, phone, website, rating, review_count, lat, lng, raw_data, updated_at)
    VALUES (@id, @source, @name, @business_type, @address, @city, @state, @zip, @phone, @website, @rating, @review_count, @lat, @lng, @raw_data, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = @name, business_type = @business_type, address = @address, city = @city, state = @state,
      zip = @zip, phone = @phone, website = @website, rating = @rating, review_count = @review_count,
      lat = @lat, lng = @lng, raw_data = @raw_data, updated_at = datetime('now')
  `);
  stmt.run({
    id: biz.id,
    source: biz.source || 'unknown',
    name: biz.name || '',
    business_type: biz.business_type || '',
    address: biz.address || '',
    city: biz.city || '',
    state: biz.state || '',
    zip: biz.zip || '',
    phone: biz.phone || '',
    website: biz.website || '',
    rating: biz.rating || null,
    review_count: biz.review_count || null,
    lat: biz.lat || null,
    lng: biz.lng || null,
    raw_data: JSON.stringify(biz.raw || {}),
  });
}

export function getBusinesses(db, filters = {}) {
  let sql = 'SELECT * FROM businesses WHERE 1=1';
  const params = {};
  if (filters.city) { sql += ' AND LOWER(city) = LOWER(@city)'; params.city = filters.city; }
  if (filters.state) { sql += ' AND LOWER(state) = LOWER(@state)'; params.state = filters.state; }
  if (filters.business_type) { sql += ' AND business_type = @business_type'; params.business_type = filters.business_type; }
  if (filters.source) { sql += ' AND source = @source'; params.source = filters.source; }
  sql += ' ORDER BY name';
  return db.prepare(sql).all(params);
}

export function getBusinessById(db, id) {
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
}

export function businessExists(db, id) {
  const row = db.prepare('SELECT 1 FROM businesses WHERE id = ?').get(id);
  return !!row;
}

// ── Prospect operations ─────────────────────────────────

export function insertProspect(db, prospect) {
  const stmt = db.prepare(`
    INSERT INTO prospects (business_id, first_name, last_name, full_name, job_title, email, email_source, phone, linkedin, enriched, raw_data)
    VALUES (@business_id, @first_name, @last_name, @full_name, @job_title, @email, @email_source, @phone, @linkedin, @enriched, @raw_data)
  `);
  return stmt.run({
    business_id: prospect.business_id || null,
    first_name: prospect.first_name || '',
    last_name: prospect.last_name || '',
    full_name: prospect.full_name || '',
    job_title: prospect.job_title || '',
    email: prospect.email || '',
    email_source: prospect.email_source || '',
    phone: prospect.phone || '',
    linkedin: prospect.linkedin || '',
    enriched: prospect.enriched ? 1 : 0,
    raw_data: JSON.stringify(prospect.raw || {}),
  });
}

export function getProspects(db, filters = {}) {
  let sql = 'SELECT p.*, b.name as business_name, b.business_type, b.website as business_website, b.city as business_city, b.state as business_state, b.address as business_address, b.zip as business_zip FROM prospects p LEFT JOIN businesses b ON p.business_id = b.id WHERE 1=1';
  const params = {};
  if (filters.business_id) { sql += ' AND p.business_id = @business_id'; params.business_id = filters.business_id; }
  if (filters.enriched !== undefined) { sql += ' AND p.enriched = @enriched'; params.enriched = filters.enriched ? 1 : 0; }
  if (filters.hasEmail) { sql += " AND p.email != ''"; }
  sql += ' ORDER BY p.full_name';
  return db.prepare(sql).all(params);
}

export function updateProspectEnrichment(db, id, data) {
  const stmt = db.prepare(`
    UPDATE prospects SET
      email = COALESCE(NULLIF(@email, ''), email),
      email_source = COALESCE(NULLIF(@email_source, ''), email_source),
      phone = COALESCE(NULLIF(@phone, ''), phone),
      linkedin = COALESCE(NULLIF(@linkedin, ''), linkedin),
      enriched = 1,
      updated_at = datetime('now')
    WHERE id = @id
  `);
  stmt.run({ id, email: data.email || '', email_source: data.email_source || '', phone: data.phone || '', linkedin: data.linkedin || '' });
}

// ── Complaint operations ────────────────────────────────

export function insertComplaint(db, complaint) {
  const stmt = db.prepare(`
    INSERT INTO complaints (source, subreddit, title, url, body, author, score, industry, pain_point)
    VALUES (@source, @subreddit, @title, @url, @body, @author, @score, @industry, @pain_point)
  `);
  stmt.run({
    source: complaint.source || 'reddit',
    subreddit: complaint.subreddit || '',
    title: complaint.title || '',
    url: complaint.url || '',
    body: (complaint.body || '').slice(0, 2000),
    author: complaint.author || '',
    score: complaint.score || 0,
    industry: complaint.industry || '',
    pain_point: complaint.pain_point || '',
  });
}

export function getComplaints(db) {
  return db.prepare('SELECT * FROM complaints ORDER BY score DESC').all();
}

// ── Search log ──────────────────────────────────────────

export function logSearch(db, query, source, resultCount) {
  db.prepare('INSERT INTO search_log (query, source, result_count) VALUES (?, ?, ?)').run(query, source, resultCount);
}

// ── Stats ───────────────────────────────────────────────

export function getStats(db) {
  return {
    businesses: db.prepare('SELECT COUNT(*) as count FROM businesses').get().count,
    prospects: db.prepare('SELECT COUNT(*) as count FROM prospects').get().count,
    enrichedProspects: db.prepare('SELECT COUNT(*) as count FROM prospects WHERE enriched = 1').get().count,
    withEmail: db.prepare("SELECT COUNT(*) as count FROM prospects WHERE email != ''").get().count,
    withPhone: db.prepare("SELECT COUNT(*) as count FROM prospects WHERE phone != ''").get().count,
    complaints: db.prepare('SELECT COUNT(*) as count FROM complaints').get().count,
    searches: db.prepare('SELECT COUNT(*) as count FROM search_log').get().count,
  };
}
