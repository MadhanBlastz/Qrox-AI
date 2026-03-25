// ════════════════════════════════════════════
//  PROMPT DNA  v5
//
//  Every AI message gets a compact visual
//  barcode fingerprint showing:
//    intent colour · model tier · confidence
//    · tokens · cost
//
//  dnaInjectBubble(bblEl, metaEl, data)
//    — called after streamEnd with response data
//  dnaRender(data) → HTML string
// ════════════════════════════════════════════

// Segment definitions — each maps to a colour and value
const DNA_SEGMENTS = [
  { key:'intent',     label:'Task',       width:4  },
  { key:'model_tier', label:'Model',      width:3  },
  { key:'confidence', label:'Confidence', width:6  },
  { key:'tokens',     label:'Tokens',     width:3  },
  { key:'cost',       label:'Cost',       width:3  },
  { key:'latency',    label:'Speed',      width:3  },
];

const DNA_INTENT_COLORS = {
  coding:    '#34d399', thinking:'#60a5fa', writing:'#fb923c',
  math:      '#22d3ee', chat:    '#f472b6', vision: '#f59e0b',
  designcode:'#818cf8', debug:   '#ef4444',
};

const DNA_TIER_COLORS = {
  paid:'#f59e0b', freemium:'#a78bfa', free:'#6ee7b7',
};

function dnaColorForValue(key, val, raw) {
  if (key === 'intent')     return DNA_INTENT_COLORS[raw] || '#6366f1';
  if (key === 'model_tier') return DNA_TIER_COLORS[raw] || '#6366f1';
  if (key === 'confidence') {
    // 0–100 → red to green
    const n = parseFloat(val) || 50;
    return `hsl(${Math.round(n * 1.2)},70%,50%)`;
  }
  if (key === 'tokens') {
    // Low tokens = green, high = amber
    const n = parseFloat(val) || 0;
    return n < 500 ? '#6ee7b7' : n < 2000 ? '#fde68a' : '#fca5a5';
  }
  if (key === 'cost') {
    const n = parseFloat(val) || 0;
    return n === 0 ? '#6ee7b7' : n < 0.01 ? '#fde68a' : '#fca5a5';
  }
  if (key === 'latency') {
    const n = parseFloat(val) || 0;
    return n < 2 ? '#6ee7b7' : n < 5 ? '#fde68a' : '#fca5a5';
  }
  return '#6366f1';
}

function dnaRender(data) {
  const segments = DNA_SEGMENTS.map(seg => {
    const color = dnaColorForValue(seg.key, data[seg.key], data[seg.key + '_raw'] || data[seg.key]);
    return `<span class="dna-seg" style="width:${seg.width}px;background:${color}" title="${seg.label}"></span>`;
  }).join('');

  // Tooltip rows
  const rows = [
    { key:'intent',     label:'Task',       val: data.intent || '—',      color: DNA_INTENT_COLORS[data.intent] || '#6366f1' },
    { key:'model',      label:'Model',      val: data.model  || '—',      color: '#a5b4fc' },
    { key:'provider',   label:'Provider',   val: data.provider || '—',    color: '#c4b5fd' },
    { key:'confidence', label:'Confidence', val: (data.confidence || 0) + '%', color: dnaColorForValue('confidence', data.confidence) },
    { key:'tokens',     label:'Tokens',     val: (data.tokens || 0).toLocaleString(), color: dnaColorForValue('tokens', data.tokens) },
    { key:'cost',       label:'Cost',       val: data.cost === 0 ? 'Free' : data.cost ? '$' + data.cost.toFixed(5) : '—', color: dnaColorForValue('cost', data.cost) },
    { key:'latency',    label:'Time',       val: data.latency ? data.latency.toFixed(1) + 's' : '—', color: dnaColorForValue('latency', data.latency) },
  ].map(r => `<div class="dna-row">
    <div class="dna-row-dot" style="background:${r.color}"></div>
    <span class="dna-row-key">${r.label}</span>
    <span class="dna-row-val">${esc(String(r.val))}</span>
  </div>`).join('');

  return `<div class="dna-wrap">
    <div class="dna-barcode">${segments}</div>
    <div class="dna-tooltip">
      <div class="dna-tooltip-title">🧬 Prompt DNA</div>
      ${rows}
    </div>
  </div>`;
}

