// ════════════════════════════════════════════
//  CIRCUIT BREAKER + PROVIDER HEALTH  v5
//
//  Tracks per-provider failure counts and
//  applies exponential backoff + open/closed
//  circuit logic so consistently failing
//  providers are skipped automatically,
//  then retried after a cooldown window.
// ════════════════════════════════════════════

const CIRCUIT = {
  // provId → { failures, lastFail, openUntil, successes }
  state: {},

  FAIL_THRESHOLD: 3,       // failures before circuit opens
  OPEN_DURATION_MS: 60000, // 60s cooldown before retry
  BACKOFF_BASE_MS: 400,    // base delay between retries
  MAX_BACKOFF_MS: 5000,    // cap on backoff

  _get(provId) {
    if (!this.state[provId]) this.state[provId] = { failures:0, lastFail:0, openUntil:0, successes:0 };
    return this.state[provId];
  },

  // Record a success — reduce failure count, close circuit
  success(provId) {
    const s = this._get(provId);
    s.successes++;
    s.failures = Math.max(0, s.failures - 1);
    if (s.failures === 0) s.openUntil = 0; // close circuit
  },

  // Record a failure — may open circuit
  failure(provId) {
    const s = this._get(provId);
    s.failures++;
    s.lastFail = Date.now();
    if (s.failures >= this.FAIL_THRESHOLD) {
      s.openUntil = Date.now() + this.OPEN_DURATION_MS;
    }
  },

  // Is this provider currently circuit-open (skip it)?
  isOpen(provId) {
    const s = this._get(provId);
    if (s.openUntil && Date.now() < s.openUntil) return true;
    if (s.openUntil && Date.now() >= s.openUntil) {
      // Half-open: allow one retry
      s.openUntil = 0;
    }
    return false;
  },

  // Get backoff delay for this provider (exponential with cap)
  backoffMs(provId) {
    const s = this._get(provId);
    const exp = Math.min(s.failures, 6);
    return Math.min(this.BACKOFF_BASE_MS * Math.pow(1.8, exp), this.MAX_BACKOFF_MS);
  },

  // Health label for UI
  getHealth(provId) {
    const s = this.state[provId];
    if (!s) return 'unknown';
    if (s.openUntil && Date.now() < s.openUntil) return 'down';
    if (s.failures >= 2) return 'degraded';
    return 'ok';
  },

  // Get all provider health for the tooltip
  summary() {
    return PROVS.filter(p => p.browserOk).map(p => ({
      id: p.id, name: p.name, logo: p.logo,
      health: this.getHealth(p.id),
      failures: this.state[p.id]?.failures || 0,
      hasKey: !!S.keys[p.id] || p.worksNoKey,
    }));
  },
};

// Patch smartCall to use circuit breaker around each provider attempt
// We wrap the existing error handler — insert circuit logic into the loop
const _origSmartCall = smartCall;
smartCall = async function(msgs, sys, maxTok, onChunk) {
  // Temporarily patch CALLERS to wrap each call with circuit breaker
  return _origSmartCall(msgs, sys, maxTok, onChunk);
};

// Patch abortableDelay to use circuit-aware backoff
const _origAbortableDelay = abortableDelay;

// Integrate circuit breaker into smartCall's loop via monkey-patching callers
(function patchCallersWithCircuit() {
  for (const [name, fn] of Object.entries(CALLERS)) {
    CALLERS[name] = async function(prov, model, msgs, sys, maxTok, onChunk) {
      // Skip if circuit is open for this provider
      if (CIRCUIT.isOpen(prov.id)) {
        throw new Error(`${prov.name}: circuit open — cooling down (${Math.round((CIRCUIT.state[prov.id]?.openUntil - Date.now())/1000)}s)`);
      }
      try {
        const result = await fn(prov, model, msgs, sys, maxTok, onChunk);
        CIRCUIT.success(prov.id);
        return result;
      } catch(e) {
        if (e.name !== 'AbortError') {
          CIRCUIT.failure(prov.id);
          // Apply backoff delay before caller re-throws (smartCall will catch + move on)
          const delay = CIRCUIT.backoffMs(prov.id);
          if (delay > 300) {
            await new Promise(r => setTimeout(r, Math.min(delay, 1200)));
          }
        }
        throw e;
      }
    };
  }
})();

// ── Health tooltip on model pill ─────────────────────────────
function renderHealthTooltip() {
  const existing = document.querySelector('.health-tooltip');
  if (existing) existing.remove();

  const pill = document.querySelector('.mpill');
  if (!pill) return;

  const items = CIRCUIT.summary();
  const available = items.filter(p => p.hasKey);
  if (!available.length) return;

  const rows = available.slice(0, 8).map(p => {
    const icon = p.health === 'ok' ? 'ok' : p.health === 'degraded' ? 'degraded' : 'down';
    const stat = p.failures > 0 ? `${p.failures} err` : '✓';
    return `<div class="health-row">
      <div class="health-dot ${icon}"></div>
      <span class="health-name">${p.logo} ${p.name}</span>
      <span class="health-stat">${stat}</span>
    </div>`;
  }).join('');

  const tip = document.createElement('div');
  tip.className = 'health-tooltip';
  tip.innerHTML = `<div style="font-size:.58rem;font-weight:700;font-family:var(--fh);color:var(--t4);letter-spacing:.08em;margin-bottom:5px">PROVIDER HEALTH</div>${rows}`;
  pill.style.position = 'relative';
  pill.appendChild(tip);
}

