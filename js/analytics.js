// ════════════════════════════════════════════
//  ANALYTICS DASHBOARD  v5
//
//  Analyses all saved sessions + current chat:
//   • Total messages, sessions, words, tokens
//   • Messages per day heatmap (last 12 weeks)
//   • Task type breakdown bar chart
//   • Top models used (donut)
//   • Most active hours
//   • Longest sessions + recent activity
//   • Word count trend sparkline
//   • CSV export
// ════════════════════════════════════════════

function analyticsOpen() {
  document.getElementById('analyticsOverlay').classList.add('open');
  setTimeout(_analyticsBuild, 50);
}

function analyticsClose() {
  document.getElementById('analyticsOverlay').classList.remove('open');
}

function _analyticsCollect() {
  // Merge saved sessions + current unsaved messages
  const allSessions = [...(S.sessions || [])];

  // Add current session if not already saved
  if (S.msgs.length && S.currentSessionId) {
    const exists = allSessions.find(s => s.id === S.currentSessionId);
    if (!exists) allSessions.unshift({ id: S.currentSessionId, msgs: S.msgs, ts: Date.now(), title: S.msgs[0]?.content?.slice?.(0,40) || 'Current' });
  }

  return allSessions;
}

function _analyticsBuild() {
  const sessions = _analyticsCollect();
  const body     = document.getElementById('analyticsBody');
  const subtitle = document.getElementById('analyticsSubtitle');

  if (!sessions.length) {
    body.innerHTML = '<div class="an-empty"><span style="font-size:2.5rem">📭</span><span>No chat history yet — start a conversation!</span></div>';
    subtitle.textContent = 'No data';
    return;
  }

  // ── Crunch numbers ─────────────────────────────────────────
  let totalMsgs = 0, totalUser = 0, totalAI = 0, totalWords = 0, totalTokenEst = 0;
  const modelCounts  = {};
  const dayCounts    = {};  // 'YYYY-MM-DD' → count
  const hourCounts   = new Array(24).fill(0);
  const taskCounts   = { coding:0, thinking:0, writing:0, math:0, chat:0, vision:0 };
  const sessionLens  = [];

  sessions.forEach(sess => {
    const msgs = sess.msgs || [];
    totalMsgs += msgs.length;
    const date = new Date(sess.ts || Date.now());
    const dayKey = date.toISOString().slice(0,10);
    dayCounts[dayKey] = (dayCounts[dayKey] || 0) + msgs.length;
    hourCounts[date.getHours()]++;

    msgs.forEach(m => {
      const text = typeof m.content === 'string' ? m.content
                 : Array.isArray(m.content) ? (m.content.find(p=>p.type==='text')?.text||'') : '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      totalWords += words;
      totalTokenEst += Math.round(words * 1.33);

      if (m.role === 'user') {
        totalUser++;
        // Classify task type from user messages
        const result = detectIntent(text, {});
        const key = result.key === 'debug' ? 'thinking' : (result.key in taskCounts ? result.key : 'chat');
        taskCounts[key]++;
      } else {
        totalAI++;
        // Extract model names from umtag spans in saved content (or use session title heuristic)
        const modelMatch = text.match(/\[model:([^\]]+)\]/);
        if (modelMatch) {
          const m2 = modelMatch[1].trim();
          modelCounts[m2] = (modelCounts[m2] || 0) + 1;
        }
      }
    });

    sessionLens.push({ id: sess.id, title: sess.title || 'Untitled', msgs: msgs.length, ts: sess.ts || 0, framework: sess.framework });
  });

  sessionLens.sort((a,b) => b.msgs - a.msgs);
  const avgMsgsPerSession = totalMsgs / Math.max(sessions.length, 1);
  const oldestTs  = Math.min(...sessions.map(s => s.ts || Date.now()));
  const daysSince = Math.max(1, Math.round((Date.now() - oldestTs) / 86400000));
  const msgsPerDay = (totalMsgs / daysSince).toFixed(1);

  subtitle.textContent = `${sessions.length} sessions · ${totalMsgs.toLocaleString()} messages · data from last ${daysSince} day${daysSince!==1?'s':''}`;
  // Show analytics button now that we have data
  const btn = document.getElementById('analyticsBtn');
  if (btn) btn.style.display = '';

  // ── Build HTML ─────────────────────────────────────────────
  let html = '';

  // Stat cards
  html += `<div>
    <div class="an-section-hdr">Overview</div>
    <div class="analytics-cards">
      <div class="an-card"><div class="an-card-icon">💬</div><div class="an-card-val">${totalMsgs.toLocaleString()}</div><div class="an-card-lbl">Total Messages</div><div class="an-card-sub">${totalUser} from you · ${totalAI} AI</div></div>
      <div class="an-card"><div class="an-card-icon">📁</div><div class="an-card-val">${sessions.length}</div><div class="an-card-lbl">Sessions</div><div class="an-card-sub">~${avgMsgsPerSession.toFixed(1)} msgs avg</div></div>
      <div class="an-card"><div class="an-card-icon">⚡</div><div class="an-card-val">${msgsPerDay}</div><div class="an-card-lbl">Msgs / Day</div><div class="an-card-sub">over ${daysSince} days</div></div>
      <div class="an-card"><div class="an-card-icon">🔤</div><div class="an-card-val">${_anFmt(totalTokenEst)}</div><div class="an-card-lbl">Est. Tokens</div><div class="an-card-sub">~${_anFmt(totalWords)} words</div></div>
    </div>
  </div>`;

  // Activity heatmap + task breakdown
  html += `<div class="analytics-cols">
    <div class="an-panel">
      <div class="an-section-hdr">Activity — last 12 weeks</div>
      ${_anHeatmap(dayCounts)}
    </div>
    <div class="an-panel">
      <div class="an-section-hdr">Task Types</div>
      ${_anTaskBars(taskCounts, totalUser)}
    </div>
  </div>`;

  // Hour distribution + top sessions
  html += `<div class="analytics-cols">
    <div class="an-panel">
      <div class="an-section-hdr">Most Active Hours</div>
      ${_anHourBars(hourCounts)}
    </div>
    <div class="an-panel">
      <div class="an-section-hdr">Longest Sessions</div>
      ${_anSessionList(sessionLens.slice(0,8))}
    </div>
  </div>`;

  // Export row
  html += `<div>
    <div class="an-section-hdr">Export</div>
    <div class="an-export-row">
      <button class="an-export-btn" onclick="analyticsExportCSV()">⬇ Export as CSV</button>
      <button class="an-export-btn" onclick="analyticsExportJSON()">⬇ Export as JSON</button>
      <button class="an-export-btn" onclick="analyticsClose();exportChat()">⬇ Export Current Chat</button>
    </div>
  </div>`;

  body.innerHTML = html;
}

