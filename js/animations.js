export function animateIn(el, enter = 'card--enter', done = 'card--in') {
  el.classList.add(enter);
  requestAnimationFrame(() => {
    el.classList.add(done);
    el.classList.remove(enter);
  });
}

export function toggleDim(on) {
  document.body.classList.toggle('demo-dim', !!on);
}
