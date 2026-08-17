# 시드 계약

**같은 시드는 항상 같은 판을 만든다.** 이 랩의 유일한 절대 규칙이다.
좋은 결과를 시드로 기록해 두고 나중에 다시 부르는 것이 이 도구의 존재 이유다.

## 금지

- 생성 경로 어디에서도 `Math.random()`을 부르지 않는다. 난수는 전부 `makeRng(seed)`에서 나온다
- `Date.now()`, `performance.now()`를 생성 경로에서 읽지 않는다. 시간은 `motion/`에서만 쓴다
- 객체 키 순회 순서에 의존하는 코드를 넣지 않는다. 슬롯 순회는 `SLOTS`의 선언 순서를 따른다

## rng 호출 순서가 곧 시드다

`makeRng`는 상태 기계다. 호출 횟수와 순서가 바뀌면 **그 뒤의 모든 값이 바뀐다.**

```js
// 이렇게 고치면 기존 시드의 결과가 전부 달라진다
const parts = {};
for (const slot of Object.keys(SLOTS)) parts[slot] = pickSlot(rng, archetype, slot);
```

그래서 다음은 전부 **기존 시드를 깨는 변경**이다. 해도 되지만 알고 해야 한다.

- `SLOTS`의 순서를 바꾸거나 슬롯을 **중간에** 끼우는 것 (`character/vocabulary/slots.js`)
- `makeCreature` 안에서 rng를 부르는 순서를 바꾸는 것
- `applyConstraints`에서 `rng.chance()` 호출을 추가하거나 제거하는 것

반대로 다음은 **시드를 깨지 않는다.**

- 가중치 숫자만 바꾸는 것 (`DEFAULT_BIAS`의 값 조정) — 결과는 달라지지만 호출 횟수는 같다
- 새 슬롯을 `LATE_SLOTS` 끝에 붙이는 것 — `makeCreature`가 파츠·제약·색·비율을 다 뽑은 **뒤에** 뽑으므로
  기존 판은 그대로이고 새 슬롯 값만 더해진다 (`legLength`·`build`·`tailSkin`이 이 자리다). `LATE_SLOTS`의 순서는 추가 순서다
- `character/draw/`만 고치는 것. 그리기는 스펙을 소비할 뿐 rng를 소비하지 않는다
- `stroke.js`의 폭·떨림 상수를 바꾸는 것

시드를 깨는 변경을 했으면 커밋 메시지에 적는다.

## 제약은 다시 뽑지 말고 덮어쓴다

`applyConstraints`에서 조합이 안 맞을 때 **전체를 다시 뽑으면 안 된다.** 결정적으로 덮어쓴다.

```js
// 좋다 — 호출 횟수가 조건에 상관없이 예측 가능하다
if (parts.headgear === "helmet") parts.hair = "none";

// 나쁘다 — 조건에 따라 rng 소비량이 달라져 이후 값이 전부 흔들린다
while (!valid(parts)) parts = rollAgain(rng);
```

`rng.chance()`를 조건부로 부르는 것도 같은 문제를 만든다 — 조건이 참일 때만 부르면 그 뒤 값이
갈린다. `applyConstraints`에 그런 곳이 몇 군데 있고(더듬이→귀, 안경→눈썹) 지금은 그 상태로
고정돼 있다. 새로 추가할 때는 조건 밖에서 먼저 뽑아 두거나(호출 수 고정), 종족 제한이면
`species.js` `forbid`를 쓴다(rng 없이 결정적 덮어쓰기).

## 그리기용 난수는 따로 판다

`character/draw/`는 `spec.proportions.wobbleSeed`로 자기 rng를 새로 만든다.
생성용 rng를 그리기에서 이어 쓰지 않는다. 그래야 그리기를 고쳐도 조합이 안 바뀐다.

## 확인 방법

`scripts/snapshot.mjs`가 스펙·지오메트리·모션 궤적을 한 번에 검증한다 ([../README.md](../README.md) § 스크립트).

```bash
node scripts/snapshot.mjs before   # 고치기 전
node scripts/snapshot.mjs after    # 고친 뒤 — diff 0이면 동작 불변
```

시드를 깨는 변경(슬롯 추가, rng 호출 순서 변경)을 의도적으로 했으면 `before`를 다시 찍어
베이스라인을 갱신하고, 커밋 메시지에 "시드 재배열"이라고 적는다.
