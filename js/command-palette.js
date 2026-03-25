//  COMMAND PALETTE  v5  (Ctrl+K / ⌘K)
// ════════════════════════════════════════════
const CP = {
  open: false,
  query: '',
  items: [],        // full flattened item list (rebuilt on open)
  filtered: [],     // items matching current query
  activeIdx: 0,
};

// Master command registry — static actions + dynamic (history, files)
const CP_STATIC = [
  // ── Chat
  { icon:'🤝', name:'Start Live Collaboration', desc:'Sync session with other tabs in real time', shortcut:'', section:'Chat',   action:()=>collabStart() },
  { icon:'📝', name:'Prompt Templates',   desc:'Browse & use prompt templates (Ctrl+T)',  shortcut:'', section:'Chat',    action:()=>tplOpen() },
  { icon:'📊', name:'Analytics Dashboard',desc:'Usage stats, heatmap, model breakdown',   shortcut:'',       section:'Chat',    action:()=>analyticsOpen() },
  { icon:'🔢', name:'Context Window',     desc:'Show token usage for current chat',        shortcut:'',       section:'Chat',    action:()=>{ ctxUpdate(); showToast(`Context: ${CTX.lastPct}% full`, CTX.lastPct>=90?'err':CTX.lastPct>=75?'wrn':'inf'); } },
  { icon:'✨', name:'New Chat',           desc:'Clear and start fresh',                   shortcut:'Ctrl+N', section:'Chat',    action:()=>newChat() },
  { icon:'📤', name:'Export Chat',        desc:'Download conversation as Markdown',       shortcut:'',       section:'Chat',    action:()=>exportChat() },
  { icon:'🔗', name:'Share Chat',         desc:'Generate shareable link',                 shortcut:'',       section:'Chat',    action:()=>shareChat() },
  { icon:'💬', name:'Switch to Chat Tab', desc:'Focus the chat pane',                     shortcut:'',       section:'Chat',    action:()=>switchMainTab('chat') },
  // ── Build
  { icon:'▶',  name:'Run Preview',        desc:'Render current code in preview pane',     shortcut:'',       section:'Build',   action:()=>runPreview() },
  { icon:'📋', name:'Switch to Preview',  desc:'Open the preview tab',                    shortcut:'',       section:'Build',   action:()=>switchMainTab('preview') },
  { icon:'📁', name:'Download ZIP',       desc:'Export all project files as ZIP',         shortcut:'',       section:'Build',   action:()=>dlZip() },
  { icon:'⊟',  name:'Show Last Diff',     desc:'View diff of last AI file change',        shortcut:'',       section:'Build',   action:()=>{ if(DIFF.path&&DIFF.oldContent)diffShow(DIFF.path,DIFF.oldContent,DIFF.newContent); else showToast('No diff available yet','inf'); } },
  // ── Agents
  { icon:'🔧', name:'Pipeline Editor',     desc:'Build custom agent pipelines visually',   shortcut:'',       section:'Agents',  action:()=>apeOpen() },
  { icon:'🤖', name:'Toggle Multi-Agent',  desc:'Enable / disable the agent pipeline',     shortcut:'',       section:'Agents',  action:()=>toggleAgentsMode() },
  // ── Settings / Vault
  { icon:'🔑', name:'Open API Vault',     desc:'Manage keys, routing, model priority',    shortcut:'',       section:'Settings',action:()=>openVault() },
  { icon:'⚙',  name:'Settings',           desc:'Tokens, persona, preferences',            shortcut:'',       section:'Settings',action:()=>openVault('vsettings') },
  { icon:'📊', name:'Model Routing',      desc:'View task-to-model routing table',        shortcut:'',       section:'Settings',action:()=>openVault('routing') },
  // ── View
  { icon:'📂', name:'Toggle Sidebar',     desc:'Show or hide the file / history sidebar', shortcut:'',       section:'View',    action:()=>togSb() },
  { icon:'🕑', name:'Chat History',       desc:'Browse previous conversations',           shortcut:'',       section:'View',    action:()=>{togSb(true);document.querySelector('.lsb-tab:nth-child(2)')?.click();} },
  { icon:'💰', name:'Session Cost',         desc:'Show API cost estimate for this chat',    shortcut:'',       section:'Chat',    action:()=>{ costUpdate(); showToast(`Cost: $${COST.sessionTotal.toFixed(5)}`, 'inf'); } },
  { icon:'🌡', name:'Token Heatmap',        desc:'Toggle token usage intensity overlay',    shortcut:'',       section:'View',    action:()=>heatmapToggle() },
  { icon:'🎵', name:'Ambient Audio',        desc:'Background soundscapes while working',    shortcut:'',       section:'View',    action:()=>audioPickerToggle() },
  // ── Mode
  { icon:'🔨', name:'Toggle Build Mode',  desc:'Turn build mode on or off',               shortcut:'',       section:'Mode',    action:()=>{const b=document.getElementById('btn-build');if(b){b.checked=!b.checked;b.dispatchEvent(new Event('change'));}} },
  { icon:'💡', name:'Toggle Thinking',    desc:'Enable deep reasoning steps',              shortcut:'',       section:'Mode',    action:()=>{S.opts.think=!S.opts.think;showToast(S.opts.think?'🧠 Thinking ON':'Thinking OFF','inf');} },
  { icon:'🎯', name:'Pixel Vision Mode',    desc:'Design → code with pixel diff overlay',   shortcut:'',       section:'Build',   action:()=>ppvOpen() },
  { icon:'🧩', name:'Prompt Inspector',      desc:'Show active system prompt blocks',         shortcut:'',       section:'Mode',    action:()=>dspInspect() },
  { icon:'🤖', name:'Switch Persona',     desc:'Change AI persona / system prompt',        shortcut:'',       section:'Mode',    action:()=>personaPickerOpen() },
  // ── Voice
  { icon:'🎙', name:'Start Voice Input',  desc:'Speak your message',                      shortcut:'',       section:'Voice',   action:()=>voiceStartListening() },
  { icon:'🔊', name:'Toggle Auto-Read',   desc:'AI reads responses aloud',                shortcut:'',       section:'Voice',   action:()=>voiceToggleAutoRead() },
  { icon:'⏹',  name:'Stop Voice',         desc:'Stop listening / speaking',               shortcut:'',       section:'Voice',   action:()=>voiceStopAll() },
  { icon:'⚙',  name:'Voice Settings',     desc:'Voice, speed, pitch, language',           shortcut:'',       section:'Voice',   action:()=>{ document.getElementById('voiceBar').classList.add('show'); voiceOpenSettings(); } },
];

