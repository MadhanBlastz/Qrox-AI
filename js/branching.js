// ════════════════════════════════════════════
//  SESSION BRANCHING  v5
//
//  branchFromMsg(btn)
//  ─────────────────────────────────────────
//  Creates a new session ("branch") forked
//  from the current conversation at the
//  clicked user message.
//
//  The branch contains all messages up to
//  and including the chosen user turn — the
//  AI's reply to that turn is NOT included
//  (that's the whole point: you want a
//  different answer).
//
//  Branch metadata stored in session:
//    parentId   — id of the session branched from
//    branchAt   — message index where fork happened
//    branchMsg  — first 60 chars of that message
//
//  History sidebar shows branched sessions
//  indented under their parent.
// ════════════════════════════════════════════

function branchFromMsg(btn) {
  const msgEl  = btn.closest('.msg.user');
  const chatBox= document.getElementById('chatBox');
  if (!msgEl || !chatBox) return;

  // Find the index of this user message in the DOM
  const allUserMsgs = Array.from(chatBox.querySelectorAll('.msg.user'));
  const domIdx      = allUserMsgs.indexOf(msgEl);
  if (domIdx < 0) return;

  // Map DOM index → S.msgs index (only user messages)
  const userMsgIndices = [];
  S.msgs.forEach((m, i) => { if (m.role === 'user') userMsgIndices.push(i); });
  const msgIdx = userMsgIndices[domIdx];
  if (msgIdx === undefined) return;

  // Save current session before branching
  saveCurrentSession();

  // Slice messages up to AND including this user message
  // (exclude subsequent AI reply so the branch gets a fresh response)
  const branchMsgs = S.msgs.slice(0, msgIdx + 1);

  const parentId   = S.currentSessionId || ('s_' + Date.now());
  const branchMsg  = typeof branchMsgs[branchMsgs.length-1]?.content === 'string'
    ? branchMsgs[branchMsgs.length-1].content.slice(0, 60)
    : '(branch point)';

  const branchId = 'branch_' + Date.now();
  const branchSession = {
    id:        branchId,
    title:     '⎇ ' + branchMsg,
    msgs:      JSON.parse(JSON.stringify(branchMsgs)),
    tree:      {},
    framework: S.framework || null,
    ts:        Date.now(),
    msgCount:  branchMsgs.length,
    // Branch metadata
    parentId,
    branchAt:  msgIdx,
    branchMsg,
  };

  // Track branch count on parent session
  const parentSession = S.sessions.find(s => s.id === parentId);
  if (parentSession) {
    parentSession.branches = (parentSession.branches || 0) + 1;
  }

  S.sessions.unshift(branchSession);
  try { localStorage.setItem(LS_SESSIONS, JSON.stringify(S.sessions)); } catch(e) {}

  // Load the branch
  S.currentSessionId = branchId;
  S.msgs    = JSON.parse(JSON.stringify(branchMsgs));
  S.fileTree= {};
  S.framework = S.framework || null;

  // Render the branch
  const box = document.getElementById('chatBox');
  const ws  = document.getElementById('ws');
  if (ws) ws.remove();
  box.innerHTML = '';

  // Show branch origin banner first
  _branchRenderOriginBanner(branchMsg, parentId, msgIdx);

  // Render all messages in the branch
  perfRenderSession(S.msgs);

  renderHistSidebar();
  renderFileTree();
  switchMainTab('chat');

  // Update branch count badge on the original message
  _branchUpdateCountBadge(parentId, msgIdx);

  showToast(`⎇ Branch created — ${branchMsgs.length} message${branchMsgs.length!==1?'s':''} carried over`, 'ok');

  // Scroll to bottom — the user sees the branched history ending at their message
  setTimeout(() => {
    box.scrollTop = box.scrollHeight;
    // Focus input — ready to send a different message
    document.getElementById('uIn')?.focus();
  }, 100);
}

function _branchRenderOriginBanner(branchMsg, parentId, msgIdx) {
  const box    = document.getElementById('chatBox');
  const banner = document.createElement('div');
  banner.className = 'branch-origin-banner';
  banner.innerHTML = `
    <span style="font-size:1rem">⎇</span>
    <div>
      <div>Branched from: <em>"${esc(branchMsg.slice(0,50))}${branchMsg.length>50?'…':''}"</em></div>
      <div class="branch-origin-banner-sub">Message ${msgIdx+1} · <button onclick="branchGoParent('${parentId}')" style="background:none;border:none;color:#a78bfa;cursor:pointer;font-size:.62rem;font-family:var(--fh);font-weight:700;padding:0">↩ Go to parent session</button></div>
    </div>`;
  box.appendChild(banner);
}

function _branchUpdateCountBadge(parentId, msgIdx) {
  // If we're viewing the parent, update the branch count badge on the message
  if (S.currentSessionId !== parentId) return;
  const chatBox     = document.getElementById('chatBox');
  const userMsgs    = chatBox?.querySelectorAll('.msg.user');
  const userMsgIdxs = [];
  S.msgs.forEach((m,i) => { if (m.role==='user') userMsgIdxs.push(i); });
  const domIdx = userMsgIdxs.indexOf(msgIdx);
  if (domIdx < 0 || !userMsgs?.[domIdx]) return;
  const metaEl = userMsgs[domIdx].querySelector('.mmeta');
  if (!metaEl) return;
  const count = S.sessions.filter(s => s.parentId === parentId && s.branchAt === msgIdx).length;
  let badge = metaEl.querySelector('.branch-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'branch-count';
    badge.onclick = () => branchListAt(parentId, msgIdx);
    metaEl.appendChild(badge);
  }
  badge.textContent = `⎇ ${count}`;
  badge.title       = `${count} branch${count!==1?'es':''} from this message — click to see`;
}

