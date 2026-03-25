// ════════════════════════════════════════════
//  SESSIONS / HISTORY
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  SESSIONS / HISTORY  — localStorage: eai_sessions
// ════════════════════════════════════════════

// Safely extract text title from a message (content can be string or vision array)
// ════════════════════════════════════════════
//  SMART SESSION TITLES  v5
//
//  After the first full exchange (user + AI),
//  silently calls the fastest available model
//  with a compact prompt asking for a ≤6 word
//  title. Writes it back to the session and
//  re-renders the history sidebar.
//
//  smartTitleSession(sessionId)
//    — entry point, called after send() completes
//    — debounced, skips if already AI-titled
//    — uses the cheapest/fastest model available
//
//  Titles are marked aiTitled:true so we never
//  re-title the same session.
// ════════════════════════════════════════════

const SMART_TITLE = {
  pending:  new Set(),   // session IDs currently being titled
  disabled: false,       // can be toggled off in settings
};

// Prompt sent to the model for title generation
const SMART_TITLE_PROMPT = `You are a session title generator.
Given a conversation excerpt, write a SHORT title (3–6 words, no punctuation, no quotes, title-case).
The title should capture the main topic or goal.

Examples:
- "Build a kanban board app" → Kanban Board App
- "Explain how React hooks work" → React Hooks Explained
- "Fix the login bug in my API" → Login Bug API Fix
- "Write a blog post about AI" → AI Blog Post Draft

Output ONLY the title. Nothing else.`;

