// ════════════════════════════════════════════
//  API CALLERS  — never pre-throw on missing key; let the API surface its own error
// ════════════════════════════════════════════
// Sanitize a string to ISO-8859-1 safe ASCII for use in HTTP headers
function sanitizeHeader(str){
  return String(str||'').replace(/[^\x20-\x7E]/g,'').trim();
}

async function callAnthropic(prov,model,msgs,sys,maxTok,onChunk){
  const key=sanitizeHeader(S.keys[prov.id]||'');
  const streaming = !!onChunk;
  const body = {model:model.id,max_tokens:maxTok,system:sys,messages:msgs,stream:streaming};
  const r=await fetch(prov.apiBase,{
    method:'POST',
    headers:{'Content-Type':'application/json',...prov.authHdr(key)},
    body:JSON.stringify(body),
    signal:S.controller?.signal
  });
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    const msg=e?.error?.message||`HTTP ${r.status}`;
    if(r.status===401) throw new Error(`Anthropic: invalid key — get one at console.anthropic.com`);
    throw new Error(`Anthropic: ${msg}`);
  }
  if(!streaming){const d=await r.json();return d.content?.[0]?.text||'';}
  // SSE streaming
  let full='';
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='';
  while(true){
    const {done,value}=await reader.read();
    if(done) break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split('\n');buf=lines.pop();
    for(const line of lines){
      if(!line.startsWith('data:')) continue;
      const raw=line.slice(5).trim();
      if(raw==='[DONE]') break;
      try{
        const j=JSON.parse(raw);
        const delta=j.delta?.text||j.delta?.delta?.text||'';
        if(delta){full+=delta;onChunk(delta);}
      }catch{}
    }
  }
  return full||'';
}

async function callOpenAI(prov,model,msgs,sys,maxTok,onChunk){
  const key=sanitizeHeader(S.keys[prov.id]||'');
  const streaming = !!onChunk;
  // Providers that don't support a separate system message — prepend to first user msg
  const noSysRole = ['huggingface','cloudflare'].includes(prov.id);
  let messages;
  if(noSysRole) {
    messages = msgs.map((m,i) => i===0 && m.role==='user'
      ? {...m, content: sys + '\n\n' + (typeof m.content==='string'?m.content:JSON.stringify(m.content))}
      : m);
  } else {
    messages = [{role:'system',content:sys},...msgs];
  }

  const r=await fetch(prov.apiBase,{
    method:'POST',
    headers:{'Content-Type':'application/json',...prov.authHdr(key)},
    body:JSON.stringify({model:model.id,max_tokens:maxTok,messages,stream:streaming}),
    signal:S.controller?.signal
  });
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    const msg=e?.error?.message||e?.message||`HTTP ${r.status}`;
    if(r.status===401||r.status===403){
      const links={groq:'console.groq.com',openrouter:'openrouter.ai/keys',together:'api.together.xyz',mistral:'console.mistral.ai',huggingface:'huggingface.co/settings/tokens',deepinfra:'deepinfra.com/dashboard',cerebras:'cloud.cerebras.ai',siliconflow:'cloud.siliconflow.cn',fireworks:'fireworks.ai',nvidia:'build.nvidia.com',deepseek:'platform.deepseek.com'};
      throw new Error(`${prov.name}: invalid/missing key — get a free key at ${links[prov.id]||'the provider site'}`);
    }
    if(r.status===429) throw new Error(`${prov.name}: rate limit — switching to next provider`);
    throw new Error(`${prov.name}: ${msg}`);
  }
  if(!streaming){const d=await r.json();return d.choices?.[0]?.message?.content||'';}
  // SSE streaming — OpenAI compatible
  let full='';
  const reader=r.body.getReader();const dec=new TextDecoder();let buf='';
  while(true){
    const {done,value}=await reader.read();
    if(done) break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split('\n');buf=lines.pop();
    for(const line of lines){
      if(!line.startsWith('data:')) continue;
      const raw=line.slice(5).trim();
      if(raw==='[DONE]') continue;
      try{
        const j=JSON.parse(raw);
        const delta=j.choices?.[0]?.delta?.content||'';
        if(delta){full+=delta;onChunk(delta);}
      }catch{}
    }
  }
  return full||'';
}

