// ——— Input Modal (Action Queue) ———
const inputModal = () => document.querySelector('#inputModal');

// Map actionType to quiz question id if applicable
const ACTION_TO_QUIZ_QUESTION = {
  uploadTranscript: 'q_transcript',
  inputCurrentSchoolLevel: 'q_schoolLevel', // Example, update as needed
  // Add more mappings as needed
};

// Renderers for each input type (reuse quizEngine logic where possible)
function renderInputModal({ actionType, onSubmit, overrides = {} }) {
  const modal = inputModal();
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  if (!content) return;
  content.innerHTML = '';

  // Try to find a matching quiz question config
  let qCfg = null;
  if (window.app?.store?.quiz && ACTION_TO_QUIZ_QUESTION[actionType]) {
    qCfg = window.app.store.quiz.questions[ACTION_TO_QUIZ_QUESTION[actionType]];
  }

  // Find userField info from state machine config if available
  let userField = null;
  if (window.app?.store?.sm?.states) {
    const sm = window.app.store.sm.states;
    for (const state of Object.values(sm)) {
      if (state.blockers && state.blockers.pool) {
        const found = state.blockers.pool.find(b => b.actionType === actionType && b.type === 'userField');
        if (found && found.field) { userField = found.field; break; }
      }
    }
  }

  // Wrap onSubmit to set userField and emit event if needed
  const wrappedOnSubmit = (val) => {
    if (userField) {
      window.app.store.user[userField] = val;
      if (window.app.bus && window.app.EV) {
        window.app.bus.emit(window.app.EV.USER_FIELD_UPDATED, { field: userField, value: val });
      }
    }
    onSubmit?.(val);
  };

  // If quiz config exists, use quiz-style renderer
  if (qCfg) {
    renderQuizStyleInput(qCfg, content, wrappedOnSubmit, overrides);
  } else {
    // Otherwise, render a generic file or text input based on actionType
    renderCustomInput(actionType, content, wrappedOnSubmit, overrides);
  }

  openModal(modal);
}

// Render input using quiz question config (reuse quizEngine logic)
function renderQuizStyleInput(q, content, onSubmit, overrides) {
  // Minimal: support 'file', 'short', 'date', 'single', 'multi', 'checkbox', 'interstitial'
  // For now, only implement 'file' and 'short' as examples
  if (q.type === 'file') {
    const label = document.createElement('div');
    label.className = 'q-label';
    label.textContent = q.title || 'Upload file';
    content.appendChild(label);

    const input = document.createElement('input');
    input.type = 'file';
    if (q.accept) input.accept = q.accept;
    content.appendChild(input);

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Submit';
    btn.onclick = () => {
      if (!input.files || !input.files[0]) return;
      onSubmit?.(input.files[0]);
      closeModal(inputModal());
    };
    content.appendChild(btn);
  } else if (q.type === 'short') {
    const label = document.createElement('div');
    label.className = 'q-label';
    label.textContent = q.title || 'Enter value';
    content.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = q.placeholder || '';
    content.appendChild(input);

    const error = document.createElement('div');
    error.className = 'q-error';
    error.style.color = 'red';
    error.style.display = 'none';
    content.appendChild(error);

    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Submit';
    btn.onclick = () => {
      const val = input.value;
      // Validation logic from quiz config
      let valid = true;
      let errMsg = '';
      if (q.validate) {
        try {
          // Use the same minimal JSONLogic evaluator as quizEngine
          const logic = window.app?.jsonlogic || window.jsonlogic || null;
          const evaluateLogic = logic ? logic.evaluateLogic : window.evaluateLogic;
          if (evaluateLogic) {
            valid = evaluateLogic(q.validate, { value: parseFloat(val) });
            if (!valid) errMsg = 'Invalid value.';
          }
        } catch (e) { valid = false; errMsg = 'Invalid value.'; }
      }
      if (!val || !valid) {
        error.textContent = errMsg || 'Please enter a valid value.';
        error.style.display = '';
        return;
      }
      error.style.display = 'none';
      onSubmit?.(val);
      closeModal(inputModal());
    };
    content.appendChild(btn);
  } else {
    // Fallback: just show label
    const label = document.createElement('div');
    label.className = 'q-label';
    label.textContent = q.title || 'Input';
    content.appendChild(label);
    // Add more types as needed
  }
}

