// ════════════════════════════════════════════
//  FILE HANDLING
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  MULTIMODAL FILE HANDLING  v5
//  • handleFiles — shared entry for all file inputs
//  • Rich image preview grid (72×72 thumbnails)
//  • Drag-and-drop onto .iarea
//  • Paste image from clipboard (Ctrl+V)
//  • Image lightbox (click thumbnail)
// ════════════════════════════════════════════

function handleFiles(e){
  const files = e?.target?.files || e; // accept FileList or DataTransfer.files
  Array.from(files).forEach(f=>{
    const isImage = f.type.startsWith('image/');
    if (isImage) {
      const r = new FileReader();
      r.onload = ev => {
        const dataUrl = ev.target.result;
        const b64     = dataUrl.split(',')[1];
        const en = { name:f.name, content:null, imageData:b64, dataUrl, mimeType:f.type, isImage:true, size:f.size };
        S.attached.push(en);
        renderAttachChips();
        showToast(`🖼 ${f.name} attached`, 'ok');
      };
      r.readAsDataURL(f);
    } else {
      ragReadFile(f).then(text => {
        if (!text?.trim()) { showToast(`${f.name}: no text extracted`,'wrn'); return; }
        const en = { name:f.name, content:text, imageData:null, mimeType:f.type, isImage:false, size:f.size };
        S.attached.push(en);
        renderAttachChips();
        ragIndex(f.name, 'file', text);
        ragUpdateUI();
        showToast(`📚 ${f.name} attached + indexed`,'ok');
      }).catch(err => showToast(`${f.name}: ${err.message}`,'err'));
    }
  });
  if (e?.target) e.target.value = '';
}

// ════════════════════════════════════════════
//  IMAGE → CODE  (+ menu shortcut)
//
//  Reads the dropped/selected image, attaches
//  it, then automatically fires a send with a
//  pre-written "generate pixel-accurate code"
//  prompt so the user doesn't have to type.
// ════════════════════════════════════════════
function imgToCode(e) {
  const file = e?.target?.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select an image file', 'wrn');
    return;
  }
  if (e?.target) e.target.value = '';

  const r = new FileReader();
  r.onload = ev => {
    const dataUrl = ev.target.result;
    const b64     = dataUrl.split(',')[1];
    const en = {
      name: file.name, content: null,
      imageData: b64, dataUrl,
      mimeType: file.type, isImage: true, size: file.size
    };
    S.attached.push(en);
    renderAttachChips();
    showToast(`🖼 ${file.name} ready — generating code…`, 'ok');

    // Auto-fill the textarea with a precise code-gen prompt
    const ta = document.getElementById('uIn');
    if (ta && !ta.value.trim()) {
      ta.value = 'Generate pixel-accurate, fully working code that matches this design exactly — replicate all colors, layout, spacing, typography, and interactive elements.';
      autoR(ta);
    }
    // Focus the textarea so user can tweak or just hit Enter
    ta?.focus();
  };
  r.readAsDataURL(file);
}

function renderAttachChips(){
  const images = S.attached.filter(x => x.isImage);
  const docs   = S.attached.filter(x => !x.isImage);

  let html = '';

  // Rich image thumbnail grid
  if (images.length) {
    html += '<div class="mm-tray">';
    S.attached.forEach((x, i) => {
      if (!x.isImage) return;
      const kb = x.size ? Math.round(x.size/1024) + 'KB' : '';
      html += `<div class="mm-img-card" onclick="mmLbOpen(${i})" title="${esc(x.name)}">
        <img src="${x.dataUrl || 'data:'+x.mimeType+';base64,'+x.imageData}" alt="${esc(x.name)}"/>
        <span class="mm-img-badge">IMG</span>
        <button class="mm-img-rm" onclick="event.stopPropagation();rmAtch(${i})" title="Remove">✕</button>
        <div class="mm-img-label">${esc(x.name.slice(0,18))}${kb?' · '+kb:''}</div>
      </div>`;
    });
    html += '</div>';
  }

  // Doc chips row
  if (docs.length) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">';
    S.attached.forEach((x, i) => {
      if (x.isImage) return;
      html += `<div class="atchf">📄 ${esc(x.name)} <span class="rma" onclick="rmAtch(${i})">×</span></div>`;
    });
    html += '</div>';
  }

  document.getElementById('atchFiles').innerHTML = html;

  // Show vision hint if images attached
  const pill = document.getElementById('ragCtxPill');
  if (pill && images.length) {
    pill.innerHTML = `<span class="rag-ctx-indicator" style="background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.2);color:#c4b5fd">👁 ${images.length} image${images.length!==1?'s':''} — vision mode</span>`;
    pill.style.display = '';
  } else if (pill && !images.length) {
    ragUpdateUI();
  }
}

