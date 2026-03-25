// ════════════════════════════════════════════
//  VOICE INPUT / OUTPUT  v5
//
//  VOICE INPUT  — Web SpeechRecognition API
//   • Click mic button to toggle listening
//   • Live interim transcript in textarea
//   • Auto-submits on final result + Enter
//   • Language configurable
//
//  VOICE OUTPUT — Web SpeechSynthesis API
//   • 🔊 button on every AI bubble
//   • Auto-read toggle in voice bar
//   • Voice / speed / pitch selector
//   • Strips markdown/code for clean speech
//   • Respects stop button mid-speech
// ════════════════════════════════════════════

const VOICE = {
  // Input state
  recognition:  null,
  listening:    false,
  interimText:  '',

  // Output state
  synth:        window.speechSynthesis || null,
  currentUtter: null,
  speaking:     false,
  autoRead:     false,
  currentMsgBtn:null,

  // Settings (persisted)
  voiceName:    '',
  rate:         1.0,
  pitch:        1.0,
  lang:         'en-US',

  // Support flags
  inputSupported:  !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  outputSupported: !!window.speechSynthesis,
};

// ── Init ──────────────────────────────────────────────────────
function voiceInit() {
  // Load saved settings
  try {
    const saved = JSON.parse(localStorage.getItem('eai_voice') || '{}');
    if (saved.voiceName !== undefined) VOICE.voiceName = saved.voiceName;
    if (saved.rate      !== undefined) VOICE.rate      = saved.rate;
    if (saved.pitch     !== undefined) VOICE.pitch     = saved.pitch;
    if (saved.lang      !== undefined) VOICE.lang      = saved.lang;
    if (saved.autoRead  !== undefined) VOICE.autoRead  = saved.autoRead;
  } catch(e) {}

  // Apply loaded settings to sliders
  const rateEl  = document.getElementById('voiceRate');
  const pitchEl = document.getElementById('voicePitch');
  const langEl  = document.getElementById('voiceLangSelect');
  if (rateEl)  { rateEl.value  = VOICE.rate;  document.getElementById('voiceRateVal').textContent  = VOICE.rate  + '×'; }
  if (pitchEl) { pitchEl.value = VOICE.pitch; document.getElementById('voicePitchVal').textContent = VOICE.pitch; }
  if (langEl)  { langEl.value  = VOICE.lang; }

  // Sync auto-read button
  const arBtn = document.getElementById('voiceAutoReadBtn');
  if (arBtn) arBtn.classList.toggle('on', VOICE.autoRead);

  // Populate voice list (may load async)
  voicePopulateList();
  if (VOICE.outputSupported) {
    window.speechSynthesis.onvoiceschanged = voicePopulateList;
  }

  // Show/hide mic button based on support
  const btn = document.getElementById('voiceBtn');
  if (btn) {
    if (!VOICE.inputSupported && !VOICE.outputSupported) {
      btn.style.display = 'none';
    }
    btn.title = VOICE.inputSupported
      ? 'Click to start voice input'
      : 'Voice output only (no mic support in this browser)';
  }
}

function voicePopulateList() {
  if (!VOICE.outputSupported) return;
  const sel = document.getElementById('voiceSelect');
  if (!sel) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;

  sel.innerHTML = voices.map((v, i) =>
    `<option value="${i}" ${v.name === VOICE.voiceName ? 'selected' : ''}>${v.name} (${v.lang})</option>`
  ).join('');
}

function voiceSaveSettings() {
  const sel   = document.getElementById('voiceSelect');
  const rateEl= document.getElementById('voiceRate');
  const pitchEl=document.getElementById('voicePitch');
  const langEl= document.getElementById('voiceLangSelect');

  if (sel) {
    const voices = window.speechSynthesis?.getVoices() || [];
    VOICE.voiceName = voices[parseInt(sel.value)]?.name || '';
  }
  if (rateEl)  VOICE.rate  = parseFloat(rateEl.value);
  if (pitchEl) VOICE.pitch = parseFloat(pitchEl.value);
  if (langEl)  VOICE.lang  = langEl.value;

  localStorage.setItem('eai_voice', JSON.stringify({
    voiceName: VOICE.voiceName, rate: VOICE.rate,
    pitch: VOICE.pitch, lang: VOICE.lang, autoRead: VOICE.autoRead,
  }));
}

