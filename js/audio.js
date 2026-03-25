// ════════════════════════════════════════════
//  CONTROLS PANEL  v5
//  Sliders button in ifooter → popup with
//  persona / heatmap / ghost / agents / audio
// ════════════════════════════════════════════
function ctrlPanelToggle() {
  const panel = document.getElementById('ctrlPanel');
  const btn   = document.getElementById('ctrlBtnInline');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  btn?.classList.toggle('open', isOpen);
  if (isOpen) {
    ctrlUpdateToggles();
    personaRenderGrid?.();
    _ctrlUpdateModelName?.();
  }
}

function ctrlPanelClose() {
  document.getElementById('ctrlPanel')?.classList.remove('open');
  document.getElementById('ctrlBtnInline')?.classList.remove('open');
}

function ctrlUpdateToggles() {
  const set = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!on);
  };
  set('ctrlHeatmap',  HEATMAP.on);
  set('ctrlGhost',    GHOST.enabled);
  set('ctrlAgents',   !!S.opts?.agents);
  set('ctrlCritique', CRITIQUE.enabled);
  set('ctrlAudio',    AUDIO.playing);
  set('ctrlBuild',    !!S.opts?.build);
  set('ctrlVoice',    VOICE?.listening || false);
}

// Close on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('ctrlWrapInline');
  if (wrap && !wrap.contains(e.target)) ctrlPanelClose();
});

// ════════════════════════════════════════════
//  SETTINGS DROPDOWN  v5
//  ⚙ button in header → ⌘K, ?, Vault, etc.
// ════════════════════════════════════════════
function settingsDropdownToggle() {
  const dd  = document.getElementById('settingsDropdown');
  const btn = document.getElementById('settingsBtn');
  if (!dd) return;
  const isOpen = dd.classList.toggle('open');
  btn?.classList.toggle('on', isOpen);
}

function settingsDropdownClose() {
  document.getElementById('settingsDropdown')?.classList.remove('open');
  document.getElementById('settingsBtn')?.classList.remove('on');
}

// Close on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('settingsWrap');
  if (wrap && !wrap.contains(e.target)) settingsDropdownClose();
});

// ════════════════════════════════════════════
//  1. CONTEXT-LENGTH AWARE ROUTING  v5
//
//  Before send, estimates total prompt tokens.
//  If prompt exceeds selected model's context
//  window, auto-switches to the model with the
//  largest available context window for that
//  task type. Shows a toast + badge.
// ════════════════════════════════════════════

function ctxGetModelLimit(provId, modelId) {
  const prov  = PROVS.find(p => p.id === provId);
  const model = prov?.models.find(m => m.id === modelId);
  return model?.tokens || 8192;
}

function ctxEstimatePromptTokens(msgs, sys) {
  let total = Math.ceil((sys || '').length / 4) + 200; // system + overhead
  msgs.forEach(m => {
    const text = typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.map(p => p.text || '').join(' ') : '';
    total += Math.ceil(text.length / 4);
  });
  return total;
}

function ctxFindLargeContextModel(taskKey) {
  // Find the available model with the largest context window for this task
  const catalog = TASK_CATALOG[taskKey];
  const candidates = (catalog?.models || []).filter(entry => {
    if (!isProvEnabled(entry.provId)) return false;
    const prov = PROVS.find(p => p.id === entry.provId);
    return prov && prov.browserOk && (!!S.keys[prov.id] || prov.worksNoKey);
  });

  let best = null, bestTokens = 0;
  candidates.forEach(entry => {
    const prov  = PROVS.find(p => p.id === entry.provId);
    const model = prov?.models.find(m => m.id === entry.modelId);
    if (model?.tokens > bestTokens) {
      bestTokens = model.tokens;
      best = { ...entry, tokens: model.tokens, prov };
    }
  });
  return best;
}

