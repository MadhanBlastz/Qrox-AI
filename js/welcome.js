// ════════════════════════════════════════════
//  ENHANCED WELCOME SCREEN  v5
// ════════════════════════════════════════════

function wsRenderProviders() {
  const el = document.getElementById('wsProviders');
  if (!el) return;

  // Show top free providers + any with keys
  const show = PROVS.filter(p => p.browserOk).slice(0, 10);
  if (!show.length) { el.style.display = 'none'; return; }

  let html = '<span style="font-size:.6rem;color:var(--t4);font-family:var(--fh);font-weight:700;letter-spacing:.06em;white-space:nowrap">PROVIDERS</span>';
  show.forEach(p => {
    const hasKey  = !!S.keys[p.id];
    const isFree  = p.worksNoKey;
    const health  = CIRCUIT.getHealth(p.id);
    const dotCls  = health === 'down' ? 'nokey' : (hasKey || isFree) ? 'ok' : 'nokey';
    const label   = hasKey ? 'key ✓' : isFree ? 'free' : 'no key';
    html += `<div class="ws-prov-item">
      <div class="ws-prov-dot ${dotCls}"></div>
      <span>${p.logo} ${p.name.split(' ')[0]}</span>
      <span class="ws-prov-label">${label}</span>
    </div>`;
  });
  el.innerHTML = html;
}

function wsQuickStart(mode) {
  const inp = document.getElementById('uIn');
  if (mode === 'build') {
    // Enable build mode
    const cb = document.getElementById('btn-build');
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
    if (inp) { inp.placeholder = 'Describe what to build…'; inp.focus(); }
    showToast('⚡ Build Mode ON — describe what you want to build!', 'ok');
  } else {
    if (inp) { inp.focus(); }
    showToast('💬 Ask me anything!', 'inf');
  }
  // Scroll welcome out of view slightly to focus on input
  const ws = document.getElementById('ws');
  if (ws) ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

