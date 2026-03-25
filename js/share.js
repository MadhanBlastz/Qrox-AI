// ════════════════════════════════════════════
//  COLLABORATION / SHARE  v5
//
//  shareChat()   — encodes current chat →
//                  base64 URL → share modal
//  sharedInit()  — called on page load, checks
//                  for #share= hash → shows
//                  read-only viewer overlay
//
//  Encoding: JSON → UTF-8 bytes →
//    btoa(unescape(encodeURIComponent(json)))
//  No server, no auth, fully client-side.
// ════════════════════════════════════════════

// ── Encoding helpers ──────────────────────────────────────────
function shareEncode(msgs) {
  // Strip image data to keep URLs short; keep text only
  const clean = msgs.map(m => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content)
        ? (m.content.find(p => p.type === 'text')?.text || '')
        : ''
  })).filter(m => m.content);

  const json = JSON.stringify({ v:1, msgs: clean });
  // btoa of URI-encoded UTF-8 handles all Unicode safely
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch(e) {
    return null;
  }
}

function shareDecode(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const obj  = JSON.parse(json);
    if (!obj?.msgs?.length) return null;
    return obj;
  } catch(e) {
    return null;
  }
}

// ── Share button flow ─────────────────────────────────────────
function shareChat() {
  if (!S.msgs.length) { showToast('Nothing to share yet', 'wrn'); return; }

  const encoded = shareEncode(S.msgs);
  if (!encoded) { showToast('Could not encode chat', 'err'); return; }

  const url = location.href.split('#')[0] + '#share=' + encoded;

  document.getElementById('shareUrlInput').value = url;

  // Stats
  const userCount = S.msgs.filter(m => m.role === 'user').length;
  const aiCount   = S.msgs.filter(m => m.role === 'assistant').length;
  const sizeKb    = Math.round(encoded.length / 1024);
  document.getElementById('shareStats').innerHTML =
    `<span>💬 ${userCount + aiCount} messages</span>` +
    `<span>👤 ${userCount} from you</span>` +
    `<span>🤖 ${aiCount} AI responses</span>` +
    `<span>📦 ~${sizeKb}KB encoded</span>`;

  // Warn if URL is very long (>8KB can break some browsers)
  const warn = document.getElementById('shareWarning');
  if (warn) warn.style.display = encoded.length > 8000 ? '' : 'none';

  document.getElementById('shareOverlay').classList.add('open');
  setTimeout(() => {
    const inp = document.getElementById('shareUrlInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 80);
}

function shareClose() {
  document.getElementById('shareOverlay').classList.remove('open');
}

async function shareCopyUrl() {
  const url = document.getElementById('shareUrlInput').value;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('shareCopyBtn');
    btn.textContent = '✅ Copied!';
    btn.classList.add('ok');
    setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('ok'); }, 2000);
    showToast('Link copied to clipboard!', 'ok');
  } catch(e) {
    showToast('Copy failed — select the URL manually', 'wrn');
  }
}

function shareOpenInTab() {
  const url = document.getElementById('shareUrlInput').value;
  if (url) window.open(url, '_blank');
}

async function shareCopyCurrentUrl() {
  try {
    await navigator.clipboard.writeText(location.href);
    showToast('Link copied!', 'ok');
  } catch(e) {
    showToast('Copy failed', 'wrn');
  }
}

// ── Shared view — shown when URL has #share= ──────────────────
function sharedInit() {
  const hash = location.hash;
  if (!hash.startsWith('#share=')) return;

  const b64  = hash.slice('#share='.length);
  const data = shareDecode(b64);
  if (!data) {
    showToast('Invalid or corrupted share link', 'err');
    return;
  }

  sharedRender(data);
}

