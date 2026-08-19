// One set of screen controls — value, address and what that value does, all in one table. It knows nothing about the scene (what to do arrives as apply).
//
// Buttons carry no behaviour. A button (ui.js bindSeg / bindSelect) only reports "this became the value";
// what to do (apply) and how it rides in the address (anything differing from initial goes into the query) is decided by the table here.
// So there is one path by which a value changes — a click, a shortcut and an inbound address all go through the same set().
//
// One def: { el, kind, initial, apply(value), rebuild }
//   kind      "seg" (default) — `.seg > button[data-<key>]` · "select" — one <select>
//   initial   the value the screen starts on. **Must match the HTML's `.on` button (or first option)** — if it differs,
//             that item rides in the address of a screen nobody has touched
//   rebuild   values that require re-baking the board (grid, species). The rest are scene switches and bake nothing
//
// Controls absent from the screen (el is null) are skipped — the main page keeps a few cards and the debug screen keeps them all.
// A skipped value never runs apply, so it stays at **the scene's own default**. Which is why initial must match the scene default too.

import { bindSeg, bindSelect } from "./ui.js";

export function createControls(defs, onChange) {
  const bound = {};
  for (const [key, def] of Object.entries(defs)) {
    if (!def.el) continue;
    const notify = (value) => { def.apply(value); onChange(def); };
    bound[key] = def.kind === "select" ? bindSelect(def.el, notify) : bindSeg(def.el, key, notify);
  }

  return {
    // Controls not on this screen are passed over quietly — so callers (shortcuts) do not have to differ per screen
    value: (key) => (bound[key] ? bound[key].value() : null),
    set: (key, value) => { if (bound[key]) bound[key].set(value); },

    // Address → screen. It goes through set, the same path as a button click, so apply runs too. Unknown values are ignored
    read(params) {
      for (const key of Object.keys(bound)) {
        const value = params.get(key);
        if (value !== null) bound[key].set(value);
      }
    },

    // Screen → address. Items at initial are left out — the address of an untouched screen carries nothing
    query() {
      const query = new URLSearchParams();
      for (const key of Object.keys(bound)) {
        const value = bound[key].value();
        if (value !== defs[key].initial) query.set(key, value);
      }
      return query.toString();
    }
  };
}
