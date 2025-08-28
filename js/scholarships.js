// import { store } from './store.js';
// import { bus, EV } from './eventBus.js';
// import { randRange } from './rng.js';
// import { updateScholarshipCardState, addScholarshipCard } from './ui.js';
// import { resolveAction } from './actionResolver.js';

import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { randRange } from './rng.js';
import { addScholarshipCard, updateScholarshipCardState } from './ui.js';
import { evaluateLogic } from './jsonlogic.js';
import { resolveAction } from './actionResolver.js';


// optional shared helper: build instance from raw config
function buildInstance(raw) {
  const script = raw.script ? { steps: normalizeScript(raw.script), index: 0 } : null;

  return {
    ...raw,
    state: store.sm?.start || 'scanning',
    script,

    // runtime fields
    _timer: null,
    _tween: null,
    _stateStartedAt: null,
    _remainingMs: null,
    _pendingScriptAdvance: false,

    // metrics helpers (avoid double counting)
    _visited: new Set(),         // states entered at least once
    _minutesPerState: {},        // cached random per-state minutes
    _timeCredited: new Set()     // which states already credited to timeSavedMin
  };
}

let spawningPaused = false; 

// Call from onboarding / debug
export function setSpawningPaused(b) {
  spawningPaused = !!b;
}

// Spawn one item now (even if paused) and render; return instance
export function spawnNextNow({ ignorePause = false } = {}) {
  if (spawningPaused && !ignorePause) return null;
  const inst = spawnNext();          // your internal creator (from prior code)
  if (inst) addScholarshipCard(inst); // your existing UI adder
  return inst;
}

// -------- Action Queue management (unchanged API) --------
const actionQueue = new Map();
function emitAQ() {
  const list = Array.from(actionQueue.values())
    .sort((a,b) => {
      if (!!b.sticky - !!a.sticky) return (!!b.sticky - !!a.sticky);
      const ap = a.priority ?? 999, bp = b.priority ?? 999;
      return ap - bp;
    });
  bus.emit(EV.ACTIONQ_UPDATED, list);
}
function upsertAction({ type, sticky = undefined, schId = null, overrides = {} }) {
  const base = resolveAction(type, overrides);
  const existing = actionQueue.get(type) || { ...base, scholarships: new Set(), count: 0 };
  if (typeof sticky === 'boolean') existing.sticky = sticky;
  if (schId) existing.scholarships.add(schId);
  existing.count = existing.scholarships.size || 1;
  existing.label = base.label ?? existing.label;
  existing.cta   = base.cta   ?? existing.cta;
  existing.modal = base.modal ?? existing.modal;
  existing.sets  = base.sets  ?? existing.sets;
  existing.priority = base.priority ?? existing.priority;
  actionQueue.set(type, existing);
  emitAQ();
}
function removeActionType(type) { actionQueue.delete(type); emitAQ(); }

// -------- Helpers for state machine --------
function smState(name) { return store.sm.states[name] || {}; }
function durationMsFor(cfg) { return randRange(Math.random, cfg.durationMs || [600,1200]); }
function progressRangeFor(cfg) { return cfg.progress || [0,0]; }

// pick next: string | weighted[] | JSONLogic {if:[...]}
function pickNext(nextSpec, scope) {
  if (!nextSpec) return null;
  if (typeof nextSpec === 'string') return nextSpec;
  if (Array.isArray(nextSpec)) {
    const total = nextSpec.reduce((a, n) => a + (n.weight || 0), 0) || 1;
    let r = Math.random() * total;
    for (const n of nextSpec) { r -= (n.weight || 0); if (r <= 0) return n.to; }
    return nextSpec[nextSpec.length - 1]?.to || null;
  }
  if (typeof nextSpec === 'object' && ('if' in nextSpec)) {
    return evaluateLogic(nextSpec, scope);
  }
  return null;
}

