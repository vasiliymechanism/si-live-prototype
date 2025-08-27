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

// ui.js
// import { resolveAction } from './actionResolver.js';

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

export function openModal(el) {
  el?.classList.remove('hidden');
  setTimeout(() => el?.classList.add('in'), 0);
}
export function closeModal(el) {
  el?.classList.remove('in');
  el?.classList.add('hidden');
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
  bindModalClose();

  // Action queue re-render
  bus.on(EV.ACTIONQ_UPDATED, items => renderActionQueue(items));

  // Quiz modal
  bus.on(EV.QUIZ_OPEN, () => {
    setSpotlight(true);
    openModal(dom.quizModal);
  });

  // Paywall
  bus.on(EV.PAYWALL_SHOW, () => {
    setSpotlight(true);
    openModal(dom.paywallModal);
  });

  // Close modals by clicking the dim overlay
  dom.dimOverlay?.addEventListener('click', () => {
    closeModal(dom.quizModal);
    closeModal(dom.paywallModal);
    setSpotlight(false);
  });

  bus.on(EV.ACTIONQ_UPDATED, items => renderActionQueue(items));
  bus.on(EV.QUIZ_OPEN, () => { setSpotlight(true); openModal(dom.quizModal); });
  bus.on(EV.PAYWALL_SHOW, () => { setSpotlight(true); openModal(dom.paywallModal); });
}

export function bindStart(onStart) {
  dom.startBtn?.addEventListener('click', onStart);
}
