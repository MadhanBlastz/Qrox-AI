// ════════════════════════════════════════════
//  LIVE COLLABORATION  v5
//
//  Real-time session sharing between browser
//  tabs via BroadcastChannel (instant) +
//  localStorage polling (cross-tab fallback).
//
//  Protocol: collab namespace = 'eai_collab_<sessionId>'
//  Messages: {type, peerId, payload, ts}
//
//  Types:
//    'join'      — peer joined
//    'leave'     — peer left
//    'ping'      — heartbeat (every 3s)
//    'msg'       — new chat message
//    'typing'    — peer is typing
//    'stopped'   — peer stopped typing
//    'msgs_sync' — full messages array sync
//    'title'     — session title updated
//
//  URL: #collab=<sessionId>
//  Start: collabStart() — creates session ID
//  Join:  collabJoin(id) — detected on load
// ════════════════════════════════════════════

const COLLAB = {
  active:    false,
  sessionId: null,
  peerId:    null,    // this tab's unique ID
  peerName:  null,
  peers:     {},      // peerId → {name, lastSeen, typing}
  channel:   null,    // BroadcastChannel
  pollTimer: null,    // localStorage polling interval
  pingTimer: null,    // heartbeat interval
  typingTimer:null,   // typing indicator timeout
  isTyping:  false,
  msgCount:  0,       // track new messages from others
  LS_PREFIX: 'eai_collab_',
};

// Adjective+Animal peer names for anonymous collaboration
const COLLAB_NAMES = [
  'Blue Fox','Red Panda','Swift Hawk','Green Lynx','Purple Wolf',
  'Golden Bear','Silver Owl','Cosmic Deer','Neon Tiger','Bright Crane',
];

function _collabMyName() {
  return COLLAB_NAMES[Math.floor(Math.random() * COLLAB_NAMES.length)];
}

// ── Start / Stop ──────────────────────────────────────────────
function collabStart() {
  if (COLLAB.active) { collabOpen(); return; }

  // Generate session ID and peer ID
  COLLAB.sessionId = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  COLLAB.peerId    = 'p_' + Math.random().toString(36).slice(2,10);
  COLLAB.peerName  = _collabMyName();

  _collabConnect();
  collabOpen();
  showToast('🤝 Live session started — share the link!', 'ok');
}

function collabStop() {
  if (!COLLAB.active) return;
  _collabBroadcast({ type: 'leave', peerId: COLLAB.peerId, peerName: COLLAB.peerName });
  _collabDisconnect();
  // Remove from URL
  history.replaceState(null, '', location.href.split('#')[0]);
  showToast('Live session ended', 'inf');
  collabClose();
}

function _collabConnect() {
  COLLAB.active = true;

  // BroadcastChannel for same-browser instant sync
  try {
    COLLAB.channel = new BroadcastChannel('eai_collab_' + COLLAB.sessionId);
    COLLAB.channel.onmessage = (e) => _collabHandleMsg(e.data);
  } catch(e) { COLLAB.channel = null; }

  // Update URL hash
  history.replaceState(null, '', location.href.split('#')[0] + '#collab=' + COLLAB.sessionId);

  // Heartbeat every 3s
  COLLAB.pingTimer = setInterval(() => {
    _collabBroadcast({ type: 'ping', peerId: COLLAB.peerId, peerName: COLLAB.peerName, msgCount: S.msgs.length });
    _collabPruneStalePeers();
    _collabRenderPeers();
  }, 3000);

  // localStorage polling for cross-tab detection (100ms)
  COLLAB.pollTimer = setInterval(() => _collabPoll(), 100);

  // Announce join
  _collabBroadcast({ type: 'join', peerId: COLLAB.peerId, peerName: COLLAB.peerName, msgCount: S.msgs.length });

  // Update UI
  _collabUpdateUI();

  // Update link input
  const link = location.href.split('#')[0] + '#collab=' + COLLAB.sessionId;
  const inp  = document.getElementById('collabLinkInput');
  if (inp) inp.value = link;
}