// Render custom input for actions not in quiz
function renderCustomInput(actionType, content, onSubmit, overrides) {
  // Example: uploadEssay = file, uploadHeadshot = file (image), etc.
  let label = 'Provide input';
  let inputType = 'text';
  let accept = '';
  if (actionType === 'uploadEssay') {
    label = 'Upload your essay';
    inputType = 'file';
    accept = '.pdf,.doc,.docx';
  } else if (actionType === 'uploadHeadshot') {
    label = 'Upload a headshot';
    inputType = 'file';
    accept = '.jpg,.jpeg,.png';
  } else if (actionType === 'uploadRecommendation') {
    label = 'Upload recommendation letter';
    inputType = 'file';
    accept = '.pdf';
  }
  // Add more as needed

  const labelEl = document.createElement('div');
  labelEl.className = 'q-label';
  labelEl.textContent = label;
  content.appendChild(labelEl);

  const input = document.createElement('input');
  input.type = inputType;
  if (accept) input.accept = accept;
  content.appendChild(input);

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Submit';
  btn.onclick = () => {
    let val;
    if (inputType === 'file') {
      // If multiple files are allowed, use input.files.length; otherwise, 1 if a file is present, 0 if not
      val = input.files ? input.files.length : 0;
    } else {
      val = input.value;  
    }
    if (!val) return;
    onSubmit?.(val);
    closeModal(inputModal());
  };
  content.appendChild(btn);
}

// Public API
export function openInputModalForAction(actionType, onSubmit, overrides = {}) {
  renderInputModal({ actionType, onSubmit, overrides });
}
import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { animateIn, toggleDim } from './animations.js';
import { resolveAction } from './actionResolver.js';

// Cache DOM nodes once
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const pick = (...sels) => sels.map(s => (s ? $(s) : null)).find(Boolean) || null;


export const dom = {};
export function cacheDom() {
  // Landing / main
  dom.landing       = pick('#landingScreen', '#welcome', '.welcome');
  dom.mainApp       = pick('#mainApp', '.main-app');
  dom.accordion     = pick('#accordionContainer', '.accordion-container');

  // Start button
  dom.startBtn      = pick('#startButton', '#startBtn', '[data-role="start"]', '.start-button');

  // Metrics
  dom.metricsHeader = pick('#metricsHeader', '.metrics-header');
  dom.metricsGrid   = pick('#metricsGrid',  '.metrics-grid');

  // Feeds
  dom.liveFeed      = pick('#liveFeedContent',  '#liveFeedSection .feed-content');
  dom.actionQueue   = pick('#actionQueueContent','#actionQueueSection .feed-content');

  // Modals / overlays
  dom.quizModal     = pick('#quizModal');
  dom.paywallModal  = pick('#paywallModal');
  dom.dimOverlay    = pick('#dimOverlay', '.dim-overlay');

  // Optional placeholder section
  dom.searchingState = pick('.searching-state');
}