function cpOpen() {
  if (CP.open) return;
  CP.open = true;
  CP.query = '';
  CP.activeIdx = 0;
  cpBuildItems();
  cpRender();
  document.getElementById('cpOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('cpInput')?.focus(), 30);
}

function cpClose() {
  if (!CP.open) return;
  CP.open = false;
  document.getElementById('cpOverlay').classList.remove('open');
}

function cpBuildItems() {
  CP.items = [...CP_STATIC];

  // Append recent sessions as navigable items
  const sessions = (S.sessions || []).slice(0, 8);
  sessions.forEach(sess => {
    const title = sess.title || sess.msgs?.[0]?.content?.slice?.(0,50) || 'Chat';
    CP.items.push({
      icon:'🕑', name: typeof title==='string' ? title : 'Chat',
      desc:'Load conversation', shortcut:'', section:'History',
      action:() => loadSession(sess.id)
    });
  });

  CP.filtered = CP.items;
}

function cpFilter(q) {
  CP.query = q;
  CP.activeIdx = 0;
  if (!q.trim()) { CP.filtered = CP.items; cpRender(); return; }
  const lq = q.toLowerCase();
  CP.filtered = CP.items.filter(item =>
    item.name.toLowerCase().includes(lq) ||
    item.desc.toLowerCase().includes(lq) ||
    item.section.toLowerCase().includes(lq)
  );
  cpRender();
}

function cpRender() {
  const list = document.getElementById('cpList');
  if (!list) return;

  if (!CP.filtered.length) {
    list.innerHTML = `<div class="cp-empty">No results for "<strong>${esc(CP.query)}</strong>"</div>`;
    return;
  }

  // Group by section
  const groups = {};
  CP.filtered.forEach((item, idx) => {
    if (!groups[item.section]) groups[item.section] = [];
    groups[item.section].push({ item, idx });
  });

  let html = '';
  for (const [section, entries] of Object.entries(groups)) {
    html += `<div class="cp-section-lbl">${section}</div>`;
    entries.forEach(({ item, idx }) => {
      const isActive = idx === CP.activeIdx;
      html += `<div class="cp-item${isActive?' active':''}" data-idx="${idx}" onclick="cpRun(${idx})">
        <div class="cp-item-icon">${item.icon}</div>
        <div class="cp-item-body">
          <div class="cp-item-name">${esc(item.name)}</div>
          <div class="cp-item-desc">${esc(item.desc)}</div>
        </div>
        ${item.shortcut ? `<span class="cp-item-shortcut">${esc(item.shortcut)}</span>` : ''}
      </div>`;
    });
  }
  list.innerHTML = html;

  // Scroll active item into view
  const activeEl = list.querySelector('.cp-item.active');
  if (activeEl) activeEl.scrollIntoView({ block:'nearest' });
}

function cpRun(idx) {
  const item = CP.filtered[idx];
  if (!item) return;
  cpClose();
  setTimeout(() => { try { item.action(); } catch(e) { console.warn('CP action error:', e); } }, 60);
}

function cpMove(dir) {
  const n = CP.filtered.length;
  if (!n) return;
  CP.activeIdx = ((CP.activeIdx + dir) + n) % n;
  cpRender();
}

// Keyboard handler for the palette input
function cpKey(e) {
  if (e.key === 'ArrowDown')  { e.preventDefault(); cpMove(+1); return; }
  if (e.key === 'ArrowUp')    { e.preventDefault(); cpMove(-1); return; }
  if (e.key === 'Enter')      { e.preventDefault(); cpRun(CP.activeIdx); return; }
  if (e.key === 'Escape')     { cpClose(); return; }
}

// Global Ctrl+K / Cmd+K listener
document.addEventListener('keydown', e => {
  // Open palette
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    CP.open ? cpClose() : cpOpen();
    return;
  }
  // Ctrl+T → templates
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    tplOpen();
    return;
  }
  // Escape closes if open
  if (e.key === 'Escape' && CP.open) { cpClose(); return; }
});

