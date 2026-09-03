// The high-five stars — three ☆ bounce out of the palm contact, arc over and fade. Not an emoji (that channel
// is one glyph above one head; this is a point in the world between two creatures) but the same kind of thing:
// a triggered layer, baked once per burst — the allowed exception, like the emoji (guidelines/performance.md) —
// each mesh owning its material for the fade. Every curve is a function of t and the throws are fixed numbers,
// no rng anywhere: a burst replays identically for a roll.
// Docs: guidelines/motion/catalog.md § the high five; order 100000 with the emoji (guidelines/rig.md)

import { Sketch } from "../stroke.js";
import { starPath } from "../character/index.js";
import { sketchMesh, disposeGroup } from "./mesh.js";
import { EMOJI_ORDER } from "./emoji.js";
import { POPS } from "../character/vocabulary/palette.js";
import { shade } from "../color.js";
import { ramp } from "../motion/ease.js";

// Three fixed throws — out both ways and nearly straight up, each its own spin and size.
// [angle rad, distance, spin rad, star radius]. Radii at the emoji's scale (the ♥ is 0.045 across) and the
// contour at M — smaller and hairlined, the stars vanished into the paper grain at board zoom
const THROWS = [
  [Math.PI * 0.78, 0.26, 2.6, 0.048],
  [Math.PI * 0.52, 0.3, -1.8, 0.038],
  [Math.PI * 0.24, 0.27, 3.4, 0.043]
];
const DUR = 0.75;    // seconds in the air
const GRAV = 0.24;   // how hard the arcs droop
const POP = 0.16;    // the first stretch of k spent popping in from nothing

export function makeSparks(scene) {
  let bursts = [];   // { meshes, x, y, start }

  const drop = (b) => {
    for (const m of b.meshes) {
      disposeGroup(m);
      scene.remove(m);
    }
  };

  return {
    burst(x, y, t, noise) {
      const meshes = THROWS.map(([, , , r]) => {
        const sketch = new Sketch(noise, 0.5);
        const star = starPath(0, 0, r);
        sketch.fill(star, POPS[3]);   // the palette's ochre
        sketch.contour(star, { color: shade(POPS[3], 0.6), size: "M", paper: POPS[3] });
        const mesh = sketchMesh(sketch, 0.95, EMOJI_ORDER, 0, { own: true });
        mesh.visible = false;   // placed on the first update — never shown at the origin
        scene.add(mesh);
        return mesh;
      });
      bursts.push({ meshes, x, y, start: t });
    },
    update(t) {
      bursts = bursts.filter((b) => {
        const k = (t - b.start) / DUR;
        if (k >= 1) { drop(b); return false; }
        // The radial pop is ballistic on purpose — flung things leave hard, like the jump's takeoff
        // (the one licensed exception to easing both ends); the droop is gravity's k²
        const out = 1 - (1 - k) * (1 - k);
        for (let i = 0; i < b.meshes.length; i += 1) {
          const [ang, dist, spin] = THROWS[i];
          const m = b.meshes[i];
          m.visible = true;
          m.position.set(b.x + Math.cos(ang) * dist * out, b.y + Math.sin(ang) * dist * out - GRAV * k * k, 0);
          m.rotation.z = spin * k;
          m.scale.setScalar(ramp(k / POP));
          m.material.opacity = 0.95 * (k < 0.55 ? 1 : 1 - ramp((k - 0.55) / 0.45));
        }
        return true;
      });
    },
    clear() {
      for (const b of bursts) drop(b);
      bursts = [];
    }
  };
}
