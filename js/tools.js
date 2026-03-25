// ════════════════════════════════════════════
//  TOOL SYSTEM  v5
//
//  When Tools mode is ON, the AI can invoke
//  built-in tools by wrapping calls in its
//  response text:
//
//    <tool:run_js>console.log(2+2)</tool:run_js>
//    <tool:fetch_url>https://example.com</tool:fetch_url>
//    <tool:read_file>filename.txt</tool:read_file>
//
//  After each response, the send() pipeline:
//   1. Scans for tool tags
//   2. Executes each tool
//   3. Renders a tool-call card + result card
//   4. Appends results to context + re-prompts
//      so the AI can use the output in its answer
// ════════════════════════════════════════════

const TOOLS = {
  enabled: false,
};

const TOOL_SYS_PROMPT = `
You have access to the following tools. Call them by wrapping the invocation in XML tags anywhere in your response:

<tool:run_js>// JavaScript code to execute in browser sandbox
console.log("hello"); 2 + 2</tool:run_js>

<tool:fetch_url>https://example.com</tool:fetch_url>

<tool:read_file>filename.txt</tool:read_file>

Rules:
- Use tools when they would produce a better answer (calculations, live data, file content)
- You MUST wait for the tool result before continuing your answer — end your message after the tool call
- The system will automatically execute the tool and return results
- After getting tool results, provide your final answer incorporating the data
- Only one tool call per message
- For run_js: write clean ES2020 JS; use console.log() to output results; last expression is also captured
- For fetch_url: provide the full URL; result will be a text excerpt of the page
- For read_file: provide the filename exactly as it appears in the attached files list
`.trim();

function toolsToggle() {
  TOOLS.enabled = !TOOLS.enabled;
  const badge = document.getElementById('toolsActiveBadge');
  if (badge) badge.classList.toggle('show', TOOLS.enabled);
  showToast(TOOLS.enabled ? '⚙ Tools ON — AI can run JS, fetch URLs, read files' : '⚙ Tools OFF', 'inf');
}

function toolsUpdateUI() {
  const btn = document.getElementById('plus-tools');
  if (btn) btn.classList.toggle('active', TOOLS.enabled);
  const badge = document.getElementById('toolsActiveBadge');
  if (badge) badge.classList.toggle('show', TOOLS.enabled);
}

// ── Tool tag parser ───────────────────────────────────────────
const TOOL_RE = /<tool:(run_js|fetch_url|read_file)>([\s\S]*?)<\/tool:\1>/;

function toolsParse(text) {
  const m = text.match(TOOL_RE);
  if (!m) return null;
  return { name: m[1], args: m[2].trim(), fullMatch: m[0] };
}

// ── Tool executors ────────────────────────────────────────────
async function toolExec(name, args) {
  switch (name) {
    case 'run_js':   return await toolRunJS(args);
    case 'fetch_url':return await toolFetchUrl(args);
    case 'read_file':return toolReadFile(args);
    default:         return { ok: false, output: `Unknown tool: ${name}` };
  }
}

async function toolRunJS(code) {
  return new Promise(resolve => {
    // Run in a sandboxed iframe — completely isolated from main page
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const logs = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      iframe.remove();
      resolve({ ok: false, output: 'Timeout after 8s' });
    }, 8000);

    window.addEventListener('message', function handler(e) {
      if (e.source !== iframe.contentWindow) return;
      window.removeEventListener('message', handler);
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      iframe.remove();
      if (e.data.error) resolve({ ok: false, output: e.data.error });
      else resolve({ ok: true, output: e.data.logs.join('\n') || String(e.data.result ?? '(no output)') });
    });

    const src = `
      <script>
        const logs = [];
        const _log = (...a) => logs.push(a.map(x=>JSON.stringify(x)).join(' '));
        const console = { log:_log, warn:_log, error:_log, info:_log };
        let result;
        try {
          result = eval(${JSON.stringify(code)});
        } catch(e) {
          parent.postMessage({ error: e.message }, '*');
        }
        parent.postMessage({ logs, result }, '*');
      <\/script>`;
    iframe.srcdoc = src;
  });
}