function ctxCheckAndRoute(taskKey, msgs, sys) {
  if (!S.currentModel) return null;

  const promptTokens = ctxEstimatePromptTokens(msgs, sys);
  const limit        = ctxGetModelLimit(S.currentModel.provId, S.currentModel.modelId);
  const safeLimit    = Math.floor(limit * 0.85); // 85% threshold

  if (promptTokens <= safeLimit) return null; // no switch needed

  // Find a better model
  const better = ctxFindLargeContextModel(taskKey);
  if (!better || better.tokens <= limit) return null; // nothing better available

  const prov  = better.prov;
  const model = prov.models.find(m => m.id === better.modelId);
  if (!model) return null;

  // Switch to the larger context model
  const prevName = S.currentModel.modelName;
  S.forcedModel = { provId: prov.id, modelId: model.id };
  // Override just for this call — reset after
  const switched = {
    prevModel: prevName,
    newModel:  better.label || model.name,
    promptTokens,
    limit,
    newLimit:  better.tokens,
  };

  showToast(
    `📏 Context too long (~${promptTokens.toLocaleString()} tokens) — switched to ${switched.newModel} (${(better.tokens/1000).toFixed(0)}K ctx)`,
    'inf', 5000
  );
  return switched;
}

// ════════════════════════════════════════════
//  2. PER-MODEL SYSTEM PROMPT TUNING  v5
//
//  Different models respond better to different
//  instruction styles. Auto-transforms the
//  system prompt based on the active model
//  before it's sent.
//
//  GPT-4o      → concise, direct
//  DeepSeek R1 → explicit chain-of-thought
//  Llama       → explicit role assignment
//  Gemini      → structured headings
//  Claude      → plain natural language
//  Mistral     → explicit markdown formatting
// ════════════════════════════════════════════

const MODEL_PROMPT_STYLES = {
  // OpenAI — prefers concise, direct instructions
  openai: {
    transform: (sys) => sys
      .replace(/\n{3,}/g, '\n\n')           // collapse extra newlines
      .replace(/STRICT RULES:/g, 'Rules:')  // less formal headers
      .slice(0, 3000),                       // cap length
    suffix: '',
  },
  // DeepSeek — benefits from explicit CoT scaffolding
  deepseek: {
    transform: (sys) => sys,
    suffix: '\n\nIMPORTANT: Think step by step before answering. Show your reasoning process explicitly, then provide the final answer.',
  },
  // Groq/Llama — benefits from explicit role assignment at the top
  groq: {
    transform: (sys) => {
      if (sys.startsWith('You are')) return sys;
      return 'You are a highly capable AI assistant.\n\n' + sys;
    },
    suffix: '',
  },
  cerebras: {
    transform: (sys) => {
      if (sys.startsWith('You are')) return sys;
      return 'You are a highly capable AI assistant.\n\n' + sys;
    },
    suffix: '',
  },
  // Gemini — handles structured headings well
  gemini: {
    transform: (sys) => sys,
    suffix: '',
  },
  // Anthropic/Claude — prefers natural conversational tone
  anthropic: {
    transform: (sys) => sys
      .replace(/STRICT RULES:/g, 'Please follow these guidelines:')
      .replace(/UNIVERSAL RULES:/g, 'General guidelines:'),
    suffix: '',
  },
  // Mistral — benefits from explicit output format reminder
  mistral: {
    transform: (sys) => sys,
    suffix: '\n\nFormat your response clearly using markdown where appropriate.',
  },
};

function applyModelPromptStyle(sys, provId) {
  const style = MODEL_PROMPT_STYLES[provId];
  if (!style) return sys;
  let result = style.transform(sys);
  if (style.suffix) result += style.suffix;
  return result;
}

// ════════════════════════════════════════════
//  3. PROMPT COMPRESSION  v5
//
//  When session has >12 messages, compresses
//  older turns using the cheapest fast model
//  before sending to the primary model.
//  Keeps last 6 messages verbatim.
//  Shows a 🗜 Compressed badge on the response.
// ════════════════════════════════════════════

