// ════════════════════════════════════════════
//  PROMPT AGENT — ChatGPT style
//  1. User types rough prompt in agent mode
//  2. AI rewrites it → shown in editable textarea
//  3. "Suggestions" btn reveals clickable chips
//     that append text to the refined textarea
//  4. "Use this prompt" copies to chat input
//     (does NOT send — user reviews first)
// ════════════════════════════════════════════
const PA = {
  loading: false,
  originalPrompt: '',
  suggestions: [],
  round: 0,
  suggOpen: false,
  paThink: true,
  paStructured: true,
  attachments: [],
};

const PA_CATS = {
  refine:  { icon:'🎯', label:'Refine',    tag:'pat-refine'   },
  correct: { icon:'🔧', label:'Fix',       tag:'pat-correct'  },
  suggest: { icon:'💡', label:'Suggest',   tag:'pat-suggest'  },
  expand:  { icon:'🚀', label:'Expand',    tag:'pat-expand'   },
  new:     { icon:'✨', label:'New idea',  tag:'pat-new'      },
};

async function sendToPA() {
  const uIn = document.getElementById('uIn');
  const txt = uIn.value.trim();
  if (!txt || PA.loading) return;
  PA.originalPrompt = txt;
  PA.attachments    = S.attached.slice(); // snapshot current attachments
  PA.suggestions = [];
  PA.round = 1;
  PA.suggOpen = false;
  openPAPanel();
  await runPAAnalysis(txt, false);
}

function openPAPanel() {
  const panel = document.getElementById('paPanel');
  panel.style.display = 'block';
  // Show thinking, hide refined area + suggestions
  document.getElementById('paBody').style.display   = 'block';
  const rw = document.getElementById('paRefinedWrap');
  const sp = document.getElementById('paSuggPanel');
  if (rw) rw.style.display = 'none';
  if (sp) sp.style.display = 'none';
  showPAThinking('Refining your prompt…');
  setRoundBadge(1);
}

function closePA() {
  document.getElementById('paPanel').style.display = 'none';
  PA.loading = false;
  PA.suggOpen = false;
  // Update suggestions toggle btn state
  const t = document.getElementById('paSuggToggle');
  if (t) t.classList.remove('open');
}

function showPAThinking(msg) {
  const body = document.getElementById('paBody');
  body.style.display = 'block';
  body.innerHTML = `<div class="pa-thinking"><div class="pa-spin"></div><span>${msg}</span></div>`;
}

function setRoundBadge(n) {
  const b = document.getElementById('paRoundBadge');
  if (b) b.textContent = n > 1 ? `Round ${n}` : '';
}

async function runPAAnalysis(prompt, isMore) {
  PA.loading = true;
  const sndBtn  = document.getElementById('sndBtn');
  const moreBtn = document.getElementById('paMoreBtn');
  setSndBtn(true);
  if (moreBtn) moreBtn.disabled = true;

  // Describe any attachments for context
  const attachments = PA.attachments || [];
  const images  = attachments.filter(f => f.isImage);
  const files   = attachments.filter(f => !f.isImage && f.content);
  let attachCtx = '';
  if (images.length) attachCtx += `\nAttached images: ${images.map(i=>i.name).join(', ')} — analyze all visual patterns, layout, colors, typography, spacing, components deeply.`;
  if (files.length)  attachCtx += `\nAttached files:\n${files.map(f=>`--- ${f.name} ---\n${f.content}`).join('\n\n')}`;

  const deepAnalysis = PA.paThink
    ? `\nApply DEEP analysis: consider edge cases, accessibility, performance, security, and completeness. Make the refined prompt extremely detailed and production-ready.`
    : '';
  const structured = PA.paStructured
    ? `\nFor "refined": structure the output clearly with sections like Context, Requirements, Constraints, Expected Output.`
    : '';

  const sys = `You are an expert prompt engineer.${attachCtx ? ' The user has attached files/images — incorporate analysis of their content into the refined prompt.' : ''}${deepAnalysis}${structured}

Your job:
1. Rewrite the user's rough prompt as a clear, complete, well-structured prompt (the "refined" version)${images.length ? ' — reference the visual design/content from the attached images accurately' : ''}
2. Generate improvement suggestions grouped by type

Return ONLY valid JSON — no markdown, no explanation:
{
  "refined": "the complete rewritten prompt here",
  "suggestions": {
    "refine": ["alternative phrasing 1", "alternative phrasing 2"],
    "correct": ["fix 1", "fix 2"],
    "suggest": ["useful addition 1", "addition 2", "addition 3"],
    "expand": ["scope broadening idea 1", "idea 2"],
    "new": ["creative angle 1", "creative angle 2"]
  }
}

Rules for "refined": Write a single, complete, production-ready prompt. Be specific. Include context, constraints, expected output format if relevant. Min 1 sentence, max 6.
Rules for "suggestions": Short, concrete, standalone phrases/sentences (under 100 chars each).
${isMore ? 'These MUST be completely new suggestions — do not repeat anything from previous rounds.' : ''}`;

  // Build user message — include images for vision if present
  let userMsg;
  if (images.length && !isMore) {
    userMsg = [
      { type:'text', text:`Analyze the attached image(s) deeply and refine this prompt: "${prompt}"` },
      ...images.map(img => ({ type:'image_url', image_url:{ url:`data:${img.mimeType};base64,${img.imageData}` } }))
    ];
  } else {
    userMsg = isMore
      ? `Original prompt: "${prompt}"\n\nCurrent refined: "${document.getElementById('paRefinedTa')?.value || prompt}"\n\nGenerate MORE fresh improvement suggestions.`
      : `Refine this prompt and generate suggestions: "${prompt}"${attachCtx}`;
  }

  try {
    const paTaskKey = images.length ? 'vision' : 'prompt';
    const res = await smartCallForTask(paTaskKey, [{ role:'user', content:userMsg }], sys, 1600);
    const raw = res.text.replace(/```json|```/g,'').trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
    if (!parsed) throw new Error('Could not parse response — try again');

    // Show refined prompt in editable textarea
    const ta = document.getElementById('paRefinedTa');
    if (ta && parsed.refined) {
      ta.value = parsed.refined;
      autoR(ta);
    }

    // Store suggestions
    PA.suggestions = [];
    if (parsed.suggestions) {
      for (const [catKey, items] of Object.entries(parsed.suggestions)) {
        if (!PA_CATS[catKey] || !Array.isArray(items)) continue;
        items.forEach(text => {
          if (text?.trim()) PA.suggestions.push({
            id: 'ps_'+Math.random().toString(36).slice(2),
            cat: catKey, text: text.trim(), added: false
          });
        });
      }
    }

    // Hide thinking, show refined area
    document.getElementById('paBody').style.display = 'none';
    document.getElementById('paRefinedWrap').style.display = 'block';

    // If suggestions panel was open, re-render it
    if (PA.suggOpen) renderSuggChips();

  } catch(err) {
    showPAThinking(`⚠ ${err.message}`);
    document.getElementById('paBody').style.display = 'block';
    document.getElementById('paRefinedWrap').style.display = 'none';
  } finally {
    PA.loading = false;
    setSndBtn(false);
    if (moreBtn) moreBtn.disabled = false;
  }
}

