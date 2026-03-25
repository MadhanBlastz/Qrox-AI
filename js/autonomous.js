// ════════════════════════════════════════════
//  AGENT CONFIDENCE SCORING  v5
//  Analyses each agent's output for role-
//  specific quality signals and returns a
//  0–100 score with label, colour, and a
//  human-readable breakdown for the tooltip.
// ════════════════════════════════════════════

const CONF_SIGNALS = {
  planner: {
    required: [
      { kw:['## 📋','requirements','requirement'],       pts:18, label:'Requirements section' },
      { kw:['## 🏗','architecture','component'],         pts:16, label:'Architecture section' },
      { kw:['## 📁','file structure','index.html'],      pts:14, label:'File structure listed' },
      { kw:['## 🎨','design','color','#'],               pts:14, label:'Design guidelines' },
      { kw:['## ⚙','feature','implement'],               pts:14, label:'Features listed' },
    ],
    bonus: [
      { kw:['non-functional','accessibility','performance'], pts:8, label:'Non-functional reqs' },
      { kw:['priority','numbered','order'],                  pts:8, label:'Prioritised features' },
    ],
    penalise: [
      { kw:['```html','<div','<style>','function ','const '], pts:-20, label:'Contains code (violation)' },
    ],
  },
  designer: {
    required: [
      { kw:['#','hex','rgba','color'],                    pts:20, label:'Colour values' },
      { kw:['font','typography','weight','size'],         pts:16, label:'Typography spec' },
      { kw:['spacing','padding','margin','grid'],         pts:14, label:'Spacing & layout' },
      { kw:['button','card','input','nav','component'],   pts:14, label:'Component specs' },
      { kw:['hover','focus','active','state'],            pts:12, label:'Interaction states' },
    ],
    bonus: [
      { kw:['transition','animation','easing','duration'],   pts:8, label:'Animations defined' },
      { kw:['mobile','responsive','breakpoint'],             pts:8, label:'Responsive notes' },
    ],
    penalise: [
      { kw:['```html','```css','```js','<div','function '],   pts:-20, label:'Contains code (violation)' },
    ],
  },
  developer: {
    required: [
      { kw:['```html','```css','```javascript','```js'],  pts:20, label:'Code blocks present' },
      { kw:['<!DOCTYPE','<html','<head','<body'],         pts:16, label:'Complete HTML structure' },
      { kw:['<\/style>','<style>','css'],                 pts:12, label:'Styles included' },
      { kw:['<\/script>','<script>','function','const '], pts:12, label:'JS logic included' },
      { kw:['responsive','@media','flex','grid'],         pts:10, label:'Responsive layout' },
    ],
    bonus: [
      { kw:['try','catch','error','handle'],              pts:6,  label:'Error handling' },
      { kw:['placeholder','aria','role=','tabindex'],     pts:6,  label:'Accessibility' },
      { kw:['animation','transition','transform'],        pts:6,  label:'Animations' },
    ],
    penalise: [
      { kw:['todo','fixme','placeholder','coming soon','...'],  pts:-12, label:'Incomplete placeholders' },
      { kw:['lorem ipsum'],                                     pts:-10, label:'Lorem ipsum text' },
    ],
  },
  tester: {
    required: [
      { kw:['completeness','feature','implement'],        pts:18, label:'Completeness check' },
      { kw:['design','color','font','layout','match'],    pts:16, label:'Design match check' },
      { kw:['responsive','mobile','tablet'],              pts:14, label:'Responsiveness check' },
      { kw:['verdict:','verdict: pass','verdict: fail'],  pts:20, label:'Clear verdict given' },
      { kw:['### review','### issues','issue'],           pts:14, label:'Structured review' },
    ],
    bonus: [
      { kw:['score','rating','quality','ux'],             pts:8,  label:'Quality rating' },
    ],
    penalise: [],
  },
  devops: {
    required: [
      { kw:['readme','# '],                               pts:22, label:'README present' },
      { kw:['package.json','dependencies','scripts'],     pts:18, label:'Package config' },
      { kw:['deploy','vercel','netlify','docker','ci'],   pts:18, label:'Deployment config' },
    ],
    bonus: [
      { kw:['.env','environment','variable'],             pts:10, label:'.env example' },
      { kw:['badge','shield','license'],                  pts:8,  label:'README badges' },
    ],
    penalise: [],
  },
};

