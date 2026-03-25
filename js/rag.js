// ════════════════════════════════════════════
//  RAG — Retrieval Augmented Generation
// ════════════════════════════════════════════
const RAG = {
  docs:     [],   // [{id, name, source, chunks:[{text,tokens}], ts}]
  topK:     4,    // how many chunks to retrieve
  chunkSize:400,  // target tokens per chunk (~words*1.3)
};
const LS_RAG = 'eai_rag_v1';

/* ── Persistence ── */
function ragSave() {
  try { localStorage.setItem(LS_RAG, JSON.stringify({docs:RAG.docs,topK:RAG.topK,chunkSize:RAG.chunkSize})); } catch(e) { showToast('KB storage full','wrn'); }
}
function ragLoad() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_RAG)||'null');
    if (d) { RAG.docs=d.docs||[]; RAG.topK=d.topK||4; RAG.chunkSize=d.chunkSize||400; }
  } catch {}
}

/* ── Chunking ── */
function ragChunk(text, size=RAG.chunkSize) {
  // Split on sentence boundaries, then merge up to size words
  const sentences = text.replace(/\r\n/g,'\n').split(/(?<=[.!?])\s+(?=[A-Z\u0410-\u044F\u00C0-\u00FF\d])/);
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf+' '+s).split(/\s+/).length > size && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? buf+' '+s : s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  // Safety: split any remaining oversized chunks
  const final = [];
  for (const c of chunks) {
    const words = c.split(/\s+/);
    if (words.length <= size*1.5) { final.push(c); continue; }
    for (let i=0;i<words.length;i+=size) final.push(words.slice(i,i+size).join(' '));
  }
  return final.filter(c=>c.length>30).map(text=>({text, tokens: Math.ceil(text.split(/\s+/).length*1.3)}));
}

/* ── Index a document ── */
function ragIndex(name, source, rawText) {
  const id = 'doc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  const chunks = ragChunk(rawText);
  if (!chunks.length) return null;
  const doc = {id, name, source, chunks, ts: Date.now(), charCount: rawText.length};
  // De-dupe by name
  RAG.docs = RAG.docs.filter(d=>d.name!==name);
  RAG.docs.unshift(doc);
  ragSave();
  return doc;
}

