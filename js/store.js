// store.js
// Single source of truth across the whole app (and across HMR/module re-imports)

function makeDefaults() {
  return {
    phase: 'welcome',
    user: { gpa: null, us_citizen: null, sports: [], gradYear: null },
    flags: new Set(), // e.g., 'quizCompleted','transcriptUploaded','essayUploaded'
    scholarships: [],

    metrics: {
      matches: 0,
      potentialAwards: 0,
      started: 0,
      readyNow: 0,
      nextDeadline: null,
      timeSavedMin: 0
    },

    // Configs loaded at startup
    app: null,        // app.jsonc
    sm: null,         // stateMachine.jsonc
    actions: null,    // actions.jsonc (if you have one)
    paywall: null,    // paywall config
    quiz: null,       // quiz config
    catalog: []       // raw scholarships.jsonc items
  };
}

// Reuse a global instance if it exists (prevents duplicates under HMR or mixed import paths)
const existing = window.__APP_STORE__;
const store = existing || makeDefaults();
if (!existing) {
  window.__APP_STORE__ = store;
}

// Optional: ensure missing keys are present if some module imported early
function ensureDefaults(obj) {
  const d = makeDefaults();
  for (const k of Object.keys(d)) {
    if (!(k in obj)) obj[k] = d[k];
  }
  // If flags somehow became an array, coerce back to Set
  if (!(obj.flags instanceof Set)) obj.flags = new Set(obj.flags || []);
  // Ensure metrics has all fields
  obj.metrics = Object.assign({}, d.metrics, obj.metrics || {});
}
ensureDefaults(store);

export { store };

// ---- Optional debug helpers (nice for console / dev) ----
export function hardResetStore() {
  const d = makeDefaults();
  // mutate in place so references stay valid
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, d);
}

export function softResetMetrics() {
  store.metrics = Object.assign(store.metrics, {
    matches: 0, potentialAwards: 0, started: 0, readyNow: 0, nextDeadline: null, timeSavedMin: 0
  });
}
