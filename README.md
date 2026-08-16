# MENAGERIE

시드 하나에서 자라나는 손그림 크리처 그리드. 위에서부터 사람·사람·고양이·개·도깨비 다섯 줄이
저마다의 시계로 숨쉬고, 깜빡이고, 두리번거리고, 놀라고, 팔짱을 꼈다 풀고, 이모트를 띄운다.
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

| 조작 | |
| --- | --- |
| NEW SEED / `R` | 새 시드. 주소창 해시가 시드다 — `#0z0y9qe`처럼 붙여 두면 같은 판이 다시 나온다 |
| POSE MOTION / BIND / `B` | BIND는 리그를 바인드 포즈(T)에 고정. 형태·파츠를 판단할 때 |
| INK BOIL / STILL / `I` | STILL은 선의 끓음(보일)을 멈춤. 포즈와 별개 축 — 모션 판단 시 잡음 제거 |
| REGEN STILL / LIVE / `S` | 기본 STILL. LIVE를 켜면 개체가 각자의 시계(6~14초)로 교체된다 (레퍼런스 동작) |
| SPECIES ALL / KID / CAT / PUP / IMP | ALL은 고정 레인. 나머지는 그 종족만 — 색·파츠 분포를 판단할 때 |
| GRID 5×4 / 7×5 / 9×6 | |

## 구조

**캐릭터**(무엇인가)와 **모션**(어떻게 움직이나) 두 축이다. 캐릭터는 시드가 정하는 정적인 전부이고
모션은 시계가 정하는 동적인 전부다. 파츠별 애니메이션이 아니다. 둘을 잇는 게 scene의 리그다.

| 위치 | 하는 일 | 문서 |
| --- | --- | --- |
| `src/rng.js` | 시드 PRNG(mulberry32), 가중치 추첨, 1D 값 노이즈 | [determinism](guidelines/determinism.md) |
| `src/stroke.js` | 획 → 리본 지오메트리. 떨림, 필압, 스크리블, 스크리블 채움, 해칭 | [drawing](guidelines/drawing.md) |
| **`src/character/`** | 시드가 결정하는 정적인 것. `vocabulary/`(슬롯·종족·아키타입·팔레트) `spec.js`(시드→스펙) `draw/`(스펙→획) | [character/](guidelines/character/) |
| **`src/motion/`** | 시계가 결정하는 동적인 것. `table.js`(종족 파라미터) `rhythm.js`(상시) `events.js`(간헐) `states.js`(유지) `index.js`(rng 순서 고정 조립) | [motion/](guidelines/motion/) |
| `src/scene/` | three.js. `rig.js`(지오메트리 → 계층) `animate.js`(상태 → 리그) `paper.js` `material.js` `emote.js` `index.js`(씬·루프·재생성) | [rig](guidelines/rig.md) |
| `src/main.js` | 진입점. UI 배선 | |
| `guidelines/` | 두 축의 카탈로그와 규칙. **고치기 전에 읽는다** | [README](guidelines/README.md) |
| `reference/` | 무엇을 보고 만들었고 무엇을 가져오고 안 가져왔는지 | [README](reference/README.md) |
| `scripts/` | 아래 § 스크립트 | |

## 스크립트

```bash
node scripts/census.mjs                # 종족 × 슬롯 분포표 + 정체성 위반. 파츠·가중치를 고쳤으면 본다
node scripts/census.mjs --slot hair    # 한 슬롯만
node scripts/census.mjs --check        # 위반만 (exit 1)

node scripts/snapshot.mjs before       # 리팩토링 전 — 스펙·지오메트리·60초 모션 궤적을 찍는다
node scripts/snapshot.mjs after        # 리팩토링 후 — diff 0이면 동작 불변
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

17슬롯 101파츠. 슬롯은 형태만 담고, 자세·동작은 모션이다.

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
- 같은 그림을 지터 위상만 다르게 3벌 굽고 8~10fps로 순환한다(보일)

## 알아둘 것

- **색공간** — three.js는 정점 색을 선형 공간으로 본다. sRGB 헥스를 그대로 넣으면 어두운
  잉크가 중간 회색으로 밝아진다. `stroke.js`의 `srgbToLinear`가 이걸 보정한다
- **모듈 캐시** — `serve.mjs`는 상대 경로 import에 `?v=` 를 붙인다. `Cache-Control: no-store`만으로는
  브라우저의 ES module map이 비워지지 않아 파일을 고쳐도 이전 코드가 실행되는 일이 있다
- **시드 재현** — 같은 시드는 같은 판이다. rng 호출 순서가 곧 시드라 슬롯 추가·순서 변경은
  기존 시드를 깬다. 깨는 변경은 커밋에 "시드 재배열"이라고 적는다