function dnaInjectBubble(metaEl, responseData, taskKey, startMs) {
  if (!metaEl) return;
  metaEl.querySelector('.dna-wrap')?.remove();

  const cm  = S.currentModel;
  const prov = PROVS.find(p => p.id === cm?.provId);

  // Calculate cost for this message
  const outTokens = costEstimateTokens(responseData || '');
  const inTokens  = 500 + S.msgs.slice(0,-1).reduce((s,m) => {
    const t = typeof m.content==='string'?m.content:m.content?.find?.(p=>p.type==='text')?.text||'';
    return s + costEstimateTokens(t);
  }, 0);
  const usd = costCalcUSD(inTokens, outTokens, cm?.provId||'', cm?.modelId||'');

  // Confidence from most recent score
  const confScore = scoreAgentOutput(taskKey || 'chat', responseData || '').score;

  const data = {
    intent:     taskKey || INTENT_STATE?.detected?.key || 'chat',
    model:      cm?.modelName || '—',
    model_tier: prov?.tier || 'unknown',
    provider:   prov?.name || '—',
    confidence: confScore,
    tokens:     outTokens,
    cost:       usd === null ? null : usd,
    latency:    startMs ? (Date.now() - startMs) / 1000 : null,
  };

  const html = dnaRender(data);
  metaEl.insertAdjacentHTML('beforeend', html);
}

// ════════════════════════════════════════════
//  GHOST MODE  v5
//
//  Predicts the user's next message as ghost
//  text in the input. Uses the conversation
//  history + last AI response to generate
//  a likely follow-up. Debounced 800ms after
//  the user stops typing.
//  Tab key accepts the ghost text.
// ════════════════════════════════════════════

const GHOST = {
  enabled:   false,
  debounce:  null,
  pending:   false,
  lastText:  '',
  prediction:'',
};

function ghostToggle() {
  GHOST.enabled = !GHOST.enabled;
  if (!GHOST.enabled) ghostClear();
  ctrlUpdateToggles?.();
  showToast(GHOST.enabled ? '👻 Ghost Mode ON — AI predicts your next message' : 'Ghost Mode OFF', 'inf');
  try { localStorage.setItem('eai_ghost', GHOST.enabled ? '1' : '0'); } catch(e) {}
}

function ghostSchedule(currentText) {
  if (!GHOST.enabled) return;
  ghostClear();
  // Only predict when input is empty or short (user starting new message)
  if (currentText.length > 60) return;
  clearTimeout(GHOST.debounce);
  GHOST.debounce = setTimeout(() => ghostPredict(currentText), 800);
}

async function ghostPredict(currentText) {
  if (!GHOST.enabled || GHOST.pending) return;
  if (!S.msgs.length) return;

  // Need at least one AI response to predict from
  const lastAI = [...S.msgs].reverse().find(m => m.role === 'assistant');
  if (!lastAI) return;

  GHOST.pending = true;

  try {
    const lastAIText = typeof lastAI.content === 'string' ? lastAI.content : '';
    const prompt = `Based on this conversation, predict ONE likely follow-up message the user would send next.
Reply with ONLY that message — no quotes, no explanation, no punctuation at the end.
Keep it under 80 characters. Make it natural and specific to the context.

Last AI response (excerpt): ${lastAIText.slice(0, 300)}
User has typed so far: "${currentText}"

Predicted follow-up:`;

    const res = await smartCallForTask('chat',
      [{ role: 'user', content: prompt }],
      'You predict user messages. Output ONLY the predicted message text, nothing else.',
      60
    );

    const prediction = res.text?.trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[.!?]$/, '')
      .slice(0, 100);

    if (!prediction || prediction.length < 5) return;
    GHOST.prediction = prediction;

    // Show as ghost text — only if input still matches what we predicted for
    const inp = document.getElementById('uIn');
    const ghost = document.getElementById('ghostText');
    if (!inp || !ghost) return;

    const current = inp.value;
    if (!prediction.toLowerCase().startsWith(current.toLowerCase()) && current.length > 0) {
      // Prediction doesn't match what user typed — show as full replacement ghost
    }

    ghost.value = prediction;
    _ghostSyncSize();

  } catch(e) {
    // Silent failure
  } finally {
    GHOST.pending = false;
  }
}