// Blockers (same semantics you had, just refactored)
function isBlocked(inst, stCfg) {
  const blockers = stCfg?.blockers || [];
  for (const b of blockers) {
    if (b.type === 'userField') {
      if (store.user[b.field] == null) return { reason: 'userField', blocker: b };
    } else if (b.type === 'scholarshipField') {
      const needValue = ('value' in b) ? inst[b.field] === b.value : !!inst[b.field];
      const requiresFlagsOk = (b.requires || []).every(f => store.flags.has(f));
      if (needValue && !requiresFlagsOk) return { reason: 'scholarshipField', blocker: b };
    } else if (b.type === 'custom' && b.id === 'updateProfileViaQuiz') {
      if (!store.flags.has('quizCompleted')) return { reason: 'custom', blocker: b };
    }
  }
  return null;
}

// -------- Progress tween per state --------
function startTween(inst, fromPct, toPct, ms) {
  if (inst._tween) cancelAnimationFrame(inst._tween.raf);
  const start = performance.now();
  const end = start + ms;
  const barStep = (now) => {
    if (!inst._tween) return;
    const t = Math.min(1, (now - start) / Math.max(1, ms));
    const pct = Math.round(fromPct + (toPct - fromPct) * t);
    updateScholarshipCardState(inst.id, inst.state, pct);
    if (t < 1) {
      inst._tween.raf = requestAnimationFrame(barStep);
    } else {
      inst._tween = null;
    }
  };
  inst._tween = { raf: requestAnimationFrame(barStep), fromPct, toPct, ms, startedAt: start };
}

function stopTween(inst) {
  if (inst._tween) {
    cancelAnimationFrame(inst._tween.raf);
    inst._tween = null;
  }
}

// -------- Scheduling --------
function scheduleAdvance(inst, ms) {
  if (inst._timer) clearTimeout(inst._timer);
  inst._remainingMs = ms;
  inst._stateStartedAt = Date.now();
  inst._timer = setTimeout(() => advance(inst), ms);
}
function pauseAdvance(inst) {
  if (inst._timer) {
    clearTimeout(inst._timer);
    inst._timer = null;
  }
  // compute remaining time
  if (inst._stateStartedAt && inst._remainingMs != null) {
    const elapsed = Date.now() - inst._stateStartedAt;
    inst._remainingMs = Math.max(0, inst._remainingMs - elapsed);
  }
  stopTween(inst);
}
function resumeAdvance(inst) {
  const ms = inst._remainingMs ?? durationMsFor(smState(inst.state));
  const cfg = smState(inst.state);
  const [fromPct, toPct] = progressRangeFor(cfg);
  // figure current pct from the card if you want; simplest is animate remaining
  startTween(inst, fromPct, toPct, ms);
  scheduleAdvance(inst, ms);
  // advanceState(inst.id, stateName, { auto: true }); // notify, even if same state
}

// -------- Enter a state (handles scripted vs random paths) --------
function enterState(inst, stateName) {
  inst.state = stateName;
  const stCfg = smState(stateName);

  // status line updates immediately (progress pct handled by tween)
  updateScholarshipCardState(inst.id, inst.state, null);

  // From script: figure the current step (if any)
  const step = inst.script?.steps?.[inst.script.index ?? 0];

  // Assign blockers (subset or ALL) and enqueue actions for JUST these blockers
  const assigned = assignBlockersForState(inst, stCfg, step);
  inst._assignedBlockers = assigned; // store for resume checks

  // Always animate progress to toPct, regardless of blockers
  const ms = durationMsFor(stCfg);
  const [fromPct, toPct] = progressRangeFor(stCfg);
  startTween(inst, fromPct, toPct, ms);

  if (assigned.length) {
    // Create/merge action items per assigned blocker
    assigned.forEach(b => {
      const actionType = actionTypeForBlocker(b);
      if (actionType) upsertAction({ type: actionType, schId: inst.id });
    });
    // Pause only the timer, not the tween
    if (inst._timer) {
      clearTimeout(inst._timer);
      inst._timer = null;
    }
    // compute remaining time
    if (inst._stateStartedAt && inst._remainingMs != null) {
      const elapsed = Date.now() - inst._stateStartedAt;
      inst._remainingMs = Math.max(0, inst._remainingMs - elapsed);
    }
    bus.emit(EV.SCH_BLOCKED, { id: inst.id, state: inst.state, blockers: assigned.map(b => b.id) });
    return;
  }

  // No blockers → schedule advance
  scheduleAdvance(inst, ms);
  advanceState(inst.id, stateName, { auto: true }); // notify, even if same state
}