// ── Helpers ───────────────────────────────────────────────────
function _anFmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return String(n);
}

function _anHeatmap(dayCounts) {
  const WEEKS = 12;
  const today = new Date(); today.setHours(0,0,0,0);
  const max   = Math.max(1, ...Object.values(dayCounts));

  // Build weeks array
  const cells = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const week = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - (w * 7 + d));
      const key   = day.toISOString().slice(0,10);
      const count = dayCounts[key] || 0;
      const level = count === 0 ? '' : count < max*0.25 ? 'l1' : count < max*0.5 ? 'l2' : count < max*0.75 ? 'l3' : 'l4';
      week.push({ key, count, level, day: day.getDate(), month: day.getMonth() });
    }
    cells.push(week);
  }

  const days = ['S','M','T','W','T','F','S'];
  let html = '<div class="an-heatmap">';
  for (let d = 0; d < 7; d++) {
    html += `<div class="an-heatmap-row">
      <span class="an-heatmap-lbl">${days[6-d]}</span>
      <div class="an-heatmap-cells">
        ${cells.map(week => `<div class="an-heatmap-cell ${week[d].level}" title="${week[d].key}: ${week[d].count} messages"></div>`).join('')}
      </div>
    </div>`;
  }
  html += '</div>';
  return html;
}

