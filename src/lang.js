// The two languages the name screen speaks (guidelines/name.md § the two languages): Korean when the device asks for it, English
// for everyone else — the first of the device's languages that is one of the two decides, so a phone set to Korean with English
// second gets Korean, and one set to Japanese with Korean second gets Korean too. What is translated is what the screen says and
// the one word the card says about the creature — the controls, the back's hint, the species. The name stays as it was typed and
// MENAGERIE stays MENAGERIE. Nothing here touches the DOM, so scripts/names.mjs reads the same tables as the page

export const LANGS = ["en", "ko"];

// The language for a device's list of language tags (navigator.languages): the first tag whose language is one of the two, else English
export function langOf(tags) {
  for (const tag of tags || []) {
    const lang = String(tag).toLowerCase().split("-")[0];
    if (LANGS.includes(lang)) return lang;
  }
  return "en";
}

// What the screen says — the controls and the words around the card
export const UI = {
  en: {
    title: "MENAGERIE — draw your creature",
    name: "YOUR NAME", species: "Species",
    any: "ANY", human: "HUMAN", cat: "CAT", pup: "PUP", imp: "IMP", rex: "REX",
    draw: "DRAW", drawing: "DRAWING…", save: "SAVE", link: "LINK", copied: "COPIED",
    linkPrompt: "The card's link",
    hint: "TYPE A NAME",
    live: (card) => `${card.name} — ${card.kind.toLowerCase()}`
  },
  ko: {
    title: "MENAGERIE — 이름으로 뽑는 카드",
    name: "이름", species: "종족",
    any: "아무나", human: "사람", cat: "고양이", pup: "강아지", imp: "도깨비", rex: "공룡",
    draw: "뽑기", drawing: "뽑는 중…", save: "저장", link: "링크", copied: "복사됨",
    linkPrompt: "카드 링크",
    hint: "이름을 적어 보세요",
    live: (card) => `${card.name} — ${card.kind}`
  }
};

// What the card says about the creature — its species. English is the vocabulary's own name in capitals (card.js), Korean its table
export const WORDS = {
  en: { species: null },
  ko: { species: { human: "사람", pup: "강아지", cat: "고양이", rex: "공룡", imp: "도깨비" } }
};