function scoreAgentOutput(agentId, text) {
  const signals = CONF_SIGNALS[agentId];
  if (!signals) return { score:70, label:'70%', level:'med', detail:'No scoring rules for this agent.' };

  const lower = text.toLowerCase();
  let score = 0;
  const maxPossible = signals.required.reduce((s, r) => s + r.pts, 0)
                    + signals.bonus.reduce((s, b) => s + b.pts, 0);
  const hits = [];
  const misses = [];
  const penalties = [];

  // Required signals
  for (const sig of signals.required) {
    const found = sig.kw.some(k => lower.includes(k.toLowerCase()));
    if (found) { score += sig.pts; hits.push('✅ ' + sig.label); }
    else        { misses.push('❌ ' + sig.label); }
  }
  // Bonus signals
  for (const sig of signals.bonus) {
    if (sig.kw.some(k => lower.includes(k.toLowerCase()))) {
      score += sig.pts;
      hits.push('⭐ ' + sig.label);
    }
  }
  // Penalties
  for (const sig of (signals.penalise || [])) {
    if (sig.kw.some(k => lower.includes(k.toLowerCase()))) {
      score += sig.pts; // pts are negative
      penalties.push('⚠ ' + sig.label);
    }
  }

  // Normalise to 0–100
  score = Math.max(0, Math.min(100, Math.round((score / maxPossible) * 100)));

  // Length bonus: very short outputs are suspicious
  const words = text.trim().split(/\s+/).length;
  if (words < 60)  score = Math.max(0, score - 15);
  else if (words > 300) score = Math.min(100, score + 5);

  const level = score >= 75 ? 'high' : score >= 45 ? 'med' : 'low';
  const emoji = level === 'high' ? '🟢' : level === 'med' ? '🟡' : '🔴';
  const label = score + '%';

  const allLines = [...hits, ...penalties, ...misses].slice(0, 8);
  const detail   = allLines.join('\n') || 'No signals detected.';

  return { score, label, level, emoji, detail, words };
}

function buildConfBadge(agentId, text) {
  const { score, label, level, emoji, detail, words } = scoreAgentOutput(agentId, text);
  const barW = score;
  const barColor = level === 'high' ? '#10b981' : level === 'med' ? '#f59e0b' : '#ef4444';
  const tooltipLines = detail.split('\n').map(l => esc(l)).join('<br>');
  return `<span class="conf-badge conf-${level}" title="">
    <span class="conf-badge-bar" style="width:${barW * 0.4}px;background:${barColor};min-width:4px"></span>
    ${emoji} ${label}
    <span class="conf-tooltip">
      <strong>Confidence: ${label}</strong><br>
      ${tooltipLines}<br>
      <span style="color:var(--t4);font-size:.6rem">${words} words</span>
    </span>
  </span>`;
}

function evaluateTesterVerdict(output) {
  const lower = output.toLowerCase();
  const failKw = ['fail','issue','bug','problem','missing','incorrect','broken','error','not match','not responsive','ugly','plain','needs fix','fix required'];
  const passKw = ['pass','approved','looks good','well done','excellent','complete'];
  const hasFail = failKw.some(k => lower.includes(k));
  const hasPass = passKw.some(k => lower.includes(k));
  const issuesMatch = output.match(/ISSUES?:\s*([\s\S]*?)(?:\n\n|\nVERDICT|$)/i);
  const issues = issuesMatch ? issuesMatch[1].trim() : output.slice(0, 400);
  if (lower.includes('verdict: pass') || lower.includes('verdict:pass')) return { pass:true, issues:'' };
  if (lower.includes('verdict: fail') || lower.includes('verdict:fail')) return { pass:false, issues };
  return { pass: hasPass && !hasFail, issues };
}

function agentsExport() {
  const agents = PIPELINES[AG.pipeline] || [];
  let md = '# Multi-Agent Pipeline Output\n\n';
  md += '**Task:** ' + AG.task + '\n**Pipeline:** ' + AG.pipeline + '\n\n---\n\n';
  agents.forEach(id => {
    const def = AGENT_DEFS[id];
    const res = AG.results[id];
    if (!res?.output) return;
    md += '## ' + def.icon + ' ' + def.name + '\n\n' + res.output + '\n\n---\n\n';
  });
  dlF('agent-pipeline-output.md', md);
  showToast('Pipeline exported', 'ok');
}

function agentsClear() {
  AG.results = {};
  AG.running = false;
  renderAgentFlow();
}

