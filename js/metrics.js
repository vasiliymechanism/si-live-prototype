// metrics.js
import { bus, EV } from './eventBus.js';
import { store } from './store.js';
import * as UI from './ui.js';

// ——— helpers ———

const countedMatch    = new Set(); // scholarships we've counted for matches/potentialAwards
const countedStarted  = new Set(); // first entry to confirmEligibility
const countedReadyNow = new Set(); // first entry to readyToSubmit

if (!window.__METRICS_BOUND__) {
  window.__METRICS_BOUND__ = true;

  // One set of listeners total
  bus.on(EV.SCH_SPAWNED, onSpawned);
  bus.on(EV.SCH_ADVANCED, onAdvanced);
  console.log('[metrics] Listeners attached for SCH_SPAWNED and SCH_ADVANCED');

  // Build an initial baseline from current store (in case we attached late)
  baselineFromStore({ animate: false });
}

function money(n) { return Number(n || 0); }

function rangesByState() {
  return store.sm?.timeSavedMinRangeByState || store.app?.timeSavedMinRangeByState || {
    scanning:[0.2,0.5], analyzing:[0.5,1.2], matched:[0.4,0.8],
    confirmEligibility:[1.5,3.0], readyToSubmit:[4.0,6.0], submitted:[2.0,4.0]
  };
}

function minutesForState(s, state) {
  if (!s) return 0;

  // scholarship override
  if (s.minutesByState && s.minutesByState[state] != null) return Number(s.minutesByState[state]) || 0;

  // cached random
  s._minutesPerState = s._minutesPerState || {};
  if (s._minutesPerState[state] != null) return s._minutesPerState[state];

  // pick from global range
  const r = rangesByState()[state];
  let picked = 0;
  if (Array.isArray(r) && r.length === 2) {
    const [a,b] = r.map(Number);
    picked = a + Math.random() * Math.max(0, b - a);
    picked = Math.round(picked * 10) / 10; // 1 decimal
  }
  s._minutesPerState[state] = picked;
  return picked;
}

function recomputeNextDeadline() {
  const ms = store.scholarships
    .map(s => Date.parse(s.deadline))
    .filter(x => !Number.isNaN(x));
  store.metrics.nextDeadline = ms.length ? new Date(Math.min(...ms)).toISOString() : null;
}

function bump(keys = []) {
  UI.renderMetrics({ animateKeys: ['matches','potentialAwards','started','readyNow','timeSavedMin'] });
  bus.emit(EV.METRICS_CHANGED, { keys, metrics: { ...store.metrics } });
}

// ——— listeners ———

function onSpawned({ id, award }) {
  // No longer increments matches or potentialAwards here.
  // Only recompute nextDeadline in case new scholarship has an earlier deadline.
  recomputeNextDeadline();
}