const COMPRESSION = {
  enabled:    true,
  threshold:  12,   // compress when msgs > this
  keepLast:   6,    // always keep last N messages verbatim
  lastSummary:'',   // cache last summary
  lastMsgCount: 0,
};

async function compressContextIfNeeded(msgs, sys) {
  if (!COMPRESSION.enabled) return { msgs, compressed: false };
  if (msgs.length <= COMPRESSION.threshold) return { msgs, compressed: false };

  const toCompress = msgs.slice(0, msgs.length - COMPRESSION.keepLast);
  const toKeep     = msgs.slice(msgs.length - COMPRESSION.keepLast);

  // Use cached summary if messages haven't changed
  if (toCompress.length === COMPRESSION.lastMsgCount && COMPRESSION.lastSummary) {
    const summaryMsg = { role: 'system', content: `[Earlier conversation summary]: ${COMPRESSION.lastSummary}` };
    return { msgs: [summaryMsg, ...toKeep], compressed: true, summary: COMPRESSION.lastSummary };
  }

  // Build compression prompt
  const convText = toCompress.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    const text = typeof m.content === 'string' ? m.content.slice(0, 400)
      : m.content?.find?.(p => p.type === 'text')?.text?.slice(0, 400) || '';
    return `${role}: ${text}`;
  }).join('\n\n');

  try {
    // Use smallest/fastest available model for compression
    const compressProv = PROVS.find(p =>
      (p.id === 'cerebras' || p.id === 'groq') &&
      (!!S.keys[p.id] || p.worksNoKey) && p.browserOk
    ) || PROVS.find(p => p.worksNoKey && p.browserOk);

    if (!compressProv) return { msgs, compressed: false };

    const compressModel = compressProv.models.find(m => m.tokens >= 8000) || compressProv.models[0];
    if (!compressModel) return { msgs, compressed: false };

    const fn = CALLERS[compressProv.caller];
    if (!fn) return { msgs, compressed: false };

    const compressSys  = 'Summarise this conversation in 150 words max. Focus on: decisions made, code written, key facts established, current task. Be specific.';
    const compressMsgs = [{ role: 'user', content: `Conversation to summarise:\n\n${convText}\n\nProvide a concise summary:` }];

    const summary = await fn(compressProv, compressModel, compressMsgs, compressSys, 200, null);
    if (!summary?.trim()) return { msgs, compressed: false };

    COMPRESSION.lastSummary  = summary.trim();
    COMPRESSION.lastMsgCount = toCompress.length;

    const summaryMsg = { role: 'system', content: `[Earlier conversation summary]: ${COMPRESSION.lastSummary}` };
    return { msgs: [summaryMsg, ...toKeep], compressed: true, summary: COMPRESSION.lastSummary };

  } catch(e) {
    return { msgs, compressed: false };
  }
}

// ════════════════════════════════════════════
//  4. TOKEN BUDGET ESTIMATOR  v5
//
//  Shows a real-time token + cost estimate
//  above the input as the user types.
//  Updates 300ms after keystroke.
//  Green → yellow → red as budget fills.
// ════════════════════════════════════════════

const TBE = { timer: null, visible: false };

function tbeUpdate(inputText) {
  clearTimeout(TBE.timer);
  if (!inputText?.trim()) { tbeHide(); return; }
  TBE.timer = setTimeout(() => _tbeRender(inputText), 300);
}

