import { useEffect, useState } from 'react';
import Sidebar from './components/parts/Sidebar';
import OverviewPage from './components/pages/OverviewPage';
import MasterKeysPage from './components/pages/MasterKeysPage';
import SubkeysPage from './components/pages/SubkeysPage';
import LogsPage from './components/pages/LogsPage';
import DemoPage from './components/pages/DemoPage';

const API='http://localhost:3001';
const api=(p,o={})=>fetch(API+p,{headers:{'Content-Type':'application/json',...o.headers},...o,body:o.body?JSON.stringify(o.body):undefined}).then(r=>r.json());

export default function App(){
  const [page,setPage]=useState('overview');
  const [subkeys,setSubkeys]=useState([]);const [masterKeys,setMasterKeys]=useState([]);const [logs,setLogs]=useState([]);
  const [notif,setNotif]=useState({show:false,msg:'',type:'success'});
  const notify=(msg,type='success')=>{setNotif({show:true,msg,type});setTimeout(()=>setNotif(v=>({...v,show:false})),3000)};
  useEffect(()=>{loadOverview();},[]);
  const loadOverview=async()=>{const [sks,an]=await Promise.all([api('/api/subkeys'),api('/api/analytics')]);setSubkeys(sks);setLogs(an.logs||[])};
  const loadMaster=async()=>setMasterKeys(await api('/api/master-keys'));
  const loadSub=async()=>setSubkeys(await api('/api/subkeys'));
  const loadLogs=async()=>{const a=await api('/api/analytics');setLogs(a.logs||[])};
  const navigate=async(p)=>{setPage(p);if(p==='overview')await loadOverview();if(p==='masterkeys')await loadMaster();if(p==='subkeys')await loadSub();if(p==='logs')await loadLogs();if(p==='demo')await loadSub();};
  return <div className='app'><Sidebar page={page} navigate={navigate}/><main className='main'>
    {page==='overview'&&<OverviewPage subkeys={subkeys} logs={logs} navigate={navigate}/>}
    {page==='masterkeys'&&<MasterKeysPage masterKeys={masterKeys} api={api} reload={loadMaster} notify={notify}/>}
    {page==='subkeys'&&<SubkeysPage subkeys={subkeys} api={api} reload={loadSub} notify={notify}/>}
    {page==='logs'&&<LogsPage logs={logs}/>}
    {page==='demo'&&<DemoPage subkeys={subkeys} notify={notify}/>}
  </main><div className={`notif ${notif.show?'show':''} ${notif.type}`}>{notif.msg}</div></div>
}
