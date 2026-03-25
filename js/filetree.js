// ════════════════════════════════════════════
//  FILE TREE
// ════════════════════════════════════════════
const FILE_ICONS = {
  html:'🌐',htm:'🌐',css:'🎨',scss:'🎨',sass:'🎨',
  js:'⚡',ts:'💙',jsx:'⚛',tsx:'⚛',
  py:'🐍',java:'☕',go:'🐹',rs:'🦀',rb:'💎',php:'🐘',
  json:'📋',yaml:'📋',yml:'📋',toml:'📋',
  md:'📝',txt:'📄',env:'🔒',
  sh:'💻',bash:'💻',
  sql:'🗄',db:'🗄',
  png:'🖼',jpg:'🖼',jpeg:'🖼',gif:'🖼',svg:'🖼',ico:'🖼',
  pdf:'📑',zip:'📦',
};
const FILE_LANG = {html:'markup',htm:'markup',css:'css',scss:'css',js:'javascript',ts:'javascript',jsx:'javascript',tsx:'javascript',py:'python',json:'json',sh:'bash',bash:'bash',md:'markdown',sql:'sql',rb:'ruby',go:'go',rs:'rust',php:'php',java:'java',yml:'yaml',yaml:'yaml'};

function getExt(name){return (name.split('.').pop()||'').toLowerCase();}
function fileIcon(name){return FILE_ICONS[getExt(name)]||'📄';}
function fileLang(name){return FILE_LANG[getExt(name)]||'text';}

