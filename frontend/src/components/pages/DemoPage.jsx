import { useState } from 'react';
import '../styles/DemoPage.css';

export default function DemoPage({ ctx }) {
  const { subkeys, API, notify, sleep, page, loadLogs, loadOverview } = ctx;
  const [token, setToken] = useState(''); const [model, setModel] = useState('gpt-4o-mini'); const [prompt, setPrompt] = useState('Say hello in exactly 5 words.'); const [consoleLines, setConsoleLines] = useState(['# KeyGate live proxy demo', '# Select a subkey and hit "Run test call" to see the magic', 'ready — waiting for request']);
  const active = subkeys.filter((s) => s.status === 'active');
  const preview = !token ? 'Select a subkey to see the request preview...' : `POST /v1/chat/completions\nAuthorization: Bearer ${token.slice(0, 12)}••••••\n\n{\n  "model": "${model}",\n  "messages": [{\n    "role": "user",\n    "content": "${prompt}"\n  }]\n}`;
  const add = (line) => setConsoleLines((v) => [...v, line]);

  const runDemo = async () => {
    if (!token) return notify('Select a subkey first', 'error'); if (!prompt.trim()) return notify('Enter a prompt', 'error');
    const skName = active.find((s) => s.token === token)?.name || '—';
    setConsoleLines([`$ sending request with subkey ${token.slice(0, 16)}…`]);
    await sleep(300); add(`→ POST http://localhost:3001 (or :3003/:3004)/v1/chat/completions`);
    await sleep(400); add(`→ validating subkey ${skName}`);
    await sleep(350); add('✓ subkey valid — quota OK');
    await sleep(250); add('→ decrypting master key (server-side only)');
    await sleep(300); add('→ forwarding to api.openai.com with real key');
    await sleep(200); add('⏳ waiting for OpenAI response…');
    try { const res = await fetch(API + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 150 }) }); const data = await res.json(); if (!res.ok) { add(`✗ error ${res.status}: ${data.error?.message || 'unknown error'}`); return; } add(`✓ response received`); add(`→ tokens used: ${data.usage?.total_tokens || 0} (quota updated)`); add(''); add('AI response:'); add(data.choices?.[0]?.message?.content || ''); notify('Request proxied — check logs for usage'); if (page === 'logs') loadLogs(); if (page === 'overview') loadOverview(); } catch (e) { add(`✗ connection error: ${e.message}`); }
  };

  return <div className='page active'><div style={{ padding: '32px 36px' }}><div className='page-header'><div className='page-title'>Live demo</div><div className='page-sub'>See exactly how a client uses a subkey — without ever knowing the real key</div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}><div className='card'><div className='card-header' style={{ marginBottom: '12px' }}><div className='card-title'>Configure test call</div></div><div className='field' style={{ marginBottom: '12px' }}><label>Subkey to test</label><select value={token} onChange={(e) => setToken(e.target.value)}><option value=''>— select a subkey —</option>{active.map((s) => <option key={s.id} value={s.token}>{s.name}</option>)}</select></div><div className='field' style={{ marginBottom: '12px' }}><label>Prompt</label><input value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div><div className='field' style={{ marginBottom: '16px' }}><label>Model</label><select value={model} onChange={(e) => setModel(e.target.value)}><option value='gpt-4o-mini'>gpt-4o-mini</option><option value='gpt-4o'>gpt-4o</option><option value='gpt-3.5-turbo'>gpt-3.5-turbo</option></select></div><button className='btn btn-primary' style={{ width: '100%' }} onClick={runDemo}>Run test call →</button></div><div className='card' style={{ background: '#060609' }}><div className='card-header' style={{ marginBottom: '12px' }}><div className='card-title' style={{ color: 'var(--muted)' }}>What the client sends</div></div><pre style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--dim)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{preview}</pre></div></div>
  <div className='console'><div className='console-bar'><div className='dot r' /><div className='dot y' /><div className='dot g' /><span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>KeyGate proxy console</span></div><div className='console-body'>{consoleLines.map((l, i) => <p key={i} className='console-line'>{l}</p>)}</div></div></div></div>;
}
