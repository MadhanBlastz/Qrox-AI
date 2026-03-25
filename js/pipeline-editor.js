//  AGENT PIPELINE EDITOR  v5
//
//  Visual drag-and-drop canvas to compose
//  custom agent pipelines:
//   • Drag agents from palette onto stages
//   • Each stage = one column (sequential)
//   • Multiple agents in a stage = parallel
//   • Toggle seq/par per stage
//   • Save named pipelines to localStorage
//   • Saved pipelines appear in agents bar
//   • Built-in presets shown read-only
// ════════════════════════════════════════════

const APE_LS = 'eai_pipelines_v1';

// ── State ─────────────────────────────────────────────────────
const APE = {
  stages:   [],   // [{id, agents:['planner','designer',...], parallel:bool}]
  dragging: null, // {agentId, fromStageIdx, fromPos}
  editingId:null, // null = new, or saved pipeline id
};

// ── Helpers ───────────────────────────────────────────────────
function _apeLoadSaved() {
  try { return JSON.parse(localStorage.getItem(APE_LS) || '[]'); }
  catch(e) { return []; }
}
function _apeSaveAll(list) { localStorage.setItem(APE_LS, JSON.stringify(list)); }
function _apeNextId() { return 'pipe_' + Date.now(); }

// ── Open / close ──────────────────────────────────────────────
function apeOpen(pipelineId) {
  document.getElementById('apeOverlay').classList.add('open');
  if (pipelineId) {
    const saved = _apeLoadSaved().find(p => p.id === pipelineId);
    if (saved) { APE.stages = JSON.parse(JSON.stringify(saved.stages)); APE.editingId = pipelineId; }
  } else {
    // Start with the current active pipeline as template
    const key = AG.pipeline || 'fullstack';
    const stagesDef = PIPELINE_STAGES[key] || PIPELINE_STAGES.fullstack;
    APE.stages = stagesDef.map((group, i) => ({
      id: 'stage_' + i,
      agents: [...group],
      parallel: group.length > 1,
    }));
    APE.editingId = null;
  }
  document.getElementById('apePipelineName').value = APE.editingId
    ? (_apeLoadSaved().find(p=>p.id===APE.editingId)?.name || '')
    : '';
  _apeRender();
}

function apeClose() {
  document.getElementById('apeOverlay').classList.remove('open');
}

// ── Render ────────────────────────────────────────────────────
function _apeRender() {
  _apeRenderPalette();
  _apeRenderCanvas();
  _apeRenderSaved();
}

function _apeRenderPalette() {
  const el = document.getElementById('apePalette');
  if (!el) return;
  el.innerHTML = Object.entries(AGENT_DEFS).map(([id, def]) =>
    `<div class="ape-agent-chip" draggable="true"
       ondragstart="apeDragStart(event,'${id}',null,null)"
       title="${esc(def.role)}">
      <span class="ape-agent-chip-icon">${def.icon}</span>
      <div>
        <div class="ape-agent-chip-name">${esc(def.name)}</div>
        <div class="ape-agent-chip-role">${esc(def.role.slice(0,20))}</div>
      </div>
    </div>`
  ).join('');
}