// -------- Advance logic --------
function advance(inst) {
  const cfg = smState(inst.state);
  if (cfg.terminal) {
    updateScholarshipCardState(inst.id, inst.state, (progressRangeFor(cfg)[1] || 100));
    return;
  }

  // scripted path: obey inst.script if present
  if (inst.script && Array.isArray(inst.script.steps)) {
    inst.script.index = (inst.script.index ?? 0) + 1;
    const nextStep = inst.script.steps[inst.script.index];
    if (!nextStep) {
      // end of script: if state has next, continue; else mark terminal
      const next = pickNext(cfg.next, { user: store.user, s: inst });
      if (next) {
        const from = inst.state;
        enterState(inst, next);
        bus.emit(EV.SCH_ADVANCED, { id: inst.id, from, to: next });
      } else {
        updateScholarshipCardState(inst.id, inst.state, (progressRangeFor(cfg)[1] || 100));
      }
      return;
    }
    // move to scripted next state and respect blockUntil (flags)
    const needsFlags = nextStep.blockUntil || [];
    const missing = needsFlags.filter(f => !store.flags.has(f));
    if (missing.length) {
      // pause, but also enqueue any relevant actions (quiz is common)
      if (missing.includes('quizCompleted')) upsertAction({ type: 'updateProfileViaQuiz', schId: inst.id });
      bus.emit(EV.SCH_BLOCKED, { id: inst.id, state: inst.state, reason: 'script.blockUntil' });
      pauseAdvance(inst);
      // when flags arrive, we’ll resume to next state
      inst._pendingScriptAdvance = true;
      return;
    }
    const from = inst.state;
    enterState(inst, nextStep.state);
    bus.emit(EV.SCH_ADVANCED, { id: inst.id, from, to: nextStep.state });
    return;
  }

  // random/global machine: pick next
  const next = pickNext(cfg.next, { ...store.user, s: inst });
  if (!next) return; // stay if unspecified
  bus.emit(EV.SCH_ADVANCED, { id: inst.id, from: inst.state, to: next });
  enterState(inst, next);
}

