// ════════════════════════════════════════════
//  PREVIEW
// ════════════════════════════════════════════
function setBuildStatus(state,msg){
  const el=document.getElementById('buildStatus');
  el.className='build-status '+state;
  el.textContent=(state==='building'?'⟳ ':state==='ready'?'● ':state==='error'?'✕ ':'● ')+msg;
}

// ════════════════════════════════════════════
//  SMART MULTI-FRAMEWORK RUNNER
//  Detects project type and uses best strategy:
//  HTML/CSS/JS  → direct blob iframe
//  React (JSX)  → Babel CDN transpile in iframe
//  Vue SFC      → Vue CDN in iframe
//  TypeScript   → TS CDN transpile in iframe
//  React+deps / Next.js / Node → StackBlitz redirect
// ════════════════════════════════════════════

function detectProjectType(files, rawHtml) {
  const allPaths   = Object.keys(files);
  const allContent = Object.values(files).map(f=>f.content||'').join('\n') + (rawHtml||'');

  const hasPath = (p) => allPaths.some(f => f === p || f.includes(p));
  const has     = (ext) => allPaths.some(p => p.endsWith(ext));
  const any     = (str) => allContent.includes(str);

  // Next.js — app/ router or pages/ router or next.config
  if (hasPath('next.config') || hasPath('app/layout') || hasPath('app/page')
      || hasPath('pages/') || any("from 'next'") || any('from "next"')
      || any("from 'next/") || any('from "next/')
      || any('next.config') || any('next dev') || any('NextRequest') || any('NextResponse')) return 'nextjs';

  // Fullstack — server + client dirs (files OR raw text mentions both)
  const hasServer = allPaths.some(p => p.startsWith('server/'));
  const hasClient = allPaths.some(p => p.startsWith('client/') || p.startsWith('src/'));
  const rawMentionsServer = any('server/index') || any('server/app') || any('server/server');
  const rawMentionsClient = any('client/src') || any('src/App') || any('src/main.jsx') || any('src/index.jsx');
  if ((hasServer && hasClient) || (rawMentionsServer && rawMentionsClient)) return 'fullstack';

  // Node/Express (server only)
  if (hasServer || rawMentionsServer
      || any("require('express')") || any('require("express")')
      || any("from 'express'") || any("app.listen(") || any("app.use(")
      || any("app.get(") || any("app.post(")) return 'node';

  // Vue SFC
  if (has('.vue') || (any('<template>') && any('<script'))) return 'vue';

  // Svelte
  if (has('.svelte')) return 'svelte';

  // React with npm (vite.config, npm imports, or .tsx files)
  if (hasPath('vite.config') || any("from 'react'") || any('from "react"')
      || has('.tsx') || hasPath('src/main.jsx') || hasPath('src/main.tsx')
      || any('vite.config') || any('@vitejs/plugin-react') || any('createRoot(')) return 'react-npm';

  // TypeScript only
  if (has('.ts') && !has('.tsx')) return 'typescript';

  // React JSX inline (no npm — Babel CDN)
  if (has('.jsx') || any('ReactDOM.createRoot') || any('ReactDOM.render')
      || any('import React') || any('useState') || any('useEffect')) return 'react-cdn';

  // Plain HTML/JS
  return 'html';
}

function runCodeBlock(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const code = el.textContent;
  const lang = el.className.replace('language-','');
  runSmartPreview(code, lang);
}

// ── FRAMEWORK TOOLBAR ────────────────────────────────────────
// S.framework: currently selected framework type
// SB types open in StackBlitz, inline types load in iframe
const FW_SB = new Set(['react-npm','nextjs','node','fullstack','svelte']);