const FOCUSABLE_SEL = [
  'button', '[href]', 'input', 'select', 'textarea',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusFirst(el) {
  if (!el) return;
  const t = el.querySelector(FOCUSABLE_SEL) || el;
  // Ensure element can receive focus
  const hadTabIndex = t.hasAttribute('tabindex');
  if (!hadTabIndex) t.setAttribute('tabindex', '-1');
  t.focus({ preventScroll: true });
  if (!hadTabIndex) t.removeAttribute('tabindex');
}

function getContent(sectionEl) {
  return sectionEl?.querySelector('.feed-content');
}

export function hideSectionAccessibly(el, focusTarget = null) {
  if (!el) return;
  // If focus is inside el, move it out first
  if (el.contains(document.activeElement)) {
    if (focusTarget) focusFirst(focusTarget);
    else { document.activeElement?.blur?.(); focusFirst(document.body); }
  }
  // Prefer inert; no need for aria-hidden when inert is present
  el.setAttribute('inert', '');
  el.classList.add('hidden');
  el.style.display = 'none';
}

export function showSectionAccessibly(el) {
  if (!el) return;
  el.removeAttribute('inert');
  el.classList.remove('hidden');
  el.style.display = '';
}

// ——— Render helpers ———
export function showWelcome() {
  dom.landingScreen?.classList.remove('hidden');
  dom.mainApp?.classList.add('hidden');
}

export function showDashboard() {
    cacheDom();

  // Hide landing safely; move focus into the main app before inert’ing landing
  if (dom.landing) hideSectionAccessibly(dom.landing, dom.mainApp || document.body);

  // Show main UI
  if (dom.mainApp) showSectionAccessibly(dom.mainApp), (dom.mainApp.style.display = 'flex');
  if (dom.accordion) dom.accordion.style.display = 'flex';

  document.querySelectorAll('.searching-state').forEach(el => el.style.display = 'none');

  try { initAccordion?.(); } catch {}
}

// Fallback you can call anywhere
export function forceDashboardVisible() {
  document.querySelectorAll('.main-app').forEach(el => el.style.display = 'flex');
  document.querySelector('#accordionContainer')?.style.setProperty('display','flex');
}



function ensureMetricGrid() {
  const header = $('#metricsHeader') || $('.metrics-header');
  let grid = $('#metricsGrid') || $('.metrics-grid');

  if (!grid) {
    // If your header doesn't already contain the grid, create it
    if (header) {
      header.insertAdjacentHTML('beforeend', `<div class="metrics-grid" id="metricsGrid"></div>`);
      grid = $('#metricsGrid');
    }
  }

  if (!grid) return { header, grid: null };

  // If the grid has no cards yet, inject them once
  if (!grid.querySelector('[data-metric]')) {
    grid.innerHTML = [
      { key: 'matches',         label: 'Matches found',        val: '0' },
      { key: 'potentialAwards', label: 'Potential awards',     val: '$0' },
      { key: 'started',         label: 'Applications started', val: '0' },
      { key: 'readyNow',        label: 'Ready to apply now',   val: '0' },
      { key: 'nextDeadline',    label: 'Next deadline',        val: '—' },
      { key: 'timeSavedMin',    label: 'Time saved',           val: '0m' }
    ].map(t => `
      <div class="metric-card" data-metric="${t.key}">
        <div class="metric-value">${t.val}</div>
        <div class="metric-label">${t.label}</div>
      </div>
    `).join('');
  }

  return { header, grid };
}


function animateNumber(el, to, fmt, duration = 400) {
  // Read previous numeric value from dataset or parsed text
  const from = parseFloat(el.dataset.val ?? el.textContent.replace(/[^\d.]/g, '')) || 0;
  const start = performance.now();

  const tick = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const v = from + (to - from) * p;
    el.textContent = fmt(v);
    if (p < 1) requestAnimationFrame(tick);
    else el.dataset.val = String(to);
  };
  requestAnimationFrame(tick);
}

// tiny helpers
function cell(key) {
  return document.querySelector(`[data-metric="${key}"] .metric-value`);
}
const money = (v) => `$${Math.round(Number(v || 0)).toLocaleString()}`;

function pulse(el, ms = 280) {
  if (!el) return;
  el.classList.remove('updating');  // restart if already animating
  // force reflow to retrigger CSS animation
  void el.offsetWidth;
  el.classList.add('updating');
  setTimeout(() => el.classList.remove('updating'), ms);
}

