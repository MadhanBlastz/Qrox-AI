// ════════════════════════════════════════════
//  TOKEN USAGE HEATMAP  v5
//
//  Overlays colour-coded intensity bars on
//  AI messages proportional to token count.
//  Green→Yellow→Orange→Red as tokens increase.
//  Toggle with the 🌡 Heatmap button.
// ════════════════════════════════════════════

const HEATMAP = { on: false };

function heatmapToggle() {
  HEATMAP.on = !HEATMAP.on;
  document.body.classList.toggle('heatmap-on', HEATMAP.on);
  ctrlUpdateToggles?.();
  if (HEATMAP.on) heatmapRender();
  else            heatmapClear();
  showToast(HEATMAP.on ? '🌡 Token heatmap ON' : 'Heatmap OFF', 'inf');
}

function heatmapRender() {
  const aiMsgs = document.querySelectorAll('#chatBox .msg.ai');
  if (!aiMsgs.length) return;

  // Calculate token counts for all AI messages
  const counts = Array.from(aiMsgs).map(el => {
    const bbl = el.querySelector('.bbl,.typing-bbl-wrap');
    return bbl ? costEstimateTokens(bbl.innerText || bbl.textContent || '') : 0;
  });
  const maxCount = Math.max(1, ...counts);

  counts.forEach((count, i) => {
    const msgEl = aiMsgs[i];
    // Remove old bar
    msgEl.querySelector('.heatmap-bar')?.remove();

    const pct = count / maxCount;
    const col = _heatmapColor(pct);
    const w   = Math.max(4, Math.round(pct * 100));

    const bar = document.createElement('div');
    bar.className = 'heatmap-bar';
    bar.style.cssText = `width:${w}%;background:${col};opacity:1`;
    bar.title = `~${count.toLocaleString()} tokens (${Math.round(pct*100)}% of max in session)`;

    // Also tint the bubble border
    const bbl = msgEl.querySelector('.bbl,.typing-bbl-wrap');
    if (bbl && HEATMAP.on) {
      bbl.style.borderLeft = `3px solid ${col}`;
    }

    msgEl.querySelector('.bbl,.typing-bbl-wrap')?.after(bar);
  });
}

function heatmapClear() {
  document.querySelectorAll('.heatmap-bar').forEach(el => el.remove());
  document.querySelectorAll('#chatBox .msg.ai .bbl,.typing-bbl-wrap').forEach(el => {
    el.style.borderLeft = '';
  });
}

function _heatmapColor(pct) {
  if (pct < 0.25) return `hsl(142,70%,45%)`;          // green
  if (pct < 0.50) return `hsl(${142-(pct-0.25)*360},70%,45%)`;
  if (pct < 0.75) return `hsl(38,95%,55%)`;            // orange
  return `hsl(${Math.round((1-pct)*38)},95%,55%)`;    // red
}

// Re-render heatmap after each send when active
function heatmapMaybeUpdate() {
  if (HEATMAP.on) setTimeout(heatmapRender, 200);
}

// ════════════════════════════════════════════
//  AMBIENT AUDIO  v5
//
//  Generative soundscapes via Web Audio API —
//  no external files required.
//  Modes: Lo-fi, Rain, White Noise, Forest,
//         Deep Space, Typing Café.
//  Plays continuously once enabled; can be
//  set to play only during AI generation.
// ════════════════════════════════════════════

const AUDIO = {
  ctx:      null,
  nodes:    [],       // active audio nodes
  mode:     null,     // current mode id
  vol:      0.3,
  playing:  false,
  pickerOpen: false,
};

const AUDIO_MODES = [
  { id:'off',        icon:'🔇', label:'Off' },
  { id:'lofi',       icon:'🎵', label:'Lo-fi Beats' },
  { id:'rain',       icon:'🌧', label:'Rain' },
  { id:'whitenoise', icon:'📻', label:'White Noise' },
  { id:'forest',     icon:'🌲', label:'Forest' },
  { id:'space',      icon:'🌌', label:'Deep Space' },
  { id:'cafe',       icon:'☕', label:'Typing Café' },
];

function ctrlAudioToggle() {
  if (AUDIO.playing) {
    // Turn off
    audioStop();
    AUDIO.mode = null;
    document.getElementById('ctrlAudio')?.classList.remove('on');
  } else {
    // Turn on — use last mode or default to lofi
    const mode = AUDIO.mode || 'lofi';
    audioSetMode(mode);
    document.getElementById('ctrlAudio')?.classList.add('on');
  }
}