// Called by the input-area toolbar pills — click same pill again to deselect
function selectFwPill(btn) {
  const fw = btn.dataset.fw;
  // Toggle off if already selected
  if (S.framework === fw) {
    S.framework = null;
    S._userPickedFramework = false;
    document.querySelectorAll('.fw-pill').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.fw-btn').forEach(b => b.classList.remove('on'));
    _applyFrameworkToRunBtns(null);
    return;
  }
  S.framework = fw;
  S._userPickedFramework = true;
  document.querySelectorAll('.fw-pill').forEach(b => b.classList.toggle('on', b.dataset.fw === fw));
  document.querySelectorAll('.fw-btn').forEach(b => b.classList.toggle('on', b.dataset.fw === fw));
  _applyFrameworkToRunBtns(fw);
}

// Called by the preview-area buttons
function setFramework(btn) {
  const fw = btn.dataset.fw;
  S.framework = fw;
  S._userPickedFramework = true;
  document.querySelectorAll('.fw-btn').forEach(b => b.classList.toggle('on', b.dataset.fw === fw));
  document.querySelectorAll('.fw-pill').forEach(b => b.classList.toggle('on', b.dataset.fw === fw));
  _applyFrameworkToRunBtns(fw);
}

function _applyFrameworkToRunBtns(fw) {
  const isSB = FW_SB.has(fw);
  const previewBtn = document.getElementById('previewRunBtn');
  if (previewBtn) {
    previewBtn.textContent = isSB ? '↗ StackBlitz' : '▶ Run';
    previewBtn.style.background   = isSB ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : '';
    previewBtn.style.color        = isSB ? '#fff' : '';
    previewBtn.style.border       = isSB ? '1px solid rgba(124,58,237,.4)' : '';
  }
  const hdrBtn = document.querySelector('.hbtn.run-btn');
  if (hdrBtn) {
    const txt = hdrBtn.querySelector('.run-btn-txt');
    if (txt) txt.textContent = isSB ? 'StackBlitz' : 'Run';
    hdrBtn.style.background  = isSB ? 'linear-gradient(135deg,#7c3aed,#a78bfa)' : '';
    hdrBtn.style.color       = isSB ? '#fff' : '';
    hdrBtn.style.borderColor = isSB ? 'rgba(124,58,237,.4)' : '';
  }
}
// Called after every AI response. Auto-selects framework button + updates Run btn.
function updateRunButtons(rawText) {
  const hasContent = Object.keys(S.fileTree).length > 0 || !!S.previewHtml || !!rawText;
  if (!hasContent) return;

  // Only auto-detect if user hasn't explicitly chosen a non-default framework
  const userPicked = S._userPickedFramework;
  const type = userPicked
    ? S.framework   // respect user's choice
    : detectProjectType(S.fileTree, (S.previewHtml || '') + ' ' + (rawText || ''));

  if (!userPicked) {
    // Auto-sync pills and run buttons only when auto-detecting
    S.framework = type;
    document.querySelectorAll('.fw-pill').forEach(b => b.classList.toggle('on', b.dataset.fw === type));
    const fwBtn = document.querySelector(`.fw-btn[data-fw="${type}"]`);
    if (fwBtn) setFramework(fwBtn);
    else _applyFrameworkToRunBtns(type);
  }

  // Light up preview tab dot
  document.getElementById('prevDot').className = 'main-tab-dot';

  // Toast
  showToast(FW_SB.has(S.framework)
    ? `↗ ${S.framework} project — click StackBlitz to run`
    : '▶ Click Run to preview',
  'inf');
}