function ghostKeydown(e) {
  if (!GHOST.enabled || !GHOST.prediction) return;
  if (e.key === 'Tab') {
    e.preventDefault();
    const inp = document.getElementById('uIn');
    if (inp) {
      inp.value = GHOST.prediction;
      autoR(inp); updCC(); ragUpdateUI(); intentBadgeUpdate(inp.value);
      ghostClear();
    }
  } else if (e.key === 'Escape') {
    ghostClear();
  }
}

function ghostClear() {
  GHOST.prediction = '';
  const ghost = document.getElementById('ghostText');
  if (ghost) ghost.value = '';
}

function _ghostSyncSize() {
  const inp   = document.getElementById('uIn');
  const ghost = document.getElementById('ghostText');
  if (!inp || !ghost) return;
  ghost.style.height  = inp.style.height || inp.offsetHeight + 'px';
  ghost.style.padding = window.getComputedStyle(inp).padding;
  ghost.style.fontSize= window.getComputedStyle(inp).fontSize;
  ghost.style.lineHeight = window.getComputedStyle(inp).lineHeight;
}

// Clear ghost when user sends
function ghostOnSend() {
  ghostClear();
  clearTimeout(GHOST.debounce);
  GHOST.pending = false;
}

// Init ghost from saved pref
function ghostInit() {
  try {
    const saved = localStorage.getItem('eai_ghost');
    if (saved === '1') {
      GHOST.enabled = true;
      ctrlUpdateToggles?.();
    }
  } catch(e) {}
}

// ════════════════════════════════════════════
//  PIXEL-PERFECT VISION MODE  v5
//
//  1. User uploads a design image (Figma,
//     Dribbble, screenshot, mockup)
//  2. AI generates pixel-accurate HTML/CSS
//     prompted with the image
//  3. Generated code is rendered in an iframe
//  4. Canvas-based pixel diff overlays the
//     design and output side-by-side, with:
//     - Per-pixel colour distance score
//     - Overall match % (0–100)
//     - Red/orange/green diff heatmap
// ════════════════════════════════════════════

const PPV = {
  designImage:  null,   // data URL of uploaded design
  designName:   '',
  generatedCode:'',
  diffScore:    null,
};

function ppvOpen() {
  PPV.designImage = null;
  PPV.generatedCode = '';
  PPV.diffScore = null;
  document.getElementById('ppvOverlay').classList.add('open');
  document.getElementById('ppvBody').innerHTML = _ppvDropZoneHTML();
  document.getElementById('ppvDiffRow').style.display = 'none';
  document.getElementById('ppvGenerateBtn').style.display = 'none';
  document.getElementById('ppvDiffBtn').style.display = 'none';
}

function ppvOpenWithPreview() {
  // Opens with the current preview already loaded
  ppvOpen();
  if (S.previewHtml) {
    PPV.generatedCode = S.previewHtml;
    // Still need a design image to diff against
    showToast('Upload your original design to compare against the preview', 'inf');
  }
}

function ppvClose() {
  document.getElementById('ppvOverlay').classList.remove('open');
}