export function renderMetrics({ animateKeys = ['matches','potentialAwards','started','readyNow','timeSavedMin'] } = {}) {
  const { header, grid } = ensureMetricGrid();
  ensureVisible(header);
  ensureVisible(grid, 'grid');

  const m = store.metrics || {};
  const money = v => `$${Math.round(Number(v || 0)).toLocaleString()}`;

  // Map desired outputs
  const targets = {
    matches:        { to: Number(m.matches || 0),            fmt: v => String(Math.round(v)) },
    potentialAwards:{ to: Number(m.potentialAwards || 0),    fmt: money },
    started:        { to: Number(m.started || 0),            fmt: v => String(Math.round(v)) },
    readyNow:       { to: Number(m.readyNow || 0),           fmt: v => String(Math.round(v)) },
    timeSavedMin:   { to: Number(m.timeSavedMin || 0),    fmt: v => formatTimeSaved(v) },
  };

  const DURATION = 400;

  for (const [key, cfg] of Object.entries(targets)) {
    const el = cell(key);
    if (!el) continue;

    // read previous numeric value from a dedicated dataset (no string parsing)
    const prevNum = el.dataset.num != null ? Number(el.dataset.num) : null;
    const nextNum = Number(cfg.to) || 0;
    const changed = prevNum === null ? true : (nextNum !== prevNum); // first render counts as change

    // ticker only if caller asked to animate AND the value changed
    const shouldAnim = animateKeys.includes(key) && changed;

    if (shouldAnim) {
      pulse(el);
      const start = performance.now();
      const from = prevNum == null ? 0 : prevNum; // animate from prior, or 0 on first
      const to = nextNum;

      const step = (t) => {
        const p = Math.min(1, (t - start) / DURATION);
        const v = from + (to - from) * p;
        el.textContent = cfg.fmt(v);
        if (p < 1) requestAnimationFrame(step);
        else {
          el.dataset.num = String(to);   // commit baseline for next tick
          el.textContent = cfg.fmt(to);
        }
      };
      requestAnimationFrame(step);
    } else if (changed) {
      // no ticker requested, but value changed — update instantly and pulse
      el.textContent = cfg.fmt(nextNum);
      el.dataset.num = String(nextNum);
      pulse(el);
    } else {
      // unchanged — leave as-is
    }
  }

  // Next deadline (text-only, pulse on change)
  const ndEl = cell('nextDeadline');
  if (ndEl) {
    const nextText = formatRelativeDeadline(m.nextDeadline);
    const prevText = ndEl.dataset.text ?? ndEl.textContent;
    if (nextText !== prevText) {
      ndEl.textContent = nextText;
      ndEl.dataset.text = nextText;
      pulse(ndEl);
    }
  }
}

export function addScholarshipCard(s) {
  if (!dom.liveFeed) return;
  const card = document.createElement('div');
  card.className = 'sch-card';
  card.dataset.id = s.id;
  card.dataset.state = s.state;
  card.innerHTML = `
    <div class="sch-head">
      <div class="sch-name">${s.name}</div>
      <div class="sch-award">$${Number(s.award).toLocaleString()}</div>
    </div>
    <div class="sch-deadline">Deadline: ${new Date(s.deadline).toLocaleDateString()}</div>
    <div class="sch-flags">
      ${s.essayRequired ? '<span class="flag">Essay</span>' : ''}
      ${s.transcriptRequired ? '<span class="flag">Transcript</span>' : ''}
    </div>
    <div class="sch-progress"><div class="bar"></div></div>
    <div class="sch-state">${s.state}</div>
  `;
  dom.liveFeed.prepend(card);
  animateIn(card);
  const live = document.getElementById('liveFeedSection');
  bumpExpandedHeight(live);
}

