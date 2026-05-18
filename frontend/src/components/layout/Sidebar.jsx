export default function Sidebar({ page, navigate }) {
  const items = [
    ['overview', 'Overview'], ['masterkeys', 'Master keys'], ['subkeys', 'Subkeys'], ['logs', 'Request logs'], ['demo', 'Live demo'],
  ];
  return <aside className="sidebar"><div className="logo"><div className="logo-mark"><div className="logo-icon">▦</div><div><div className="logo-name">KeyGate</div><div className="logo-sub">API access manager</div></div></div></div><nav className="nav"><div className="nav-label">Platform</div>{items.map(([key,label]) => <button key={key} className={`nav-item ${page===key?'active':''}`} onClick={()=>navigate(key)}>{label}{key==='demo'&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-footer"><div className="api-url-box"><div className="api-url-label">Proxy endpoint</div><div className="api-url">localhost:3001</div></div></div></aside>;
}
