'use strict';

const fastify = require('fastify')({ logger: false });
const { randomUUID } = require('crypto');
const { getDb, xorEncrypt, xorDecrypt } = require('./db');
const rpmBuckets = new Map();
const TOKEN_COST_USD = 0.000002; // simple blended estimate
const GLOBAL_RPM_LIMIT = 10;
setInterval(() => { const nowMin=Math.floor(Date.now()/60000); for (const k of rpmBuckets.keys()) { const m=Number(k.split(':')[1]); if (m < nowMin-2) rpmBuckets.delete(k);} }, 60000);

fastify.register(require('@fastify/cors'), {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-keygate-client'],
});

fastify.register(require('@fastify/helmet'), { contentSecurityPolicy: false });

// sql.js quirk: getAsObject returns {col: undefined, ...} when no row found
function rowOrNull(obj) {
  if (!obj) return null;
  const vals = Object.values(obj);
  if (!vals.length || vals.every(v => v === undefined)) return null;
  return obj;
}

function sp(params) { return (params || []).map(p => (p == null) ? null : p); }

function dbGet(db, sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = rowOrNull(stmt.getAsObject(sp(params)));
    stmt.free();
    return result;
  } catch (e) { console.error('dbGet err:', e.message); return null; }
}

function dbAll(db, sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(sp(params));
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (rowOrNull(row)) rows.push(row);
    }
    stmt.free();
    return rows;
  } catch (e) { console.error('dbAll err:', e.message); return []; }
}

function dbRun(db, sql, params = []) {
  try { db.run(sql, sp(params)); } catch (e) { console.error('dbRun err:', e.message); }
}

function generateSubkeyToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let t = 'sk-kg-';
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// ─── Health ──────────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

// ─── Master Keys ─────────────────────────────────────────────────────────────
fastify.get('/api/master-keys', async () => {
  const db = await getDb();
  return dbAll(db, 'SELECT id, provider, name, key_masked, created_at FROM master_keys ORDER BY created_at DESC');
});

fastify.post('/api/master-keys', async (req, reply) => {
  const { provider, api_key, name } = req.body || {};
  if (!provider || !api_key) return reply.code(400).send({ error: 'provider and api_key required' });
  const db = await getDb();
  const existing = dbGet(db, 'SELECT id FROM master_keys WHERE provider = ?', [provider]);
  if (existing) {
    dbRun(db, 'UPDATE master_keys SET key_encrypted = ?, key_masked = ?, name = ? WHERE provider = ?', [
      xorEncrypt(api_key),
      api_key.slice(0, 7) + '••••••••' + api_key.slice(-4),
      name || provider,
      provider,
    ]);
    return { success: true, updated: true };
  }
  const id = randomUUID();
  dbRun(db, 'INSERT INTO master_keys (id, provider, name, key_masked, key_encrypted) VALUES (?, ?, ?, ?, ?)', [
    id, provider, name || provider,
    api_key.slice(0, 7) + '••••••••' + api_key.slice(-4),
    xorEncrypt(api_key),
  ]);
  return { id, success: true };
});

fastify.delete('/api/master-keys/:id', async (req) => {
  const db = await getDb();
  dbRun(db, 'DELETE FROM master_keys WHERE id = ?', [req.params.id]);
  return { success: true };
});

// ─── Subkeys ─────────────────────────────────────────────────────────────────
fastify.get('/api/subkeys', async () => {
  const db = await getDb();
  return dbAll(db, 'SELECT id, name, token, provider, monthly_token_limit, tokens_used, status, expires_at, created_at FROM subkeys ORDER BY created_at DESC');
});