async function callGemini(prov,model,msgs,sys,maxTok){
  const key=sanitizeHeader(S.keys[prov.id]||'');
  if(!key) throw new Error(`Gemini: free key needed — get yours in 30s at aistudio.google.com/apikey`);

  // Normalize model ID — strip suffixes Gemini API doesn't accept
  let modelId = model.id;
  // gemini-2.5-flash-thinking is a preview variant — map to correct API name
  if(modelId === 'gemini-2.5-flash-thinking') modelId = 'gemini-2.5-flash';

  const url=`${prov.apiBase}/${modelId}:generateContent?key=${key}`;

  // Enable thinking for 2.5+ models
  const isThinking = modelId.includes('2.5') || modelId.includes('3.') || model.id.includes('thinking');
  // Gemma models use a simpler config
  const isGemma    = modelId.includes('gemma');

  // Handle vision content in messages
  const contents = msgs.map(m => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (Array.isArray(m.content)) {
      const parts = m.content.map(p => {
        if (p.type === 'text') return { text: p.text };
        if (p.type === 'image_url') {
          const dataUrl = p.image_url?.url || '';
          const b64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (b64Match) return { inlineData: { mimeType: b64Match[1], data: b64Match[2] } };
        }
        return null;
      }).filter(Boolean);
      return { role, parts };
    }
    return { role, parts:[{ text: typeof m.content === 'string' ? m.content : '' }] };
  });

  const body = {
    system_instruction: { parts:[{ text:sys }] },
    contents,
    generationConfig: { maxOutputTokens:maxTok }
  };
  if(isThinking && !isGemma) body.generationConfig.thinkingConfig = { thinkingBudget:2048 };

  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:S.controller?.signal});
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    const msg=e?.error?.message||`HTTP ${r.status}`;
    if(r.status===400&&msg.includes('API_KEY')) throw new Error(`Gemini: invalid key — get a free one at aistudio.google.com/apikey`);
    if(r.status===400&&msg.includes('thinkingConfig')) {
      // Model doesn't support thinking — retry without it
      delete body.generationConfig.thinkingConfig;
      const r2=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:S.controller?.signal});
      if(!r2.ok) throw new Error(`Gemini: ${(await r2.json().catch(()=>({}))).error?.message||`HTTP ${r2.status}`}`);
      const d2=await r2.json();
      const parts2=d2.candidates?.[0]?.content?.parts||[];
      return parts2.filter(p=>p.text&&!p.thought).map(p=>p.text).join('') || parts2.filter(p=>p.text).map(p=>p.text).join('') || '';
    }
    if(r.status===429) throw new Error(`Gemini: rate limit — switching to next provider`);
    throw new Error(`Gemini: ${msg}`);
  }
  const d=await r.json();
  const parts=d.candidates?.[0]?.content?.parts||[];
  const txt=parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('') ||
            parts.filter(p=>p.text).map(p=>p.text).join('');
  if(!txt&&d.candidates?.[0]?.finishReason==='SAFETY') throw new Error('Gemini: blocked by safety filter — try rephrasing');
  if(!txt) throw new Error('Gemini: empty response');
  return txt;
}

async function callCohere(prov,model,msgs,sys,maxTok){
  const key=sanitizeHeader(S.keys[prov.id]||'');
  const r=await fetch(prov.apiBase,{
    method:'POST',
    headers:{'Content-Type':'application/json',...prov.authHdr(key)},
    body:JSON.stringify({model:model.id,max_tokens:maxTok,messages:[{role:'system',content:sys},...msgs.map(m=>({role:m.role,content:m.content}))]})
  ,
    signal:S.controller?.signal
  });
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    const msg=e?.message||e?.error?.message||`HTTP ${r.status}`;
    if(r.status===401) throw new Error(`Cohere: invalid key — get a free key at dashboard.cohere.com`);
    throw new Error(`Cohere: ${msg}`);
  }
  const d=await r.json();
  return d.message?.content?.[0]?.text||'';
}