/* ── BM25 scorer ── */
function ragBM25(query, chunks) {
  const k1=1.5, b=0.75;
  const qTerms = query.toLowerCase().split(/\W+/).filter(t=>t.length>1);
  const phrases = query.toLowerCase().match(/"[^"]+"|[\w]{4,}/g)||[];
  // IDF: count docs containing term
  const N = chunks.length;
  const df = {};
  for (const c of chunks) {
    const seen = new Set();
    const words = c.text.toLowerCase().split(/\W+/);
    for (const w of words) { if (!seen.has(w)){ seen.add(w); df[w]=(df[w]||0)+1; } }
  }
  const avgLen = chunks.reduce((a,c)=>a+c.tokens,0)/Math.max(N,1);

  return chunks.map((chunk,i)=>{
    const words = chunk.text.toLowerCase().split(/\W+/);
    const tf = {};
    for (const w of words) tf[w]=(tf[w]||0)+1;
    const dl = words.length;

    let score = 0;
    for (const t of qTerms) {
      if (!df[t]) continue;
      const idf = Math.log((N - df[t] + 0.5)/(df[t]+0.5)+1);
      const f = tf[t]||0;
      const norm = f*(k1+1)/(f+k1*(1-b+b*dl/avgLen));
      score += idf * norm;
    }
    // Phrase boost: exact substring match
    const lower = chunk.text.toLowerCase();
    for (const ph of phrases) {
      const clean = ph.replace(/"/g,'');
      if (lower.includes(clean)) score += 2.5;
    }
    // TF normalization: bonus for query term density
    const matchedTerms = qTerms.filter(t=>tf[t]).length;
    if (matchedTerms > 1) score *= 1 + 0.1*(matchedTerms-1);

    return {chunk, score, i};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
}

/* ── Smart trigger: skip greetings / trivial queries ── */
function ragNeedsContext(query) {
  if (RAG.docs.length === 0) return false;
  const q = query.trim().toLowerCase();
  // Skip pure greetings / one-word queries
  if (q.split(/\s+/).length <= 2) return false;
  const trivial = /^(hi|hello|hey|thanks|ok|okay|sure|yes|no|bye|great|cool|nice|lol|haha|test|ping)\b/;
  if (trivial.test(q)) return false;
  // Skip pure code requests (will be answered by code context)
  if (/^(write|create|build|make|generate|code)\s+(me\s+)?a\b/i.test(q) && !/about|explain|how|why/i.test(q)) return false;
  return true;
}

/* ── Async retrieval ── */
async function ragRetrieve(query, topK=RAG.topK) {
  if (!ragNeedsContext(query)) return '';
  const allChunks = RAG.docs.flatMap(d=>d.chunks.map(c=>({...c,_doc:d.name})));
  if (!allChunks.length) return '';
  const ranked = ragBM25(query, allChunks).slice(0, topK);
  if (!ranked.length) return '';
  const block = ranked.map(r=>`[${r.chunk._doc}]\n${r.chunk.text}`).join('\n\n---\n\n');
  return `\n\n=== KNOWLEDGE BASE CONTEXT ===\nThe following retrieved passages may be relevant to the user's query:\n\n${block}\n\n=== END CONTEXT ===\n`;
}

/* ── Sync retrieval (for agent pipeline) ── */
function ragBM25RetrieveSync(query, topK=RAG.topK) {
  if (!ragNeedsContext(query)) return '';
  const allChunks = RAG.docs.flatMap(d=>d.chunks.map(c=>({...c,_doc:d.name})));
  if (!allChunks.length) return '';
  const ranked = ragBM25(query, allChunks).slice(0, topK);
  if (!ranked.length) return '';
  return ranked.map(r=>`[${r.chunk._doc}]\n${r.chunk.text}`).join('\n\n---\n\n');
}

/* ── PDF.js extraction ── */
async function ragReadFile(file) {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    // Ensure worker
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data: new Uint8Array(ab)}).promise;
      let text = '';
      for (let p=1;p<=pdf.numPages;p++) {
        const page = await pdf.getPage(p);
        const tc   = await page.getTextContent();
        // Group by Y position for reading order
        const items = tc.items.filter(it=>it.str?.trim());
        let lastY = null;
        for (const it of items) {
          if (lastY !== null && Math.abs(it.transform[5]-lastY)>5) text+='\n';
          text += it.str + (it.hasEOL?'\n':' ');
          lastY = it.transform[5];
        }
        text += '\n\n';
      }
      // Fallback: BT/ET raw stream parse if extraction empty
      if (text.trim().length < 50) {
        const ab2 = await file.arrayBuffer();
        const raw = new TextDecoder('latin1').decode(ab2);
        const btMatches = [...raw.matchAll(/BT([\s\S]*?)ET/g)];
        text = btMatches.map(m=>{
          const tjMatches = [...m[1].matchAll(/\(([^)]*)\)\s*Tj/g)];
          return tjMatches.map(t=>t[1]).join(' ');
        }).join('\n');
      }
      return text;
    }
  }
  // Plain text / code / markdown
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file);});
}

/* ── Auto-index files generated by AI ── */
function ragAutoIndexFiles(files) {
  const indexable = ['.md','.txt','.html','.css','.js','.ts','.py','.json','.yaml','.yml','.sql','.sh','.java','.go','.rs','.cpp','.c','.tsx','.jsx','.vue','.svelte'];
  let count=0;
  for (const [path, content] of Object.entries(files)) {
    if (!content || typeof content!=='string') continue;
    const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase();
    if (!ext || !indexable.includes(ext)) continue;
    if (content.length < 80) continue; // skip stubs
    ragIndex(path, 'generated', content);
    count++;
  }
  return count;
}

