// ════════════════════════════════════════════
//  CUSTOM PERSONAS  v5
//
//  A library of system-prompt personas.
//  Switching persona immediately changes
//  S.settings.persona which buildSys() uses.
//
//  personaApply(id)  — set active persona
//  personaSave(data) — create / update
//  personaDelete(id) — remove custom persona
//  All custom personas persist to localStorage.
// ════════════════════════════════════════════

const PERSONA_LS  = 'eai_personas_v1';
const PERSONA_ACTIVE_LS = 'eai_active_persona';

// ── Built-in persona library ──────────────────────────────────
const PERSONAS_BUILTIN = [
  {
    id: 'default',
    name: 'Elite Developer',
    icon: '🤖',
    desc: 'Full-stack AI developer — default mode',
    sys: 'You are an elite autonomous full-stack AI developer agent. Provide complete, production-ready code.',
  },
  {
    id: 'senior_engineer',
    name: 'Senior Engineer',
    icon: '👨‍💻',
    desc: 'Code reviews, architecture, best practices',
    sys: 'You are a senior software engineer with 15+ years experience. You write clean, maintainable, well-tested code. You always consider scalability, security, and performance. You give honest, direct feedback and explain the reasoning behind your decisions.',
  },
  {
    id: 'socratic_tutor',
    name: 'Socratic Tutor',
    icon: '🎓',
    desc: 'Teaches by asking questions, not giving answers',
    sys: 'You are a Socratic tutor. Instead of giving direct answers, guide the user to discover solutions themselves through carefully chosen questions. When a user is stuck, give small hints — never the full solution. Celebrate their reasoning even when imperfect.',
  },
  {
    id: 'tech_writer',
    name: 'Tech Writer',
    icon: '✍️',
    desc: 'Clear docs, READMEs, and technical writing',
    sys: 'You are an expert technical writer. You produce clear, concise, well-structured documentation. You use plain language, avoid jargon, and always write for the target audience. You excel at READMEs, API docs, tutorials, and developer guides.',
  },
  {
    id: 'security_expert',
    name: 'Security Expert',
    icon: '🔒',
    desc: 'Security audits, vulnerabilities, hardening',
    sys: 'You are a cybersecurity expert with deep knowledge of OWASP, secure coding practices, and vulnerability assessment. When reviewing code, always look for injection flaws, authentication issues, data exposure, XSS, CSRF, and insecure dependencies. Provide specific remediation steps.',
  },
  {
    id: 'ux_designer',
    name: 'UX Designer',
    icon: '🎨',
    desc: 'UI/UX critique, design systems, accessibility',
    sys: 'You are a senior UX designer with expertise in design systems, accessibility (WCAG 2.1), and user psychology. You evaluate interfaces for usability, visual hierarchy, and inclusive design. You suggest specific, actionable improvements with concrete examples.',
  },
  {
    id: 'rubber_duck',
    name: 'Rubber Duck',
    icon: '🦆',
    desc: 'Listens, asks clarifying questions, minimal answers',
    sys: "You are a rubber duck debugging assistant. Your role is to listen patiently as the user explains their problem. Ask brief clarifying questions to help them think through the problem themselves. Keep your responses very short — mostly one or two sentences. Let the user do the thinking.",
  },
  {
    id: 'data_scientist',
    name: 'Data Scientist',
    icon: '📊',
    desc: 'Data analysis, ML, statistics, Python',
    sys: 'You are a data scientist specialising in Python, pandas, scikit-learn, and data visualisation. You approach problems with statistical rigour, always asking about data quality, bias, and appropriate model selection. You write clean, commented Python code with proper evaluation metrics.',
  },
];

// ── State ─────────────────────────────────────────────────────
const PERSONA = {
  all:       [],     // builtin + user custom
  activeId:  'default',
  editingId: null,   // null = new, string = editing existing custom
  emojiList: ['🤖','👨‍💻','🎓','✍️','🔒','🎨','🦆','📊','🧑‍🔬','🕵️','🧑‍🏫','🧠','⚡','🌍','🎯','💡','🦁','🦉','🐉','🌊'],
  emojiIdx:  0,
};

function personaLoad() {
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(PERSONA_LS) || '[]'); } catch(e) {}
  PERSONA.all = [...PERSONAS_BUILTIN, ...custom];

  // Restore last active persona
  const saved = localStorage.getItem(PERSONA_ACTIVE_LS) || 'default';
  const found = PERSONA.all.find(p => p.id === saved);
  PERSONA.activeId = found ? saved : 'default';
  _personaApplyToSettings(PERSONA.activeId);
  personaRenderPill();
}

function _personaApplyToSettings(id) {
  const p = PERSONA.all.find(x => x.id === id);
  if (!p) return;
  S.settings.persona = p.sys;
  PERSONA.activeId = id;
}

function personaApply(id) {
  _personaApplyToSettings(id);
  localStorage.setItem(PERSONA_ACTIVE_LS, id);
  personaRenderPill();
  personaRenderGrid();
  const p = PERSONA.all.find(x => x.id === id);
  showToast(`${p?.icon || '🤖'} Persona: ${p?.name || id}`, 'inf');
  personaPickerClose();
}

