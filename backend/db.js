const initSqlJs = require('sql.js');

let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  db = new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS master_keys (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      name TEXT,
      key_masked TEXT NOT NULL,
      key_encrypted TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS subkeys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      monthly_token_limit INTEGER DEFAULT 100000,
      requests_per_minute_limit INTEGER DEFAULT 60,
      tokens_used INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      spend_limit_usd REAL,
      max_requests INTEGER DEFAULT 5000,
      request_count INTEGER DEFAULT 0,
      allowed_models TEXT DEFAULT 'all',
      expires_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS quota_requests (
      id TEXT PRIMARY KEY,
      subkey_id TEXT NOT NULL,
      subkey_name TEXT,
      request_type TEXT NOT NULL,
      amount TEXT,
      status TEXT DEFAULT 'pending',
      note TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      subkey_id TEXT NOT NULL,
      subkey_name TEXT,
      model TEXT,
      tokens_used INTEGER DEFAULT 0,
      status TEXT,
      source TEXT DEFAULT 'external',
      latency_ms INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  ensureColumns(db);
  return db;
}

function xorEncrypt(text, key = 'keygate-demo-secret') {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString('base64');
}

function xorDecrypt(encoded, key = 'keygate-demo-secret') {
  const text = Buffer.from(encoded, 'base64').toString();
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

module.exports = { getDb, xorEncrypt, xorDecrypt };


// lightweight migrations for existing in-memory schema
function ensureColumns(db){
  const stmts=[
    "ALTER TABLE subkeys ADD COLUMN requests_per_minute_limit INTEGER DEFAULT 60",
    "ALTER TABLE subkeys ADD COLUMN spend_limit_usd REAL",
    "ALTER TABLE subkeys ADD COLUMN max_requests INTEGER DEFAULT 5000",
    "ALTER TABLE subkeys ADD COLUMN request_count INTEGER DEFAULT 0",
    "ALTER TABLE subkeys ADD COLUMN allowed_models TEXT DEFAULT 'all'",
    "ALTER TABLE master_keys ADD COLUMN name TEXT",
    "ALTER TABLE request_logs ADD COLUMN source TEXT DEFAULT 'external'"
  ];
  for (const q of stmts){ try{ db.run(q);}catch(e){} }
}

function percentile(arr,p){if(!arr.length)return 0;const a=[...arr].sort((x,y)=>x-y);const i=Math.ceil((p/100)*a.length)-1;return a[Math.max(0,Math.min(i,a.length-1))];}