function runPreview() {
  const fw = S.framework || detectProjectType(S.fileTree, S.previewHtml || '');
  switchMainTab('preview');

  if (FW_SB.has(fw)) { showStackBlitzBanner(S.fileTree, fw); return; }

  let code = '';
  const tree = S.fileTree;
  const keys = Object.keys(tree);

  if (keys.length) {
    const htmlFile = keys.find(k => k.endsWith('.html'));
    const cssFiles = Object.entries(tree).filter(([k]) => k.endsWith('.css'));
    const jsFiles  = Object.entries(tree).filter(([k]) => k.endsWith('.js') && !k.endsWith('.min.js'));
    const jsxFiles = Object.entries(tree).filter(([k]) => k.endsWith('.jsx'));

    if (htmlFile) {
      code = tree[htmlFile].content;

      // Inline each CSS file
      cssFiles.forEach(([path, info]) => {
        const fname = path.split('/').pop().replace(/\./g,'[.]');
        const re = new RegExp('<link[^>]+' + fname + '[^>]*>', 'gi');
        if (re.test(code)) {
          code = code.replace(re, '<style>' + info.content + '<\/style>');
        } else {
          code = code.includes('<\/head>')
            ? code.replace('<\/head>', '<style>' + info.content + '<\/style><\/head>')
            : '<style>' + info.content + '<\/style>' + code;
        }
      });

      // Inline each JS file
      jsFiles.forEach(([path, info]) => {
        const fname = path.split('/').pop().replace(/\./g,'[.]');
        const re = new RegExp('<script[^>]+' + fname + '[^>]*>\\s*<\\/script>', 'gi');
        if (re.test(code)) {
          code = code.replace(re, '<script>' + info.content + '<\/script>');
        } else {
          code = code.includes('<\/body>')
            ? code.replace('<\/body>', '<script>' + info.content + '<\/script><\/body>')
            : code + '<script>' + info.content + '<\/script>';
        }
      });

    } else if (jsxFiles.length) {
      code = jsxFiles.map(([,v]) => v.content).join('\n');
    } else {
      const cssAll = cssFiles.map(([,v]) => '<style>' + v.content + '<\/style>').join('');
      const jsAll  = jsFiles.map(([,v])  => '<script>' + v.content + '<\/script>').join('');
      code = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
           + cssAll + '<\/head><body>' + jsAll + '<\/body><\/html>';
    }
  } else if (S.previewHtml) {
    code = S.previewHtml;
  }

  if (!code) { showToast('Nothing to preview yet.','wrn'); return; }

  if (fw === 'react-cdn' || ((fw === 'html' || fw === 'html-single') && code.includes('ReactDOM'))) { loadPreview(wrapReactCDN(code)); return; }
  if (fw === 'vue')        { loadPreview(wrapVueCDN(code));        return; }
  if (fw === 'typescript') { loadPreview(wrapTypeScriptCDN(code)); return; }

  const isDoc = code.includes('<!DOCTYPE') || code.includes('<html');
  loadPreview(isDoc ? code
    : '<!DOCTYPE html><html><head><meta charset="UTF-8"><\/head><body><script>' + code + '<\/script><\/body><\/html>');
}

function runSmartPreview(code, lang) {
  const type = detectProjectType(S.fileTree, code);

  // Multi-file projects that need Node → StackBlitz banner
  if (type === 'nextjs' || type === 'node' || type === 'react-npm' || type === 'fullstack' || type === 'vue' || type === 'svelte') {
    showStackBlitzBanner(S.fileTree, type);
    return;
  }

  // React JSX (no npm) → wrap with Babel CDN
  if (type === 'react-cdn' || lang === 'jsx' || lang === 'tsx') {
    loadPreview(wrapReactCDN(code));
    switchMainTab('preview');
    return;
  }

  // Vue → wrap with Vue CDN
  if (type === 'vue' || lang === 'vue') {
    loadPreview(wrapVueCDN(code));
    switchMainTab('preview');
    return;
  }

  // TypeScript → wrap with TS CDN
  if (lang === 'typescript' || lang === 'ts') {
    loadPreview(wrapTypeScriptCDN(code));
    switchMainTab('preview');
    return;
  }

  // Plain HTML / JS / CSS
  const isFullDoc = code.includes('<!DOCTYPE') || code.includes('<html');
  if (isFullDoc) {
    loadPreview(code);
  } else if (lang === 'css') {
    loadPreview(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${code}</style></head><body><div id="app"></div></body></html>`);
  } else if (lang === 'javascript' || lang === 'js') {
    loadPreview(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>${code}<\/script></body></html>`);
  } else {
    loadPreview(code);
  }
  switchMainTab('preview');
}

// ── HTML wrapper helpers — use array-join pattern, not template literals
// Reason: raw closing-script sequences inside JS strings terminate the outer script block

