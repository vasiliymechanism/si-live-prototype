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



export function renderMetrics() {
  const m = store.metrics;
  const next = m.nextDeadline ? new Date(m.nextDeadline).toLocaleDateString() : '—';
  const header = $('#metricsHeader') || $('.metrics-header');

  const tiles = [
    { key: 'matches',           label: 'Matches found',        value: m.matches },
    { key: 'potentialAwards',   label: 'Potential awards',     value: `$${(m.potentialAwards||0).toLocaleString()}` },
    { key: 'started',           label: 'Applications started', value: m.started },
    { key: 'readyNow',          label: 'Ready to apply now',   value: m.readyNow },
    { key: 'nextDeadline',      label: 'Next deadline',        value: next },
    { key: 'timeSavedMin',      label: 'Time saved',           value: `${(m.timeSavedMin||0).toFixed(1)} min` }
  ];

  if (!dom.metricsGrid) return;
  dom.metricsGrid.innerHTML = tiles.map(t => `
    <div class="metric-card" data-metric="${t.key}">
      <div class="metric-value">${t.value}</div>
      <div class="metric-label">${t.label}</div>
    </div>
  `).join('');

  ensureVisible(header);
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
      } else if (item.type === 'uploadTranscript') {
        store.flags.add('transcriptUploaded');
        bus.emit(EV.ACTION_COMPLETED, { type: 'uploadTranscript' });
      } else if (item.type === 'uploadEssay') {
        store.flags.add('essayUploaded');
        bus.emit(EV.ACTION_COMPLETED, { type: 'uploadEssay' });
      } else {
        alert(`TODO: ${item.type}`);
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
  actionQueueSection: 140    // enough to show a couple of queue items
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
  return PREVIEW_HEIGHTS[id] ?? 160;  // fallback
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
    // Collapse all, then expand the clicked one
    sections.forEach(s => collapseSection(s));
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
  if (queue) collapseSection(queue, 140); // keep a 140px preview if you want

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