import '../styles/OverviewPage.css';

export default function OverviewPage({ ctx, navigate }) {
  const { subkeys, logs, analytics, fmtNum, quotaColor, fmtTime } = ctx;
  return <div className='page active'><div style={{ padding: '32px 36px' }}>
    <div className='page-header'><div className='page-title'>Overview</div><div className='page-sub'>Your API access at a glance</div></div>
    <div className='stats'>
      <div className='stat'><div className='stat-val'>{subkeys.filter((s) => s.status === 'active').length}</div><div className='stat-label'>Active subkeys</div></div>
      <div className='stat'><div className='stat-val'>{fmtNum(analytics.totalRequests)}</div><div className='stat-label'>Total requests</div></div>
      <div className='stat'><div className='stat-val'>{fmtNum(analytics.totalTokens)}</div><div className='stat-label'>Tokens used</div></div>
      <div className='stat'><div className='stat-val'>{analytics.avgLatency || '—'}</div><div className='stat-label'>Avg latency (ms)</div></div>
    </div>
    <div className='card'><div className='card-header'><div><div className='card-title'>Subkey usage snapshot</div><div className='card-sub'>Quota consumption across all active keys</div></div><button className='btn btn-ghost btn-sm' onClick={() => navigate('subkeys')}>Manage →</button></div>
      {!subkeys.length ? <div className='empty'><div className='empty-text'>No subkeys yet — <button className='btn btn-ghost btn-sm' onClick={() => navigate('subkeys')}>create one</button></div></div> : subkeys.slice(0, 5).map((sk) => {const pct = Math.min(100, Math.round((sk.tokens_used / sk.monthly_token_limit) * 100)); const col = quotaColor(sk.tokens_used, sk.monthly_token_limit); return <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{sk.name}</div><div className='quota-bar'><div className={`quota-fill ${col}`} style={{ width: `${pct}%` }} /></div><div className='quota-text'>{fmtNum(sk.tokens_used)} / {fmtNum(sk.monthly_token_limit)} tokens — {pct}%</div></div><span className={`badge ${sk.status}`}>{sk.status}</span></div>;})}
    </div>
    <div className='card'><div className='card-header'><div><div className='card-title'>Recent activity</div></div><button className='btn btn-ghost btn-sm' onClick={() => navigate('logs')}>All logs →</button></div>
      <div className='table-wrap'><table><thead><tr><th>Time</th><th>Subkey</th><th>Model</th><th>Tokens</th><th>Latency</th><th>Status</th></tr></thead><tbody>{logs.slice(0, 8).length ? logs.slice(0, 8).map((l, i) => <tr key={i}><td className='mono' style={{ color: 'var(--dim)' }}>{fmtTime(l.created_at)}</td><td style={{ fontWeight: 500 }}>{l.subkey_name || '—'}</td><td className='mono' style={{ fontSize: '12px' }}>{l.model || '—'}</td><td className='mono'>{fmtNum(l.tokens_used)}</td><td className='mono' style={{ color: 'var(--muted)' }}>{l.latency_ms ? `${l.latency_ms}ms` : '—'}</td><td style={{ fontSize: '12px', fontWeight: 500 }}>{l.status}</td></tr>) : <tr><td colSpan='6' style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No requests yet</td></tr>}</tbody></table></div>
    </div>
  </div></div>;
}
