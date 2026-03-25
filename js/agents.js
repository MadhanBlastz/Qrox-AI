// ════════════════════════════════════════════
//  AUTONOMOUS GOAL MODE  v5
//
//  User provides a goal. The system runs the
//  full agent pipeline, scores the tester
//  verdict, and automatically loops — refining
//  the developer output — until the goal is met
//  (VERDICT: PASS) or max cycles is reached.
//
//  Each cycle:
//    Planner → Designer → Developer → Tester
//  If Tester fails: Developer revises with
//  specific issue list, then Tester re-checks.
//  DevOps runs once at the very end on success.
// ════════════════════════════════════════════

const AUTO = {
  running:   false,
  goal:      '',
  cycle:     0,
  maxCycles: 3,
  cycles:    [],  // [{label, status:'pending'|'running'|'pass'|'fail'}]
};

function autoToggleBody() {
  const body = document.getElementById('autoBody');
  if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
}

function autoSetBadge(text, running=false) {
  const b = document.getElementById('autoBadge');
  if (!b) return;
  b.textContent = text;
  b.className   = 'auto-bar-badge' + (running ? ' running' : '');
}

function autoSetProgress(cycle, maxCycles, cycles) {
  const prog = document.getElementById('autoProgress');
  if (!prog) return;
  prog.classList.add('show');
  document.getElementById('autoCycleLabel').textContent = `Cycle ${cycle} / ${maxCycles}`;
  document.getElementById('autoProgBar').style.width = Math.round((cycle / maxCycles) * 100) + '%';
  // Render cycle list
  document.getElementById('autoCycleList').innerHTML = cycles.map(c => `
    <div class="auto-cycle-item">
      <div class="auto-cycle-dot ${c.status}"></div>
      <span>${esc(c.label)}</span>
    </div>`).join('');
}

function autoCycleBanner(text, type='') {
  const box = document.getElementById('chatBox');
  const d   = document.createElement('div');
  d.className = 'auto-cycle-banner' + (type ? ' ' + type : '');
  d.innerHTML = text;
  box.appendChild(d);
  scrollBot(true);
}

