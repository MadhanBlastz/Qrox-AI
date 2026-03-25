//  SYSTEM PROMPT
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  TASK ROUTING — Best Model Per Task Type
//  Research-backed rankings (March 2026):
//  Coding:   Qwen3-Coder-480B > DeepSeek R1 > Gemini 2.5 Flash > Codestral > GPT-4o
//  Thinking: DeepSeek R1 > Gemini 2.5 Pro > Claude Sonnet 4 > GPT-o1 > Groq DeepSeek-R1
//  Prompt:   Gemini 2.5 Flash > DeepSeek V3 > Llama 3.3 70B > Claude Haiku
//  Chat:     Claude Sonnet 4 > GPT-4o > Gemini 2.5 Flash > DeepSeek V3 > Llama 3.3 70B
// ════════════════════════════════════════════

// Task slot → ordered list of {provId, modelId, label, reason}
// First available (key exists OR worksNoKey) wins. Falls back down the list.
const TASK_CATALOG = {

  vision: {
    label:'Image / Vision', icon:'👁', color:'#f59e0b',
    bg:'linear-gradient(135deg,rgba(245,158,11,.2),rgba(217,119,6,.1))',
    subtitle:'Analyze images, designs, screenshots, diagrams',
    models:[
      { provId:'openai',      modelId:'gpt-4o',                               label:'GPT-4o',                    reason:'#1 vision · pixel-accurate design analysis',        score:10 },
      { provId:'gemini',      modelId:'gemini-2.5-flash',                      label:'Gemini 2.5 Flash',          reason:'Free · native multimodal · 1M ctx',                score:9,  freeNote:'Free key — aistudio.google.com' },
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'Exceptional visual understanding',                 score:9 },
      { provId:'groq',        modelId:'meta-llama/llama-4-maverick-17b-128e-instruct', label:'Llama 4 Maverick (Groq)', reason:'Natively multimodal · free · fast',         score:8,  freeNote:'Free key — console.groq.com' },
      { provId:'cerebras',    modelId:'llama-4-maverick-17b-128e',             label:'Llama 4 Maverick (Cerebras)',reason:'World fastest · free tier · multimodal',         score:8,  freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'openrouter',  modelId:'meta-llama/llama-4-maverick:free',      label:'Llama 4 Maverick (free)',   reason:'Free multimodal · 524K context',                  score:8,  freeNote:'Free via OpenRouter key' },
    ]
  },

  designcode: {
    label:'Design → Code', icon:'🎨', color:'#818cf8',
    bg:'linear-gradient(135deg,rgba(129,140,248,.2),rgba(99,102,241,.1))',
    subtitle:'Convert designs/screenshots to pixel-perfect code',
    models:[
      { provId:'openai',      modelId:'gpt-4o',                               label:'GPT-4o',                    reason:'Best vision + code combo · pixel-accurate',        score:10 },
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'Superb visual interpretation + clean code',        score:9 },
      { provId:'gemini',      modelId:'gemini-2.5-flash',                      label:'Gemini 2.5 Flash',          reason:'Free · native multimodal + strong coding',         score:9,  freeNote:'Free key — aistudio.google.com' },
      { provId:'groq',        modelId:'meta-llama/llama-4-maverick-17b-128e-instruct', label:'Llama 4 Maverick (Groq)', reason:'Free · multimodal · fast',                score:8,  freeNote:'Free key — console.groq.com' },
    ]
  },

  coding: {
    label:'Code Generation', icon:'💻', color:'#34d399',
    bg:'linear-gradient(135deg,rgba(52,211,153,.2),rgba(16,185,129,.1))',
    subtitle:'Writing, debugging & reviewing code',
    models:[
      { provId:'openrouter',  modelId:'qwen/qwen3-coder:free',                 label:'Qwen3 Coder 480B (free)',   reason:'#1 free coding · 262K ctx · state-of-art',         score:10, freeNote:'Free via OpenRouter key' },
      { provId:'fireworks',   modelId:'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct', label:'Qwen3 Coder 480B (FW)', reason:'#1 coding model · fast',        score:10, freeNote:'Free credits — fireworks.ai' },
      { provId:'cerebras',    modelId:'qwen-3-235b-a22b',                      label:'Qwen3 235B (Cerebras)',     reason:'1400+ t/s · top non-reasoning coding',             score:10, freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'openrouter',  modelId:'deepseek/deepseek-r1-0528:free',        label:'DeepSeek R1 0528 (free)',   reason:'Exceptional code reasoning & debugging',           score:9,  freeNote:'Free via OpenRouter key' },
      { provId:'groq',        modelId:'meta-llama/llama-4-maverick-17b-128e-instruct', label:'Llama 4 Maverick (Groq)', reason:'Free · fast · strong code',              score:9,  freeNote:'Free key — console.groq.com' },
      { provId:'gemini',      modelId:'gemini-2.5-flash',                      label:'Gemini 2.5 Flash',          reason:'Free · strong coding with thinking mode',          score:8,  freeNote:'Free key — aistudio.google.com' },
      { provId:'pollinations',modelId:'openai-large',                          label:'GPT-OSS 120B (Pollinations)',reason:'Zero-key · always available fallback',             score:7,  freeNote:'No key needed' },
      { provId:'mistral',     modelId:'codestral-latest',                      label:'Codestral',                 reason:'Mistral code specialist · 256K context',           score:10 },
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'Best overall code quality + explanations',         score:9 },
      { provId:'openai',      modelId:'gpt-4o',                                label:'GPT-4o',                    reason:'Industry standard · reliable outputs',             score:9 },
    ]
  },

  thinking: {
    label:'Reasoning / Thinking', icon:'🧠', color:'#60a5fa',
    bg:'linear-gradient(135deg,rgba(96,165,250,.2),rgba(59,130,246,.1))',
    subtitle:'Deep analysis, architecture, debugging logic',
    models:[
      { provId:'openrouter',  modelId:'deepseek/deepseek-r1-0528:free',        label:'DeepSeek R1 0528 (free)',   reason:'#1 open reasoning · chain-of-thought',             score:10, freeNote:'Free via OpenRouter key' },
      { provId:'gemini',      modelId:'gemini-2.5-flash-thinking',             label:'Gemini 2.5 Flash Thinking', reason:'Free · extended thinking mode',                    score:10, freeNote:'Free key — aistudio.google.com' },
      { provId:'cerebras',    modelId:'qwen-3-235b-a22b',                      label:'Qwen3 235B (Cerebras)',     reason:'Free · 1400 t/s · top reasoning model',            score:10, freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'openrouter',  modelId:'qwen/qwen3-235b-a22b:free',             label:'Qwen3 235B (free)',         reason:'Free · top reasoning via OpenRouter',              score:9,  freeNote:'Free via OpenRouter key' },
      { provId:'groq',        modelId:'qwen-qwq-32b',                          label:'Qwen QwQ 32B (Groq)',       reason:'Free · fast reasoning on Groq LPU',                score:9,  freeNote:'Free key — console.groq.com' },
      { provId:'pollinations',modelId:'openai-large',                          label:'GPT-OSS 120B (Pollinations)',reason:'Zero-key guaranteed fallback',                    score:7,  freeNote:'No key needed' },
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'Best architectural reasoning & planning',          score:9 },
      { provId:'openai',      modelId:'o3-mini',                               label:'o3-mini',                   reason:'OpenAI dedicated reasoning model',                 score:10 },
      { provId:'deepseek',    modelId:'deepseek-reasoner',                     label:'DeepSeek R1 (Direct)',      reason:'Direct R1 access with free credits',               score:10 },
    ]
  },

  prompt: {
    label:'Prompt AI', icon:'✨', color:'#a78bfa',
    bg:'linear-gradient(135deg,rgba(167,139,250,.2),rgba(139,92,246,.1))',
    subtitle:'Refine, suggest & expand prompts',
    models:[
      { provId:'gemini',      modelId:'gemini-2.5-flash',                      label:'Gemini 2.5 Flash',          reason:'Free · fast · excellent instruction following',    score:9,  freeNote:'Free key — aistudio.google.com' },
      { provId:'cerebras',    modelId:'llama-4-scout-17b-16e',                 label:'Llama 4 Scout (Cerebras)',  reason:'Free · ultra-fast · 2000+ t/s',                    score:8,  freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'groq',        modelId:'llama-3.3-70b-versatile',               label:'Llama 3.3 70B (Groq)',      reason:'Free · ultra-fast · strong structured output',     score:8,  freeNote:'Free key — console.groq.com' },
      { provId:'pollinations',modelId:'openai-large',                          label:'GPT-OSS 120B (Pollinations)',reason:'Zero-key · always available',                     score:7,  freeNote:'No key needed' },
      { provId:'openrouter',  modelId:'deepseek/deepseek-r1-0528:free',        label:'DeepSeek R1 0528 (free)',   reason:'Top reasoning for complex prompt analysis',        score:9,  freeNote:'Free via OpenRouter key' },
      { provId:'deepseek',    modelId:'deepseek-chat',                         label:'DeepSeek V3',               reason:'Excellent creative writing & rephrasing',          score:8 },
    ]
  },

  writing: {
    label:'Writing / Creative', icon:'✍️', color:'#fb923c',
    bg:'linear-gradient(135deg,rgba(251,146,60,.2),rgba(234,88,12,.1))',
    subtitle:'Essays, docs, creative writing, summarization',
    models:[
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'#1 writing quality · nuanced prose',               score:10 },
      { provId:'openai',      modelId:'gpt-4o',                                label:'GPT-4o',                    reason:'Excellent tone control & coherence',               score:9 },
      { provId:'gemini',      modelId:'gemini-2.5-flash',                      label:'Gemini 2.5 Flash',          reason:'Free · long-form · 1M context window',             score:8,  freeNote:'Free key — aistudio.google.com' },
      { provId:'cerebras',    modelId:'llama-4-maverick-17b-128e',             label:'Llama 4 Maverick (Cerebras)',reason:'Free · ultra-fast · strong creative writing',     score:8,  freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'groq',        modelId:'llama-3.3-70b-versatile',               label:'Llama 3.3 70B (Groq)',      reason:'Free · fast · good at creative tasks',             score:7,  freeNote:'Free key — console.groq.com' },
      { provId:'pollinations',modelId:'openai-large',                          label:'GPT-OSS 120B (Pollinations)',reason:'Zero-key fallback',                               score:6,  freeNote:'No key needed' },
    ]
  },

  math: {
    label:'Math / Analysis', icon:'📊', color:'#22d3ee',
    bg:'linear-gradient(135deg,rgba(34,211,238,.2),rgba(6,182,212,.1))',
    subtitle:'Equations, data analysis, statistics, science',
    models:[
      { provId:'openrouter',  modelId:'deepseek/deepseek-r1-0528:free',        label:'DeepSeek R1 0528 (free)',   reason:'#1 math reasoning · chain-of-thought',             score:10, freeNote:'Free via OpenRouter key' },
      { provId:'gemini',      modelId:'gemini-2.5-flash-thinking',             label:'Gemini 2.5 Flash Thinking', reason:'Free · extended thinking · STEM',                  score:10, freeNote:'Free key — aistudio.google.com' },
      { provId:'cerebras',    modelId:'qwen-3-235b-a22b',                      label:'Qwen3 235B (Cerebras)',     reason:'Free · fastest · top STEM model',                  score:10, freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'groq',        modelId:'qwen-qwq-32b',                          label:'Qwen QwQ 32B (Groq)',       reason:'Free · fast math/science reasoning',               score:9,  freeNote:'Free key — console.groq.com' },
      { provId:'openai',      modelId:'o3-mini',                               label:'o3-mini',                   reason:'OpenAI dedicated math/science reasoning',          score:10 },
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'Precise analytical reasoning',                    score:9 },
      { provId:'pollinations',modelId:'openai-large',                          label:'GPT-OSS 120B (Pollinations)',reason:'Zero-key fallback',                               score:6,  freeNote:'No key needed' },
    ]
  },

  chat: {
    label:'General Chat', icon:'💬', color:'#f472b6',
    bg:'linear-gradient(135deg,rgba(244,114,182,.2),rgba(236,72,153,.1))',
    subtitle:'Balanced speed + quality for conversation',
    models:[
      { provId:'gemini',      modelId:'gemini-2.5-flash',                      label:'Gemini 2.5 Flash',          reason:'Free · 1M context · versatile & fast',             score:9,  freeNote:'Free key — aistudio.google.com' },
      { provId:'cerebras',    modelId:'llama-4-scout-17b-16e',                 label:'Llama 4 Scout (Cerebras)',  reason:'Free · 2000+ t/s · natively multimodal',           score:9,  freeNote:'Free tier — cloud.cerebras.ai' },
      { provId:'groq',        modelId:'llama-3.3-70b-versatile',               label:'Llama 3.3 70B (Groq)',      reason:'Free · extremely fast responses',                  score:8,  freeNote:'Free key — console.groq.com' },
      { provId:'pollinations',modelId:'openai-large',                          label:'GPT-OSS 120B (Pollinations)',reason:'Zero-key · always available',                     score:7,  freeNote:'No key needed' },
      { provId:'anthropic',   modelId:'claude-sonnet-4-20250514',              label:'Claude Sonnet 4',           reason:'Best conversational quality & nuance',             score:10 },
      { provId:'openai',      modelId:'gpt-4o',                                label:'GPT-4o',                    reason:'Versatile · widely trusted · reliable',            score:9 },
      { provId:'deepseek',    modelId:'deepseek-chat',                         label:'DeepSeek V3',               reason:'High quality · generous free quota',               score:8 },
      { provId:'openrouter',  modelId:'meta-llama/llama-4-maverick:free',      label:'Llama 4 Maverick (free)',   reason:'Free · multimodal · 524K context',                score:8,  freeNote:'Free via OpenRouter key' },
    ]
  }
};

