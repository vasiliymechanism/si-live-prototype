// Tiny pub/sub so modules don't import each other
export const bus = {
  _e: Object.create(null),
  on(type, fn) { (this._e[type] ||= []).push(fn); },
  off(type, fn) { this._e[type] = (this._e[type] || []).filter(f => f !== fn); },
  emit(type, payload) { (this._e[type] || []).forEach(f => f(payload)); }
};

// Common event names to avoid typos
export const EV = Object.freeze({
  PHASE_STARTED: 'PHASE.STARTED',
  PHASE_CHANGED: 'PHASE.CHANGED',

  SEARCH_TICK: 'SEARCH.TICK',
  SCH_FOUND: 'SCHOLARSHIP.FOUND',
  SCH_ADVANCED: 'SCHOLARSHIP.ADVANCED',
  SCH_BLOCKED: 'SCHOLARSHIP.BLOCKED',
  SCH_UNBLOCKED: 'SCHOLARSHIP.UNBLOCKED',

  ACTIONQ_UPDATED: 'ACTIONQUEUE.UPDATED',

  QUIZ_OPEN: 'QUIZ.OPEN',
  QUIZ_COMPLETED: 'QUIZ.COMPLETED',

  PAYWALL_SHOW: 'PAYWALL.SHOW'
});
