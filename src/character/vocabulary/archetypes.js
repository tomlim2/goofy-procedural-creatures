// Archetypes — dispositions. Docs: guidelines/character/types.md

// Archetypes. Purely random combinations start looking like "the one I just saw".
// Drawing a disposition first and varying inside it is what makes 35 creatures look different from each other.
export const ARCHETYPES = [
  {
    name: "beast",
    weight: 3,
    bias: {
      horns: [["curved", 4], ["straight", 3], ["nub", 2], ["none", 1]],
      ears: [["pointy", 2], ["pointyMid", 1], ["flap", 2], ["round", 2], ["none", 1]],
      mouth: [["grimace", 3], ["grin", 2], ["wave", 2], ["open", 2], ["line", 1]],
      nose: [["wedge", 3], ["hook", 2], ["dot", 2], ["broad", 1.5], ["none", 1]],
      hairFront: [["none", 3], ["hairline", 2], ["swept", 1], ["spikes", 3], ["hedgehog", 2], ["mohawk", 2], ["tuft", 2]],
      hairBack: [["none", 4], ["mop", 2]],
      hairTop: [["none", 3]],
      head: [["round", 3], ["wide", 2], ["square", 2], ["pear", 1]]
    }
  },
  {
    name: "scholar",
    weight: 2,
    bias: {
      eyewear: [["glasses", 5], ["monocle", 2], ["goggles", 1], ["none", 1]],
      eyes: [["dot", 3], ["half", 2], ["sleepy", 2], ["ring", 1], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1], ["lidded", 1], ["sharp", 1], ["soft", 1]],
      hairFront: [["none", 2], ["hairline", 2], ["blunt", 3], ["swept", 2], ["curtain", 1.5], ["sideLock", 1.5], ["helmet", 2], ["wisp", 2], ["curly", 2], ["cloud", 1]],
      hairBack: [["none", 3], ["bob", 3], ["long", 1.5], ["ponytail", 1], ["sheets", 1]],
      hairTop: [["none", 5]],   // the filled family — the neat, combed kinds suit the scholar
      headgear: [["none", 4], ["beret", 3], ["cap", 1]],   // bonnet disabled
      mouth: [["line", 3], ["dot", 2], ["smile", 2], ["three", 1.5], ["frown", 1], ["smug", 1.5], ["bracket", 1]],
      nose: [["long", 3], ["hook", 3], ["dot", 1]],
      horns: [["none", 6], ["nub", 1]]
    }
  },
  {
    name: "trooper",
    weight: 3,
    bias: {
      headgear: [["helmet", 4], ["cap", 3], ["band", 2], ["pot", 2], ["none", 1]],
      eyewear: [["patch", 3], ["goggles", 3], ["none", 3]],
      head: [["square", 3], ["block", 2], ["round", 2], ["wide", 1]],
      hairFront: [["none", 3], ["hairline", 2], ["swept", 1], ["spikes", 2], ["mohawk", 1.5], ["hedgehog", 1.5]],
      hairBack: [["none", 3], ["mop", 2]],
      hairTop: [["none", 3]],
      arms: [["sleeve", 3], ["stick", 2]],
      legs: [["boots", 4], ["stick", 2], ["stub", 1]]
    }
  },
  {
    name: "sprite",
    weight: 3,
    bias: {
      horns: [["antenna", 5], ["nub", 2], ["none", 2]],
      eyes: [["wide", 4], ["ring", 3], ["spiral", 2], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1], ["lidded", 1], ["sharp", 1], ["soft", 1]],
      head: [["tall", 3], ["round", 3], ["egg", 2], ["pear", 1]],
      body: [["tube", 3], ["bean", 2]],
      build: [["narrow", 2], ["skinny", 2], ["medium", 1]],
      legs: [["stick", 3], ["tiptoe", 2], ["bent", 2]],
      arms: [["stick", 3], ["mitten", 2]],
      hairFront: [["none", 3], ["hairline", 2], ["blunt", 1.5], ["curtain", 1], ["wisp", 2], ["tuft", 1.5], ["curly", 1], ["cloud", 1], ["spikes", 1]],
      hairBack: [["none", 4], ["pigtails", 2], ["twintails", 1.5], ["bunsTop", 1], ["bunsSide", 0.7]],
      hairTop: [["none", 4], ["apple", 1], ["appleBig", 1]],   // the filled family — the parted curtain is the pretty one
      nose: [["none", 4], ["dot", 3], ["hook", 1]]
    }
  },
  {
    name: "blob",
    weight: 2,
    bias: {
      head: [["wide", 4], ["round", 3], ["pear", 2]],
      hairFront: [["none", 2], ["hairline", 1], ["tuft", 2], ["helmet", 1]],
      hairBack: [["none", 5], ["mop", 1]],
      hairTop: [["none", 3]],
      eyes: [["dot", 3], ["ring", 3], ["half", 2], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1], ["lidded", 1], ["sharp", 1], ["soft", 1]],
      body: [["bean", 4], ["dress", 2]],
      build: [["wide", 3], ["medium", 1]],
      legs: [["stub", 4], ["stick", 1]],
      arms: [["stubby", 4], ["stick", 1]],
      horns: [["none", 5], ["nub", 2]]
    }
  },
  {
    name: "wanderer",
    weight: 2,
    bias: {
      headgear: [["band", 3], ["pot", 1], ["cap", 1], ["none", 5], ["coronet", 0.8]],
      hairFront: [["none", 3], ["hairline", 2], ["swept", 1], ["blunt", 1], ["helmet", 1.5], ["curly", 2], ["cloud", 1], ["wisp", 1]],
      hairBack: [["none", 3], ["mop", 3], ["ponytail", 1]],
      hairTop: [["none", 4], ["bun", 1.5], ["appleBig", 0.8]],   // the filled family — a little, so it is not the scholar's alone
      eyes: [["half", 3], ["sleepy", 3], ["cross", 2], ["ring", 2], ["oval", 1.5], ["line", 1.5], ["happy", 1.5], ["hollow", 1], ["squeeze", 1], ["side", 1], ["droop", 1], ["scrawl", 1], ["lidded", 1], ["sharp", 1], ["soft", 1]],
      mouth: [["wave", 3], ["line", 2], ["dot", 2], ["frown", 1.5], ["scribble", 1]],
      body: [["dress", 3], ["bean", 2]]
    }
  }
];
