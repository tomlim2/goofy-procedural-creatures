// The parts vocabulary. This defines "what exists" only. The rules for choosing are ../creature.js,
// and the drawing is ../draw/'s job. The three are never mixed.
// Docs: guidelines/character/parts.md

// The options per slot. Names line up 1:1 with the drawing-function keys in draw.js.
export const SLOTS = {
  head: ["round", "square", "tall", "pear", "wide", "egg", "block"],
  // Live eyes (the rig — pupil, blink, startle): ring · wide (a ring 1.3× bigger) · cyclops (one eye) · oval (a tall elliptical big eye). (The highlighted eyeball eye was dropped)
  // Static eyes: dot · sleepy · half · spiral · cross · slit · line (a flat two-dash eye) · happy (always smiling ^^) · hollow (an empty eye — an ellipse with no pupil) ·
  //   scrawl (a circle scribbled with a crayon — three and a half turns in one stroke, lines crossing and overshooting. Unlike the neat spiral) ·
  //   a set of heavy lids (the same eye at different tilts — a white, a thick sagging lid line and a pupil):
  //   lidded (flat) · sharp (tilted 0.34 rad toward the nose — the fierce look of a lifted outer corner) · soft (tilted the other way — the gentle look of a drooping outer corner)
  // From kaomoji: squeeze (>_< screwed shut) · side (¬_¬ a sideways glance) · droop (´･ω･` drooping outer corners). (The ◕ eyeball eye was dropped)
  // ☆_☆ and ♥_♥ are not eye kinds but startle variants (motion/events.js stepSurprise) — the eyes turn into them briefly
  eyes: ["ring", "dot", "wide", "sleepy", "spiral", "cross", "half", "slit", "cyclops", "oval", "line", "happy", "hollow",
    "squeeze", "side", "droop", "scrawl", "lidded", "sharp", "soft"],
  brow: ["none", "flat", "angry", "worry"],
  eyewear: ["none", "glasses", "goggles", "patch", "monocle"],
  // Hair is not filled as an area but drawn as a scribble, back and forth with the pen.
  // The reference's kid row includes: a bowl cut with a fringe (bangs) · a bob down to the jaw at the sides (longbob) · a topknot on the crown (bun)
  // Reference volume types: helmet a hood-like mass (a big mass wrapping crown to brow and over the ears) · cloud curly cloud (a big mass with a scalloped outline) · hedgehog a hedgehog (short spikes over the whole crown)
  // What the back hair layer made possible: long straight hair to the shoulders · verylong very long straight hair (to mid-torso, curtains at both sides of the face) · twintails · twintailsBall twintails with round ends ·
  // ponytail · apple an apple top (a small nub on the crown) · appleBig a big apple top
  hair: ["none", "bob", "spikes", "mop", "mohawk", "tuft", "wisp", "scribble", "sweep", "pigtails", "curly", "bangs", "longbob", "bun", "helmet", "cloud", "hedgehog",
    "long", "twintails", "ponytail", "apple", "verylong", "twintailsBall", "appleBig"],
  // bonnet (the frilly bonnet) is **disabled** — the asset stays but it is in no bias (it never gets drawn)
  headgear: ["none", "helmet", "cap", "band", "pot", "beret", "bonnet", "crown", "halo", "cone"],
  horns: ["none", "curved", "straight", "antenna", "nub", "ram", "crown"],
  // round, pointy and fold come in three sizes — default (small) · Mid (medium, 1.4×) · Big (large, 1.8×). Same shape, different size only.
  // Cat crown ears, dog ears and human/imp side ears all use the same multipliers
  // fold **folds on one side only while the other stands** (which side is per individual) · perk stands on both
  ears: ["none", "round", "roundMid", "roundBig", "pointy", "pointyMid", "pointyBig", "flap", "long", "fold", "foldMid", "foldBig", "perk", "perkMid", "perkBig"],
  // Noses — four lines (hook a hook · dot a dot · wedge a ∧ · long a long nose) + two nostrils (nostrils, two watermelon seeds) + three areas (bulb a round button nose · broad a wide triangle · box a square).
  // Humans and imps get them as drawn, cats read them through catNose, and dogs read them as a muzzle shape (draw/face.js)
  nose: ["hook", "dot", "wedge", "long", "none", "bulb", "broad", "nostrils", "box"],
  // Cheek and eye-area detail. The reference's tear marks and blush.
  face2: ["none", "tears", "blush"],
  // 20 mouths (the MOUTH table in draw/mouth.js). Reference: humans default to a very small mouth (dot, line, frown, 3) and what stands out is the tooth grid (grimace), the grin and the hatching (scribble),
  // dogs get w (omega), o (open) and the tongue, cats get ω, 3, a meow, a peeking tongue (blep) and a hiss (fangs), imps get the wide grid, hatching, zigzag, fangs and shout, open with two tooth strips.
  // Open mouths (open, shout, tongue) have a dark-ink cavity plus a white tooth strip — they read as mouths on a dark face too. (The spiked teeth kind doubled the fang silhouette and was dropped)
  mouth: ["dot", "line", "open", "wave", "smile", "pout", "omega", "zigzag",
    "frown", "three", "grimace", "grin", "scribble", "tongue", "fangs", "shout", "meow", "blep", "bracket", "smug"],
  body: ["bean", "box", "dress", "tube"],
  // Markings — five, and all of them lines (stripes · dots · patch hatching · hatch · spots outlined), laid over the material. The imps' alone. Docs: character/parts.md § pattern
  pattern: ["none", "stripes", "dots", "patch", "hatch", "spots"],
  // Leg types (form only). Reference: all of them end in a round foot and come out from under the body.
  // float is Rayman style — no legs, just floating feet. How far they open (the stance) is not here —
  // the torso build decides that. Quads only draw stub, stick, boots and float, and read the rest as stick.
  legs: ["stick", "stub", "bent", "boots", "tiptoe", "float"],
  // Quad species only. Biped species do not draw it.
  // The tail **skeleton** — the spine shape only. curl curled up · flag straight up · longtail long and back · stubtail blunt · hook standing then hooked (cats) ·
  // kink a kinked tail (cats) · ring a ring curled over the back (a spitz). What it is dressed in is tailSkin
  tail: ["curl", "flag", "longtail", "stubtail", "hook", "kink", "ring"],
  // The tail **skin** — what goes on the skeleton. line one thin stroke · thick a filled thick tail · plume a bushy plume (fur strokes) · tuft a tuft at the tip (a lion) ·
  // block a block (constant width, squared tip) · wedge a wedge (wide root, pointed tip) · ball circles (beads along the spine; on a stub, one pom).
  // wedge reads as a rat tail and is **disabled** — the asset (drawing, gallery) stays but it is in no bias (it never gets drawn). ringed (ring markings)
  // was dropped: rings are the pattern's job now — a striped creature's tube tail wears them (limbs.js tubePattern)
  // puff a pom — a bushy rabbit tail attached at the rump regardless of the skeleton (a pom plus fur strokes). Dogs
  tailSkin: ["line", "thick", "plume", "tuft", "block", "wedge", "ball", "puff"],
  // The tail **length** — shrinks the whole skeleton (long 1 · medium 0.7 · short 0.45). The skin thickness is unchanged
  tailLength: ["long", "medium", "short"],
  // The mouth **position** — where it sits between the bottom of the nose and above the chin: high (just under the nose) · mid · low (near the chin). Dogs ignore it, being on the muzzle rule
  mouthPos: ["mid", "high", "low"],
  // The mouth **size** — width multipliers small 0.7 · normal 1 · wide 1.4 (draw/mouth.js MOUTH_SIZE). In the reference, very small mouths and very wide mouths split at the extremes.
  // For imps a species multiplier of 1.3 is applied on top
  mouthSize: ["normal", "small", "wide"],
  // The tail **decoration** — an object WORN on the tail, the rex's dressing-up (every other species forbids
  // it — species.js): ribbon (a bow tied round it, three shapes) · plates (little back plates) · dip (the tip
  // dipped in paint) · club (the tip a heavy ball) · band (knit rings) · spikes (the thagomizer — bone horns
  // at the tip). Colors: plates ape the hide (the second scale), the club is the hide, the spikes are bone,
  // and the ribbon, dip and band take a POP — the bold palette, one per individual
  tailDeco: ["none", "ribbon", "plates", "dip", "club", "band", "spikes"],
  // The **material** — the creature's goofy material: what the head and the body are made of, how their areas are filled (medium/materials.js GOOFY_MATERIALS — a base color and its
  // texture). Each lays its marks over the base in a tone of the part's own color. FLAT, the fill-up with nothing on it, is not one of
  // them: it is what the whites of the eyes are filled with, not something a creature is made of. A late slot — the look, not the form
  material: ["graphite", "ink", "oil", "charcoal"],
  // The **body's** goofy material — `same` for one tool over the whole creature, or one of the five for a body made of something else
  // than the head. A face and a torso are two surfaces (skin and cloth already have two colors), and one hand may well reach for a
  // second tool between them. Everything on the head follows `material` — ears, horns, hair, a hat, the muzzle; everything on the body
  // follows this one — the limbs, the hands, the boots, the sleeves, the tail. The **density** is not split: one hand, one pressure
  bodyMaterial: ["same", "graphite", "ink", "oil", "charcoal"],
  // The **density** — how dark the goofy material draws this creature: **the value step itself**, picked by the seed from the five
  // (medium/materials.js VALUES: black · hatch · scribble · stipple · light). It used to be a hand (lighter/normal/darker) that moved
  // a step read off the part's colour, which meant a pale creature could never draw black and a black one never light — half the
  // ladder was unreachable. The colour still decides the marks' **tone** (contrast), the step decides how many. Nothing on flat
  density: ["black", "hatch", "scribble", "stipple", "light"],
  // Arm form. Posture (hanging, open, raised, behind the back) is not here — that is motion, in clocks.js. none is armless (some imps) — the arm action layer rests
  arms: ["stick", "sleeve", "stubby", "mitten", "none"],
  // Arm length. Independent of form, so short sleeved arms and very long gloved arms both come out.
  armLength: ["medium", "long"],
  // Leg length. Independent of form — every leg type has a length. Length changes, not scale:
  // the body settles near the floor while feet and thickness stay. Quads follow it too (short = a dachshund).
  // verylong stilts — **twice** long. Imps only (humans, dogs and cats forbid it → long). The head is shrunk by layout to fit the cell ceiling (MAX_HEAD_TOP)
  legLength: ["long", "medium", "short", "verylong"],
  // Torso build. Independent of form (body), so a lanky tube, a stocky bean and a small torso all come out.
  // skinny lanky · narrow slim · medium · wide broad · small a small torso (narrow and short both).
  // The leg stance (how far they open) and the shoulder position follow it: a narrow body draws the legs together, a wide one opens them.
  // On a quad it is body length and thickness: narrow a short body, wide a long body (dachshund, munchkin), skinny a thin body, small a small body.
  build: ["skinny", "narrow", "medium", "wide", "small"]
};