// ── Input (mic) ───────────────────────────────────────────────
function voiceToggle() {
  if (!VOICE.inputSupported) {
    // No mic — open settings panel for output-only
    voiceOpenSettings();
    return;
  }
  if (VOICE.listening) voiceStopListening();
  else                 voiceStartListening();
}

function voiceStartListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech recognition not supported in this browser', 'wrn'); return; }

  VOICE.recognition = new SR();
  VOICE.recognition.continuous     = true;
  VOICE.recognition.interimResults  = true;
  VOICE.recognition.lang            = VOICE.lang;
  VOICE.recognition.maxAlternatives = 1;

  const inp = document.getElementById('uIn');
  const existingText = inp.value.trimEnd();

  VOICE.recognition.onstart = () => {
    VOICE.listening   = true;
    VOICE.interimText = '';
    _voiceUIListening(true);
  };

  VOICE.recognition.onresult = (e) => {
    let interim = '';
    let final   = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else                       interim += t;
    }
    VOICE.interimText = interim;

    // Show combined text in textarea
    const combined = (existingText ? existingText + ' ' : '') + final + interim;
    inp.value = combined;
    autoR(inp); updCC(); ragUpdateUI(); intentBadgeUpdate(combined);

    // Update interim display in voice bar
    const barText = document.getElementById('voiceBarText');
    if (barText) barText.innerHTML = `Listening — <span class="voice-interim">${esc(interim || '…')}</span>`;

    // If final result, stop and potentially auto-send
    if (final) {
      inp.value = (existingText ? existingText + ' ' : '') + final.trim();
      autoR(inp); updCC();
      // Auto-stop after a pause
      clearTimeout(VOICE._autoStopTimer);
      VOICE._autoStopTimer = setTimeout(() => {
        if (VOICE.listening) voiceStopListening();
      }, 1800);
    }
  };

  VOICE.recognition.onerror = (e) => {
    if (e.error === 'no-speech') return; // normal timeout
    if (e.error === 'not-allowed') {
      showToast('Microphone permission denied — check browser settings', 'err');
    } else {
      showToast(`Voice error: ${e.error}`, 'wrn');
    }
    voiceStopListening();
  };

  VOICE.recognition.onend = () => {
    if (VOICE.listening) {
      // Restarted (continuous mode disconnected) — restart
      try { VOICE.recognition.start(); } catch(e) { voiceStopListening(); }
    }
  };

  try {
    VOICE.recognition.start();
    // Show voice bar
    document.getElementById('voiceBar').classList.add('show');
    showToast('🎙 Listening…', 'inf');
  } catch(e) {
    showToast('Could not start microphone: ' + e.message, 'err');
  }
}

function voiceStopListening() {
  VOICE.listening = false;
  clearTimeout(VOICE._autoStopTimer);
  try { VOICE.recognition?.stop(); } catch(e) {}
  VOICE.recognition = null;
  _voiceUIListening(false);
  const inp = document.getElementById('uIn');
  if (inp?.value?.trim()) {
    showToast('🎙 Voice input captured — press Enter to send', 'inf');
    inp.focus();
  }
}

function _voiceUIListening(on) {
  const btn  = document.getElementById('voiceBtn');
  const dot  = document.getElementById('voiceBarDot');
  const wave = document.getElementById('voiceWave');
  const text = document.getElementById('voiceBarText');
  if (btn)  btn.classList.toggle('listening', on);
  if (dot)  { dot.className = 'voice-bar-dot' + (on ? ' listening' : ''); }
  if (wave) { wave.className = 'voice-wave' + (on ? ' listening' : ' idle'); }
  if (text && !on) text.textContent = 'Ready';
  if (!on && !VOICE.speaking) {
    document.getElementById('voiceBar').classList.remove('show');
  }
}

