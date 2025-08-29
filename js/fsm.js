// Minimal finite-state machine helper
export function makeFSM({ states, start }) {
  return {
    state: start,
    can(event) { return !!states[this.state]?.on?.[event]; },
    transition(event, context) {
      const next = states[this.state]?.on?.[event];
      if (typeof next === 'function') {
        this.state = next(context);
      } else if (next) {
        this.state = next;
      }
      return this.state;
    }
  };
}
