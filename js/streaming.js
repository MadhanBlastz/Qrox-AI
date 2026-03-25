//  LIVE CODE DIFF STREAMING  v5
//
//  Watches the streaming token buffer for
//  code fences (```lang:path/file.ext).
//  When a fenced code block opens for a file
//  that already exists in S.fileTree, renders
//  a live diff panel alongside the bubble.
//
//  As tokens arrive:
//    • New lines flash green (add)
//    • Removed lines flash red (del)
//    • Unchanged lines dim (ctx)
//
//  When streaming ends:
//    • Diff freezes + shows ✓ accept / ✕ reject
//    • Accept writes new content to S.fileTree
//    • Reject discards the new content
//
//  LCD = Live Code Diff
// ════════════════════════════════════════════

const LCD = {
  active:     false,
  path:       null,    // file path being diffed
  oldLines:   [],      // previous file lines
  newLines:   [],      // lines parsed so far from stream
  panelEl:    null,    // .lcd-wrap DOM element
  bodyEl:     null,    // .lcd-body DOM element
  statsEl:    null,    // stats span
  badgeEl:    null,    // LIVE/DONE badge
  lastLineCount: 0,    // to detect new lines added
  rafId:      null,
  isNewFile:  false,   // true = no old version exists
};

// ── Myers diff — shared with diffLines but standalone here ──
function _lcdDiff(aLines, bLines) {
  const N = aLines.length, M = bLines.length;
  if (N === 0) return bLines.map(l => ({ type:'add', line:l }));
  if (M === 0) return aLines.map(l => ({ type:'del', line:l }));

  const MAX = N + M;
  const V   = new Array(2 * MAX + 2).fill(0);
  const trace = [];

  outer: for (let d = 0; d <= MAX; d++) {
    trace.push(V.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && V[k - 1 + MAX] < V[k + 1 + MAX])) {
        x = V[k + 1 + MAX];
      } else {
        x = V[k - 1 + MAX] + 1;
      }
      let y = x - k;
      while (x < N && y < M && aLines[x] === bLines[y]) { x++; y++; }
      V[k + MAX] = x;
      if (x >= N && y >= M) break outer;
    }
  }

  // Backtrack
  const ops = [];
  let x = N, y = M;
  for (let d = trace.length - 1; d >= 0; d--) {
    const Vd = trace[d];
    const k  = x - y;
    let prevK;
    if (k === -d || (k !== d && Vd[k - 1 + MAX] < Vd[k + 1 + MAX])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = Vd[prevK + MAX];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { x--; y--; ops.unshift({ type:'eq',  line:aLines[x] }); }
    if      (x > prevX) { x--; ops.unshift({ type:'del', line:aLines[x] }); }
    else if (y > prevY) { y--; ops.unshift({ type:'add', line:bLines[y] }); }
  }
  return ops;
}

// Group diff ops into hunks (±3 ctx lines around changes)
function _lcdHunks(ops, ctx = 3) {
  const hunks = [];
  let cur = null;
  const changed = new Set();
  ops.forEach((op, i) => { if (op.type !== 'eq') changed.add(i); });

  ops.forEach((op, i) => {
    const near = [...changed].some(ci => Math.abs(ci - i) <= ctx);
    if (!near) { if (cur) { hunks.push(cur); cur = null; } return; }
    if (!cur) cur = [];
    cur.push({ ...op, i });
  });
  if (cur) hunks.push(cur);
  return hunks;
}

