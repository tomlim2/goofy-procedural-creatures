# 캐릭터 규칙

`src/character/`를 고칠 때 지키는 것. 무엇이 있는지는 [types.md](types.md)·[parts.md](parts.md).

순서: **원칙**(형태/모션 분리, 종족 제한 위치) → **절차**(파츠·슬롯·아키타입 추가, 그리기) → **검증**(가중치·census).

## 형태와 모션을 섞지 않는다

슬롯은 **형태(what it looks like)** 만 담는다. **자세·동작(what it does)** 은 `motion/`의
상태다. 한 슬롯에 둘을 섞으면 "뒷짐진 개체는 영원히 뒷짐"이 된다.

| | 어디에 | 예 |
| --- | --- | --- |
| 형태 | `SLOTS.arms`, `SLOTS.legs`, `SLOTS.armLength` | stick / sleeve / stubby / mitten, boots / tiptoe, medium~verylong |
| 바인드 포즈 | 코드 상수 (`BIND_POSE` = T포즈) | 모션이 없을 때. 캐릭터에 "자세"는 없다 |
| 행위 | `motion/states.js` armAction, `motion/table.js` armActions | 만세 · 팔짱 · 허리손 · 뒷짐 · 늘어뜨림 · 파닥임(좋아함) |

같은 원리가 눈에도 적용돼 있다: 눈 **종류**(ring/dot/slit)는 슬롯이고, 깜빡임·개방도·
윙크·^^는 clock 상태다. 새 파츠를 넣을 때 "이게 생김새인가 행동인가"를 먼저 묻는다.

## 종족 제한은 species.js에

"사람에게는 X가 없다" 같은 종족 제한은 **`species.js` 한 곳**에 둔다. 두 가지 필드가 있다.

| 필드 | 뜻 | 효과 |
| --- | --- | --- |
| `forbid[slot] = { 값: 대체값 }` | 이 슬롯의 이 값이 나오면 대체값으로 | `applyConstraints`가 **맨 먼저** 읽어 결정적으로 덮어쓴다. 아키타입 성향(scholar의 dot 눈 등)은 산다 |
| `bias[slot]` | 이 슬롯의 가중치 | 아키타입 bias보다 우선 — **슬롯 전체를 종족이 지배**한다. 개 귀·고양이 꼬리처럼 종족이 규정하는 슬롯에만 |
| `identity` | 종족이 지켜야 할 것 (골격·뿔·눈·팔·꼬리·머리색) | `scripts/census.mjs`가 검사한다. 위반은 버그다 |

값 하나만 막을 때는 forbid, 슬롯 전체를 종족이 가져갈 때만 bias. spec.js·draw/에 종족 이름을
하드코딩하지 않는다 (draw/의 종족 분기는 "그리기 방식"이 다를 때만 — 개 주둥이, 고양이 정수리 귀).

## 세 파일을 순서대로 고친다

파츠 하나를 추가하려면 세 곳을 손대야 한다. 순서를 지킨다.

1. **`src/character/vocabulary/slots.js`** — `SLOTS`에 이름을 넣는다. 이름은 `draw/`의 분기 키와 정확히 같아야 한다
2. **`src/character/vocabulary/`** — 필요하면 `slots.js` `DEFAULT_BIAS`, `archetypes.js`·`species.js` `bias`에 가중치를 넣는다
3. **`src/character/draw/`** — 파츠가 속한 파일(`head.js`/`face.js`/`body.js`/`limbs.js`)에 분기를 추가한다

`spec.js`는 대개 손대지 않는다. 새 조합이 다른 파츠와 충돌할 때만 `applyConstraints`에 넣는다.

## 슬롯을 새로 만드는 건 다른 이야기다

기존 슬롯에 선택지를 추가하는 것과 슬롯 자체를 새로 만드는 것은 무게가 다르다.
슬롯 추가는 rng 호출 횟수를 늘리므로 **기존 시드를 전부 깬다.**
[../determinism.md](../determinism.md)를 먼저 읽는다.

## 새 아키타입

여섯 개로 충분하지 않다고 느끼면 추가해도 된다. 다만 아키타입은 **성향**이지 캐릭터가 아니다.

- `bias`에 넣는 슬롯은 그 성향을 실제로 규정하는 것만. 전부 다 적으면 아키타입이 아니라 프리셋이 된다
- `weight`는 2~3에서 시작한다. 한 아키타입이 그리드의 3분의 1을 넘게 차지하면 판이 단조로워진다

## 그리기 함수가 지켜야 할 것

- **셀 밖으로 나가지 않는다.** 로컬 좌표에서 y는 0(바닥)부터 약 1.05(정수리), x는 ±0.45 안
- **바닥에 닿는 것은 바닥까지 그린다.** 다리를 짧게 그리면서 발을 y=0에 두면 발만 공중에 뜬다.
  실제로 `stub` 다리에서 이 버그가 났다
- **머리 위를 덮는 것은 정수리 근처로 제한한다.** 호를 좌우 180°까지 벌리면 머리 옆면
  한가운데까지 내려와 눈을 덮는다. 헤어 캡의 `depth`는 0.45를 넘기지 않는다
- **파츠끼리 알아서 피하게 만들지 않는다.** 겹침은 `applyConstraints`에서 조합 단계에 막는다

## 가중치는 눈이 아니라 숫자로 맞춘다

선택지 개수가 곧 확률이 되는 함정이 있다. 슬롯에 항목을 늘리면 `none`이 나올 확률이
자동으로 줄어든다. 실제로 이 랩은 초기에 이 문제로 **`eyewear`의 80%가 안경류**,
**`hair`의 59%가 대머리**였다.

그래서 아키타입이 관여하지 않는 슬롯에도 `DEFAULT_BIAS`로 가중치를 준다.
파츠를 고쳤으면 반드시 분포를 센다 — `node scripts/census.mjs --slot <슬롯>` (아래 § 분포는 census로 본다).

기준선:

- `none`이 있는 슬롯에서 `none`은 **25~45%**. 이보다 낮으면 화면이 지저분하고, 높으면 밋밋하다
- 어떤 선택지도 200마리 중 **5회 미만이면 안 된다**. 그건 있으나 마나다
- 200마리에서 파츠 조합이 겹치는 쌍이 나오면 슬롯이 부족하다는 신호다

## 분포는 census로 본다

```bash
node scripts/census.mjs              # 종족 × 슬롯 분포표 + 정체성 위반
node scripts/census.mjs --slot hair  # 한 슬롯만
node scripts/census.mjs --check      # 위반만 (exit 1)
```

죽은 값(어느 종족에서도 0%)이 보이면 bias 조정 대상이다. 실제로 hair의 mohawk·scribble이
kid 아키타입 전부에 hair bias가 있어서 DEFAULT_BIAS가 안 쓰이는 바람에 0%였다.

브라우저의 SPECIES 카드로 한 종족만 9×6에 놓고 볼 수 있다. 한 줄 7마리로는 색·파츠 분포를 판단할 수 없다.