/* ── Knowledge sidebar panel render ── */
function ragRenderPanel() {
  const el = document.getElementById('ragDocsPanel');
  if (!el) return;
  if (!RAG.docs.length) {
    el.innerHTML = '<div style="color:var(--t4);font-size:.68rem;padding:8px 4px;text-align:center">No documents indexed yet</div>';
    return;
  }
  el.innerHTML = RAG.docs.map(d=>`
    <div class="rag-doc-item">
      <span style="font-size:.85rem">${d.source==='url'?'🌐':d.source==='paste'?'✏️':'📄'}</span>
      <span class="rag-doc-name" title="${esc(d.name)}">${esc(d.name)}</span>
      <span class="rag-doc-meta">${d.chunks.length}ch</span>
      <button class="rag-doc-del" onclick="ragDeleteDoc('${d.id}')" title="Remove">×</button>
    </div>`).join('');
}

function ragDeleteDoc(id) {
  RAG.docs = RAG.docs.filter(d=>d.id!==id);
  ragSave();
  ragRenderPanel();
  showToast('Document removed from KB','inf');
}

/* ── RAG Modal ── */
let _ragModalTab = 'paste'; // 'paste'|'url'

function openRagModal() {
  closePlusMenu();
  if (document.getElementById('ragModalOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'ragModalOverlay';
  overlay.className = 'rag-modal-overlay';
  overlay.innerHTML = `
    <div class="rag-modal" onclick="event.stopPropagation()">
      <div class="rag-modal-hdr">
        <div>
          <div class="rag-modal-title">📚 Knowledge Base</div>
          <div class="rag-modal-sub">${RAG.docs.length} doc${RAG.docs.length!==1?'s':''} indexed · ${RAG.docs.reduce((a,d)=>a+d.chunks.length,0)} chunks</div>
        </div>
        <button class="rag-modal-close" onclick="closeRagModal()">✕</button>
      </div>
      <div class="rag-tabs">
        <button class="rag-tab ${_ragModalTab==='paste'?'on':''}" onclick="ragSwitchTab('paste')">✏️ Paste</button>
        <button class="rag-tab ${_ragModalTab==='url'?'on':''}" onclick="ragSwitchTab('url')">🌐 URL</button>
        <button class="rag-tab ${_ragModalTab==='docs'?'on':''}" onclick="ragSwitchTab('docs')">📄 Indexed (${RAG.docs.length})</button>
      </div>
      <div class="rag-body" id="ragModalBody"></div>
    </div>`;
  overlay.addEventListener('click', closeRagModal);
  document.body.appendChild(overlay);
  ragRenderModalTab();
}

function closeRagModal() {
  document.getElementById('ragModalOverlay')?.remove();
  ragRenderPanel();
}

function ragSwitchTab(tab) {
  _ragModalTab = tab;
  document.querySelectorAll('.rag-tab').forEach(b=>b.classList.remove('on'));
  event.currentTarget.classList.add('on');
  ragRenderModalTab();
}

function ragClearAll() {
  if (!confirm(`Remove all ${RAG.docs.length} documents from knowledge base?`)) return;
  RAG.docs = [];
  ragSave();
  ragRenderModalTab();
  ragUpdateUI();
  showToast('Knowledge base cleared','inf');
}

function ragRenderModalTab() {
  const body = document.getElementById('ragModalBody');
  if (!body) return;
  if (_ragModalTab === 'paste') {
    body.innerHTML = `
      <textarea class="rag-textarea" id="ragPasteText" placeholder="Paste text, documentation, notes…"></textarea>
      <input style="background:var(--bg1);border:1px solid var(--line);border-radius:6px;color:var(--t1);font-size:.73rem;padding:7px 10px;outline:none;width:100%"
        id="ragPasteName" placeholder="Document name (optional)" />
      <div class="rag-action-row">
        <button class="rag-btn" onclick="closeRagModal()">Cancel</button>
        <button class="rag-btn primary" onclick="ragIndexPaste()">Index Text</button>
      </div>
      <div class="rag-status" id="ragStatus"></div>`;
  } else if (_ragModalTab === 'url') {
    body.innerHTML = `
      <div class="rag-url-row">
        <input class="rag-url-input" id="ragUrlInput" placeholder="https://…" type="url"/>
        <button class="rag-fetch-btn" id="ragFetchBtn" onclick="ragFetchUrl()">Fetch</button>
      </div>
      <div class="rag-status" id="ragStatus"></div>
      <div style="font-size:.62rem;color:var(--t4);line-height:1.5">Fetches via allorigins.win proxy. Works on public pages.</div>`;
  } else { // docs
    body.innerHTML = `
      <div style="font-size:.65rem;color:var(--t3);margin-bottom:8px;font-family:var(--fh);font-weight:700;letter-spacing:.04em">
        ${RAG.docs.length} DOCUMENT${RAG.docs.length!==1?'S':''} INDEXED
      </div>
      <div class="rag-docs-list" id="ragDocsPanel"></div>
      ${!RAG.docs.length ? '<div style="color:var(--t4);font-size:.68rem;padding:12px 4px;text-align:center">No documents yet — attach files or paste text</div>' : ''}
      <div class="rag-action-row" style="margin-top:8px">
        ${RAG.docs.length ? `<button class="rag-btn" onclick="ragClearAll()" style="color:var(--red);border-color:rgba(239,68,68,.3)">🗑 Clear All</button>` : ''}
        <button class="rag-btn primary" onclick="closeRagModal()">Done</button>
      </div>`;
    ragRenderPanel();
  }
}


function ragIndexPaste() {
  const text = document.getElementById('ragPasteText')?.value.trim();
  const name = document.getElementById('ragPasteName')?.value.trim() || `Paste ${new Date().toLocaleTimeString()}`;
  const st = document.getElementById('ragStatus');
  if (!text) { if(st){st.textContent='Paste some text first';st.className='rag-status err';} return; }
  ragIndex(name, 'paste', text);
  if(st){st.textContent=`✅ "${name}" indexed`;st.className='rag-status ok';}
  showToast('📚 Text indexed to KB','ok');
  ragUpdateUI();
  setTimeout(()=>{ _ragModalTab='docs'; ragRenderModalTab(); }, 700);
}

async function ragFetchUrl() {
  const url = document.getElementById('ragUrlInput')?.value.trim();
  const st = document.getElementById('ragStatus');
  const btn = document.getElementById('ragFetchBtn');
  if (!url || !url.startsWith('http')) { if(st){st.textContent='Enter a valid URL';st.className='rag-status err';} return; }
  if(btn) btn.disabled=true;
  if(st){st.textContent='Fetching…';st.className='rag-status';}
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, {signal: AbortSignal.timeout(12000)});
    const j = await r.json();
    let html = j.contents||'';
    // Strip tags, decode entities
    const tmp = document.createElement('div');
    tmp.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ');
    let text = tmp.textContent.replace(/\s{3,}/g,'\n\n').trim();
    if (!text || text.length<100) throw new Error('No readable content found');
    const name = url.replace(/^https?:\/\//,'').slice(0,60);
    ragIndex(name, 'url', text);
    if(st){st.textContent=`✅ Page indexed (${Math.round(text.length/1000)}K chars)`;st.className='rag-status ok';}
    showToast('📚 URL indexed to KB','ok');
    ragUpdateUI();
    setTimeout(()=>{ _ragModalTab='docs'; ragRenderModalTab(); }, 700);
  } catch(e) {
    if(st){st.textContent=`Error: ${e.message}`;st.className='rag-status err';}
  } finally {
    if(btn) btn.disabled=false;
  }
}
const LS_SESSIONS = 'eai_sessions';
const MAX_SESSIONS = 50;
const MAX_SESSION_BYTES = 400_000;