// Extract files from AI response
function extractFilesFromResponse(text) {
  const files = {};
  // Match ```filename\ncontent``` or ```lang:filename\ncontent```
  const re1 = /```(?:\w+:)?([^\n`]+\.\w+)\n([\s\S]*?)```/g;
  let m;
  while((m=re1.exec(text))!==null){
    const name=m[1].trim(), content=m[2].trim();
    if(name && !name.includes(' ') && content) files[name]=content;
  }
  // Match // filename: path.ext patterns
  const re2 = /\/\/\s*(?:file(?:name)?|path):\s*([^\s\n]+\.\w+)/gi;
  while((m=re2.exec(text))!==null){
    const name=m[1].trim();
    if(!files[name]) files[name]='// (content in code block above)';
  }
  // Match --- filename ---
  const re3 = /---\s*([^\s\n-]+\.\w+)\s*---\n([\s\S]*?)(?=---|\n\n\n|$)/g;
  while((m=re3.exec(text))!==null){
    const name=m[1].trim(), content=m[2].trim();
    if(name && content) files[name]=content;
  }
  return files;
}

function addFilesToTree(files) {
  let added = 0;
  let diffShown = false;

  for (const [path, content] of Object.entries(files)) {
    const existing = S.fileTree[path];

    // If file already exists and content changed — show diff instead of overwriting
    if (existing?.content && existing.content !== content && !diffShown) {
      // Store new content temporarily; diffAcceptAll will write it
      DIFF.path       = path;
      DIFF.oldContent = existing.content;
      DIFF.newContent = content;
      // Show diff after a short delay so the AI bubble renders first
      setTimeout(() => diffShow(path, existing.content, content), 400);
      diffShown = true;
      // Still add other new files silently
      continue;
    }

    S.fileTree[path] = { name: path.split('/').pop(), content, type: 'file' };
    added++;
  }

  if (added > 0) {
    renderFileTree();
    ragAutoIndexFiles(files);
    if (S.currentSessionId) {
      const idx = S.sessions.findIndex(s => s.id === S.currentSessionId);
      if (idx >= 0) { S.sessions[idx].tree = S.fileTree; saveCurrentSession(); }
    }
    document.getElementById('ftEmpty')?.remove();
    const ftPane = document.querySelector('.lsb-tab:first-child');
    if (ftPane && !document.querySelector('.lsb-tab.on[onclick*="files"]')) lsbTab(document.querySelector('.lsb-tab:first-child'), 'files');
  }
  return added + (diffShown ? 1 : 0);
}

function buildTreeStructure(flat) {
  const root={name:'root',children:{},files:{}};
  for(const [path,info] of Object.entries(flat)){
    const parts=path.split('/');
    let node=root;
    if(parts.length===1){node.files[path]=info;continue;}
    for(let i=0;i<parts.length-1;i++){
      const seg=parts[i];
      if(!node.children[seg])node.children[seg]={name:seg,children:{},files:{},path:parts.slice(0,i+1).join('/')};
      node=node.children[seg];
    }
    const fname=parts[parts.length-1];
    node.files[fname]={...info,fullPath:path};
  }
  return root;
}

function renderFileTree() {
  const container = document.getElementById('ftree');
  if(!Object.keys(S.fileTree).length){
    container.innerHTML='<div class="ft-empty" id="ftEmpty"><div class="ft-empty-icon">📂</div>Ask the AI to generate a project and files will appear here automatically.</div>';
    return;
  }
  const root = buildTreeStructure(S.fileTree);
  container.innerHTML = `<div class="ft-tree">${renderTreeNode(root, 0, true, [])}</div>`;
  container.querySelectorAll('.ft-row[data-path]').forEach(el=>{
    el.addEventListener('click',e=>{
      e.stopPropagation();
      const path=el.dataset.path, isDir=el.dataset.dir==='1';
      if(isDir){toggleDir(el);}
      else{openFile(path);}
    });
  });
}

// SVG icons matching the screenshot style
const FT_SVG_FOLDER_OPEN = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:14px;height:14px"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.764a1 1 0 01.832.445l.52.777A1 1 0 008.448 3.5H13.5A1.5 1.5 0 0115 5v1H1V3.5z" fill="#6e9ec9" opacity=".8"/><path d="M1 6h14l-1.5 7a1.5 1.5 0 01-1.474 1.25H3.974A1.5 1.5 0 012.5 13.25L1 6z" fill="#6e9ec9" opacity=".6"/></svg>`;
const FT_SVG_FOLDER_CLOSED = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:14px;height:14px"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.764a1 1 0 01.832.445l.52.777A1 1 0 008.448 3.5H13.5A1.5 1.5 0 0115 5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12V3.5z" fill="#6e9ec9" opacity=".5"/></svg>`;
const FT_SVG_FILE = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:13px;height:13px"><path d="M4 1h6l4 4v10H2V1z" stroke="rgba(148,163,184,.5)" stroke-width="1" fill="rgba(148,163,184,.06)"/><path d="M10 1v4h4" stroke="rgba(148,163,184,.5)" stroke-width="1" fill="none"/></svg>`;

// Per-extension colored file icons
function ftFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const colors = {
    html:'#e34c26', htm:'#e34c26',
    css:'#264de4', scss:'#cd6799', sass:'#cd6799',
    js:'#f7df1e', jsx:'#61dafb', ts:'#3178c6', tsx:'#61dafb',
    vue:'#42b883', svelte:'#ff3e00',
    py:'#3572a5', rb:'#cc342d', php:'#777bb4', go:'#00add8',
    rs:'#dea584', cpp:'#f34b7d', c:'#555555', java:'#b07219',
    json:'#ffd700', yaml:'#cc5500', yml:'#cc5500', toml:'#9c4221',
    md:'#083fa1', txt:'#94a3b8', csv:'#1ea362',
    sh:'#89e051', bash:'#89e051',
    sql:'#e38c00', db:'#e38c00',
    png:'#a855f7', jpg:'#a855f7', jpeg:'#a855f7', gif:'#a855f7', svg:'#f97316', webp:'#a855f7',
    pdf:'#ef4444', docx:'#2b579a', xlsx:'#217346', pptx:'#d04326',
  };
  const color = colors[ext] || '#94a3b8';
  return `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:13px;height:13px"><path d="M4 1h6l4 4v10H2V1z" stroke="${color}" stroke-width="1.2" fill="${color}18"/><path d="M10 1v4h4" stroke="${color}" stroke-width="1.2" fill="none"/></svg>`;
}

