export default function Sidebar({ page, setPage }) {
  const pages = ['overview', 'masterkeys', 'subkeys', 'logs', 'demo'];
  return <aside className='sidebar'><div className='logo'><div className='logo-name'>KeyGate</div></div><nav className='nav'>{pages.map((p) => <button key={p} className={`nav-item ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>)}</nav></aside>;
}