function _tbeRender(inputText) {
  const wrap    = document.getElementById('tbeBudget');
  const label   = document.getElementById('tbeLabel');
  const bar     = document.getElementById('tbeBar');
  const costEl  = document.getElementById('tbeCost');
  if (!wrap) return;

  // Estimate tokens: current input + existing history + system prompt
  const inputTokens  = Math.ceil(inputText.length / 4);
  const historyTokens= S.msgs.reduce((s, m) => {
    const t = typeof m.content === 'string' ? m.content : m.content?.find?.(p=>p.type==='text')?.text || '';
    return s + Math.ceil(t.length / 4);
  }, 0);
  const sysTokens    = 500; // system prompt estimate
  const totalTokens  = inputTokens + historyTokens + sysTokens;

  // Get model context limit
  const cm    = S.currentModel;
  const prov  = PROVS.find(p => p.id === cm?.provId);
  const model = prov?.models.find(m => m.id === cm?.modelId);
  const limit = model?.tokens || 8192;

  const pct = Math.min(1, totalTokens / limit);
  const pctDisplay = Math.round(pct * 100);

  // Cost estimate
  const price = cm ? costGetPrice(cm.provId, cm.modelId) : null;
  const outEst = Math.min(S.settings?.maxTokens || 1024, 800);
  const usd = price ? ((totalTokens * price.in + outEst * price.out) / 1_000_000) : null;
  const costStr = usd === null ? '' : usd === 0 ? 'free' : '$' + usd.toFixed(4);

  // Colour + state
  let state = 'tbe-ok', barColor = '#10b981';
  if (pct > 0.85) { state = 'tbe-danger'; barColor = '#ef4444'; }
  else if (pct > 0.65) { state = 'tbe-warn'; barColor = '#f59e0b'; }

  wrap.className = `tbe-wrap ${state}`;
  wrap.style.display = '';
  label.innerHTML = `<strong>~${totalTokens.toLocaleString()}</strong> / ${(limit/1000).toFixed(0)}K tokens (${pctDisplay}%)`;
  bar.style.width      = pctDisplay + '%';
  bar.style.background = barColor;
  if (costEl) costEl.textContent = costStr;
  TBE.visible = true;
}

function tbeHide() {
  const wrap = document.getElementById('tbeBudget');
  if (wrap) wrap.style.display = 'none';
  TBE.visible = false;
}

// ════════════════════════════════════════════
//  5. AUTO-DOWNGRADE ON RATE LIMIT  v5
//
//  Patches smartCall and smartCallForTask to
//  detect 429 / rate-limit errors and
//  immediately retry with the next cheaper
//  model in the same tier without surfacing
//  an error to the user.
//  Shows a small badge: "Rate limited — used X"
// ════════════════════════════════════════════

const RATE_LIMIT = {
  // Track which models hit rate limits (reset hourly)
  limited: new Set(),   // 'provId:modelId'
  resetTimer: null,
};

function rlMark(provId, modelId) {
  const key = provId + ':' + modelId;
  RATE_LIMIT.limited.add(key);
  // Auto-clear after 60s
  setTimeout(() => RATE_LIMIT.limited.delete(key), 60000);
}

function rlIsLimited(provId, modelId) {
  return RATE_LIMIT.limited.has(provId + ':' + modelId);
}

function rlIsRateLimitError(err) {
  const msg = err?.message?.toLowerCase() || '';
  return msg.includes('429') || msg.includes('rate limit') ||
         msg.includes('rate_limit') || msg.includes('too many requests') ||
         msg.includes('quota') || msg.includes('capacity');
}

// Inject rate-limit awareness into the model eligibility check
// Called before each attempt in smartCall/smartCallForTask
function rlFilterEligible(models) {
  return models.filter(m => !rlIsLimited(m.provId || m.prov?.id, m.modelId || m.model?.id));
}

// Show rate-limit downgrade badge on AI message
function rlInjectBadge(metaEl, originalModel, usedModel) {
  if (!metaEl || originalModel === usedModel) return;
  const badge = document.createElement('span');
  badge.className = 'compress-badge';
  badge.title     = `Rate limited on ${originalModel} — automatically used ${usedModel}`;
  badge.style.cssText = 'background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.25);color:#fde68a';
  badge.innerHTML = `⚡ Rate limited → ${usedModel}`;
  metaEl.appendChild(badge);
}

// ════════════════════════════════════════════
//  COST ESTIMATOR  v5
//
//  COST_TABLE maps provId+modelId → {in, out}
//  prices in USD per million tokens.
//  Free models show $0.00.
//  costUpdate() re-calculates after every send.
//  costGetForMsg(msg) → {tokens, usd} per bubble.
// ════════════════════════════════════════════

