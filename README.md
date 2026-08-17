# MENAGERIE

시드 하나에서 자라나는 손그림 크리처 그리드. 위에서부터 사람·사람·고양이·개·도깨비 다섯 줄이
저마다의 시계로 숨쉬고, 깜빡이고, 두리번거리고, 놀라고, 손 흔들어 인사하고, 팔짱을 꼈다 풀고, 제자리에서 폴짝이고, 머리 위에 ♥ ! ? 를 띄운다.
선은 낮은 주기로 계속 끓는다(보일). 형태는 NEW SEED를 눌러야만 바뀐다.

## 목표

새로고침할 때마다 서른 마리 남짓한 크리처가 한 판씩 나온다. 목표는 한 마리를 잘 그리는 것이
아니라 **한 판을 봤을 때 서로 다르게 보이는 것**이다. 텍스처나 브러시 이미지를 쓰지 않고
규칙만으로 손그림 질감을 만든다.

## 실행

```bash
node serve.mjs
```

`http://127.0.0.1:7300`. native ES module을 쓰므로 `file://` 직접 실행은 지원하지 않는다.
three.js는 importmap으로 unpkg에서 받는다.

`/gallery.html?slot=legs&species=human` — **파츠 갤러리**. 슬롯 하나의 모든 값을 같은 개체(종족·시드 고정)에
나란히 그린다. FIX 드롭다운(`&fix=legLength:short`)으로 다른 슬롯 하나를 고정할 수 있고, `&values=bangs,bun`으로 그 슬롯의
몇 값만 크게 놓고 볼 수 있다. 파츠 하나의 형태를 판단할 때. census가 숫자라면 이건 그림이다.

`/audit.html?seed=…` — **얼굴 파츠 전수조사**. 판 하나(35마리)를 얼굴 상태 22가지(놀람·잠·깜빡임·^^·윙크·화남·눈썹/입 전환·
8방향 돌림·☆♥ 변형·조합)로 그려, 눈·코·입·눈썹·안경·볼·잠 눈꺼풀을 하나씩 껐다 켰다 하며 픽셀 차이를 센다. 머리 폭의 4% 미만이면
"안 보임"으로 적는다. 얼굴을 고쳤으면 돌린다 — 0건이어야 한다.

| 조작 | |
| --- | --- |
| NEW SEED / `R` | 새 시드. 주소창 해시가 시드다 — `#0z0y9qe`처럼 붙여 두면 같은 판이 다시 나온다 |
| POSE MOTION / BIND / `B` | BIND는 리그를 바인드 포즈(T)에 고정. 형태·파츠를 판단할 때 |
| INK BOIL / STILL / `I` | STILL은 선의 끓음(보일)을 멈춤. 포즈와 별개 축 — 모션 판단 시 잡음 제거 |
| ACTION AUTO / IDLE / SLEEP / WALK / 행위 | 행위 하나를 강제(그 층만, 다른 층은 idle) — 팔(인사·만세·팔짱·경례…, 두발), 몸(제자리 점프, 전원), 네발(긁기·꼬리 흔들기). SLEEP은 네발을 엎드려 재우고, WALK는 전원 걷기 — 집↔밖 왕복(팔 행위는 예약대로). AUTO는 층끼리 겹치고 개·고양이는 이따금 자고 모두 이따금 걷는다. IDLE은 모든 층 idle·깨어 있음 |
| REGEN STILL / LIVE / `S` | 기본 STILL. LIVE를 켜면 개체가 각자의 시계(6~14초)로 교체된다 (레퍼런스 동작) |
| SPECIES ALL / HUMAN / CAT / PUP / IMP | ALL은 고정 레인. 나머지는 그 종족만 — 색·파츠 분포를 판단할 때 |
| GRID 5×4 / 7×5 / 9×6 | |

## 구조

**캐릭터**(무엇인가)와 **모션**(어떻게 움직이나) 두 축이다. 캐릭터는 시드가 정하는 정적인 전부이고
모션은 시계가 정하는 동적인 전부다. 파츠별 애니메이션이 아니다. 둘을 잇는 게 scene의 리그다.

| 위치 | 하는 일 | 문서 |
| --- | --- | --- |
| `src/rng.js` | 시드 PRNG(mulberry32), 가중치 추첨, 1D 값 노이즈 | [determinism](guidelines/determinism.md) |
| `src/stroke.js` | 획 → 리본 지오메트리. 떨림, 필압, 스크리블, 스크리블 채움, 해칭. `buildGeometry`(스케치 여러 벌 → 지오메트리 하나) | [drawing](guidelines/drawing.md) |
| `src/color.js` | 헥스 색 유틸 — 선형 변환(`hexToRgb`), 휘도(`luminance`·`isDark`), 톤(`shade`). 캐릭터·그리기가 같이 쓴다 | [drawing](guidelines/drawing.md) § 색 |
| **`src/character/`** | 시드가 결정하는 정적인 것. `vocabulary/`(슬롯·종족·아키타입·팔레트) `spec.js`(시드→스펙) `draw/`(스펙→획: `layout` `head` `hair` `headgear` `face` `mouth` `faceStates` `body` `limbs`) | [character/](guidelines/character/) |
| **`src/motion/`** | 시계가 결정하는 동적인 것. `table.js`(종족 파라미터) `rhythm.js`(상시) `events.js`(간헐) `states.js`(유지 — 기본 상태 idle/sleep/walk 포함) `actions.js`(idle과 행위 — 팔·몸·네발 층) `emoji.js`(이모지 애니메이션 — 트리거 층) `ease.js`(곡선 모양 — 봉투·추종, 전부 ease in/out) `index.js`(rng 순서 고정 조립) | [motion/](guidelines/motion/) |
| `src/scene/` | three.js. `rig.js`(지오메트리 → 계층) `animate.js`(상태 → 리그) `paper.js` `material.js`(공유 재질·메시) `emoji.js`(글리프 모양) `index.js`(씬·루프·재생성) | [rig](guidelines/rig.md) · [performance](guidelines/performance.md) |
| `src/main.js` · `src/ui.js` | 진입점. UI 배선 (`ui.js` — 세그먼트 버튼·옵션·rAF 루프 유틸, gallery·audit과 공유) | |
| `src/gallery.js` · `gallery.html` | 파츠 갤러리 — 슬롯값별로 같은 개체를 나란히 | |
| `src/audit.js` · `audit.html` | 얼굴 파츠 전수조사 — 상태별로 파츠가 보이는지 픽셀로 센다 | [character/rules](guidelines/character/rules.md) |
| `guidelines/` | 두 축의 카탈로그와 규칙, 성능·시드·그리기 규칙. **고치기 전에 읽는다** | [README](guidelines/README.md) |
| `reference/` | 무엇을 보고 만들었고 무엇을 가져오고 안 가져왔는지 | [README](reference/README.md) |
| `scripts/` | 아래 § 스크립트 | |