export function updateScholarshipCardState(id, state, progressPct = null) {
  const card = document.querySelector(`.sch-card[data-id="${id}"]`);
  if (!card) return;
  card.dataset.state = state;
  const stateEl = card.querySelector('.sch-state');
  if (stateEl) {
    const pretty = store.sm?.states?.[state]?.label || state;
    stateEl.textContent = pretty;
  }
  const bar = card.querySelector('.bar');
  if (bar && progressPct != null) {
    bar.style.width = `${progressPct}%`;
    bar.classList.remove('animating'); void bar.offsetWidth; bar.classList.add('animating');
  }
}


export function renderActionQueue(items) {
  if (!dom.actionQueue) return;
  dom.actionQueue.innerHTML = '';

  items.forEach(raw => {
    const item = resolveAction(raw.type, raw); // fill label/cta/modal/sticky from config

    const li = document.createElement('div');
    li.className = `aq-item ${item.sticky ? 'aq-sticky' : ''}`;
    li.dataset.type = item.type;
    li.innerHTML = `
      <div class="aq-label">${item.label}${item.count>1 ? ` <span class="aq-count">(${item.count})</span>` : ''}</div>
      <button class="aq-cta">${item.cta || 'Open'}</button>
    `;
    li.querySelector('.aq-cta').addEventListener('click', () => {
      if (item.modal === 'quiz') {
        bus.emit(EV.QUIZ_OPEN, { source: 'action-queue' });
      } else if (item.modal === 'paywall') {
        bus.emit(EV.PAYWALL_SHOW);
      } else {
        // Use input modal for all other action types
        openInputModalForAction(item.type, (val) => {
          // Set the appropriate flag and emit ACTION_COMPLETED
          if (item.type === 'uploadTranscript') {
            store.flags.add('transcriptUploaded');
          } else if (item.type === 'uploadEssay') {
            store.flags.add('essayUploaded');
          } else if (item.type === 'uploadHeadshot') {
            store.flags.add('headshotUploaded');
          } else if (item.type === 'uploadRecommendation') {
            store.flags.add('recommendationUploaded');
          } else if (item.type === 'inputCurrentSchoolLevel') {
            store.flags.add('schoolLevelInput');
          }
          bus.emit(EV.ACTION_COMPLETED, { type: item.type, value: val });
        });
      }
    });
    dom.actionQueue.appendChild(li);
  });
}


export function setSpotlight(active) {
  toggleDim(active && store.app?.spotlight?.enabled);
}

const overlayEl = () => document.querySelector('#dimOverlay');
let lastFocus = null;
// Any modal element that uses `.active` to show:
const ACTIVE_MODAL_SELECTOR = '.modal.active, .modal-overlay.active';

const isDismissible = (modal) => String(modal?.dataset?.dismissible ?? 'true') === 'true';
const allowEscClose = (modal) => String(modal?.dataset?.esc ?? 'true') === 'true';

function setSiblingsInert(el, on) {
  const rootKids = Array.from(document.body.children);
  rootKids.forEach(k => {
    if (k === el || k.id === 'dimOverlay') return;
    if (on) k.setAttribute('inert', '');
    else k.removeAttribute('inert');
  });
}

export function openModal(el) {
    if (!el) return;
  lastFocus = document.activeElement;
  setSiblingsInert(el, true);
  el.classList.remove('hidden');
  el.classList.add('active','in');
  document.querySelector('#dimOverlay')?.classList.add('active');
  // focus first focusable inside modal
  const first = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .modal-content');
  if (first) focusFirst(first);
}

export function closeModal(el) {
  if (!el) return;
  el.classList.remove('in','active');
  el.classList.add('hidden');

  // If no other modals are open, clear dim + uninert page
  if (!document.querySelector(ACTIVE_MODAL_SELECTOR)) {
    document.querySelector('#dimOverlay')?.classList.remove('active');
    setSiblingsInert(el, false);
    // restore focus to the control that opened the modal, if still in DOM
    if (lastFocus && document.contains(lastFocus)) {
      focusFirst(lastFocus);
    }
  }
}

