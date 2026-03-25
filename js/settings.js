// ════════════════════════════════════════════
//  SIMPLE SETTINGS
// ════════════════════════════════════════════
function openSimpSet(){document.getElementById('simpTokens').value=S.settings.maxTokens;document.getElementById('simpPersona').value=S.settings.persona;document.getElementById('simpOv').classList.add('open');}
function saveSimpSettings(){S.settings.maxTokens=parseInt(document.getElementById('simpTokens').value)||4096;S.settings.persona=document.getElementById('simpPersona').value.trim();localStorage.setItem('eai_settings',JSON.stringify(S.settings));document.getElementById('simpOv').classList.remove('open');showToast('Settings saved!','ok');}

// ════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════
function lsbTab(el,pane){
  document.querySelectorAll('.lsb-tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.lsb-pane').forEach(p=>p.classList.remove('on'));
  document.getElementById('lsb-'+pane).classList.add('on');
}
function switchMainTab(tab){
  document.getElementById('chatPane').style.display=tab==='chat'?'flex':'none';
  document.getElementById('prevPane').className='prev-pane'+(tab==='preview'?' on':'');
  document.getElementById('tab-chat').classList.toggle('on',tab==='chat');
  document.getElementById('tab-preview').classList.toggle('on',tab==='preview');
}
function toggleSB(){
  const sb=document.getElementById('lsb');
  const bd=document.getElementById('sidebarBackdrop');
  if(window.innerWidth<=860){
    const open=sb.classList.toggle('mobile-open');
    if(bd) bd.style.display=open?'block':'none';
  } else {
    sb.classList.toggle('off');
  }
}
function togSec(id){const b=document.getElementById(id),c=document.getElementById(id+'c');const o=b.classList.toggle('open');if(c)c.textContent=o?'▼':'▶';}
function setMode(el,mode){document.querySelectorAll('.mde').forEach(b=>b.classList.remove('on'));el.classList.add('on');S.mode=mode;selectBest(mode);showToast(`Mode: ${mode.charAt(0).toUpperCase()+mode.slice(1)}`,'inf');}
function tog(k){
  S.opts[k]=!S.opts[k];
  if(k==='build') syncBuildToggle();
  else document.getElementById('btn-'+k)?.classList.toggle('on',S.opts[k]);
  // Keep plus menu items in sync
  if(k==='think'||k==='structured') updatePlusItems?.();
}

function onBuildLabelClick(){
  // Manually toggle checkbox since we stopped default label behavior
  const cb = document.getElementById('btn-build');
  if(cb){ cb.checked = !cb.checked; onBuildToggle(cb); }
}

// Called by the checkbox input change event
function onBuildToggle(checkbox){
  S.opts.build = checkbox.checked;
  // Auto-select html-single pill when build turns on with no framework selected
  if(S.opts.build && !S.framework){
    const defaultPill = document.querySelector('.fw-pill[data-fw="html-single"]');
    if(defaultPill) selectFwPill(defaultPill);
  }
  syncBuildToggle();
  const uIn=document.getElementById('uIn');
  if(uIn && INPUT_MODE==='chat'){
    uIn.placeholder = S.opts.build ? 'Describe what to build…' : 'Message the AI…';
  }
}

// Sync ALL build UI: toggle wrap, checkbox, irow border, footer badge, placeholder, framework toolbar
function syncBuildToggle(){
  const on  = S.opts.build;
  const wrap = document.getElementById('buildToggleWrap');
  const cb   = document.getElementById('btn-build');
  const irow = document.getElementById('mainIrow');
  const badge= document.getElementById('buildModeBadge');
  const uIn  = document.getElementById('uIn');
  const toolbar = document.getElementById('chatToolbarWrap');
  // Show/hide build status indicator
  const bs = document.getElementById('buildStatus');
  if (bs) bs.style.display = on ? '' : 'none';
  // Sync ctrl panel build toggle
  ctrlUpdateToggles?.();

  if(wrap)  wrap.classList.toggle('on', on);
  if(cb)    cb.checked = on;
  if(irow)  irow.classList.toggle('build-on', on);
  if(badge) badge.classList.toggle('show', on);
  // Show/hide framework toolbar based on build mode (and not agent mode)
  // Never show if framework is already locked (first send happened)
  if(toolbar) toolbar.style.display = (on && INPUT_MODE !== 'agent' && !S._frameworkLocked) ? '' : 'none';
  // Reset lock and framework when build mode turns OFF
  if(!on){ S._frameworkLocked = false; S.framework = null; S._userPickedFramework = false;
    document.querySelectorAll('.fw-pill,.fw-btn').forEach(b=>b.classList.remove('on')); }
  if(uIn && INPUT_MODE==='chat'){
    uIn.placeholder = on ? 'Describe what to build…' : 'Message the AI…';
  }
}
function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}
function autoR(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,138)+'px';}
function updCC(){const n=document.getElementById('uIn').value.length,el=document.getElementById('charCnt');el.textContent=n;el.className='ccnt'+(n>3000?' limit':n>2000?' warn':'');}
// ── SMOOTH AUTO-SCROLL ──
// Only scrolls if user is within 120px of bottom (respects manual scroll-up).
// During typing, uses smooth scrollTo. After typing completes, snaps to exact bottom.
// ── SMOOTH AUTO-SCROLL SYSTEM ──
// Uses linear interpolation (lerp) to smoothly chase the bottom.
// No competing smooth-scroll animations — one rAF loop, one scroll target.
let _isTyping       = false;
let _userScrolledUp = false;
let _rafId          = null;