function audioPickerToggle() {
  AUDIO.pickerOpen = !AUDIO.pickerOpen;
  const picker = document.getElementById('audioPicker');
  if (AUDIO.pickerOpen) {
    _audioRenderModes();
    picker.classList.add('open');
  } else {
    picker.classList.remove('open');
  }
}

// Close audio picker on outside click (but not when clicking inside ctrlPanel)
document.addEventListener('click', e => {
  const wrap  = document.getElementById('audioWrap');
  const ctrl  = document.getElementById('ctrlPanel');
  if (wrap && !wrap.contains(e.target) && (!ctrl || !ctrl.contains(e.target))) {
    document.getElementById('audioPicker')?.classList.remove('open');
    AUDIO.pickerOpen = false;
  }
});

function _audioRenderModes() {
  const el = document.getElementById('audioModes');
  if (!el) return;
  el.innerHTML = AUDIO_MODES.map(m =>
    `<button class="audio-mode-btn ${AUDIO.mode===m.id?'on':''}" onclick="audioSetMode('${m.id}')">
      <span>${m.icon}</span><span>${m.label}</span>
    </button>`
  ).join('');
}

function audioSetMode(modeId) {
  audioStop();
  AUDIO.mode = modeId;
  _audioRenderModes();
  if (modeId === 'off') {
    document.getElementById('ctrlAudio')?.classList.remove('on');
    document.getElementById('audioPicker').classList.remove('open');
    AUDIO.pickerOpen = false;
    return;
  }
  audioStart(modeId);
  document.getElementById('ctrlAudio')?.classList.add('on');
}

function audioSetVol(val) {
  AUDIO.vol = parseFloat(val);
  // Update all gain nodes
  AUDIO.nodes.forEach(n => { if (n.gain) n.gain.setTargetAtTime(AUDIO.vol, AUDIO.ctx.currentTime, 0.1); });
  // Save pref
  try { localStorage.setItem('eai_audio_vol', val); } catch(e) {}
}

function audioStop() {
  AUDIO.nodes.forEach(n => {
    try { n.stop?.(); n.disconnect?.(); } catch(e) {}
  });
  AUDIO.nodes = [];
  AUDIO.playing = false;
  if (AUDIO.ctx) { try { AUDIO.ctx.suspend(); } catch(e) {} }
}

function audioStart(modeId) {
  if (!AUDIO.ctx) {
    AUDIO.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  AUDIO.ctx.resume();
  AUDIO.playing = true;

  const vol = AUDIO.vol;
  const ctx = AUDIO.ctx;
  const nodes = [];

  const makeGain = (v) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * vol, ctx.currentTime);
    g.connect(ctx.destination);
    return g;
  };

  const makeNoise = (type = 'white') => {
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (type === 'white') {
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random() * 2 - 1;
        b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759;
        b2=.96900*b2+w*.1538520; b3=.86650*b3+w*.3104856;
        b4=.55000*b4+w*.5329522; b5=-.7616*b5-w*.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6+w*.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else { // brown
      let last = 0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * w) / 1.02;
        last = data[i]; data[i] *= 3.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  };

  const makeTone = (freq, type = 'sine', vol2 = 0.05) => {
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    const g = makeGain(vol2);
    osc.connect(g); osc.start();
    nodes.push(osc, g);
    return osc;
  };

  if (modeId === 'lofi') {
    // Soft pink noise base + gentle low freq tones
    const n = makeNoise('pink');
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=400;
    const g = makeGain(0.12);
    n.connect(f); f.connect(g); n.start();
    nodes.push(n, f, g);
    // Gentle harmonic tones
    [196, 293, 392].forEach(freq => makeTone(freq, 'sine', 0.015));
  }
  else if (modeId === 'rain') {
    // White noise through filters to simulate rain
    const n = makeNoise('white');
    const f1 = ctx.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=1200; f1.Q.value=0.5;
    const f2 = ctx.createBiquadFilter(); f2.type='highpass';  f2.frequency.value=600;
    const g = makeGain(0.35);
    n.connect(f1); f1.connect(f2); f2.connect(g); n.start();
    nodes.push(n, f1, f2, g);
    // Occasional drip tones
    const drip = () => {
      if (!AUDIO.playing || AUDIO.mode !== 'rain') return;
      const o = ctx.createOscillator(); o.frequency.value = 800 + Math.random()*600;
      const gd = ctx.createGain(); gd.gain.setValueAtTime(0.06*vol, ctx.currentTime);
      gd.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.15);
      o.connect(gd); gd.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.15);
      setTimeout(drip, 400 + Math.random()*1200);
    };
    setTimeout(drip, 500);
  }
  else if (modeId === 'whitenoise') {
    const n = makeNoise('white');
    const g = makeGain(0.2);
    n.connect(g); n.start(); nodes.push(n, g);
  }
  else if (modeId === 'forest') {
    // Pink noise base (wind through leaves)
    const wind = makeNoise('pink');
    const fWind = ctx.createBiquadFilter(); fWind.type='bandpass'; fWind.frequency.value=300; fWind.Q.value=0.3;
    const gWind = makeGain(0.15);
    wind.connect(fWind); fWind.connect(gWind); wind.start();
    nodes.push(wind, fWind, gWind);
    // Cricket-like high freq tone
    makeTone(4200, 'sine', 0.008);
    makeTone(3800, 'sine', 0.006);
  }
  else if (modeId === 'space') {
    // Deep brown noise + slow LFO modulated tones
    const n = makeNoise('brown');
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=120;
    const g = makeGain(0.25);
    n.connect(f); f.connect(g); n.start(); nodes.push(n, f, g);
    // Slowly evolving drone tones
    [40, 60, 80].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i*0.02;
      const lfoG = ctx.createGain(); lfoG.gain.value = 3;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      const og = makeGain(0.04);
      o.connect(og); o.start(); lfo.start();
      nodes.push(o, lfo, lfoG, og);
    });
  }
  else if (modeId === 'cafe') {
    // Murmur: pink noise + mild bandpass to simulate crowd
    const n = makeNoise('pink');
    const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=700; f.Q.value=0.4;
    const g = makeGain(0.18);
    n.connect(f); f.connect(g); n.start(); nodes.push(n, f, g);
    // Typing clicks
    const click = () => {
      if (!AUDIO.playing || AUDIO.mode !== 'cafe') return;
      const o = ctx.createOscillator(); o.frequency.value = 1800 + Math.random()*400;
      const gc = ctx.createGain(); gc.gain.setValueAtTime(0.04*vol, ctx.currentTime);
      gc.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.04);
      o.connect(gc); gc.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime+0.04);
      setTimeout(click, 80 + Math.random()*180);
    };
    setTimeout(click, 300);
  }

  AUDIO.nodes = nodes;
  // Restore volume setting
  try { AUDIO.vol = parseFloat(localStorage.getItem('eai_audio_vol') || '0.3'); } catch(e) {}
}