function toggleSuggestions() {
  PA.suggOpen = !PA.suggOpen;
  const panel = document.getElementById('paSuggPanel');
  const btn   = document.getElementById('paSuggToggle');
  if (PA.suggOpen) {
    renderSuggChips();
    panel.style.display = 'block';
    btn.classList.add('open');
  } else {
    panel.style.display = 'none';
    btn.classList.remove('open');
  }
}

function renderSuggChips() {
  const container = document.getElementById('paSuggChips');
  if (!container) return;
  if (!PA.suggestions.length) {
    container.innerHTML = '<span style="font-size:.73rem;color:var(--t4)">No suggestions yet — click Regenerate</span>';
    return;
  }
  const catOrder = ['refine','correct','suggest','expand','new'];
  let html = '';
  for (const catKey of catOrder) {
    const items = PA.suggestions.filter(s => s.cat === catKey);
    if (!items.length) continue;
    const cat = PA_CATS[catKey];
    items.forEach(s => {
      html += `<button class="pa-chip ${s.added?'added':''}" id="chip-${s.id}" onclick="addSuggToPrompt('${s.id}')">
        <span class="pa-chip-icon">${s.added ? '✓' : cat.icon}</span>
        <span>${esc(s.text)}</span>
        <span class="pa-chip-cat ${cat.tag}">${cat.label}</span>
      </button>`;
    });
  }
  container.innerHTML = html;
}

function addSuggToPrompt(id) {
  const s = PA.suggestions.find(x => x.id === id);
  if (!s || s.added) return;
  s.added = true;
  const ta = document.getElementById('paRefinedTa');
  if (ta) {
    const cur = ta.value.trimEnd();
    const sep = cur.endsWith('.') || cur.endsWith('?') || cur.endsWith('!') ? ' ' : '. ';
    ta.value = cur + sep + s.text;
    autoR(ta);
    ta.focus();
    ta.scrollTop = ta.scrollHeight;
  }
  // Update chip visual
  const chip = document.getElementById('chip-'+id);
  if (chip) {
    chip.classList.add('added');
    chip.querySelector('.pa-chip-icon').textContent = '✓';
  }
}

async function paLoadMore() {
  PA.round++;
  setRoundBadge(PA.round);
  // Close suggestions panel while regenerating
  document.getElementById('paSuggPanel').style.display = 'none';
  document.getElementById('paSuggToggle')?.classList.remove('open');
  PA.suggOpen = false;
  showPAThinking('Generating more suggestions…');
  document.getElementById('paBody').style.display   = 'block';
  document.getElementById('paRefinedWrap').style.display = 'none';
  await runPAAnalysis(PA.originalPrompt, true);
}

// ↩ Copy refined prompt to the chat input field — does NOT send
function paUsePrompt() {
  const ta = document.getElementById('paRefinedTa');
  const refined = ta?.value?.trim();
  if (!refined) { showToast('Nothing to use — refine first', 'wrn'); return; }
  const uIn = document.getElementById('uIn');
  uIn.value = refined;
  autoR(uIn); updCC();
  closePA();
  setInputMode('chat');   // switch to chat mode so they see the prompt
  uIn.focus();
  uIn.setSelectionRange(uIn.value.length, uIn.value.length); // cursor at end
  showToast('✨ Prompt ready in chat — press Enter to send', 'ok');
}

// Legacy aliases (used by old buttons in HTML if any remain)
function paDone()      { paUsePrompt(); }
function paSendToChat(){ paUsePrompt(); }
function buildRefinedPrompt() { return document.getElementById('paRefinedTa')?.value?.trim() || null; }

// ════════════════════════════════════════════