// ── Pill ──────────────────────────────────────────────────────
function personaRenderPill() {
  const p    = PERSONA.all.find(x => x.id === PERSONA.activeId) || PERSONA.all[0];
  const icon = document.getElementById('personaPillIcon');
  const name = document.getElementById('personaPillName');
  const pill = document.getElementById('personaPill');
  if (icon) icon.textContent = p?.icon || '🤖';
  if (name) name.textContent = p?.name || 'Default';
  if (pill) pill.classList.toggle('active', PERSONA.activeId !== 'default');
}

// ── Picker ────────────────────────────────────────────────────
function personaPickerToggle() {
  const picker = document.getElementById('personaPicker');
  const isOpen = picker.classList.contains('open');
  if (isOpen) personaPickerClose();
  else         personaPickerOpen();
}

function personaPickerOpen() {
  personaEditorClose();
  personaRenderGrid();
  document.getElementById('personaPicker')?.classList.add('open');
}

function personaPickerClose() {
  document.getElementById('personaPicker')?.classList.remove('open');
}

// Close on outside click
document.addEventListener('click', e => {
  const wrap = document.getElementById('ctrlWrap');
  if (wrap && !wrap.contains(e.target)) personaPickerClose();
});

// ── Grid ──────────────────────────────────────────────────────
function personaRenderGrid() {
  const grid = document.getElementById('personaGrid');
  if (!grid) return;
  const isCustom = id => !PERSONAS_BUILTIN.find(b => b.id === id);
  grid.innerHTML = PERSONA.all.map(p => {
    const isActive = p.id === PERSONA.activeId;
    const canEdit  = isCustom(p.id);
    return `<div class="persona-card ${isActive?'active':''}" onclick="personaApply('${p.id}')">
      <div class="persona-card-icon">${p.icon}</div>
      <div class="persona-card-name">${esc(p.name)}</div>
      <div class="persona-card-desc">${esc(p.desc)}</div>
      ${isActive ? '<span class="persona-active-check">✓</span>' : ''}
      ${canEdit ? `<button class="persona-card-edit" onclick="event.stopPropagation();personaEditForm('${p.id}')" title="Edit">✏</button>` : ''}
    </div>`;
  }).join('');
}

// ── Editor ────────────────────────────────────────────────────
function personaNewForm() {
  PERSONA.editingId = null;
  PERSONA.emojiIdx  = 0;
  _personaEditorShow(null);
}

function personaEditForm(id) {
  PERSONA.editingId = id;
  const p = PERSONA.all.find(x => x.id === id);
  if (p) _personaEditorShow(p);
}

function _personaEditorShow(p) {
  document.getElementById('personaEditorIcon').textContent = p?.icon || '🤖';
  document.getElementById('personaEditorName').value = p?.name || '';
  document.getElementById('personaEditorDesc').value = p?.desc || '';
  document.getElementById('personaEditorSys').value  = p?.sys  || '';
  document.getElementById('personaEditorDel').style.display = PERSONA.editingId ? '' : 'none';
  document.getElementById('personaEditor').classList.add('show');
}

function personaEditorClose() {
  document.getElementById('personaEditor').classList.remove('show');
  PERSONA.editingId = null;
}

function personaPickEmoji() {
  PERSONA.emojiIdx = (PERSONA.emojiIdx + 1) % PERSONA.emojiList.length;
  document.getElementById('personaEditorIcon').textContent = PERSONA.emojiList[PERSONA.emojiIdx];
}

function personaSaveForm() {
  const icon = document.getElementById('personaEditorIcon').textContent.trim();
  const name = document.getElementById('personaEditorName').value.trim();
  const desc = document.getElementById('personaEditorDesc').value.trim();
  const sys  = document.getElementById('personaEditorSys').value.trim();

  if (!name || !sys) { showToast('Name and system prompt are required', 'wrn'); return; }

  const isNew = !PERSONA.editingId;
  const id    = isNew ? 'custom_' + Date.now() : PERSONA.editingId;

  const persona = { id, name, icon, desc, sys };

  // Remove old version if editing
  PERSONA.all = PERSONA.all.filter(p => p.id !== id || PERSONAS_BUILTIN.find(b => b.id === id));
  if (isNew) PERSONA.all.push(persona);
  else {
    const idx = PERSONA.all.findIndex(p => p.id === id);
    if (idx >= 0) PERSONA.all[idx] = persona; else PERSONA.all.push(persona);
  }

  _personaSaveCustom();
  personaEditorClose();
  personaApply(id);
  showToast(`${icon} Persona "${name}" saved`, 'ok');
}

function personaDeleteEditing() {
  const id = PERSONA.editingId;
  if (!id || !confirm('Delete this persona?')) return;
  PERSONA.all = PERSONA.all.filter(p => p.id !== id);
  _personaSaveCustom();
  if (PERSONA.activeId === id) personaApply('default');
  personaEditorClose();
  personaRenderGrid();
  showToast('Persona deleted', 'inf');
}

function _personaSaveCustom() {
  const custom = PERSONA.all.filter(p => !PERSONAS_BUILTIN.find(b => b.id === p.id));
  localStorage.setItem(PERSONA_LS, JSON.stringify(custom));
}