// Wiring for quiz/paywall modals (simple)
export function bindModalClose() {
  $$('.modal .close, .modal .x').forEach(btn => {
    btn.addEventListener('click', e => {
      const modal = e.target.closest('.modal');
      closeModal(modal);
      setSpotlight(false);
    });
  });
}

// Init UI & listeners
export function initUI() {
  cacheDom();

  // Backdrop click on each modal overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target !== overlay) return;          // ignore clicks inside .modal-content
      if (!isDismissible(overlay)) {
        nudge(overlay.querySelector('.modal-content')); // little feedback
        return;
      }
      closeModal(overlay);
      setSpotlight(false);
    });
  });

  // Global dim overlay also closes the *topmost* dismissible modal
  dom.dimOverlay?.addEventListener('click', () => {
    const open = Array.from(document.querySelectorAll('.modal-overlay.active'));
    const top = open.at(-1);
    if (!top) return;
    if (!isDismissible(top)) { nudge(top.querySelector('.modal-content')); return; }
    closeModal(top);
    setSpotlight(false);
  });

  // ESC to close only if that modal allows it
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = Array.from(document.querySelectorAll('.modal-overlay.active'));
    const top = open.at(-1);
    if (!top) return;
    if (!allowEscClose(top)) { nudge(top.querySelector('.modal-content')); return; }
    closeModal(top);
    setSpotlight(false);
  });

  // Existing bus listeners…
  bus.on(EV.ACTIONQ_UPDATED, items => renderActionQueue(items));
  bus.on(EV.QUIZ_OPEN, () => { setSpotlight(false); openModal(dom.quizModal); });
  bus.on(EV.PAYWALL_SHOW, () => { setSpotlight(false); openModal(dom.paywallModal); });

  // Initialize the accordion once the DOM is ready
  initAccordion();
}

export function bindStart(handler) {
  cacheDom();
  if (!dom.startBtn) {
    console.warn('[ui] Start button not found. Check #startButton/#startBtn selectors.');
    return;
  }
  dom.startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handler();
  }, { once: true });
}

// Accordion stuff

let accordionInited = false;

// Set preview heights per-section (tweak to taste)
const PREVIEW_HEIGHTS = {
  liveFeedSection: 220,      // enough to show ~1 card (maybe 1.5)
  actionQueueSection: 240    // enough to show a couple of queue items
};

function sectionParts(sectionEl) {
  return {
    section: sectionEl,
    header: sectionEl.querySelector('.feed-header'),
    content: sectionEl.querySelector('.feed-content'),
    toggle:  sectionEl.querySelector('.feed-toggle'),
    id: sectionEl?.id
  };
}

function collapsedHeightFor(sectionEl) {
  const id = sectionEl?.id || '';
  return PREVIEW_HEIGHTS[id] ?? 240;  // fallback
}

function ensureToggle(headerEl, sectionEl, containerEl) {
  let btn = headerEl.querySelector('.feed-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'feed-toggle';
    btn.type = 'button';
    headerEl.appendChild(btn);
  }
  updateToggleVisual(btn, sectionEl.classList.contains('expanded'));
  btn.setAttribute('aria-controls', sectionEl.querySelector('.feed-content')?.id || '');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();                       // avoid double toggle
    toggleSection(sectionEl, containerEl);
    refreshAllToggles(containerEl);
  });
}

function updateToggleVisual(btn, expanded) {
  btn.textContent = expanded ? '–' : '+';      // plain glyphs, no circle
  btn.setAttribute('aria-expanded', String(expanded));
  btn.setAttribute('aria-label', expanded ? 'Collapse section' : 'Expand section');
}