// Current active routing overrides (saved to localStorage)
// null = auto (use best available from catalog)
const ROUTING = {
  prompt:     null,
  thinking:   null,
  coding:     null,
  designcode: null,
  vision:     null,
  writing:    null,
  math:       null,
  chat:       null
};

function loadRouting(){
  try{ const r=JSON.parse(localStorage.getItem('eai_routing')||'{}'); Object.assign(ROUTING,r); }catch{}
}
function saveRouting(){ localStorage.setItem('eai_routing', JSON.stringify(ROUTING)); }

// Returns the best available {prov, model, rank} for a task type
function getBestForTask(taskKey){
  const catalog = TASK_CATALOG[taskKey];
  if(!catalog) return null;

  // If user pinned a model and it's available, use it
  const pinned = ROUTING[taskKey];
  if(pinned){
    const prov=PROVS.find(p=>p.id===pinned.provId);
    const model=prov?.models?.find(m=>m.id===pinned.modelId);
    const available = prov && (!!S.keys[prov.id]||prov.worksNoKey);
    if(available && model) return { prov, model, rank:0, pinned:true, catalogEntry:null };
  }

  // Find first available from ranked catalog
  for(let i=0;i<catalog.models.length;i++){
    const entry = catalog.models[i];
    const prov = PROVS.find(p=>p.id===entry.provId);
    if(!prov) continue;
    const available = !!S.keys[prov.id] || prov.worksNoKey;
    if(!available) continue;
    // Find model in prov.models
    const model = prov.models.find(m=>m.id===entry.modelId) || prov.models[0];
    if(!model) continue;
    return { prov, model, rank:i, pinned:false, catalogEntry:entry };
  }
  return null;
}

