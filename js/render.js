// ════════════════════════════════════════════
//  RENDER MESSAGES
// ════════════════════════════════════════════
function renderUser(txt,files,scroll=true){
  const b=document.getElementById('chatBox'),d=document.createElement('div');
  d.className='msg user';
  const fh=files&&files.length?`<div class="fchips">${files.map(f=>`<div class="fchip">📎 ${esc(f.name)}</div>`).join('')}</div>`:'';
  // Calculate message index (position in current chat)
  const msgIdx = S.msgs.filter(m=>m.role==='user').length - 1;
  d.innerHTML=`<div class="av usr"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" fill="rgba(255,255,255,.92)"/><path d="M1.5 14c0-3.314 2.686-5.5 6-5.5s6 2.186 6 5.5" stroke="rgba(255,255,255,.92)" stroke-width="1.5" stroke-linecap="round"/></svg></div><div style="flex:1;min-width:0;text-align:right"><div class="bbl" style="display:inline-block;text-align:left">${fh}${esc(txt).replace(/\n/g,'<br>')}</div><div class="mmeta"><span>${gT()}</span><button class="branch-btn" onclick="branchFromMsg(this)" data-idx="${msgIdx}" title="Fork conversation from this point">⎇ Branch</button></div></div>`;
  b.appendChild(d);if(scroll)scrollBot();
  perfCapDOM();
}

