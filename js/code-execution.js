// ════════════════════════════════════════════
//  INLINE CODE EXECUTION  v5
//
//  Replaces runCodeBlock() with a version that
//  executes JS in a sandboxed iframe and renders
//  output (console.log, return value, errors)
//  directly below the code block — no tab switch.
//
//  HTML/CSS blocks: renders in preview tab.
//  JS blocks: sandboxed inline execution.
//  Python: detects if Pyodide is available,
//          falls back to preview tab if not.
// ════════════════════════════════════════════

const EXEC = {
  running: new Set(),  // set of block IDs currently executing
  history: [],         // [{id, lang, code, output, ts, ms}]
};

// Override the existing runCodeBlock

function _execJS(id, code, cbw, lang) {
  if (EXEC.running.has(id)) return;
  EXEC.running.add(id);

  const runBtn = cbw.querySelector('.cba.run');
  if (runBtn) { runBtn.className = 'cba run running'; runBtn.textContent = '⟳ Running'; }

  // Get or create output panel
  const outputEl = _execGetOutput(id, cbw);
  outputEl.querySelector('.cb-output-label').textContent = 'Running…';
  outputEl.querySelector('.cb-output-label').className   = 'cb-output-label run';
  const body = outputEl.querySelector('.cb-output-body');
  body.innerHTML = '';

  const tStart = Date.now();
  const lines  = [];

  // Build sandboxed iframe
  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-scripts';
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const EXEC_TIMEOUT = 8000;
  let settled = false;

  const finish = (returnVal, error) => {
    if (settled) return;
    settled = true;
    EXEC.running.delete(id);
    clearTimeout(timer);
    iframe.remove();

    const ms = Date.now() - tStart;

    if (error) {
      lines.push({ type:'error', text: error });
      outputEl.querySelector('.cb-output-label').textContent = `Error · ${ms}ms`;
      outputEl.querySelector('.cb-output-label').className   = 'cb-output-label err';
      if (runBtn) { runBtn.className = 'cba run done-err'; runBtn.textContent = '▶ Run'; }
    } else {
      if (returnVal !== undefined && returnVal !== null && returnVal !== '') {
        lines.push({ type:'ret', text: '→ ' + _execFormat(returnVal) });
      }
      outputEl.querySelector('.cb-output-label').textContent = `Output · ${ms}ms`;
      outputEl.querySelector('.cb-output-label').className   = 'cb-output-label ok';
      if (runBtn) { runBtn.className = 'cba run done-ok'; runBtn.textContent = '▶ Run'; }
    }

    // Time badge
    const timeEl = outputEl.querySelector('.cb-output-time');
    if (timeEl) timeEl.textContent = ms + 'ms';

    _execRenderLines(body, lines);
    EXEC.history.unshift({ id, lang, code, output: lines, ts: Date.now(), ms });
    if (EXEC.history.length > 50) EXEC.history.pop();
  };

  const timer = setTimeout(() => finish(undefined, 'Timeout after 8s'), EXEC_TIMEOUT);

  window.addEventListener('message', function handler(e) {
    if (e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (d.type === 'log')    lines.push({ type: d.level || 'log', text: d.args });
    if (d.type === 'result') { window.removeEventListener('message', handler); finish(d.value, d.error); }
  });

  // Inject execution code
  const src = `<!DOCTYPE html><html><body><script>
    const _c = (t,l) => a => parent.postMessage({type:'log',level:l,args:Array.from(a).map(x=>{try{return typeof x==='object'?JSON.stringify(x,null,2):String(x)}catch(e){return '[circular]'}}).join(' ')},'*');
    console.log   = _c('log','log');
    console.warn  = _c('warn','warn');
    console.error = _c('error','error');
    console.info  = _c('info','info');
    window.onerror = (msg,src,line) => { parent.postMessage({type:'result',error:msg+' (line '+line+')'},'*'); return true; };
    try {
      const __result = (function(){
        ${code}
      })();
      const val = __result instanceof Promise
        ? __result.then(v => parent.postMessage({type:'result',value:v===undefined?'':String(v)},'*'))
                  .catch(e => parent.postMessage({type:'result',error:String(e)},'*'))
        : parent.postMessage({type:'result',value:__result===undefined?'':String(__result)},'*');
    } catch(e) {
      parent.postMessage({type:'result',error:String(e)},'*');
    }
  <\/script></body></html>`;

  iframe.contentDocument.open();
  iframe.contentDocument.write(src);
  iframe.contentDocument.close();
}

function _execPython(id, code, cbw) {
  // Pyodide not bundled — show helpful message with copy option
  const outputEl = _execGetOutput(id, cbw);
  const body = outputEl.querySelector('.cb-output-body');
  outputEl.querySelector('.cb-output-label').textContent = 'Python';
  outputEl.querySelector('.cb-output-label').className   = 'cb-output-label run';
  body.innerHTML = `<span class="cb-out-line info">Python execution requires Pyodide. Copy code below to run locally, or ask the AI to convert it to JavaScript.</span>`;
}

function _execGetOutput(id, cbw) {
  let out = cbw.querySelector('.cb-output');
  if (out) return out;
  out = document.createElement('div');
  out.className = 'cb-output';
  out.innerHTML = `<div class="cb-output-hdr">
    <span class="cb-output-label ok">Output</span>
    <span class="cb-output-time"></span>
    <button class="cb-output-clear" onclick="this.closest('.cb-output').remove()" title="Clear output">✕</button>
  </div>
  <div class="cb-output-body"></div>`;
  cbw.appendChild(out);
  return out;
}

function _execRenderLines(body, lines) {
  if (!lines.length) {
    body.innerHTML = '<span class="cb-out-line info">✓ Executed (no output)</span>';
    return;
  }
  body.innerHTML = lines.map(l =>
    `<span class="cb-out-line ${l.type}">${esc(l.text)}</span>`
  ).join('');
}

function _execFormat(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') { try { return JSON.stringify(val, null, 2); } catch(e) { return '[object]'; } }
  return String(val);
}

// ════════════════════════════════════════════