async function smartTitleSession(sessionId) {
  if (!sessionId) return;
  if (SMART_TITLE.disabled) return;
  if (SMART_TITLE.pending.has(sessionId)) return;

  // Find the session
  const sess = S.sessions.find(s => s.id === sessionId);
  if (!sess) return;

  // Skip if already AI-titled
  if (sess.aiTitled) return;

  // Skip branches — they already have a meaningful title
  if (sess.parentId) return;

  // Need at least one full exchange (user + AI) to generate a good title
  const msgs = sess.msgs || S.msgs;
  const userMsgs = msgs.filter(m => m.role === 'user');
  const aiMsgs   = msgs.filter(m => m.role === 'assistant');
  if (!userMsgs.length || !aiMsgs.length) return;

  // Build a compact excerpt for titling (first user + first AI, truncated)
  const firstUser = typeof userMsgs[0].content === 'string'
    ? userMsgs[0].content
    : userMsgs[0].content?.find?.(p => p.type === 'text')?.text || '';
  const firstAI = typeof aiMsgs[0].content === 'string'
    ? aiMsgs[0].content
    : aiMsgs[0].content?.find?.(p => p.type === 'text')?.text || '';

  // Skip pipeline/agent headers — they're already descriptive
  if (firstUser.startsWith('🤖 **Multi-Agent Pipeline**')) return;
  if (firstUser.startsWith('⎇ ')) return;

  const excerpt = `User: ${firstUser.slice(0, 200)}\nAssistant: ${firstAI.slice(0, 200)}`;

  SMART_TITLE.pending.add(sessionId);
  _smartTitleSetShimmer(sessionId, true);

  try {
    // Pick the fastest model — prefer free/fast providers
    const fastOrder = ['cerebras','groq','pollinations','gemini','openrouter'];
    let prov = null, model = null;

    for (const provId of fastOrder) {
      const p = PROVS.find(p => p.id === provId && (S.keys[p.id] || p.worksNoKey));
      if (!p) continue;
      const m = p.models?.[0];
      if (m) { prov = p; model = m; break; }
    }

    // Ultimate fallback — any available provider
    if (!prov) {
      for (const p of PROVS) {
        if (!S.keys[p.id] && !p.worksNoKey) continue;
        const m = p.models?.[0];
        if (m) { prov = p; model = m; break; }
      }
    }

    if (!prov || !model) return;

    const callerFn = CALLERS[prov.id];
    if (!callerFn) return;

    const msgs_for_title = [{ role: 'user', content: excerpt }];
    const result = await callerFn(prov, model, msgs_for_title, SMART_TITLE_PROMPT, 24);

    // Clean the title
    let title = result.trim()
      .replace(/^["']|["']$/g, '')   // strip quotes
      .replace(/[.!?]+$/, '')         // strip trailing punctuation
      .replace(/\s+/g, ' ')           // normalise spaces
      .slice(0, 60)                   // hard cap
      .trim();

    if (!title || title.length < 3) return;

    // Write back to session
    const idx = S.sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      S.sessions[idx].title    = title;
      S.sessions[idx].aiTitled = true;
      // If this is the active session, update in-memory too
      if (sessionId === S.currentSessionId) {
        // No in-memory title field — just persists via sessions array
      }
      // Persist
      try { localStorage.setItem(LS_SESSIONS, JSON.stringify(S.sessions)); } catch(e) {}
      // Re-render history sidebar
      renderHistSidebar();
    }

  } catch(e) {
    // Silent failure — title generation is best-effort
  } finally {
    SMART_TITLE.pending.delete(sessionId);
    _smartTitleSetShimmer(sessionId, false);
  }
}

function _smartTitleSetShimmer(sessionId, on) {
  // Find history item for this session and toggle shimmer class
  const histItems = document.querySelectorAll('#histContainer .hist-item');
  histItems.forEach(el => {
    if (el.getAttribute('onclick')?.includes(sessionId)) {
      el.classList.toggle('titling', on);
    }
  });
}

// Trigger smart titling after the second AI response in a session
// Called from the end of send()
function smartTitleTrigger() {
  const sessionId = S.currentSessionId;
  if (!sessionId) return;
  const aiCount = S.msgs.filter(m => m.role === 'assistant').length;
  // Fire after exactly the first AI response (1 exchange complete)
  if (aiCount !== 1) return;
  // Small delay so the session is saved first
  setTimeout(() => smartTitleSession(sessionId), 1200);
}

// Retitle existing sessions that lack AI titles (run once on boot)
function smartTitleRetroactive() {
  if (SMART_TITLE.disabled) return;
  // Find up to 5 recent sessions without AI titles, retitle them
  const candidates = S.sessions
    .filter(s => !s.aiTitled && !s.parentId && s.msgs?.length >= 2)
    .slice(0, 5);
  // Stagger to avoid hammering the API
  candidates.forEach((sess, i) => {
    setTimeout(() => smartTitleSession(sess.id), 2000 + i * 1500);
  });
}

function msgTitle(content) {
  if (!content) return 'Untitled';
  if (typeof content === 'string') return content.slice(0, 52);
  if (Array.isArray(content)) {
    const text = content.find(p => p.type === 'text');
    return text ? text.text.slice(0, 52) : '📎 Image attached';
  }
  return 'Untitled';
}

// Strip large base64 image data from msgs before saving (keep text, drop image bytes)
function stripImagesForSave(msgs) {
  return msgs.map(m => {
    if (!Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map(p =>
        p.type === 'image_url'
          ? { type: 'image_url', image_url: { url: '[image removed for storage]' } }
          : p
      )
    };
  });
}

function saveCurrentSession() {
  if (!S.msgs.length) return;

  const firstUser = S.msgs.find(m => m.role === 'user');
  const title = msgTitle(firstUser?.content) || 'Untitled';

  // Build session object
  const session = {
    id:        S.currentSessionId || ('s_' + Date.now()),
    title,
    msgs:      stripImagesForSave(S.msgs),
    tree:      S.fileTree || {},
    framework: S.framework || null,
    ts:        Date.now(),
    msgCount:  S.msgs.length,
  };

  // Preserve aiTitled flag if already set
  const existingIdx = S.sessions.findIndex(s => s.id === session.id);
  if (existingIdx >= 0 && S.sessions[existingIdx].aiTitled) {
    session.title    = S.sessions[existingIdx].title;  // keep AI title
    session.aiTitled = true;
  }

  // Trim if too large (drop file tree content if needed)
  let sessionStr = JSON.stringify(session);
  if (sessionStr.length > MAX_SESSION_BYTES) {
    // Remove file content but keep paths
    const lightTree = {};
    for (const [k, v] of Object.entries(session.tree)) {
      lightTree[k] = { ...v, content: v.content ? '[truncated]' : undefined };
    }
    session.tree = lightTree;
    sessionStr = JSON.stringify(session);
  }

  S.currentSessionId = session.id;

  const idx = S.sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    S.sessions[idx] = session;
  } else {
    S.sessions.unshift(session);
  }

  // Keep within limit
  if (S.sessions.length > MAX_SESSIONS) S.sessions = S.sessions.slice(0, MAX_SESSIONS);

  try {
    localStorage.setItem(LS_SESSIONS, JSON.stringify(S.sessions));
  } catch (e) {
    // If quota exceeded, remove oldest sessions until it fits
    while (S.sessions.length > 1) {
      S.sessions.pop();
      try {
        localStorage.setItem(LS_SESSIONS, JSON.stringify(S.sessions));
        break;
      } catch (e2) { continue; }
    }
    showToast('Storage full — older sessions removed', 'wrn');
  }

  renderHistSidebar();
  if (typeof _shareUpdateBtn === 'function') _shareUpdateBtn();
  // Show analytics button once we have history
  const ab = document.getElementById('analyticsBtn');
  if (ab && S.sessions.length > 0) ab.style.display = '';
  // Update context meter
  ctxUpdate();
  // Update cost estimator
  costUpdate();
  // Update token heatmap if active
  heatmapMaybeUpdate();
}

