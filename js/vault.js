//  VAULT UI
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  MULTI-AGENT PIPELINE SYSTEM
// ════════════════════════════════════════════

const AGENT_DEFS = {

  planner: {
    id:'planner', name:'Planner', icon:'📋', color:'#818cf8',
    bg:'rgba(129,140,248,.15)',
    role:'Senior Product Architect',
    task:'thinking',
    systemPrompt:
      'You are a Senior Product Architect. Your ONLY job is PLANNING — NO CODE whatsoever.\n\n' +
      '⛔ STRICT RULE: Do NOT write any code, HTML, CSS, JavaScript, or markup. Not even a snippet.\n\n' +
      'Produce a structured plan with these exact sections:\n\n' +
      '## 📋 REQUIREMENTS\n' +
      'List every functional and non-functional requirement clearly.\n\n' +
      '## 🏗 ARCHITECTURE\n' +
      'Describe the component structure, data flow, and how pieces connect. Text only — no code.\n\n' +
      '## 📁 FILE STRUCTURE\n' +
      'List every file that needs to be created with a one-line description of its purpose.\n\n' +
      '## 🎨 DESIGN GUIDELINES\n' +
      'Specify: primary/secondary/accent colors (hex), font choices, spacing scale, UI style ' +
      '(glassmorphism/minimal/bold/etc), border-radius, shadows, animation style.\n\n' +
      '## ⚙️ FEATURES\n' +
      'Numbered list of every feature to implement, in priority order.\n\n' +
      'Be extremely detailed. The designer and developer will rely entirely on this plan.',
  },

  designer: {
    id:'designer', name:'UI Designer', icon:'🎨', color:'#f472b6',
    bg:'rgba(244,114,182,.15)',
    role:'Senior UI/UX Designer',
    task:'chat',
    systemPrompt:
      'You are a Senior UI/UX Designer. Your ONLY job is creating a detailed design specification — NO code output.\n\n' +
      '⛔ STRICT RULE: Do NOT write HTML, CSS, JavaScript, or any markup/code. Pure design spec only.\n\n' +
      'Produce a complete design specification with these sections:\n\n' +
      '## 🎨 COLOR SYSTEM\n' +
      'Primary, secondary, accent, background, surface, text colors — exact hex values for each.\n\n' +
      '## ✏️ TYPOGRAPHY\n' +
      'Font family (heading + body), sizes (px), weights, line-heights for each text level.\n\n' +
      '## 📐 SPACING & LAYOUT\n' +
      'Base spacing unit, grid system, breakpoints (mobile/tablet/desktop), max-width, padding/margin scale.\n\n' +
      '## 🧩 COMPONENTS\n' +
      'For each UI component (buttons, cards, inputs, nav, etc.) describe:\n' +
      '- Background, border, border-radius, box-shadow\n' +
      '- Padding, font-size, font-weight\n' +
      '- Hover/focus/active states\n' +
      '- Any animations or transitions (duration, easing)\n\n' +
      '## 🖼️ PAGE LAYOUT\n' +
      'Describe the layout of every screen/section in plain English — what goes where, hierarchy, visual flow.\n\n' +
      '## ✨ DESIGN STYLE\n' +
      'Overall aesthetic: glassmorphism/minimal/bold/etc. Key visual motifs, icon style, imagery guidelines.\n\n' +
      'Be extremely specific with values. The developer will implement exactly what you specify.',
  },

  developer: {
    id:'developer', name:'Developer', icon:'💻', color:'#34d399',
    bg:'rgba(52,211,153,.15)',
    role:'Senior Full-Stack Developer',
    task:'coding',
    systemPrompt:
      'You are a Senior Full-Stack Developer. You receive a plan and a design prototype and write ALL production code.\n\n' +
      '⛔ STRICT RULE: Write ONLY code files — no planning, no architecture discussion, no commentary outside code.\n\n' +
      'IMPLEMENTATION RULES:\n' +
      '• Use EXACTLY the framework specified — do NOT switch frameworks\n' +
      '• For Single HTML: ONE file (index.html) with all CSS in <style> and JS in <script> — nothing external\n' +
      '• For HTML+CSS+JS: separate index.html, style.css, script.js — properly linked\n' +
      '• Copy the EXACT colors, fonts, and styles from the designer prototype\n' +
      '• Every file 100% complete — zero placeholders, zero TODOs, zero "..."\n' +
      '• All features from the plan implemented — none skipped\n' +
      '• Error handling everywhere, mobile-responsive\n' +
      '• Format every file as: ```language:filename.ext\n\n' +
      'Output all files immediately. Start with the main file.',
  },

  tester: {
    id:'tester', name:'Tester', icon:'🧪', color:'#f59e0b',
    bg:'rgba(245,158,11,.15)',
    role:'QA Engineer',
    task:'thinking',
    systemPrompt:
      'You are a QA Engineer. You review code against the plan and prototype. No code output.\n\n' +
      '⛔ STRICT RULE: Do NOT write or fix code. Only review and report.\n\n' +
      'Check each of these and score pass/fail:\n' +
      '1. COMPLETENESS — are all planned features present?\n' +
      '2. DESIGN MATCH — do colors, fonts, layout match the prototype exactly?\n' +
      '3. CODE QUALITY — clean structure, no obvious bugs, proper error handling\n' +
      '4. RESPONSIVENESS — works on mobile, tablet, desktop\n' +
      '5. UX QUALITY — interactions feel smooth, loading states, feedback\n\n' +
      'Format your response as:\n' +
      '### Review\n' +
      '[your assessment of each point above]\n\n' +
      '### Issues\n' +
      '[bullet list of specific issues found, or "None" if none]\n\n' +
      'VERDICT: PASS\n' +
      '(or VERDICT: FAIL)',
  },

  devops: {
    id:'devops', name:'DevOps', icon:'🚀', color:'#60a5fa',
    bg:'rgba(96,165,250,.15)',
    role:'DevOps Engineer',
    task:'coding',
    systemPrompt:
      'You are a DevOps Engineer. You receive finished code and create deployment artifacts.\n\n' +
      '⛔ STRICT RULE: Create deployment files ONLY — do not rewrite or modify application code.\n\n' +
      'Create these files:\n' +
      '1. ```markdown:README.md``` — title, features list, tech stack, setup instructions, scripts\n' +
      '2. ```json:package.json``` — only if project uses npm; exact dependency versions\n' +
      '3. Deployment config — pick ONE appropriate for the framework:\n' +
      '   - Static HTML → ```json:vercel.json``` or ```toml:netlify.toml```\n' +
      '   - Node.js → ```dockerfile:Dockerfile```\n' +
      '   - React/Next.js → ```json:vercel.json```\n' +
      '4. ```text:.env.example``` — only if environment variables are needed\n\n' +
      'Output only the files. No commentary.',
  },
};