function audioInit() {
  // Restore saved mode on boot
  try {
    const saved = localStorage.getItem('eai_audio_mode');
    const savedVol = parseFloat(localStorage.getItem('eai_audio_vol') || '0.3');
    AUDIO.vol = savedVol;
    const volEl = document.getElementById('audioVol');
    if (volEl) volEl.value = savedVol;
    if (saved && saved !== 'off') {
      AUDIO.mode = saved;
      // Don't autoplay on boot — wait for user interaction (browser policy)
    }
  } catch(e) {}
}

// Save mode preference when changed
const _origAudioSetMode = audioSetMode;
audioSetMode = function(modeId) {
  _origAudioSetMode(modeId);
  try { localStorage.setItem('eai_audio_mode', modeId); } catch(e) {}
};

// ════════════════════════════════════════════
//  KEYBOARD SHORTCUT MAP  v5
//
//  kmOpen()  — show the overlay
//  kmClose() — hide it
//  Press ? anywhere (not in textarea) to open.
//  All shortcuts are defined in KM_SECTIONS.
// ════════════════════════════════════════════

// Helper to build key chord HTML
function _kmKeys(...keys) {
  return keys.map((k, i) => {
    const isMod = ['Ctrl','⌘','⇧','Alt','Opt'].includes(k);
    const isSpecial = k.length > 1 && !isMod;
    const cls = isMod ? 'mod' : isSpecial ? 'special' : '';
    const html = `<span class="km-key ${cls}">${k}</span>`;
    return i < keys.length - 1 ? html + '<span class="km-plus">+</span>' : html;
  }).join('');
}