// Slots added later. makeCreature draws them after everything else (parts, constraints, colors, proportions) —
// that way the earlier rng consumption is unchanged and existing seeds keep their boards (only the new slot's value is added).
// A new slot goes on the end here. Reorder them and these slots' values change.
export const LATE_SLOTS = ["legLength", "build", "tailSkin", "tailLength", "mouthPos", "mouthSize", "material", "density", "bodyMaterial", "tailDeco"];

// Default weights for slots with no archetype bias.
//
// Without these, a slot becomes an even draw — and then eyewear, with 5 options,
// has 80% wearing something, while hair, with 9 options, almost never produces a noticeable kind.
// Which slots should have a common "none" and which should not is settled here.
export const DEFAULT_BIAS = {
  // When there is no species or archetype bias. cyclops is not here (it only comes from the imp bias)
  eyes: [["ring", 3], ["dot", 2], ["wide", 2], ["sleepy", 1.5], ["half", 1.5], ["spiral", 1], ["cross", 1], ["slit", 1], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1],
    ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1.5], ["lidded", 1.5], ["sharp", 1.5], ["soft", 1.5]],
  hair: [["none", 3], ["bob", 2], ["mop", 2], ["scribble", 2], ["sweep", 2], ["spikes", 2], ["tuft", 2], ["wisp", 2], ["pigtails", 1.5], ["curly", 1.5], ["mohawk", 1], ["bangs", 2], ["longbob", 1.5], ["bun", 1], ["helmet", 2], ["cloud", 1.5], ["hedgehog", 1.5], ["long", 1.5], ["twintails", 1], ["ponytail", 1.5], ["apple", 1],
    ["verylong", 1], ["twintailsBall", 0.8], ["appleBig", 0.7]],
  headgear: [["none", 6], ["cap", 2], ["band", 2], ["beret", 2], ["helmet", 1], ["pot", 1], ["crown", 1], ["halo", 0.7], ["cone", 1]],   // bonnet disabled
  eyewear: [["none", 5], ["glasses", 2], ["patch", 2], ["goggles", 1], ["monocle", 1]],
  ears: [["none", 4], ["round", 1.5], ["roundMid", 0.5], ["pointy", 1.5], ["pointyMid", 1], ["pointyBig", 0.5], ["flap", 1], ["fold", 0.7], ["foldMid", 0.3], ["perk", 0.7], ["perkMid", 0.3]],
  brow: [["none", 2], ["flat", 2], ["angry", 1], ["worry", 1]],
  pattern: [["none", 4], ["stripes", 2], ["hatch", 2], ["dots", 2], ["patch", 1], ["spots", 1]],
  nose: [["hook", 3], ["dot", 2], ["wedge", 2], ["none", 4], ["long", 1], ["bulb", 2], ["broad", 1], ["nostrils", 1.5], ["box", 1.5]],
  face2: [["none", 5], ["blush", 2], ["tears", 1.5]],
  horns: [["none", 5], ["curved", 2], ["straight", 2], ["antenna", 2], ["nub", 2]],
  tail: [["curl", 3], ["flag", 3], ["longtail", 2], ["stubtail", 2], ["hook", 1.5], ["kink", 1], ["ring", 1.5]],
  tailSkin: [["line", 3], ["thick", 2.5], ["plume", 1.5], ["tuft", 1], ["block", 1], ["ball", 1], ["puff", 1]],   // wedge disabled
  tailLength: [["long", 3], ["medium", 2], ["short", 1.5]],
  // Mouths — the human baseline (when there is no species bias). A small mouth by default, with the grid, grin and hatching as seasoning. Spiked teeth, zigzag, meow and blep belong to species, so 0
  mouth: [["line", 3], ["dot", 2], ["smile", 2], ["frown", 1.5], ["smug", 1.5], ["three", 1.5], ["pout", 1], ["open", 1], ["wave", 1], ["grimace", 1], ["grin", 1], ["bracket", 1], ["scribble", 0.3]],
  mouthPos: [["mid", 2], ["high", 1.5], ["low", 1.5]],
  mouthSize: [["normal", 3], ["small", 2], ["wide", 1]],
  // Goofy materials — every creature is made of one. FLAT, the fill-up alone, was in here at weight 5 and left four boards in five
  // untextured; it is still a goofy material (the whites of the eyes are flat) but it is not something a creature can be made of
  material: [["graphite", 1.5], ["charcoal", 1], ["oil", 1], ["ink", 0.8]],
  // Most creatures are one tool through; a body of its own is seasoning on top of seasoning
  bodyMaterial: [["same", 9], ["graphite", 1], ["charcoal", 0.7], ["oil", 0.7], ["ink", 0.5]],
  tailDeco: [["none", 1]],   // the rex carries its own weights; everyone else forbids the lot
  density: [["black", 1], ["hatch", 1], ["scribble", 1], ["stipple", 1], ["light", 1]],
  arms: [["stick", 3], ["sleeve", 3], ["mitten", 2], ["stubby", 2]],
  armLength: [["medium", 3], ["long", 1]],
  legs: [["stick", 3], ["boots", 3], ["stub", 2.5], ["bent", 2], ["float", 1.5], ["tiptoe", 1]],
  legLength: [["long", 3], ["medium", 2], ["short", 1]],
  build: [["medium", 4], ["narrow", 1.5], ["wide", 1.5], ["skinny", 1], ["small", 1]]
};
