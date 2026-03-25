// ════════════════════════════════════════════
//  SELF-CRITIQUE LOOP  v5
//
//  After the primary response completes,
//  silently fires a second model call asking
//  it to review and improve the answer.
//
//  Only runs when:
//    • S.opts.critique === true (user toggled on)
//    • Response is above 80 chars (skip one-liners)
//    • Not a code-heavy response (saves tokens)
//    • Not already in a critique pass
//
//  Shows a ✓ Reviewed badge when unchanged,
//  or replaces the bubble content with the
//  improved version + a "✨ Revised" badge.
//
//  critiqueToggle()    — turn on/off
//  critiqueRun(text, bblEl, metaEl, taskKey)
//                      — called after streamEnd
// ════════════════════════════════════════════

const CRITIQUE = {
  running: false,
  enabled: false,
};

function critiqueToggle() {
  CRITIQUE.enabled = !CRITIQUE.enabled;
  S.opts = S.opts || {};
  S.opts.critique = CRITIQUE.enabled;
  const btn = document.getElementById('plus-critique');
  if (btn) btn.classList.toggle('active', CRITIQUE.enabled);
  showToast(CRITIQUE.enabled ? '🔍 Self-Critique ON — AI will review its answers' : 'Self-Critique OFF', 'inf');
}

async function critiqueRun(originalText, bblEl, metaEl, taskKey) {
  if (!CRITIQUE.enabled || CRITIQUE.running) return;
  if (!originalText || originalText.length < 80) return;

  // Skip code-heavy responses (>30% code by line count)
  const lines   = originalText.split('\n');
  const codeLines = lines.filter(l => l.startsWith('```') || l.startsWith('    ')).length;
  if (codeLines / Math.max(lines.length, 1) > 0.3) return;

  CRITIQUE.running = true;

  // Show thinking indicator in meta bar
  const thinkEl = document.createElement('span');
  thinkEl.className = 'critique-thinking';
  thinkEl.innerHTML = '<span class="tdot" style="animation-delay:0s"></span><span class="tdot" style="animation-delay:.15s"></span><span class="tdot" style="animation-delay:.3s"></span> reviewing…';
  if (metaEl) metaEl.appendChild(thinkEl);

  try {
    const critiquePrompt =
      `You previously wrote this response:\n\n"""\n${originalText.slice(0, 2000)}\n"""\n\n` +
      `Review it critically. Ask yourself:\n` +
      `1. Is every factual claim correct?\n` +
      `2. Is the reasoning sound and complete?\n` +
      `3. Are there missing edge cases or caveats?\n` +
      `4. Is there unnecessary padding or repetition?\n\n` +
      `If the response is already excellent, reply with exactly: LGTM\n` +
      `If you can improve it, reply with the FULL improved version only — no preamble, no explanation of changes.`;

    const sys = 'You are a rigorous self-reviewer. Be brutally honest. Improve or confirm the response.';
    const res = await smartCallForTask(
      taskKey || 'thinking',
      [{ role: 'user', content: critiquePrompt }],
      sys,
      Math.min(S.settings.maxTokens || 4096, 2048)
    );

    const revised = res.text?.trim();
    thinkEl.remove();

    if (!revised || revised === 'LGTM' || revised.startsWith('LGTM')) {
      // Unchanged — show small green badge
      const badge = document.createElement('span');
      badge.className = 'critique-badge';
      badge.title = 'Self-critique passed — no changes needed';
      badge.innerHTML = '<span class="cb-icon">✓</span> Reviewed';
      if (metaEl) metaEl.appendChild(badge);
    } else if (revised.length > 40 && revised !== originalText.trim()) {
      // Improved — update the bubble
      S.msgs[S.msgs.length - 1].content = revised;
      bblEl.innerHTML = parseMsg(revised);
      hlCode(bblEl);
      voiceInjectSpeakBtn(bblEl, revised);

      // Show revised badge
      const badge = document.createElement('span');
      badge.className = 'critique-badge';
      badge.style.cssText = 'background:rgba(139,92,246,.1);border-color:rgba(139,92,246,.3);color:#c4b5fd';
      badge.title = 'Self-critique improved this response';
      badge.innerHTML = '<span class="cb-icon">✨</span> Revised';
      if (metaEl) metaEl.appendChild(badge);

      saveCurrentSession();
    }

  } catch(e) {
    thinkEl?.remove();
  } finally {
    CRITIQUE.running = false;
  }
}

