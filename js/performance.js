// ════════════════════════════════════════════
//  PERFORMANCE ENGINE  v5
//
//  perfRenderSession(msgs)
//  ─────────────────────────────────────────
//  Instead of rendering ALL messages at once
//  (which blocks the main thread for long
//  sessions), we:
//
//  1. Show the last PERF_WINDOW messages
//     immediately (visible viewport).
//  2. If there are older messages, show a
//     "Load earlier (N)" button at the top.
//  3. Clicking it renders the previous batch
//     synchronously with scroll-anchor so the
//     user's position is preserved.
//  4. All code blocks use IntersectionObserver
//     for lazy Prism highlighting — only when
//     they scroll into view.
//  5. A lightweight debounced DOM-cap runs
//     every time a new live message is appended
//     (PERF_CAP), pruning the oldest nodes to
//     keep the DOM lean during very long chats.
// ════════════════════════════════════════════

const PERF_WINDOW = 30;   // messages shown on initial session load
const PERF_BATCH  = 20;   // messages loaded per "Load earlier" click
const PERF_CAP    = 120;  // max live DOM messages before pruning oldest

// Pending messages not yet rendered (older than current window)
let _perfPending  = [];
let _perfObserver = null;  // IntersectionObserver for lazy Prism

function _perfMsgToNode(m) {
  const d = document.createElement('div');
  if (m.role === 'user') {
    d.className = 'msg user';
    let txt = '', files = [];
    if (Array.isArray(m.content)) {
      txt = m.content.find(p => p.type === 'text')?.text || '';
      const imgs = m.content.filter(p => p.type === 'image_url').length;
      if (imgs) files = [{ name: `${imgs} image${imgs > 1 ? 's' : ''}` }];
    } else {
      txt = m.content || '';
    }
    const fh = files.length ? `<div class="fchips">${files.map(f=>`<div class="fchip">📎 ${esc(f.name)}</div>`).join('')}</div>` : '';
    d.innerHTML = `<div class="av usr"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" fill="rgba(255,255,255,.92)"/><path d="M1.5 14c0-3.314 2.686-5.5 6-5.5s6 2.186 6 5.5" stroke="rgba(255,255,255,.92)" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><div class="bbl">${fh}${esc(txt).replace(/\n/g,'<br>')}</div><div class="mmeta"><span>—</span></div></div>`;
  } else {
    d.className = 'msg ai';
    const raw  = typeof m.content === 'string' ? m.content : '';
    const html = parseMsg(raw);
    d.innerHTML = `
      <div class="av ai"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="qbga" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="20" height="20" rx="6" fill="url(#qbga)"/><g transform="translate(3,4)"><polygon points="7,1 13,4 7,7 1,4" fill="white" opacity="0.95"/><polyline points="1,7 7,10 13,7" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.8"/><polyline points="1,10 7,13 13,10" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.65"/></g></svg></div>
      <div style="flex:1;min-width:0">
        <div class="bbl" style="max-width:100%">${html}</div>
        <div class="mmeta">
          <span>—</span>
          <span class="umtag" style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.2);color:#a5b4fc">🕐 history</span>
          <button class="mact" onclick="cpyBbl(this)">📋 Copy</button>
          <button class="mact" onclick="dlMsg(this)">⬇ Save</button>
        </div>
      </div>`;
    // Register all <pre><code> blocks for lazy highlighting
    d.querySelectorAll('pre code').forEach(block => _perfObserve(block));
  }
  return d;
}

// Register a code block for lazy Prism highlighting via IntersectionObserver
function _perfObserve(codeEl) {
  if (!codeEl || codeEl._prismDone) return;
  if (!_perfObserver) {
    _perfObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el._prismDone) return;
        el._prismDone = true;
        _perfObserver.unobserve(el);
        requestAnimationFrame(() => {
          if (window.Prism) Prism.highlightElement(el);
        });
      });
    }, { rootMargin: '200px' }); // highlight when within 200px of viewport
  }
  _perfObserver.observe(codeEl);
}