// -------- Public API --------
export function initScholarships() {
  // arrivals (unchanged)
  const firstRange = store.app.searchTiming?.firstMs || [1500, 2500];
  const restRange  = store.app.searchTiming?.subsequentMs || [800, 1600];

  // First
  // setTimeout(() => {
  //   const s = spawnNext();
  //   if (s) addScholarshipCard(s);
  // }, randRange(Math.random, firstRange));

  // The loop
  let idx = 1;
  (function scheduleNext() {
    if (idx >= store.catalog.length) return;

    const delay = randRange(Math.random, restRange);
    setTimeout(() => {
      // If spawning is paused, do NOT consume an index; just try again shortly.
      if (spawningPaused) {
        setTimeout(scheduleNext, 300);
        return;
      }

      // Try to spawn the next scholarship
      const s = spawnNext();          // returns null if none or if you gate internally
      if (!s) {
        // Nothing spawned (end-of-catalog or guard) → stop or retry as you prefer
        if (idx >= store.catalog.length) return; // hard stop when truly out
        setTimeout(scheduleNext, 300);           // soft retry if you want
        return;
      }

      addScholarshipCard(s);
      idx++;                           // <-- increment ONLY on success
      scheduleNext();
    }, delay);
  })();

    // Unblock on quiz completed or other actions
    function tryResumeAll() {
    store.scholarships.forEach(inst => {
      // If we have assigned blockers, check them
      if (inst._assignedBlockers && inst._assignedBlockers.length) {
        // Remove this scholarship from any action items that are now satisfied
        inst._assignedBlockers.forEach(b => {
          if (blockerSatisfied(inst, b)) {
            const actionType = actionTypeForBlocker(b);
            if (actionType) removeScholarFromAction(actionType, inst.id);
          }
        });

        // If all satisfied now, clear list and resume timers/tween
        if (allAssignedBlockersSatisfied(inst)) {
          inst._assignedBlockers = [];
          // Resume current state’s remaining time & progress
          if (!inst._timer) resumeAdvance(inst);

          // If we were waiting to advance scripted step, proceed
          if (inst._pendingScriptAdvance) {
            inst._pendingScriptAdvance = false;
            advance(inst);
          }
          bus.emit(EV.SCH_UNBLOCKED, { id: inst.id, state: inst.state });
        }
        return; // handled
      }

      // No assigned blockers: if paused mid-state, just resume its remaining time
      const cfg = smState(inst.state);
      const blockNow = assignBlockersForState(inst, cfg, inst.script?.steps?.[inst.script.index ?? 0]);
      if (!blockNow.length && !inst._timer) {
        resumeAdvance(inst);
      }
    });
  }

  // Resume on quiz & action completion
  bus.on(EV.QUIZ_COMPLETED, tryResumeAll);
  bus.on(EV.ACTION_COMPLETED, tryResumeAll);
}

// create instance and enter first state
function spawnNext() {
  const raw = store.catalog[store.schSpawnIndex || 0];
  if (!raw) return null;
  store.schSpawnIndex = (store.schSpawnIndex || 0) + 1;

  const script = raw.script
    ? { steps: normalizeScript(raw.script), index: 0 }
    : null;

  const inst = {
    ...raw,
    state: store.sm.start || 'scanning',
    script,
    _timer: null,
    _tween: null,
    _stateStartedAt: null,
    _remainingMs: null,
    _pendingScriptAdvance: false
  };

  store.scholarships.push(inst);

  // // Metrics: basic bumps
  // store.metrics.matches += 1;
  // store.metrics.potentialAwards += Number(inst.award) || 0;
  // if (!store.metrics.nextDeadline || new Date(inst.deadline) < new Date(store.metrics.nextDeadline)) {
  //   store.metrics.nextDeadline = inst.deadline;
  // }

  // Use this whenever you add a scholarship into the app
function attachAndEnter(inst) {
  // Push to store
  store.scholarships.push(inst);

  // Render card
  UI.addScholarshipCard(inst);
  // bumpExpandedHeight?.(document.getElementById('liveFeedSection')); // optional

  // If the script wants a different first state, adopt it before we "enter"
  const scriptedFirst = inst.script?.steps?.[0]?.state;
  if (scriptedFirst && scriptedFirst !== inst.state) {
    inst.state = scriptedFirst;
  }

  // Mark initial visited and emit an "enter" so metrics can credit minutes for first state
  // NOTE: make sure your enterState (or advanceState) emits EV.SCH_ADVANCED({id, from, to})
  enterState(inst, inst.state);

  // Announce the match so metrics.js can bump Matches/PotentialAwards/NextDeadline
  bus.emit(EV.SCH_SPAWNED, {
    id: inst.id,
    award: Number(inst.award) || 0,
    deadline: inst.deadline || null
  });

  return inst;
}

  // Enter start (script may immediately change it)
  if (inst.script && inst.script.steps[0]?.state && inst.script.steps[0].state !== inst.state) {
    inst.state = inst.script.steps[0].state;
  }
  enterState(inst, inst.state);

  // NEW: announce a match
  bus.emit(EV.SCH_SPAWNED, {
    id: inst.id,
    award: Number(inst.award) || 0,
    deadline: inst.deadline || null
  });

  return inst;
}

