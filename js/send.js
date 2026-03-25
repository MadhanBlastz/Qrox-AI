// ════════════════════════════════════════════
//  SEND  (Streaming v5)
// ════════════════════════════════════════════
async function send(){
  const inp=document.getElementById('uIn'),txt=inp.value.trim();
  if((!txt && !S.attached.length)||S.loading) return;
  const _sendStartMs = Date.now();

  // If files attached but no text, use a default prompt
  const effectiveTxt = txt || (S.attached.some(f=>f.isImage) ? 'Analyze the attached image(s).' : 'Analyze the attached file(s) and summarize the key content.');

  // ── AGENT PIPELINE MODE ──────────────────────────────────────
  if (S.opts?.agents) {
    inp.value = '';
    updCC && updCC();
    setSndBtn(true);
    await runAgentPipeline(effectiveTxt);
    return;
  }
  // ────────────────────────────────────────────────────────────
  S.loading=true;S.fbLog=[];
  S.controller = new AbortController();
  _userScrolledUp = false;
  setSndBtn(true);
  setBuildStatus('building','Building…');
  const ws=document.getElementById('ws');if(ws)ws.remove();
  if(!S.currentSessionId){S.currentSessionId='s_'+Date.now();}

  let content = effectiveTxt;
  let visionContent = null;

  if (S.attached.length) {
    const images  = S.attached.filter(f => f.isImage);
    const texts   = S.attached.filter(f => !f.isImage && f.content);
    if (images.length) {
      visionContent = [{ type:'text', text: content }];
      images.forEach(img => {
        visionContent.push({ type:'image_url', image_url:{ url:`data:${img.mimeType};base64,${img.imageData}` } });
      });
      visionContent[0].text += `\n\nIMPORTANT — Images attached (${images.map(i=>i.name).join(', ')}): Analyze every visual detail deeply — layout, colors, typography, spacing, components, patterns, interactions. If asked to replicate a design, produce pixel-accurate code matching all visual elements exactly.`;
    }
    if (texts.length) {
      content += '\n\n' + texts.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n');
      if (visionContent) visionContent[0].text = content;
    }
  }

  const msgContent = visionContent || content;
  S.msgs.push({ role:'user', content: msgContent });
  renderUser(effectiveTxt, S.attached.slice());
  inp.value=''; inp.style.height='auto'; updCC();
  S.attached=[]; document.getElementById('atchFiles').innerHTML='';

  let tp=null;
  if(S.opts.think && S.opts.build){tp=mkTP();document.getElementById('chatBox').appendChild(tp);scrollBot();setTimeout(startThink,120);}

  // ── Build the AI bubble shell upfront (before response arrives) ──
  const bubbleId = 'ai-bbl-' + Date.now();
  const metaId   = 'ai-meta-' + Date.now();
  const tickerId = 'ai-ticker-' + Date.now();
  const speedId  = 'ai-speed-' + Date.now();

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'msg ai';
  bubbleDiv.innerHTML = `
    <div class="av ai"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="qbga" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="20" height="20" rx="6" fill="url(#qbga)"/><g transform="translate(3,4)"><polygon points="7,1 13,4 7,7 1,4" fill="white" opacity="0.95"/><polyline points="1,7 7,10 13,7" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.8"/><polyline points="1,10 7,13 13,10" fill="none" stroke="white" stroke-width="1.4" stroke-linejoin="round" opacity="0.65"/></g></svg></div>
    <div style="flex:1;min-width:0">
      <div class="bbl" id="${bubbleId}" style="max-width:100%;min-height:44px"></div>
      <div class="mmeta" id="${metaId}" style="display:none">
        <span>${gT()}</span>
        <span class="stream-live-tag" id="streamLiveTag">LIVE</span>
        <span class="stream-token-count" id="${tickerId}">0 tok</span>
        <span class="stream-speed" id="${speedId}">— t/s</span>
      </div>
    </div>`;
  document.getElementById('chatBox').appendChild(bubbleDiv);
  // Show the meta bar immediately (shows LIVE + counter while streaming)
  const metaEl   = document.getElementById(metaId);
  const bblEl    = document.getElementById(bubbleId);
  const tickerEl = document.getElementById(tickerId);
  const speedEl  = document.getElementById(speedId);
  metaEl.style.display = 'flex';
  scrollBot();

  try{
    // ── Task detection via multi-signal classifier ────────────
    const lastMsg   = S.msgs[S.msgs.length-1];
    const msgText   = (typeof lastMsg?.content === 'string' ? lastMsg.content
                     : lastMsg?.content?.find?.(p=>p.type==='text')?.text || '');
    const hasImages = Array.isArray(lastMsg?.content) && lastMsg.content.some(p=>p.type==='image_url');

    let taskKey;
    if (hasImages && S.opts.build) {
      taskKey = 'designcode';
    } else if (hasImages) {
      taskKey = 'vision';
    } else {
      // Run the full intent classifier
      const intentResult = detectIntent(msgText, {
        buildMode:  S.opts?.build || false,
        hasImages,
        hasFiles:   S.attached?.some(f => !f.isImage) || false,
        historyLen: S.msgs.length,
      });
      INTENT_STATE.detected = intentResult;

      if (INTENT_STATE.override) {
        // User manually overrode — respect it
        taskKey = INTENT_STATE.override;
      } else {
        taskKey = intentResult.routeKey;
      }

      // Show the badge with final used key
      _intentBadgeRender();
    }

    // Start streaming renderer
    streamStart(bblEl, tickerEl, speedEl);

    const rawSys = buildSys(taskKey) + await ragRetrieve(effectiveTxt) + (TOOLS.enabled ? '\n\n' + TOOL_SYS_PROMPT : '');

    // ── 1. Context-Length Aware Routing ──────────────────────
    const _prevForced = S.forcedModel;
    const ctxSwitch = ctxCheckAndRoute(taskKey, S.msgs, rawSys);

    // ── 2. Per-Model System Prompt Tuning ────────────────────
    // Apply after routing so we tune for the actual model that will be used
    const activeProvId = S.forcedModel?.provId || S.currentModel?.provId || '';
    const sysPrompt    = applyModelPromptStyle(rawSys, activeProvId);

    // ── 3. Prompt Compression ────────────────────────────────
    const { msgs: compressedMsgs, compressed, summary } = await compressContextIfNeeded(S.msgs, sysPrompt);

    // ── 4. Token Budget — hide estimator bar while sending ───
    tbeHide();

    // ── 5. Track original model for rate-limit downgrade badge
    const _originalModelName = S.currentModel?.modelName || '';

    const res = await smartCallForTask(
      taskKey, compressedMsgs, sysPrompt, S.settings.maxTokens,
      (delta) => streamChunk(delta)
    );

    // Restore forced model if we overrode it for context routing
    if (ctxSwitch && !_prevForced) S.forcedModel = null;

    S.msgs.push({role:'assistant',content:res.text});
    stopThink();

    // Finalise: hide LIVE tag, swap counter for model tag, show action buttons
    const liveTag = document.getElementById('streamLiveTag');
    if (liveTag) liveTag.remove();
    const c = res.color||'#6366f1', rgb = hexRgb(c);
    const tagStyle = `background:rgba(${rgb},.15);border:1px solid rgba(${rgb},.35);color:${c}`;
    const fbHtml = (res.isFallback&&res.fbLog?.length)
      ? `<div class="fblog"><span>⚡</span><span>Fallback: ${res.fbLog.map(l=>`${l.prov}`).join(' → ')} → <strong>${res.provName}</strong></span></div>`
      : '';
    const hasHtml = S.opts.build&&(res.text.includes('<!DOCTYPE')||res.text.match(/```(?:\w+:)?[^\n]*\.(html|jsx|tsx|vue)\n/)||Object.keys(S.fileTree).length>0);
    const runBtn  = hasHtml ? `<button class="mact run-code-btn" onclick="quickRunFromMsg(this)">▶ Run Preview</button>` : '';

    // Insert fallback log above bubble if present
    if (fbHtml) {
      const fbDiv = document.createElement('div');
      fbDiv.innerHTML = fbHtml;
      bblEl.parentNode.insertBefore(fbDiv.firstChild, bblEl.nextSibling);
    }

    // Replace meta content: token count stays, add model tag + buttons
    const finalTokCount = tickerEl.textContent;
    metaEl.innerHTML = `
      <span>${gT()}</span>
      ${res.modelName?`<span class="umtag" style="${tagStyle}">${res.logo||'🤖'} ${res.modelName}</span>`:''}
      ${res.isFallback?'<span style="font-size:.6rem;color:var(--orange)">⚡ fallback</span>':''}
      <span class="stream-token-count">${finalTokCount}</span>
      <span class="stream-speed">${speedEl.textContent}</span>
      ${runBtn}
      <button class="mact" onclick="cpyBbl(this)">📋 Copy</button>
      <button class="mact" onclick="dlMsg(this)">⬇ Save</button>`;

    // Finalise the streamed content
    streamEnd(bblEl, null); // meta already shown

    // ── Voice: inject speak button + auto-read ────────────────
    voiceInjectSpeakBtn(bblEl, res.text);
    voiceAutoReadResponse(res.text);

    // ── Prompt DNA fingerprint ────────────────────────────────
    dnaInjectBubble(metaEl, res.text, taskKey, _sendStartMs);

    // ── Compression badge ─────────────────────────────────────
    if (compressed && metaEl) {
      const cb = document.createElement('span');
      cb.className = 'compress-badge';
      cb.title = `History compressed — summary: ${(summary||'').slice(0,120)}…`;
      cb.innerHTML = '🗜 Compressed';
      metaEl.appendChild(cb);
    }

    // ── Rate-limit downgrade badge ────────────────────────────
    if (res.isFallback && _originalModelName && res.modelName !== _originalModelName) {
      rlInjectBadge(metaEl, _originalModelName, res.modelName);
    }

    // ── Self-Critique Loop ────────────────────────────────────
    if (CRITIQUE.enabled) {
      critiqueRun(res.text, bblEl, metaEl, taskKey);
    }

    // ── Clear ghost prediction on send ────────────────────────
    ghostOnSend();

    // ── TTS: speak response if enabled ───────────────────────
    if (document.getElementById('voiceTTS')?.checked) {
      voiceTTSSpeak(res.text, metaEl);
    }

    // ── Tool execution (if tools enabled and AI used a tool) ──
    if (TOOLS.enabled && toolsParse(res.text)) {
      // Pop the assistant msg we just pushed — toolsProcessResponse manages history
      S.msgs.pop();
      await toolsProcessResponse(res.text, bblEl, sysPrompt, taskKey);
    }

    // Extract files from response
    const files=extractFilesFromResponse(res.text);
    if(Object.keys(files).length){
      const n=addFilesToTree(files);
      if(n) showToast(`📁 ${n} file${n>1?'s':''} added to explorer`,'ok');
      const htmlFile=Object.keys(files).find(k=>k.endsWith('.html'));
      if(htmlFile) S.previewHtml=files[htmlFile];
    }
    if(!S.previewHtml && res.text.includes('<!DOCTYPE') && res.text.includes('</html>')){
      const match=res.text.match(/<!DOCTYPE[\s\S]*<\/html>/i);
      if(match) S.previewHtml=match[0];
    }
    updateRunButtons(res.text);
    if (S.opts.build && S.framework && !S._frameworkLocked) {
      S._frameworkLocked = true;
      const toolbar = document.getElementById('chatToolbarWrap');
      if (toolbar) toolbar.style.display = 'none';
      showToast(`🔒 Framework locked: ${S.framework} — continuing in this stack`, 'inf');
    }
    setBuildStatus('ready','Ready');
    saveCurrentSession();
    smartTitleTrigger();
    // ── Broadcast to collab peers ─────────────────────────────
    if (COLLAB.active) {
      const lastUser = S.msgs.filter(m=>m.role==='user').at(-1);
      const lastAI   = S.msgs.filter(m=>m.role==='assistant').at(-1);
      if (lastUser) collabBroadcastMsg(lastUser);
      if (lastAI)   collabBroadcastMsg(lastAI);
    }
    streamEnd(null, null);
    if(e.name==='AbortError'||e.message==='canceled'){
      // Partial content already shown — just stop and clean up
      if(bblEl && STREAM.raw) {
        bblEl.innerHTML = parseMsg(STREAM.raw) + '<span style="opacity:.4;font-size:.75rem"> [stopped]</span>';
        hlCode(bblEl);
        if(metaEl){ const lt=metaEl.querySelector('.stream-live-tag'); if(lt)lt.remove(); metaEl.style.display='flex'; }
        if(STREAM.raw.trim()) S.msgs.push({role:'assistant',content:STREAM.raw+'[stopped]'});
      } else {
        bubbleDiv.remove();
      }
      stopThink();
      setBuildStatus('idle','Stopped');
    } else {
      bubbleDiv.remove();
      stopThink();
      renderErr(e.message);showToast(e.message,'err');setDotState('error');
      setBuildStatus('error','Error');
    }
  }finally{
    S.loading=false;S.controller=null;setSndBtn(false);scrollBot();
  }
}

