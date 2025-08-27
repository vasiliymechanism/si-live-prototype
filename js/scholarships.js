import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { randRange } from './rng.js';
import { updateScholarshipCardState, addScholarshipCard } from './ui.js';
import { resolveAction } from './actionResolver.js';

// Action Queue (very simple aggregator)
const actionQueue = new Map(); // key: type, value: item

function emitAQ() {
  const list = Array.from(actionQueue.values())
    .sort((a,b) => (b.sticky?1:0) - (a.sticky?1:0));
  bus.emit(EV.ACTIONQ_UPDATED, list);
}

function upsertAction({ type, sticky = undefined, schId = null, overrides = {} }) {
  // 1) Resolve defaults from store.actions
  const base = resolveAction(type, overrides);

  // 2) Merge into existing entry
  const existing = actionQueue.get(type) || {
    ...base,
    scholarships: new Set(),
    count: 0
  };

  // allow caller to force sticky on/off
  if (typeof sticky === 'boolean') existing.sticky = sticky;

  if (schId) existing.scholarships.add(schId);
  existing.count = existing.scholarships.size || 1;

  // keep label/cta in sync with config unless explicitly overridden
  existing.label = base.label ?? existing.label;
  existing.cta   = base.cta   ?? existing.cta;
  existing.modal = base.modal ?? existing.modal;
  existing.sets  = base.sets  ?? existing.sets;

  actionQueue.set(type, existing);
  emitAQ();
}

function removeActionType(type) {
  actionQueue.delete(type);
  emitAQ();
}

// Basic blocker evaluation
function isBlocked(s, stateCfg) {
  const blockers = stateCfg?.blockers || [];
  for (const b of blockers) {
    if (b.type === 'userField') {
      if (store.user[b.field] == null) return { reason: 'userField', blocker: b };
    } else if (b.type === 'scholarshipField') {
      const needValue = ('value' in b) ? s[b.field] === b.value : !!s[b.field];
      const requiresFlagsOk = (b.requires || []).every(f => store.flags.has(f));
      if (needValue && !requiresFlagsOk) return { reason: 'scholarshipField', blocker: b };
    } else if (b.type === 'custom' && b.id === 'updateProfileViaQuiz') {
      if (!store.flags.has('quizCompleted')) return { reason: 'custom', blocker: b };
    }
  }
  return null;
}

function scheduleAdvance(instance, ms) {
  if (instance._timer) clearTimeout(instance._timer);
  instance._timer = setTimeout(() => advance(instance), ms);
}

function advance(instance) {
  const sm = store.sm;
  const stName = instance.state;
  const stCfg = sm.states[stName] || {};
  const block = isBlocked(instance, stCfg);

  if (block) {
    // Create/merge action queue entries
    if (block.reason === 'custom' && block.blocker.id === 'updateProfileViaQuiz') {
      upsertAction({ type: 'updateProfileViaQuiz', schId: instance.id });
    } else if (block.blocker?.requires?.includes('transcriptUploaded')) {
      upsertAction({ type: 'uploadTranscript', schId: instance.id });
    } else if (block.blocker?.requires?.includes('essayUploaded')) {
      upsertAction({ type: 'uploadEssay', schId: instance.id });
    }

    bus.emit(EV.SCH_BLOCKED, { id: instance.id, state: stName, reason: block.reason });
    return; // paused until unblocked
  }

  // Chance to advance
  const p = stCfg.advanceProb ?? 1.0;
  const success = Math.random() < p; // fine for transitions; durations still use seeded rng if you prefer
  if (!success) {
    // retry later with same state's duration
    const d = pickDurationMs(stCfg);
    scheduleAdvance(instance, d);
    return;
  }

  // Move to next state
  const next = stCfg.next || null;
  instance.state = next || instance.state; // if null, stay (submitted)
  bus.emit(EV.SCH_ADVANCED, { id: instance.id, state: instance.state });

  // Schedule next if any
  if (next) {
    const nextCfg = store.sm.states[next] || {};
    const d = pickDurationMs(nextCfg);
    scheduleAdvance(instance, d);
  }
}

function pickDurationMs(cfg) {
  const range = cfg.durationMs || [600, 1200];
  return randRange(Math.random, range, { float: false }); // you can use seeded RNG here if preferred
}

export function initScholarships() {
  // Create initial arrival timers per app.searchTiming
  const firstRange = store.app.searchTiming?.firstMs || [1500, 2500];
  const restRange = store.app.searchTiming?.subsequentMs || [800, 1600];

  // First arrival
  setTimeout(() => {
    const s = spawnNext();
    if (s) addScholarshipCard(s);
  }, randRange(Math.random, firstRange));

  // Subsequent arrivals (simple loop)
  let idx = 1;
  function scheduleNext() {
    if (idx >= store.catalog.length) return;
    const delay = randRange(Math.random, restRange);
    setTimeout(() => {
      const s = spawnNext();
      if (s) addScholarshipCard(s);
      idx++;
      scheduleNext();
    }, delay);
  }
  scheduleNext();

  // Unblock on quiz complete
  bus.on(EV.QUIZ_COMPLETED, () => {
    // Clear quiz sticky
    removeActionType('updateProfileViaQuiz');
    // Try to advance any paused-at-confirmEligibility
    store.scholarships.forEach(inst => {
      const stCfg = store.sm.states[inst.state];
      const block = isBlocked(inst, stCfg);
      if (!block) {
        const d = pickDurationMs(stCfg);
        scheduleAdvance(inst, d);
        bus.emit(EV.SCH_UNBLOCKED, { id: inst.id, state: inst.state });
      }
    });
  });
}

function spawnNext() {
  const nextRaw = store.catalog[store.schSpawnIndex || 0];
  if (!nextRaw) return null;

  store.schSpawnIndex = (store.schSpawnIndex || 0) + 1;

  const inst = {
    ...nextRaw,
    state: store.sm.start || 'scanning',
    _timer: null
  };
  store.scholarships.push(inst);

  // Metrics updates (basic)
  store.metrics.matches += 1;
  store.metrics.potentialAwards += Number(inst.award) || 0;
  if (!store.metrics.nextDeadline || new Date(inst.deadline) < new Date(store.metrics.nextDeadline)) {
    store.metrics.nextDeadline = inst.deadline;
  }

  // Kick off its state machine
  const stCfg = store.sm.states[inst.state] || {};
  const d = pickDurationMs(stCfg);
  scheduleAdvance(inst, d);

  return inst;
}