function setExpandedState(sectionEl, expanded) {
  const { header, content } = sectionParts(sectionEl);
  if (!content || !header) return;

  if (expanded) {
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.overflow = 'auto';
    sectionEl.classList.add('expanded');
    sectionEl.classList.remove('collapsed');
  } else {
    content.style.maxHeight = collapsedHeightFor(sectionEl) + 'px';  // show preview
    content.style.overflow = 'hidden';
    sectionEl.classList.remove('expanded');
    sectionEl.classList.add('collapsed');
  }

  header.setAttribute('aria-expanded', String(expanded));
}

function expandSection(sectionEl)   { setExpandedState(sectionEl, true);  }
function collapseSection(sectionEl) { setExpandedState(sectionEl, false); }

function toggleSection(sectionEl, containerEl) {
  const sections = Array.from(containerEl.querySelectorAll('.feed-section'));
  const isExpanded = sectionEl.classList.contains('expanded');

  if (isExpanded) {
    // Find the other section and expand it
    const other = sections.find(s => s !== sectionEl);
    if (other) {
      collapseSection(sectionEl);
      expandSection(other);
    } else {
      // Edge case: only one section exists? Keep it expanded.
      expandSection(sectionEl);
    }
  } else {
    // Expand this one, collapse the rest
    sections.forEach(s => {if(s!==sectionEl) {collapseSection(s)}});
    expandSection(sectionEl);
  }

  // Update the +/- indicators
  refreshAllToggles(containerEl);
}

function refreshAllToggles(containerEl) {
  containerEl.querySelectorAll('.feed-section').forEach(sec => {
    const btn = sec.querySelector('.feed-toggle');
    if (btn) updateToggleVisual(btn, sec.classList.contains('expanded'));
  });
}

export function initAccordion() {
  if (accordionInited) return;
  accordionInited = true;

  const container = document.querySelector('#accordionContainer');
  if (!container) return;

  const live  = document.querySelector('#liveFeedSection');
  const queue = document.querySelector('#actionQueueSection');
  const liveHeader  = document.querySelector('#liveFeedHeader');
  const queueHeader = document.querySelector('#actionQueueHeader');

  // Initial heights based on current classes
  [live, queue].forEach(sec => {
    if (!sec) return;
    const content = sec.querySelector('.feed-content');
    if (!content) return;
    if (sec.classList.contains('expanded')) {
      content.style.maxHeight = content.scrollHeight + 'px';
      sec.classList.add('expanded');
      sec.classList.remove('collapsed');
    } else {
      content.style.maxHeight = collapsedHeightFor(sec) + 'px';
      sec.classList.add('collapsed');
      sec.classList.remove('expanded');
    }
  });

  // Ensure exactly one starts expanded
  const sections = [live, queue].filter(Boolean);
  const anyExpanded = sections.some(s => s.classList.contains('expanded'));
  if (!anyExpanded && sections.length) {
    // expand the first by default and collapse the other
    expandSection(sections[0]);
    sections.slice(1).forEach(s => collapseSection(s));
  }


  // Turn headers into toggles (one-line)
  if (liveHeader && live) {
    liveHeader.setAttribute('role', 'button');
    liveHeader.setAttribute('aria-controls', 'liveFeedContent');
    liveHeader.setAttribute('aria-expanded', String(live.classList.contains('expanded')));
    ensureToggle(liveHeader, live, container);
    liveHeader.addEventListener('click', () => {
      toggleSection(live, container);
      refreshAllToggles(container);
    });
  }

  if (queueHeader && queue) {
    queueHeader.setAttribute('role', 'button');
    queueHeader.setAttribute('aria-controls', 'actionQueueContent');
    queueHeader.setAttribute('aria-expanded', String(queue.classList.contains('expanded')));
    ensureToggle(queueHeader, queue, container);
    queueHeader.addEventListener('click', () => {
      toggleSection(queue, container);
      refreshAllToggles(container);
    });
  }

  // Keep expanded maxHeight correct when window resizes or content grows
  const refreshExpandedHeights = () => {
    [live, queue].forEach(sec => {
      if (!sec) return;
      const content = sec.querySelector('.feed-content');
      if (!content) return;
      if (sec.classList.contains('expanded')) {
        // recompute to fit new content size
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        // keep collapsed preview consistent
        content.style.maxHeight = collapsedHeightFor(sec) + 'px';
      }
    });
  };

  window.addEventListener('resize', refreshExpandedHeights);

  // Optional: when feed content changes dynamically, refresh height
  const ro = new ResizeObserver(refreshExpandedHeights);
  if (live?.querySelector('.feed-content')) ro.observe(live.querySelector('.feed-content'));
  if (queue?.querySelector('.feed-content')) ro.observe(queue.querySelector('.feed-content'));
}

