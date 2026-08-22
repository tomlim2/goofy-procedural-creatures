// Screen control utilities — main.js and gallery.js share them. They know nothing about the scene.
import { TICK_FPS } from "./tick.js";

// Wires a segmented button group (`.seg > button[data-<attr>]`). A click moves `.on` to that button and calls onChange(value).
// Returns { value(), set(value) } — keyboard shortcuts go through set, the same path as a button click.
export function bindSeg(container, attr, onChange) {
  const buttons = () => [...container.querySelectorAll(`button[data-${attr}]`)];
  const select = (button) => {
    for (const b of buttons()) b.classList.toggle("on", b === button);
    onChange(button.dataset[attr]);
  };
  container.addEventListener("click", (event) => {
    const button = event.target.closest(`button[data-${attr}]`);
    if (button) select(button);
  });
  return {
    value: () => {
      const on = container.querySelector(`button[data-${attr}].on`);
      return on ? on.dataset[attr] : null;
    },
    set: (value) => {
      const button = buttons().find((b) => b.dataset[attr] === value);
      if (button) select(button);
    }
  };
}

// Wires one <select>. Returns the **same shape** as bindSeg ({ value, set }) — so the controller handles button groups and dropdowns without telling them apart.
// set only accepts values in the list (a value arriving from the address that is not an option does nothing — the same attitude as bindSeg's set).
export function bindSelect(select, onChange) {
  select.addEventListener("change", () => onChange(select.value));
  return {
    value: () => select.value,
    set: (value) => {
      if (![...select.options].some((option) => option.value === value)) return;
      select.value = value;
      onChange(value);
    }
  };
}

// Appends one option to a <select>
export function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

// A 32-bit random seed (only when NEW SEED is pressed on screen — the generation path never uses Math.random, guidelines/determinism.md)
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

// rAF loop. The loop survives exceptions — if the rAF loop dies, only the label changes while the canvas freezes, which reads as "the buttons don't work".
// Calls tick(elapsedSeconds) every frame. onError is for updating the status label
// The loop — a fixed TICK_FPS ticks per second (tick.js). A rAF frame whose tick has not changed does nothing: no update, no render.
// tick(t) gets t = n / TICK_FPS, the n-th tick's time, never the display's clock — so the pose at tick n is the same on every machine.
// A stall (a hidden tab) skips ticks rather than catching up: time is the truth, not the step count
export function runLoop(tick, onError) {
  const start = performance.now();
  let last = -1;
  const frame = () => {
    const n = Math.floor(((performance.now() - start) / 1000) * TICK_FPS);
    if (n !== last) {
      last = n;
      try {
        tick(n / TICK_FPS);
      } catch (error) {
        onError(error);
        console.error(error);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