// Helper: is a provider enabled in the priority list?
function isProvEnabled(provId) {
  const entry = S.priority.find(e => e.id === provId);
  return entry ? entry.on : true; // default true if not found
}

// Models that support vision (image input)
const VISION_MODELS = new Set([
  // OpenAI
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-vision-preview', 'gpt-4.1',
  // Anthropic
  'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-5', 'claude-3-5-sonnet-20241022',
  // Google Gemini (all natively multimodal)
  'gemini-2.5-flash', 'gemini-2.5-flash-thinking', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash',
  // Llama 4 (natively multimodal — all variants)
  'llama-4-maverick-17b-128e', 'llama-4-scout-17b-16e',
  'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick:free', 'meta-llama/llama-4-scout:free',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct', 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo',
  'meta/llama-4-maverick-17b-128e-instruct',
  'accounts/fireworks/models/llama4-maverick-instruct-basic',
  'Llama-4-Maverick-17B-128E-Instruct',
  // OpenRouter GPT-OSS (vision capable)
  'openai/gpt-oss-120b:free', 'openai/gpt-oss-20b:free', 'openai-large',
  // Pixtral (Mistral vision model)
  'pixtral-large-latest',
]);

function modelSupportsVision(modelId) {
  return VISION_MODELS.has(modelId);
}

