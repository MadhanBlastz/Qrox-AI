// ════════════════════════════════════════════
//  PROVIDERS
// ════════════════════════════════════════════
// tier: 'free'|'freemium'|'paid'
// worksNoKey: true = zero-key, zero-signup, works RIGHT NOW
// browserOk:  true = API allows direct browser fetch (CORS OK)
//             false = CORS blocked from browser — provider won't work without a server proxy
// score: quality 1-10 per mode
const PROVS = [

  // ══ FREE — no key, CORS OK ══
  {
    id:'pollinations', tier:'free', worksNoKey:true, browserOk:true,
    name:'Pollinations AI', logo:'🌸', color:'#ec4899',
    bg:'linear-gradient(135deg,rgba(236,72,153,.15),rgba(236,72,153,.05))',
    freeNote:'100% free · No key · No sign-up required',
    desc:'Zero-key fallback · GPT-OSS 120B/20B · always available',
    keyUrl:'https://pollinations.ai',
    apiBase:'https://text.pollinations.ai/openai',
    authHdr:()=>({}),
    scores:{fullstack:6,frontend:6,backend:5,debug:6,review:5,architect:5},
    models:[
      {id:'openai-large', name:'GPT-OSS 120B (Pollinations)', best:['fullstack','architect','debug'], tokens:200000, score:7},
      {id:'openai-fast',  name:'GPT-OSS 20B (Pollinations)',  best:['debug','frontend'],              tokens:16000,  score:5},
      {id:'openai-fast',  name:'GPT-OSS 20B (Pollinations)',  best:['frontend','debug'],              tokens:16000,  score:5},
    ],
    caller:'pollinations'
  },

  // ══ FREEMIUM — free key on sign-up, CORS OK ══
  {
    id:'gemini', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'Google AI Studio', logo:'✴️', color:'#4285f4',
    bg:'linear-gradient(135deg,rgba(66,133,244,.15),rgba(66,133,244,.05))',
    freeNote:'Free key — aistudio.google.com/apikey (30 sec)',
    desc:'Generous free quota · 1M context · Thinking mode · CORS OK',
    keyUrl:'https://aistudio.google.com/apikey',
    apiBase:'https://generativelanguage.googleapis.com/v1beta/models',
    authHdr:()=>({}),
    scores:{fullstack:9,frontend:9,backend:8,debug:9,review:9,architect:9},
    models:[
      {id:'gemini-2.5-flash',          name:'Gemini 2.5 Flash',         best:['fullstack','frontend','debug','backend','review','architect'], tokens:1000000, score:9},
      {id:'gemini-2.5-flash-thinking', name:'Gemini 2.5 Flash Thinking', best:['architect','review','debug'],                                 tokens:1000000, score:10},
      {id:'gemini-2.0-flash',          name:'Gemini 2.0 Flash',          best:['frontend','debug','backend'],                                  tokens:1000000, score:7},
      {id:'gemma-3-27b-it',            name:'Gemma 3 27B',               best:['frontend','debug'],                                            tokens:131000,  score:6},
    ],
    caller:'gemini'
  },
  {
    id:'cerebras', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'Cerebras', logo:'⚡', color:'#f43f5e',
    bg:'linear-gradient(135deg,rgba(244,63,94,.15),rgba(244,63,94,.05))',
    freeNote:'Free tier — cloud.cerebras.ai · 1M tokens/day · world fastest',
    desc:'3000+ t/s inference · Llama 4 + Qwen3 235B · CORS OK',
    keyUrl:'https://cloud.cerebras.ai',
    apiBase:'https://api.cerebras.ai/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:9,frontend:8,backend:9,debug:9,review:8,architect:9},
    models:[
      {id:'llama-4-scout-17b-16e',     name:'Llama 4 Scout (Cerebras)',    best:['fullstack','frontend','debug'],   tokens:131000, score:9},
      {id:'llama-4-maverick-17b-128e', name:'Llama 4 Maverick (Cerebras)', best:['architect','backend','review'],   tokens:131000, score:9},
      {id:'qwen-3-235b-a22b',          name:'Qwen3 235B (Cerebras)',       best:['fullstack','architect'],          tokens:131000, score:10},
      {id:'llama-3.3-70b',             name:'Llama 3.3 70B (Cerebras)',    best:['backend','debug'],                tokens:128000, score:8},
      {id:'llama3.1-8b',               name:'Llama 3.1 8B (Cerebras)',     best:['debug','frontend'],               tokens:8192,   score:6},
    ],
    caller:'openai'
  },
  {
    id:'groq', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'Groq Cloud', logo:'🔥', color:'#f55036',
    bg:'linear-gradient(135deg,rgba(245,80,54,.15),rgba(245,80,54,.05))',
    freeNote:'Free key — console.groq.com · 549 t/s on Llama 4',
    desc:'Ultra-fast LPU inference · Llama 4 · CORS OK',
    keyUrl:'https://console.groq.com/keys',
    apiBase:'https://api.groq.com/openai/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:8,frontend:8,backend:8,debug:9,review:8,architect:8},
    models:[
      {id:'meta-llama/llama-4-maverick-17b-128e-instruct', name:'Llama 4 Maverick (Groq)', best:['fullstack','backend','review'],         tokens:131000, score:9},
      {id:'meta-llama/llama-4-scout-17b-16e-instruct',     name:'Llama 4 Scout (Groq)',    best:['frontend','debug','backend'],           tokens:131000, score:8},
      {id:'llama-3.3-70b-versatile',                       name:'Llama 3.3 70B (Groq)',    best:['fullstack','backend','debug','review'], tokens:128000, score:8},
      {id:'qwen-qwq-32b',                                  name:'Qwen QwQ 32B (Groq)',     best:['architect','review'],                   tokens:128000, score:9},
      {id:'deepseek-r1-distill-qwen-32b',                  name:'DeepSeek R1 Qwen 32B',    best:['architect','debug'],                    tokens:128000, score:8},
      {id:'llama-3.1-8b-instant',                          name:'Llama 3.1 8B Instant',    best:['debug','frontend'],                     tokens:128000, score:6},
      {id:'openai/gpt-oss-120b',                           name:'GPT-OSS 120B (Groq)',      best:['fullstack','architect'],                tokens:200000, score:9},
    ],
    caller:'openai'
  },
  {
    id:'openrouter', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'OpenRouter', logo:'🛣️', color:'#7c3aed',
    bg:'linear-gradient(135deg,rgba(124,58,237,.15),rgba(124,58,237,.05))',
    freeNote:'Free key — openrouter.ai/keys · 27+ free models · 20 RPM',
    desc:'One key · 200+ models · Llama 4 · Qwen3 · CORS OK',
    keyUrl:'https://openrouter.ai/keys',
    apiBase:'https://openrouter.ai/api/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${sanitizeHeader(k)}`,'HTTP-Referer':location.origin.replace(/[^\x20-\x7E]/g,''),'X-Title':'Qrox AI'}),
    scores:{fullstack:10,frontend:9,backend:9,debug:9,review:9,architect:10},
    models:[
      {id:'qwen/qwen3-coder:free',                         name:'Qwen3 Coder 480B (free)',    best:['fullstack','backend','debug'],     tokens:262000, score:10},
      {id:'deepseek/deepseek-r1-0528:free',                name:'DeepSeek R1 0528 (free)',    best:['architect','review','debug'],      tokens:64000,  score:10},
      {id:'meta-llama/llama-4-maverick:free',              name:'Llama 4 Maverick (free)',    best:['fullstack','frontend','backend'],  tokens:524000, score:9},
      {id:'meta-llama/llama-4-scout:free',                 name:'Llama 4 Scout (free)',       best:['frontend','debug','backend'],      tokens:524000, score:8},
      {id:'openai/gpt-oss-120b:free',                      name:'GPT-OSS 120B (free)',        best:['fullstack','architect'],           tokens:131000, score:9},
      {id:'qwen/qwen3-235b-a22b:free',                     name:'Qwen3 235B (free)',          best:['architect','fullstack'],           tokens:131000, score:9},
      {id:'deepseek/deepseek-v3-0324:free',                name:'DeepSeek V3 0324 (free)',    best:['fullstack','backend'],             tokens:131000, score:9},
      {id:'nvidia/nemotron-3-super-120b-a12b:free',        name:'Nemotron Super 120B (free)', best:['fullstack','backend'],             tokens:262000, score:8},
      {id:'meta-llama/llama-3.3-70b-instruct:free',        name:'Llama 3.3 70B (free)',       best:['backend','debug'],                 tokens:66000,  score:7},
      {id:'mistralai/mistral-small-3.1-24b-instruct:free', name:'Mistral Small 3.1 (free)',   best:['frontend','debug'],                tokens:128000, score:7},
      {id:'google/gemma-3-27b-it:free',                    name:'Gemma 3 27B (free)',         best:['frontend'],                        tokens:131000, score:6},
      {id:'openrouter/free',                               name:'OpenRouter Auto (free)',     best:['debug'],                           tokens:200000, score:6},
    ],
    caller:'openai'
  },
  {
    id:'huggingface', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'Hugging Face', logo:'🤗', color:'#ff9d00',
    bg:'linear-gradient(135deg,rgba(255,157,0,.15),rgba(255,157,0,.05))',
    freeNote:'Free token — huggingface.co/settings/tokens',
    desc:'Free token · 1000s of open models · Llama 4 · CORS OK',
    keyUrl:'https://huggingface.co/settings/tokens',
    apiBase:'https://api-inference.huggingface.co/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:7,frontend:6,backend:6,debug:7,review:6,architect:5},
    models:[
      {id:'meta-llama/Llama-4-Maverick-17B-128E-Instruct', name:'Llama 4 Maverick (HF)',  best:['fullstack','debug','frontend'], tokens:131000, score:8},
      {id:'meta-llama/Llama-4-Scout-17B-16E-Instruct',     name:'Llama 4 Scout (HF)',     best:['frontend','debug'],             tokens:131000, score:7},
      {id:'Qwen/Qwen2.5-72B-Instruct',                     name:'Qwen 2.5 72B (HF)',      best:['fullstack','debug'],            tokens:8192,   score:7},
      {id:'meta-llama/Llama-3.1-8B-Instruct',              name:'Llama 3.1 8B (HF)',      best:['debug','backend'],              tokens:8192,   score:6},
    ],
    caller:'huggingface'
  },
  {
    id:'deepseek', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'DeepSeek AI', logo:'🐳', color:'#1b6cf2',
    bg:'linear-gradient(135deg,rgba(27,108,242,.15),rgba(27,108,242,.05))',
    freeNote:'Free credits on signup — platform.deepseek.com',
    desc:'R1 reasoning + V3 coding · Free credits · CORS OK',
    keyUrl:'https://platform.deepseek.com/api_keys',
    apiBase:'https://api.deepseek.com/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:9,frontend:8,backend:9,debug:9,review:9,architect:10},
    models:[
      {id:'deepseek-chat',    name:'DeepSeek V3', best:['fullstack','backend','debug','review'], tokens:64000, score:9},
      {id:'deepseek-reasoner',name:'DeepSeek R1', best:['architect','fullstack','review'],       tokens:64000, score:10},
    ],
    caller:'openai'
  },
  {
    id:'mistral', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'Mistral AI', logo:'🌀', color:'#ff7000',
    bg:'linear-gradient(135deg,rgba(255,112,0,.15),rgba(255,112,0,.05))',
    freeNote:'Free trial credits — console.mistral.ai',
    desc:'Codestral code specialist · 256K context · CORS OK',
    keyUrl:'https://console.mistral.ai/api-keys',
    apiBase:'https://api.mistral.ai/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:8,frontend:7,backend:8,debug:8,review:8,architect:8},
    models:[
      {id:'mistral-large-latest', name:'Mistral Large 2',  best:['architect','review','fullstack'],  tokens:128000, score:9},
      {id:'codestral-latest',     name:'Codestral',        best:['fullstack','debug','backend'],     tokens:256000, score:10},
      {id:'mistral-small-latest', name:'Mistral Small 3',  best:['frontend','debug'],                tokens:32000,  score:7},
      {id:'pixtral-large-latest', name:'Pixtral Large',    best:['frontend','architect'],            tokens:131000, score:8},
    ],
    caller:'openai'
  },
  {
    id:'siliconflow', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'SiliconFlow', logo:'💎', color:'#76b900',
    bg:'linear-gradient(135deg,rgba(118,185,0,.15),rgba(118,185,0,.05))',
    freeNote:'Free credits — cloud.siliconflow.cn',
    desc:'Fast open model hosting · DeepSeek + Qwen · CORS OK',
    keyUrl:'https://cloud.siliconflow.cn/account/ak',
    apiBase:'https://api.siliconflow.cn/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:7,frontend:7,backend:7,debug:8,review:7,architect:7},
    models:[
      {id:'Qwen/Qwen2.5-Coder-32B-Instruct', name:'Qwen 2.5 Coder 32B', best:['fullstack','debug','backend'],  tokens:32768, score:8},
      {id:'deepseek-ai/DeepSeek-V3',          name:'DeepSeek V3',        best:['fullstack','architect'],        tokens:65536, score:9},
      {id:'Qwen/Qwen2.5-72B-Instruct',        name:'Qwen 2.5 72B',      best:['frontend','debug'],             tokens:32768, score:7},
    ],
    caller:'openai'
  },
  {
    id:'fireworks', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'Fireworks AI', logo:'🎆', color:'#f97316',
    bg:'linear-gradient(135deg,rgba(249,115,22,.15),rgba(249,115,22,.05))',
    freeNote:'Free credits on signup — fireworks.ai',
    desc:'Llama 4 + Qwen3 Coder · Fast inference · CORS OK',
    keyUrl:'https://fireworks.ai/account/api-keys',
    apiBase:'https://api.fireworks.ai/inference/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:8,frontend:7,backend:8,debug:8,review:7,architect:8},
    models:[
      {id:'accounts/fireworks/models/llama4-maverick-instruct-basic', name:'Llama 4 Maverick (FW)',  best:['fullstack','backend','debug'],  tokens:131000, score:9},
      {id:'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct', name:'Qwen3 Coder 480B (FW)', best:['fullstack','debug'],            tokens:262000, score:10},
      {id:'accounts/fireworks/models/deepseek-r1',                    name:'DeepSeek R1 (FW)',       best:['architect','review'],           tokens:64000,  score:9},
      {id:'accounts/fireworks/models/qwen2p5-coder-32b-instruct',     name:'Qwen 2.5 Coder 32B',    best:['debug','backend'],              tokens:32000,  score:8},
    ],
    caller:'openai'
  },
  {
    id:'nvidia', tier:'freemium', worksNoKey:false, browserOk:true,
    name:'NVIDIA NIM', logo:'💚', color:'#76b900',
    bg:'linear-gradient(135deg,rgba(118,185,0,.15),rgba(118,185,0,.05))',
    freeNote:'Free credits — build.nvidia.com',
    desc:'NVIDIA hosted frontier models · CORS OK',
    keyUrl:'https://build.nvidia.com',
    apiBase:'https://integrate.api.nvidia.com/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:8,frontend:7,backend:8,debug:8,review:8,architect:9},
    models:[
      {id:'meta/llama-4-maverick-17b-128e-instruct', name:'Llama 4 Maverick (NVIDIA)', best:['fullstack','architect'],  tokens:131000, score:9},
      {id:'deepseek-ai/deepseek-r1',                 name:'DeepSeek R1 (NVIDIA)',      best:['architect','review'],     tokens:16000,  score:10},
      {id:'qwen/qwen3-235b-a22b',                    name:'Qwen3 235B (NVIDIA)',       best:['fullstack','architect'],  tokens:131000, score:10},
      {id:'mistralai/codestral-22b-instruct-v0.1',   name:'Codestral 22B (NVIDIA)',    best:['debug','backend'],        tokens:32768,  score:8},
    ],
    caller:'openai'
  },

  // ══ PAID — key required, pay per use ══
  {
    id:'anthropic', tier:'paid', worksNoKey:false, browserOk:true,
    name:'Anthropic Claude', logo:'🔷', color:'#cc785c',
    bg:'linear-gradient(135deg,rgba(204,120,92,.15),rgba(204,120,92,.05))',
    desc:'Best reasoning & code quality · CORS OK',
    keyUrl:'https://console.anthropic.com/account/keys',
    apiBase:'https://api.anthropic.com/v1/messages',
    authHdr:k=>({'x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}),
    scores:{fullstack:10,frontend:9,backend:9,debug:9,review:10,architect:10},
    models:[
      {id:'claude-sonnet-4-20250514',   name:'Claude Sonnet 4',  best:['fullstack','architect','review'],  tokens:64000,  score:10},
      {id:'claude-haiku-4-5-20251001',  name:'Claude Haiku 4.5', best:['debug','frontend'],                tokens:32000,  score:8},
      {id:'claude-opus-4-5',            name:'Claude Opus 4.5',  best:['architect','review'],              tokens:200000, score:10},
    ],
    caller:'anthropic'
  },
  {
    id:'openai', tier:'paid', worksNoKey:false, browserOk:true,
    name:'OpenAI', logo:'🟢', color:'#10a37f',
    bg:'linear-gradient(135deg,rgba(16,163,127,.15),rgba(16,163,127,.05))',
    desc:'GPT-4o · Vision · o3-mini · Industry standard · CORS OK',
    keyUrl:'https://platform.openai.com/api-keys',
    apiBase:'https://api.openai.com/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:9,frontend:9,backend:9,debug:9,review:9,architect:9},
    models:[
      {id:'gpt-4o',      name:'GPT-4o',      best:['fullstack','architect','review'],  tokens:128000,  score:9},
      {id:'gpt-4o-mini', name:'GPT-4o Mini', best:['debug','frontend','backend'],      tokens:128000,  score:7},
      {id:'o1-mini',     name:'o1-mini',     best:['architect','review'],              tokens:65536,   score:9},
      {id:'o3-mini',     name:'o3-mini',     best:['architect','debug'],               tokens:200000,  score:10},
      {id:'gpt-4.1',     name:'GPT-4.1',     best:['fullstack','frontend'],            tokens:1000000, score:9},
    ],
    caller:'openai'
  },
  {
    id:'together', tier:'paid', worksNoKey:false, browserOk:true,
    name:'Together AI', logo:'🤝', color:'#6366f1',
    bg:'linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.05))',
    desc:'Open models at scale · Llama 4 Turbo · CORS OK',
    keyUrl:'https://api.together.xyz/settings/api-keys',
    apiBase:'https://api.together.xyz/v1/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:8,frontend:8,backend:8,debug:8,review:8,architect:8},
    models:[
      {id:'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo', name:'Llama 4 Maverick Turbo', best:['fullstack','backend'],  tokens:131000, score:9},
      {id:'meta-llama/Llama-3.3-70B-Instruct-Turbo',             name:'Llama 3.3 70B Turbo',    best:['backend','debug'],      tokens:131000, score:8},
      {id:'deepseek-ai/DeepSeek-R1',                             name:'DeepSeek R1',             best:['architect','review'],   tokens:64000,  score:10},
      {id:'Qwen/Qwen2.5-Coder-32B-Instruct',                     name:'Qwen 2.5 Coder 32B',     best:['debug','frontend'],     tokens:32000,  score:8},
    ],
    caller:'openai'
  },
  {
    id:'cohere', tier:'paid', worksNoKey:false, browserOk:true,
    name:'Cohere', logo:'🌊', color:'#39a6a3',
    bg:'linear-gradient(135deg,rgba(57,166,163,.15),rgba(57,166,163,.05))',
    desc:'Enterprise RAG · Command R+ · CORS OK',
    keyUrl:'https://dashboard.cohere.com/api-keys',
    apiBase:'https://api.cohere.com/v2/chat',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:7,frontend:6,backend:8,debug:7,review:9,architect:8},
    models:[
      {id:'command-r-plus-08-2024', name:'Command R+', best:['architect','review','backend'], tokens:128000, score:8},
      {id:'command-r-08-2024',      name:'Command R',  best:['debug','backend'],              tokens:128000, score:7},
    ],
    caller:'cohere'
  },
  {
    id:'github', tier:'paid', worksNoKey:false, browserOk:false,
    name:'GitHub Models', logo:'🐙', color:'#6e40c9',
    bg:'linear-gradient(135deg,rgba(110,64,201,.15),rgba(110,64,201,.05))',
    desc:'Azure-hosted · GPT-4o + Llama 4 · CORS blocked',
    keyUrl:'https://github.com/settings/tokens',
    apiBase:'https://models.inference.ai.azure.com/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:8,frontend:8,backend:8,debug:8,review:8,architect:8},
    models:[
      {id:'gpt-4o',                             name:'GPT-4o (GitHub)',        best:['fullstack','architect'],  tokens:128000, score:9},
      {id:'Llama-4-Maverick-17B-128E-Instruct', name:'Llama 4 Maverick (GH)',  best:['backend','debug'],        tokens:131000, score:8},
      {id:'Phi-3.5-mini-instruct',              name:'Phi-3.5 Mini (GitHub)',  best:['debug'],                  tokens:8192,   score:6},
    ],
    caller:'openai'
  },
  {
    id:'deepinfra', tier:'paid', worksNoKey:false, browserOk:true,
    name:'DeepInfra', logo:'🔬', color:'#0ea5e9',
    bg:'linear-gradient(135deg,rgba(14,165,233,.15),rgba(14,165,233,.05))',
    desc:'Affordable GPU inference · Llama 4 + Qwen3 · CORS OK',
    keyUrl:'https://deepinfra.com/dash/api_keys',
    apiBase:'https://api.deepinfra.com/v1/openai/chat/completions',
    authHdr:k=>({'Authorization':`Bearer ${k}`}),
    scores:{fullstack:7,frontend:6,backend:7,debug:7,review:7,architect:7},
    models:[
      {id:'meta-llama/Llama-4-Maverick-17B-128E-Instruct', name:'Llama 4 Maverick',   best:['fullstack','backend'],  tokens:131000, score:9},
      {id:'Qwen/Qwen3-235B-A22B',                          name:'Qwen3 235B',          best:['architect','fullstack'],tokens:131000, score:10},
      {id:'Qwen/Qwen2.5-Coder-32B-Instruct',               name:'Qwen 2.5 Coder 32B', best:['debug','frontend'],     tokens:32768,  score:8},
    ],
    caller:'openai'
  },
];


// ── Capability scoring per mode (used by selectBest smart ranking)
// Each provider.scores[mode] = 1-10, higher = better fit for that mode
// selectBest picks the highest-scoring AVAILABLE provider for the current mode

