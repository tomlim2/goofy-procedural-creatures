// Species — the skeleton. Docs: guidelines/character/types.md

// Species. If an archetype is a "disposition", a species is a "skeleton". Decided per row,
// so one board mixes a human row, a dog row, a cat row and an imp row.
// bias takes precedence over the archetype. Skeleton comes before disposition.
export const SPECIES = [
  {
    name: "human",
    // Humans. Horns, antennae and a cyclops eye are not human, and long arms that sweep the floor belong to imps.
    // forbid means "if this value comes up for this slot, swap it for this". applyConstraints reads it and
    // overwrites deterministically — the archetype's disposition (a scholar's dot eyes and so on) survives.
    forbid: {
      // The **pattern** belongs to the imps and the rex — stripes, dots, spots, hatching and a patch, laid over the material
      pattern: { stripes: "none", dots: "none", hatch: "none", spots: "none", patch: "none" },
      tailDeco: { ribbon: "none", plates: "none", dip: "none", club: "none", band: "none", spikes: "none" },
      arms: { none: "stick" },   // humans have arms (armless belongs to imps)
      face2: { tears: "none" },  // tear marks are not given to humans (they belong to imps)
      // A human ear is only a human ear — a small round ear (round) or none. Animal ears (pointy, floppy, folded, long) are not given to humans
      ears: { roundMid: "round", roundBig: "round", pointy: "round", pointyMid: "round", pointyBig: "round", flap: "none", long: "none", fold: "none", foldMid: "none", foldBig: "none", perk: "round", perkMid: "round", perkBig: "round" },
      horns: { curved: "none", straight: "none", antenna: "none", nub: "none", ram: "none", crown: "none" },
      eyes: { cyclops: "wide" },
      armLength: { long: "medium" },
      legLength: { verylong: "long" }   // stilts belong to imps
    },
    // Identity — census checks it. An individual in violation is a bug.
    identity: {
      ears: ["none", "round"],   // a human ear is none or a small round one — dog and cat ears are not human
      skeleton: "biped",
      horns: ["none"],
      eyes: { not: ["cyclops"] },
      armLength: ["medium"],
      legLength: { not: ["verylong"] },   // stilts belong to imps
      arms: true,
      tail: false
    },
    bias: {}
  },
  {
    name: "pup",
    forbid: {
      // The **pattern** belongs to the imps and the rex — stripes, dots, spots, hatching and a patch, laid over the material
      pattern: { stripes: "none", dots: "none", hatch: "none", spots: "none", patch: "none" },
      tailDeco: { ribbon: "none", plates: "none", dip: "none", club: "none", band: "none", spikes: "none" },
      ears: { none: "flap", pointyBig: "pointyMid", roundBig: "roundMid", foldBig: "foldMid", perkBig: "perkMid" },
      // Dog ear boundary — none and the huge ear become dog ears
      eyes: { cyclops: "dot" },
      // Dogs have no horns and no hair — all none (it is fur, not hair)
      horns: { curved: "none", straight: "none", antenna: "none", nub: "none", ram: "none", crown: "none" },
      hairFront: { hairline: "none", blunt: "none", swept: "none", curtain: "none", sideLock: "none", cap: "none", spikes: "none", mohawk: "none", hedgehog: "none", tuft: "none", wisp: "none", curly: "none", helmet: "none", cloud: "none" },
      hairBack: { bob: "none", mop: "none", long: "none", sheets: "none", twintails: "none", bunsTop: "none", bunsLow: "none", bunsSide: "none", ponytail: "none", pigtails: "none" },
      hairTop: { bun: "none", apple: "none", appleBig: "none" },
      brow: { flat: "none", angry: "none", worry: "none", arch: "none", peak: "none", wave: "none", bushy: "none", raised: "none", mono: "none", dot: "none" },   // animals have no brows (which blocks the alt brow of a state switch too)
      legLength: { verylong: "long" }
    },
    identity: {
      ears: ["flap", "long", "pointy", "pointyMid", "round", "roundMid", "fold", "foldMid", "perk", "perkMid"],   // dog ears — a floppy ear by default, no none and no huge ear
      skeleton: "quad",
      horns: ["none"],
      hairFront: ["none"], hairBack: ["none"], hairTop: ["none"],
      brow: ["none"],
      eyes: { not: ["cyclops"] },
      legLength: { not: ["verylong"] },
      arms: false,
      tail: true
    },
    bias: {
      // Legs — the reference's thick stubs by default. Thin legs, socks and floating feet (Rayman style) are mixed in too
      legs: [["stub", 4], ["stick", 2], ["float", 1.5], ["boots", 1]],
      // Ears — hanging lobes (flap, long) by default, with perked (pointy), round (round) and folded (fold) mixed in
      ears: [["flap", 4], ["long", 3], ["pointy", 1.2], ["pointyMid", 0.8], ["round", 1], ["roundMid", 0.5], ["fold", 1], ["foldMid", 0.6], ["perk", 1.2], ["perkMid", 0.6]],
      horns: [["none", 1]],
      hairFront: [["none", 1]], hairBack: [["none", 1]], hairTop: [["none", 1]],
      // Hats — a cap mostly, the odd beret, crown or halo. No helmet or pot (they cover the scalp whole and bury the
      // standing ears) and no band (it crosses the ear roots)
      headgear: [["none", 8], ["cap", 1], ["beret", 0.5], ["crown", 0.3], ["halo", 0.3], ["cone", 0.4], ["coronet", 0.5]],
      eyewear: [["none", 6], ["patch", 2], ["glasses", 1]],
      nose: [["dot", 4], ["wedge", 2], ["hook", 1]],
      eyes: [["dot", 3], ["ring", 3], ["half", 2], ["wide", 2], ["sleepy", 1], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1], ["lidded", 1.5], ["sharp", 1], ["soft", 1]],
      tail: [["flag", 4], ["stubtail", 3], ["longtail", 2], ["curl", 1], ["ring", 2], ["hook", 0.5]],
      tailSkin: [["thick", 3], ["line", 2], ["plume", 2], ["puff", 2], ["tuft", 1], ["ball", 1], ["block", 0.5]],   // dogs are thick or bushy (a spitz), and a rabbit-like pom too. wedge disabled
      tailLength: [["long", 2], ["medium", 2], ["short", 2]],
      // Mouth — the w (omega) under the muzzle by default, a barking o (open), a panting tongue (tongue), plus line, dot and smile. No duck bill, zigzag or spiked teeth (3 reference rows)
      mouth: [["omega", 4], ["line", 2], ["open", 2], ["tongue", 2], ["dot", 1.5], ["smile", 1]],
      mouthSize: [["normal", 3], ["small", 1.5], ["wide", 0.5]],
      face2: [["none", 5], ["blush", 1], ["circles", 0.8]]
    }
  },
  {
    name: "cat",
    forbid: {
      // The **pattern** belongs to the imps and the rex — stripes, dots, spots, hatching and a patch, laid over the material
      pattern: { stripes: "none", dots: "none", hatch: "none", spots: "none", patch: "none" },
      tailDeco: { ribbon: "none", plates: "none", dip: "none", club: "none", band: "none", spikes: "none" },
      ears: { flap: "pointy", long: "pointyMid", none: "pointy", round: "pointy", roundMid: "pointyBig", roundBig: "pointyBig", fold: "pointy", foldMid: "pointyMid", foldBig: "pointyBig", perk: "pointy", perkMid: "pointyMid", perkBig: "pointyBig" },
      // Cat ear boundary — floppy ears and none become crown ears
      eyes: { cyclops: "slit" },
      horns: { curved: "none", straight: "none", antenna: "none", nub: "none", ram: "none", crown: "none" },
      hairFront: { hairline: "none", blunt: "none", swept: "none", curtain: "none", sideLock: "none", cap: "none", spikes: "none", mohawk: "none", hedgehog: "none", tuft: "none", wisp: "none", curly: "none", helmet: "none", cloud: "none" },
      hairBack: { bob: "none", mop: "none", long: "none", sheets: "none", twintails: "none", bunsTop: "none", bunsLow: "none", bunsSide: "none", ponytail: "none", pigtails: "none" },
      hairTop: { bun: "none", apple: "none", appleBig: "none" },
      brow: { flat: "none", angry: "none", worry: "none", arch: "none", peak: "none", wave: "none", bushy: "none", raised: "none", mono: "none", dot: "none" },
      legLength: { verylong: "long" }
    },
    identity: {
      ears: ["pointy", "pointyMid", "pointyBig"],   // triangular crown ears only (the reference) — no round, folded or floppy ears, and no none
      skeleton: "quad",
      horns: ["none"],
      hairFront: ["none"], hairBack: ["none"], hairTop: ["none"],
      brow: ["none"],
      eyes: { not: ["cyclops"] },
      legLength: { not: ["verylong"] },
      arms: false,
      tail: true
    },
    bias: {
      legs: [["stub", 3], ["stick", 3], ["float", 1.5], ["boots", 1]],
      // Crown ears — triangular, round and folded ears each in small, mid and big. Floppy ears (flap, long) do not belong to cats
      // Triangular ears only — default · narrow and tall (Mid) · wide and big (Big). The reference has no round, folded or floppy ears
      ears: [["pointy", 3], ["pointyMid", 2], ["pointyBig", 1.5]],
      horns: [["none", 1]],
      hairFront: [["none", 1]], hairBack: [["none", 1]], hairTop: [["none", 1]],
      headgear: [["none", 8], ["cap", 1], ["beret", 0.5], ["crown", 0.3], ["halo", 0.3], ["cone", 0.4], ["coronet", 0.5]],
      eyewear: [["none", 6], ["patch", 2], ["monocle", 1]],
      // Nose — cats read the slot as cat noses (face.js catNose): dot a small triangle · wedge a heart · hook triangle + philtrum · long a wide nose with a long philtrum · none nothing
      nose: [["dot", 3], ["wedge", 2], ["hook", 2], ["long", 1], ["none", 1.5]],
      eyes: [["half", 3], ["sleepy", 3], ["slit", 3], ["cross", 2], ["wide", 2], ["dot", 1], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1], ["lidded", 2], ["sharp", 2], ["soft", 2]],
      // Mouth — ω dominates, then the flipped ω (smug), a pursed 3, line and dot, a meowing o (meow), a peeking tongue (blep). No wave and no smile (4 reference rows)
      mouth: [["omega", 4], ["smug", 2], ["three", 1.5], ["line", 2], ["dot", 2], ["meow", 1], ["blep", 0.7]],
      mouthSize: [["normal", 3], ["small", 2], ["wide", 0.3]],
      tail: [["curl", 4], ["longtail", 3], ["flag", 2], ["stubtail", 1], ["hook", 2.5], ["kink", 1.5]],
      tailSkin: [["line", 3], ["thick", 2], ["plume", 1.5], ["tuft", 1], ["block", 0.5], ["ball", 0.5], ["puff", 0.3]],   // cats get a thin line. wedge disabled
      tailLength: [["long", 3], ["medium", 2], ["short", 1]],
      face2: [["none", 5], ["blush", 1], ["circles", 0.8]]
    }
  },
  {
    name: "rex",
    // The tyrannosaur. A biped WITH a tail (the one biped allowed one — the tail gate reads identity.tail,
    // draw/limbs.js) whose whole point is still COLOR: vivid scales (palette.js SCALES) with a pattern in a
    // second scale color on almost every one. A huge jaw of teeth, small fierce eyes set high, tiny stubby
    // arms (armSpread is halved in the proportions), thick stomping legs, a long thick tail. It can be angry
    // (the fierce eyes and the tooth grid), and its tiny arms still high five.
    forbid: {
      ears: { round: "none", roundMid: "none", roundBig: "none", pointy: "none", pointyMid: "none", pointyBig: "none", flap: "none", long: "none", fold: "none", foldMid: "none", foldBig: "none", perk: "none", perkMid: "none", perkBig: "none" },
      eyes: { cyclops: "dot" },
      hairFront: { hairline: "none", blunt: "none", swept: "none", curtain: "none", sideLock: "none", cap: "none", spikes: "none", mohawk: "none", hedgehog: "none", tuft: "none", wisp: "none", curly: "none", helmet: "none", cloud: "none" },
      hairBack: { bob: "none", mop: "none", long: "none", sheets: "none", twintails: "none", bunsTop: "none", bunsLow: "none", bunsSide: "none", ponytail: "none", pigtails: "none" },
      hairTop: { bun: "none", apple: "none", appleBig: "none" },
      // The arms are tiny and stubby, always — every form folds to the little fists
      arms: { stick: "stubby", sleeve: "stubby", mitten: "stubby", none: "stubby" },
      armLength: { long: "medium" },
      legLength: { verylong: "long" }
    },
    identity: {
      ears: ["none"],
      skeleton: "biped",
      hairFront: ["none"], hairBack: ["none"], hairTop: ["none"],
      eyes: { not: ["cyclops"] },
      arms: true,
      armLength: ["medium"],
      legLength: { not: ["verylong"] },
      tail: true   // the one biped with a tail
    },
    bias: {
      // The point of the species — almost every one is patterned, in a second scale color (spec.js pattern2)
      pattern: [["stripes", 3], ["spots", 3], ["dots", 2.5], ["patch", 2], ["hatch", 2], ["none", 1]],
      // Dragon horns — the maid-dragon mapping lives in drawHorns (the way of drawing differs by species)
      horns: [["none", 3], ["curved", 2], ["antenna", 1.5], ["straight", 1.5], ["ram", 1.5], ["nub", 1], ["crown", 1]],
      ears: [["none", 1]],
      hairFront: [["none", 1]], hairBack: [["none", 1]], hairTop: [["none", 1]],
      headgear: [["none", 9], ["cap", 0.5], ["crown", 0.4], ["halo", 0.3], ["cone", 0.4], ["coronet", 0.4]],
      eyewear: [["none", 7], ["monocle", 1], ["patch", 1]],
      // A blocky head for the jaw to live in
      head: [["block", 3], ["wide", 2.5], ["square", 2], ["pear", 1]],
      // Small fierce eyes, set high on the head (the proportions push them up over the jaw)
      eyes: [["dot", 3], ["sharp", 2.5], ["lidded", 2], ["ring", 1.5], ["slit", 1.5], ["hollow", 1], ["side", 1], ["half", 1]],
      brow: [["none", 2], ["flat", 1.5], ["angry", 1.5], ["peak", 0.8], ["bushy", 0.6], ["mono", 0.3]],
      nose: [["nostrils", 3], ["none", 2], ["dot", 1]],
      // THE JAW — a wide mouth full of teeth: the grid, fangs, zigzag, the open mouths with tooth strips
      mouth: [["grimace", 3], ["fangs", 3], ["zigzag", 2], ["open", 2], ["shout", 1.5], ["grin", 1]],
      mouthSize: [["wide", 3], ["normal", 1.5]],
      mouthPos: [["low", 3], ["mid", 1]],
      body: [["bean", 3], ["box", 1.5]],
      arms: [["stubby", 1]],
      tail: [["longtail", 5], ["kink", 1.5], ["flag", 1]],
      tailSkin: [["thick", 5], ["block", 1]],
      tailLength: [["long", 5], ["medium", 1]],
      // The dressing-up — a decorated tail on most (the pretty half of the counterweight)
      tailDeco: [["none", 3], ["plates", 2], ["dip", 2], ["spikes", 2], ["ribbon", 1.5], ["club", 1], ["band", 1]],
      // Thick stomping legs on a heavy build — boots read as the dino feet's mass
      legs: [["boots", 4], ["stub", 3], ["stick", 0.5]],
      legLength: [["medium", 3], ["long", 2], ["short", 1]],
      build: [["wide", 3], ["medium", 2]],
      face2: [["none", 6], ["blush", 0.5], ["circles", 0.8]]
    }
  },
  {
    name: "imp",
    forbid: {
      // An imp's head is ink-black — that is the species, and a pale one is not an imp (identity,
      // census --check). Pale is the only ghost there is now, so imps simply do not get them
      ghost: { white: "none" },
      ears: { round: "none", roundMid: "none", roundBig: "none", pointyMid: "pointy", pointyBig: "pointy", flap: "none", long: "none", fold: "none", foldMid: "none", foldBig: "none", perk: "pointy", perkMid: "pointy", perkBig: "pointy" },   // an imp ear is none or a small pointy one
      tailDeco: { ribbon: "none", plates: "none", dip: "none", club: "none", band: "none", spikes: "none" }   // the tail decoration is the rex's — imps have no tail anyway
    },
    identity: {
      ears: ["none", "pointy"],   // an imp ear is none or a small pointy one
      skeleton: "biped",
      darkHead: true,
      // arms unchecked — imps sometimes have no arms (arms none)
      tail: false
    },
    bias: {
      horns: [["curved", 3], ["straight", 2], ["antenna", 2], ["ram", 2], ["crown", 2], ["nub", 1]],
      ears: [["none", 5], ["pointy", 2]],
      hairFront: [["none", 6], ["spikes", 2]], hairBack: [["none", 1]], hairTop: [["none", 1]],
      headgear: [["none", 1]],
      eyewear: [["none", 6], ["patch", 2], ["goggles", 1]],
      eyes: [["ring", 3], ["wide", 3], ["cyclops", 2], ["spiral", 2], ["cross", 2], ["scrawl", 2.5], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["lidded", 1], ["sharp", 2], ["soft", 2]],
      nose: [["none", 4], ["dot", 2]],
      // Mouth — wide (a species multiplier of 1.3 plus wide). The tooth grid, a hatched mass, zigzag, big fangs, and shout/open with two tooth strips (5 reference rows)
      mouth: [["grimace", 3], ["scribble", 2], ["zigzag", 2], ["fangs", 3], ["shout", 1.5], ["open", 1.5], ["wave", 1], ["smug", 1], ["line", 0.5]],
      mouthSize: [["normal", 2], ["wide", 2], ["small", 0.5]],
      // The patterns are the imps' alone (the other three species forbid them), so all five live here
      pattern: [["stripes", 3], ["hatch", 2], ["none", 2], ["dots", 1.5], ["spots", 1.5], ["patch", 1.5]],
      face2: [["none", 6], ["tears", 1], ["circles", 1]],
      body: [["bean", 3], ["box", 1]],
      brow: [["none", 3], ["flat", 2], ["angry", 2], ["peak", 1], ["bushy", 0.5]],
      arms: [["stubby", 5], ["stick", 2], ["none", 2]],   // some are blobs with no arms
      // Long arms that sweep the floor belong to imps (humans forbid them). Enough to stand out in the imp row
      armLength: [["medium", 3], ["long", 2]],
      legs: [["stub", 3], ["stick", 3], ["float", 1]],
      // Stilts (verylong — twice long) belong to imps. Enough to stand out in the imp row
      legLength: [["long", 3], ["medium", 2], ["short", 1], ["verylong", 1.5]]
    }
  }
];