function _anTaskBars(counts, total) {
  const COLORS = { coding:'#34d399', thinking:'#60a5fa', writing:'#fb923c', math:'#22d3ee', chat:'#f472b6', vision:'#f59e0b' };
  const ICONS  = { coding:'💻', thinking:'🧠', writing:'✍️', math:'📊', chat:'💬', vision:'👁' };
  const items  = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  const max    = Math.max(1, ...items.map(e => e[1]));

  return items.map(([key, count]) => {
    const pct = Math.round((count / Math.max(total,1)) * 100);
    const barW = Math.round((count / max) * 100);
    return `<div class="an-bar-row">
      <span class="an-bar-label">${ICONS[key]||''} ${key}</span>
      <div class="an-bar-wrap"><div class="an-bar" style="width:${barW}%;background:${COLORS[key]||'var(--a1)'}"></div></div>
      <span class="an-bar-val">${pct}%</span>
    </div>`;
  }).join('');
}

function _anHourBars(hourCounts) {
  const max = Math.max(1, ...hourCounts);
  const labels = ['12a','1','2','3','4','5','6','7','8','9','10','11','12p','1','2','3','4','5','6','7','8','9','10','11'];
  // Show every 3 hours
  return hourCounts.map((count, h) => {
    if (h % 3 !== 0) return '';
    const barW = Math.round((count / max) * 100);
    const col  = h >= 9 && h <= 17 ? '#6366f1' : h >= 18 ? '#f472b6' : '#60a5fa';
    return `<div class="an-bar-row">
      <span class="an-bar-label" style="font-family:var(--fc);font-size:.62rem">${labels[h]}</span>
      <div class="an-bar-wrap"><div class="an-bar" style="width:${barW}%;background:${col}"></div></div>
      <span class="an-bar-val">${count}</span>
    </div>`;
  }).join('');
}

function _anSessionList(sessions) {
  if (!sessions.length) return '<div class="an-empty" style="padding:12px"><span>No sessions yet</span></div>';
  const COLORS = ['#34d399','#60a5fa','#f472b6','#f59e0b','#c4b5fd','#6ee7b7','#fde68a','#a5b4fc'];
  return `<div class="an-session-list">
    ${sessions.map((s, i) => {
      const date = new Date(s.ts).toLocaleDateString([],{month:'short',day:'numeric'});
      const fw   = s.framework ? `<span class="an-session-badge" style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);color:#a5b4fc">${s.framework}</span>` : '';
      return `<div class="an-session-row" onclick="analyticsClose();loadSession('${s.id}')">
        <span style="font-size:.7rem;color:${COLORS[i%COLORS.length]};font-weight:700;font-family:var(--fc);width:16px;flex-shrink:0">${i+1}</span>
        <span class="an-session-title">${esc((s.title||'Untitled').slice(0,50))}</span>
        ${fw}
        <span class="an-session-meta">${s.msgs} msgs · ${date}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ── Exports ───────────────────────────────────────────────────
function analyticsExportCSV() {
  const sessions = _analyticsCollect();
  const rows = [['session_id','session_title','timestamp','role','message_preview','word_count']];
  sessions.forEach(sess => {
    (sess.msgs || []).forEach(m => {
      const text = typeof m.content === 'string' ? m.content
                 : Array.isArray(m.content) ? (m.content.find(p=>p.type==='text')?.text||'') : '';
      rows.push([
        sess.id,
        (sess.title||'').replace(/"/g,'""'),
        new Date(sess.ts||0).toISOString(),
        m.role,
        text.slice(0,100).replace(/"/g,'""').replace(/\n/g,' '),
        text.trim().split(/\s+/).filter(Boolean).length,
      ]);
    });
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  dlF('chat_analytics.csv', csv);
  showToast('CSV exported', 'ok');
}

function analyticsExportJSON() {
  const sessions = _analyticsCollect();
  const data = {
    exported: new Date().toISOString(),
    totalSessions: sessions.length,
    sessions: sessions.map(s => ({
      id: s.id, title: s.title, ts: s.ts,
      messageCount: s.msgs?.length || 0,
      framework: s.framework || null,
    }))
  };
  dlF('chat_analytics.json', JSON.stringify(data, null, 2));
  showToast('JSON exported', 'ok');
}

