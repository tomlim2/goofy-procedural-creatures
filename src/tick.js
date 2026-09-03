// The tick — the board's clock runs at a fixed TICK_FPS ticks per second ("on ones" at 24; 12 would be "on twos"). The loop (ui.js runLoop)
// calls update only when the tick changes, with t = n / TICK_FPS: the n-th tick is the same pose on every machine whatever the display's
// refresh rate — the roll's determinism reaches the motion — and a 60 Hz screen draws 24 frames a second, not 60. The motion's per-step
// filters (motion/ease.js damp) step by TICK, so their settling times are in seconds, not frames. Docs: guidelines/determinism.md § the tick
export const TICK_FPS = 24;
export const TICK = 1 / TICK_FPS;