// ── Render / update the diff panel ──────────────────────────
function lcdStart(path, oldContent, bubbleEl) {
  LCD.active      = true;
  LCD.path        = path;
  LCD.oldLines    = oldContent ? oldContent.split('\n') : [];
  LCD.newLines    = [];
  LCD.lastLineCount = 0;
  LCD.isNewFile   = !oldContent;

  // Create panel element
  const wrap = document.createElement('div');
  wrap.className = 'lcd-wrap';
  wrap.id = 'lcdPanel';

  const isNew = LCD.isNewFile;
  wrap.innerHTML = `
    <div class="lcd-hdr">
      <span class="lcd-hdr-path">${esc(path)}</span>
      <span class="lcd-hdr-badge live" id="lcdBadge">${isNew ? '✦ NEW' : '● LIVE'}</span>
      <span class="lcd-hdr-stats" id="lcdStats">${isNew ? 'streaming…' : 'computing diff…'}</span>
    </div>
    <div class="lcd-body" id="lcdBody">
      ${isNew ? '<div class="lcd-new-file">New file — streaming content…<span class="lcd-cursor"></span></div>' : ''}
    </div>`;

  // Insert after bubble
  bubbleEl?.parentElement?.after(wrap);
  LCD.panelEl = wrap;
  LCD.bodyEl  = wrap.querySelector('#lcdBody');
  LCD.statsEl = wrap.querySelector('#lcdStats');
  LCD.badgeEl = wrap.querySelector('#lcdBadge');
}

function lcdUpdate(partialCode) {
  if (!LCD.active || !LCD.bodyEl) return;
  if (LCD.rafId) return; // don't stack rAF calls
  LCD.rafId = requestAnimationFrame(() => {
    LCD.rafId = null;
    _lcdRender(partialCode);
  });
}

function _lcdRender(partialCode) {
  if (!LCD.bodyEl) return;
  const newLines = partialCode.split('\n');
  LCD.newLines   = newLines;

  if (LCD.isNewFile) {
    // Just show line count
    if (LCD.statsEl) LCD.statsEl.textContent = `${newLines.length} lines streaming…`;
    return;
  }

  const ops   = _lcdDiff(LCD.oldLines, newLines);
  const hunks = _lcdHunks(ops, 3);

  const adds = ops.filter(o => o.type === 'add').length;
  const dels = ops.filter(o => o.type === 'del').length;
  if (LCD.statsEl) LCD.statsEl.textContent = `+${adds} −${dels}`;

  const newLineCount = newLines.length;
  const prevCount    = LCD.lastLineCount;
  LCD.lastLineCount  = newLineCount;

  // Build HTML
  let html = '';
  if (!hunks.length) {
    html = '<div class="lcd-line ctx"><span class="lcd-gutter">~</span><span class="lcd-text" style="color:var(--t4);font-style:italic">No changes yet…</span></div>';
  } else {
    let addN = 0, delN = 0;
    hunks.forEach((hunk, hi) => {
      // Hunk header
      const firstAdd = hunk.find(o => o.type === 'add');
      const firstDel = hunk.find(o => o.type === 'del');
      html += `<div class="lcd-line hunk-hdr"><span class="lcd-gutter">#${hi+1}</span><span class="lcd-text">@@ hunk ${hi+1} @@</span></div>`;
      hunk.forEach(op => {
        const isNew = op.type === 'add' && op.i >= prevCount; // newly arrived line
        const flashCls = isNew ? ' flash' : '';
        if (op.type === 'add') {
          html += `<div class="lcd-line add${flashCls}"><span class="lcd-gutter">+</span><span class="lcd-text">${esc(op.line)}</span></div>`;
          addN++;
        } else if (op.type === 'del') {
          html += `<div class="lcd-line del"><span class="lcd-gutter">−</span><span class="lcd-text">${esc(op.line)}</span></div>`;
          delN++;
        } else {
          html += `<div class="lcd-line ctx"><span class="lcd-gutter"> </span><span class="lcd-text">${esc(op.line)}</span></div>`;
        }
      });
    });
  }

  LCD.bodyEl.innerHTML = html;
  // Auto-scroll diff panel to bottom while streaming
  LCD.bodyEl.scrollTop = LCD.bodyEl.scrollHeight;
}