// Prices in USD per 1M tokens {in, out}
// Sources: provider pricing pages (approximate)
const COST_TABLE = {
  // OpenAI
  'openai:gpt-4o':              { in:2.50,  out:10.00 },
  'openai:gpt-4o-mini':         { in:0.15,  out:0.60  },
  'openai:o3-mini':             { in:1.10,  out:4.40  },
  'openai:gpt-4-turbo':         { in:10.00, out:30.00 },
  // Anthropic
  'anthropic:claude-sonnet-4-20250514': { in:3.00, out:15.00 },
  'anthropic:claude-opus-4-5':          { in:15.00,out:75.00 },
  'anthropic:claude-haiku-4-5-20251001':{ in:0.80, out:4.00  },
  // Gemini — free tier (approximated at paid rate for estimate)
  'gemini:gemini-2.5-flash':         { in:0.075, out:0.30  },
  'gemini:gemini-2.5-flash-thinking':{ in:0.075, out:3.50  },
  'gemini:gemini-2.0-flash':         { in:0.075, out:0.30  },
  // Mistral
  'mistral:mistral-large-latest': { in:2.00,  out:6.00  },
  'mistral:codestral-latest':     { in:1.00,  out:3.00  },
  // DeepSeek
  'deepseek:deepseek-chat':       { in:0.27,  out:1.10  },
  'deepseek:deepseek-reasoner':   { in:0.55,  out:2.19  },
  // Cohere
  'cohere:command-r-plus':        { in:2.50,  out:10.00 },
  'cohere:command-r':             { in:0.15,  out:0.60  },
  // Free / zero-cost providers
  'pollinations:openai-large':    { in:0, out:0 },
  'groq:meta-llama/llama-4-maverick-17b-128e-instruct': { in:0, out:0 },
  'groq:llama-3.3-70b-versatile': { in:0, out:0 },
  'groq:qwen-qwq-32b':            { in:0, out:0 },
  'cerebras:llama-4-scout-17b-16e':{ in:0, out:0 },
  'cerebras:qwen-3-235b-a22b':    { in:0, out:0 },
  'openrouter:deepseek/deepseek-r1-0528:free': { in:0, out:0 },
  'openrouter:qwen/qwen3-coder:free': { in:0, out:0 },
};

const COST = {
  sessionTotal: 0,    // USD for current session
  msgCosts:     [],   // [{msgIdx, tokens, usd, provId, modelId}]
  dismissed:    false,
};

function costEstimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function costGetPrice(provId, modelId) {
  const key = `${provId}:${modelId}`;
  return COST_TABLE[key] || null;
}

function costCalcUSD(inputTokens, outputTokens, provId, modelId) {
  const price = costGetPrice(provId, modelId);
  if (!price) return null; // unknown price
  return (inputTokens * price.in + outputTokens * price.out) / 1_000_000;
}

function costUpdate() {
  if (!S.msgs.length) {
    COST.sessionTotal = 0;
    COST.msgCosts = [];
    _costRenderPill();
    return;
  }

  const cm = S.currentModel;
  const provId  = cm?.provId  || 'unknown';
  const modelId = cm?.modelId || 'unknown';

  let total = 0;
  COST.msgCosts = [];

  // Build cumulative context for each assistant message
  let cumulativeInputTokens = 500; // system prompt overhead
  S.msgs.forEach((m, i) => {
    const text = typeof m.content === 'string' ? m.content
               : Array.isArray(m.content) ? m.content.map(p=>p.text||'').join(' ') : '';
    const tokens = costEstimateTokens(text);

    if (m.role === 'user') {
      cumulativeInputTokens += tokens;
    } else if (m.role === 'assistant') {
      const usd = costCalcUSD(cumulativeInputTokens, tokens, provId, modelId);
      COST.msgCosts.push({ msgIdx:i, tokens, inputTokens:cumulativeInputTokens, usd, provId, modelId });
      if (usd !== null) total += usd;
      cumulativeInputTokens += tokens;
    }
  });

  COST.sessionTotal = total;
  _costRenderPill();
  costInjectBadges();
}

