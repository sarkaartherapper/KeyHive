import './components/styles/PageComponents.css';
import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import { api, API } from './services/api';
import { esc, fmtDate, fmtNum, fmtTime, quotaColor, sleep } from './global/utils';

export default function App() {
  const [page, setPage] = useState('overview');
  const [subkeys, setSubkeys] = useState([]);
  const [masterKeys, setMasterKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [notif, setNotif] = useState({ show: false, msg: '', type: 'success' });
  const [modals, setModals] = useState({ addKey: false, createSubkey: false, reveal: false });
  const [revealToken, setRevealToken] = useState('');
  const [form, setForm] = useState({ addKey: '', name: '', provider: 'openai', limit: 50000, expiry: '' });
  const [demo, setDemo] = useState({ token: '', model: 'gpt-4o-mini', prompt: 'Say hello in exactly 5 words.', console: [] });

  const notify = (msg, type='success') => { setNotif({ show: true, msg, type }); setTimeout(() => setNotif((n) => ({ ...n, show: false })), 3000); };
  const navigate = (p) => setPage(p);

  const loadOverview = async () => { const [sks, an] = await Promise.all([api('/api/subkeys'), api('/api/analytics')]); setSubkeys(sks); setLogs(an.logs || []); setAnalytics(an); };
  const loadMasterKeys = async () => setMasterKeys(await api('/api/master-keys'));
  const loadSubkeys = async () => setSubkeys(await api('/api/subkeys'));
  const loadLogs = async () => { const an = await api('/api/analytics'); setLogs(an.logs || []); };
  const loadDemo = async () => setSubkeys(await api('/api/subkeys'));
  useEffect(() => { ({ overview: loadOverview, masterkeys: loadMasterKeys, subkeys: loadSubkeys, logs: loadLogs, demo: loadDemo }[page])(); }, [page]);

  const logRow = (l, i) => <tr key={i}><td className="mono" style={{color:'var(--dim)'}}>{fmtTime(l.created_at)}</td><td style={{fontWeight:500}}>{l.subkey_name || '—'}</td><td className="mono">{l.model || '—'}</td><td className="mono">{fmtNum(l.tokens_used)}</td><td className="mono" style={{color:'var(--muted)'}}>{l.latency_ms ? `${l.latency_ms}ms` : '—'}</td><td className={l.status === 'success' ? 'log-success' : l.status === 'quota_exceeded' ? 'log-quota' : 'log-error'}>{l.status}</td></tr>;

  const demoPreview = useMemo(() => !demo.token ? 'Select a subkey to see the request preview...' : `POST /v1/chat/completions\nAuthorization: Bearer ${demo.token.slice(0, 12)}••••••\n\n{\n  "model": "${demo.model}",\n  "messages": [{\n    "role": "user",\n    "content": "${demo.prompt}"\n  }]\n}`, [demo]);

  return <div className="app"><Sidebar page={page} navigate={navigate} /><main className="main">
    <div className={`page ${page==='overview'?'active':''}`}><div className="page-header"><div className="page-title">Overview</div><div className="page-sub">Your API access at a glance</div></div><div className="stats"><div className="stat"><div className="stat-val">{subkeys.filter((s)=>s.status==='active').length}</div><div className="stat-label">Active subkeys</div></div><div className="stat"><div className="stat-val">{fmtNum(analytics.totalRequests)}</div><div className="stat-label">Total requests</div></div><div className="stat"><div className="stat-val">{fmtNum(analytics.totalTokens)}</div><div className="stat-label">Tokens used</div></div><div className="stat"><div className="stat-val">{analytics.avgLatency || '—'}</div><div className="stat-label">Avg latency (ms)</div></div></div></div>

    <div className={`page ${page==='masterkeys'?'active':''}`}><div className="page-header" style={{display:'flex',justifyContent:'space-between'}}><div><div className="page-title">Master keys</div><div className="page-sub">Your real provider API keys — stored encrypted, never exposed</div></div><button className="btn btn-primary" onClick={()=>setModals((m)=>({...m,addKey:true}))}>+ Add key</button></div><div id="masterkeys-list">{!masterKeys.length?<div className="empty"><div className="empty-icon">🔑</div><div className="empty-text">No master keys configured</div></div>:masterKeys.map((mk)=><div className="card" key={mk.id} style={{display:'flex',justifyContent:'space-between'}}><div><div>{mk.provider === 'openai' ? 'OpenAI' : mk.provider}</div><div className="token-val" style={{color:'var(--muted)'}}>{mk.key_masked}</div></div><div>Added {fmtDate(mk.created_at)} <button className="btn btn-danger btn-sm" onClick={async()=>{await api('/api/master-keys/'+mk.id,{method:'DELETE'});notify('Master key removed');loadMasterKeys();}}>Remove</button></div></div>)}</div></div>

    <div className={`page ${page==='subkeys'?'active':''}`}><div className="page-header" style={{display:'flex',justifyContent:'space-between'}}><div><div className="page-title">Subkeys</div><div className="page-sub">Scoped API tokens you distribute to employees, clients, or teams</div></div><button className="btn btn-primary" onClick={()=>setModals((m)=>({...m,createSubkey:true}))}>+ Create subkey</button></div><div className="card" style={{padding:0}}><div className="table-wrap"><table><thead><tr><th>Name</th><th>Token</th><th>Provider</th><th>Quota</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>{!subkeys.length?<tr><td colSpan="7" style={{textAlign:'center',padding:32,color:'var(--dim)'}}>No subkeys yet — create one above</td></tr>:subkeys.map((sk)=><tr key={sk.id}><td>{sk.name}</td><td>{sk.token?.slice(0,12)}••••••••{sk.token?.slice(-4)}</td><td>{sk.provider}</td><td><div className="quota-bar"><div className={`quota-fill ${quotaColor(sk.tokens_used, sk.monthly_token_limit)}`} style={{width:`${Math.min(100,Math.round((sk.tokens_used/sk.monthly_token_limit)*100))}%`}}/></div><div className="quota-text">{fmtNum(sk.tokens_used)} / {fmtNum(sk.monthly_token_limit)}</div></td><td>{fmtDate(sk.expires_at)}</td><td><span className={`badge ${sk.status}`}>{sk.status}</span></td><td><button className="btn btn-danger btn-sm" onClick={async()=>{await api('/api/subkeys/'+sk.id,{method:'PATCH',body:{status:'revoked'}});notify('Subkey revoked');loadSubkeys();}}>Revoke</button></td></tr>)}</tbody></table></div></div></div>

    <div className={`page ${page==='logs'?'active':''}`}><div className="page-header"><div className="page-title">Request logs</div></div><div className="card" style={{padding:0}}><table><tbody>{!logs.length?<tr><td colSpan="6" style={{textAlign:'center',padding:32,color:'var(--dim)'}}>No requests yet</td></tr>:logs.map(logRow)}</tbody></table></div></div>

    <div className={`page ${page==='demo'?'active':''}`}><div className="page-header"><div className="page-title">Live demo</div></div><div className="card"><select id="demo-subkey-select" value={demo.token} onChange={(e)=>setDemo((d)=>({...d,token:e.target.value}))}><option value="">— select a subkey —</option>{subkeys.filter((s)=>s.status==='active').map((s)=><option value={s.token} key={s.id}>{s.name}</option>)}</select><input type="text" value={demo.prompt} onChange={(e)=>setDemo((d)=>({...d,prompt:e.target.value}))}/><select value={demo.model} onChange={(e)=>setDemo((d)=>({...d,model:e.target.value}))}><option value="gpt-4o-mini">gpt-4o-mini</option><option value="gpt-4o">gpt-4o</option><option value="gpt-3.5-turbo">gpt-3.5-turbo</option></select><pre style={{marginTop:12}}>{demoPreview}</pre><button className="btn btn-primary" onClick={async()=>{if(!demo.token){notify('Select a subkey first','error');return;}const con=[];setDemo(d=>({...d,console:con}));await sleep(300);const res=await fetch(API+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+demo.token},body:JSON.stringify({model:demo.model,messages:[{role:'user',content:demo.prompt}],max_tokens:150})});const data=await res.json();notify(res.ok?'Request proxied — check logs for usage':(data.error?.message||'Request failed'),res.ok?'success':'error');}}>Run test call →</button></div></div>
  </main>

  {modals.addKey && <div className="modal-backdrop open" onClick={(e)=>e.target===e.currentTarget&&setModals(m=>({...m,addKey:false}))}><div className="modal"><div className="modal-title">Add provider key</div><input type="password" value={form.addKey} onChange={(e)=>setForm({...form,addKey:e.target.value})} placeholder="sk-..."/><div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setModals(m=>({...m,addKey:false}))}>Cancel</button><button className="btn btn-primary" onClick={async()=>{await api('/api/master-keys',{method:'POST',body:{provider:'openai',api_key:form.addKey}});setForm({...form,addKey:''});setModals(m=>({...m,addKey:false}));notify('Master key saved — encrypted');loadMasterKeys();}}>Save encrypted key</button></div></div></div>}

  {modals.createSubkey && <div className="modal-backdrop open" onClick={(e)=>e.target===e.currentTarget&&setModals(m=>({...m,createSubkey:false}))}><div className="modal"><div className="modal-title">Create subkey</div><input placeholder="e.g. Client A — Frontend" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/><input type="number" value={form.limit} onChange={(e)=>setForm({...form,limit:e.target.value})}/><input type="number" value={form.expiry} onChange={(e)=>setForm({...form,expiry:e.target.value})} placeholder="Expires in days"/><div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setModals(m=>({...m,createSubkey:false}))}>Cancel</button><button className="btn btn-primary" onClick={async()=>{const sk=await api('/api/subkeys',{method:'POST',body:{name:form.name,provider:form.provider,monthly_token_limit:Number(form.limit),expires_in_days:form.expiry?Number(form.expiry):null}});if(sk.error){notify(sk.error,'error');return;}setRevealToken(sk.token);setModals(m=>({...m,createSubkey:false,reveal:true}));setForm({...form,name:'',expiry:''});loadSubkeys();}}>Generate subkey</button></div></div></div>}

  {modals.reveal && <div className="modal-backdrop open"><div className="modal"><div className="modal-title">Subkey created</div><div className="reveal-token">{revealToken}</div><div className="modal-footer"><button className="btn btn-primary" onClick={()=>setModals(m=>({...m,reveal:false}))}>Done</button></div></div></div>}
  <div className={`notif ${notif.show ? 'show' : ''} ${notif.type}`}>{notif.msg}</div>
  </div>;
}
