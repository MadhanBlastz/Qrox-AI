// ════════════════════════════════════════════
//  DYNAMIC SYSTEM PROMPT BUILDER  v5
//
//  Replaces the flat buildSys() return with a
//  composable block pipeline. Each block is a
//  function that receives a context object and
//  returns a string (active) or null (inactive).
//
//  Blocks execute in order; the final system
//  prompt is their output joined with \n\n.
//
//  Context passed to each block:
//    ctx.fw        — current framework id
//    ctx.mode      — current mode (fullstack etc)
//    ctx.build     — build mode on?
//    ctx.intent    — detected intent key
//    ctx.hasImages — images attached?
//    ctx.hasFiles  — files attached?
//    ctx.msgCount  — messages in session
//    ctx.persona   — active persona
//    ctx.opts      — S.opts
//    ctx.history   — last 2 assistant messages (for context continuity)
//
//  DSP_BLOCKS is an ordered array of
//  { id, name, desc, fn(ctx) → string|null }
// ════════════════════════════════════════════

const DSP_BLOCKS = [

  // ── 1. Persona ──────────────────────────────
  {
    id: 'persona', name: 'Persona', desc: 'Active AI persona',
    fn(ctx) {
      if (!ctx.persona?.sys) return null;
      return ctx.persona.sys;
    }
  },

  // ── 2. Task-specific rules ───────────────────
  {
    id: 'task_rules', name: 'Task Rules', desc: 'Rules for detected task type',
    fn(ctx) {
      const blocks = {
        math:     'PRECISION RULES:\n- Show all working step by step\n- State assumptions explicitly\n- Verify answers by substitution where possible\n- Use exact values before decimal approximations',
        writing:  'WRITING RULES:\n- Match the requested tone and register\n- Avoid clichés and filler phrases\n- Vary sentence length for rhythm\n- Be concise — cut every word that doesn\'t earn its place',
        thinking: 'REASONING RULES:\n- Think through implications before concluding\n- Acknowledge genuine uncertainty\n- Consider the strongest counterargument\n- Distinguish facts from inferences',
        vision:   'VISION RULES:\n- Describe visual elements precisely (layout, colours, spacing)\n- Reference specific UI components by name\n- Note accessibility considerations\n- Suggest improvements where relevant',
        chat:     'CONVERSATION RULES:\n- Be direct and natural\n- Match the user\'s energy and tone\n- Ask at most one clarifying question\n- Don\'t pad short answers',
        coding:   null,  // handled by framework block
      };
      return blocks[ctx.intent] || null;
    }
  },

  // ── 3. Chain-of-thought injection ───────────
  {
    id: 'cot', name: 'Chain-of-Thought', desc: 'Auto-injected for complex tasks',
    fn(ctx) {
      // Inject CoT for math, thinking, and complex coding tasks
      const needsCoT = ['math','thinking'].includes(ctx.intent) ||
        (ctx.intent === 'coding' && ctx.msgCount > 1);
      if (!needsCoT) return null;
      return 'REASONING APPROACH: Think step by step before giving your final answer. Show your reasoning process.';
    }
  },

  // ── 4. Framework rules (build mode) ─────────
  {
    id: 'framework', name: 'Framework', desc: 'Build mode framework rules',
    fn(ctx) {
      if (!ctx.build) return null;
      // Return the framework rules string (already computed in old buildSys)
      return ctx.fwRules || null;
    }
  },

  // ── 5. Mode descriptor (build mode) ─────────
  {
    id: 'mode', name: 'Build Mode', desc: 'Current build mode descriptor',
    fn(ctx) {
      if (!ctx.build) return null;
      const modeDesc = {
        fullstack: 'FULL-STACK — complete frontend + backend',
        frontend:  'FRONTEND — beautiful responsive UI',
        backend:   'BACKEND — APIs, databases, server logic',
        debug:     'DEBUG — find ALL bugs and fix them',
        review:    'REVIEW — quality, security, performance',
        architect: 'ARCHITECT — system design + implementation',
      };
      return 'Mode: ' + (modeDesc[ctx.mode] || modeDesc.fullstack);
    }
  },

  // ── 6. Multimodal context ────────────────────
  {
    id: 'multimodal', name: 'Multimodal', desc: 'Image/file context instructions',
    fn(ctx) {
      if (!ctx.hasImages && !ctx.hasFiles) return null;
      const parts = [];
      if (ctx.hasImages) parts.push('Images are attached — analyse them carefully, reference specific visual details');
      if (ctx.hasFiles)  parts.push('Files are attached — use their content to inform your response');
      return 'ATTACHED CONTEXT:\n' + parts.join('\n');
    }
  },

  // ── 7. Conversation continuity ───────────────
  {
    id: 'continuity', name: 'Continuity', desc: 'Multi-turn session context',
    fn(ctx) {
      if (ctx.msgCount < 4) return null;
      return 'CONTINUITY: This is message ' + ctx.msgCount + ' in an ongoing session. Maintain consistency with previous decisions and avoid contradicting earlier advice.';
    }
  },

  // ── 8. Structured output ─────────────────────
  {
    id: 'structured', name: 'Structured Output', desc: 'When structured mode is on',
    fn(ctx) {
      if (!ctx.opts?.structured) return null;
      return 'Structure your response with these exact sections:\n---PLAN--- ---ARCHITECTURE--- ---FILES--- ---REVIEW---';
    }
  },

  // ── 9. Security hardening (debug/review mode)
  {
    id: 'security', name: 'Security', desc: 'Security checks in review/debug modes',
    fn(ctx) {
      if (!['debug','review'].includes(ctx.mode) && ctx.intent !== 'thinking') return null;
      if (!ctx.build) return null;
      return 'SECURITY: Check for: injection vulnerabilities, unvalidated inputs, exposed secrets, insecure dependencies, and missing authentication checks.';
    }
  },

  // ── 10. Universal rules ──────────────────────
  {
    id: 'universal', name: 'Universal Rules', desc: 'Always-on quality rules',
    fn(ctx) {
      if (!ctx.build) return 'Today: ' + new Date().toLocaleDateString();
      const T3 = '```';
      return [
        'UNIVERSAL RULES:',
        '1. For conversational questions, answer naturally — no need to generate code',
        '2. When generating code, ONLY use the SELECTED FRAMEWORK — NEVER switch',
        '3. Complete working code — zero placeholders, zero TODOs',
        '4. Format EVERY file as: ' + T3 + 'language:path/filename.ext',
        '5. Include error handling and edge cases',
        '6. Mobile-responsive by default',
        '7. Output ALL required files — do not skip any',
        'Date: ' + new Date().toLocaleDateString(),
      ].join('\n');
    }
  },
];