function renderAI(res, scroll=true){
  const b=document.getElementById('chatBox'), d=document.createElement('div');
  d.className='msg ai';
  const c=res.color||'#6366f1', rgb=hexRgb(c);
  const tagStyle=`background:rgba(${rgb},.15);border:1px solid rgba(${rgb},.35);color:${c}`;
  const fbHtml=(res.isFallback&&res.fbLog?.length)?`<div class="fblog"><span>⚡</span><span>Fallback: ${res.fbLog.map(l=>`${l.prov}`).join(' → ')} → <strong>${res.provName}</strong></span></div>`:'';
  const hasHtml=S.opts.build&&(res.text.includes('<!DOCTYPE')||res.text.match(/```(?:\w+:)?[^\n]*\.(html|jsx|tsx|vue)\n/)||Object.keys(S.fileTree).length>0);
  const runBtn=hasHtml?`<button class="mact run-code-btn" onclick="quickRunFromMsg(this)">▶ Run Preview</button>`:'';

  // Build message shell — bbl starts empty, gets filled by typewriter
  d.innerHTML=`
    <div class="av ai"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="qbga" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="20" height="20" rx="6" fill="url(#qbga)"/><g transform="translate(3,4)"><polygon points="7,1 13,4 7,7 1,4" fill="white" opacity="0.95"/><polyline points="1,7 7,10 13,7" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.8"/><polyline points="1,10 7,13 13,10" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.65"/></g></svg></div>
    <div style="flex:1;min-width:0">
      <div class="bbl typing-bbl-wrap" id="tbw-${Date.now()}" style="max-width:100%"></div>
      ${fbHtml}
      <div class="mmeta" id="tmeta-${Date.now()}" style="display:none">
        <span>${gT()}</span>
        ${res.modelName?`<span class="umtag" style="${tagStyle}">${res.logo||'🤖'} ${res.modelName}</span>`:''}
        ${res.isFallback?'<span style="font-size:.6rem;color:var(--orange)">⚡ fallback</span>':''}
        ${runBtn}
        <button class="mact" onclick="cpyBbl(this)">📋 Copy</button>
        <button class="mact" onclick="dlMsg(this)">⬇ Save</button>
      </div>
    </div>`;

  b.appendChild(d);
  if(scroll) scrollBot();

  // Start typewriter on the bbl div
  const bblEl = d.querySelector('.typing-bbl-wrap');
  const metaEl = d.querySelector('.mmeta');
  typewriteMessage(res.text, bblEl, metaEl, scroll);
  // Inject speak button (for history renders)
  if (!scroll) setTimeout(() => voiceInjectSpeakBtn(bblEl, res.text), 0);
}

// ── TYPEWRITER ENGINE ──
// Fix: block elements (ul, li, h1-h3, p) are hidden at start and revealed
// one-by-one right as their text begins typing — so bullet markers never
// appear before their text content.
async function typewriteMessage(rawText, bblEl, metaEl, scroll) {

  // History / re-render — instant, no animation
  if (!scroll) {
    bblEl.innerHTML = parseMsg(rawText);
    hlCode(bblEl);
    if (metaEl) metaEl.style.display = 'flex';
    return;
  }

  // Step 1: render markdown → HTML (no Prism yet)
  bblEl.innerHTML = parseMsg(rawText);

  // Step 2: collect ALL text nodes depth-first
  const segments = [];
  (function collect(el) {
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 1) collect(child);
      else if (child.nodeType === 3 && child.textContent) {
        segments.push({ node: child, text: child.textContent });
      }
    }
  })(bblEl);

  if (!segments.length) {
    hlCode(bblEl);
    if (metaEl) metaEl.style.display = 'flex';
    return;
  }

  // Step 3: find block ancestors to hide/reveal per-segment
  const BLOCK_TAGS = new Set(['LI','UL','OL','H1','H2','H3','H4','H5','H6','BLOCKQUOTE']);
  function getBlockAncestor(node) {
    let p = node.parentElement;
    while (p && p !== bblEl) {
      if (BLOCK_TAGS.has(p.tagName)) return p;
      p = p.parentElement;
    }
    return null;
  }
  segments.forEach(seg => { seg.block = getBlockAncestor(seg.node); });

  // Step 4: hide all block ancestors upfront
  const hiddenBlocks = new Set();
  segments.forEach(seg => {
    if (seg.block && !hiddenBlocks.has(seg.block)) {
      seg.block.style.visibility = 'hidden';
      seg.block.style.height = '0';
      seg.block.style.overflow = 'hidden';
      seg.block.style.marginTop = '0';
      seg.block.style.marginBottom = '0';
      hiddenBlocks.add(seg.block);
    }
  });

  // Step 5: clear all text nodes
  segments.forEach(s => { s.node.textContent = ''; });

  // Step 6: cursor
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  if (bblEl.firstChild) bblEl.insertBefore(cursor, bblEl.firstChild);
  else bblEl.appendChild(cursor);

  // Step 7: start smooth auto-scroll interval
  startAutoScroll();

  // Step 8: animate each segment
  const revealedBlocks = new Set();

  for (const seg of segments) {
    const { node, text, block } = seg;

    // Reveal block right before its text starts
    if (block && !revealedBlocks.has(block)) {
      block.style.visibility = '';
      block.style.height = '';
      block.style.overflow = '';
      block.style.marginTop = '';
      block.style.marginBottom = '';
      revealedBlocks.add(block);
    }

    // Is this inside a code block?
    let isCode = false;
    let p = node.parentElement;
    while (p && p !== bblEl) {
      if (p.tagName === 'PRE' || p.tagName === 'CODE') { isCode = true; break; }
      p = p.parentElement;
    }

    const CHARS = isCode ? 14 : 4;
    const MS    = isCode ? 5  : 14;

    // Move cursor after this node
    const parent = node.parentNode;
    if (parent) {
      const next = node.nextSibling;
      if (next && next !== cursor) parent.insertBefore(cursor, next);
      else if (!next) parent.appendChild(cursor);
    }

    // Type into node (no scrollBot per tick — interval handles it)
    let i = 0;
    await new Promise(resolve => {
      function tick() {
        if (i >= text.length) { resolve(); return; }
        node.textContent += text.slice(i, Math.min(i + CHARS, text.length));
        i += CHARS;
        setTimeout(tick, MS);
      }
      tick();
    });
  }

  // Step 9: reveal any remaining hidden blocks
  hiddenBlocks.forEach(b => {
    b.style.visibility = '';
    b.style.height = '';
    b.style.overflow = '';
    b.style.marginTop = '';
    b.style.marginBottom = '';
  });

  // Step 10: done — remove cursor, Prism, meta, stop scroll interval, snap to bottom
  cursor.remove();
  hlCode(bblEl);
  stopAutoScroll();
  if (metaEl) metaEl.style.display = 'flex';
  scrollBot(true);   // force-snap to exact bottom after animation completes
}

function quickRunFromMsg(btn) {
  // If we have a file tree, use runPreview — it handles CSS/JS inlining properly
  if (Object.keys(S.fileTree).length) {
    runPreview();
    return;
  }

  // Otherwise grab code from the message bubble
  const bbl = btn.closest('.msg')?.querySelector('.bbl');
  if (!bbl) return;

  const preCode = bbl.querySelector('pre code');
  if (preCode) {
    const lang = preCode.className.replace('language-','').split(' ')[0];
    const code = preCode.textContent;
    S.previewHtml = code;
    runSmartPreview(code, lang);
    return;
  }

  const txt = bbl.innerText;
  const match = txt.match(/<!DOCTYPE[\s\S]*<\/html>/i);
  if (match) { S.previewHtml = match[0]; runSmartPreview(match[0], 'html'); }
  else if (S.previewHtml) runPreview();
  else showToast('No runnable code found — try ▶ Run in the Preview tab','wrn');
}

function renderErr(msg){
  const d=document.createElement('div');d.className='msg ai';
  d.innerHTML=`<div class="av ai" style="background:linear-gradient(135deg,#ef4444,#dc2626)">!</div><div class="bbl" style="max-width:80%;border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.05)"><strong style="color:#fca5a5">⚠ Error</strong><br/><span style="color:var(--t2)">${esc(msg)}</span><br/><br/><span style="font-size:.73rem;color:var(--t3)">Add API keys in the 🔑 API Vault or enable free providers.</span></div>`;
  document.getElementById('chatBox').appendChild(d);
}

// ════════════════════════════════════════════
//  THINKING PANEL
// ════════════════════════════════════════════
const STEPS=[{i:'📋',t:'Understanding',d:'Analyzing intent'},{i:'🏗️',t:'Planning',d:'Designing structure'},{i:'💻',t:'Writing code',d:'Generating impl'},{i:'🔍',t:'Reviewing',d:'Checking quality'},{i:'⚡',t:'Optimizing',d:'Enhancing output'}];
let thIv=null;
function mkTP(){const p=document.createElement('div');p.className='tpanel on';p.id='tpanel';p.innerHTML=`<div class="thdr" onclick="togThink(this)"><div class="tspin"></div><span>Agent thinking…</span><span style="margin-left:auto;font-size:.65rem;color:var(--t3)">▼</span></div><div class="pw"><div class="pf" id="pf" style="width:0%"></div></div><div id="tss">${STEPS.map((s,i)=>`<div class="tstep" id="ts${i}"><span class="ti">${s.i}</span><span class="tt">${s.t}</span><span class="td">${s.d}</span></div>`).join('')}</div>`;return p;}
function startThink(){let step=0;const n=STEPS.length;const u=()=>{document.querySelectorAll('[id^="ts"]').forEach((el,i)=>{el.classList.remove('on','done');if(i<step){el.classList.add('done');el.querySelector('.ti').textContent='✅';}if(i===step)el.classList.add('on');});const pf=document.getElementById('pf');if(pf)pf.style.width=Math.round((step/n)*82)+'%';};u();thIv=setInterval(()=>{step=Math.min(step+1,n-1);u();},920);}
function stopThink(){if(thIv){clearInterval(thIv);thIv=null;}const p=document.getElementById('tpanel');if(!p)return;document.querySelectorAll('[id^="ts"]').forEach(el=>{el.classList.remove('on');el.classList.add('done');el.querySelector('.ti').textContent='✅';});const pf=document.getElementById('pf');if(pf)pf.style.width='100%';const sp=p.querySelector('.tspin');if(sp){sp.style.borderTopColor='var(--green)';sp.style.animation='none';}const lb=p.querySelector('.thdr span');if(lb)lb.textContent='Done ✓';setTimeout(()=>{if(p.parentNode)p.remove();},1400);}
function togThink(h){const s=document.getElementById('tss');if(!s)return;const c=h.querySelector('span:last-child');s.style.display=s.style.display==='none'?'':'none';c.textContent=s.style.display==='none'?'▶':'▼';}
function mkTyping(){const d=document.createElement('div');d.className='msg ai';d.id='tyEl';d.innerHTML=`<div class="av ai"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="qbga" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="20" height="20" rx="6" fill="url(#qbga)"/><g transform="translate(3,4)"><polygon points="7,1 13,4 7,7 1,4" fill="white" opacity="0.95"/><polyline points="1,7 7,10 13,7" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.8"/><polyline points="1,10 7,13 13,10" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.65"/></g></svg></div><div class="bbl"><div class="tybbl"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div></div>`;return d;}

// ════════════════════════════════════════════
//  MESSAGE PARSER
// ════════════════════════════════════════════
function parseMsg(text){const secs=['---PLAN---','---ARCHITECTURE---','---FILES---','---REVIEW---','---OPTIMIZATION---'];if(secs.some(s=>text.includes(s)))return parseStruct(text);return parseMD(text);}
function parseStruct(text){
  const defs={PLAN:{tag:'t-plan',icon:'📋',label:'Plan',c:'#93c5fd'},ARCHITECTURE:{tag:'t-arch',icon:'🏗️',label:'Architecture',c:'#c4b5fd'},FILES:{tag:'t-file',icon:'📁',label:'Files',c:'#67e8f9'},REVIEW:{tag:'t-rev',icon:'🔍',label:'Review',c:'#fde68a'},OPTIMIZATION:{tag:'t-opt',icon:'⚡',label:'Optimization',c:'#6ee7b7'}};
  let html='';const re=/---(PLAN|ARCHITECTURE|FILES|REVIEW|OPTIMIZATION)---/g;let m,last=0,parts=[];
  while((m=re.exec(text))!==null){if(last<m.index)parts.push({type:'pre',content:text.slice(last,m.index).trim()});parts.push({type:'sec',name:m[1],from:m.index+m[0].length});last=m.index+m[0].length;}
  if(last<text.length)parts.push({type:'pre',content:text.slice(last).trim()});
  for(let i=0;i<parts.length;i++){
    const cur=parts[i];
    if(cur.type==='pre'&&cur.content){html+=`<div style="margin-bottom:8px">${parseMD(cur.content)}</div>`;}
    else if(cur.type==='sec'){
      const nx=parts.slice(i+1).find(p=>p.type==='sec');const ei=nx?text.indexOf(`---${nx.name}---`,cur.from):text.length;const content=text.slice(cur.from,ei).trim();const def=defs[cur.name];if(!def)continue;
      const id='sc_'+Math.random().toString(36).slice(2);
      html+=`<div class="scrd" style="border-left:3px solid ${def.c}"><div class="scrdh" onclick="togSec('${id}')"><div class="scrdtitle">${def.icon} <span class="stag ${def.tag}">${def.label}</span></div><span id="${id}c" style="font-size:.68rem;color:var(--t3)">▼</span></div><div class="scrdb oscr open" id="${id}">${parseMD(content)}</div></div>`;
    }
  }
  return html||parseMD(text);
}
function parseMD(text){
  const cbs=[];const PH='%%CB%%';
  // Sanitize unclosed code fences — count backtick triplets; if odd, close the last one
  const fenceCount = (text.match(/^```/gm)||[]).length;
  if (fenceCount % 2 !== 0) text = text.trimEnd() + '\n```';
  let t=text.replace(/```(\w+):([^\n]+)\n([\s\S]*?)```/g,(_,lang,fname,code)=>{cbs.push({lang,code:code.trim(),fname:fname.trim()});return PH;});
  t=t.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,lang,code)=>{cbs.push({lang:lang||'text',code:code.trim()});return PH;});
  t=t.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^\s*[-*+] (.+)$/gm,'<li>$1</li>')
    .replace(/(<\/li>\n?<li>|<li>.*?<\/li>(?:\n?<li>.*?<\/li>)*)/g, m => `<ul>${m}</ul>`)  // wrap consecutive li in ul
    .replace(/<\/ul>\s*<ul>/g,'')  // merge adjacent ul blocks
    .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  t='<p>'+t+'</p>';
  let ci=0;
  t=t.replace(new RegExp(PH.replace(/%/g,'\\%'),'g'),()=>{const b=cbs[ci++];return b?mkCB(b.lang,b.code,b.fname):'';});
  return t;
}
function mkCB(lang,code,fname){
  const id='cb_'+Math.random().toString(36).slice(2);
  const RUNNABLE_INLINE = ['js','javascript','ts','typescript','jsx','tsx'];
  const RUNNABLE_PREVIEW= ['html','htm','markup'];
  const RUNNABLE_PY     = ['python','py'];
  const isRunnable = RUNNABLE_INLINE.includes(lang) || RUNNABLE_PREVIEW.includes(lang)
    || RUNNABLE_PY.includes(lang)
    || code.includes('<!DOCTYPE') || code.includes('<html') || code.includes('React') || code.includes('useState');
  const pyBadge = RUNNABLE_PY.includes(lang) ? `<span class="py-badge">py</span>` : '';
  const runLabel = RUNNABLE_PREVIEW.includes(lang) || (code.includes('<!DOCTYPE')||code.includes('<html')) ? '▶ Preview' : '▶ Run';
  const runBtn=isRunnable?`<button class="cba run" onclick="runCodeBlock('${id}')">${runLabel}</button>`:'';
  const fnLabel=fname?`<span style="color:var(--t2);margin-left:6px;font-size:.62rem;opacity:.8">${esc(fname)}</span>`:'';
  return `<div class="cbw"><div class="cbh"><span class="cbl">${esc(lang)}${pyBadge}${fnLabel}</span><div class="cbas">${runBtn}<button class="cba" onclick="cpyCode('${id}',this)">📋 Copy</button><button class="cba" onclick="dlCode('${id}','${lang}',${fname?`'${fname}'`:'null'})">⬇ Save</button></div></div><pre><code id="${id}" class="language-${lang}">${esc(code)}</code></pre></div>`;
}