function _collabDisconnect() {
  COLLAB.active = false;
  clearInterval(COLLAB.pingTimer);
  clearInterval(COLLAB.pollTimer);
  clearTimeout(COLLAB.typingTimer);
  COLLAB.channel?.close();
  COLLAB.channel = null;
  COLLAB.peers   = {};
  // Clean up localStorage
  try { localStorage.removeItem(COLLAB.LS_PREFIX + COLLAB.sessionId); } catch(e) {}
  _collabUpdateUI();
}

// ── Broadcast ──────────────────────────────────────────────────
function _collabBroadcast(data) {
  const msg = { ...data, ts: Date.now() };

  // BroadcastChannel (same browser, different tabs)
  COLLAB.channel?.postMessage(msg);

  // localStorage relay for cross-tab visibility
  try {
    const key = COLLAB.LS_PREFIX + COLLAB.sessionId;
    const existing = JSON.parse(localStorage.getItem(key) || '{"msgs":[]}');
    existing.msgs = (existing.msgs || []).slice(-20); // keep last 20 events
    existing.msgs.push(msg);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch(e) {}
}

// ── Poll localStorage for messages from other tabs ─────────────
let _collabLastPoll = Date.now();
function _collabPoll() {
  if (!COLLAB.active) return;
  try {
    const key  = COLLAB.LS_PREFIX + COLLAB.sessionId;
    const data = JSON.parse(localStorage.getItem(key) || '{"msgs":[]}');
    (data.msgs || []).forEach(msg => {
      if (msg.ts > _collabLastPoll && msg.peerId !== COLLAB.peerId) {
        _collabHandleMsg(msg);
      }
    });
    _collabLastPoll = Date.now();
  } catch(e) {}
}

// ── Message handler ────────────────────────────────────────────
function _collabHandleMsg(msg) {
  if (!msg || msg.peerId === COLLAB.peerId) return;

  switch(msg.type) {
    case 'join':
      COLLAB.peers[msg.peerId] = { name: msg.peerName, lastSeen: Date.now(), typing: false };
      _collabRenderPeers();
      showToast(`🤝 ${msg.peerName} joined the session`, 'ok');
      // Send them our current messages
      setTimeout(() => _collabBroadcast({
        type: 'msgs_sync',
        peerId: COLLAB.peerId,
        peerName: COLLAB.peerName,
        msgs: stripImagesForSave(S.msgs).slice(-30), // last 30 msgs
      }), 300);
      break;

    case 'leave':
      delete COLLAB.peers[msg.peerId];
      _collabRenderPeers();
      showToast(`${msg.peerName} left the session`, 'inf');
      break;

    case 'ping':
      if (!COLLAB.peers[msg.peerId]) {
        COLLAB.peers[msg.peerId] = { name: msg.peerName, lastSeen: Date.now(), typing: false };
        showToast(`🤝 ${msg.peerName} is in this session`, 'inf');
      } else {
        COLLAB.peers[msg.peerId].lastSeen = Date.now();
        COLLAB.peers[msg.peerId].name = msg.peerName;
      }
      _collabRenderPeers();
      break;

    case 'typing':
      if (COLLAB.peers[msg.peerId]) COLLAB.peers[msg.peerId].typing = true;
      _collabShowTypingBanner(msg.peerName);
      break;

    case 'stopped':
      if (COLLAB.peers[msg.peerId]) COLLAB.peers[msg.peerId].typing = false;
      _collabHideTypingBanner();
      break;

    case 'msg': {
      // New message from peer — render it
      if (!msg.message) break;
      const msgObj = msg.message;
      // Check if we already have this message (avoid duplicates)
      const lastMsg = S.msgs[S.msgs.length - 1];
      const isDup = lastMsg && lastMsg.content === msgObj.content && lastMsg.role === msgObj.role;
      if (isDup) break;
      S.msgs.push(msgObj);
      if (msgObj.role === 'user') {
        _collabRenderRemoteUser(msgObj, msg.peerName);
      } else {
        _collabRenderRemoteAI(msgObj, msg.peerName);
      }
      saveCurrentSession();
      break;
    }

    case 'msgs_sync': {
      // Full sync from a peer — merge missing messages
      if (!Array.isArray(msg.msgs)) break;
      let added = 0;
      msg.msgs.forEach(m => {
        const exists = S.msgs.some(existing =>
          existing.role === m.role &&
          (typeof existing.content === 'string' ? existing.content : '').slice(0,50) ===
          (typeof m.content === 'string' ? m.content : '').slice(0,50)
        );
        if (!exists) { S.msgs.push(m); added++; }
      });
      if (added > 0) {
        saveCurrentSession();
        showToast(`↓ Synced ${added} message${added!==1?'s':''} from ${msg.peerName}`, 'inf');
      }
      break;
    }

    case 'title':
      if (msg.title) {
        const sess = S.sessions.find(s => s.id === S.currentSessionId);
        if (sess && !sess.aiTitled) {
          sess.title = msg.title;
          renderHistSidebar();
        }
      }
      break;
  }
}

// ── Prune stale peers (no ping for 10s) ──────────────────────
function _collabPruneStalePeers() {
  const now   = Date.now();
  const stale = Object.keys(COLLAB.peers).filter(id => now - COLLAB.peers[id].lastSeen > 10000);
  stale.forEach(id => {
    const name = COLLAB.peers[id].name;
    delete COLLAB.peers[id];
    showToast(`${name} disconnected`, 'inf');
  });
}

// ── Typing indicator ──────────────────────────────────────────
function collabOnTyping(text) {
  if (!COLLAB.active) return;
  if (text.length > 0 && !COLLAB.isTyping) {
    COLLAB.isTyping = true;
    _collabBroadcast({ type: 'typing', peerId: COLLAB.peerId, peerName: COLLAB.peerName });
  }
  clearTimeout(COLLAB.typingTimer);
  COLLAB.typingTimer = setTimeout(() => {
    COLLAB.isTyping = false;
    _collabBroadcast({ type: 'stopped', peerId: COLLAB.peerId, peerName: COLLAB.peerName });
  }, 1500);
}

function _collabShowTypingBanner(peerName) {
  const banner = document.getElementById('collabTypingBanner');
  const text   = document.getElementById('collabTypingText');
  if (banner) { banner.classList.add('show'); }
  if (text)   { text.textContent = `${peerName} is typing…`; }
  clearTimeout(COLLAB._typingHideTimer);
  COLLAB._typingHideTimer = setTimeout(_collabHideTypingBanner, 3000);
}

function _collabHideTypingBanner() {
  document.getElementById('collabTypingBanner')?.classList.remove('show');
}

// ── Broadcast new messages to peers ──────────────────────────
function collabBroadcastMsg(msgObj) {
  if (!COLLAB.active) return;
  _collabBroadcast({ type: 'msg', peerId: COLLAB.peerId, peerName: COLLAB.peerName, message: msgObj });
}

// ── Render remote messages ────────────────────────────────────
function _collabRenderRemoteUser(msgObj, peerName) {
  const box = document.getElementById('chatBox');
  const d   = document.createElement('div');
  d.className = 'msg user remote-msg';
  const text = typeof msgObj.content === 'string' ? msgObj.content : '';
  d.innerHTML = `<div class="av usr" style="background:linear-gradient(135deg,#6366f1,#a78bfa)">P</div>
    <div style="flex:1;min-width:0">
      <div class="bbl">${esc(text).replace(/\n/g,'<br>')}</div>
      <div class="mmeta">
        <span>${peerName}<span class="collab-remote-badge">remote</span></span>
        <span>${gT()}</span>
      </div>
    </div>`;
  box.appendChild(d);
  scrollBot();
}

function _collabRenderRemoteAI(msgObj, peerName) {
  const box = document.getElementById('chatBox');
  const d   = document.createElement('div');
  d.className = 'msg ai remote-msg';
  const text = typeof msgObj.content === 'string' ? msgObj.content
    : msgObj.content?.find?.(p=>p.type==='text')?.text || '';
  d.innerHTML = `<div class="av ai"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="qbga" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="20" height="20" rx="6" fill="url(#qbga)"/><g transform="translate(3,4)"><polygon points="7,1 13,4 7,7 1,4" fill="white" opacity="0.95"/><polyline points="1,7 7,10 13,7" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.8"/><polyline points="1,10 7,13 13,10" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.65"/></g></svg></div>
    <div style="flex:1;min-width:0">
      <div class="bbl">${parseMsg(text)}</div>
      <div class="mmeta">
        <span>${gT()}</span>
        <span class="collab-remote-badge">via ${peerName}</span>
      </div>
    </div>`;
  box.appendChild(d);
  hlCode(d.querySelector('.bbl'));
  scrollBot();
}

// ── UI updates ────────────────────────────────────────────────
function _collabUpdateUI() {
  const pill    = document.getElementById('collabPill');
  const footBadge = document.getElementById('collabFooterBadge');
  const footText  = document.getElementById('collabFooterText');
  const startBtn  = document.getElementById('collabStartBtn');

  if (COLLAB.active) {
    const peerCount = Object.keys(COLLAB.peers).length + 1; // include self
    pill?.classList.add('show');
    document.getElementById('collabPillCount').textContent = peerCount;
    footBadge?.classList.add('show');
    if (footText) footText.textContent = `Live · ${peerCount}`;
    if (startBtn) { startBtn.textContent = '🤝 Live ●'; startBtn.classList.add('on'); }
  } else {
    pill?.classList.remove('show');
    footBadge?.classList.remove('show');
    if (startBtn) { startBtn.textContent = '🤝 Live'; startBtn.classList.remove('on'); }
  }
}

function _collabRenderPeers() {
  _collabUpdateUI();
  const list = document.getElementById('collabPeersList');
  if (!list) return;
  const peers = Object.entries(COLLAB.peers);
  if (!peers.length) {
    list.innerHTML = '<div style="font-size:.68rem;color:var(--t4);font-family:var(--fc);padding:6px 0">No other peers yet — share the link above</div>';
    return;
  }
  const colors = ['#6ee7b7','#93c5fd','#c4b5fd','#fde68a','#fca5a5','#6ee7b7'];
  list.innerHTML = [
    // Self
    `<div class="collab-peer-item">
      <div class="collab-peer-dot" style="background:#6ee7b7;box-shadow:0 0 5px #6ee7b7"></div>
      <span class="collab-peer-name">You (${COLLAB.peerName})</span>
      <span class="collab-peer-status">host</span>
    </div>`,
    ...peers.map(([id, peer], i) => `<div class="collab-peer-item">
      <div class="collab-peer-dot" style="background:${colors[i%colors.length]};box-shadow:0 0 5px ${colors[i%colors.length]}"></div>
      <span class="collab-peer-name">${esc(peer.name)}</span>
      ${peer.typing ? '<span class="collab-peer-typing">typing…</span>' : '<span class="collab-peer-status">active</span>'}
    </div>`)
  ].join('');
}

// ── Open / close modal ────────────────────────────────────────
function collabOpen() {
  if (!COLLAB.active) { collabStart(); return; }
  _collabRenderPeers();
  const link = location.href.split('#')[0] + '#collab=' + COLLAB.sessionId;
  const inp  = document.getElementById('collabLinkInput');
  if (inp) inp.value = link;
  document.getElementById('collabOverlay').classList.add('open');
}

function collabClose() {
  document.getElementById('collabOverlay').classList.remove('open');
}

async function collabCopyLink() {
  const link = document.getElementById('collabLinkInput').value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    const btn = document.getElementById('collabCopyBtn');
    btn.textContent = '✅ Copied!'; btn.classList.add('ok');
    setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('ok'); }, 2000);
    showToast('Collab link copied!', 'ok');
  } catch(e) {
    showToast('Copy failed — select the URL manually', 'wrn');
  }
}

// ── Auto-join from URL hash ───────────────────────────────────
function collabInitFromURL() {
  const hash = location.hash;
  if (!hash.startsWith('#collab=')) return;
  const sessionId = hash.slice('#collab='.length);
  if (!sessionId || sessionId.length < 5) return;

  // Join this session
  COLLAB.sessionId = sessionId;
  COLLAB.peerId    = 'p_' + Math.random().toString(36).slice(2,10);
  COLLAB.peerName  = _collabMyName();
  _collabConnect();
  showToast(`🤝 Joined live session as ${COLLAB.peerName}`, 'ok');
}