function initScrollListener() {
  const c = document.getElementById('chatBox');
  if (!c || c._scrollListenerAdded) return;
  c._scrollListenerAdded = true;
  let lastScrollTop = c.scrollTop;
  c.addEventListener('scroll', () => {
    if (!_isTyping) return;
    // Only flag as user-scrolled if scroll moved UP
    if (c.scrollTop < lastScrollTop - 5) _userScrolledUp = true;
    // If user scrolls back near bottom, resume following
    const gap = c.scrollHeight - c.scrollTop - c.clientHeight;
    if (gap < 40) _userScrolledUp = false;
    lastScrollTop = c.scrollTop;
  }, { passive: true });
}

function scrollBot(force = false) {
  if (_isTyping) return;   // let the rAF loop handle it during typing
  const c = document.getElementById('chatBox');
  if (!c) return;
  c.scrollTop = c.scrollHeight;   // instant snap outside of typing
}

function startAutoScroll() {
  _isTyping = true;
  _userScrolledUp = false;
  initScrollListener();
  if (_rafId) cancelAnimationFrame(_rafId);

  const LERP = 0.18;   // 0–1: higher = faster catch-up, lower = more lag

  const loop = () => {
    const c = document.getElementById('chatBox');
    if (!c || !_isTyping) return;

    if (!_userScrolledUp) {
      const target = c.scrollHeight - c.clientHeight;
      const current = c.scrollTop;
      const diff = target - current;

      if (diff > 0.5) {
        // Lerp: move a fraction of the remaining distance each frame
        c.scrollTop = current + diff * LERP;
      } else {
        c.scrollTop = target;  // snap when very close
      }
    }

    _rafId = requestAnimationFrame(loop);
  };

  _rafId = requestAnimationFrame(loop);
}

function stopAutoScroll() {
  _isTyping = false;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  // Final snap to exact bottom
  const c = document.getElementById('chatBox');
  if (c) c.scrollTop = c.scrollHeight;
}

function newChat(force=false){
  if(!force&&S.msgs.length&&!confirm('Start a new session?'))return;
  saveCurrentSession();
  S.msgs=[];S.attached=[];S.currentSessionId=null;S.fileTree={};S.openFiles=[];S.activeFile=null;S.previewHtml='';S.framework=null;S._userPickedFramework=false;
  // Reset forced model — new chat gets fresh AI choice
  S.forcedModel = null;
  updateModelPickBtn(null);
  closeModelPicker();
  document.getElementById('chatBox').innerHTML=`<div class="welcome" id="ws"><div class="worb"><svg width="52" height="52" viewBox="0 0 52 52" fill="none"><defs><linearGradient id="qgw" x1="0" y1="0" x2="52" y2="52"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="52" height="52" rx="15" fill="url(#qgw)"/><text x="26" y="38" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="32" fill="white">Q</text></svg></div><div class="wtitle" style="font-size:2rem;font-weight:800;margin-bottom:6px"><span style="color:#f1f5f9">Qrox</span><span style="background:linear-gradient(90deg,#7c3aed,#4f8ef7);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AI</span></div><p class="wsub" style="font-size:.88rem;color:var(--t3);max-width:340px;line-height:1.7;margin:0 auto 24px">Your multi-model AI workspace. Connect API keys, then start building.</p><div class="ws-cta-row"><button class="ws-cta primary" onclick="wsQuickStart('build')">⚡ Start Building</button><button class="ws-cta secondary" onclick="wsQuickStart('chat')">💬 Just Chat</button><button class="ws-cta secondary" onclick="openVault('keys')">🔑 Add API Keys</button></div></div>`;
  setTimeout(wsRenderProviders, 50);
  document.getElementById('atchFiles').innerHTML='';
  document.getElementById('uIn').value='';updCC();
  renderFileTree();
  const ph=document.getElementById('prevPlaceholder');if(ph)ph.style.display='';
  const ds=document.getElementById('deviceShell');if(ds)ds.style.display='none';
  const fr=document.getElementById('prevFrame');if(fr)fr.src='about:blank';
  document.getElementById('prevUrl').value='about:blank';
  setBuildStatus('idle','Ready');
  switchMainTab('chat');
  renderHistSidebar();
  // Reset framework selector — nothing selected by default
  S.framework = null;
  S._userPickedFramework = false;
  S._frameworkLocked = false;
  document.querySelectorAll('.fw-pill,.fw-btn').forEach(b => b.classList.remove('on'));
  _applyFrameworkToRunBtns(null);
  document.getElementById('prevDot').className = '';
  showToast('New chat started','inf');
  // Reset intent detection state
  INTENT_STATE.detected = null;
  INTENT_STATE.override = null;
  const ibw = document.getElementById('intentBadgeWrap');
  if (ibw) ibw.classList.remove('show');
  // Reset context meter
  ctxReset();
}

function useSug(c){const el=document.getElementById('uIn');el.value=c.querySelector('.st').textContent+': '+c.querySelector('.sd').textContent;autoR(el);updCC();el.focus();}