function _costRenderPill() {
  const pill  = document.getElementById('costPill');
  const label = document.getElementById('costPillLabel');
  if (!pill || !label) return;

  const total = COST.sessionTotal;
  const isFree = COST.msgCosts.length > 0 && COST.msgCosts.every(c => c.usd === 0);
  const hasUnknown = COST.msgCosts.some(c => c.usd === null);

  if (isFree) {
    label.textContent = 'Free';
    pill.classList.add('nonzero');
  } else if (total === 0 && !COST.msgCosts.length) {
    label.textContent = '$0.00';
    pill.classList.remove('nonzero');
  } else {
    label.textContent = hasUnknown && total === 0 ? '~$?' : '$' + total.toFixed(4);
    pill.classList.toggle('nonzero', total > 0);
  }

  // Update tooltip body
  const body = document.getElementById('costTooltipBody');
  if (!body) return;

  const cm = S.currentModel;
  const provId  = cm?.provId  || '—';
  const modelId = cm?.modelId || '—';
  const price   = costGetPrice(provId, modelId);

  const totalToks = S.msgs.reduce((s,m) => {
    const t = typeof m.content==='string' ? m.content : m.content?.find?.(p=>p.type==='text')?.text||'';
    return s + costEstimateTokens(t);
  }, 0);
  const aiToks = COST.msgCosts.reduce((s,c) => s + c.tokens, 0);

  body.innerHTML = `
    <div class="cost-tooltip-row"><span class="cost-tooltip-lbl">Model</span><span class="cost-tooltip-val">${esc(modelId.split('/').pop() || '—')}</span></div>
    <div class="cost-tooltip-row"><span class="cost-tooltip-lbl">Est. input tokens</span><span class="cost-tooltip-val">${totalToks.toLocaleString()}</span></div>
    <div class="cost-tooltip-row"><span class="cost-tooltip-lbl">Est. output tokens</span><span class="cost-tooltip-val">${aiToks.toLocaleString()}</span></div>
    ${price ? `<div class="cost-tooltip-row"><span class="cost-tooltip-lbl">Rate (in/out)</span><span class="cost-tooltip-val">$${price.in}/$${price.out} /1M</span></div>` : ''}
    <div class="cost-tooltip-row"><span class="cost-tooltip-lbl">Session total</span><span class="cost-tooltip-val ${isFree?'free':''}">${isFree ? 'Free ✓' : '$' + total.toFixed(5)}</span></div>`;
}

function costShowDetail() {
  // Just show — tooltip already shows on hover, this is a click fallback
  showToast(COST.sessionTotal > 0
    ? `Session cost: $${COST.sessionTotal.toFixed(5)}`
    : 'Free model — no cost', 'inf');
}

// Inject tiny cost badges into AI message meta bars
function costInjectBadges() {
  if (!COST.msgCosts.length) return;
  const aiMsgs = document.querySelectorAll('#chatBox .msg.ai');
  COST.msgCosts.forEach((c, i) => {
    const msgEl = aiMsgs[i];
    if (!msgEl) return;
    const metaEl = msgEl.querySelector('.mmeta');
    if (!metaEl) return;
    // Remove old badge
    metaEl.querySelector('.cost-msg-badge')?.remove();
    if (c.usd === null) return; // unknown price
    const badge = document.createElement('span');
    badge.className = 'cost-msg-badge';
    badge.style.cssText = c.usd === 0
      ? 'background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#6ee7b7'
      : 'background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);color:#a5b4fc';
    badge.textContent = c.usd === 0 ? 'free' : '$' + c.usd.toFixed(4);
    badge.title = `~${c.tokens.toLocaleString()} output tokens`;
    metaEl.appendChild(badge);
  });
}