async function autoStart() {
  const goal = document.getElementById('autoGoalInput')?.value?.trim();
  if (!goal) { showToast('Enter a goal first', 'wrn'); return; }
  if (AUTO.running || AG.running || S.loading) return;

  AUTO.running   = true;
  AUTO.goal      = goal;
  AUTO.cycle     = 0;
  AUTO.maxCycles = parseInt(document.getElementById('autoMaxCycles')?.value || '3', 10);
  AUTO.cycles    = [];

  // UI setup
  document.getElementById('autoRunBtn').style.display  = 'none';
  document.getElementById('autoStopBtn').style.display = '';
  autoSetBadge('RUNNING…', true);

  AG.running = true;
  S.loading  = true;
  S.controller = new AbortController();
  setSndBtn(true);
  setBuildStatus('building', 'Autonomous mode…');
  _userScrolledUp = false;

  const fw      = S.framework || 'html-single';
  const fwLabel = fw === 'html-single' ? 'Single HTML (inline CSS+JS)'
                : fw === 'html'        ? 'HTML + CSS + JS (separate files)'
                : fw;

  // Show user goal bubble
  const userContent = `🎯 **Autonomous Goal Mode** · max ${AUTO.maxCycles} cycles · ${fwLabel}\n\n${goal}`;
  S.msgs.push({ role:'user', content: userContent });
  renderUser(userContent, [], true);

  // Pipeline agents for the loop (no devops yet — runs once at end)
  const loopAgents = ['planner','designer','developer','tester'];

  let finalDevOutput = '';
  let succeeded      = false;

  try {
    // ── PLANNING phase (runs once, not repeated) ────────────────
    AUTO.cycles.push({ label:'Planning…', status:'running' });
    autoSetProgress(0, AUTO.maxCycles, AUTO.cycles);

    chatAgentSep('📋  Planner · Planning phase');
    const plannerDef = AGENT_DEFS['planner'];
    const planThink  = chatAgentThinking(plannerDef);
    const planPrompt = buildRolePrompt('planner', goal, fw, fwLabel, {}, 1, '');
    const planRes    = await smartCallForTask(plannerDef.task, [{role:'user',content:planPrompt}], plannerDef.systemPrompt, S.settings.maxTokens||4096);
    chatAgentBubble(plannerDef, planRes.text, 1, '', planRes.modelName||'', planThink);
    S.msgs.push({role:'assistant', content:'[Planner]: '+planRes.text});
    AUTO.cycles[0].status = 'done';

    // ── DESIGN phase (runs once) ────────────────────────────────
    AUTO.cycles.push({ label:'Designing…', status:'running' });
    autoSetProgress(0, AUTO.maxCycles, AUTO.cycles);

    chatAgentSep('🎨  Designer · Design phase');
    const desDef    = AGENT_DEFS['designer'];
    const desThink  = chatAgentThinking(desDef);
    const desPrompt = buildRolePrompt('designer', goal, fw, fwLabel, { planner: planRes.text }, 1, '');
    const desRes    = await smartCallForTask(desDef.task, [{role:'user',content:desPrompt}], desDef.systemPrompt, S.settings.maxTokens||4096);
    chatAgentBubble(desDef, desRes.text, 1, '', desRes.modelName||'', desThink);
    S.msgs.push({role:'assistant', content:'[Designer]: '+desRes.text});
    AUTO.cycles[1].status = 'done';

    const baseContext = { planner: planRes.text, designer: desRes.text };
    let   devOutput   = '';
    let   devIteration = 0;

    // ── DEVELOP → TEST loop ─────────────────────────────────────
    while (AUTO.cycle < AUTO.maxCycles) {
      if (!AUTO.running || !AG.running) throw new DOMException('Aborted','AbortError');

      AUTO.cycle++;
      devIteration++;
      const cycleLabel = `Cycle ${AUTO.cycle}/${AUTO.maxCycles} — Dev + Test`;
      AUTO.cycles.push({ label: cycleLabel, status:'running' });
      autoSetProgress(AUTO.cycle, AUTO.maxCycles, AUTO.cycles);
      autoCycleBanner(`🔄 &nbsp;Cycle ${AUTO.cycle} of ${AUTO.maxCycles} — Developer ${devIteration > 1 ? '(revision ' + devIteration + ')' : ''}`);

      // ── Developer ──
      chatAgentSep('💻  Developer · Cycle ' + AUTO.cycle);
      const devDef    = AGENT_DEFS['developer'];
      const devThink  = chatAgentThinking(devDef);
      const prevIssues = devIteration > 1 ? (AUTO.cycles[AUTO.cycles.length-2]?.issues || '') : '';
      const devContext = { ...baseContext, developer: devOutput };
      const devPrompt  = buildRolePrompt('developer', goal, fw, fwLabel, devContext, devIteration, prevIssues);
      const devRes     = await smartCallForTask(devDef.task, [{role:'user',content:devPrompt}], devDef.systemPrompt, S.settings.maxTokens||4096);
      chatAgentBubble(devDef, devRes.text, devIteration, prevIssues, devRes.modelName||'', devThink);
      S.msgs.push({role:'assistant', content:'[Developer cycle '+AUTO.cycle+']: '+devRes.text});
      devOutput = devRes.text;

      // Extract files
      const files = extractFilesFromResponse(devOutput);
      if (Object.keys(files).length) addFilesToTree(files);

      // ── Tester ──
      chatAgentSep('🧪  Tester · Cycle ' + AUTO.cycle);
      const tstDef   = AGENT_DEFS['tester'];
      const tstThink = chatAgentThinking(tstDef);
      const tstCtx   = { ...baseContext, developer: devOutput };
      const tstPrompt= buildRolePrompt('tester', goal, fw, fwLabel, tstCtx, devIteration, '');
      const tstRes   = await smartCallForTask(tstDef.task, [{role:'user',content:tstPrompt}], tstDef.systemPrompt, S.settings.maxTokens||3000);
      chatAgentBubble(tstDef, tstRes.text, devIteration, '', tstRes.modelName||'', tstThink);
      S.msgs.push({role:'assistant', content:'[Tester cycle '+AUTO.cycle+']: '+tstRes.text});

      const verdict = evaluateTesterVerdict(tstRes.text);
      const cycleIdx = AUTO.cycles.length - 1;

      if (verdict.pass) {
        AUTO.cycles[cycleIdx].status = 'pass';
        autoSetProgress(AUTO.cycle, AUTO.maxCycles, AUTO.cycles);
        autoCycleBanner(`✅ &nbsp;Cycle ${AUTO.cycle} — <strong>PASS</strong> — Goal achieved!`, 'pass');
        finalDevOutput = devOutput;
        succeeded = true;
        break;
      } else {
        AUTO.cycles[cycleIdx].status  = 'fail';
        AUTO.cycles[cycleIdx].issues  = verdict.issues;
        autoSetProgress(AUTO.cycle, AUTO.maxCycles, AUTO.cycles);
        if (AUTO.cycle < AUTO.maxCycles) {
          autoCycleBanner(`🔁 &nbsp;Cycle ${AUTO.cycle} — FAIL — Revising (${AUTO.maxCycles - AUTO.cycle} attempt${AUTO.maxCycles - AUTO.cycle !== 1 ? 's' : ''} left)`, 'fail');
        }
        finalDevOutput = devOutput; // keep best attempt
      }
    }

    // ── DevOps — runs once at end ───────────────────────────────
    const dvDef    = AGENT_DEFS['devops'];
    chatAgentSep('🚀  DevOps · Deployment artifacts');
    const dvThink  = chatAgentThinking(dvDef);
    const dvPrompt = buildRolePrompt('devops', goal, fw, fwLabel, { developer: finalDevOutput }, 1, '');
    const dvRes    = await smartCallForTask(dvDef.task, [{role:'user',content:dvPrompt}], dvDef.systemPrompt, 2000);
    chatAgentBubble(dvDef, dvRes.text, 1, '', dvRes.modelName||'', dvThink);
    S.msgs.push({role:'assistant', content:'[DevOps]: '+dvRes.text});
    const dvFiles = extractFilesFromResponse(dvRes.text);
    if (Object.keys(dvFiles).length) addFilesToTree(dvFiles);

    // ── Final banner ────────────────────────────────────────────
    const allScores = ['planner','designer','developer','tester']
      .map(id => scoreAgentOutput(id, id==='developer' ? finalDevOutput : '').score);
    const avgConf = Math.round(allScores.filter(Boolean).reduce((a,b)=>a+b,0) / allScores.filter(Boolean).length);
    const confBadge = `<span class="conf-badge conf-${avgConf>=75?'high':avgConf>=45?'med':'low'}" style="font-size:.65rem">🎯 ${avgConf}% confidence</span>`;

    const isNonHtml = FW_SB.has(fw);
    const previewBtn = isNonHtml
      ? `<button class="agent-preview-btn sb" onclick="showStackBlitzBanner(S.fileTree,'${fw}')">↗ StackBlitz</button>`
      : `<button class="agent-preview-btn" onclick="runPreview()">▶ Preview</button>`;

    const finalMsg = succeeded
      ? `✅ &nbsp;Goal achieved in ${AUTO.cycle} cycle${AUTO.cycle!==1?'s':''}! &nbsp;${previewBtn} &nbsp;<button class="pra" onclick="agentsExport()">⬇ Export</button> &nbsp;${confBadge}`
      : `⚠ &nbsp;Max cycles reached — best result kept &nbsp;${previewBtn} &nbsp;<button class="pra" onclick="agentsExport()">⬇ Export</button> &nbsp;${confBadge}`;
    autoCycleBanner(finalMsg, 'done');

    autoSetBadge(succeeded ? `DONE · ${AUTO.cycle} cycles` : `MAX REACHED`, false);
    autoSetProgress(AUTO.maxCycles, AUTO.maxCycles, AUTO.cycles);
    saveCurrentSession();
    showToast(succeeded ? `✅ Goal achieved in ${AUTO.cycle} cycle${AUTO.cycle!==1?'s':''}!` : '⚠ Max cycles reached — best result kept', succeeded ? 'ok' : 'wrn');

    // Also update run buttons / preview dot
    if (finalDevOutput) updateRunButtons(finalDevOutput);

  } catch(e) {
    document.querySelectorAll('[id^="agent-thinking-"]').forEach(el => {
      if (el._timer) clearInterval(el._timer);
      el.remove();
    });
    if (e.name === 'AbortError') {
      autoCycleBanner('⛔ &nbsp;Autonomous run stopped', 'fail');
      autoSetBadge('STOPPED');
    } else {
      autoCycleBanner('⚠ &nbsp;Error: ' + esc(e.message), 'fail');
      autoSetBadge('ERROR');
      showToast('Auto error: ' + e.message, 'err');
    }
  } finally {
    AUTO.running = false;
    AG.running   = false;
    S.loading    = false;
    S.controller = null;
    setSndBtn(false);
    setBuildStatus('ready', 'Ready');
    document.getElementById('autoRunBtn').style.display  = '';
    document.getElementById('autoStopBtn').style.display = 'none';
  }
}

