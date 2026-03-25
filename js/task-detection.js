// ════════════════════════════════════════════
//  TASK DETECTION AUTO-INTELLIGENCE  v5
//
//  detectIntent(text, opts) → { key, conf, scores }
//  ─────────────────────────────────────────────
//  Multi-signal scoring across all 8 task types.
//  Each signal group has weighted keyword sets,
//  structural patterns (?, code blocks, URLs,
//  math symbols), and context signals (build mode,
//  attached files, conversation history).
//
//  Returns the winning task key + confidence 0–1
//  plus full score breakdown for the badge.
//
//  intentBadgeUpdate() — debounced on every
//  keystroke, shows a live colour-coded badge
//  with confidence bar. Click badge to override.
// ════════════════════════════════════════════

const INTENT_META = {
  coding:     { icon:'💻', color:'#34d399', bg:'rgba(52,211,153,.15)',  border:'rgba(52,211,153,.4)'  },
  thinking:   { icon:'🧠', color:'#60a5fa', bg:'rgba(96,165,250,.15)',  border:'rgba(96,165,250,.4)'  },
  writing:    { icon:'✍️', color:'#fb923c', bg:'rgba(251,146,60,.15)',  border:'rgba(251,146,60,.4)'  },
  math:       { icon:'📊', color:'#22d3ee', bg:'rgba(34,211,238,.15)',  border:'rgba(34,211,238,.4)'  },
  chat:       { icon:'💬', color:'#f472b6', bg:'rgba(244,114,182,.15)', border:'rgba(244,114,182,.4)' },
  vision:     { icon:'👁',  color:'#f59e0b', bg:'rgba(245,158,11,.15)',  border:'rgba(245,158,11,.4)'  },
  designcode: { icon:'🎨', color:'#818cf8', bg:'rgba(129,140,248,.15)', border:'rgba(129,140,248,.4)' },
  debug:      { icon:'🐛', color:'#ef4444', bg:'rgba(239,68,68,.15)',   border:'rgba(239,68,68,.4)'   },
};

// Keyword signal groups — each entry: [keywords, weight]
const INTENT_SIGNALS = {
  coding: [
    [['build','create','make','implement','develop','code','program','write a','generate a','scaffold','bootstrap'], 2.5],
    [['function','class','component','module','api','endpoint','route','controller','hook','middleware'], 2.0],
    [['html','css','javascript','typescript','python','react','vue','node','express','next','svelte','django','flask'], 2.5],
    [['add feature','fix bug','update the','refactor','optimize','extend','enhance'], 1.8],
    [['```','<div','<html','const ','let ','var ','def ','import ','from '], 2.0],
  ],
  debug: [
    [['bug','error','fix','broken','crash','issue','problem','not working','fails','exception','undefined','null','TypeError','ReferenceError','SyntaxError'], 3.0],
    [['debug','diagnose','trace','stack trace','console.log','why does','what\'s wrong'], 2.5],
    [['can\'t','cannot','doesn\'t work','won\'t','isn\'t','unexpected','weird behavior'], 1.5],
  ],
  thinking: [
    [['architect','design system','plan','strategy','approach','best practice','trade-off','should i','which is better','compare','pros and cons'], 2.5],
    [['explain','how does','why does','what is','understand','concept','theory','principle','pattern'], 2.0],
    [['analyze','analyse','evaluate','assess','review','audit','critique'], 2.0],
    [['complex','deep dive','thorough','detailed','comprehensive'], 1.5],
  ],
  writing: [
    [['write','draft','compose','create a','generate a','essay','article','blog','post','story','narrative','letter','email','report','doc','documentation'], 2.5],
    [['summarize','summarise','summary','tldr','tl;dr','condense','paraphrase','rewrite','rephrase'], 2.5],
    [['tone','formal','casual','professional','creative','persuasive','concise'], 2.0],
    [['paragraph','sentence','word count','introduction','conclusion','section'], 1.5],
  ],
  math: [
    [['calculate','compute','solve','equation','formula','integral','derivative','probability','statistics','regression','matrix','vector','algorithm','complexity'], 3.0],
    [['=','∫','∑','√','π','×','÷','²','³','≤','≥','≠'], 2.5],
    [['math','algebra','calculus','geometry','trigonometry','linear algebra','number theory','discrete'], 2.5],
    [['what is','how much','how many','find the','prove that','show that'], 1.5],
  ],
  chat: [
    [['hi','hello','hey','thanks','thank you','what do you think','opinion','recommend','suggest','advice','help me understand'], 2.0],
    [['tell me','can you','could you','would you','i\'m curious','i wonder','what\'s your','do you know'], 1.5],
    [['weather','news','fun fact','joke','trivia'], 2.0],
  ],
};