// normalize script array or object to array of steps
function normalizeScript(script) {
  if (Array.isArray(script)) return script;
  if (script && Array.isArray(script.states)) return script.states;
  return script ? [script] : [];
}

// Which action item should appear for a given blocker?
const FLAG_TO_ACTION = {
  transcriptUploaded: 'uploadTranscript',
  essayUploaded: 'uploadEssay',
  headshotUploaded: 'uploadHeadshot',
  recommendationUploaded: 'uploadRecommendation'
};

function actionTypeForBlocker(b) {
  // Prevent action for trialStarted blocker
  if (b.id === 'trialStarted' && b.type === 'custom') return null;
  if (b.actionType) return b.actionType;
  if (b.type === 'custom' && b.id === 'updateProfileViaQuiz') return 'updateProfileViaQuiz';
  if (b.type === 'flag') return FLAG_TO_ACTION[b.id] || null;
  return null;
}

// Is a blocker already satisfied?
function blockerSatisfied(inst, b) {
  if (!b) return true;
  if (b.type === 'custom' && b.id === 'updateProfileViaQuiz') {
    return store.flags.has('quizCompleted');
  }
  if (b.type === 'flag') {
    return store.flags.has(b.id);
  }
  if (b.type === 'userField') {
    return store.user[b.field] != null && store.user[b.field] !== '';
  }
  if (b.type === 'scholarshipField') {
    if ('value' in b) return inst[b.field] === b.value;
    return !!inst[b.field];
  }
  return false;
}

function weightedSampleWithoutReplacement(pool, k) {
  const items = pool.slice();
  const out = [];
  k = Math.max(0, Math.min(k, items.length));
  for (let i = 0; i < k; i++) {
    const total = items.reduce((a, x) => a + (x.weight ?? 1), 0);
    let r = Math.random() * (total || 1);
    let idx = 0;
    for (; idx < items.length; idx++) {
      r -= (items[idx].weight ?? 1);
      if (r <= 0) break;
    }
    const chosen = items.splice(Math.max(0, idx), 1)[0];
    out.push(chosen);
  }
  return out;
}

