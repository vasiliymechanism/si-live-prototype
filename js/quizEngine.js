import { store } from './store.js';
import { bus, EV } from './eventBus.js';
import { evaluateLogic } from './jsonlogic.js';
import { closeModal, setSpotlight } from './ui.js';

// Very simple renderer into #quizModal .content
const $ = sel => document.querySelector(sel);
let modal, content;

function makeFieldWrap(labelText, hintText) {
  const wrap = document.createElement('div');
  wrap.className = 'q-field';

  if (labelText) {
    const lbl = document.createElement('div');
    lbl.className = 'q-label';
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
  }

  if (hintText) {
    const hint = document.createElement('div');
    hint.className = 'q-hint';
    hint.textContent = hintText;
    wrap.appendChild(hint);
  }

  return wrap;
}

export function initQuizEngine() {
  modal = $('#quizModal');
  content =
    modal?.querySelector('#quizBody') ||      // your index.html body
    modal?.querySelector('.modal-body') ||    // fallback to modal-body
    modal?.querySelector('.content') ||       // old skeleton fallback
    modal;    
  bus.on(EV.QUIZ_OPEN, (payload) => openQuiz(payload));
}

function nextFrom(q, scope) {
  // handles q.next being a string or JSONLogic {if: [...]}
  if (!q.next) return null;
  if (typeof q.next === 'string') return q.next;
  if (typeof q.next === 'object' && 'if' in q.next) {
    return evaluateLogic(q.next, scope);
  }
  return null;
}

function firstNonInterstitial(cfg, startId, scope) {
  let id = startId;
  while (true) {
    const q = cfg.questions[id];
    if (!q) return id;
    if (q.type !== 'interstitial') return id;
    const nxt = nextFrom(q, scope);
    if (!nxt || !cfg.questions[nxt]) return id;
    id = nxt;
  }
}

function openQuiz(payload = {}) {
  const { skipIntro = false } = payload;

  const cfg = store.quiz;
  content.innerHTML = '';

  // local answers object (merged into store.user on finish)
  const answers = {};
  let currentId = cfg.start;

  // NEW: jump past interstitials if requested
  if (skipIntro) currentId = firstNonInterstitial(cfg, cfg.start, { ...store.user, ...answers });

  render();
  
  // if (!modal || !content) return;
  // // Reset transient state
  // const cfg = store.quiz;
  // let currentId = cfg.start;
  // const answers = {}; // transient; copy into store.user at finish

  // render();

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
    if (q.var) {
      answers[q.var] = value;
      store.user[q.var] = value; // update user immediately
    }

    // Emit a special event for file upload questions to allow blockers to clear immediately
    // Only emit if a file was actually uploaded (value > 0)
    if (q && q.type === 'file' && q.var && value && value > 0) {
      bus.emit(EV.QUIZ_FILE_UPLOADED, { var: q.var, value });
      console.log('[quiz] emitted QUIZ_FILE_UPLOADED', { var: q.var, value });
    }

    if (q && q.var) {
      bus.emit(EV.QUIZ_QUESTION_ANSWERED, { var: q.var, value });
      console.log('[quiz] emitted QUIZ_QUESTION_ANSWERED', { var: q.var, value });
    }

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
      // 1) Persist quiz answers into the in-memory user
    Object.assign(store.user, answers);
    store.flags.add('quizCompleted');

    // 2) Properly close modal & overlay
    closeModal(modal);          // <-- important: removes overlay when appropriate
    setSpotlight(false);        // body-level dim off (if you use it)

    // 3) Notify the rest of the app
    bus.emit(EV.QUIZ_COMPLETED, { answers });
    console.log('[quiz] completed, answers:', answers);
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
    addTitleSub(q); // keeps the main question heading/subtitle at the top

    const wrap = makeFieldWrap(q.label || null, q.hint || null);

    const input = document.createElement(q.type === 'long' ? 'textarea' : 'input');
    if (q.type !== 'long') input.type = 'text';
    input.placeholder = q.placeholder || '';
    input.className = 'text';
    wrap.appendChild(input);

    content.appendChild(wrap);

    addNextButton('Next', () => {
      const raw = input.value?.trim();
      const val = raw === '' ? '' : (isFinite(raw) ? Number(raw) : raw);

      // Optional JSONLogic validation: e.g., { ">=": [ { "var":"value" }, 0 ] }
      if (q.validate) {
        const ok = evaluateLogic({ and: [ q.validate ] }, { value: val });
        if (!ok) {
          input.classList.add('is-error');
          // Show or update an error message
          let err = wrap.querySelector('.q-error');
          if (!err) {
            err = document.createElement('div');
            err.className = 'q-error';
            wrap.appendChild(err);
          }
          err.textContent = q.errorMessage || 'Please check your input.';
          return;
        }
      }
      gotoNext(q, val);
    });
  }


  function renderFile(q) {
    addTitleSub(q);

    const wrap = makeFieldWrap(q.label || 'Upload file(s)', q.hint || null);

    const input = document.createElement('input');
    input.type = 'file';
    if (q.multiple) input.multiple = true;
    if (q.accept)   input.accept   = q.accept; // e.g., ".pdf,.png,.jpg"
    wrap.appendChild(input);

    content.appendChild(wrap);

    addNextButton(q.cta || 'Upload', () => {
      // For demo: record a count; in real app you’d store files or set a flag
      const count = input.files?.length || 0;
      if (q.required && count === 0) {
        input.classList.add('is-error');
        let err = wrap.querySelector('.q-error');
        if (!err) { err = document.createElement('div'); err.className = 'q-error'; wrap.appendChild(err); }
        err.textContent = q.errorMessage || 'Please select at least one file.';
        return;
      }
      gotoNext(q, count);
    });
  }


  function renderDate(q) {
    addTitleSub(q);

    const wrap = makeFieldWrap(q.label || 'Select a date', q.hint || null);

    const input = document.createElement('input');
    input.type = 'date';
    if (q.min) input.min = q.min;
    if (q.max) input.max = q.max;
    wrap.appendChild(input);

    content.appendChild(wrap);

    addNextButton('Next', () => {
      if (q.required && !input.value) {
        input.classList.add('is-error');
        let err = wrap.querySelector('.q-error');
        if (!err) { err = document.createElement('div'); err.className = 'q-error'; wrap.appendChild(err); }
        err.textContent = q.errorMessage || 'Please choose a date.';
        return;
      }
      gotoNext(q, input.value || null);
    });
  }


  function renderCheckbox(q) {
    addTitleSub(q);

    const wrap = makeFieldWrap(null, null); // label text will sit inline with the checkbox

    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = q.label || 'I agree';

    row.appendChild(cb);
    row.appendChild(labelSpan);
    wrap.appendChild(row);

    if (q.hint) {
      const hint = document.createElement('div');
      hint.className = 'q-hint';
      hint.textContent = q.hint;
      wrap.appendChild(hint);
    }

    content.appendChild(wrap);

    addNextButton('Next', () => {
      if (q.required && !cb.checked) {
        cb.classList.add('is-error');
        let err = wrap.querySelector('.q-error');
        if (!err) { err = document.createElement('div'); err.className = 'q-error'; wrap.appendChild(err); }
        err.textContent = q.errorMessage || 'Please check the box to continue.';
        return;
      }
      gotoNext(q, cb.checked);
    });
  }

}