function lcdFinish(finalCode) {
  if (!LCD.active) return;
  LCD.active = false;
  if (LCD.rafId) { cancelAnimationFrame(LCD.rafId); LCD.rafId = null; }

  const finalLines = finalCode.split('\n');
  LCD.newLines = finalLines;

  // Final render
  if (!LCD.isNewFile) _lcdRender(finalCode);

  // Update badge to DONE
  if (LCD.badgeEl) {
    LCD.badgeEl.className = 'lcd-hdr-badge done';
    LCD.badgeEl.textContent = '✓ DONE';
  }

  // Add accept/reject controls to header
  const hdr = LCD.panelEl?.querySelector('.lcd-hdr');
  if (hdr) {
    const ops   = _lcdDiff(LCD.oldLines, finalLines);
    const adds  = ops.filter(o => o.type === 'add').length;
    const dels  = ops.filter(o => o.type === 'del').length;
    if (LCD.statsEl) LCD.statsEl.textContent = `+${adds} −${dels}`;

    if (!LCD.isNewFile) {
      const acts = document.createElement('div');
      acts.className = 'lcd-hdr-actions';
      acts.innerHTML = `
        <button class="lcd-action-btn accept" onclick="lcdAccept()" title="Accept changes">✓ Accept</button>
        <button class="lcd-action-btn reject" onclick="lcdReject()" title="Reject changes">✕ Reject</button>`;
      hdr.appendChild(acts);
    } else {
      if (LCD.statsEl) LCD.statsEl.textContent = `${finalLines.length} lines · new file`;
    }
  }

  // For new files, show the final content as all-add lines
  if (LCD.isNewFile && LCD.bodyEl) {
    let html = '';
    finalLines.forEach(line => {
      html += `<div class="lcd-line add"><span class="lcd-gutter">+</span><span class="lcd-text">${esc(line)}</span></div>`;
    });
    LCD.bodyEl.innerHTML = html;
  }
}

function lcdAccept() {
  if (!LCD.path || !LCD.newLines.length) return;
  const content = LCD.newLines.join('\n');
  S.fileTree[LCD.path] = { ...S.fileTree[LCD.path], name: LCD.path.split('/').pop(), content, type:'file' };
  renderFileTree();
  _lcdDismiss('✓ Changes accepted');
  showToast(`✓ ${LCD.path} updated`, 'ok');
}

function lcdReject() {
  _lcdDismiss('✕ Changes rejected');
  showToast(`✕ Changes to ${LCD.path} rejected`, 'inf');
}

function _lcdDismiss(msg) {
  if (LCD.panelEl) {
    LCD.panelEl.style.opacity = '0';
    LCD.panelEl.style.transition = 'opacity .3s';
    setTimeout(() => LCD.panelEl?.remove(), 300);
  }
  LCD.panelEl = null;
  LCD.bodyEl  = null;
  LCD.path    = null;
}

// ── Hook into _streamFlush to detect code blocks ─────────────
// We patch _streamFlush to intercept the raw text and detect
// when a code fence with a known file extension is being written.
const _origStreamFlush = _streamFlush;

// State for live diff detection
const LCD_DETECT = {
  inFence:    false,
  fenceLang:  '',
  fencePath:  '',
  fenceCode:  '',
  startedDiff:false,
};

function _streamFlush() {
  _origStreamFlush();  // run original renderer

  // Parse the accumulated raw stream for code fences
  const raw   = STREAM.raw;
  const lines = raw.split('\n');

  // Scan for an open code fence with a file path
  let inFence = false, fencePath = '', fenceCode = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inFence) {
      // Match ```lang:path/file.ext  or  ```lang filename.ext
      const m = line.match(/^```(?:\w+:)?(.+\.\w+)\s*$/);
      if (m) {
        inFence    = true;
        fencePath  = m[1].trim();
        fenceCode  = '';
        continue;
      }
    } else {
      if (line.startsWith('```')) {
        // Fence closed
        inFence = false;
        if (LCD_DETECT.startedDiff && LCD.active) {
          // Fence just closed — finalise
          lcdFinish(fenceCode);
          LCD_DETECT.startedDiff = false;
        }
        fencePath = ''; fenceCode = '';
        continue;
      }
      fenceCode += (fenceCode ? '\n' : '') + line;
    }
  }

  // If we're currently inside an open fence for a known file
  if (inFence && fencePath) {
    if (!LCD_DETECT.startedDiff) {
      // First time seeing this fence — check if file already exists
      const oldContent = S.fileTree[fencePath]?.content || null;
      LCD_DETECT.startedDiff = true;
      // Start the diff panel, inserting after the current bubble
      lcdStart(fencePath, oldContent, STREAM.bblEl);
    }
    // Update diff with code seen so far
    if (LCD.active && fenceCode) {
      lcdUpdate(fenceCode);
    }
  }
}

