//  COPY / DOWNLOAD
// ════════════════════════════════════════════
async function cpyCode(id,btn){const el=document.getElementById(id);if(!el)return;try{await navigator.clipboard.writeText(el.textContent);btn.classList.add('ok');btn.textContent='✅ Copied';setTimeout(()=>{btn.classList.remove('ok');btn.textContent='📋 Copy';},1600);showToast('Copied!','ok');}catch{showToast('Copy failed','err');}}
function dlCode(id,lang,fname){const el=document.getElementById(id);if(!el)return;const ext={javascript:'js',python:'py',css:'css',html:'html',bash:'sh',json:'json',typescript:'ts'};const n=fname||'code.'+(ext[lang]||'txt');dlF(n,el.textContent);showToast(`Saved ${n}`,'ok');}
async function cpyBbl(btn){const b=btn.closest('.msg').querySelector('.bbl');if(!b)return;try{await navigator.clipboard.writeText(b.innerText);showToast('Copied!','ok');}catch{showToast('Failed','err');}}
function dlMsg(btn){const b=btn.closest('.msg').querySelector('.bbl');if(!b)return;dlF('response.md',b.innerText);showToast('Saved!','ok');}
function exportChat(){if(!S.msgs.length){showToast('Nothing to export','wrn');return;}dlF('chat.md',S.msgs.map(m=>`[${m.role.toUpperCase()}]\n${m.content}\n`).join('\n---\n\n'));showToast('Exported!','ok');}
function dlF(n,c){const a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(c);a.download=n;a.click();}

// ════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════
function showToast(msg,type='inf'){const ic={ok:'✅',err:'❌',inf:'ℹ',wrn:'⚠'};const w=document.getElementById('twrap');const t=document.createElement('div');t.className=`toast ${type}`;t.innerHTML=`${ic[type]||'•'} ${esc(msg)}`;w.appendChild(t);setTimeout(()=>{t.style.cssText='opacity:0;transform:translateX(14px);transition:all .22s';setTimeout(()=>t.remove(),250);},3000);}

// ════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function gT(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function hlCode(el){
  el.querySelectorAll('pre code').forEach(b=>{
    if(b._prismDone) return;      // already highlighted — skip
    b._prismDone = true;
    if(window.Prism) Prism.highlightElement(b);
  });
}
function hexRgb(h){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'99,102,241';}
function ovClose(e,id){if(e.target.id===id)document.getElementById(id).classList.remove('open');}

// ════════════════════════════════════════════
//  GLOBAL SEARCH  v5
//  Searches across all saved chat sessions.
//  Results show: session title, timestamp, role
//  badge, and a highlighted text snippet.
// ════════════════════════════════════════════
const GS = { query: '', debounce: null };

function gsOpen() {
  setTimeout(() => {
    const inp = document.getElementById('gsInput');
    if (inp) {
      inp.focus();
      if (GS.query) { inp.value = GS.query; gsSearchOrHistory(GS.query); }
      else gsSearchOrHistory('');
    }
  }, 60);
}

function gsSearchOrHistory(q) {
  const results  = document.getElementById('gsResults');
  const histEl   = document.getElementById('lsb-history-content');
  const clearBtn = document.getElementById('gsClearBtn');
  if (!q.trim()) {
    // Show history, hide results
    if (results)  results.style.display  = 'none';
    if (histEl)   histEl.style.display   = 'flex';
    if (clearBtn) clearBtn.style.display = 'none';
    document.getElementById('gsMeta').textContent = '';
    GS.query = '';
    return;
  }
  // Show results, hide history
  if (results)  results.style.display  = 'block';
  if (histEl)   histEl.style.display   = 'none';
  if (clearBtn) clearBtn.style.display = 'flex';
  gsSearch(q);
}

function gsClearAndHistory() {
  GS.query = '';
  const inp = document.getElementById('gsInput');
  if (inp) { inp.value = ''; inp.focus(); }
  gsSearchOrHistory('');
}

function gsClear() { gsClearAndHistory(); }

function gsSearch(q) {
  GS.query = q;
  clearTimeout(GS.debounce);
  if (!q.trim()) { gsSearchOrHistory(''); document.getElementById('gsMeta').textContent = ''; return; }
  // Debounce 120ms for fast typing
  GS.debounce = setTimeout(() => _gsRun(q.trim()), 120);
}