function sharedRender(data) {
  const overlay = document.getElementById('sharedViewOverlay');
  const chatEl  = document.getElementById('sharedViewChat');
  const titleEl = document.getElementById('sharedViewTitle');
  const subEl   = document.getElementById('sharedViewSub');

  const msgs = data.msgs || [];

  // Title: first user message truncated
  const firstUser = msgs.find(m => m.role === 'user');
  titleEl.textContent = firstUser
    ? (typeof firstUser.content === 'string' ? firstUser.content.slice(0, 60) : 'Shared Chat')
    : 'Shared Chat';

  const userCount = msgs.filter(m => m.role === 'user').length;
  const aiCount   = msgs.filter(m => m.role === 'assistant').length;
  subEl.textContent = `${userCount + aiCount} messages · ${userCount} from user · ${aiCount} AI responses · read-only`;

  // Render messages
  const frag = document.createDocumentFragment();
  msgs.forEach(m => {
    const d   = document.createElement('div');
    const raw = typeof m.content === 'string' ? m.content : '';

    if (m.role === 'user') {
      d.className = 'msg user';
      d.innerHTML = `<div class="av usr"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" fill="rgba(255,255,255,.92)"/><path d="M1.5 14c0-3.314 2.686-5.5 6-5.5s6 2.186 6 5.5" stroke="rgba(255,255,255,.92)" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><div class="bbl">${esc(raw).replace(/\n/g,'<br>')}</div><div class="mmeta"><span>—</span></div></div>`;
    } else {
      d.className = 'msg ai';
      d.innerHTML = `
        <div class="av ai"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="qbga" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="20" height="20" rx="6" fill="url(#qbga)"/><g transform="translate(3,4)"><polygon points="7,1 13,4 7,7 1,4" fill="white" opacity="0.95"/><polyline points="1,7 7,10 13,7" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.8"/><polyline points="1,10 7,13 13,10" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.65"/></g></svg></div>
        <div style="flex:1;min-width:0">
          <div class="bbl" style="max-width:100%">${parseMsg(raw)}</div>
          <div class="mmeta">
            <span>—</span>
            <span class="shared-ro-badge">READ-ONLY</span>
            <button class="mact" onclick="this.closest('.msg').querySelector('.bbl')&&navigator.clipboard.writeText(this.closest('.msg').querySelector('.bbl').innerText).then(()=>showToast('Copied','ok'))">📋 Copy</button>
          </div>
        </div>`;
      // Lazy-highlight code blocks
      d.querySelectorAll('pre code').forEach(b => _perfObserve(b));
    }
    frag.appendChild(d);
  });

  chatEl.innerHTML = '';
  chatEl.appendChild(frag);
  overlay.style.display = 'flex';

  // Scroll to bottom after render
  requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
}

function sharedClose() {
  document.getElementById('sharedViewOverlay').style.display = 'none';
  // Remove the hash from URL without reloading
  history.replaceState(null, '', location.pathname + location.search);
}

function sharedImport() {
  const hash = location.hash;
  if (!hash.startsWith('#share=')) return;
  const data = shareDecode(hash.slice('#share='.length));
  if (!data) return;

  // Create a new session from the shared data
  const id      = 's_shared_' + Date.now();
  const firstMsg = data.msgs.find(m => m.role === 'user');
  const title    = firstMsg
    ? (typeof firstMsg.content === 'string' ? firstMsg.content.slice(0, 52) : 'Imported chat')
    : 'Imported chat';

  const session = {
    id,
    title,
    ts:       Date.now(),
    msgs:     data.msgs,
    tree:     {},
    framework:null,
    msgCount: data.msgs.length,
  };

  S.sessions.unshift(session);
  try { localStorage.setItem(LS_SESSIONS, JSON.stringify(S.sessions)); } catch(e) {}

  sharedClose();
  loadSession(id);
  showToast('✅ Chat imported to your history!', 'ok');
}

// Show share button whenever there are messages
function _shareUpdateBtn() {
  const btn = document.getElementById('shareBtn');
  if (btn) btn.style.display = S.msgs.length ? '' : 'none';
}

// ── BOOT
// ════════════════════════════════════════════