function onAdvanced({ id, from, to }) {
  console.log(`[metrics] onAdvanced called: id=${id}, from=${from}, to=${to}`);
  const s = store.scholarships.find(x => x.id === id);
  if (!s) {
    console.warn(`[metrics] Scholarship with id=${id} not found in store.scholarships`);
    return;
  }

  const changed = [];

  // --- MATCHED STATES LOGIC ---
  const MATCHED_STATES = [
    'potentialMatch',
    'vetEligibility',
    'confirmEligibility',
    'eligible',
    'buildPackage',
    'autofillCore',
    'draftEssays',
    'gatherMissingData',
    'readinessDecision',
    'readyPendingMinorDetails',
    'readyPendingDocs',
    'readyPendingBoth',
    'preSubmitChecks',
    'readyPendingTrial',
    'submitted'
  ];
  if (MATCHED_STATES.includes(to) && !countedMatch.has(id)) {
    countedMatch.add(id);
    store.metrics.matches = (store.metrics.matches || 0) + 1;
    store.metrics.potentialAwards = (store.metrics.potentialAwards || 0) + money(s.award);
    recomputeNextDeadline();
    changed.push('matches', 'potentialAwards', 'nextDeadline');
  }

  // Time saved: only add when entering a state for the first time
  s._timeCredited = s._timeCredited || new Set();
  if (!s._timeCredited.has(to)) {
    const mins = minutesForState(s, to); // override OR cached random per state
    if (mins > 0) {
      store.metrics.timeSavedMin = (store.metrics.timeSavedMin || 0) + mins;
      changed.push('timeSavedMin');
      s._timeCredited.add(to);
    }
  }

  // Apps started: first-time reach confirmEligibility
  if (to === 'eligible' && !countedStarted.has(id)) {
    countedStarted.add(id);
    store.metrics.started = (store.metrics.started || 0) + 1;
    changed.push('started');
    console.log(`[metrics] Scholarship ${id} entered confirmEligibility. started=${store.metrics.started}`);
  }

  // Ready now: first-time reach any ready_now_state
  const READY_NOW_STATES = [
    'readyPendingMinorDetails',
    'readyPendingDocs',
    'readyPendingBoth',
    'preSubmitChecks',
    'readyPendingTrial',
    'submitted'
  ];
  if (READY_NOW_STATES.includes(to)) {
    if (!countedReadyNow.has(id)) {
      countedReadyNow.add(id);
      store.metrics.readyNow = (store.metrics.readyNow || 0) + 1;
      changed.push('readyNow');
      console.log(`[metrics] Scholarship ${id} entered ${to}. readyNow=${store.metrics.readyNow}`);
    } else {
      console.log(`[metrics] Scholarship ${id} entered ${to} but was already counted.`);
    }
  }

  // // Optional: decrement readyNow when leaving that state to submitted
  // if (from === 'readyToSubmit' && to === 'submitted' && countedReadyNow.has(id)) {
  //   countedReadyNow.delete(id);
  //   store.metrics.readyNow = Math.max(0, (store.metrics.readyNow || 0) - 1);
  //   changed.push('readyNow');
  // }

  if (changed.length) bump(changed);
}

// ——— baseline (rebuild from current store) ———

export function baselineFromStore({ animate = false } = {}) {
  // clear counters & totals
  countedMatch.clear();
  countedStarted.clear();
  countedReadyNow.clear();

  const m = store.metrics;
  m.matches = 0;
  m.potentialAwards = 0;
  m.started = 0;
  m.readyNow = 0;
  m.timeSavedMin = 0;


  // normalized pass
  const MATCHED_STATES = ['matched', 'confirmEligibility', 'readyToSubmit', 'submitted'];
  for (const s of store.scholarships) {
    // matches/potential awards: only if ever entered a matched state
    const visited = s._visited ? Array.from(s._visited) : [s.state].filter(Boolean);
    if (visited.some(st => MATCHED_STATES.includes(st))) {
      countedMatch.add(s.id);
      m.matches += 1;
      m.potentialAwards += money(s.award);
    }

    // started
    if (s.state === 'confirmEligibility' || s._visited?.has('confirmEligibility')) {
      countedStarted.add(s.id);
      m.started += 1;
    }

    // ready now (current or previously visited; you might prefer only current)
    const READY_NOW_STATES = [
      'readyPendingMinorDetails',
      'readyPendingDocs',
      'readyPendingBoth',
      'preSubmitChecks',
      'readyPendingTrial',
      'submitted'
    ];
    if (
      READY_NOW_STATES.includes(s.state) ||
      (s._visited && [...s._visited].some(st => READY_NOW_STATES.includes(st)))
    ) {
      countedReadyNow.add(s.id);
      m.readyNow += 1;
    }

    // time saved: credit each visited state once
    s._timeCredited = s._timeCredited || new Set();
    for (const st of visited) {
      if (s._timeCredited.has(st)) continue;
      const mins = minutesForState(s, st);
      if (mins > 0) {
        m.timeSavedMin += mins;
        s._timeCredited.add(st);
      }
    }
  }

  recomputeNextDeadline();
  UI.renderMetrics({ animateKeys: ['matches','potentialAwards','started','readyNow','timeSavedMin'] });
}