// ── Output (TTS) ──────────────────────────────────────────────
function voiceSpeak(text, btnEl) {
  if (!VOICE.outputSupported) { showToast('Speech synthesis not supported in this browser', 'wrn'); return; }

  // Stop current speech
  voiceStopSpeaking();

  // Strip markdown, code blocks, URLs for clean speech
  const clean = text
    .replace(/```[\s\S]*?```/g, ' [code block] ')
    .replace(/`[^`]+`/g, m => m.slice(1,-1))
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s]+/g, '[link]')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  if (!clean) return;

  // Split into chunks (250 chars) — avoids TTS cutting off on long texts
  const MAX_CHUNK = 250;
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks = [];
  let current = '';
  sentences.forEach(s => {
    if ((current + s).length > MAX_CHUNK && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  });
  if (current.trim()) chunks.push(current.trim());

  VOICE.speaking    = true;
  VOICE.currentMsgBtn = btnEl;
  if (btnEl) { btnEl.classList.add('speaking'); btnEl.title = 'Stop reading'; }
  _voiceUITTS(true);

  let chunkIdx = 0;
  const speakNext = () => {
    if (chunkIdx >= chunks.length || !VOICE.speaking) {
      voiceStopSpeaking(); return;
    }
    const utter = new SpeechSynthesisUtterance(chunks[chunkIdx++]);
    utter.rate  = VOICE.rate;
    utter.pitch = VOICE.pitch;
    utter.lang  = VOICE.lang;

    // Apply selected voice
    const voices = window.speechSynthesis.getVoices();
    const found  = voices.find(v => v.name === VOICE.voiceName);
    if (found) utter.voice = found;

    utter.onend   = speakNext;
    utter.onerror = () => voiceStopSpeaking();

    VOICE.currentUtter = utter;
    window.speechSynthesis.speak(utter);
  };

  speakNext();
}

function voiceStopSpeaking() {
  VOICE.speaking = false;
  window.speechSynthesis?.cancel();
  VOICE.currentUtter = null;
  if (VOICE.currentMsgBtn) {
    VOICE.currentMsgBtn.classList.remove('speaking');
    VOICE.currentMsgBtn.title = 'Read aloud';
    VOICE.currentMsgBtn = null;
  }
  _voiceUITTS(false);
}

function _voiceUITTS(on) {
  const btn  = document.getElementById('voiceBtn');
  const dot  = document.getElementById('voiceBarDot');
  const wave = document.getElementById('voiceWave');
  const text = document.getElementById('voiceBarText');
  if (btn)  btn.classList.toggle('speaking', on);
  if (dot)  { dot.className = 'voice-bar-dot' + (on ? ' speaking' : ''); }
  if (wave) { wave.className = 'voice-wave' + (on ? ' speaking' : ' idle'); }
  if (text) text.textContent = on ? 'Reading aloud…' : 'Ready';

  const bar = document.getElementById('voiceBar');
  if (on)      bar.classList.add('show');
  else if (!VOICE.listening) bar.classList.remove('show');
}

function voiceStopAll() {
  voiceStopListening();
  voiceStopSpeaking();
  document.getElementById('voiceBar').classList.remove('show');
}

// ── Auto-read toggle ──────────────────────────────────────────
function voiceToggleAutoRead() {
  VOICE.autoRead = !VOICE.autoRead;
  const btn = document.getElementById('voiceAutoReadBtn');
  if (btn) btn.classList.toggle('on', VOICE.autoRead);
  voiceSaveSettings();
  showToast(VOICE.autoRead ? '🔊 Auto-read ON' : '🔇 Auto-read OFF', 'inf');
}

// ── Settings panel ────────────────────────────────────────────
function voiceOpenSettings() {
  const panel = document.getElementById('voiceSettings');
  const isOpen = panel.classList.toggle('show');
  voicePopulateList();
  const bar = document.getElementById('voiceBar');
  if (isOpen) bar.classList.add('show');
}

function voiceTestSpeak() {
  voiceSpeak('Hello! This is a voice test. The Qrox is ready to speak.', null);
}

// ── Inject speak button into AI bubbles ───────────────────────
function voiceInjectSpeakBtn(bblEl, rawText) {
  if (!VOICE.outputSupported) return;
  const metaEl = bblEl?.closest('.msg')?.querySelector('.mmeta');
  if (!metaEl || metaEl.querySelector('.speak-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'speak-btn mact';
  btn.title     = 'Read aloud';
  btn.setAttribute('data-text', rawText.slice(0, 3000));
  btn.onclick   = function() {
    if (this.classList.contains('speaking')) voiceStopSpeaking();
    else voiceSpeak(this.getAttribute('data-text'), this);
  };
  metaEl.appendChild(btn);
}

// ── Auto-read new AI responses ────────────────────────────────
function voiceAutoReadResponse(text) {
  if (!VOICE.autoRead || !VOICE.outputSupported) return;
  // Don't read code-heavy responses
  const codeRatio = (text.match(/```/g) || []).length / Math.max(text.length / 100, 1);
  if (codeRatio > 1) return;
  // Only read first 500 chars of long responses
  const excerpt = text.slice(0, 500);
  setTimeout(() => voiceSpeak(excerpt, null), 300);
}

