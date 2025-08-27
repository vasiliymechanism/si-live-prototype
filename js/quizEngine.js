import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { evaluateLogic } from './jsonlogic.js';
import { closeModal, setSpotlight } from './ui.js';

// Very simple renderer into #quizModal .content
const $ = sel => document.querySelector(sel);
let modal, content;

export function initQuizEngine() {
  modal = $('#quizModal');
  content = modal?.querySelector('.content');
  bus.on(EV.QUIZ_OPEN, openQuiz);
}

function openQuiz() {
  if (!modal || !content) return;
  // Reset transient state
  const cfg = store.quiz;
  let currentId = cfg.start;
  const answers = {}; // transient; copy into store.user at finish

  render();

  function render() {
    const q = cfg.questions[currentId];
    if (!q) return finish();
    content.innerHTML = ''; // clear

    if (q.type === 'interstitial') {
      renderInterstitial(q);
    } else if (q.type === 'single') {
      renderSingle(q);
    } else if (q.type === 'multi') {
      renderMulti(q);
    } else if (q.type === 'short' || q.type === 'long') {
      renderText(q);
    } else if (q.type === 'file') {
      renderFile(q);
    } else if (q.type === 'date') {
      renderDate(q);
    } else if (q.type === 'checkbox') {
      renderCheckbox(q);
    } else {
      content.textContent = `Unknown question type: ${q.type}`;
    }
  }

  function gotoNext(q, value) {
    if (q.var) answers[q.var] = value;

    // Compute next
    let next = q.next;
    if (next && typeof next === 'object' && ('if' in next)) {
      // JSONLogic-style conditional
      const pick = evaluateLogic(next, { ...store.user, ...answers });
      next = pick;
    }
    if (typeof next === 'function') next = next({ ...store.user, ...answers });

    if (!next || !cfg.questions[next]) return finish();
    currentId = next;
    render();
  }

  function finish() {
    // Merge into store.user
    Object.assign(store.user, answers);
    // Mark quiz completed
    store.flags.add('quizCompleted');
    // Close modal & undim
    modal.classList.remove('in');
    modal.classList.add('hidden');
    setSpotlight(false);
    // Notify world
    bus.emit(EV.QUIZ_COMPLETED, { answers });
  }

  // ——— Renderers ———
  function addTitleSub(q) {
    const h = document.createElement('div');
    h.className = 'q-head';
    h.innerHTML = `<h3>${q.title || ''}</h3>${q.subtitle ? `<p>${q.subtitle}</p>` : ''}`;
    content.appendChild(h);
  }

  function addNextButton(label = 'Continue', onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    content.appendChild(btn);
  }

  function renderInterstitial(q) {
    addTitleSub(q);
    addNextButton(q.cta || 'Continue', () => gotoNext(q, null));
  }

  function renderSingle(q) {
    addTitleSub(q);
    const list = document.createElement('div'); list.className = 'choices';
    (q.choices || []).forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = c.label ?? c;
      b.addEventListener('click', () => gotoNext(q, (c.value ?? c)));
      list.appendChild(b);
    });
    content.appendChild(list);
  }

  function renderMulti(q) {
    addTitleSub(q);
    const list = document.createElement('div'); list.className = 'choices';
    const chosen = new Set();
    (q.choices || []).forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = c.label ?? c;
      b.addEventListener('click', () => {
        const val = (c.value ?? c);
        if (chosen.has(val)) { chosen.delete(val); b.classList.remove('active'); }
        else { chosen.add(val); b.classList.add('active'); }
      });
      list.appendChild(b);
    });
    content.appendChild(list);
    addNextButton(q.cta || 'Next', () => gotoNext(q, Array.from(chosen)));
  }

  function renderText(q) {
    addTitleSub(q);
    const input = document.createElement(q.type === 'long' ? 'textarea' : 'input');
    input.placeholder = q.placeholder || '';
    input.className = 'text';
    content.appendChild(input);
    addNextButton('Next', () => {
      const val = input.value?.trim();
      // Optional JSONLogic validation: e.g., { ">=": [ { "var":"value" }, 0 ] }
      if (q.validate && !evaluateLogic({ 'and': [ q.validate ] }, { value: parseFloat(val) || val })) {
        alert('Please check your input.');
        return;
      }
      gotoNext(q, val);
    });
  }

  function renderFile(q) {
    addTitleSub(q);
    const input = document.createElement('input');
    input.type = 'file';
    if (q.multiple) input.multiple = true;
    content.appendChild(input);
    addNextButton('Upload', () => {
      // Demo: we don't actually upload; we just record a flag
      gotoNext(q, (input.files?.length || 0));
    });
  }

  function renderDate(q) {
    addTitleSub(q);
    const input = document.createElement('input');
    input.type = 'date';
    content.appendChild(input);
    addNextButton('Next', () => gotoNext(q, input.value || null));
  }

  function renderCheckbox(q) {
    addTitleSub(q);
    const wrap = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    wrap.appendChild(cb);
    wrap.append(' ', document.createTextNode(q.label || ''));
    content.appendChild(wrap);
    addNextButton('Next', () => gotoNext(q, cb.checked));
  }
}