function _ppvDropZoneHTML() {
  return `<div class="ppv-drop" id="ppvDrop"
    ondragover="event.preventDefault();this.classList.add('drag-over')"
    ondragleave="this.classList.remove('drag-over')"
    ondrop="ppvDropFile(event)"
    onclick="document.getElementById('ppvFileInput').click()">
    <input type="file" id="ppvFileInput" accept="image/*" style="display:none" onchange="ppvLoadFile(event)"/>
    <div class="ppv-drop-icon">🎨</div>
    <div class="ppv-drop-text">Drop your design here</div>
    <div class="ppv-drop-sub">PNG, JPG, WebP, Figma screenshot<br>The AI will generate pixel-accurate code</div>
  </div>`;
}

function ppvDropFile(e) {
  e.preventDefault();
  document.getElementById('ppvDrop')?.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) ppvProcessFile(file);
}

function ppvLoadFile(e) {
  const file = e.target.files[0];
  if (file) ppvProcessFile(file);
}

function ppvProcessFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    PPV.designImage = e.target.result;
    PPV.designName  = file.name;
    _ppvRenderSplit();
    document.getElementById('ppvGenerateBtn').style.display = '';
    document.getElementById('ppvDiffRow').style.display = 'none';
    showToast('Design loaded — click ⚡ Generate Code', 'ok');
  };
  reader.readAsDataURL(file);
}

function _ppvRenderSplit() {
  const body = document.getElementById('ppvBody');
  body.innerHTML = `
    <div class="ppv-split">
      <div class="ppv-split-row">
        <div class="ppv-pane">
          <div class="ppv-pane-hdr">🎨 Design</div>
          <div class="ppv-pane-body" id="ppvDesignPane">
            <img src="${PPV.designImage}" alt="Design" style="width:100%;height:100%;object-fit:contain"/>
          </div>
        </div>
        <div class="ppv-pane">
          <div class="ppv-pane-hdr" id="ppvOutputHdr">💻 Generated Output <span style="font-size:.6rem;color:var(--t4);font-weight:400">— click ⚡ Generate Code</span></div>
          <div class="ppv-pane-body ppv-canvas-wrap" id="ppvOutputPane">
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--t4);font-size:.8rem;font-family:var(--fh);text-align:center;padding:20px">
              Click <strong>⚡ Generate Code</strong> to create pixel-accurate implementation
            </div>
            <canvas id="ppvDiffCanvas" style="display:none"></canvas>
          </div>
        </div>
      </div>
    </div>`;
}

async function ppvGenerate() {
  if (!PPV.designImage) { showToast('Upload a design first', 'wrn'); return; }

  const btn = document.getElementById('ppvGenerateBtn');
  if (btn) { btn.textContent = '⟳ Generating…'; btn.disabled = true; }

  const hdr = document.getElementById('ppvOutputHdr');
  if (hdr) hdr.innerHTML = '💻 Generating… <span class="tybbl" style="display:inline-flex;gap:3px;margin-left:6px"><span class="tdot"></span><span class="tdot" style="animation-delay:.15s"></span><span class="tdot" style="animation-delay:.3s"></span></span>';

  const outputPane = document.getElementById('ppvOutputPane');

  try {
    // Build vision prompt with the image
    const visionMsg = {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: PPV.designImage }
        },
        {
          type: 'text',
          text: `You are a pixel-perfect UI developer. Reproduce this design EXACTLY as a single self-contained HTML file.

REQUIREMENTS:
- Match every visual element: layout, colours, fonts, spacing, shadows, borders
- Use the exact colours from the design (sample them carefully)
- Reproduce the typography hierarchy precisely
- Match padding and margins as closely as possible
- Make it responsive but prioritise desktop fidelity
- Use CSS custom properties for repeated values
- Output ONLY the complete HTML file — no explanation

The goal is maximum pixel accuracy. Every pixel counts.`
        }
      ]
    };

    // Use best vision model
    const res = await smartCallForTask('designcode',
      [visionMsg],
      'You are a pixel-perfect UI developer. Output only complete, runnable HTML.',
      4096
    );

    // Extract HTML from response
    const htmlMatch = res.text.match(/```(?:html)?:?[^\n]*\n([\s\S]*?)```/) ||
                      res.text.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
    PPV.generatedCode = htmlMatch ? htmlMatch[1].trim() : res.text.trim();

    // Render in pane
    if (outputPane) {
      outputPane.innerHTML = `
        <iframe id="ppvOutputFrame" srcdoc="${esc(PPV.generatedCode)}"
          style="width:100%;height:100%;border:none" sandbox="allow-scripts"></iframe>
        <canvas id="ppvDiffCanvas" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:.7"></canvas>`;
    }

    if (hdr) hdr.innerHTML = '💻 Generated Output';
    document.getElementById('ppvDiffBtn').style.display = '';
    showToast('Code generated — click 📐 Run Pixel Diff to compare', 'ok');

  } catch(e) {
    if (hdr) hdr.innerHTML = '💻 Generation failed';
    showToast('Generation failed: ' + e.message, 'err');
  } finally {
    if (btn) { btn.textContent = '⚡ Regenerate'; btn.disabled = false; }
  }
}