// Reset LCD state on each new send
const _origStreamStart = streamStart;
function streamStart(bblEl, tickerEl, speedEl) {
  _origStreamStart(bblEl, tickerEl, speedEl);
  // Reset diff state
  LCD.active = false;
  LCD_DETECT.inFence    = false;
  LCD_DETECT.fencePath  = '';
  LCD_DETECT.fenceCode  = '';
  LCD_DETECT.startedDiff= false;
  document.getElementById('lcdPanel')?.remove();
}

// ════════════════════════════════════════════
//  STREAMING LIVE RENDERER
// ════════════════════════════════════════════
// Incrementally appends raw markdown text tokens into a chat bubble in real time.
// Keeps a running "accumulated" string and re-parses it on each chunk so markdown
// formatting appears progressively as tokens arrive.
const STREAM = {
  bblEl: null,     // target .bbl element
  cursor: null,    // blinking cursor span
  raw: '',         // accumulated raw text so far
  tokens: 0,       // token count
  startMs: 0,      // start timestamp for t/s calc
  tickerEl: null,  // token counter span in meta bar
  speedEl: null,   // t/s span
  rafId: null,     // pending rAF id
  pending: '',     // tokens buffered between rAF ticks
};

function streamStart(bblEl, tickerEl, speedEl) {
  STREAM.bblEl   = bblEl;
  STREAM.raw     = '';
  STREAM.tokens  = 0;
  STREAM.startMs = Date.now();
  STREAM.tickerEl= tickerEl;
  STREAM.speedEl = speedEl;
  STREAM.pending = '';
  STREAM.rafId   = null;
  // Insert blinking cursor
  STREAM.cursor  = document.createElement('span');
  STREAM.cursor.className = 'stream-cursor';
  bblEl.appendChild(STREAM.cursor);
  startAutoScroll();
}

function streamChunk(delta) {
  if (!STREAM.bblEl) return;
  STREAM.raw    += delta;
  STREAM.tokens += delta.length; // rough token estimate (chars)
  STREAM.pending += delta;
  // Batch DOM updates via rAF to avoid thrashing
  if (!STREAM.rafId) {
    STREAM.rafId = requestAnimationFrame(_streamFlush);
  }
}

function _streamFlush() {
  STREAM.rafId = null;
  if (!STREAM.bblEl || !STREAM.pending) return;
  STREAM.pending = '';
  // Re-render accumulated markdown
  const cursor = STREAM.cursor;
  if (cursor) cursor.remove();
  STREAM.bblEl.innerHTML = parseMsg(STREAM.raw);
  if (cursor) STREAM.bblEl.appendChild(cursor);
  // Update token counter
  const elapsed = (Date.now() - STREAM.startMs) / 1000 || 0.001;
  const tps = Math.round(STREAM.tokens / elapsed);
  if (STREAM.tickerEl) STREAM.tickerEl.textContent = STREAM.tokens + ' tok';
  if (STREAM.speedEl)  STREAM.speedEl.textContent  = tps + ' t/s';
}

function streamEnd(bblEl, metaEl) {
  stopAutoScroll();
  if (STREAM.rafId) { cancelAnimationFrame(STREAM.rafId); STREAM.rafId = null; }
  if (STREAM.cursor) { STREAM.cursor.remove(); STREAM.cursor = null; }
  // Final render with syntax highlighting
  if (bblEl) { bblEl.innerHTML = parseMsg(STREAM.raw); hlCode(bblEl); }
  if (metaEl) metaEl.style.display = 'flex';
  scrollBot(true);
  STREAM.bblEl = null;
}

