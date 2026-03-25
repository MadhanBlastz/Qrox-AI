// ════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════
const S = {
  msgs:[], attached:[], mode:'fullstack',
  opts:{think:false,structured:false,build:false,agents:false},
  framework:null,
  settings:{maxTokens:4096, persona:'You are an elite autonomous full-stack AI developer agent. Provide complete, production-ready code.'},
  loading:false,
  controller:null,  // AbortController — set when a generation is running
  // History: array of {id, title, msgs, ts}
  sessions:[], currentSessionId:null,
  // Vault
  keys:{}, priority:[],
  currentModel:null, fbLog:[],
  // File Tree
  fileTree:{},   // path -> {name, content, type}
  openFiles:[],  // [{path, name}]
  activeFile:null,
  // Preview
  previewHtml:'',
  // Model picker — null = auto (AI chooses), or {provId,modelId,name,logo,color,tier}
  forcedModel: null
};