async function callPollinations(prov,model,msgs,sys,maxTok){
  const attempt = async () => {
    const r=await fetch('https://text.pollinations.ai/openai',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model: model.id || 'openai-large',
        messages:[{role:'system',content:sys},...msgs],
        max_tokens:Math.min(maxTok,4096),
        private:true,
        seed:Math.floor(Math.random()*9999)
      }),
      signal:S.controller?.signal
    });
    if(!r.ok){
      const e=await r.json().catch(()=>({}));
      if(r.status===429) throw new Error('RATE_LIMIT');
      throw new Error(`Pollinations HTTP ${r.status}: ${e?.error||e?.message||'unknown'}`);
    }
    const d=await r.json();
    const txt=d.choices?.[0]?.message?.content;
    if(!txt) throw new Error('Pollinations: empty response');
    return txt;
  };
  try {
    return await attempt();
  } catch(e) {
    if(e.name==='AbortError') throw e;
    if(e.message==='RATE_LIMIT') {
      showToast('🌸 Pollinations rate limit — waiting 16s…','inf');
      await abortableDelay(16000);
      return await attempt();
    }
    if(e.message.includes('503')||e.message.includes('502')) {
      await abortableDelay(2000);
      return await attempt();
    }
    throw e;
  }
}
async function callHuggingFace(prov,model,msgs,sys,maxTok){
  const key=sanitizeHeader(S.keys[prov.id]||'');
  if(!key) throw new Error(`HuggingFace: free token needed — get one at huggingface.co/settings/tokens`);
  // HF inference API: merge system into first user message for compatibility
  const hfMsgs = msgs.map((m,i) => i===0 && m.role==='user'
    ? {...m, content: sys + '\n\n' + (typeof m.content==='string'?m.content:'')}
    : m);
  const r=await fetch(prov.apiBase,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body:JSON.stringify({model:model.id,max_tokens:Math.min(maxTok,4096),messages:hfMsgs}),
    signal:S.controller?.signal
  });
  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    const msg=e?.error?.message||e?.error||`HTTP ${r.status}`;
    if(r.status===401) throw new Error(`HuggingFace: invalid token — get one at huggingface.co/settings/tokens`);
    if(r.status===503) throw new Error(`HuggingFace: model loading — retry in ~20s`);
    if(r.status===422) throw new Error(`HuggingFace: model ${model.id} may not support chat — try another`);
    throw new Error(`HuggingFace: ${msg}`);
  }
  const d=await r.json();
  return d.choices?.[0]?.message?.content||'';
}

async function callCloudflare(prov,model,msgs,sys,maxTok){
  const key=sanitizeHeader(S.keys[prov.id]||'');
  const accountId=sanitizeHeader(S.keys['cloudflare_account']||'');
  if(!key||!accountId) throw new Error('Cloudflare: needs both API Token and Account ID — dash.cloudflare.com');
  const url=`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model.id}`;
  const r=await fetch(url,{
    method:'POST',
    headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({messages:[{role:'system',content:sys},...msgs],max_tokens:Math.min(maxTok,2048)})
  ,
    signal:S.controller?.signal
  });
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(`Cloudflare: ${e?.errors?.[0]?.message||`HTTP ${r.status}`}`);}
  const d=await r.json();
  return d.result?.response||d.choices?.[0]?.message?.content||'';
}


// Delay that cancels immediately if S.controller is aborted
function abortableDelay(ms) {
  return new Promise((resolve, reject) => {
    if (S.controller?.signal?.aborted) { reject(new DOMException('Aborted','AbortError')); return; }
    const id = setTimeout(resolve, ms);
    S.controller?.signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted','AbortError')); }, {once:true});
  });
}

const CALLERS={anthropic:callAnthropic,openai:callOpenAI,gemini:callGemini,cohere:callCohere,huggingface:callHuggingFace,pollinations:callPollinations,cloudflare:callCloudflare};

// ════════════════════════════════════════════
