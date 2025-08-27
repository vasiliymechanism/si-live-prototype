import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { animateIn, toggleDim } from './animations.js';
import { resolveAction } from './actionResolver.js';

// Cache DOM nodes once
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const dom = {};
function cacheDom() {
  dom.startBtn        = $('#startButton');
  dom.landingScreen   = $('#landingScreen');
  dom.mainApp         = $('#mainApp');

  dom.metricsHeader   = $('#metricsHeader');
  dom.metricsGrid     = $('#metricsGrid');

  dom.contentArea     = $('#contentArea');
  dom.liveFeed        = $('#liveFeedContent');
  dom.actionQueue     = $('#actionQueueContent');

  dom.quizModal       = $('#quizModal');
  dom.paywallModal    = $('#paywallModal');

  // dom.dimOverlay      = $('#dimOverlay');
}

// ——— Render helpers ———
export function showWelcome() {
  dom.landingScreen?.classList.remove('hidden');
  dom.mainApp?.classList.add('hidden');
}

export function showDashboard() {
  dom.landingScreen?.classList.add('hidden');
  dom.mainApp?.classList.remove('hidden');
  dom.metricsHeader?.classList.remove('hidden'); // reveal metrics area
}


export function renderMetrics() {
  const m = store.metrics;
  const next = m.nextDeadline ? new Date(m.nextDeadline).toLocaleDateString() : '—';

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
}

export function updateScholarshipCardState(id, state, progressPct = null) {
  const card = dom.liveFeed?.querySelector(`.sch-card[data-id="${id}"]`);
  if (!card) return;
  card.dataset.state = state;
  const stateEl = card.querySelector('.sch-state');
  if (stateEl) stateEl.textContent = state;
  const bar = card.querySelector('.bar');
  if (bar && progressPct != null) bar.style.width = `${progressPct}%`;
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
      if (item.modal === 'quiz') bus.emit(EV.QUIZ_OPEN, { source: 'action-queue' });
      else if (item.modal === 'paywall') bus.emit(EV.PAYWALL_SHOW);
      else alert(`TODO: ${item.type}`);
    });
    dom.actionQueue.appendChild(li);
  });
}


export function setSpotlight(active) {
  toggleDim(active && store.app?.spotlight?.enabled);
}

const overlayEl = () => document.querySelector('#dimOverlay');
// Any modal element that uses `.active` to show:
const ACTIVE_MODAL_SELECTOR = '.modal.active, .modal-overlay.active';

const isDismissible = (modal) => String(modal?.dataset?.dismissible ?? 'true') === 'true';
const allowEscClose = (modal) => String(modal?.dataset?.esc ?? 'true') === 'true';

export function openModal(el) {
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('active','in');

  // Optional: hide a close button if present
  if (el.dataset.hideClose === 'true') {
    el.querySelectorAll('.modal-close,.x,.close').forEach(btn => btn.classList.add('hidden'));
  }

  overlayEl()?.classList.add('active');
}

export function closeModal(el) {
  if (!el) return;
  el.classList.remove('in','active');
  el.classList.add('hidden');
  // turn off dim only if no other modal is open
  if (!document.querySelector(ACTIVE_MODAL_SELECTOR)) {
    overlayEl()?.classList.remove('active');
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
  bus.on(EV.QUIZ_OPEN, () => { setSpotlight(true); openModal(dom.quizModal); });
  bus.on(EV.PAYWALL_SHOW, () => { setSpotlight(true); openModal(dom.paywallModal); });

  // Initialize the accordion once the DOM is ready
  initAccordion();
}

export function bindStart(onStart) {
  dom.startBtn?.addEventListener('click', onStart);
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
