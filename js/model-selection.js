// ════════════════════════════════════════════
//  SMART MODEL SELECTION
//  Ranks ALL available providers by score for current mode,
//  picks highest-scoring, falls back down the ranked list on error.
// ════════════════════════════════════════════
function getAvailableRanked(mode, skip=[]) {
  const candidates = [];
  for (const e of S.priority) {
    if (!e.on || skip.includes(e.id)) continue;
    const prov = PROVS.find(p => p.id === e.id); if (!prov) continue;
    if (!prov.browserOk) continue;
    const hk = !!S.keys[prov.id];
    if (!hk && !prov.worksNoKey) continue;

    // Add ALL models from this provider, scored individually
    for (const model of prov.models) {
      const isBest   = model.best?.includes(mode);
      const provScore  = prov.scores?.[mode] ?? 5;
      const modelScore = model.score ?? 5;
      // Boost models that explicitly target this mode
      const finalScore = (provScore * 0.5) + (modelScore * 0.4) + (isBest ? 1 : 0);
      candidates.push({ prov, model, score: finalScore });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function selectBest(mode, skip=[]) {
  const ranked = getAvailableRanked(mode, skip);
  if (!ranked.length) { S.currentModel=null; renderPill(null); return null; }
  const { prov, model } = ranked[0];
  S.currentModel = {
    provId:prov.id, provName:prov.name,
    modelId:model.id, modelName:model.name,
    isFallback: skip.length > 0,
    logo:prov.logo, color:prov.color, tier:prov.tier,
    score: ranked[0].score
  };
  renderPill(S.currentModel);
  return S.currentModel;
}

async function smartCall(msgs, sys, maxTok, onChunk){
  const autoFb = document.getElementById('togFb')?.classList.contains('on') !== false;
  S.fbLog = [];

  // If user has locked a specific model, try it first
  if (S.forcedModel) {
    const fp = PROVS.find(p => p.id === S.forcedModel.provId);
    const fm = fp?.models.find(m => m.id === S.forcedModel.modelId);
    if (fp && fm && isProvEnabled(fp.id) && (!!S.keys[fp.id] || fp.worksNoKey)) {
      S.currentModel = {
        provId:fp.id, provName:fp.name,
        modelId:fm.id, modelName:fm.name,
        isFallback:false, logo:fp.logo, color:fp.color, tier:fp.tier, score:fm.score||0
      };
      renderPill(S.currentModel);
      setDotState(onChunk ? 'streaming' : 'loading');
      try {
        const fn = CALLERS[fp.caller];
        if (!fn) throw new Error(`No caller for ${fp.caller}`);
        const text = await fn(fp, fm, msgs, sys, maxTok, onChunk);
        if (!text?.trim()) throw new Error('Empty response');
        setDotState('ok');
        return { text, provId:fp.id, provName:fp.name, modelId:fm.id, modelName:fm.name,
          isFallback:false, fbLog:[], logo:fp.logo, color:fp.color||'#6366f1', tier:fp.tier };
      } catch(err) {
        if (err.name === 'AbortError') throw err;
        S.fbLog.push({ prov:fp.name, model:fm.name, err:err.message });
        setDotState('error');
        showToast(`⚠ ${fm.name} failed — falling back to AI choice`, 'wrn');
      }
    }
  }

  const ranked = getAvailableRanked(S.mode, []);
  if (!ranked.length) throw new Error('No providers enabled — check the Priority tab in 🔑 API Vault and enable at least one provider.');

  // Check if messages contain vision content
  const needsVision = msgs.some(m =>
    Array.isArray(m.content) && m.content.some(p => p.type === 'image_url')
  );

  let lastErr = null;
  const tried = new Set();

  for (const { prov, model, score } of ranked) {
    const key = prov.id + ':' + model.id;
    if (tried.has(key)) continue;
    // Skip non-vision models when vision content is present
    if (needsVision && !modelSupportsVision(model.id)) continue;
    tried.add(key);

    S.currentModel = {
      provId:prov.id, provName:prov.name,
      modelId:model.id, modelName:model.name,
      isFallback: tried.size > 1,
      logo:prov.logo, color:prov.color, tier:prov.tier, score
    };
    renderPill(S.currentModel);
    setDotState(onChunk ? 'streaming' : 'loading');

    try {
      const fn = CALLERS[prov.caller];
      if (!fn) throw new Error(`No caller defined for '${prov.caller}'`);
      const text = await fn(prov, model, msgs, sys, maxTok, onChunk);
      if (!text?.trim()) throw new Error('Empty response from model');
      setDotState('ok');
      return {
        text, provId:prov.id, provName:prov.name,
        modelId:model.id, modelName:model.name,
        isFallback: tried.size > 1,
        fbLog:[...S.fbLog], logo:prov.logo, color:prov.color||'#6366f1', tier:prov.tier
      };
    } catch(err) {
      if (err.name === 'AbortError') throw err;
      lastErr = `${prov.name} (${model.name}): ${err.message}`;
      S.fbLog.push({ prov:prov.name, model:model.name, err:err.message });
      setDotState('error');
      // Mark rate-limited models to skip on next attempt
      if (rlIsRateLimitError(err)) rlMark(prov.id, model.id);
      if (!autoFb) throw new Error(lastErr);
      const provTried = [...tried].filter(k => k.startsWith(prov.id+':')).length;
      if (provTried === 1) showToast(`⚡ ${prov.name} unavailable — trying next…`, 'wrn');
      await abortableDelay(300);
    }
  }

  throw new Error(`All providers failed.\nLast: ${lastErr}`);
}
function renderPill(m){
  const dot=document.getElementById('modelDot'),name=document.getElementById('modelName'),prov=document.getElementById('modelProv'),fb=document.getElementById('fbBadge');
  if(!m){dot.className='mdot error';name.textContent='No model';prov.textContent='Open API Vault →';fb.style.display='none';return;}
  const TIER_COLORS={free:'#10b981',freemium:'#f59e0b',paid:'#ef4444'};
  const TIER_LABELS={free:'FREE',freemium:'FREEMIUM',paid:'PAID'};
  dot.className=m.isFallback?'mdot fallback':'mdot';
  name.textContent=m.modelName;
  const tc=TIER_COLORS[m.tier]||'#6366f1';
  const tl=TIER_LABELS[m.tier]||'';
  const scoreStars = m.score ? `<span style="margin-left:4px;font-size:.55rem;color:var(--yellow);letter-spacing:1px">${'★'.repeat(Math.round(Math.min(m.score,10)/2))}</span>` : '';
  prov.innerHTML=`${m.provName}${scoreStars} <span style="font-size:.55rem;padding:1px 5px;border-radius:5px;font-weight:700;font-family:var(--fh);background:rgba(${hexRgb(tc)},.15);border:1px solid rgba(${hexRgb(tc)},.3);color:${tc};margin-left:2px">${tl}</span>`;
  fb.style.display=m.isFallback?'inline-flex':'none';
  _ctrlUpdateModelName?.();
}
function setDotState(s){const d=document.getElementById('modelDot');if(s==='loading')d.className='mdot loading';else if(s==='streaming')d.className='mdot streaming';else if(s==='error')d.className='mdot error';else d.className=S.currentModel?.isFallback?'mdot fallback':'mdot';}