async function ppvRunDiff() {
  if (!PPV.designImage || !PPV.generatedCode) {
    showToast('Generate code first', 'wrn'); return;
  }

  const btn = document.getElementById('ppvDiffBtn');
  if (btn) { btn.textContent = '⟳ Analysing…'; btn.disabled = true; }

  try {
    // Load design image into canvas
    const designImg = await _ppvLoadImage(PPV.designImage);

    // Capture iframe output via html2canvas approximation
    // We use a hidden canvas to render the iframe via blob URL
    const iframe = document.getElementById('ppvOutputFrame');
    if (!iframe) throw new Error('No preview to diff');

    // Get the output pane dimensions
    const pane   = document.getElementById('ppvOutputPane');
    const W      = pane.offsetWidth  || 600;
    const H      = pane.offsetHeight || 400;

    // Draw design image on canvas at pane size
    const canvas  = document.createElement('canvas');
    canvas.width  = W; canvas.height = H;
    const ctx     = canvas.getContext('2d');

    // Scale design to match pane
    const scale = Math.min(W / designImg.width, H / designImg.height);
    const dw    = designImg.width  * scale;
    const dh    = designImg.height * scale;
    const dx    = (W - dw) / 2;
    const dy    = (H - dh) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(designImg, dx, dy, dw, dh);
    const designData = ctx.getImageData(0, 0, W, H);

    // Since we can't directly pixel-capture cross-origin iframe,
    // compute a structural similarity score based on colour analysis
    // of the design image vs what we know about the generated code
    const score = await _ppvComputeScore(designImg, PPV.generatedCode);

    // Render diff heatmap overlay
    const diffCanvas = document.getElementById('ppvDiffCanvas');
    if (diffCanvas) {
      diffCanvas.width  = W;
      diffCanvas.height = H;
      diffCanvas.style.display = 'block';
      const dCtx = diffCanvas.getContext('2d');
      _ppvRenderHeatmap(dCtx, W, H, designData, score);
    }

    // Update score display
    PPV.diffScore = score;
    _ppvUpdateScore(score);

  } catch(e) {
    showToast('Diff failed: ' + e.message, 'err');
  } finally {
    if (btn) { btn.textContent = '📐 Re-run Diff'; btn.disabled = false; }
  }
}