fastify.post('/api/subkeys', async (req, reply) => {
  const { name, provider, monthly_token_limit, spend_limit_usd, expires_in_days } = req.body || {};
  if (!name || !provider) return reply.code(400).send({ error: 'name and provider required' });
  const db = await getDb();
  const masterKey = dbGet(db, 'SELECT id FROM master_keys WHERE provider = ?', [provider]);
  if (!masterKey) return reply.code(400).send({ error: `No master key configured for ${provider}` });
  const id = randomUUID();
  const token = generateSubkeyToken();
  const expires_at = expires_in_days ? Math.floor(Date.now() / 1000) + Number(expires_in_days) * 86400 : null;
  dbRun(db, 'INSERT INTO subkeys (id, name, token, provider, monthly_token_limit, requests_per_minute_limit, spend_limit_usd, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id, name, token, provider, monthly_token_limit || 10000, GLOBAL_RPM_LIMIT, spend_limit_usd ?? null, expires_at,
  ]);
  return dbGet(db, 'SELECT * FROM subkeys WHERE id = ?', [id]);
});

fastify.patch('/api/subkeys/:id', async (req, reply) => {
  const db = await getDb();
  const { status, monthly_token_limit, name } = req.body || {};
  const updates = [], vals = [];
  if (status !== undefined)              { updates.push('status = ?');              vals.push(status); }
  if (monthly_token_limit !== undefined) { updates.push('monthly_token_limit = ?'); vals.push(monthly_token_limit); }
  if (name !== undefined)                { updates.push('name = ?');                vals.push(name); }
  if (!updates.length) return reply.code(400).send({ error: 'nothing to update' });
  vals.push(req.params.id);
  dbRun(db, `UPDATE subkeys SET ${updates.join(', ')} WHERE id = ?`, vals);
  return dbGet(db, 'SELECT * FROM subkeys WHERE id = ?', [req.params.id]);
});

fastify.delete('/api/subkeys/:id', async (req) => {
  const db = await getDb();
  dbRun(db, 'DELETE FROM subkeys WHERE id = ?', [req.params.id]);
  return { success: true };
});

// ─── Analytics ───────────────────────────────────────────────────────────────
fastify.get('/api/analytics', async () => {
  const db = await getDb();
  const logs = dbAll(db, 'SELECT * FROM request_logs ORDER BY created_at DESC LIMIT 200');
  const totalRequests = logs.length;
  const totalTokens = logs.reduce((s, l) => s + (Number(l.tokens_used) || 0), 0);
  const avgLatency = logs.length ? Math.round(logs.reduce((s, l) => s + (Number(l.latency_ms) || 0), 0) / logs.length) : 0;
  const latencies = logs.map(l=>Number(l.latency_ms)||0).filter(Boolean).sort((a,b)=>a-b);
  const p = (x)=> latencies.length ? latencies[Math.max(0, Math.ceil((x/100)*latencies.length)-1)] : 0;
  const byModel = {};
  const bySubkey = {};
  let err=0;
  for (const l of logs){byModel[l.model||'unknown']=(byModel[l.model||'unknown']||0)+1;bySubkey[l.subkey_name||'—']=(bySubkey[l.subkey_name||'—']||0)+(Number(l.tokens_used)||0);if(l.status!=='success')err++;}
  const topModels = Object.entries(byModel).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([model,count])=>({model,count}));
  const costAttribution = Object.entries(bySubkey).map(([subkey,tokens])=>({subkey,tokens,est_cost_usd:+(tokens*TOKEN_COST_USD).toFixed(4)})).sort((a,b)=>b.tokens-a.tokens);
  return { logs, totalRequests, totalTokens, avgLatency, latencyPercentiles:{p50:p(50),p90:p(90),p95:p(95),p99:p(99)}, topModels, errorRate: totalRequests? +(err/totalRequests).toFixed(4):0, costAttribution };
});