function assignBlockersForState(inst, stCfg, scriptStep) {
  // --- helpers ---
  const getPool = (blk) => {
    if (!blk) return [];
    if (Array.isArray(blk)) return blk;
    if (Array.isArray(blk.list)) return blk.list;
    if (Array.isArray(blk.pool)) return blk.pool;
    return [];
  };
  const withWeights = (arr) => arr.map(b => ({ ...b, weight: b.weight ?? 1 }));
  const unsatisfied = (arr) => arr.filter(b => !blockerSatisfied(inst, b));

  function pickSubset(pool, blk) {
    const P = unsatisfied(pool);
    if (P.length === 0) return [];

    // includeProb mode: Bernoulli per item (use item.prob OR blk.includeProb OR 0.5)
    if (blk && blk.includeProb != null) {
      const pDefault = Number(blk.includeProb);
      const chosen = P.filter(b => {
        const p = (b.prob != null) ? Number(b.prob) : (Number.isFinite(pDefault) ? pDefault : 0.5);
        return Math.random() < Math.max(0, Math.min(1, p));
      });
      if (chosen.length > 0) return chosen;
      // ensure at least 1 if nothing chosen
      return weightedSampleWithoutReplacement(withWeights(P), 1);
    }

    // pick exact or min/max
    let k = 1;
    if (blk) {
      if (typeof blk.pick === 'number') {
        k = blk.pick;
      } else if (blk.pick && (blk.pick.min != null || blk.pick.max != null)) {
        const min = Math.max(1, Math.floor(blk.pick.min ?? 1));
        const max = Math.max(min, Math.floor(blk.pick.max ?? P.length));
        const hi = Math.min(max, P.length);
        const lo = Math.min(min, hi);
        const span = hi - lo + 1;
        k = lo + Math.floor(Math.random() * span);
      }
    }
    k = Math.max(1, Math.min(k, P.length));
    return weightedSampleWithoutReplacement(withWeights(P), k);
  }

  // --- 1) Scripted step overrides (accept array OR object with mode/list/pool) ---
  if (scriptStep && scriptStep.blockers) {
    const blk = scriptStep.blockers;
    // If array: "all remaining" is usually what scripts intend
    if (Array.isArray(blk)) return unsatisfied(blk);

    // If object: honor mode like global
    const pool = getPool(blk);
    if (pool.length) {
      if (blk.mode === 'all') return unsatisfied(pool);
      if (blk.mode === 'any') return weightedSampleWithoutReplacement(withWeights(unsatisfied(pool)), 1);
      if (blk.mode === 'subset') return pickSubset(pool, blk);
      // default (no mode): pick 1
      return weightedSampleWithoutReplacement(withWeights(unsatisfied(pool)), 1);
    }
    return [];
  }

  // --- 2) Global state machine config ---
  const blk = stCfg?.blockers;
  if (!blk) return [];

  // Back-compat: plain array → treat as pool pick 1
  if (Array.isArray(blk)) {
    const P = unsatisfied(blk);
    if (P.length === 0) return [];
    return weightedSampleWithoutReplacement(withWeights(P), 1);
  }

  // Object form with mode + list/pool
  const pool = getPool(blk);
  if (pool.length === 0) return [];

  switch (blk.mode) {
    case 'all':
      return unsatisfied(pool);
    case 'any': {
      const P = unsatisfied(pool);
      if (P.length === 0) return [];
      return weightedSampleWithoutReplacement(withWeights(P), 1);
    }
    case 'subset':
      return pickSubset(pool, blk);
    default: {
      // no mode → default to pick 1 unsatisfied
      const P = unsatisfied(pool);
      if (P.length === 0) return [];
      return weightedSampleWithoutReplacement(withWeights(P), 1);
    }
  }
}


function removeScholarFromAction(type, schId) {
  const item = actionQueue.get(type);
  if (!item) return;
  item.scholarships.delete(schId);
  item.count = item.scholarships.size || 0;
  if (item.count <= 0) actionQueue.delete(type);
  emitAQ();
}

function allAssignedBlockersSatisfied(inst) {
  const list = inst._assignedBlockers || [];
  return list.every(b => blockerSatisfied(inst, b));
}


// expose adding/removing actions so other modules can use the same queue
export function addAction(type, { sticky = undefined, schId = null, overrides = {} } = {}) {
  const queue = document.getElementById('actionQueueSection');
  if (type == 'paywallCTA') {
    // add delay if showing paywall right after quiz completion
    setTimeout(() => {
      upsertAction({ type, sticky, schId, overrides });
    }, 2000);
    return;
  }
  upsertAction({ type, sticky, schId, overrides });
}

export function removeAction(type) {
  removeActionType(type);
}

export function advanceState(id, to, opts = {}) {
  const s = store.scholarships.find(x => x.id === id);
  if (!s) return false;

  const from = s.state;
  if (from === to) {
    // still fire blocked notice if provided
    if (opts.blockers?.length) {
      bus.emit(EV.SCH_BLOCKED, { id: s.id, state: to, blockers: opts.blockers });
    }
    return true;
  }

  s.state = to;
  s.progress = PROGRESS[to] ?? s.progress ?? 0;

  // Update the card
  UI.updateScholarshipCard?.(s, { from, to, blockers: opts.blockers });

  // Notify metrics & anyone else
  bus.emit(EV.SCH_ADVANCED, { id: s.id, from, to });

  // If entering a blocked state, announce it
  if (opts.blockers?.length) {
    bus.emit(EV.SCH_BLOCKED, { id: s.id, state: to, blockers: opts.blockers });
  }
  return true;
}