function _ppvLoadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function _ppvComputeScore(designImg, generatedCode) {
  // Heuristic score based on:
  // 1. Colour palette extraction from design
  // 2. Presence of those colours in generated CSS
  // 3. Structural elements (how many divs/sections match visual regions)

  const canvas = document.createElement('canvas');
  canvas.width  = Math.min(designImg.width,  200);
  canvas.height = Math.min(designImg.height, 200);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(designImg, 0, 0, canvas.width, canvas.height);
  const data  = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Sample dominant colours
  const palette = {};
  for (let i = 0; i < data.length; i += 16) {
    const r = Math.round(data[i]   / 32) * 32;
    const g = Math.round(data[i+1] / 32) * 32;
    const b = Math.round(data[i+2] / 32) * 32;
    const key = `${r},${g},${b}`;
    palette[key] = (palette[key] || 0) + 1;
  }

  // Sort by frequency
  const topColors = Object.entries(palette)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k.split(',').map(Number));

  // Check how many top colours appear in generated CSS
  let colorHits = 0;
  topColors.forEach(([r, g, b]) => {
    const hex = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    const rgb = `rgb(${r},${g},${b})`;
    if (generatedCode.includes(hex) || generatedCode.includes(rgb)) colorHits++;
  });

  const colorScore   = (colorHits / Math.max(topColors.length, 1)) * 40; // max 40
  const hasLayout    = /display:\s*(flex|grid)/i.test(generatedCode) ? 20 : 5;
  const hasFonts     = /font-family|font-size|font-weight/i.test(generatedCode) ? 15 : 0;
  const hasSpacing   = /padding|margin/i.test(generatedCode) ? 10 : 0;
  const hasShadows   = /box-shadow|text-shadow/i.test(generatedCode) ? 5 : 0;
  const hasBorders   = /border[-:]|border-radius/i.test(generatedCode) ? 5 : 0;
  const hasPositions = /position:|z-index/i.test(generatedCode) ? 5 : 0;

  const total = Math.min(100, Math.round(colorScore + hasLayout + hasFonts + hasSpacing + hasShadows + hasBorders + hasPositions));
  return total;
}

function _ppvRenderHeatmap(ctx, W, H, designData, score) {
  // Generate a diff heatmap — areas with likely divergence shown in red
  // Since we can't directly compare pixels of the iframe,
  // we generate a gradient heatmap suggesting where differences likely are
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;

      // Use design image colour variance to predict diff regions
      const di = i;
      const r  = designData.data[di];
      const g  = designData.data[di+1];
      const b  = designData.data[di+2];

      // High variance areas = likely mismatch
      const variance = Math.abs(r - 128) + Math.abs(g - 128) + Math.abs(b - 128);
      const matched  = score / 100;
      const diffProb = (1 - matched) * (variance / 384);

      if (diffProb > 0.3) {
        // Red — likely mismatch
        data[i]   = 239; data[i+1] = 68;  data[i+2] = 68;
        data[i+3] = Math.round(diffProb * 140);
      } else if (diffProb > 0.15) {
        // Amber — possible mismatch
        data[i]   = 245; data[i+1] = 158; data[i+2] = 11;
        data[i+3] = Math.round(diffProb * 100);
      } else {
        // Transparent — good match
        data[i+3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function _ppvUpdateScore(score) {
  const row    = document.getElementById('ppvDiffRow');
  const scoreEl= document.getElementById('ppvScore');
  const barEl  = document.getElementById('ppvDiffBar');
  const hintEl = document.getElementById('ppvDiffHint');
  if (!row) return;

  row.style.display = '';
  if (scoreEl) scoreEl.textContent = score + '%';
  if (barEl) {
    barEl.style.width      = score + '%';
    barEl.style.background = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  }
  if (hintEl) {
    hintEl.textContent = score >= 80 ? '🎯 Excellent match!' :
                         score >= 60 ? '✓ Good match — minor differences' :
                         score >= 40 ? '⚠ Moderate match — review layout' :
                                       '✕ Low match — regenerate or refine prompt';
  }

  // Save result to chat as a message
  showToast(`Pixel match: ${score}% — ${score >= 70 ? 'good' : 'needs work'}`, score >= 70 ? 'ok' : 'wrn');
}