// All shortcut sections
const KM_SECTIONS = [
  {
    title: 'Chat & Navigation', icon: '💬',
    rows: [
      { desc: 'Send message',               keys: ['↵'] },
      { desc: 'New line in input',          keys: ['⇧','↵'] },
      { desc: 'New chat',                   keys: ['Ctrl','N'] },
      { desc: 'Stop generation',            keys: ['Ctrl','C'] },
      { desc: 'Paste image from clipboard', keys: ['Ctrl','V'] },
    ]
  },
  {
    title: 'Command Palette', icon: '⌘',
    rows: [
      { desc: 'Open / close palette',       keys: ['Ctrl','K'] },
      { desc: 'Navigate items',             keys: ['↑'] , keys2: ['↓'] },
      { desc: 'Run selected command',       keys: ['↵'] },
      { desc: 'Close palette',              keys: ['Esc'] },
    ]
  },
  {
    title: 'Build & Code', icon: '💻',
    rows: [
      { desc: 'Run preview',                keys: ['Ctrl','↵'], note:'in chat' },
      { desc: 'Accept all diff changes',    keys: ['—'], note:'click ✓ Accept All' },
      { desc: 'Reject diff changes',        keys: ['—'], note:'click ✕ Reject' },
      { desc: 'Toggle build mode',          keys: ['—'], note:'⚡ Build toggle' },
    ]
  },
  {
    title: 'Templates & Tools', icon: '📝',
    rows: [
      { desc: 'Open prompt templates',      keys: ['Ctrl','T'] },
      { desc: 'Open command palette',       keys: ['Ctrl','K'] },
      { desc: 'Global search',              keys: ['Ctrl','⇧','F'] },
    ]
  },
  {
    title: 'Voice', icon: '🎙',
    rows: [
      { desc: 'Toggle microphone',          keys: ['—'], note:'🎙 button' },
      { desc: 'Toggle auto-read',           keys: ['—'], note:'🔊 in voice bar' },
      { desc: 'Stop all voice',             keys: ['—'], note:'⏹ in voice bar' },
      { desc: 'Stop mic / confirm input',   keys: ['—'], note:'1.8s silence' },
    ]
  },
  {
    title: 'Overlays & Modals', icon: '🪟',
    rows: [
      { desc: 'Close any overlay',          keys: ['Esc'] },
      { desc: 'Close lightbox',             keys: ['Esc'] },
      { desc: 'Show shortcut map',          keys: ['?'] },
      { desc: 'Click outside to close',     keys: ['—'], note:'overlays' },
    ]
  },
  {
    title: 'Agents & Automation', icon: '🤖',
    rows: [
      { desc: 'Stop generation / pipeline', keys: ['⏹'], note:'stop button' },
      { desc: 'Toggle parallel mode',       keys: ['—'], note:'⚡ Parallel btn' },
      { desc: 'Toggle agents mode',         keys: ['—'], note:'🤖 Agents toggle' },
      { desc: 'Branch conversation',        keys: ['—'], note:'⎇ hover message' },
    ]
  },
  {
    title: 'File & Session', icon: '📁',
    rows: [
      { desc: 'Export chat as Markdown',    keys: ['—'], note:'⬇ button' },
      { desc: 'Share chat (copy link)',      keys: ['—'], note:'🔗 Share' },
      { desc: 'Download project ZIP',       keys: ['—'], note:'⬇ ZIP' },
      { desc: 'Load earlier messages',      keys: ['—'], note:'⬆ Load earlier' },
    ]
  },
];

function kmOpen() {
  _kmRender();
  document.getElementById('kmOverlay').classList.add('open');
}

function kmClose() {
  document.getElementById('kmOverlay').classList.remove('open');
}

function _kmRender() {
  const body = document.getElementById('kmBody');
  if (!body) return;

  body.innerHTML = KM_SECTIONS.map(sec => {
    const rows = sec.rows.map(r => {
      let keysHtml;
      if (r.keys[0] === '—') {
        keysHtml = `<span style="font-size:.6rem;color:var(--t4);font-family:var(--fc)">${r.note || '—'}</span>`;
      } else {
        keysHtml = `<div class="km-keys">${_kmKeys(...r.keys)}</div>`;
        if (r.keys2) keysHtml += `<span class="km-plus">/</span><div class="km-keys">${_kmKeys(...r.keys2)}</div>`;
        if (r.note)  keysHtml += `<span style="font-size:.58rem;color:var(--t4);font-family:var(--fc);margin-left:3px">${r.note}</span>`;
      }
      return `<div class="km-row">
        <span class="km-desc">${esc(r.desc)}</span>
        <div style="display:flex;align-items:center;gap:4px">${keysHtml}</div>
      </div>`;
    }).join('');

    return `<div class="km-section">
      <div class="km-section-title">
        <span class="km-section-icon">${sec.icon}</span>${esc(sec.title)}
      </div>
      ${rows}
    </div>`;
  }).join('');
}

// Press ? anywhere outside an input to open
document.addEventListener('keydown', e => {
  if (e.key === '?' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    document.getElementById('kmOverlay').classList.contains('open') ? kmClose() : kmOpen();
  }
  if (e.key === 'Escape') {
    const km = document.getElementById('kmOverlay');
    if (km?.classList.contains('open')) { kmClose(); return; }
  }
});