// ── Context builder ───────────────────────────────────────────
function _dspBuildContext(intentKey) {
  const fw   = S.framework || 'html-single';
  const T3   = '```';

  // Reuse the FW rules string from buildSys (lookup by fw)
  // We inline a minimal version here for the context object
  const fwLabel = {
    'html-single': 'FRAMEWORK: Single Self-Contained HTML File\n- ONE file: index.html with all CSS+JS inline',
    'html':        'FRAMEWORK: HTML + CSS + JS (separate files)',
    'react-cdn':   'FRAMEWORK: React (Babel CDN)',
    'react-npm':   'FRAMEWORK: React + Vite',
    'nextjs':      'FRAMEWORK: Next.js 14 (App Router)',
    'vue':         'FRAMEWORK: Vue 3 + Vite',
    'svelte':      'FRAMEWORK: Svelte + Vite',
    'fullstack':   'FRAMEWORK: React + Express (Fullstack)',
    'node':        'FRAMEWORK: Node.js + Express',
  };

  const activePersona = PERSONA?.all?.find(p => p.id === PERSONA?.activeId);

  return {
    fw,
    mode:      S.mode || 'fullstack',
    build:     !!S.opts?.build,
    intent:    intentKey || INTENT_STATE?.detected?.routeKey || INTENT_STATE?.detected?.key || 'chat',
    hasImages: S.attached?.some(f => f.isImage) || false,
    hasFiles:  S.attached?.some(f => !f.isImage) || false,
    msgCount:  S.msgs?.length || 0,
    persona:   activePersona || null,
    opts:      S.opts || {},
    fwRules:   fwLabel[fw] || fwLabel['html-single'],
  };
}

// ── The new buildSys using DSP blocks ─────────────────────────
function buildSys(intentKey) {
  const ctx = _dspBuildContext(intentKey);

  // Build OFF and default persona — use the dedicated chat-mode path
  if (!ctx.build) {
    const isDevPersona = !PERSONA?.activeId || PERSONA?.activeId === 'default';
    if (!isDevPersona && ctx.persona) {
      return ctx.persona.sys + '\n\nToday: ' + new Date().toLocaleDateString();
    }
    // Run non-build blocks only
    const nonBuildBlocks = DSP_BLOCKS.filter(b =>
      ['persona','task_rules','cot','multimodal','continuity','universal'].includes(b.id)
    );
    const parts = nonBuildBlocks
      .map(b => b.fn(ctx))
      .filter(Boolean);
    return parts.length ? parts.join('\n\n') : 'You are a helpful AI assistant.\nToday: ' + new Date().toLocaleDateString();
  }

  // Build ON — run all blocks
  const parts = DSP_BLOCKS
    .map(b => b.fn(ctx))
    .filter(Boolean);

  // Inject framework header
  if (!parts.some(p => p.includes('FRAMEWORK:'))) {
    const T3 = '```';
    parts.splice(1, 0, '⚡ SELECTED FRAMEWORK: ' + ctx.fw.toUpperCase());
  }

  return parts.join('\n\n');
}

// ── DSP active blocks inspector ───────────────────────────────
// Shows a floating tooltip of which blocks fired on last buildSys call
let _lastDspReport = [];

function dspInspect() {
  const ctx   = _dspBuildContext();
  const report = DSP_BLOCKS.map(b => {
    const result = b.fn(ctx);
    return { id: b.id, name: b.name, desc: b.desc, on: !!result };
  });
  _lastDspReport = report;

  const el   = document.getElementById('dspIndicator');
  const list = document.getElementById('dspBlockList');
  if (!el || !list) return;

  list.innerHTML = report.map(r =>
    `<div class="dsp-block">
      <div class="dsp-block-dot ${r.on?'on':'off'}"></div>
      <span class="dsp-block-name ${r.on?'':'off'}">${r.name}</span>
      <span class="dsp-block-reason">${r.on?'active':'—'}</span>
    </div>`
  ).join('');

  el.classList.add('show');
  setTimeout(() => el.classList.add('visible'), 10);
  setTimeout(() => { el.classList.remove('visible'); setTimeout(()=>el.classList.remove('show'),200); }, 4000);
}