async function toolFetchUrl(url) {
  try {
    url = url.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const r = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const tmp = document.createElement('div');
    tmp.innerHTML = (j.contents || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ');
    const text = tmp.textContent.replace(/\s{3,}/g, '\n').trim().slice(0, 2000);
    if (!text) return { ok: false, output: 'No readable content found' };
    return { ok: true, output: text };
  } catch(e) {
    return { ok: false, output: `Fetch failed: ${e.message}` };
  }
}

function toolReadFile(filename) {
  const file = S.attached.find(f =>
    f.name.toLowerCase() === filename.toLowerCase() ||
    f.name.toLowerCase().includes(filename.toLowerCase())
  );
  if (!file) {
    const available = S.attached.map(f => f.name).join(', ') || 'none';
    return { ok: false, output: `File "${filename}" not found. Attached: ${available}` };
  }
  if (file.isImage) return { ok: false, output: `"${file.name}" is an image — use vision mode instead` };
  return { ok: true, output: file.content?.slice(0, 3000) || '(empty file)' };
}

// ── Tool card DOM builders ─────────────────────────────────────
function toolBuildCallCard(name, args, statusText, statusClass) {
  const icons = { run_js:'⚡', fetch_url:'🌐', read_file:'📄' };
  const labels = { run_js:'Run JavaScript', fetch_url:'Fetch URL', read_file:'Read File' };
  const uid = 'tc_' + Math.random().toString(36).slice(2);
  return `<div class="tool-call-card">
    <div class="tool-call-hdr" onclick="document.getElementById('${uid}').classList.toggle('open')">
      <span class="tool-call-hdr-icon">${icons[name]||'🔧'}</span>
      <span class="tool-call-hdr-name">${labels[name]||name}</span>
      <span class="tool-call-status ${statusClass}" id="${uid}_status">${statusText}</span>
      <span style="font-size:.6rem;color:var(--t4)">▼</span>
    </div>
    <div class="tool-call-body" id="${uid}">
      <div class="tool-call-args">${esc(args.slice(0,400))}</div>
    </div>
  </div>`;
}

function toolBuildResultCard(name, result) {
  const uid = 'tr_' + Math.random().toString(36).slice(2);
  const preview = result.output.slice(0, 120).replace(/\n/g,' ');
  return `<div class="tool-result-card">
    <div class="tool-result-hdr" onclick="document.getElementById('${uid}').classList.toggle('open')">
      <span>${result.ok ? '✅' : '❌'}</span>
      <span style="flex:1">Result: ${esc(preview)}${result.output.length>120?'…':''}</span>
      <span style="font-size:.6rem;color:var(--t4)">▼</span>
    </div>
    <div class="tool-result-body" id="${uid}">
      <pre style="margin:0;font-size:.67rem;white-space:pre-wrap">${esc(result.output)}</pre>
    </div>
  </div>`;
}

// ── Main tool pipeline — called from send() after response ─────
async function toolsProcessResponse(resText, bblEl, sysPrompt, taskKey) {
  const tool = toolsParse(resText);
  if (!tool) return resText; // no tool call — return as-is

  // Show tool call card inside the bubble
  const callCard = document.createElement('div');
  callCard.innerHTML = toolBuildCallCard(tool.name, tool.args, 'RUNNING…', 'running');
  if (bblEl) bblEl.appendChild(callCard);
  scrollBot(true);

  // Execute the tool
  const result = await toolExec(tool.name, tool.args);

  // Update status badge
  const statusEl = callCard.querySelector('.tool-call-status');
  if (statusEl) {
    statusEl.textContent = result.ok ? 'DONE' : 'ERROR';
    statusEl.className   = 'tool-call-status ' + (result.ok ? 'ok' : 'err');
  }

  // Show result card
  const resultCard = document.createElement('div');
  resultCard.innerHTML = toolBuildResultCard(tool.name, result);
  if (bblEl) bblEl.appendChild(resultCard);
  scrollBot(true);

  // Build follow-up: strip the tool call from AI response, append result, re-prompt
  const textBeforeTool = resText.slice(0, resText.indexOf(tool.fullMatch)).trim();
  const toolResultMsg  = `[Tool: ${tool.name}]\nArgs: ${tool.args}\nResult (${result.ok?'success':'error'}): ${result.output}`;

  // Append to message history
  S.msgs.push({ role: 'assistant', content: resText });
  S.msgs.push({ role: 'user',      content: toolResultMsg + '\n\nPlease continue your response using the tool result above.' });

  // Show a "thinking" indicator while the AI processes
  const continueDiv = document.createElement('div');
  continueDiv.innerHTML = '<div class="tybbl" style="padding:8px 0"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>';
  if (bblEl) bblEl.appendChild(continueDiv);
  scrollBot(true);

  // Re-call the model with tool result in context
  try {
    const followUp = await smartCallForTask(taskKey, S.msgs, sysPrompt, S.settings.maxTokens);
    continueDiv.remove();
    // Append follow-up text to the bubble
    const followDiv = document.createElement('div');
    followDiv.style.marginTop = '8px';
    followDiv.innerHTML = parseMsg(followUp.text);
    if (bblEl) { bblEl.appendChild(followDiv); hlCode(followDiv); }
    S.msgs.push({ role: 'assistant', content: followUp.text });
    scrollBot(true);
    return resText + '\n\n' + toolResultMsg + '\n\n' + followUp.text;
  } catch(e) {
    continueDiv.remove();
    return resText;
  }
}

