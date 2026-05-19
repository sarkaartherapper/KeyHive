import { useState } from 'react';
import '../styles/MasterKeysPage.css';

export default function MasterKeysPage({ ctx }) {
  const { masterKeys, api, loadMasterKeys, notify, fmtDate } = ctx;
  const [apiKey, setApiKey] = useState('');

  const saveMasterKey = async () => {
    if (!apiKey.trim()) return notify('Enter an API key', 'error');
    await api('/api/master-keys', { method: 'POST', body: { provider: 'openai', api_key: apiKey.trim() } });
    setApiKey('');
    notify('Master key saved — encrypted');
    loadMasterKeys();
  };

  const removeMasterKey = async (id) => {
    if (!window.confirm('Remove this master key? Any subkeys using it will stop working.')) return;
    await api(`/api/master-keys/${id}`, { method: 'DELETE' });
    notify('Master key removed');
    loadMasterKeys();
  };

  return (
    <div className='page active'>
      <div style={{ padding: '32px 36px' }}>
        <div className='page-header' style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className='page-title'>Master keys</div>
            <div className='page-sub'>Your real provider API keys — stored encrypted, never exposed</div>
          </div>
          <button className='btn btn-primary' onClick={saveMasterKey}>+ Add key</button>
        </div>

        <div className='card' style={{ background: '#ffb54708', borderColor: '#ffb54720' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>⚡</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--amber)', marginBottom: '4px' }}>Keys are encrypted at rest</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.7 }}>Your master keys are encrypted before storage. They are never returned in any API response, never logged, and only injected server-side at request time. Your clients only ever see subkeys.</div>
            </div>
          </div>
        </div>

        <div className='card'>
          <div className='form-row single'>
            <div className='field'>
              <label>API key</label>
              <input type='password' value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder='sk-...' autoComplete='off' />
            </div>
          </div>
        </div>

        {!masterKeys.length ? (
          <div className='empty'>
            <div className='empty-icon'>🔑</div>
            <div className='empty-text'>No master keys configured</div>
          </div>
        ) : masterKeys.map((mk) => (
          <div className='card' key={mk.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--bg4)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {mk.provider === 'openai' ? '⬛' : '🔵'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '3px' }}>{mk.provider === 'openai' ? 'OpenAI' : mk.provider}</div>
              <div className='token-val' style={{ fontSize: '12px', color: 'var(--muted)' }}>{mk.key_masked}</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--dim)' }}>Added {fmtDate(mk.created_at)}</div>
            <span style={{ fontSize: '11px', background: '#2dca7215', color: 'var(--green)', padding: '3px 9px', borderRadius: '20px' }}>Encrypted</span>
            <button className='btn btn-danger btn-sm' onClick={() => removeMasterKey(mk.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