function branchGoParent(parentId) {
  const sess = S.sessions.find(s => s.id === parentId);
  if (sess) loadSession(parentId);
  else showToast('Parent session not found in history', 'wrn');
}

function branchListAt(parentId, msgIdx) {
  // Show branches from this point as a toast list (could be expanded to a modal)
  const branches = S.sessions.filter(s => s.parentId === parentId && s.branchAt === msgIdx);
  if (!branches.length) { showToast('No branches found', 'inf'); return; }
  showToast(`${branches.length} branch${branches.length!==1?'es':''} — use History sidebar to navigate`, 'inf');
  // Open history sidebar
  const histTab = document.querySelector('.lsb-tab:nth-child(2)');
  if (histTab) lsbTab(histTab, 'history');
}

// ── Patch renderHistSidebar to show branch hierarchy ──────────
const _origRenderHistSidebar = renderHistSidebar;
renderHistSidebar = function() {
  const c = document.getElementById('histContainer');
  if (!S.sessions.length) {
    c.innerHTML = '<div class="hist-empty">💬<br>No sessions yet.<br>Start a conversation to see history here.</div>';
    return;
  }

  // Group by day, but keep branch children attached to parents
  const topLevel   = S.sessions.filter(s => !s.parentId);
  const branchMap  = {};
  S.sessions.filter(s => s.parentId).forEach(s => {
    if (!branchMap[s.parentId]) branchMap[s.parentId] = [];
    branchMap[s.parentId].push(s);
  });

  const days = {};
  topLevel.forEach(s => {
    const d    = new Date(s.ts);
    const now  = new Date();
    const yest = new Date(now); yest.setDate(yest.getDate()-1);
    const lbl  = d.toDateString() === now.toDateString()  ? 'Today'
               : d.toDateString() === yest.toDateString() ? 'Yesterday'
               : d.toLocaleDateString([], { month:'short', day:'numeric', year: d.getFullYear()!==now.getFullYear()?'numeric':undefined });
    if (!days[lbl]) days[lbl] = [];
    days[lbl].push(s);
  });

  let html = '<div style="padding:6px 8px 4px;display:flex;justify-content:flex-end">'
    + '<button class="hist-clear-btn" onclick="clearAllHistory()" title="Clear all history">🗑 Clear all</button></div>';

  for (const [day, sess] of Object.entries(days)) {
    html += `<div class="hist-day">${day}</div>`;
    sess.forEach(s => {
      const active = s.id === S.currentSessionId ? 'active' : '';
      const t      = new Date(s.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      const fw     = s.framework && s.framework !== 'html' && s.framework !== 'html-single' ? `<span class="hist-fw">${s.framework}</span>` : '';
      const branchCount = (branchMap[s.id]?.length || 0);
      const branchBadge = branchCount > 0 ? `<span style="font-size:.55rem;padding:1px 5px;border-radius:4px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.2);color:#a78bfa;font-family:var(--fh);font-weight:700">⎇ ${branchCount}</span>` : '';

      html += `<div class="hist-item ${active}" onclick="loadSession('${s.id}')">
        <span class="hist-icon">💬</span>
        <div class="hist-info">
          <div class="hist-title">${esc((s.title||'Untitled').slice(0,44))}${fw}${branchBadge}${s.aiTitled ? '<span class="title-ai-badge">AI</span>' : ''}</div>
          <div class="hist-time">${t} · ${s.msgCount||s.msgs?.length||0} msgs</div>
        </div>
        <button class="hist-del" onclick="deleteSession('${s.id}',event)" title="Delete">✕</button>
      </div>`;

      // Show branches indented underneath parent
      const branches = branchMap[s.id] || [];
      branches.forEach(b => {
        const bActive = b.id === S.currentSessionId ? 'active' : '';
        const bt = new Date(b.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        html += `<div class="hist-item is-branch ${bActive}" onclick="loadSession('${b.id}')">
          <span class="hist-icon" style="color:#a78bfa">⎇</span>
          <div class="hist-info">
            <div class="hist-title" style="color:#c4b5fd">${esc((b.title||'Branch').slice(0,42))}</div>
            <div class="hist-time">${bt} · ${b.msgCount||b.msgs?.length||0} msgs</div>
          </div>
          <button class="hist-del" onclick="deleteSession('${b.id}',event)" title="Delete">✕</button>
        </div>`;
      });
    });
  }

  c.innerHTML = html;
};

// Also show branch origin banner when loading a branched session
const _origLoadSession = loadSession;
loadSession = function(id) {
  _origLoadSession(id);
  // After load, check if this is a branch and show banner
  const sess = S.sessions.find(s => s.id === id);
  if (sess?.parentId && sess?.branchMsg) {
    setTimeout(() => {
      const box = document.getElementById('chatBox');
      const existing = box?.querySelector('.branch-origin-banner');
      if (!existing) {
        _branchRenderOriginBanner(sess.branchMsg, sess.parentId, sess.branchAt || 0);
        // Move banner to top
        if (box?.firstChild) box.insertBefore(box.lastChild, box.firstChild);
      }
    }, 100);
  }
};