## 스크립트

```bash
node scripts/census.mjs                # 종족 × 슬롯 분포표 + 정체성 위반. 파츠·가중치를 고쳤으면 본다
node scripts/census.mjs --slot hair    # 한 슬롯만
node scripts/census.mjs --check        # 위반만 (exit 1)

node scripts/snapshot.mjs before       # 리팩토링 전 — 스펙·지오메트리·60초 모션 궤적을 찍는다
node scripts/snapshot.mjs after        # 리팩토링 후 — diff 0이면 동작 불변

node scripts/drawdiff.mjs [ref]        # 그리기 리팩토링 — 작업 트리를 git 시점(기본 HEAD)과 슬롯값 전부 × 종족 × 시드로 맞댄다. 0건이면 그리기 불변
```

## 다양성을 만드는 층

균등 랜덤으로 슬롯을 뽑으면 서른 마리쯤에서 "아까 본 것"이 나온다. 네 층을 겹친다.

1. **종족** — 줄 단위 고정 레인. 골격(두발/네발), 색, 전용 파츠, 지배 모션이 갈린다
2. **아키타입** — `beast` `scholar` `trooper` `sprite` `blob` `wanderer` 여섯 성향을 개체마다 뽑고
   그 안에서 고른다. 좌·상 이웃과 겹치면 다시 뽑는다
3. **기본 가중치** — 아키타입이 관여하지 않는 슬롯에도 가중치를 준다. 없으면 선택지 수가 곧
   확률이 되어 `eyewear`는 80%가 무언가를 쓴다
4. **비율 지터** — 머리 크기·너비·혹, 눈 크기·간격·좌우 비대칭, 몸 폭, 팔 길이, 손떨림.
   실루엣 다양성의 대부분이 여기서 나온다

23슬롯 174파츠. 슬롯은 형태만 담고, 자세·동작은 모션이다. 길이·체격(`armLength` `legLength` `build`)은 형태와
독립인 치수 슬롯 — 스케일이 아니라 기장·폭만 바뀌고, 다리 스탠스는 몸통 폭이 정한다.

## 손그림 질감

WebGL의 `linewidth`는 대부분 1로 고정되므로 `Line`으로는 굵기를 줄 수 없다. 모든 획을
리본 메시로 만든다.

- 획을 일정 간격으로 재샘플링한 뒤 법선 방향으로 민다. 저주파(전체가 휘는 것)와
  고주파(잔떨림)를 겹친다
- 끝으로 갈수록 얇아지고 중간에서 필압이 흔들린다
- 외곽선은 2회 덧그어 겹친 자국을 남긴다
- 머리는 원이 아니라 노이즈로 찌그러뜨린 폐곡선이다
- 머리카락은 면을 칠하지 않고 왕복해 긋는 스크리블이다. 채색도 스크리블로 덮어 획 방향이 남는다
- 채색은 선과 어긋나게 오프셋을 준다
- 같은 그림을 지터 위상만 다르게 3벌 굽고 1.5~2초에 한 번씩 바꾼다(보일)

## 알아둘 것

- **색공간** — three.js는 정점 색을 선형 공간으로 본다. sRGB 헥스를 그대로 넣으면 어두운
  잉크가 중간 회색으로 밝아진다. `color.js`의 `srgbToLinear`(`hexToRgb`)가 이걸 보정한다
- **성능** — 프레임 비용은 draw call 수다. 재질은 불투명도별로 공유하고(`scene/material.js`) 층 하나는 메시 하나(채색+잉크)다.
  35마리에 draw call 550, 렌더 JS 0.8 ms/프레임. 재는 법과 규칙은 [guidelines/performance.md](guidelines/performance.md)
- **모듈 캐시** — `serve.mjs`는 상대 경로 import에 `?v=` 를 붙인다. `Cache-Control: no-store`만으로는
  브라우저의 ES module map이 비워지지 않아 파일을 고쳐도 이전 코드가 실행되는 일이 있다
- **시드 재현** — 같은 시드는 같은 판이다. rng 호출 순서가 곧 시드라 슬롯 순서 변경은 기존 시드를 깬다.
  새 슬롯은 `LATE_SLOTS`로 맨 끝에 뽑아 기존 판을 유지한다. 깨는 변경은 커밋에 "시드 재배열"이라고 적는다
