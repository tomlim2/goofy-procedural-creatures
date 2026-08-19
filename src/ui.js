// 화면 조작 유틸 — main.js·gallery.js가 같이 쓴다. 씬을 모른다.

// 세그먼트 버튼 묶음(`.seg > button[data-<attr>]`)을 배선한다. 클릭하면 `.on`을 그 버튼으로 옮기고 onChange(value)를 부른다.
// 돌려주는 것: { value(), set(value) } — 키보드 단축키는 set으로 버튼 클릭과 같은 경로를 탄다.
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

// <select> 하나를 배선한다. bindSeg와 **같은 모양**({ value, set })을 돌려준다 — 컨트롤러가 버튼 묶음과 목록을 구별 없이 다룬다.
// set은 목록에 있는 값만 받는다 (주소에서 들어온 값이 옵션에 없으면 아무것도 안 한다 — bindSeg의 set과 같은 태도).
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

// <select>에 옵션 하나를 붙인다
export function addOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

// 32비트 무작위 시드 (화면에서 NEW SEED를 누를 때만 — 생성 경로에서는 Math.random을 쓰지 않는다, guidelines/determinism.md)
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

// rAF 루프. 예외가 나도 루프는 살린다 — rAF 루프가 죽으면 라벨만 바뀌고 캔버스가 멈춰서 "버튼이 안 눌린다"로 보인다.
// tick(elapsedSeconds)을 프레임마다 부른다. onError는 상태 라벨 갱신용
export function runLoop(tick, onError) {
  const start = performance.now();
  const frame = () => {
    try {
      tick((performance.now() - start) / 1000);
    } catch (error) {
      onError(error);
      console.error(error);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
