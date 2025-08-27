// js/actionResolver.js
import { store } from './store.js';

export function resolveAction(type, overrides = {}) {
  const base = store.actions?.types?.[type] || {};
  // Compose: config defaults → overrides from caller
  return {
    type,
    label: base.label,
    cta: base.cta,
    modal: base.modal || null,
    sticky: !!base.sticky,          // you can set defaults in actions.jsonc
    sets: base.sets || [],          // e.g., ["transcriptUploaded"]
    ...overrides
  };
}