export function forceLiveFeedOpen() {
  const live = document.getElementById('liveFeedSection');
  const queue = document.getElementById('actionQueueSection');
  if (!live) return;

  // Collapse the queue for mutual exclusivity
  if (queue) collapseSection(queue, 240); // keep a 140px preview if you want

  // Expand the live feed and clear any stale inline max-height
  expandSection(live);

  // If an old inline max-height (like 12px) is present and no transition is running,
  // stamp it out immediately:
  const content = live.querySelector('.feed-content');
  if (content && getComputedStyle(content).transitionProperty.indexOf('max-height') === -1) {
    content.style.maxHeight = '';     // remove the stale inline value
  }
}

export function ensureVisible(el, displayIfNone = '') {
  if (!el) return;
  el.classList.remove('hidden');
  el.removeAttribute('inert');
  const cs = getComputedStyle(el);
  if (cs.display === 'none') el.style.display = displayIfNone; // e.g. "grid" for grid
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function bumpExpandedHeight(sectionEl) {
  const content = getContent(sectionEl);
  if (!content) return;
  if (!sectionEl.classList.contains('expanded')) return;
  // Only bump if we’re still using a numeric height (transitioning)
  const mh = content.style.maxHeight;
  if (mh && mh !== '' && mh !== 'none') {
    content.style.maxHeight = `${content.scrollHeight}px`;
  }
}


// ui.js (top or near other helpers)

function plural(n, one, many) { return n === 1 ? one : many; }

// Next-deadline: "in D days" / "in W weeks" / "in M months"
export function formatRelativeDeadline(deadlineISO) {
  if (!deadlineISO) return '—';
  const now = new Date();
  const dl  = new Date(deadlineISO);
  const ms  = dl - now;

  // past or today
  if (ms <= 0) return 'today';

  const days = Math.floor(ms / 86400000); // 86_400_000 ms in a day

  if (days < 1) return 'today'; // later today edge case
  if (days < 14) {
    return `in ${days} ${plural(days, 'day', 'days')}`;
  }
  if (days < 31) {
    const weeks = Math.floor(days / 7);
    return `in ${weeks} ${plural(weeks, 'week', 'weeks')}`;
  }
  const months = Math.floor(days / 30); // approximate months
  return `in ${months} ${plural(months, 'month', 'months')}`;
}

// Time-saved: 0–59min; 1h0m–9h59m; 10hr–999hr; 1k hours+
export function formatTimeSaved(totalMinutes) {
  const min = Math.max(0, Math.floor(Number(totalMinutes || 0)));
  if (min < 60) return `${min}min`;

  const hours = min / 60;

  if (hours < 10) {
    const h = Math.floor(hours);
    const m = Math.floor(min - h * 60);
    return `${h}h${m.toString().padStart(1, '0')}m`;
  }

  if (hours < 1000) {
    const h = Math.floor(hours);
    return `${h}hr`;
  }

  // 1000h and up → "1k hours", "1.2k hours", "12k hours"
  const k = hours / 1000;
  const label = k < 10 ? `${k.toFixed(1)}k` : `${Math.round(k)}k`;
  return `${label} hours`;
}