function autoStop() {
  if (S.controller) S.controller.abort();
  AUTO.running = false;
  autoSetBadge('STOPPING…');
  showToast('Stopping autonomous run…', 'inf');
}

function toggleAgentsMode() {
  S.opts = S.opts || {};
  // agentsHdrToggle was moved to ctrl panel — use S.opts as source of truth
  S.opts.agents = !S.opts.agents;
  const isOn = S.opts.agents;

  // Sync header toggle if it still exists
  const toggle = document.getElementById('agentsHdrToggle');
  if (toggle) toggle.classList.toggle('on', isOn);

  // Show/hide Autonomous Goal Mode bar
  const autoBar = document.getElementById('autoBar');
  if (autoBar) autoBar.classList.toggle('show', isOn);

  // Auto-enable Build mode when agents turned on
  if (isOn && !S.opts.build) {
    const cb = document.getElementById('btn-build');
    if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
  }
  // Update input placeholder
  const inp = document.getElementById('uIn');
  if (inp) inp.placeholder = isOn
    ? 'Describe what to build — or use Autonomous Goal Mode above…'
    : (S.opts.build ? 'Describe what to build…' : 'Message the AI…');
  showToast(isOn ? '🤖 Multi-Agent mode ON' : '🤖 Multi-Agent mode OFF', 'inf');
}

