// ════════════════════════════════════════════
//  LIVE DIFF VIEW  v5
//
//  When the AI updates a file that already
//  exists in S.fileTree, instead of silently
//  overwriting, show a diff modal with:
//   • Line-level Myers diff (added/removed/ctx)
//   • Hunk grouping with per-hunk Accept
//   • Word-level highlights on changed lines
//   • Accept All / Reject All
//   • +N / -N summary badges
//
//  diffShow(path, oldContent, newContent)
//  diffAcceptAll()   — writes new to fileTree
//  diffRejectAll()   — keeps old, closes
//  diffAcceptHunk(hunkId) — patch just one hunk
// ════════════════════════════════════════════

const DIFF = {
  path:       null,
  oldContent: null,
  newContent: null,
  hunks:      [],
  accepted:   new Set(), // hunk ids accepted so far
};

// ── Myers diff — line level ───────────────────────────────────
// Returns array of {type:'add'|'del'|'eq', line, oldLine, newLine}
function diffLines(oldText, newText) {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const N = a.length, M = b.length;
  const MAX = N + M;

  // Standard Myers algorithm
  const V = new Array(2 * MAX + 2).fill(0);
  const trace = [];

  outer: for (let d = 0; d <= MAX; d++) {
    trace.push(V.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      const ki = k + MAX;
      if (k === -d || (k !== d && V[ki - 1] < V[ki + 1])) {
        x = V[ki + 1];
      } else {
        x = V[ki - 1] + 1;
      }
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) { x++; y++; }
      V[ki] = x;
      if (x >= N && y >= M) break outer;
    }
  }

  // Backtrack
  const ops = [];
  let x = N, y = M;
  for (let d = trace.length - 1; d >= 0; d--) {
    const Vd = trace[d];
    const k  = x - y;
    const ki = k + MAX;
    let prevK;
    if (k === -d || (k !== d && Vd[ki - 1] < Vd[ki + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = Vd[prevK + MAX];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { x--; y--; ops.push({type:'eq', line:a[x], oldLine:x, newLine:y}); }
    if (d > 0) {
      if (x === prevX) { y--; ops.push({type:'add', line:b[y], oldLine:-1, newLine:y}); }
      else             { x--; ops.push({type:'del', line:a[x], oldLine:x,  newLine:-1}); }
    }
  }
  return ops.reverse();
}

// ── Group diff ops into hunks (contiguous changed blocks + context) ──
function diffHunks(ops, ctx = 3) {
  const changes = new Set();
  ops.forEach((op, i) => { if (op.type !== 'eq') changes.add(i); });
  if (!changes.size) return [];

  // Expand each changed index to include ctx lines either side
  const inHunk = new Set();
  changes.forEach(i => {
    for (let j = Math.max(0, i - ctx); j <= Math.min(ops.length - 1, i + ctx); j++) inHunk.add(j);
  });

  // Split into contiguous groups
  const hunks = [];
  let current = null;
  for (let i = 0; i < ops.length; i++) {
    if (inHunk.has(i)) {
      if (!current) { current = { id: 'hunk_' + hunks.length, ops: [] }; }
      current.ops.push({ ...ops[i], idx: i });
    } else {
      if (current) { hunks.push(current); current = null; }
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

// ── Word-level diff for changed lines ────────────────────────
function diffWords(oldLine, newLine) {
  const aw = oldLine.split(/(\s+)/);
  const bw = newLine.split(/(\s+)/);
  // Simple LCS-based word diff
  const lcs = Array.from({length: aw.length + 1}, () => new Array(bw.length + 1).fill(0));
  for (let i = 1; i <= aw.length; i++)
    for (let j = 1; j <= bw.length; j++)
      lcs[i][j] = aw[i-1] === bw[j-1] ? lcs[i-1][j-1]+1 : Math.max(lcs[i-1][j], lcs[i][j-1]);

  let i = aw.length, j = bw.length;
  const ops = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aw[i-1] === bw[j-1]) { ops.unshift({t:'eq',w:aw[i-1]}); i--; j--; }
    else if (j > 0 && (i === 0 || lcs[i][j-1] >= lcs[i-1][j])) { ops.unshift({t:'add',w:bw[j-1]}); j--; }
    else { ops.unshift({t:'del',w:aw[i-1]}); i--; }
  }

  const oldHtml = ops.map(o => o.t === 'del' ? `<span class="diff-word-del">${esc(o.w)}</span>`
                                : o.t === 'eq'  ? esc(o.w) : '').join('');
  const newHtml = ops.map(o => o.t === 'add' ? `<span class="diff-word-add">${esc(o.w)}</span>`
                                : o.t === 'eq'  ? esc(o.w) : '').join('');
  return { oldHtml, newHtml };
}

// ── Render a hunk to HTML ─────────────────────────────────────
function _diffRenderHunk(hunk, hunkIdx, totalHunks) {
  const adds = hunk.ops.filter(o => o.type === 'add').length;
  const dels = hunk.ops.filter(o => o.type === 'del').length;

  // Find changed pairs for word-level diff
  const delLines = hunk.ops.filter(o => o.type === 'del');
  const addLines = hunk.ops.filter(o => o.type === 'add');
  const wordDiffs = new Map(); // idx → {oldHtml,newHtml}
  const pairedCount = Math.min(delLines.length, addLines.length);
  for (let p = 0; p < pairedCount; p++) {
    const wd = diffWords(delLines[p].line, addLines[p].line);
    wordDiffs.set(delLines[p].idx, wd.oldHtml);
    wordDiffs.set(addLines[p].idx, wd.newHtml);
  }

  let linesHtml = '';
  let oldLineNum = (hunk.ops[0]?.oldLine ?? 0) + 1;
  let newLineNum = (hunk.ops[0]?.newLine ?? 0) + 1;

  hunk.ops.forEach(op => {
    const marker = op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' ';
    const cls    = op.type === 'add' ? 'add' : op.type === 'del' ? 'del' : 'ctx';
    const oldN   = op.type === 'add' ? '' : (op.type === 'del' ? oldLineNum++ : oldLineNum++);
    const newN   = op.type === 'del' ? '' : (op.type === 'add' ? newLineNum++ : newLineNum++);
    const codeHtml = wordDiffs.has(op.idx)
      ? wordDiffs.get(op.idx)
      : esc(op.line);
    linesHtml += `<div class="diff-line ${cls}">
      <span class="diff-line-num old">${oldN}</span>
      <span class="diff-line-num new">${newN}</span>
      <span class="diff-line-marker">${marker}</span>
      <span class="diff-line-code">${codeHtml}</span>
    </div>`;
  });

  return `<div class="diff-hunk" id="${hunk.id}">
    <div class="diff-hunk-hdr" onclick="diffToggleHunk('${hunk.id}')">
      <span>@@ Hunk ${hunkIdx + 1} of ${totalHunks}</span>
      <span style="color:var(--green);margin-left:6px">+${adds}</span>
      <span style="color:var(--red);margin-left:4px">-${dels}</span>
      <button class="diff-hunk-accept" onclick="event.stopPropagation();diffAcceptHunk('${hunk.id}')">✓ Accept</button>
    </div>
    <div class="diff-hunk-body" id="${hunk.id}_body">${linesHtml}</div>
  </div>`;
}

// ── Public API ────────────────────────────────────────────────
function diffShow(path, oldContent, newContent) {
  if (!oldContent || !newContent || oldContent === newContent) {
    // No diff — just accept silently
    return false;
  }

  DIFF.path       = path;
  DIFF.oldContent = oldContent;
  DIFF.newContent = newContent;
  DIFF.accepted   = new Set();

  const ops   = diffLines(oldContent, newContent);
  DIFF.hunks  = diffHunks(ops);

  const adds  = ops.filter(o => o.type === 'add').length;
  const dels  = ops.filter(o => o.type === 'del').length;

  if (!DIFF.hunks.length) return false; // identical

  // Update header
  document.getElementById('diffFileName').textContent = path;
  document.getElementById('diffFileIcon').textContent = fileIcon(path);
  document.getElementById('diffAdds').textContent     = `+${adds}`;
  document.getElementById('diffDels').textContent     = `-${dels}`;

  // Render hunks
  const total  = DIFF.hunks.length;
  const html   = DIFF.hunks.map((h, i) => _diffRenderHunk(h, i, total)).join('');
  document.getElementById('diffContent').innerHTML = html;

  // Summary bar
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  document.getElementById('diffSummaryBar').innerHTML =
    `<span class="diff-summary-stat" style="color:var(--green)">▲ +${adds} added</span>
     <span class="diff-summary-stat" style="color:var(--red)">▼ -${dels} removed</span>
     <span class="diff-summary-stat">${oldLines} → ${newLines} lines</span>
     <span style="flex:1"></span>
     <span style="color:var(--t4)">${total} hunk${total!==1?'s':''} · ${path}</span>`;

  document.getElementById('diffOverlay').classList.add('open');
  return true;
}

function diffClose() {
  document.getElementById('diffOverlay').classList.remove('open');
}

function diffAcceptAll() {
  if (!DIFF.path || !DIFF.newContent) return;
  S.fileTree[DIFF.path] = { ...S.fileTree[DIFF.path], content: DIFF.newContent };
  renderFileTree();
  showToast(`✅ Changes accepted — ${DIFF.path}`, 'ok');
  diffClose();
}

function diffRejectAll() {
  showToast(`Changes rejected — keeping original ${DIFF.path}`, 'inf');
  diffClose();
}

function diffAcceptHunk(hunkId) {
  DIFF.accepted.add(hunkId);
  // Mark hunk as accepted visually
  const hunkEl = document.getElementById(hunkId);
  if (hunkEl) {
    hunkEl.style.opacity = '0.45';
    const btn = hunkEl.querySelector('.diff-hunk-accept');
    if (btn) { btn.textContent = '✓ Accepted'; btn.style.background = 'rgba(16,185,129,.25)'; }
  }
  // If all hunks accepted, auto-accept all
  if (DIFF.accepted.size === DIFF.hunks.length) {
    setTimeout(() => diffAcceptAll(), 300);
  } else {
    // Apply partial patch
    _diffApplyPartial();
  }
}

function _diffApplyPartial() {
  // Rebuild content with only accepted hunks applied
  const ops     = diffLines(DIFF.oldContent, DIFF.newContent);
  const allHunks = diffHunks(ops);
  const acceptedHunks = new Set(
    [...DIFF.accepted].map(id => allHunks.findIndex(h => h.id === id))
  );

  const oldLines = DIFF.oldContent.split('\n');
  const result   = [];
  let   oldIdx   = 0;

  allHunks.forEach((hunk, hi) => {
    // Find the range this hunk covers in old
    const firstOldOp = hunk.ops.find(o => o.oldLine >= 0);
    const lastOldOp  = [...hunk.ops].reverse().find(o => o.oldLine >= 0);
    if (!firstOldOp || !lastOldOp) return;

    // Copy unchanged lines before this hunk
    while (oldIdx < firstOldOp.oldLine) result.push(oldLines[oldIdx++]);

    if (acceptedHunks.has(hi)) {
      // Apply this hunk: skip del lines, emit add lines
      hunk.ops.forEach(op => {
        if (op.type === 'add') result.push(op.line);
        else if (op.type === 'eq') { result.push(op.line); oldIdx++; }
        else if (op.type === 'del') oldIdx++;
      });
    } else {
      // Skip (keep original)
      hunk.ops.forEach(op => {
        if (op.type !== 'add') { result.push(oldLines[oldIdx]); oldIdx++; }
      });
    }
  });
  // Remaining lines
  while (oldIdx < oldLines.length) result.push(oldLines[oldIdx++]);

  S.fileTree[DIFF.path] = { ...S.fileTree[DIFF.path], content: result.join('\n') };
  renderFileTree();
}

function diffToggleHunk(hunkId) {
  const body = document.getElementById(hunkId + '_body');
  if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
}