// Structural pattern detectors — return 0–1
function _detectStructural(text) {
  const sigs = {};
  const hasCode   = /```[\s\S]*?```|`[^`]+`/.test(text);
  const hasUrl    = /https?:\/\/[^\s]+/.test(text);
  const hasMath   = /[=∫∑√π×÷²³≤≥≠]|\b\d+[\+\-\*\/]\d+/.test(text);
  const hasQ      = text.trimEnd().endsWith('?');
  const hasError  = /error:|exception:|traceback|at line \d|\.js:\d|\.py:\d/i.test(text);
  const hasLong   = text.length > 400;
  const hasShort  = text.length < 60;
  const wordCount = text.split(/\s+/).length;

  if (hasCode)  { sigs.coding  = (sigs.coding  || 0) + 2.0; }
  if (hasUrl)   { sigs.chat    = (sigs.chat    || 0) + 0.5; sigs.thinking = (sigs.thinking||0) + 0.5; }
  if (hasMath)  { sigs.math    = (sigs.math    || 0) + 2.5; }
  if (hasError) { sigs.debug   = (sigs.debug   || 0) + 3.0; }
  if (hasQ && hasShort) { sigs.chat = (sigs.chat || 0) + 1.5; }
  if (hasLong)  { sigs.writing = (sigs.writing || 0) + 1.0; sigs.thinking = (sigs.thinking||0) + 0.5; }
  return sigs;
}

function detectIntent(text, opts = {}) {
  const lower   = text.toLowerCase();
  const words   = lower.split(/\s+/);
  const scores  = { coding:0, debug:0, thinking:0, writing:0, math:0, chat:0, vision:0, designcode:0 };

  // 1. Keyword signals
  for (const [taskKey, groups] of Object.entries(INTENT_SIGNALS)) {
    for (const [keywords, weight] of groups) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          scores[taskKey] = (scores[taskKey] || 0) + weight;
          break; // only count each group once
        }
      }
    }
  }

  // 2. Structural patterns
  const structural = _detectStructural(text);
  for (const [k, v] of Object.entries(structural)) {
    scores[k] = (scores[k] || 0) + v;
  }

  // 3. Context boosts
  if (opts.buildMode) {
    scores.coding   += 2.0;
    scores.debug    += 0.5;
  }
  if (opts.hasImages) {
    scores.vision   += 5.0;
    scores.designcode += opts.buildMode ? 4.0 : 2.0;
  }
  if (opts.hasFiles) {
    scores.thinking += 1.0;
    scores.writing  += 0.5;
  }
  // Conversation history: if we're mid-build-session, boost coding
  if (opts.historyLen > 2 && opts.buildMode) {
    scores.coding += 1.5;
  }

  // 4. Merge debug into coding (debug IS a coding subtask — just uses thinking models)
  // Keep debug separate for model routing but show as a variant
  const debugScore = scores.debug || 0;
  if (debugScore > scores.coding) scores.coding = (scores.coding + debugScore) / 2;

  // Normalize: pick winner
  const total = Object.values(scores).reduce((a,b) => a+b, 0) || 1;
  const norm  = {};
  for (const [k,v] of Object.entries(scores)) norm[k] = v / total;

  // Winner
  let winner = 'chat', best = 0;
  for (const [k,v] of Object.entries(norm)) {
    if (v > best) { best = v; winner = k; }
  }

  // Map debug → thinking for model routing
  const routeKey = winner === 'debug' ? 'thinking' : winner;

  return {
    key:      winner,
    routeKey: routeKey,
    conf:     best,
    scores:   norm,
    rawScores:scores,
  };
}

// ── Intent badge UI ──────────────────────────────────────────
const INTENT_STATE = {
  detected: null,   // last detected intent result
  override: null,   // user manually overrode to this taskKey
  debounce: null,
};

// Task key cycle order for manual override
const INTENT_CYCLE = ['chat','coding','thinking','writing','math','vision','designcode'];

function intentBadgeUpdate(text) {
  clearTimeout(INTENT_STATE.debounce);
  if (!text?.trim() || text.length < 4) {
    document.getElementById('intentBadgeWrap').classList.remove('show');
    INTENT_STATE.detected = null;
    return;
  }
  INTENT_STATE.debounce = setTimeout(() => {
    const opts = {
      buildMode:  S.opts?.build || false,
      hasImages:  S.attached?.some(f => f.isImage) || false,
      hasFiles:   S.attached?.some(f => !f.isImage) || false,
      historyLen: S.msgs?.length || 0,
    };
    const result = detectIntent(text, opts);
    INTENT_STATE.detected = result;
    _intentBadgeRender();
  }, 180);
}

function _intentBadgeRender() {
  const wrap   = document.getElementById('intentBadgeWrap');
  const badge  = document.getElementById('intentBadge');
  const hint   = document.getElementById('intentOverrideHint');
  if (!wrap || !badge) return;

  const activeKey = INTENT_STATE.override || INTENT_STATE.detected?.key || 'chat';
  const meta      = INTENT_META[activeKey] || INTENT_META.chat;
  const conf      = INTENT_STATE.override ? 1.0 : (INTENT_STATE.detected?.conf || 0);
  const taskLabel = TASK_CATALOG[activeKey]?.label || activeKey;
  const barW      = Math.round(conf * 36); // max 36px bar

  badge.style.cssText = `background:${meta.bg};border-color:${meta.border};color:${meta.color}`;
  badge.innerHTML = `${meta.icon} ${taskLabel}<span class="intent-conf-bar" style="width:${barW}px;background:${meta.color};opacity:.6"></span>`;
  badge.classList.toggle('override', !!INTENT_STATE.override);
  badge.title = INTENT_STATE.override
    ? `Overridden to ${taskLabel} — click to cycle, × to clear`
    : `Auto-detected: ${taskLabel} (${Math.round(conf*100)}% confidence) — click to override`;

  hint.style.display = INTENT_STATE.override ? '' : 'none';
  wrap.classList.add('show');
}

function intentCycleOverride() {
  const current = INTENT_STATE.override || INTENT_STATE.detected?.key || 'chat';
  const idx     = INTENT_CYCLE.indexOf(current);
  const next    = INTENT_CYCLE[(idx + 1) % INTENT_CYCLE.length];
  INTENT_STATE.override = next;
  _intentBadgeRender();
  showToast(`Task overridden → ${TASK_CATALOG[next]?.label || next}`, 'inf');
}

function intentClearOverride() {
  INTENT_STATE.override = null;
  _intentBadgeRender();
}

// Returns the active task key (override or detected)
function intentGetKey(fallback = 'chat') {
  return INTENT_STATE.override || INTENT_STATE.detected?.routeKey || fallback;
}