function selectPipeline(btn) {
  document.querySelectorAll('.ap-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  AG.pipeline = btn.dataset.pipeline;
}

// Stub — no modal flow anymore
function openAgents()  {}
function closeAgents() {}
function renderAgentFlow() {}
function setAgentStatus(id, status, label) {}

// ── Agent thinking bubble (pulsing dots + live status) ────────
function chatAgentThinking(def) {
  const box = document.getElementById('chatBox');
  const ws  = document.getElementById('ws'); if (ws) ws.remove();
  const div = document.createElement('div');
  div.className = 'msg agent-bubble';
  div.id = 'agent-thinking-' + def.id;
  div.innerHTML = `
    <div class="agent-av" style="background:${def.bg};border-color:${def.color}33">${def.icon}</div>
    <div class="agent-bubble-body">
      <div class="agent-bubble-name" style="color:${def.color}">
        ${def.name} <span class="agent-bubble-role" id="agent-status-${def.id}">thinking…</span>
      </div>
      <div class="bbl agent-bubble-bbl" id="agent-bbl-${def.id}"
           style="border-color:${def.color}33;background:${def.bg}11;max-width:100%;min-height:44px">
        <div class="tybbl"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>
      </div>
    </div>`;
  box.appendChild(div);
  scrollBot(true);
  // Cycle status text
  const statuses = ['thinking…','analyzing…','writing…','generating…'];
  let si = 0;
  const statusEl = div.querySelector('#agent-status-' + def.id);
  const timer = setInterval(() => {
    si = (si + 1) % statuses.length;
    if (statusEl && statusEl.isConnected) statusEl.textContent = statuses[si];
    else clearInterval(timer);
  }, 1800);
  div._timer = timer;
  return div;
}

// ── Morph thinking bubble into final content (no flash, smooth reveal) ────
function chatAgentBubble(def, text, iteration, feedback, modelName) {
  // Fix unclosed code fences before parsing
  let safeText = text;
  const fenceCount = (safeText.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) safeText = safeText.trimEnd() + '\n```';
  const parsed = parseMsg(safeText);

  // Compute confidence score for this agent's output
  const confBadge = buildConfBadge(def.id, text);

  // Find the thinking div and morph it
  const target = document.getElementById('agent-thinking-' + def.id);
  if (target) {
    if (target._timer) clearInterval(target._timer);
    const bblEl  = target.querySelector('#agent-bbl-' + def.id);
    const nameEl = target.querySelector('.agent-bubble-name');
    // Update header
    if (nameEl) {
      const iterTag  = iteration > 1 ? ' <span class="agent-bubble-iter">\u21bb Revision ' + iteration + '</span>' : '';
      const modelTag = modelName     ? ' <span class="agent-bubble-role">\xb7 ' + esc(modelName) + '</span>'       : '';
      nameEl.innerHTML = def.name + iterTag + modelTag;
    }
    // Add feedback banner
    if (feedback && iteration > 1) {
      const fb = document.createElement('div');
      fb.className = 'agent-bubble-feedback';
      fb.textContent = feedback.slice(0, 180);
      bblEl.parentNode.insertBefore(fb, bblEl);
    }
    // Fade dots out, fade content in
    if (bblEl) {
      bblEl.style.transition = 'opacity .2s';
      bblEl.style.opacity    = '0';
      setTimeout(() => {
        bblEl.innerHTML    = parsed;
        bblEl.style.opacity = '1';
        const meta = document.createElement('div');
        meta.className   = 'mmeta';
        meta.style.marginTop = '4px';
        meta.innerHTML = '<span>' + gT() + '</span>'
          + '<span class="umtag" style="background:' + def.bg + ';border:1px solid ' + def.color + '44;color:' + def.color + '">'
          + def.icon + ' ' + def.name + '</span>'
          + confBadge;
        bblEl.parentNode.appendChild(meta);
        hlCode(target);
        scrollBot(true);
      }, 150);
    }
    return target;
  }

  // Fallback — fresh bubble
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'msg agent-bubble';
  const iterLabel = iteration > 1 ? '<span class="agent-bubble-iter">\u21bb Revision ' + iteration + '</span>' : '';
  const fbHtml    = feedback      ? '<div class="agent-bubble-feedback">' + esc(feedback.slice(0,180)) + '</div>' : '';
  const modelTag  = modelName     ? '<span class="agent-bubble-role">\xb7 ' + esc(modelName) + '</span>'         : '';
  div.innerHTML = `
    <div class="agent-av" style="background:${def.bg};border-color:${def.color}33">${def.icon}</div>
    <div class="agent-bubble-body">
      <div class="agent-bubble-name" style="color:${def.color}">${def.name} ${iterLabel} ${modelTag}</div>
      ${fbHtml}
      <div class="bbl agent-bubble-bbl" style="border-color:${def.color}33;background:${def.bg}11;max-width:100%">${parsed}</div>
      <div class="mmeta" style="margin-top:4px">
        <span>${gT()}</span>
        <span class="umtag" style="background:${def.bg};border:1px solid ${def.color}44;color:${def.color}">${def.icon} ${def.name}</span>
        ${confBadge}
      </div>
    </div>`;
  box.appendChild(div);
  hlCode(div);
  scrollBot(true);
  return div;
}

function chatAgentSep(text) {
  const box = document.getElementById('chatBox');
  const d   = document.createElement('div');
  d.className   = 'agent-pipeline-sep';
  d.textContent = text;
  box.appendChild(d);
  scrollBot(true);
}

// ── Banner (start / end / fail) in chat ──────────────────────
function chatAgentBanner(text, type) {
  const box = document.getElementById('chatBox');
  const d   = document.createElement('div');
  d.className = 'agent-pipeline-banner ' + type;
  d.innerHTML = text;
  box.appendChild(d);
  scrollBot(true);
}
async function runAgentPipeline(taskOverride) {
  const task = taskOverride || '';
  if (!task) { showToast('Enter a task first', 'wrn'); return; }
  if (AG.running || S.loading) return;

  AG.running = true;
  AG.task    = task;
  AG.results = {};
  S.loading  = true;
  S.controller = new AbortController();

  setSndBtn(true);
  setBuildStatus('building', 'Agents running…');
  _userScrolledUp = false;

  const fw      = S.framework || 'html-single';
  const fwLabel = fw === 'html-single' ? 'Single HTML (inline CSS+JS)'
                : fw === 'html'        ? 'HTML + CSS + JS (separate files)'
                : fw;

  const fwPipeline  = FW_SB.has(fw) ? 'api' : 'fullstack';
  const pipelineKey = AG.pipeline || fwPipeline;
  const agents      = PIPELINES[pipelineKey]  || PIPELINES.fullstack;
  const stages      = PIPELINE_STAGES[pipelineKey] || PIPELINE_STAGES.fullstack;

  // How many stages actually have >1 agent (parallel potential)
  const parallelStages = stages.filter(s => s.length > 1).length;
  const modeLabel = AG.parallel && parallelStages > 0
    ? `⚡ Parallel · ${parallelStages} stage${parallelStages!==1?'s':''} concurrent`
    : 'Sequential';

  const userMsgContent = `🤖 **Multi-Agent Pipeline** · ${pipelineKey} · ${fwLabel} · ${modeLabel}\n\n${task}`;
  S.msgs.push({ role:'user', content: userMsgContent });
  renderUser(userMsgContent, [], true);

  const pipelineEmojis = agents.map(id => AGENT_DEFS[id].icon).join(' → ');
  chatAgentBanner(`🤖 &nbsp;${pipelineEmojis} &nbsp;<span style="font-size:.62rem;opacity:.7">${modeLabel}</span>`, 'start');

  // Render timeline
  const stageStates = stages.map(() => 'pending');
  _pipelineTimelineRender(stages, stageStates);

  const outputs = {};
  const tStart  = Date.now();

  try {
    for (let si = 0; si < stages.length; si++) {
      const group = stages[si];
      if (!AG.running) throw new DOMException('Aborted','AbortError');

      // Update timeline
      stageStates[si] = 'running';
      _pipelineTimelineUpdate(si, 'running');

      const isParallelStage = AG.parallel && group.length > 1;

      if (isParallelStage) {
        // ── PARALLEL STAGE ────────────────────────────────────
        const parallelCount = group.length;
        chatAgentBanner(
          `⚡ &nbsp;Stage ${si+1}: <strong>${group.map(id=>AGENT_DEFS[id].icon+' '+AGENT_DEFS[id].name).join(' + ')}</strong> running in parallel`,
          'start'
        );

        // Fire all agents simultaneously
        const promises = group.map(agentId => {
          AG.results[agentId] = { status:'running', output:'', iterations:1, feedback:'' };
          return _runOneAgent(agentId, task, fw, fwLabel, outputs, 1, '')
            .then(res => ({ agentId, res }))
            .catch(err => {
              if (err.name === 'AbortError') throw err;
              // Individual failure — don't kill whole pipeline
              chatAgentBanner(`⚠ ${AGENT_DEFS[agentId]?.name} failed: ${esc(err.message)}`, 'fail');
              return { agentId, res: { text: '' } };
            });
        });

        const tParallelStart = Date.now();
        const results = await Promise.all(promises);
        const elapsed = ((Date.now() - tParallelStart) / 1000).toFixed(1);

        results.forEach(({ agentId, res }) => {
          outputs[agentId] = res.text;
        });

        chatAgentBanner(
          `✅ &nbsp;Stage ${si+1} complete in <strong>${elapsed}s</strong> ` +
          `<span class="parallel-speed-badge">⚡ ${parallelCount}× parallel</span>`,
          'end'
        );

      } else {
        // ── SEQUENTIAL STAGE ──────────────────────────────────
        const agentId = group[0];
        const def     = AGENT_DEFS[agentId];
        AG.results[agentId] = { status:'running', output:'', iterations:1, feedback:'' };

        chatAgentSep(def.icon + '  ' + def.name + ' · ' + def.role);

        let agentOutput = '';
        let passed      = false;
        let iteration   = 0;

        while (!passed && iteration <= AG.maxRetries) {
          if (!AG.running) throw new DOMException('Aborted','AbortError');
          iteration++;
          if (iteration > 1) AG.results[agentId].iterations = iteration;

          const res = await _runOneAgent(
            agentId, task, fw, fwLabel, outputs,
            iteration, AG.results[agentId].feedback
          );
          agentOutput = res.text;

          // Tester verdict + developer retry
          if (agentId === 'tester') {
            const verdict = evaluateTesterVerdict(agentOutput);
            if (!verdict.pass && iteration <= AG.maxRetries && outputs['developer']) {
              chatAgentSep('↩  Test failed — Developer revising');
              const devDef = AGENT_DEFS['developer'];
              AG.results['developer'].feedback   = verdict.issues;
              AG.results['developer'].iterations = (AG.results['developer'].iterations||1) + 1;

              const devRes = await _runOneAgent(
                'developer', task, fw, fwLabel, outputs,
                AG.results['developer'].iterations, verdict.issues
              );
              outputs['developer'] = devRes.text;
            }
            passed = verdict.pass || iteration > AG.maxRetries;
            if (!verdict.pass && iteration > AG.maxRetries)
              chatAgentBanner('⚠ Max revisions reached — proceeding with best result', 'fail');
          } else {
            passed = true;
          }

          AG.results[agentId].output     = agentOutput;
          AG.results[agentId].confidence = scoreAgentOutput(agentId, agentOutput).score;
        }

        outputs[agentId] = agentOutput;
      }

      stageStates[si] = 'done';
      _pipelineTimelineUpdate(si, 'done');
    }

    // ── Completion ──────────────────────────────────────────
    const totalSecs = ((Date.now() - tStart) / 1000).toFixed(1);
    const allScores = agents.map(id => AG.results[id]?.confidence || 0);
    const avgScore  = Math.round(allScores.reduce((s,n)=>s+n,0) / Math.max(allScores.length,1));
    const avgLevel  = avgScore >= 75 ? 'high' : avgScore >= 45 ? 'med' : 'low';
    const overallBadge = `<span class="conf-badge conf-${avgLevel}" style="font-size:.65rem;padding:3px 9px">Pipeline confidence: <strong>${avgScore}%</strong></span>`;
    const timeBadge    = `<span style="font-size:.65rem;color:var(--t3);font-family:var(--fc)">${totalSecs}s total</span>`;

    const isNonHtml     = FW_SB.has(fw);
    const previewBtnHtml = isNonHtml
      ? `<button class="agent-preview-btn sb" onclick="showStackBlitzBanner(S.fileTree,'${fw}')">↗ Open in StackBlitz</button>`
      : `<button class="agent-preview-btn" onclick="runPreview()">▶ Preview Result</button>`;

    chatAgentBanner(
      `✅ Pipeline complete! &nbsp;${previewBtnHtml}` +
      ` &nbsp;<button class="pra" style="margin-left:4px" onclick="agentsExport()">⬇ Export</button>` +
      ` &nbsp;${overallBadge} &nbsp;${timeBadge}`,
      'end'
    );
    saveCurrentSession();
    showToast(`✅ Pipeline complete in ${totalSecs}s!`, 'ok');

  } catch(e) {
    document.querySelectorAll('[id^="agent-thinking-"]').forEach(el => {
      if (el._timer) clearInterval(el._timer);
      el.remove();
    });
    if (e.name === 'AbortError') {
      chatAgentBanner('⛔ Pipeline stopped', 'fail');
    } else {
      chatAgentBanner('⚠ Pipeline error: ' + esc(e.message), 'fail');
      showToast('Pipeline error: ' + e.message, 'err');
    }
  } finally {
    AG.running = false;
    S.loading  = false;
    S.controller = null;
    setSndBtn(false);
    setBuildStatus('ready', 'Ready');
  }
}

// Build a clean, role-specific prompt — each agent only sees what it needs
function buildRolePrompt(agentId, task, fw, fwLabel, outputs, iteration, feedback) {
  let prompt = '';

  if (iteration > 1 && feedback) {
    prompt += '⚠ REVISION ' + iteration + ' — Fix these issues:\n' + feedback + '\n\n---\n\n';
  }

  switch (agentId) {
    case 'planner':
      prompt +=
        'USER REQUEST:\n' + task + '\n\n' +
        'FRAMEWORK: ' + fwLabel + '\n\n' +
        'Create a detailed product plan for this request. Remember: NO code — planning only.';
      break;

    case 'designer':
      prompt +=
        'USER REQUEST:\n' + task + '\n\n' +
        'FRAMEWORK: ' + fwLabel + '\n\n' +
        '--- PRODUCT PLAN ---\n' +
        (outputs.planner || 'No plan — infer from user request.') + '\n\n' +
        'Create a detailed design specification following the plan. ' +
        'Remember: NO code — design spec only. Be extremely specific with hex values, px measurements, and visual descriptions.';
      break;

    case 'developer':
      prompt +=
        'USER REQUEST:\n' + task + '\n\n' +
        'FRAMEWORK: ' + fwLabel + '\n\n' +
        '--- PRODUCT PLAN ---\n' +
        (outputs.planner || '') + '\n\n' +
        '--- DESIGN PROTOTYPE (implement this exact visual style) ---\n' +
        (outputs.designer || 'No prototype — infer a modern dark design.') + '\n\n' +
        'Implement ALL files for the ' + fwLabel + ' framework. Follow the design exactly. Output all files now.';
      break;

    case 'tester':
      prompt +=
        'USER REQUEST:\n' + task + '\n\n' +
        '--- PRODUCT PLAN (what was required) ---\n' +
        (outputs.planner || '') + '\n\n' +
        '--- IMPLEMENTED CODE (review this) ---\n' +
        (outputs.developer || 'No code available.') + '\n\n' +
        'Review the code against the plan. Give a detailed review and end with VERDICT: PASS or VERDICT: FAIL.';
      break;

    case 'devops':
      prompt +=
        'PROJECT: ' + task + '\n' +
        'FRAMEWORK: ' + fwLabel + '\n\n' +
        '--- FINAL CODE ---\n' +
        (outputs.developer || '') + '\n\n' +
        'Create deployment files (README, package.json if needed, deployment config). Output files only.';
      break;

    default:
      prompt += 'USER REQUEST:\n' + task + '\n\nContext:\n' + Object.values(outputs).join('\n\n---\n\n');
  }

  return prompt;
}

