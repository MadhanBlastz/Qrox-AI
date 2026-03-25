// ════════════════════════════════════════════
function getAllAvailableModels() {
  const result = [];
  for (const e of S.priority) {
    if (!e.on) continue;
    const prov = PROVS.find(p => p.id === e.id);
    if (!prov || !prov.browserOk) continue;
    const hasKey = !!S.keys[prov.id];
    if (!hasKey && !prov.worksNoKey) continue;
    for (const model of prov.models) {
      result.push({ prov, model, hasKey });
    }
  }
  return result;
}

/* ── MODEL PICKER OVERLAY (flat, available keys only) ── */
let _mpickQuery = '';

function toggleModelPicker(triggerEl) {
  const overlay = document.getElementById('mpickOverlay');
  if (!overlay) return;
  if (overlay.classList.contains('open')) {
    closeModelPicker();
  } else {
    const sourceEl = document.getElementById('mpickSourceLabel');
    if (sourceEl) {
      const fromCtrl = triggerEl && triggerEl.closest && triggerEl.closest('#ctrlPanel');
      sourceEl.textContent = fromCtrl ? 'Control Panel' : 'Nav Bar';
      sourceEl.style.background = fromCtrl ? 'rgba(16,185,129,.15)' : 'rgba(99,102,241,.15)';
      sourceEl.style.borderColor = fromCtrl ? 'rgba(16,185,129,.3)' : 'rgba(99,102,241,.3)';
      sourceEl.style.color = fromCtrl ? '#6ee7b7' : '#a5b4fc';
    }
    _mpickQuery = '';
    const srch = document.getElementById('mpickSearch');
    if (srch) srch.value = '';
    renderModelPicker();
    overlay.classList.add('open');
    setTimeout(() => { document.getElementById('mpickSearch')?.focus(); }, 80);
  }
}

function closeModelPicker() {
  const overlay = document.getElementById('mpickOverlay');
  if (overlay) overlay.classList.remove('open');
}

function mpickFilter(q) {
  _mpickQuery = q.toLowerCase().trim();
  renderModelPicker();
}

function renderModelPicker() {
  const body = document.getElementById('mpickBody');
  if (!body) return;

  const forced       = S.forcedModel;
  const autoSelected = !forced;
  const bestModel    = S.currentModel;
  const enabledProvIds = new Set(S.priority.filter(e => e.on).map(e => e.id));

  // Collect only providers with an active key (or worksNoKey)
  const availableProvs = PROVS.filter(p =>
    p.browserOk &&
    enabledProvIds.has(p.id) &&
    (!!S.keys[p.id] || p.worksNoKey)
  );

  // Build flat model list filtered by search
  const allModels = [];
  availableProvs.forEach(prov => {
    prov.models.forEach(model => {
      if (_mpickQuery) {
        const match =
          model.name.toLowerCase().includes(_mpickQuery) ||
          prov.name.toLowerCase().includes(_mpickQuery) ||
          (model.id && model.id.toLowerCase().includes(_mpickQuery));
        if (!match) return;
      }
      allModels.push({ prov, model });
    });
  });

  let html = '';

  // Auto option
  if (!_mpickQuery) {
    html += `
      <div class="mpick-auto ${autoSelected ? 'selected' : ''}" onclick="setForcedModel(null)">
        <span class="mpick-auto-icon">⚡</span>
        <div class="mpick-auto-text">
          <div class="mpick-auto-name">Auto <span style="font-size:.58rem;padding:1px 6px;border-radius:6px;background:rgba(59,130,246,.15);color:#93c5fd;font-family:var(--fh);font-weight:700">DEFAULT</span></div>
          <div class="mpick-auto-sub">Best model for your task${bestModel ? ` — ${bestModel.modelName}` : ''}</div>
        </div>
        <div class="mpick-check ${autoSelected ? 'on' : ''}">✓</div>
      </div>
      <div style="height:1px;background:var(--line);margin:6px 0"></div>`;
  }

  if (allModels.length === 0) {
    if (_mpickQuery) {
      html += `<div style="padding:28px;text-align:center;color:var(--t4);font-size:.78rem;font-family:var(--fh)">
        <div style="font-size:1.8rem;margin-bottom:8px;opacity:.35">🔍</div>
        No models match "<strong>${_mpickQuery}</strong>"
      </div>`;
    } else {
      html += `<div style="padding:28px;text-align:center;color:var(--t4);font-size:.78rem;font-family:var(--fh);line-height:1.7">
        <div style="font-size:2rem;margin-bottom:8px;opacity:.35">🔑</div>
        No API keys set yet.<br>
        <span style="font-size:.7rem">Add keys in <strong style="color:var(--t2)">⚙ Settings → API Vault</strong> to unlock models.</span>
      </div>`;
    }
    body.innerHTML = html;
    return;
  }

  allModels.forEach(({ prov, model }) => {
    const isSelected = forced && forced.provId === prov.id && forced.modelId === model.id;
    const ctx = model.tokens >= 1000000 ? '1M ctx'
              : model.tokens >= 100000  ? `${Math.round(model.tokens / 1000)}K ctx`
              : model.tokens            ? `${model.tokens / 1000}K` : '';
    const keyBadge = prov.worksNoKey
      ? `<span style="font-size:.52rem;padding:1px 5px;border-radius:4px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);color:#6ee7b7;font-family:var(--fh);font-weight:700">FREE</span>`
      : '';
    html += `
      <div class="mpick-model ${isSelected ? 'selected' : ''}"
        data-prov="${esc(prov.id)}" data-model="${esc(model.id)}"
        onclick="clickPickModel(this)">
        <span class="mpick-model-logo">${prov.logo}</span>
        <div class="mpick-model-info">
          <div class="mpick-model-name">${esc(model.name)}</div>
          <div class="mpick-model-meta">
            <span class="mpick-model-prov">${esc(prov.name)}</span>
            ${ctx ? `<span class="mpick-ctx">· ${ctx}</span>` : ''}
            ${keyBadge}
          </div>
        </div>
        <div class="mpick-model-check">${isSelected ? '✓' : ''}</div>
      </div>`;
  });

  body.innerHTML = html;
}

