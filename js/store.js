// Single source of truth (in-memory)
export const store = {
  phase: 'welcome',
  user: { gpa: null, us_citizen: null, sports: [], gradYear: null },
  flags: new Set(),              // e.g., 'quizCompleted','transcriptUploaded','essayUploaded'
  scholarships: [],              // array of instances (managed in scholarships.js)
  metrics: { matches: 0, potentialAwards: 0, started: 0, readyNow: 0, nextDeadline: null, timeSavedMin: 0 },

  // Configs (loaded at startup)
  app: null,
  sm: null,          // stateMachine
  actions: null,
  paywall: null,
  quiz: null,
  catalog: []        // raw scholarships.json items
};
