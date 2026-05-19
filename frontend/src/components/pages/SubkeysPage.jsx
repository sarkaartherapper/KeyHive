import { useState } from 'react';
import '../styles/SubkeysPage.css';

export default function SubkeysPage({ ctx }) {
  const { subkeys, api, loadSubkeys, notify, fmtNum, fmtDate, quotaColor } = ctx;
  const [name, setName] = useState('');
  const [limit, setLimit] = useState(50000);
  const [expiry, setExpiry] = useState('');

  const createSubkey = async () => {
    if (!name.trim()) return notify('Enter a name', 'error');
    const sk = await api('/api/subkeys', {
      method: 'POST',
      body: {
        name: name.trim(),
        provider: 'openai',
        monthly_token_limit: Number(limit) || 50000,
        expires_in_days: expiry ? Number(expiry) : null
      }
    });
    if (sk.error) return notify(sk.error, 'error');
    setName('');
    setLimit(50000);
    setExpiry('');
    notify('Subkey created');
    loadSubkeys();
  };

  const patchSubkey = async (id, status) => {
    await api(`/api/subkeys/${id}`, { method: 'PATCH', body: { status } });
    notify(status === 'paused' ? 'Subkey paused' : 'Subkey resumed');
    loadSubkeys();
  };

  const revokeSubkey = async (id) => {
    if (!window.confirm('Revoke this subkey? It will stop working immediately.')) return;
    await api(`/api/subkeys/${id}`, { method: 'PATCH', body: { status: 'revoked' } });
    notify('Subkey revoked');
    loadSubkeys();
  };

  return (
    <div className='page active'>
      <div style={{ padding: '32px 36px' }}>
        <div className='page-header' style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className='page-title'>Subkeys</div>
            <div className='page-sub'>Scoped API tokens you distribute to employees, clients, or teams</div>
          </div>
          <button className='btn btn-primary' onClick={createSubkey}>+ Create subkey</button>
        </div>

        <div className='card'>
          <div className='form-row'>
            <div className='field'>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. Client A — Frontend' />
            </div>
            <div className='field'>
              <label>Monthly token limit</label>
              <input type='number' value={limit} onChange={(e) => setLimit(e.target.value)} min='100' />
            </div>
          </div>
          <div className='form-row single'>
            <div className='field'>
              <label>Expires in (days)</label>
              <input type='number' value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder='Leave blank = never' />
            </div>
          </div>
        </div>

        <div className='card' style={{ padding: 0 }}>
          <div className='table-wrap'>
            <table>
              <thead><tr><th>Name</th><th>Token</th><th>Provider</th><th>Quota</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {!subkeys.length ? <tr><td colSpan='7' style={{ textAlign: 'center', color: 'var(--dim)', padding: '32px' }}>No subkeys yet — create one above</td></tr> : subkeys.map((sk) => {
                  const pct = Math.min(100, Math.round((sk.tokens_used / sk.monthly_token_limit) * 100));
                  const col = quotaColor(sk.tokens_used, sk.monthly_token_limit);
                  const masked = `${sk.token.slice(0, 12)}••••••••${sk.token.slice(-4)}`;
                  return <tr key={sk.id}>
                    <td style={{ fontWeight: 500 }}>{sk.name}</td>
                    <td><div className='token-box' style={{ maxWidth: '200px' }}><span className='token-val'>{masked}</span></div></td>
                    <td><span style={{ fontSize: '12px', background: 'var(--bg3)', padding: '3px 8px', borderRadius: '4px', fontFamily: 'DM Mono, monospace' }}>{sk.provider}</span></td>
                    <td style={{ minWidth: '120px' }}><div className='quota-bar'><div className={`quota-fill ${col}`} style={{ width: `${pct}%` }} /></div><div className='quota-text'>{fmtNum(sk.tokens_used)} / {fmtNum(sk.monthly_token_limit)}</div></td>
                    <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{fmtDate(sk.expires_at)}</td>
                    <td><span className={`badge ${sk.status}`}>{sk.status}</span></td>
                    <td><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {sk.status === 'active' && <button className='btn btn-amber btn-sm' onClick={() => patchSubkey(sk.id, 'paused')}>Pause</button>}
                      {sk.status === 'paused' && <button className='btn btn-green btn-sm' onClick={() => patchSubkey(sk.id, 'active')}>Resume</button>}
                      {sk.status !== 'revoked' && <button className='btn btn-danger btn-sm' onClick={() => revokeSubkey(sk.id)}>Revoke</button>}
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