function wrapReactCDN(code) {
  const parts = [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>',
    '<title>React Preview</title>',
    '<script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>',
    '<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>',
    '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>',
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css"/>',
    '<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}<\/style>',
    '</head><body>',
    '<div id="root"></div>',
    '<script type="text/babel">',
    code,
    '\n;(function(){',
    '  if(typeof App!=="undefined"){',
    '    const root=ReactDOM.createRoot(document.getElementById("root"));',
    '    root.render(React.createElement(App));',
    '  }',
    '})();',
    '<\/script>',
    '</body></html>'
  ];
  return parts.join('\n');
}

function wrapVueCDN(code) {
  const tplMatch    = code.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = code.match(/<script(?:\s+setup)?[^>]*>([\s\S]*?)<\/script>/);
  const styleMatch  = code.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const tpl    = (tplMatch ? tplMatch[1].trim() : code).replace(/</g,'<').replace(/>/g,'>');
  const script = scriptMatch ? scriptMatch[1].trim() : '';
  const style  = styleMatch  ? styleMatch[1]  : '';
  const parts = [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>',
    '<title>Vue Preview</title>',
    '<script src="https://unpkg.com/vue@3/dist/vue.global.js"><\/script>',
    '<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}' + style + '<\/style>',
    '</head><body>',
    '<div id="app"></div>',
    '<script>',
    'const { createApp, ref, reactive, computed, onMounted, watch } = Vue;',
    script,
    'try {',
    '  if (typeof App !== "undefined") { createApp(App).mount("#app"); }',
    '  else { createApp({ template: ' + JSON.stringify(tpl) + ' }).mount("#app"); }',
    '} catch(e) {',
    '  document.getElementById("app").innerHTML = "<pre style=\'color:red;padding:20px\'>Vue Error: " + e.message + "</pre>";',
    '}',
    '<\/script>',
    '</body></html>'
  ];
  return parts.join('\n');
}

function wrapTypeScriptCDN(code) {
  const parts = [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="UTF-8"/>',
    '<script src="https://unpkg.com/typescript/lib/typescript.js"><\/script>',
    '</head><body>',
    '<div id="root"></div>',
    '<script>',
    'const tsCode = ' + JSON.stringify(code) + ';',
    'try {',
    '  const js = ts.transpileModule(tsCode, {',
    '    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None }',
    '  }).outputText;',
    '  const s = document.createElement("script");',
    '  s.textContent = js;',
    '  document.body.appendChild(s);',
    '} catch(e) {',
    '  document.body.innerHTML = "<pre style=\'color:red;padding:20px\'>TypeScript Error:\\n" + e.message + "</pre>";',
    '}',
    '<\/script>',
    '</body></html>'
  ];
  return parts.join('\n');
}

// Pending StackBlitz open data — set when Run is clicked, opened when banner btn clicked
let _sbPending = null;

function showStackBlitzBanner(files, type) {
  // Store the pending open data — NOT opened yet
  _sbPending = { files, type };

  document.getElementById('sbBanner')?.remove();

  const banner = document.createElement('div');
  banner.className = 'sb-banner';
  banner.id = 'sbBanner';
  banner.innerHTML = `
    <span class="sb-banner-icon">⚡</span>
    <div class="sb-banner-text">
      <div class="sb-banner-title">Ready to open in StackBlitz</div>
      <div class="sb-banner-sub">Click <strong>Open in StackBlitz</strong> to launch your project. Check the <strong>Terminal</strong> tab there for install progress &amp; dev server logs.</div>
    </div>
    <button class="sb-open-btn" onclick="confirmOpenStackBlitz()">
      ↗ Open in StackBlitz
    </button>
    <button class="sb-banner-close" onclick="dismissSBBanner()" title="Dismiss">✕</button>`;

  document.body.appendChild(banner);
}

function confirmOpenStackBlitz() {
  if (!_sbPending) return;
  const { files, type } = _sbPending;
  _sbPending = null;

  // Update banner to show launching state
  const btn = document.querySelector('.sb-open-btn');
  if (btn) { btn.textContent = '⏳ Launching…'; btn.disabled = true; }

  // Small delay so user sees the state change before tab opens
  setTimeout(() => {
    _doOpenStackBlitz(files, type);
    // Auto-dismiss banner after launch
    setTimeout(() => dismissSBBanner(), 2000);
  }, 300);
}