function clickPickModel(el) {
  const provId  = el.dataset.prov;
  const modelId = el.dataset.model;
  const prov  = PROVS.find(p => p.id === provId);
  const model = prov?.models.find(m => m.id === modelId);
  if (!prov || !model) return;
  setForcedModel(provId, modelId, model.name, prov.logo, prov.color||'#6366f1', prov.tier);
}

function setForcedModel(provId, modelId, name, logo, color, tier) {
  if (!provId) {
    // Auto mode
    S.forcedModel = null;
    updateModelPickBtn(null);
    closeModelPicker();
    showToast('🤖 AI will choose the best model automatically', 'inf');
  } else {
    S.forcedModel = { provId, modelId, name, logo, color, tier };
    updateModelPickBtn(S.forcedModel);
    // Also update the pill to show forced model immediately
    S.currentModel = {
      provId, provName: PROVS.find(p=>p.id===provId)?.name||provId,
      modelId, modelName:name, isFallback:false,
      logo, color, tier, score:0
    };
    renderPill(S.currentModel);
    closeModelPicker();
    showToast(`✅ Locked to ${name}`, 'ok');
  }
}

function updateModelPickBtn(forced) {
  const btn   = document.getElementById('modelPickBtn');
  const icon  = document.getElementById('modelPickIcon');
  const label = document.getElementById('modelPickLabel');
  if (!forced) {
    btn.classList.remove('forced');
    icon.textContent  = '⚡';
    label.textContent = 'AI';
    btn.title = 'Model: Auto (AI chooses best)';
  } else {
    btn.classList.add('forced');
    icon.textContent  = forced.logo || '⚡';
    // Shorten name: take first word or first 10 chars
    const short = forced.name.split(' ')[0].slice(0,10);
    label.textContent = short;
    btn.title = `Model locked: ${forced.name}`;
  }
}

// Close picker on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('mpickOverlay');
    if (overlay && overlay.classList.contains('open')) {
      closeModelPicker();
    }
  }
});

let INPUT_MODE = 'chat';

function toggleInputMode() {
  setInputMode(INPUT_MODE === 'chat' ? 'agent' : 'chat');
}

function setInputMode(mode) {
  INPUT_MODE = mode;
  const isAgent = mode === 'agent';

  // Send button style — only update if NOT currently in stop mode
  const sndBtn = document.getElementById('sndBtn');
  if (sndBtn && !sndBtn.classList.contains('stop-mode')) {
    sndBtn.textContent = isAgent ? '✦' : '➤';
    sndBtn.style.background = isAgent
      ? 'linear-gradient(135deg,#7c3aed,#a78bfa)'
      : 'linear-gradient(135deg,var(--a1),var(--a2))';
    sndBtn.title = isAgent ? 'Analyse with Prompt AI' : 'Send to AI';
  }

  // Input row border
  const irow = document.getElementById('mainIrow');
  irow.style.borderColor = isAgent ? 'rgba(139,92,246,.5)' : '';
  irow.style.boxShadow   = isAgent ? '0 0 0 3px rgba(139,92,246,.08)' : '';

  // Placeholder
  document.getElementById('uIn').placeholder = isAgent
    ? 'Type a rough prompt → Agent will refine, suggest & expand it…'
    : (S.opts.build ? 'Describe what to build…' : 'Message the AI…');

  // Toolbar (framework pills) and build toggle visibility — only show when build ON and not agent mode
  const toolbar = document.getElementById('chatToolbarWrap');
  if(toolbar) toolbar.style.display = (!isAgent && S.opts?.build) ? '' : 'none';
  const buildWrap = document.getElementById('buildToggleWrap');
  if (buildWrap) buildWrap.style.display = isAgent ? 'none' : '';
  // Hide + menu in agent mode, show PA + menu instead
  const plusWrap   = document.getElementById('plusMenuWrap');
  const paPlusWrap = document.getElementById('paPlusMenuWrap');
  if (plusWrap)   plusWrap.style.display   = isAgent ? 'none' : '';
  if (paPlusWrap) paPlusWrap.style.display = isAgent ? '' : 'none';

  // Footer mode toggle switch
  const modeSwitch = document.getElementById('modeSwitch');
  if (modeSwitch) modeSwitch.classList.toggle('agent', isAgent);
  document.getElementById('imodeTip').textContent = isAgent
    ? 'Enter to analyse · Shift+Enter newline'
    : 'Enter to send · Shift+Enter newline';

  document.getElementById('uIn').focus();
}