function _apeRenderCanvas() {
  const wrap = document.getElementById('apeStages');
  if (!wrap) return;

  const stageHtml = APE.stages.map((stage, si) => {
    const cards = stage.agents.map((agentId, ai) => {
      const def = AGENT_DEFS[agentId];
      if (!def) return '';
      return `<div class="ape-canvas-card"
        draggable="true"
        ondragstart="apeDragStart(event,'${agentId}',${si},${ai})"
        style="border-color:${def.color}44;box-shadow:0 0 8px ${def.color}11"
      >
        <button class="ape-canvas-card-rm" onclick="apeRemoveAgent(${si},${ai})" title="Remove">✕</button>
        <span class="ape-canvas-card-icon">${def.icon}</span>
        <span class="ape-canvas-card-name">${def.name}</span>
      </div>`;
    }).join('');

    const seqOn = !stage.parallel ? 'on seq' : '';
    const parOn =  stage.parallel ? 'on par' : '';

    return `<div class="ape-stage" id="ape-stage-${si}">
      <div class="ape-stage-lbl">Stage ${si+1}</div>
      <div class="ape-stage-type">
        <button class="ape-stage-type-btn seq ${seqOn}" onclick="apeSetStageType(${si},false)" title="Sequential">SEQ</button>
        <button class="ape-stage-type-btn par ${parOn}" onclick="apeSetStageType(${si},true)"  title="Parallel">PAR</button>
        <button class="ape-stage-type-btn" onclick="apeRemoveStage(${si})" style="color:var(--t4)" title="Remove stage">✕</button>
      </div>
      <div class="ape-stage-drop"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="apeDrop(event,${si})"
        id="ape-drop-${si}"
      >
        ${cards}
        ${stage.agents.length===0 ? '<span class="ape-stage-drop-hint">Drop agent here</span>' : ''}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = stageHtml + `
    <div class="ape-add-stage" onclick="apeAddStage()" title="Add stage">
      <span class="ape-add-stage-icon">＋</span>
      <span class="ape-add-stage-lbl">Stage</span>
    </div>`;
}

function _apeRenderSaved() {
  const el = document.getElementById('apeSavedList');
  if (!el) return;

  // Builtins
  const builtinHtml = Object.entries(PIPELINES).map(([key, agents]) => {
    const stages = PIPELINE_STAGES[key];
    const icons  = agents.map(id => AGENT_DEFS[id]?.icon || '').join('');
    return `<div class="ape-saved-item ${AG.pipeline===key?'active':''}" onclick="apeLoadBuiltin('${key}')">
      <div class="ape-saved-item-name">${key} <span class="ape-saved-builtin">built-in</span></div>
      <div class="ape-saved-item-desc">${icons} · ${stages?.length||0} stages</div>
    </div>`;
  }).join('');

  // User saved
  const userSaved = _apeLoadSaved();
  const userHtml  = userSaved.map(p => {
    const icons = p.stages.flatMap(s=>s.agents).map(id=>AGENT_DEFS[id]?.icon||'').join('');
    return `<div class="ape-saved-item ${AG.pipeline===p.id?'active':''}" onclick="apeLoadCustom('${p.id}')">
      <button class="ape-saved-item-rm" onclick="event.stopPropagation();apeDeleteSaved('${p.id}')" title="Delete">✕</button>
      <div class="ape-saved-item-name">${esc(p.name)}</div>
      <div class="ape-saved-item-desc">${icons} · ${p.stages.length} stages</div>
    </div>`;
  }).join('');

  el.innerHTML = builtinHtml + (userSaved.length ? '<div style="height:6px"></div>' + userHtml : '');
}

// ── Drag & drop ───────────────────────────────────────────────
function apeDragStart(e, agentId, fromStageIdx, fromPos) {
  APE.dragging = { agentId, fromStageIdx, fromPos };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', agentId);
}

function apeDrop(e, toStageIdx) {
  e.preventDefault();
  document.querySelectorAll('.ape-stage-drop').forEach(el => el.classList.remove('drag-over'));
  if (!APE.dragging) return;

  const { agentId, fromStageIdx, fromPos } = APE.dragging;
  APE.dragging = null;

  // Remove from source if dragging from canvas
  if (fromStageIdx !== null) {
    APE.stages[fromStageIdx].agents.splice(fromPos, 1);
    // Remove empty stages
    APE.stages = APE.stages.filter(s => s.agents.length > 0 || APE.stages.indexOf(s) === toStageIdx);
  }

  // Add to target stage
  if (toStageIdx < APE.stages.length) {
    APE.stages[toStageIdx].agents.push(agentId);
    // Auto-enable parallel if >1 agent
    if (APE.stages[toStageIdx].agents.length > 1) APE.stages[toStageIdx].parallel = true;
  }

  _apeRenderCanvas();
  _apeRenderSaved();
}

// ── Stage controls ────────────────────────────────────────────
function apeAddStage() {
  APE.stages.push({ id: 'stage_' + Date.now(), agents: [], parallel: false });
  _apeRenderCanvas();
}

function apeRemoveStage(si) {
  APE.stages.splice(si, 1);
  _apeRenderCanvas();
}

function apeRemoveAgent(si, ai) {
  APE.stages[si].agents.splice(ai, 1);
  if (APE.stages[si].agents.length === 0) APE.stages.splice(si, 1);
  _apeRenderCanvas();
}

function apeSetStageType(si, parallel) {
  APE.stages[si].parallel = parallel;
  _apeRenderCanvas();
}

function apeClear() {
  APE.stages = [];
  document.getElementById('apePipelineName').value = '';
  APE.editingId = null;
  _apeRenderCanvas();
}

// ── Preview order ─────────────────────────────────────────────
function apePreview() {
  if (!APE.stages.length) { showToast('Add at least one stage', 'wrn'); return; }
  const order = APE.stages.map((s, i) => {
    const icons = s.agents.map(id => AGENT_DEFS[id]?.icon || id).join(' + ');
    const type  = s.parallel && s.agents.length > 1 ? '⚡ parallel' : 'sequential';
    return `Stage ${i+1}: ${icons} (${type})`;
  }).join(' → ');
  showToast('Pipeline: ' + order, 'inf');
}

// ── Save & use ────────────────────────────────────────────────
function apeSave() {
  const name = document.getElementById('apePipelineName').value.trim() || 'Custom Pipeline';
  if (!APE.stages.length || APE.stages.every(s => !s.agents.length)) {
    showToast('Add at least one agent to the pipeline', 'wrn'); return;
  }

  const list = _apeLoadSaved();
  const id   = APE.editingId || _apeNextId();
  const pipeline = { id, name, stages: JSON.parse(JSON.stringify(APE.stages)) };

  const idx = list.findIndex(p => p.id === id);
  if (idx >= 0) list[idx] = pipeline; else list.push(pipeline);
  _apeSaveAll(list);

  // Register in PIPELINES + PIPELINE_STAGES so the engine can use it
  _apeRegister(pipeline);

  // Set as active pipeline
  AG.pipeline = id;
  showToast(`💾 Pipeline "${name}" saved & activated`, 'ok');
  apeClose();
  _apeRenderSaved();
}

function _apeRegister(pipeline) {
  // Register in PIPELINES (flat agent list)
  const flatAgents = pipeline.stages.flatMap(s => s.agents);
  PIPELINES[pipeline.id] = flatAgents;

  // Register in PIPELINE_STAGES (grouped)
  PIPELINE_STAGES[pipeline.id] = pipeline.stages.map(s => [...s.agents]);
}

// Load all saved pipelines at boot
function apeLoadAllSaved() {
  _apeLoadSaved().forEach(p => _apeRegister(p));
}

function apeLoadBuiltin(key) {
  const stagesDef = PIPELINE_STAGES[key] || PIPELINE_STAGES.fullstack;
  APE.stages = stagesDef.map((group, i) => ({
    id: 'stage_' + i,
    agents: [...group],
    parallel: group.length > 1,
  }));
  APE.editingId = null;
  document.getElementById('apePipelineName').value = key;
  _apeRenderCanvas();
  _apeRenderSaved();
}

function apeLoadCustom(id) {
  const saved = _apeLoadSaved().find(p => p.id === id);
  if (!saved) return;
  APE.stages = JSON.parse(JSON.stringify(saved.stages));
  APE.editingId = id;
  document.getElementById('apePipelineName').value = saved.name;
  _apeRenderCanvas();
  _apeRenderSaved();
}

function apeDeleteSaved(id) {
  if (!confirm('Delete this pipeline?')) return;
  const list = _apeLoadSaved().filter(p => p.id !== id);
  _apeSaveAll(list);
  delete PIPELINES[id];
  delete PIPELINE_STAGES[id];
  if (AG.pipeline === id) AG.pipeline = 'fullstack';
  _apeRenderSaved();
  showToast('Pipeline deleted', 'inf');
}