function dismissSBBanner() {
  const b = document.getElementById('sbBanner');
  if (!b) return;
  b.classList.add('hide');
  setTimeout(() => b.remove(), 280);
  _sbPending = null;
}

// Public: called by Run buttons — shows banner, does NOT open yet
function openInStackBlitz(files, type) {
  showStackBlitzBanner(files, type);
}

// Private: does the actual POST to StackBlitz — only called from banner button
function _doOpenStackBlitz(files, type) {

  // ── Collect file map ──────────────────────────────────────────
  const fileMap = {};
  for (const [path, info] of Object.entries(files)) {
    if (info && info.content) fileMap[path] = info.content;
  }
  const allPaths   = Object.keys(fileMap);
  const allContent = Object.values(fileMap).join('\n');

  // ── Detect project structure ──────────────────────────────────
  const hasServerDir  = allPaths.some(p => p.startsWith('server/'));
  const hasClientDir  = allPaths.some(p => p.startsWith('client/'));
  const hasSrcDir     = allPaths.some(p => p.startsWith('src/'));
  const isFullstack   = hasServerDir && (hasClientDir || hasSrcDir);

  // Find the real server entry point
  const serverEntry =
    allPaths.find(p => p === 'server/index.js') ||
    allPaths.find(p => p === 'server/app.js')   ||
    allPaths.find(p => p === 'server/server.js') ||
    allPaths.find(p => p === 'index.js')         ||
    allPaths.find(p => p === 'app.js')           ||
    allPaths.find(p => p.endsWith('/index.js'))  ||
    'index.js';

  // Find client entry
  const clientEntry =
    allPaths.find(p => p === 'client/src/index.jsx') ||
    allPaths.find(p => p === 'client/src/main.jsx')  ||
    allPaths.find(p => p === 'src/index.jsx')        ||
    allPaths.find(p => p === 'src/main.jsx')         ||
    allPaths.find(p => p === 'src/index.js')         ||
    null;

  // ── Smart package.json patching ───────────────────────────────
  // Parse existing root package.json or create from scratch
  let rootPkg = {};
  if (fileMap['package.json']) {
    try { rootPkg = JSON.parse(fileMap['package.json']); } catch(e) { rootPkg = {}; }
  }

  const deps    = rootPkg.dependencies    || {};
  const devDeps = rootPkg.devDependencies || {};

  // Auto-detect missing deps from code content
  const needs = (lib) => allContent.includes(lib) && !deps[lib] && !devDeps[lib];
  if (needs('express'))    deps['express']    = 'latest';
  if (needs('cors'))       deps['cors']       = 'latest';
  if (needs('mongoose'))   deps['mongoose']   = 'latest';
  if (needs('dotenv'))     deps['dotenv']     = 'latest';
  if (needs('axios'))      deps['axios']      = 'latest';
  if (needs('react-router')) deps['react-router-dom'] = 'latest';
  if (type === 'nextjs' || needs('next')) {
    deps['next'] = deps['next'] || 'latest';
    deps['react'] = deps['react'] || 'latest';
    deps['react-dom'] = deps['react-dom'] || 'latest';
  }
  if (type === 'react-npm' && !deps['react']) {
    deps['react'] = '^18'; deps['react-dom'] = '^18';
  }
  if (type === 'vue' && !deps['vue']) deps['vue'] = '^3';

  // Fix the start script to point to actual entry point
  const scripts = rootPkg.scripts || {};
  if (!scripts.start || scripts.start === 'node index.js') {
    if (type === 'nextjs') {
      scripts.dev = 'next dev'; scripts.build = 'next build'; scripts.start = 'next start';
    } else if (isFullstack || type === 'node') {
      scripts.start = `node ${serverEntry}`;
      scripts.dev   = `node ${serverEntry}`;
    } else if (type === 'react-npm') {
      scripts.dev = 'vite'; scripts.build = 'vite build'; scripts.start = 'vite';
    } else if (type === 'vue') {
      scripts.dev = 'vite'; scripts.build = 'vite build'; scripts.start = 'vite';
    } else {
      scripts.start = `node ${serverEntry}`;
    }
  }

  // Merge any sub-package.json deps into root (StackBlitz only reads root package.json)
  for (const path of allPaths) {
    if (path !== 'package.json' && path.endsWith('package.json')) {
      try {
        const sub = JSON.parse(fileMap[path]);
        Object.assign(deps,    sub.dependencies    || {});
        Object.assign(devDeps, sub.devDependencies || {});
      } catch(e) {}
    }
  }

  // Write final root package.json
  fileMap['package.json'] = JSON.stringify({
    ...rootPkg,
    name:           rootPkg.name || 'ai-generated-project',
    version:        rootPkg.version || '1.0.0',
    private:        true,
    scripts,
    dependencies:   deps,
    devDependencies: devDeps
  }, null, 2);

  // ── Vite boilerplate for React/Vue ────────────────────────────
  if (type === 'react-npm') {
    devDeps['vite'] = devDeps['vite'] || 'latest';
    devDeps['@vitejs/plugin-react'] = devDeps['@vitejs/plugin-react'] || 'latest';

    if (!fileMap['index.html']) {
      const entry = clientEntry || 'src/main.jsx';
      fileMap['index.html'] = [
        '<!DOCTYPE html><html lang="en"><head>',
        '<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>',
        '<title>React App</title></head>',
        `<body><div id="root"></div><script type="module" src="/${entry}"><\/script></body></html>`
      ].join('');
    }
    if (!fileMap['vite.config.js'] && !fileMap['vite.config.ts']) {
      fileMap['vite.config.js'] = [
        "import { defineConfig } from 'vite';",
        "import react from '@vitejs/plugin-react';",
        "export default defineConfig({ plugins: [react()] });"
      ].join('\n');
    }
  }

  if (type === 'vue') {
    devDeps['vite'] = devDeps['vite'] || 'latest';
    devDeps['@vitejs/plugin-vue'] = devDeps['@vitejs/plugin-vue'] || 'latest';
    if (!fileMap['index.html']) {
      fileMap['index.html'] = [
        '<!DOCTYPE html><html lang="en"><head>',
        '<meta charset="UTF-8"/><title>Vue App</title></head>',
        '<body><div id="app"></div><script type="module" src="/src/main.js"><\/script></body></html>'
      ].join('');
    }
    if (!fileMap['vite.config.js']) {
      fileMap['vite.config.js'] = [
        "import { defineConfig } from 'vite';",
        "import vue from '@vitejs/plugin-vue';",
        "export default defineConfig({ plugins: [vue()] });"
      ].join('\n');
    }
  }

  // ── Build and submit form ─────────────────────────────────────
  // StackBlitz template: node works for all server/fullstack, create-react-app for pure React
  const sbTemplate = (type === 'react-npm' && !isFullstack) ? 'node'
                   : type === 'typescript' ? 'typescript'
                   : 'node';

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://stackblitz.com/run';
  form.target = '_blank';
  form.style.display = 'none';

  // Add files
  for (const [path, content] of Object.entries(fileMap)) {
    const inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = `project[files][${path}]`;
    inp.value = content;
    form.appendChild(inp);
  }

  // Metadata
  const allDeps = { ...deps, ...devDeps };
  const meta = {
    'project[title]':        rootPkg.name || 'AI Generated Project',
    'project[description]':  'Generated by Qrox',
    'project[template]':     sbTemplate,
    'project[dependencies]': JSON.stringify(allDeps),
  };
  for (const [name, value] of Object.entries(meta)) {
    const inp = document.createElement('input');
    inp.type = 'hidden'; inp.name = name; inp.value = value;
    form.appendChild(inp);
  }

  document.body.appendChild(form);

  // Delay submit so banner is visible and readable before StackBlitz opens
  setTimeout(() => {
    form.submit();
    setBuildStatus('ready', 'Opened in StackBlitz');
    setTimeout(() => document.body.removeChild(form), 2000);
  }, 2500);
}