// ── PLUS MENU (Thinking / Structured / Attach) ──
function togglePlusMenu() {
  const dd = document.getElementById('plusDropdown');
  const btn = document.getElementById('plusBtn');
  const isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  btn.classList.toggle('open', !isOpen);
  if (!isOpen) updatePlusItems();
}

function closePlusMenu() {
  const dd = document.getElementById('plusDropdown');
  const btn = document.getElementById('plusBtn');
  if (dd) dd.style.display = 'none';
  if (btn) btn.classList.remove('open');
}

function updatePlusItems() {
  const tBtn = document.getElementById('plus-think');
  const sBtn = document.getElementById('plus-structured');
  const cBtn = document.getElementById('plus-critique');
  if (tBtn) tBtn.classList.toggle('active', S.opts.think);
  if (sBtn) sBtn.classList.toggle('active', S.opts.structured);
  if (cBtn) cBtn.classList.toggle('active', CRITIQUE.enabled);
  toolsUpdateUI();
  ragUpdateUI();
}

function ragUpdateUI() {
  // KB badge in dropdown
  const badge = document.getElementById('ragKbBadge');
  if (badge) {
    if (RAG.docs.length) { badge.textContent=RAG.docs.length; badge.style.display=''; }
    else badge.style.display='none';
  }
  // Context pill above input
  const pill = document.getElementById('ragCtxPill');
  const query = document.getElementById('uIn')?.value||'';
  if (pill) {
    if (RAG.docs.length && ragNeedsContext(query)) {
      pill.innerHTML=`<span class="rag-ctx-indicator">📚 KB: ${RAG.docs.length} doc${RAG.docs.length!==1?'s':''} active</span>`;
      pill.style.display='';
    } else if (RAG.docs.length) {
      pill.innerHTML=`<span class="rag-ctx-indicator" style="opacity:.45">📚 ${RAG.docs.length} doc${RAG.docs.length!==1?'s':''}</span>`;
      pill.style.display='';
    } else {
      pill.style.display='none';
    }
  }
}

// Close plus menu on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#plusMenuWrap')) closePlusMenu();
});

// Unified Enter handler
function onUnifiedKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

// Stop any running generation
function stopGeneration() {
  if (S.controller) {
    S.controller.abort();
    S.controller = null;
  }
  // Remove any orphaned thinking bubbles immediately
  document.querySelectorAll('[id^="agent-thinking-"]').forEach(el => {
    if (el._timer) clearInterval(el._timer);
    el.remove();
  });
  if (PA.loading) {
    PA.loading = false;
    const paBody = document.getElementById('paBody');
    if (paBody) paBody.innerHTML = '<div style="padding:12px;color:var(--t4);font-size:.78rem">⛔ Stopped.</div>';
  }
  S.loading = false;
  AG.running = false;
  setSndBtn(false);
  setBuildStatus('idle', 'Stopped');
  showToast('Generation stopped', 'inf');
}

// Set send button state — loading=true shows stop btn, false shows send
function setSndBtn(loading) {
  const btn = document.getElementById('sndBtn');
  if (!btn) return;
  if (loading) {
    btn.innerHTML = '⏹';
    btn.title     = 'Stop generation';
    btn.classList.add('stop-mode');
    btn.disabled  = false;  // must stay enabled so user can click to stop
  } else {
    btn.innerHTML = INPUT_MODE === 'agent' ? '✦' : '➤';
    btn.title     = INPUT_MODE === 'agent' ? 'Analyse with Prompt AI' : 'Send';
    btn.classList.remove('stop-mode');
    btn.disabled  = false;
  }
}

function handleSend() {
  // If currently generating — act as stop button
  if (S.loading || AG.running || PA.loading) { stopGeneration(); return; }
  if (INPUT_MODE === 'agent') sendToPA();
  else send();
}

