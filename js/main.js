import { loadJSONC } from './configLoader.js';
import { makeRNG } from './rng.js';
import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { initUI, showWelcome, showDashboard, bindStart, setSpotlight, renderMetrics } from './ui.js';
import { initScholarships } from './scholarships.js';
import { initQuizEngine } from './quizEngine.js';

// main.js (top-level, after other imports)
import * as UI from './ui.js';
import * as Scholarships from './scholarships.js';
import * as Quiz from './quizEngine.js';
// import { bus, EV } from './eventBus.js';
// import { store } from './store.js';

window.app = {
  store, UI, Scholarships, Quiz, bus, EV,
  // handy console helpers:
  showWelcome: UI.showWelcome,
  showDashboard: UI.showDashboard,
  openQuiz: () => bus.emit(EV.QUIZ_OPEN),
  showPaywall: () => bus.emit(EV.PAYWALL_SHOW)
};

async function boot() {
  initUI();
  initQuizEngine();

  // Load configs
  const [app, sm, actions, paywall, quiz, catalog] = await Promise.all([
    loadJSONC('/data/app.jsonc'),
    loadJSONC('/data/stateMachine.jsonc'),
    loadJSONC('/data/actions.jsonc'),
    loadJSONC('/data/paywall.jsonc'),
    loadJSONC('/data/quiz.jsonc'),
    loadJSONC('/data/scholarships.jsonc')
    // fetch('/data/scholarships.json').then(r => r.json())
  ]);

  Object.assign(store, { app, sm, actions, paywall, quiz, catalog, schSpawnIndex: 0 });
  store.rng = makeRNG(app.seed || 1);

  // Phase: welcome
  store.phase = 'welcome';
  showWelcome();
  renderMetrics();
  bus.emit(EV.PHASE_STARTED, { phase: store.phase });

  // Hidden reset: Shift+R hold
  let downAt = null;
  window.addEventListener('keydown', e => {
    if (e.shiftKey && e.key === 'R' && !downAt) downAt = Date.now();
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'R') {
      if (downAt && Date.now() - downAt > (store.app.reset?.holdMs || 1200)) {
        localStorage.clear?.(); location.reload();
      }
      downAt = null;
    }
  });

  // Start handler
  bindStart(() => {
    // Phase change
    store.phase = 'onboarding';
    showDashboard();
    bus.emit(EV.PHASE_CHANGED, { phase: store.phase });

    // Respect blockMode + spotlight during quiz moments later
    setSpotlight(false);

    // Begin scholarship arrivals/advances
    initScholarships();

    // Default paywall trigger: after quiz completion
    bus.on(EV.QUIZ_COMPLETED, () => {
      renderMetrics();
      if ((store.app.paywallTrigger?.mode || 'afterQuiz') === 'afterQuiz') {
        bus.emit(EV.PAYWALL_SHOW);
      }
    });
  });

  // Metric updates: keep simple for now
  bus.on(EV.SCH_ADVANCED, () => renderMetrics());
  bus.on(EV.SCH_FOUND, () => renderMetrics());

  // DEV / DEBUG helpers
  window.app.debug = {
    showDashboardNow() {
      // 1) Reveal dashboard shell
      store.phase = 'steady';
      UI.showDashboard();

      // Force main app & accordion visible for dev
      document.querySelectorAll('.main-app').forEach(el => { el.style.display = 'flex'; });
      document.querySelectorAll('.accordion-container').forEach(el => { el.style.display = 'flex'; });
      document.querySelectorAll('.searching-state').forEach(el => { el.style.display = 'none'; });

      // 2) Render metrics (if you already have some)
      if (!store.metrics || !Number.isFinite(store.metrics.matches)) {
        store.metrics = { matches: 0, potentialAwards: 0, started: 0, readyNow: 0, nextDeadline: null, timeSavedMin: 0 };
      }
      UI.renderMetrics();

      // 3) Decide what to render in the feed
      const haveRenderedCardsAlready = !!document.querySelector('.sch-card');
      const haveRuntimeSch = (store.scholarships && store.scholarships.length > 0);
      const haveCatalog = (store.catalog && store.catalog.length > 0);

      if (!haveRenderedCardsAlready) {
        if (haveRuntimeSch) {
          // Render whatever is already in memory
          store.scholarships.forEach(s => UI.addScholarshipCard(s));
        } else if (haveCatalog) {
          // Use the first few items from your real catalog
          const take = Math.min(3, store.catalog.length);
          for (let i = 0; i < take; i++) {
            const raw = store.catalog[i];
            const s = {
              ...raw,
              state: raw.state || 'matched' // show something visible
            };
            store.scholarships.push(s);
            UI.addScholarshipCard(s);

            // bump simple metrics
            store.metrics.matches += 1;
            store.metrics.potentialAwards += Number(s.award) || 0;
            if (!store.metrics.nextDeadline || new Date(s.deadline) < new Date(store.metrics.nextDeadline)) {
              store.metrics.nextDeadline = s.deadline;
            }
          }
          console.info('[debug] Rendered cards from real catalog (no fake data).');
        } else {
          // No data at all → create a fake sample
          const s = {
            id: 'dev',
            name: 'Debug Scholarship',
            award: 1000,
            deadline: '2025-12-01',
            essayRequired: true,
            transcriptRequired: false,
            state: 'matched'
          };
          store.scholarships.push(s);
          UI.addScholarshipCard(s);

          // fake metrics so the tiles don’t look empty
          Object.assign(store.metrics, {
            matches: 1,
            potentialAwards: 1000,
            started: 1,
            readyNow: 0,
            nextDeadline: s.deadline,
            timeSavedMin: 5.0
          });

          console.warn('[debug] No catalog/scholarships found — using FAKE data for layout.');
        }
      }

      // Re-render metrics after any bump
      UI.renderMetrics();

      // 4) Action Queue: add a sticky item only if none exist already
      const haveAnyAQItems = !!document.querySelector('.aq-item');
      if (!haveAnyAQItems) {
        // UI.renderActionQueue([
        //   { type: 'updateProfileViaQuiz', label: 'Update profile', cta: 'Start quiz', modal: 'quiz', sticky: true, count: 1 }
        // ]);
        // console.info('[debug] Rendered a sticky Action Queue item.');
        UI.renderActionQueue([{ type: 'updateProfileViaQuiz', sticky: true, count: 1 }]);
      }
    },

    fakeMetrics() {
      Object.assign(store.metrics, {
        matches: 12,
        potentialAwards: 45000,
        started: 3,
        readyNow: 1,
        nextDeadline: '2025-11-01',
        timeSavedMin: 42.5
      });
      UI.renderMetrics();
    },

    addFakeScholarship() {
      const s = {
        id: `dev${Date.now()}`,
        name: 'Debug Scholarship',
        award: 1000,
        deadline: '2025-12-15',
        essayRequired: true,
        transcriptRequired: false,
        state: 'scanning'
      };
      store.scholarships.push(s);
      UI.addScholarshipCard(s);
    }
  };

}

boot().catch(err => {
  console.error(err);
  alert('Failed to load the demo. Check console for details.');
});


// import * as UI from './ui.js';
// import { store } from './store.js';

// window.app = { store, UI };