function openVault(tab='keys'){renderPG();renderPrioList();syncVaultUI();renderRoutingCards();document.getElementById('vaultOv').classList.add('open');vTab(document.querySelector(`.vtab[data-tab="${tab}"]`),tab);}
function closeVault(){document.getElementById('vaultOv').classList.remove('open');}
function vTab(el,tab){document.querySelectorAll('.vtab').forEach(t=>t.classList.remove('on'));if(el)el.classList.add('on');['keys','routing','priority','vsettings'].forEach(t=>{document.getElementById('tab-'+t).style.display=t===tab?'':'none';});}
function renderPG(){
  const TIERS = [
    {
      key:'free',
      label:'Free',
      dot:'tier-dot-free',
      badge:'tier-free',
      icon:'🆓',
      desc:'No API key required — works out of the box'
    },
    {
      key:'freemium',
      label:'Free Limited + Paid',
      dot:'tier-dot-freemium',
      badge:'tier-freemium',
      icon:'⚡',
      desc:'Free tier on sign-up · Unlock more with a paid key'
    },
    {
      key:'paid',
      label:'Paid',
      dot:'tier-dot-paid',
      badge:'tier-paid',
      icon:'💳',
      desc:'Pay-per-use · API key required'
    }
  ];

  function mkCard(prov) {
    const hk = !!S.keys[prov.id];
    const ia = S.currentModel?.provId === prov.id;
    const corsOk = prov.browserOk !== false;
    const usable = (hk || prov.worksNoKey) && corsOk;
    const statusTxt = hk ? (corsOk?'✓ ready':'key saved') : prov.worksNoKey ? '✓ free' : 'no key';
    const statusCls = usable ? (prov.worksNoKey?'psfree':'pscfg') : 'psnone';
    const placeholder = prov.worksNoKey ? 'No key needed — works now!' : 'Paste API key…';
    const corsWarn = !corsOk ? `<div style="margin-top:6px;font-size:.63rem;padding:5px 8px;border-radius:6px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);color:#fde68a;line-height:1.6">⚠ CORS blocked in browser — direct calls will fail. Add key to <strong>OpenRouter</strong> to access this provider's models through it.</div>` : '';
    return `
      <div class="pcard ${hk&&corsOk?'cfg':''} ${ia?'actv':''}">
        <div class="pstat">
          <div class="psdot ${statusCls}"></div>
          <span style="font-size:.59rem;color:var(--t3)">${statusTxt}</span>
        </div>
        <div class="pcardtop">
          <div class="plogo" style="background:${prov.bg}">${prov.logo}</div>
          <div>
            <div class="pn">${prov.name} ${corsOk?'<span style="font-size:.55rem;padding:1px 5px;border-radius:4px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.2);color:#6ee7b7;font-family:var(--fh);font-weight:700">CORS OK</span>':'<span style="font-size:.55rem;padding:1px 5px;border-radius:4px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);color:#fde68a;font-family:var(--fh);font-weight:700">CORS ⚠</span>'}</div>
            <div class="ps">${prov.desc}</div>
          </div>
        </div>
        <div class="pmods">${prov.models.map(m=>`<span class="pmtag">${m.name}</span>`).join('')}</div>
        <div class="pkrow">
          <input class="pkin" type="password" id="k-${prov.id}"
            placeholder="${placeholder}"
            value="${hk?'●'.repeat(Math.min((S.keys[prov.id]||'').length,20)):''}"
            onfocus="this.type='text';this.value=S.keys['${prov.id}']||''"
            onblur="this.type='password'"/>
          <button class="ksbtn" onclick="saveKey('${prov.id}')">Save</button>
          ${hk?`<button class="kclr" onclick="clearKey('${prov.id}')">✕</button>`:''}
        </div>
        ${prov.freeNote?`<div class="pfreetag">🆓 ${prov.freeNote}</div>`:''}
        ${corsWarn}
        ${ia?`<div style="margin-top:7px;font-size:.62rem;color:var(--a1);font-family:var(--fc)">● Currently active</div>`:''}
      </div>`;
  }

  let html = '';
  for (const tier of TIERS) {
    const group = PROVS.filter(p => p.tier === tier.key);
    if (!group.length) continue;
    const configured = group.filter(p => !!S.keys[p.id] || p.worksNoKey).length;
    html += `
      <div class="tier-section">
        <div class="tier-hdr">
          <span class="tier-badge ${tier.badge}">
            <span class="tier-dot ${tier.dot}"></span>
            ${tier.icon} ${tier.label}
          </span>
          <span class="tier-desc">${tier.desc}</span>
          <span class="tier-count">${configured}/${group.length} ready</span>
        </div>
        <div class="pgrid">${group.map(mkCard).join('')}</div>
      </div>`;
  }
  document.getElementById('pgrid-root').innerHTML = html;
}
function saveKey(id){const el=document.getElementById('k-'+id);const raw=el.value.trim();const v=raw.replace(/[^\x20-\x7E]/g,'').trim();if(!v){showToast('Enter a key first','wrn');return;}if(v!==raw)showToast('Non-ASCII characters removed from key','wrn');S.keys[id]=v;localStorage.setItem('eai_keys',JSON.stringify(S.keys));selectBest(S.mode);renderPG();renderPrioList();showToast(`${PROVS.find(p=>p.id===id)?.name} key saved!`,'ok');}
function clearKey(id){delete S.keys[id];localStorage.setItem('eai_keys',JSON.stringify(S.keys));selectBest(S.mode);renderPG();renderPrioList();refreshPickerIfOpen();showToast('Key removed','inf');}
function renderPrioList(){
  const TIER_COLORS = {free:'#10b981', freemium:'#f59e0b', paid:'#ef4444'};
  const TIER_LABELS = {free:'FREE', freemium:'FREEMIUM', paid:'PAID'};
  document.getElementById('prioList').innerHTML=S.priority.map((e,i)=>{
    const prov=PROVS.find(p=>p.id===e.id); if(!prov) return '';
    const avail=!!S.keys[prov.id]||prov.worksNoKey;
    const bm=prov.models.find(m=>m.best.includes(S.mode))||prov.models[0];
    const tc = TIER_COLORS[prov.tier]||'#6366f1';
    const tl = TIER_LABELS[prov.tier]||'';
    return `<div class="priitem" draggable="true" data-i="${i}" ondragstart="ds(event,${i})" ondragover="dov(event)" ondrop="ddr(event,${i})">
      <div class="prinum">${i+1}</div>
      <div class="plogo" style="width:28px;height:28px;border-radius:6px;font-size:.9rem;display:flex;align-items:center;justify-content:center;background:${prov.bg}">${prov.logo}</div>
      <div style="flex:1;min-width:0">
        <div class="priname">${prov.name}</div>
        <div class="primod" style="display:flex;align-items:center;gap:5px">
          <span style="font-size:.58rem;padding:1px 5px;border-radius:6px;font-weight:700;font-family:var(--fh);background:rgba(${hexRgb(tc)},.13);border:1px solid rgba(${hexRgb(tc)},.3);color:${tc}">${tl}</span>
          <span>${bm.name}</span>
        </div>
      </div>
      <span class="pribadge ${avail&&e.on?'pri-ok':'pri-no'}">${avail&&e.on?'ACTIVE':'OFF'}</span>
      <button class="pritog ${e.on?'on':''}" onclick="togP(${i})"></button>
    </div>`;
  }).join('');
}
function togP(i){S.priority[i].on=!S.priority[i].on;localStorage.setItem('eai_priority',JSON.stringify(S.priority));selectBest(S.mode);renderPrioList();renderPG();refreshPickerIfOpen();}
function refreshPickerIfOpen(){const p=document.getElementById('mpickOverlay');if(p&&p.classList.contains('open'))renderModelPicker();}
let di=null;
function ds(e,i){di=i;e.dataTransfer.effectAllowed='move';}
function dov(e){e.preventDefault();}
function ddr(e,i){e.preventDefault();if(di===null||di===i)return;const a=[...S.priority];const[x]=a.splice(di,1);a.splice(i,0,x);S.priority=a;localStorage.setItem('eai_priority',JSON.stringify(S.priority));selectBest(S.mode);renderPrioList();di=null;}
function syncVaultUI(){document.getElementById('vTokens').value=S.settings.maxTokens;document.getElementById('vPersona').value=S.settings.persona;}
function saveVaultSettings(){S.settings.maxTokens=parseInt(document.getElementById('vTokens').value)||4096;S.settings.persona=document.getElementById('vPersona').value.trim();localStorage.setItem('eai_settings',JSON.stringify(S.settings));closeVault();wsRenderProviders();renderHealthTooltip();showToast('Settings saved!','ok');}