function _gsRun(q) {
  const sessions = S.sessions || [];
  if (!sessions.length) {
    gsRenderNoHistory();
    return;
  }

  const lq = q.toLowerCase();
  const words = lq.split(/\s+/).filter(Boolean);

  // Match score: count how many words appear in the session text
  const matches = [];
  sessions.forEach(sess => {
    const msgs = sess.msgs || [];
    msgs.forEach((msg, mi) => {
      const raw = typeof msg.content === 'string' ? msg.content
                : Array.isArray(msg.content) ? (msg.content.find(p=>p.type==='text')?.text || '') : '';
      if (!raw) return;
      const lower = raw.toLowerCase();
      const hits = words.filter(w => lower.includes(w)).length;
      if (!hits) return;

      // Find the best snippet window around the first hit
      const firstHit = words.reduce((best, w) => {
        const i = lower.indexOf(w);
        return (i >= 0 && i < best) ? i : best;
      }, Infinity);
      const start = Math.max(0, firstHit - 40);
      const snippet = raw.slice(start, start + 140).replace(/\n+/g, ' ');

      matches.push({
        sessId:   sess.id,
        title:    sess.title || 'Untitled',
        ts:       sess.ts,
        role:     msg.role,
        snippet,
        score:    hits * 10 + (msg.role === 'user' ? 1 : 0),
        msgIdx:   mi,
      });
    });
  });

  // Sort by score desc, deduplicate by session (keep best match per session)
  const seen = new Set();
  const deduped = matches
    .sort((a, b) => b.score - a.score)
    .filter(m => { if (seen.has(m.sessId)) return false; seen.add(m.sessId); return true; })
    .slice(0, 25);

  const metaEl = document.getElementById('gsMeta');
  if (!deduped.length) {
    metaEl.textContent = 'No results';
    document.getElementById('gsResults').innerHTML =
      `<div class="gs-empty"><div class="gs-empty-icon">🔍</div>No matches for "<strong>${esc(q)}</strong>"</div>`;
    return;
  }

  metaEl.textContent = `${deduped.length} session${deduped.length!==1?'s':''} matched`;

  // Highlight helper — wraps all matching words in <mark>
  function highlight(text, words) {
    let out = esc(text);
    words.forEach(w => {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
      out = out.replace(re, m => `<mark>${m}</mark>`);
    });
    return out;
  }

  let html = '';
  deduped.forEach(m => {
    const date = new Date(m.ts);
    const timeStr = date.toLocaleDateString([], { month:'short', day:'numeric' })
                  + ' ' + date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const roleTag = m.role === 'user'
      ? `<span class="gs-result-badge" style="background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.25);color:#93c5fd">YOU</span>`
      : `<span class="gs-result-badge">AI</span>`;
    html += `
      <div class="gs-result" onclick="gsLoadSession('${m.sessId}')">
        <div class="gs-result-hdr">
          <span style="font-size:.78rem">💬</span>
          <span class="gs-result-title">${esc(m.title.slice(0,50))}</span>
          ${roleTag}
          <span class="gs-result-time">${timeStr}</span>
        </div>
        <div class="gs-result-match">…${highlight(m.snippet, words)}…</div>
      </div>`;
  });

  document.getElementById('gsResults').innerHTML = html;
}

function gsLoadSession(id) {
  loadSession(id);
  // Switch back to chat after loading
  const filesTab = document.querySelector('.lsb-tab');
  if (filesTab) lsbTab(filesTab, 'files');
}

function gsRenderEmpty() {
  // When search is cleared, fall back to showing history
  gsSearchOrHistory('');
}

function gsRenderNoHistory() {
  document.getElementById('gsMeta').textContent = '';
  document.getElementById('gsResults').innerHTML =
    `<div class="gs-empty"><div class="gs-empty-icon">💬</div>No saved chats yet.<br>Start a conversation first!</div>`;
}

// Keyboard shortcut: Ctrl+Shift+F opens search tab
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
    e.preventDefault();
    // Open sidebar if closed
    const lsb = document.getElementById('lsb');
    if (lsb.classList.contains('off')) {
      lsb.classList.remove('off');
    }
    const searchTab = document.getElementById('gsTabBtn');
    if (searchTab) { lsbTab(searchTab, 'history'); gsOpen(); }
  }
});

// ════════════════════════════════════════════