function renderTreeNode(node, depth, isRoot, parentIsLast=[]) {
  let html = '';
  const folders = Object.entries(node.children||{}).sort(([a],[b])=>a.localeCompare(b));
  const files   = Object.entries(node.files||{}).sort(([a],[b])=>a.localeCompare(b));
  const all = [...folders.map(([k,v])=>({k,v,isDir:true})), ...files.map(([k,v])=>({k,v,isDir:false}))];

  all.forEach(({k, v, isDir}, idx) => {
    const isLast = idx === all.length - 1;

    // Build the indent guide columns
    let guideHtml = '';
    for (let d = 0; d < depth; d++) {
      // For each ancestor level: show vertical line if that ancestor was NOT the last child
      const seg = d === depth - 1
        ? (isLast ? 'last-branch' : 'branch')  // connector at current depth
        : (parentIsLast[d] ? '' : 'vline');      // vertical guide for ancestor levels
      guideHtml += `<span class="ft-guide-seg ${seg}"></span>`;
    }

    if (isDir) {
      const path = v.path || k;
      const cid  = 'ftc-' + path.replace(/[^a-z0-9]/gi,'_');
      html += `<div class="ft-item">
        <div class="ft-row" data-path="${path}" data-dir="1" data-open="1">
          <div class="ft-guide">${guideHtml}</div>
          <span class="ft-chevron open">▶</span>
          <span class="ft-icon-wrap" id="ftico-${path.replace(/[^a-z0-9]/gi,'_')}">${FT_SVG_FOLDER_OPEN}</span>
          <span class="ft-name">${esc(v.name)}</span>
        </div>
        <div class="ft-children" id="${cid}">
          ${renderTreeNode(v, depth+1, false, [...parentIsLast, isLast])}
        </div>
      </div>`;
    } else {
      const fullPath = v.fullPath || k;
      const isActive = S.activeFile === fullPath;
      html += `<div class="ft-item">
        <div class="ft-row ${isActive?'selected':''}" data-path="${fullPath}" data-dir="0">
          <div class="ft-guide">${guideHtml}</div>
          <span class="ft-chevron leaf">▶</span>
          <span class="ft-icon-wrap">${ftFileIcon(k)}</span>
          <span class="ft-name">${esc(k)}</span>
        </div>
      </div>`;
    }
  });
  return html;
}

function toggleDir(el) {
  const path = el.dataset.path;
  const cid  = 'ftc-' + path.replace(/[^a-z0-9]/gi,'_');
  const children = document.getElementById(cid);
  const chevron  = el.querySelector('.ft-chevron');
  const iconWrap = el.querySelector('.ft-icon-wrap');
  if (!children) return;
  const isOpen = el.dataset.open === '1';
  if (isOpen) {
    children.classList.add('collapsed');
    if (chevron) chevron.classList.remove('open');
    if (iconWrap) iconWrap.innerHTML = FT_SVG_FOLDER_CLOSED;
    el.dataset.open = '0';
  } else {
    children.classList.remove('collapsed');
    if (chevron) chevron.classList.add('open');
    if (iconWrap) iconWrap.innerHTML = FT_SVG_FOLDER_OPEN;
    el.dataset.open = '1';
  }
}

function openFile(path) {
  const info = S.fileTree[path]; if(!info) return;
  S.activeFile = path;
  // Add to open tabs if not there
  if(!S.openFiles.find(f=>f.path===path)) S.openFiles.push({path, name:info.name});
  renderFileTree();
  // Switch to file viewer within the files pane - show content inline
  showFileContent(path, info);
}

