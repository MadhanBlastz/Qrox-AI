function init() {
  try{S.keys=JSON.parse(localStorage.getItem('eai_keys')||'{}');}catch{}
  try{S.settings={...S.settings,...JSON.parse(localStorage.getItem('eai_settings')||'{}')};}catch{}
  try{
    const stored=JSON.parse(localStorage.getItem('eai_priority')||'[]');
    const merged=stored.filter(e=>PROVS.find(p=>p.id===e.id));
    PROVS.forEach(p=>{ if(!merged.find(e=>e.id===p.id)) merged.push({id:p.id,on:true}); });
    S.priority=merged.length?merged:PROVS.map(p=>({id:p.id,on:true}));
  }catch{S.priority=PROVS.map(p=>({id:p.id,on:true}));}
  try{S.sessions=JSON.parse(localStorage.getItem(LS_SESSIONS)||'[]');}catch{S.sessions=[];}
  ragLoad();
  loadRouting();
  selectBest(S.mode);
  renderHistSidebar();
  initScrollListener();
  // Wire send button click (no inline onclick attr so setSndBtn can fully control it)
  const _sb = document.getElementById('sndBtn');
  if (_sb) _sb.onclick = handleSend;
  document.getElementById('uIn').focus();
  // Sync RAG UI after load
  setTimeout(ragUpdateUI, 0);
}