// Pipeline definitions — which agents run and in what order
const PIPELINES = {
  fullstack: ['planner','designer','developer','tester','devops'],
  frontend:  ['planner','designer','developer','tester'],
  api:       ['planner','developer','tester','devops'],
  design:    ['planner','designer'],
};

// ── Parallel stage definitions ────────────────────────────────
// Each pipeline maps to an ordered list of STAGES.
// A stage is an array of agent IDs — those inside can run concurrently.
// Sequential constraint: each stage waits for all prior stages to finish.
const PIPELINE_STAGES = {
  fullstack: [['planner','designer'], ['developer'], ['tester'], ['devops']],
  frontend:  [['planner','designer'], ['developer'], ['tester']],
  api:       [['planner'],            ['developer'], ['tester'], ['devops']],
  design:    [['planner','designer']],
};

// Agent state
const AG = {
  running:    false,
  pipeline:   null,
  task:       '',
  results:    {},
  activeTab:  null,
  maxRetries: 2,
  parallel:   false,  // parallel mode toggle
};

// ── Parallel toggle ───────────────────────────────────────────
function parallelToggle() {
  AG.parallel = !AG.parallel;
  const btn = document.getElementById('parallelToggleBtn');
  if (btn) btn.classList.toggle('on', AG.parallel);
  showToast(AG.parallel
    ? '⚡ Parallel mode ON — independent agents run simultaneously'
    : 'Parallel mode OFF — sequential execution',
  'inf');
}

// ── Pipeline timeline DOM helper ──────────────────────────────
function _pipelineTimelineRender(stages, stageStates) {
  // stageStates: array of 'pending'|'running'|'done'|'parallel'
  const box = document.getElementById('chatBox');
  const existing = document.getElementById('pipelineTimeline');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'pipeline-timeline';
  div.id = 'pipelineTimeline';

  stages.forEach((group, i) => {
    const state  = stageStates[i] || 'pending';
    const isParallel = group.length > 1;
    const label  = group.map(id => AGENT_DEFS[id]?.icon || '').join('') +
                   (isParallel ? ' ∥' : '');
    div.innerHTML += `<div class="pt-stage">
      <div class="pt-stage-bar">
        <div class="pt-stage-fill ${state} ${isParallel&&state==='running'?'parallel':''}"></div>
      </div>
      <div class="pt-stage-lbl ${state}">${label}</div>
    </div>`;
  });

  box.appendChild(div);
  scrollBot(true);
  return div;
}

function _pipelineTimelineUpdate(stageIdx, state) {
  const timeline = document.getElementById('pipelineTimeline');
  if (!timeline) return;
  const stages = timeline.querySelectorAll('.pt-stage');
  if (!stages[stageIdx]) return;
  const fill = stages[stageIdx].querySelector('.pt-stage-fill');
  const lbl  = stages[stageIdx].querySelector('.pt-stage-lbl');
  if (fill) fill.className = `pt-stage-fill ${state}`;
  if (lbl)  lbl.className  = `pt-stage-lbl ${state}`;
}

// ── Run a single agent (shared between sequential + parallel) ──
async function _runOneAgent(agentId, task, fw, fwLabel, outputs, iteration, feedback) {
  const def     = AGENT_DEFS[agentId];
  const prompt  = buildRolePrompt(agentId, task, fw, fwLabel, outputs, iteration, feedback);
  const ragCtx  = ragBM25RetrieveSync(task);
  const sys     = def.systemPrompt + (ragCtx ? `\n\n=== KNOWLEDGE BASE ===\n${ragCtx}\n=== END KB ===` : '');

  const thinkBubble = chatAgentThinking(def);
  const res = await smartCallForTask(def.task, [{role:'user',content:prompt}], sys, S.settings.maxTokens||4096);

  chatAgentBubble(def, res.text, iteration,
    iteration > 1 ? feedback : '',
    res.modelName || '', thinkBubble);

  S.msgs.push({ role:'assistant', content: `[${def.name}]: ${res.text}` });

  if (['developer','devops'].includes(agentId)) {
    const files = extractFilesFromResponse(res.text);
    if (Object.keys(files).length) addFilesToTree(files);
  }

  AG.results[agentId] = {
    status: 'done',
    output: res.text,
    iterations: iteration,
    feedback,
    confidence: scoreAgentOutput(agentId, res.text).score,
  };

  return res;
}