function showFileContent(path, info) {
  // We show the file content in a floating overlay-style or inline at bottom of tree
  // Actually, let's show it as the main view area replacing chat temporarily
  const lang = fileLang(info.name);
  const existing = document.getElementById('fileViewerModal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id='fileViewerModal';
  modal.style.cssText='position:fixed;inset:0;z-index:998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);padding:14px';
  modal.innerHTML=`
    <div style="background:var(--bg1);border:1px solid var(--line2);border-radius:12px;width:100%;max-width:820px;max-height:88vh;display:flex;flex-direction:column;box-shadow:var(--shx);animation:mIn .2s ease">
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line);flex-shrink:0">
        <span style="font-size:.85rem">${fileIcon(info.name)}</span>
        <span style="font-family:var(--fc);font-size:.8rem;color:var(--t1);font-weight:600">${esc(path)}</span>
        <span style="font-size:.6rem;padding:2px 6px;border-radius:6px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.2);color:#a5b4fc;font-family:var(--fh);font-weight:700;margin-left:4px">READ ONLY</span>
        <div style="flex:1"></div>
        <button onclick="cpyFileContent('${path}')" style="background:var(--bg3);border:1px solid var(--line);color:var(--t3);font-size:.69rem;padding:4px 9px;border-radius:5px;cursor:pointer;font-family:var(--fb)">📋 Copy</button>
        ${(lang==='markup'||lang==='css'||lang==='javascript')?`<button onclick="runFilePreview('${path}')" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:var(--green);font-size:.69rem;padding:4px 9px;border-radius:5px;cursor:pointer;font-family:var(--fb)">▶ Run</button>`:''}
        <button onclick="diffShowFromEditor('${path}')" style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;font-size:.69rem;padding:4px 9px;border-radius:5px;cursor:pointer;font-family:var(--fb)" title="Compare with previous version">⊟ Diff</button>
        <button onclick="document.getElementById('fileViewerModal').remove()" style="background:none;border:none;color:var(--t3);font-size:1rem;cursor:pointer;padding:3px 7px;border-radius:5px">✕</button>
      </div>
      <div style="flex:1;overflow:auto;background:#060c18;border-radius:0 0 12px 12px">
        <pre style="margin:0!important;background:transparent!important;padding:16px!important"><code id="fvCode" class="language-${lang}" style="font-family:var(--fc)!important;font-size:.77rem!important;line-height:1.7!important">${esc(info.content)}</code></pre>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  const code = document.getElementById('fvCode');
  if(window.Prism) Prism.highlightElement(code);
}

function cpyFileContent(path) {
  const info=S.fileTree[path]; if(!info) return;
  navigator.clipboard.writeText(info.content).then(()=>showToast('Copied!','ok')).catch(()=>showToast('Copy failed','err'));
}

function diffShowFromEditor(path) {
  // Show diff between current file and the previous AI version (if stored)
  const info = S.fileTree[path];
  if (!info) return;
  document.getElementById('fileViewerModal')?.remove();
  if (DIFF.path === path && DIFF.oldContent && DIFF.newContent) {
    diffShow(DIFF.path, DIFF.oldContent, DIFF.newContent);
  } else {
    showToast('No pending diff for this file — edit it via the AI first', 'inf');
  }
}

function runFilePreview(path) {
  const info=S.fileTree[path]; if(!info) return;
  document.getElementById('fileViewerModal')?.remove();
  S.previewHtml = info.content;
  loadPreview(info.content);
  switchMainTab('preview');
}

function expandAllTree() { document.querySelectorAll('.ft-row[data-dir="1"][data-open="0"]').forEach(el=>toggleDir(el)); }
function collapseAllTree() { document.querySelectorAll('.ft-row[data-dir="1"][data-open="1"]').forEach(el=>toggleDir(el)); }
function clearFileTree() { S.fileTree={}; S.openFiles=[]; S.activeFile=null; renderFileTree(); showToast('File tree cleared','inf'); }

