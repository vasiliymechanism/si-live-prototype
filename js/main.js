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
import { runOnboarding } from './onboarding.js';
import './metrics.js';
import { baselineFromStore } from './metrics.js';

window.app = {
  store, UI, Scholarships, Quiz, bus, EV,
  // handy console helpers:
  showWelcome: UI.showWelcome,
  showDashboard: UI.showDashboard,
  openQuiz: () => bus.emit(EV.QUIZ_OPEN),
  showPaywall: () => bus.emit(EV.PAYWALL_SHOW)
};

let paywallListenerAttached = false;

function attachPaywallTriggersOnce() {
  if (paywallListenerAttached) return;

  const onQuizCompleted = () => {
    console.log('[paywall] Quiz completed event received.');
    renderMetrics();

    const mode = store.app.paywallTrigger?.mode || 'afterQuiz';
    if (mode === 'afterQuiz') {
      Scholarships.addAction('paywallCTA', { sticky: true });
      console.info('[paywall] Enqueued sticky paywall CTA (afterQuiz).');
    }
  };

  bus.on(EV.QUIZ_COMPLETED, onQuizCompleted);
  paywallListenerAttached = true;
}


// Helper to try two loads in order, returning the first that succeeds
// Suppresses the error from the first if the fallback succeeds, but logs if both fail
async function tryBothLoads(primary, fallback) {
  try {
    return await loadJSONC(primary);
  } catch (error1) {
    try {
      return await loadJSONC(fallback);
    } catch (error2) {
      // If both fail, log both errors
      console.error(`Failed to load both configs: ${primary} and ${fallback}`);
      console.error('Primary error:', error1);
      console.error('Fallback error:', error2);
      throw error2;
    }
  }
}

async function boot() {
  initUI();
  initQuizEngine();

  // Load configs
  const [app, sm, actions, paywall, quiz, catalog] = await Promise.all([
    tryBothLoads('/si-live-prototype/data/app.jsonc', '/data/app.jsonc'),
    tryBothLoads('/si-live-prototype/data/stateMachine.jsonc', '/data/stateMachine.jsonc'),
    tryBothLoads('/si-live-prototype/data/actions.jsonc', '/data/actions.jsonc'),
    tryBothLoads('/si-live-prototype/data/paywall.jsonc', '/data/paywall.jsonc'),
    tryBothLoads('/si-live-prototype/data/quiz.jsonc', '/data/quiz.jsonc'),
    tryBothLoads('/si-live-prototype/data/scholarships.jsonc', '/data/scholarships.jsonc')
    // fetch('/data/scholarships.json').then(r => r.json())
  ]);

  Object.assign(store, { app, sm, actions, paywall, quiz, catalog, schSpawnIndex: 0 });
  store.rng = makeRNG(app.seed || 1);

  attachPaywallTriggersOnce();

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
  bindStart(async () => {
    // ensure no stale overlays
    document.querySelector('#dimOverlay')?.classList.remove('active');

    store.phase = 'onboarding';
    bus.emit(EV.PHASE_CHANGED, { phase: store.phase });


    // 🔒 Pause BEFORE starting the engine
    Scholarships.setSpawningPaused(true);

    console.log('[app] Start button clicked, onboarding phase begins.');
    showDashboard();        // uses inert-based hide now
    UI.renderMetrics?.();                  // ensure metrics appear
    console.log('[app] Dashboard shown.');

    initScholarships();
    console.log('[app] Scholarship engine initialized.');
    await runOnboarding();
    baselineFromStore({ animate: false });
    console.log('[app] Onboarding flow completed.');

    store.phase = 'steady';
    bus.emit(EV.PHASE_CHANGED, { phase: store.phase });


    // Default paywall trigger: after quiz completion
    bus.on(EV.QUIZ_COMPLETED, () => {
      console.log('[paywall] Quiz completed event received.');
      renderMetrics();

      const mode = store.app.paywallTrigger?.mode || 'afterQuiz';

      if (mode === 'afterQuiz') {
        // Instead of opening the modal now, add a sticky Action Queue item.
        // upsertAction is idempotent by type, so this won’t duplicate.
        Scholarships.addAction('paywallCTA', { sticky: true });
        console.info('[paywall] Enqueued sticky paywall CTA (afterQuiz).');
      }

      // (You can add other modes here later: afterNMatches, afterMs, etc.)
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
    }, 

    openQuizNow(opts = {}) {
      // Make sure dashboard is visible
      store.phase = 'steady';
      UI.showDashboard();
      document.querySelectorAll('.main-app').forEach(el => { el.style.display = 'flex'; });
      document.querySelectorAll('.accordion-container').forEach(el => { el.style.display = 'flex'; });
      document.querySelectorAll('.searching-state').forEach(el => { el.style.display = 'none'; });

      // optional: clear completed flag so blockers behave
      store.flags.delete('quizCompleted');

      // Ensure a sticky action is visible (optional, purely visual)
      if (opts.ensureSticky !== false && !document.querySelector('.aq-item[data-type="updateProfileViaQuiz"]')) {
        UI.renderActionQueue([{ type: 'updateProfileViaQuiz', sticky: true, count: 1 }]);
      }

      // Fire event WITH skipIntro so the first actual question renders at once
      bus.emit(EV.QUIZ_OPEN, { source: 'debug', skipIntro: true });

      // Open modal + dim overlay (your CSS uses `.active`)
      const modal = document.querySelector('#quizModal');
      UI.openModal(modal);

      console.info('[debug] Quiz modal opened (skipIntro=true).');
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