// Smart call for a specific task type with full fallback chain
async function smartCallForTask(taskKey, msgs, sys, maxTok, onChunk){
  if (S.forcedModel) return smartCall(msgs, sys, maxTok, onChunk);

  const catalog = TASK_CATALOG[taskKey];
  S.fbLog = [];
  const tried = new Set();

  // Check if this is a vision task (has image content in messages)
  const isVisionTask = taskKey === 'vision' || taskKey === 'designcode';
  const hasVisionContent = msgs.some(m =>
    Array.isArray(m.content) && m.content.some(p => p.type === 'image_url')
  );

  // Build eligible list — respects priority toggles, browserOk, key availability, and rate limits
  let eligible = (catalog?.models || []).filter(entry => {
    if (!isProvEnabled(entry.provId)) return false;
    const prov = PROVS.find(p => p.id === entry.provId);
    if (!prov || !prov.browserOk) return false;
    if (!(!!S.keys[prov.id] || prov.worksNoKey)) return false;
    if (hasVisionContent && !modelSupportsVision(entry.modelId)) return false;
    // Skip models currently rate-limited
    if (rlIsLimited(entry.provId, entry.modelId)) return false;
    return true;
  });

  // Warn if vision task but no vision models available — fall through to smartCall
  if (hasVisionContent && eligible.length === 0) {
    showToast('⚠ No vision-capable model available. Add a GPT-4o, Claude or Gemini key.', 'wrn');
    // Still try — smartCall may find something
  }

  if (!eligible.length) return smartCall(msgs, sys, maxTok, onChunk);

  for (const entry of eligible) {
    const key = entry.provId + ':' + entry.modelId;
    if (tried.has(key)) continue;
    tried.add(key);

    const prov  = PROVS.find(p => p.id === entry.provId);
    if (!prov) continue;
    const model = prov.models.find(m => m.id === entry.modelId) || prov.models[0];
    if (!model) continue;

    S.currentModel = {
      provId:prov.id, provName:prov.name,
      modelId:model.id, modelName:entry.label || model.name,
      isFallback: tried.size > 1,
      logo:prov.logo, color:prov.color, tier:prov.tier, score:entry.score
    };
    renderPill(S.currentModel);
    setDotState(onChunk ? 'streaming' : 'loading');

    try {
      const fn = CALLERS[prov.caller];
      if (!fn) throw new Error(`No caller for ${prov.caller}`);
      const text = await fn(prov, model, msgs, sys, maxTok, onChunk);
      if (!text?.trim()) throw new Error('Empty response');
      setDotState('ok');
      return {
        text, provId:prov.id, provName:prov.name,
        modelId:model.id, modelName:entry.label || model.name,
        isFallback: tried.size > 1,
        fbLog:[...S.fbLog], logo:prov.logo, color:prov.color||'#6366f1', tier:prov.tier
      };
    } catch(err) {
      // Always re-throw abort — user pressed stop, do not fallback
      if (err.name === 'AbortError') throw err;
      const isRateLimit = rlIsRateLimitError(err);
      if (isRateLimit) rlMark(entry.provId, entry.modelId);
      S.fbLog.push({ prov:prov.name, model:entry.label||model.name, err:err.message });
      setDotState('error');
      const remaining = eligible.length - tried.size;
      if (remaining > 0) {
        if (tried.size === 1) {
          const reason = isRateLimit ? 'rate limited' : 'unavailable';
          showToast(`⚡ ${entry.label||prov.name} ${reason} — trying alternatives…`, 'wrn');
        }
        await abortableDelay(isRateLimit ? 600 : 250);
      }
    }
  }

  // All task-catalog models exhausted — fall back to generic smartCall
  // which respects priority and finds any remaining enabled providers
  if (eligible.length && tried.size >= eligible.length) {
    showToast(`⚡ All ${catalog?.label || taskKey} models tried — using next available`, 'wrn');
  }
  return smartCall(msgs, sys, maxTok, onChunk);
}