function loadSession(id) {
  saveCurrentSession();
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;

  S.currentSessionId = id;
  S.msgs = JSON.parse(JSON.stringify(s.msgs));
  S.fileTree = s.tree || {};
  S.framework = s.framework || null;
  S._userPickedFramework = !!s.framework;

  renderFileTree();
  S.framework = s.framework || null;
  document.querySelectorAll('.fw-pill').forEach(b => b.classList.toggle('on', b.dataset.fw === S.framework));
  _applyFrameworkToRunBtns(S.framework);

  // Use fast windowed renderer instead of rendering all messages at once
  perfRenderSession(S.msgs);

  renderHistSidebar();
  switchMainTab('chat');
  showToast(`Loaded: ${s.title.slice(0,30)}`, 'inf');
  // Update context meter for loaded session
  setTimeout(ctxUpdate, 100);
}

function deleteSession(id, e) {
  if (e) e.stopPropagation();
  S.sessions = S.sessions.filter(s => s.id !== id);
  try { localStorage.setItem(LS_SESSIONS, JSON.stringify(S.sessions)); } catch(e) {}
  if (S.currentSessionId === id) { newChat(true); return; }
  renderHistSidebar();
}

function clearAllHistory() {
  if (!confirm('Delete all chat history? This cannot be undone.')) return;
  S.sessions = [];
  try { localStorage.removeItem(LS_SESSIONS); } catch(e) {}
  renderHistSidebar();
  showToast('All history cleared', 'inf');
}

function renderHistSidebar() {
  const c = document.getElementById('histContainer');
  if (!S.sessions.length) {
    c.innerHTML = '<div class="hist-empty">💬<br>No sessions yet.<br>Start a conversation to see history here.</div>';
    return;
  }

  // Group by day
  const days = {};
  S.sessions.forEach(s => {
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
      html += `<div class="hist-item ${active}" onclick="loadSession('${s.id}')">
        <span class="hist-icon">💬</span>
        <div class="hist-info">
          <div class="hist-title">${esc((s.title||'Untitled').slice(0, 44))}${fw}</div>
          <div class="hist-time">${t} · ${s.msgCount||s.msgs?.length||0} msgs</div>
        </div>
        <button class="hist-del" onclick="deleteSession('${s.id}',event)" title="Delete">✕</button>
      </div>`;
    });
  }

  c.innerHTML = html;
}