function loadPreview(html) {
  const frame = document.getElementById('prevFrame');
  const blob  = new Blob([html], {type:'text/html'});
  frame.src   = URL.createObjectURL(blob);
  showDeviceShell();
  document.getElementById('prevDot').className = 'main-tab-dot';
  setBuildStatus('ready','Live');
}

function refreshPreview() { runPreview(); }

function openExternal() {
  // Build the same inlined code runPreview would generate
  const fw = S.framework || 'html-single';
  if (FW_SB.has(fw)) { showToast('StackBlitz project — use the Run button','inf'); return; }
  const tree = S.fileTree;
  const keys = Object.keys(tree);
  let code = '';
  if (keys.length) {
    const htmlFile = keys.find(k => k.endsWith('.html'));
    const cssFiles = Object.entries(tree).filter(([k]) => k.endsWith('.css'));
    const jsFiles  = Object.entries(tree).filter(([k]) => k.endsWith('.js') && !k.endsWith('.min.js'));
    if (htmlFile) {
      code = tree[htmlFile].content;
      cssFiles.forEach(([path, info]) => {
        const fname = path.split('/').pop().replace(/\./g,'[.]');
        const re = new RegExp('<link[^>]+' + fname + '[^>]*>', 'gi');
        code = re.test(code)
          ? code.replace(re, '<style>' + info.content + '<\/style>')
          : code.replace('<\/head>', '<style>' + info.content + '<\/style><\/head>');
      });
      jsFiles.forEach(([path, info]) => {
        const fname = path.split('/').pop().replace(/\./g,'[.]');
        const re = new RegExp('<script[^>]+' + fname + '[^>]*>\s*<\/script>', 'gi');
        code = re.test(code)
          ? code.replace(re, '<script>' + info.content + '<\/script>')
          : code.replace('<\/body>', '<script>' + info.content + '<\/script><\/body>');
      });
    } else {
      const cssAll = cssFiles.map(([,v]) => '<style>' + v.content + '<\/style>').join('');
      const jsAll  = jsFiles.map(([,v]) => '<script>' + v.content + '<\/script>').join('');
      code = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' + cssAll + '<\/head><body>' + jsAll + '<\/body><\/html>';
    }
  } else if (S.previewHtml) {
    code = S.previewHtml;
  }
  if (!code) { showToast('Nothing to open','wrn'); return; }
  const blob = new Blob([code], {type:'text/html'});
  window.open(URL.createObjectURL(blob), '_blank');
}
function setPreviewSize(size, btn) {
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  S._previewSize = size;

  const shell  = document.getElementById('deviceShell');
  const screen = document.getElementById('deviceScreen');
  const frame  = document.getElementById('prevFrame');

  // Remove all size classes
  shell.className = 'device-shell sz-' + size;

  // Iframe always fills the device screen
  frame.style.cssText = 'width:100%;height:100%;border:none;display:block';

  // For desktop — screen fills pane fully
  if (size === 'desktop') {
    screen.style.cssText = 'width:100%;height:100%;border-radius:0;overflow:hidden;background:#000';
  } else {
    screen.style.cssText = 'overflow:hidden;background:#000';
  }

  const labels = {
    desktop: 'Desktop',
    laptop:  'Laptop · 1280px',
    tablet:  'Tablet · 768px',
    mobilel: 'Landscape · 667×375',
    mobile:  'Mobile · 390px',
  };
  document.getElementById('prevUrl').value = labels[size] || size;
}

function showDeviceShell() {
  document.getElementById('prevPlaceholder').style.display = 'none';
  document.getElementById('deviceShell').style.display = 'flex';
  // Apply current size
  const btn = document.querySelector('.size-btn.on');
  if (btn) setPreviewSize(S._previewSize || 'desktop', btn);
}

// ════════════════════════════════════════════
