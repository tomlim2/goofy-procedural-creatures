# 성능

> 기준: `src/scene/material.js`, `src/scene/rig.js`, `src/scene/index.js`, `src/stroke.js`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

이 랩의 프레임 비용은 거의 전부 **draw call 수**다. 삼각형은 판 하나에 6만 개쯤이라 GPU는 놀고, 매 프레임 JS가 하는 일은
개체당 상태 적용(`applyState`) 몇 백 줄과 three.js가 메시마다 재질을 세팅하고 그리는 일이다. 그래서 규칙은 셋이다:
**메시를 줄이고, 재질을 나눠 쓰고, 지오메트리를 프레임마다 만들지 않는다.**

## 수치 (7×5 = 35마리, 픽셀 비 2 · 1500×1428 캔버스에서 잰 것 — 절대값은 기기마다 다르고 비율만 본다)

| | 재질 공유·메시 병합 전 | 지금 |
| --- | --- | --- |
| draw call / 프레임 | 1313 | **538** |
| 렌더 JS 시간 / 프레임 | 3.3 ms | **0.7 ms** |
| 재질 객체 | 1611 (메시마다 하나) | **4~6** (불투명도별 공유 + 이모지) |
| 삼각형 / 프레임 | 119k | 59k (한 번만 그린다) |
| 판 굽기 (`scene.build`) | 55 ms | 52 ms |

9×6(54마리)은 draw call 802, 프레임 1.05 ms. 굽기는 72 ms — NEW SEED가 즉시라 굽기 쪽은 더 줄일 이유가 없다.

## 어떻게 재나

콘솔에서 (`window.menagerie.scene`):

```js
const s = menagerie.scene, r = s.renderer;
const t0 = performance.now(); for (let f = 0; f < 120; f++) { s.resize(); s.update(10 + f / 60); }
console.log("ms/frame", ((performance.now() - t0) / 120).toFixed(2), "calls", r.info.render.calls, "tris", r.info.render.triangles);
```

`renderer.info.render`는 마지막 `render()`의 draw call·삼각형 수다. 개체·메시·재질 수는 `s.scene.traverse`로 센다.
씬 구조를 바꿨으면(층·리그·메시) 이 숫자를 다시 재서 위 표를 갱신한다.

## 규칙

### 재질은 불투명도별로 하나 — `inkMaterial(opacity)`

`scene/material.js`가 불투명도마다 재질 하나를 만들어 모든 메시가 나눠 쓴다(`userData.shared`). 렌더러는 같은 재질이 이어지면
uniform 갱신을 건너뛰고, 재생성 때 재질을 새로 굽지 않는다.

- 공유 재질은 **아무도 dispose하지 않는다** — `disposeGroup`이 건너뛴다. 임시 메시(전수조사)도 `disposeGroup`으로 지운다
- 공유 재질의 `opacity`를 프레임마다 바꾸지 않는다 — 같은 값을 쓰는 모든 메시가 같이 흐려진다. 그런 메시(이모지 페이드)는
  `sketchMesh(…, { own: true })`로 제 재질을 갖는다
- `forceSinglePass: true` — transparent + DoubleSide를 three.js가 뒷면·앞면 두 번 그리는 걸 막는다(draw call ×2, 재질 needsUpdate 매번).
  앞뒤 정렬이 필요한 3D 반투명 물체용이라 depthTest 없는 2D 리본에는 뜻이 없다

### 층 하나 = 메시 하나 — 채색과 잉크를 한 지오메트리로

`stroke.js buildGeometry(sketches)`가 스케치 여러 벌을 하나로 잇는다(앞의 것이 밑). `rig.js`는 층마다 채색 스케치 다음 잉크 스케치를 한 메시로
굽는다 — 채색은 전부 불투명이라 같은 renderOrder에서 채색이 먼저 그려지면 그만이다. 예외는 얼굴(face)·정지 눈(staticEyes) 두 층 —
정지 눈의 채움(동공·흰자)이 얼굴 잉크(수염) 밑, 정지 눈 잉크가 그 위에 와야 해서 채색 2.3·잉크 2.4를 따로 둔다.
눈 리그의 흰자·테도 한 메시다. 계층·번호는 [rig.md](rig.md) § 계층.

개체 하나가 보이는 메시는 15개 안팎이다(층 11 중 비어 있지 않은 것 + 팔다리·꼬리 마디·눈썹·입·눈). 층을 새로 만들 때는
"기존 층에 그려도 되나"를 먼저 묻는다 — 층 하나가 판 전체에 35~54 draw call이다.

### 지오메트리는 굽는 것이지 프레임마다 만드는 것이 아니다

[drawing.md](drawing.md) § 생성은 한 번, 애니메이션은 변형만. 프레임마다 바꾸는 건 `visible`·`position`·`rotation`·`scale`뿐이다.
예외는 이모지(트리거당 1회)와 재생성(개체 교체)이다.

### 크기가 안 바뀌면 다시 잡지 않는다

`scene.resize()`는 main이 매 프레임 부른다. 캔버스 CSS 크기·픽셀 비가 지난번과 같으면 아무것도 안 한다 — `canvas.width`는 픽셀 비가 곱해진
값이라 `clientWidth`와 직접 비교하면 매 프레임 `setSize`가 불려 드로잉 버퍼가 프레임마다 다시 잡힌다.

### 굽기 쪽 (참고)

- `color.js hexToRgb`는 문자열별로 캐시한다 — 판 하나에 획 수천 개, 색은 수십 가지
- `Sketch.stroke`의 끝 가늘어짐·필압 함수는 획마다 한 번 만든다(구간마다가 아니라)
- 그리기 함수(`character/draw/`)는 `layout`·`eyeGeometry`를 여러 번 부른다 — 산술뿐이라 안 잰다. 굽기 55 ms의 대부분은 리본 정점 생성이다
