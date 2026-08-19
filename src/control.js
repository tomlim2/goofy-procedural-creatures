// 화면 컨트롤 한 벌 — 값·주소·그 값으로 하는 일을 한 표에 모은다. 씬을 모른다(무엇을 할지는 apply로 받는다).
//
// 버튼에 기능을 달지 않는다. 버튼(ui.js bindSeg·bindSelect)은 "이 값이 됐다"만 알리고,
// 무엇을 할지(apply)와 주소에 어떻게 실릴지(initial과 다르면 쿼리에 실린다)는 여기 표가 정한다.
// 그래서 값이 바뀌는 길이 하나다 — 클릭도, 단축키도, 주소로 들어오는 것도 같은 set()을 탄다.
//
// def 하나: { el, kind, initial, apply(value), rebuild }
//   kind      "seg"(기본) — `.seg > button[data-<key>]` · "select" — <select> 하나
//   initial   화면이 처음 서 있는 값. **HTML의 `.on` 버튼(또는 첫 옵션)과 같아야 한다** — 다르면
//             손도 안 댄 화면의 주소에 그 항목이 실린다
//   rebuild   판을 다시 구워야 하는 값(그리드·종족). 나머지는 씬 스위치라 굽지 않는다
//
// 화면에 없는 컨트롤(el이 null)은 건너뛴다 — 메인은 카드 몇 장만 두고 디버그 화면이 전부를 둔다.
// 건너뛴 값은 apply가 안 돌아 **씬의 기본값 그대로** 남는다. 그래서 initial은 씬 기본값과도 같아야 한다.

import { bindSeg, bindSelect } from "./ui.js";

export function createControls(defs, onChange) {
  const bound = {};
  for (const [key, def] of Object.entries(defs)) {
    if (!def.el) continue;
    const notify = (value) => { def.apply(value); onChange(def); };
    bound[key] = def.kind === "select" ? bindSelect(def.el, notify) : bindSeg(def.el, key, notify);
  }

  return {
    // 이 화면에 없는 컨트롤은 조용히 넘어간다 — 부르는 쪽(단축키)이 화면마다 갈리지 않게
    value: (key) => (bound[key] ? bound[key].value() : null),
    set: (key, value) => { if (bound[key]) bound[key].set(value); },

    // 주소 → 화면. 버튼 클릭과 같은 경로(set)를 타므로 apply도 같이 돈다. 없는 값은 무시된다
    read(params) {
      for (const key of Object.keys(bound)) {
        const value = params.get(key);
        if (value !== null) bound[key].set(value);
      }
    },

    // 화면 → 주소. initial인 항목은 뺀다 — 손 안 댄 화면의 주소에는 아무것도 안 붙는다
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
