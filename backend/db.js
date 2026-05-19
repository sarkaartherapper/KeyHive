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
      tokens_used INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      expires_at INTEGER,
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
    "ALTER TABLE master_keys ADD COLUMN name TEXT",
    "ALTER TABLE request_logs ADD COLUMN source TEXT DEFAULT 'external'"
  ];
  for (const q of stmts){ try{ db.run(q);}catch(e){} }
}