function rmAtch(i){ S.attached.splice(i,1); renderAttachChips(); }

// ── Image Lightbox ────────────────────────────────────────────
function mmLbOpen(idx) {
  const item = S.attached[idx];
  if (!item?.isImage) return;
  const src = item.dataUrl || ('data:'+item.mimeType+';base64,'+item.imageData);
  document.getElementById('mmLbImg').src  = src;
  document.getElementById('mmLbName').textContent = item.name;
  document.getElementById('mmLightbox').classList.add('open');
}
function mmLbClose() {
  document.getElementById('mmLightbox').classList.remove('open');
  document.getElementById('mmLbImg').src = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') mmLbClose();
});

// ── Drag-and-Drop onto .iarea ─────────────────────────────────
(function initDragDrop() {
  const iarea = document.querySelector('.iarea') || document.getElementById('chatPane');
  if (!iarea) return;

  let dragCounter = 0;

  iarea.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragCounter++;
    iarea.classList.add('drag-over');
  });
  iarea.addEventListener('dragleave', e => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; iarea.classList.remove('drag-over'); }
  });
  iarea.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  iarea.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    iarea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) handleFiles(files);
  });
})();

// ── Paste image from clipboard (Ctrl+V anywhere in input) ─────
document.addEventListener('paste', e => {
  // Only when focused inside the chat input or iarea
  const active = document.activeElement;
  const inInput = active && (active.id === 'uIn' || active.closest('.iarea'));
  if (!inInput) return;

  const items = Array.from(e.clipboardData?.items || []);
  const imageItems = items.filter(it => it.type.startsWith('image/'));
  if (!imageItems.length) return;

  e.preventDefault();
  imageItems.forEach((item, idx) => {
    const file = item.getAsFile();
    if (!file) return;
    // Give it a name based on timestamp
    const ext  = item.type.split('/')[1] || 'png';
    const named = new File([file], `paste-${Date.now()}-${idx}.${ext}`, { type: item.type });
    handleFiles([named]);
  });

  // Flash a "Pasted!" hint near the input
  const hint = document.createElement('span');
  hint.className = 'paste-hint';
  hint.textContent = '📋 Image pasted!';
  const atchEl = document.getElementById('atchFiles');
  if (atchEl) atchEl.parentNode.insertBefore(hint, atchEl.nextSibling);
  setTimeout(() => hint.remove(), 3000);
});

// ── PROMPT AI PLUS MENU ──
function togglePAPlusMenu(){
  const dd = document.getElementById('paPlusDropdown');
  const btn = document.getElementById('paPlusBtn');
  const isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  btn.classList.toggle('open', !isOpen);
  updatePAPlusItems(); // always sync state on open
}
function closePAPlusMenu(){
  const dd = document.getElementById('paPlusDropdown');
  const btn = document.getElementById('paPlusBtn');
  if (dd) dd.style.display = 'none';
  if (btn) btn.classList.remove('open');
}
function togglePAOpt(key){
  PA[key] = !PA[key];
}
function updatePAPlusItems(){
  document.getElementById('pa-plus-think')?.classList.toggle('active', !!PA.paThink);
  document.getElementById('pa-plus-structured')?.classList.toggle('active', !!PA.paStructured);
}
document.addEventListener('click', e => {
  if (!e.target.closest('#paPlusMenuWrap')) closePAPlusMenu();
});

// ════════════════════════════════════════════