function perfRenderSession(msgs) {
  const t0  = performance.now();
  const box = document.getElementById('chatBox');
  const ws  = document.getElementById('ws');
  if (ws) ws.remove();
  box.innerHTML = '';
  _perfPending  = [];

  const total = msgs.length;
  if (!total) return;

  // Split: older messages go to pending, recent ones render now
  const renderFrom = Math.max(0, total - PERF_WINDOW);
  const recent     = msgs.slice(renderFrom);
  _perfPending     = msgs.slice(0, renderFrom);

  // If there are older messages, prepend a "Load earlier" button
  if (_perfPending.length) {
    _perfInsertLoadBtn(box);
  }

  // Render recent batch using DocumentFragment (single reflow)
  const frag = document.createDocumentFragment();
  recent.forEach(m => frag.appendChild(_perfMsgToNode(m)));
  box.appendChild(frag);

  // Scroll to bottom
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });

  const ms = Math.round(performance.now() - t0);
  if (total > PERF_WINDOW) {
    showToast(`⚡ Loaded ${recent.length} of ${total} messages in ${ms}ms`, 'inf');
  }
}

function _perfInsertLoadBtn(box) {
  const existing = box.querySelector('.load-earlier-btn');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.className   = 'load-earlier-btn';
  btn.id          = 'loadEarlierBtn';
  btn.innerHTML   = `⬆ Load ${Math.min(_perfPending.length, PERF_BATCH)} earlier messages <span style="color:var(--t4)">(${_perfPending.length} remaining)</span>`;
  btn.onclick     = perfLoadEarlier;
  box.insertBefore(btn, box.firstChild);
}

function perfLoadEarlier() {
  const box = document.getElementById('chatBox');
  if (!box || !_perfPending.length) return;

  // Capture scroll anchor — distance from top of first visible message
  const anchor      = box.children[1]; // [0] = button itself
  const anchorTop   = anchor ? anchor.getBoundingClientRect().top : 0;

  const batch = _perfPending.splice(-PERF_BATCH); // take from end (most recent of the older msgs)
  const frag  = document.createDocumentFragment();
  batch.forEach(m => frag.appendChild(_perfMsgToNode(m)));

  // Remove old button, insert batch, re-insert button if still pending
  const oldBtn = document.getElementById('loadEarlierBtn');
  if (oldBtn) oldBtn.remove();

  // Insert before current first child
  box.insertBefore(frag, box.firstChild);

  // Restore scroll position so the user doesn't jump
  if (anchor && anchor.isConnected) {
    const newTop = anchor.getBoundingClientRect().top;
    box.scrollTop += newTop - anchorTop;
  }

  if (_perfPending.length) _perfInsertLoadBtn(box);
  else showToast('All messages loaded', 'inf');
}

// ── Live DOM cap — prune oldest messages during active chat ────
// Called after every new message is appended in a live session.
// Keeps the DOM under PERF_CAP nodes so very long chats stay smooth.
let _perfCapDebounce = null;
function perfCapDOM() {
  if (_perfCapDebounce) return;
  _perfCapDebounce = setTimeout(() => {
    _perfCapDebounce = null;
    const box = document.getElementById('chatBox');
    if (!box) return;
    const msgs = box.querySelectorAll('.msg');
    if (msgs.length <= PERF_CAP) return;
    const excess = msgs.length - PERF_CAP;
    // Remove oldest (first) messages
    for (let i = 0; i < excess; i++) {
      if (msgs[i]) msgs[i].remove();
    }
    // Show a "Load earlier" button if not already present
    if (!box.querySelector('.load-earlier-btn') && S.msgs.length > PERF_CAP) {
      _perfPending = S.msgs.slice(0, S.msgs.length - PERF_CAP);
      _perfInsertLoadBtn(box);
    }
  }, 400);
}