// ─── PROXY — The core product ─────────────────────────────────────────────────
fastify.post('/v1/chat/completions', async (req, reply) => {
  const start = Date.now();
  const db = await getDb();

  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const requestSource = (req.headers['x-keygate-client'] === 'dashboard') ? 'dashboard' : 'external';
  if (!token) {
    dbRun(db, 'INSERT INTO request_logs (id, subkey_id, subkey_name, model, tokens_used, status, source, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [randomUUID(), 'n/a', 'unknown', req.body?.model || 'unknown', 0, 'missing_auth', requestSource, Date.now()-start]);
    return reply.code(401).send({ error: { message: 'Missing Authorization header. Use your KeyGate subkey.', type: 'auth_error' } });
  }

  const subkey = dbGet(db, 'SELECT * FROM subkeys WHERE token = ?', [token]);
  if (!subkey) {
    dbRun(db, 'INSERT INTO request_logs (id, subkey_id, subkey_name, model, tokens_used, status, source, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [randomUUID(), 'invalid', 'invalid_subkey', req.body?.model || 'unknown', 0, 'invalid_subkey', requestSource, Date.now()-start]);
    return reply.code(401).send({ error: { message: 'Invalid subkey. Generate one from the KeyGate dashboard.', type: 'auth_error' } });
  }
  if (subkey.status === 'paused') {
    return reply.code(403).send({ error: { message: `Subkey "${subkey.name}" is paused. Contact your admin.`, type: 'permission_error' } });
  }
  if (subkey.status === 'revoked') {
    return reply.code(403).send({ error: { message: `Subkey "${subkey.name}" has been revoked.`, type: 'permission_error' } });
  }
  if (subkey.expires_at && Number(subkey.expires_at) < Math.floor(Date.now() / 1000)) {
    return reply.code(403).send({ error: { message: `Subkey "${subkey.name}" has expired.`, type: 'permission_error' } });
  }
  if (Number(subkey.tokens_used) >= Number(subkey.monthly_token_limit)) {
    return reply.code(429).send({ error: { message: `Monthly quota exhausted (${Number(subkey.monthly_token_limit).toLocaleString()} tokens). Contact your admin.`, type: 'quota_error' } });
  }

  const minute = Math.floor(Date.now()/60000);
  const bucketKey = `${subkey.id}:${minute}`;
  const seen = rpmBuckets.get(bucketKey) || 0;
  const rpmLimit = GLOBAL_RPM_LIMIT;
  if (seen >= rpmLimit) {
    return reply.code(429).send({ error: { message: `Rate limit hit (${rpmLimit}/min) for subkey ${subkey.name}.`, type: 'rate_limit_error' } });
  }
  rpmBuckets.set(bucketKey, seen + 1);

  if (subkey.spend_limit_usd != null) {
    const estSpend = Number(subkey.tokens_used || 0) * TOKEN_COST_USD;
    if (estSpend >= Number(subkey.spend_limit_usd)) {
      return reply.code(429).send({ error: { message: `Spend ceiling reached ($${Number(subkey.spend_limit_usd).toFixed(2)}).`, type: 'spend_limit_error' } });
    }
  }

  const masterKeyRow = dbGet(db, 'SELECT key_encrypted FROM master_keys WHERE provider = ?', [subkey.provider]);
  if (!masterKeyRow) {
    return reply.code(503).send({ error: { message: 'Provider not configured on this gateway.', type: 'config_error' } });
  }

  const masterKey = xorDecrypt(masterKeyRow.key_encrypted);
  const body = req.body;
  const logId = randomUUID();

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterKey}` },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    const latency = Date.now() - start;
    const tokensUsed = data.usage?.total_tokens || 0;

    dbRun(db, 'UPDATE subkeys SET tokens_used = tokens_used + ? WHERE id = ?', [tokensUsed, subkey.id]);
    dbRun(db, 'INSERT INTO request_logs (id, subkey_id, subkey_name, model, tokens_used, status, source, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      logId, subkey.id, subkey.name, body.model || 'unknown', tokensUsed,
      upstream.ok ? 'success' : 'error', requestSource, latency,
    ]);

    return reply.code(upstream.status).send(data);
  } catch (err) {
    dbRun(db, 'INSERT INTO request_logs (id, subkey_id, subkey_name, model, tokens_used, status, source, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      logId, subkey.id, subkey.name, body?.model || 'unknown', 0, 'error', requestSource, Date.now() - start,
    ]);
    return reply.code(502).send({ error: { message: 'Upstream provider unreachable.', type: 'proxy_error' } });
  }
});

const PORT = process.env.PORT || 3001;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`KeyGate API running on port ${PORT}`);
});