function renderRoutingCards(){
  const container = document.getElementById('routingCards');
  if(!container) return;
  let html='';
  for(const [taskKey, catalog] of Object.entries(TASK_CATALOG)){
    const best = getBestForTask(taskKey);
    const available = catalog.models.filter(e=>{
      const p=PROVS.find(x=>x.id===e.provId);
      return p && (!!S.keys[p.id]||p.worksNoKey);
    }).length;

    html+=`<div class="rt-card">
      <div class="rt-card-hdr">
        <div class="rt-icon" style="background:${catalog.bg}">${catalog.icon}</div>
        <div>
          <div class="rt-title">${catalog.label}</div>
          <div class="rt-subtitle">${catalog.subtitle}</div>
        </div>
        <span class="rt-active-badge ${best?'rt-active':'rt-inactive'}">${best?'● ACTIVE':'○ NO MODEL'}</span>
      </div>
      <div class="rt-body">
        <div style="font-size:.63rem;color:var(--t3);font-family:var(--fh);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">${available} of ${catalog.models.length} models available</div>
        ${catalog.models.slice(0,5).map((entry,i)=>{
          const prov=PROVS.find(p=>p.id===entry.provId);
          const avail=prov&&(!!S.keys[prov.id]||prov.worksNoKey);
          const isActive=best&&best.catalogEntry===entry&&!best.pinned;
          const tierTag=prov?`rt-${prov.tier}-tag`:'';
          const tierLabel=prov?{free:'FREE',freemium:'FREEMIUM',paid:'PAID'}[prov.tier]:'';
          const stars='★'.repeat(Math.round(entry.score/2));
          const dotCls=isActive?'rt-dot-ok':avail?'rt-dot-fb':'rt-dot-no';
          return `<div class="rt-model-row">
            <span class="rt-rank">${i===0?'#1':`#${i+1}`}</span>
            <div class="rt-model-pill ${isActive?'active-model':avail?'available':'unavailable'}">
              <span class="rt-dot ${dotCls}"></span>
              <span class="rt-mprov-logo">${prov?.logo||'🤖'}</span>
              <span class="rt-mname" title="${esc(entry.reason)}">${esc(entry.label)}</span>
              <span class="rt-mprov">${esc(prov?.name||'')}</span>
              <span class="rt-stars">${stars}</span>
              ${prov?`<span class="rt-tier-tag ${tierTag}">${tierLabel}</span>`:''}
            </div>
          </div>
          ${!avail&&entry.freeNote?`<div class="rt-unlock">🔑 ${esc(entry.freeNote)} — <a href="${prov?.keyUrl||'#'}" target="_blank">Get free key</a></div>`:''}`;
        }).join('')}
        ${catalog.models.length>5?`<div style="font-size:.65rem;color:var(--t4);padding:3px 0">+${catalog.models.length-5} more fallback models</div>`:''}
      </div>
    </div>`;
  }
  container.innerHTML = html;
}

