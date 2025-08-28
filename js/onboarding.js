// js/onboarding.js
import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import * as UI from './ui.js';
import * as Scholarships from './scholarships.js';

const $ = (s, r=document) => r.querySelector(s);

// Utility: ensure overlay exists
function ensureOverlay() {
  let el = $('#searchIntroOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'searchIntroOverlay';
    el.innerHTML = `
      <div class="search-intro-text">
        <span>Searching for scholarships</span>
        <span class="search-intro-ellipses">
          <span></span><span></span><span></span>
        </span>
      </div>`;
    document.body.appendChild(el);
  }
  return el;
}

// Compute transform needed to center card (FLIP)
function centerTransformFor(el) {
  const r = el.getBoundingClientRect();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = cx - (r.left + r.width / 2);
  const dy = cy - (r.top + r.height / 2);
  return `translate(${dx}px, ${dy}px)`;
}

function once(el, event) {
  return new Promise(res => {
    const fn = (e) => { el.removeEventListener(event, fn); res(e); };
    el.addEventListener(event, fn, { once: true });
  });
}

// helper: read a CSS time var ('350ms' | '.35s' | '350')
function msFromCSSVar(name, fallback = 350){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  if (v.endsWith('ms')) return parseFloat(v);
  if (v.endsWith('s'))  return parseFloat(v) * 1000;
  const n = parseFloat(v); return Number.isFinite(n) ? n : fallback;
}

export async function runOnboarding() {
  const cfg = store.app?.onboarding || {};
  const introMs = Math.max(0, cfg.searchIntroMs ?? 1400);
  const finishCond = cfg.finishOn || { type: 'stateReached', state: 'matched' };

  UI.showDashboard();
  UI.forceLiveFeedOpen?.();               // expand live feed, avoid max-height clipping
  document.body.classList.add('onboarding-active');

  const overlay = ensureOverlay();
  overlay.classList.add('active');
  if (introMs > 0) await new Promise(r => setTimeout(r, introMs));
  overlay.classList.remove('active');

  // Ensure a first scholarship exists (ignorePause so we can create it while paused)
  let firstInst = store.scholarships[0];
  if (!firstInst) firstInst = Scholarships.spawnNextNow({ ignorePause: true });

  const card = await waitForCard(firstInst?.id, 1500);
  if (!card) {
    console.warn('[onboarding] Card not found, bailing out.');
    document.body.classList.remove('onboarding-active');
    Scholarships.setSpawningPaused(false);
    return;
  }

  console.log('[onboarding] Starting intro animation for card', firstInst?.id);
  // --- no-flash centering sequence ---
  card.classList.add('intro-card');        // hero (still hidden by CSS)

  // === DEBUG FREEZE: keep the card visible at its natural spot ===
  const freezeMs =
    (store.app?.onboarding?.debugFreezeBeforeCenterMs ?? 0) ||
    (window.__ONBOARDING_FREEZE_MS ?? 0);

  if (freezeMs > 0) {
    console.info(`[onboarding] Debug freeze BEFORE center for ${freezeMs}ms`);
    // Make sure it's visible and not animating
    card.classList.add('intro-freeze');
    await new Promise(r => setTimeout(r, freezeMs));
    card.classList.remove('intro-freeze');
  }

  console.log('[onboarding] Card found, starting centering animation.');
  await new Promise(r => requestAnimationFrame(r)); // wait a frame for class to apply
  // apply center transform BEFORE we show it
  card.style.transition = 'none';
  console.log('[onboarding] Card centered instantly (no transition).');
  card.style.transform = centerTransformFor(card);  // instant place at center
  // commit styles this frame
  await new Promise(r => requestAnimationFrame(r));
  // turn transitions back on for later animations
  card.style.transition = 'transform .45s ease, opacity .25s ease';
  // now allow it to be seen (still centered, so no “snap”)
  card.classList.add('intro-visible');

  document.documentElement.style.setProperty('--feed-transition', 'all 0.3s ease');

  // --- wait for finish condition robustly ---
  await new Promise(resolve => {
    if (finishCond.type === 'afterMs') {
      setTimeout(resolve, Math.max(0, finishCond.ms || 1500));
      return;
    }

    if (finishCond.type === 'stateReached') {
      const target = finishCond.state;

      // if already there (e.g., fast path), resolve immediately
      if (firstInst?.state === target) { resolve(); return; }

      const onAdvance = ({ id, to, state }) => {
        const newState = to ?? state;
        if (id === firstInst?.id && newState === target) {
          bus.off?.(EV.SCH_ADVANCED, onAdvance);
          bus.off?.(EV.SCH_BLOCKED, onBlocked);
          resolve();
        }
      };
      const onBlocked = ({ id, state }) => {
        if (id === firstInst?.id && state === target) {
          bus.off?.(EV.SCH_ADVANCED, onAdvance);
          bus.off?.(EV.SCH_BLOCKED, onBlocked);
          resolve();
        }
      };
      bus.on(EV.SCH_ADVANCED, onAdvance);
      bus.on?.(EV.SCH_BLOCKED, onBlocked);

      // safety: also poll in case we missed an event
      const poll = setInterval(() => {
        if (firstInst?.state === target) {
          clearInterval(poll);
          bus.off?.(EV.SCH_ADVANCED, onAdvance);
          bus.off?.(EV.SCH_BLOCKED, onBlocked);
          resolve();
        }
      }, 120);
      return;
    }

    setTimeout(resolve, 1200);
  });

  // animate back to the feed position (FLIP back)
  card.style.transform = 'translate(0, 0)';
  await once(card, 'transitionend');

  // reveal the rest of the dashboard
  const revealMs = msFromCSSVar('--onb-reveal-rest', 350);
  document.body.classList.add('onboarding-revealing');  // enables transition
  document.body.classList.remove('onboarding-active');  // opacity rules lift → fade happens
  await new Promise(r => setTimeout(r, revealMs));
  document.body.classList.remove('onboarding-revealing');
  card.classList.remove('intro-visible'); // hero now behaves like a normal card

  // make sure metrics are rendered/populated post-intro
  UI.renderMetrics?.();

  // resume the feed
  if (cfg.pauseFeedDuringIntro !== false) Scholarships.setSpawningPaused(false);
}

// Helper: wait for specific card to exist in DOM
async function waitForCard(id, timeoutMs = 1500) {
  if (!id) return null;
  let t = 0;
  const step = 50;
  return await new Promise(resolve => {
    const tryFind = () => {
      const el = document.querySelector(`.sch-card[data-id="${id}"]`);
      if (el) return resolve(el);
      t += step;
      if (t >= timeoutMs) return resolve(null);
      requestAnimationFrame(tryFind);
    };
    tryFind();
  });
}
