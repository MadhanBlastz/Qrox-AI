// ════════════════════════════════════════════
//  CONTEXT WINDOW METER  v5
//
//  Estimates token usage for the current
//  conversation and visualises it as a
//  colour-coded bar in the header.
//
//  Token estimation: ~1.33 tokens per word
//  (standard heuristic, ±15% accuracy).
//
//  ctxUpdate()    — recalculate and redraw
//  ctxGetLimit()  — look up current model's
//                   context window from PROVS
//  Called after every send() and on input.
// ════════════════════════════════════════════

const CTX = {
  dismissed75:  false,
  dismissed90:  false,
  lastPct:      0,
};

// ── Token estimator ───────────────────────────────────────────
function ctxEstimateTokens(text) {
  if (!text) return 0;
  // Approx: chars/4 is a decent heuristic (GPT-style BPE averages ~4 chars/token)
  return Math.ceil(text.length / 4);
}

function ctxTotalTokens() {
  // Sum all messages + system prompt estimate
  let total = 0;

  // System prompt (~500 tokens typical)
  total += 500;

  // All conversation messages
  S.msgs.forEach(m => {
    const text = typeof m.content === 'string' ? m.content
               : Array.isArray(m.content) ? m.content.map(p => p.text || '').join(' ') : '';
    total += ctxEstimateTokens(text) + 4; // +4 for role/separator tokens
  });

  // RAG context if active
  if (RAG?.docs?.length) total += RAG.docs.reduce((s,d) => s + (d.chunks?.length||0) * 200, 0);

  return total;
}

// ── Get context limit for current model ───────────────────────
function ctxGetLimit() {
  // Try current model first
  const cm = S.currentModel;
  if (cm) {
    const prov  = PROVS.find(p => p.id === cm.provId);
    const model = prov?.models.find(m => m.id === cm.modelId);
    if (model?.tokens) return model.tokens;
  }

  // Fallback: use S.settings.maxTokens as output budget, estimate 4× for context
  const outputBudget = S.settings?.maxTokens || 4096;
  return Math.max(outputBudget * 4, 16000);
}

// ── Main update ───────────────────────────────────────────────
function ctxUpdate() {
  const used   = ctxTotalTokens();
  const limit  = ctxGetLimit();
  const pct    = Math.min(100, Math.round((used / limit) * 100));
  const remain = Math.max(0, limit - used);
  CTX.lastPct  = pct;

  // Show/hide the meter
  const wrap = document.getElementById('ctxMeterWrap');
  if (!wrap) return;

  // Only show when there are messages
  if (!S.msgs.length) {
    wrap.style.display = 'none';
    _ctxHideBanner();
    return;
  }
  wrap.style.display = '';

  // Determine level
  const level = pct >= 90 ? 'danger' : pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
  const color  = level === 'danger' ? '#ef4444' : level === 'high' ? '#f97316' : level === 'mid' ? '#f59e0b' : '#10b981';

  // Update bar
  const fill = document.getElementById('ctxBarFill');
  if (fill) {
    fill.style.width = pct + '%';
    fill.className   = 'ctx-bar-fill ' + level;
  }

  // Update label
  const lbl = document.getElementById('ctxLabel');
  if (lbl) {
    lbl.textContent = pct + '%';
    lbl.className   = 'ctx-label' + (level === 'danger' ? ' danger' : level === 'high' ? ' high' : '');
  }

  // Update tooltip
  const fmtK = n => n >= 1000 ? (n/1000).toFixed(0)+'K' : String(n);
  _ctxSet('ctxTokUsed',    fmtK(used)   + ' tokens');
  _ctxSet('ctxTokLimit',   fmtK(limit)  + ' tokens');
  _ctxSet('ctxTokRemain',  fmtK(remain) + ' tokens');
  _ctxSet('ctxMsgCount',   S.msgs.length + ' messages');

  const tfill = document.getElementById('ctxTooltipFill');
  if (tfill) { tfill.style.width = pct + '%'; tfill.style.background = color; }

  const warnEl = document.getElementById('ctxTooltipWarn');
  if (warnEl) {
    if (pct >= 90) {
      warnEl.className = 'ctx-tooltip-crit';
      warnEl.textContent = '⛔ Critical — responses may be truncated. Start a new chat or clear history.';
    } else if (pct >= 75) {
      warnEl.className = 'ctx-tooltip-warn';
      warnEl.textContent = '⚠ Approaching limit — consider starting a new chat for complex tasks.';
    } else {
      warnEl.textContent = '';
    }
  }

  // Show warning banner
  _ctxUpdateBanner(pct, remain);
}

function _ctxSet(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _ctxUpdateBanner(pct, remain) {
  const banner  = document.getElementById('ctxWarningBanner');
  const textEl  = document.getElementById('ctxWarningText');
  if (!banner || !textEl) return;

  const fmtK = n => n >= 1000 ? (n/1000).toFixed(0)+'K' : String(n);

  if (pct >= 90 && !CTX.dismissed90) {
    banner.className  = 'ctx-warning-banner show crit';
    textEl.textContent = `⛔ Context window ${pct}% full (~${fmtK(remain)} tokens left) — start a new chat to avoid truncation`;
  } else if (pct >= 75 && !CTX.dismissed75) {
    banner.className  = 'ctx-warning-banner show warn';
    textEl.textContent = `⚠ Context window ${pct}% full — ${fmtK(remain)} tokens remaining`;
  } else {
    _ctxHideBanner();
  }
}

function _ctxHideBanner() {
  const banner = document.getElementById('ctxWarningBanner');
  if (banner) banner.classList.remove('show');
}

function ctxDismissWarning() {
  const pct = CTX.lastPct;
  if (pct >= 90) CTX.dismissed90 = true;
  else           CTX.dismissed75 = true;
  _ctxHideBanner();
}

// ── Reset dismissal on new chat ───────────────────────────────
function ctxReset() {
  CTX.dismissed75 = false;
  CTX.dismissed90 = false;
  CTX.lastPct     = 0;
  const wrap = document.getElementById('ctxMeterWrap');
  if (wrap) wrap.style.display = 'none';
  _ctxHideBanner();
}

// Close model picker on outside click (handled by overlay click in HTML)

// personaPickerToggle — for ctrl panel inline grid, just render
function personaPickerToggle() {
  personaRenderGrid();
}

// Update ctrl panel model name when model changes
function _ctrlUpdateModelName() {
  const el = document.getElementById('ctrlModelName');
  if (!el) return;
  const cm = S.currentModel;
  el.textContent = cm?.modelName || 'Auto';
}

