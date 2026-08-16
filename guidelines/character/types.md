# 캐릭터 유형

> 기준: `src/character/spec.js`, `src/character/vocabulary/`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

한 개체는 **종족 × 아키타입 × 비율 지터**로 정해진다. 종족이 골격이고, 아키타입이 성향이고,
지터가 실루엣이다. 세 층이 겹쳐야 서른 마리가 서로 달라 보인다.

## 층위

| 층 | 결정 단위 | 결정 시점 | 역할 |
| --- | --- | --- | --- |
| **종족** | 줄(row) | 고정 레인 (`LANE_TABLE`) | 골격 — 두발/네발, 색, 전용 파츠, 지배 모션 |
| **아키타입** | 개체 | `makeCreature` 첫 추첨 | 성향 — 파츠 가중치 편향 |
| **비율 지터** | 개체 | `makeProportions` | 실루엣 — 머리 크기·비대칭·손떨림 |
| **치수 슬롯** | 개체 | `LATE_SLOTS` (맨 끝) | 형태와 독립인 길이·체격 — armLength·legLength·build. 스케일이 아니라 기장·폭만 바뀐다 |

파츠 선택 우선순위: **종족 bias > 아키타입 bias > DEFAULT_BIAS > 균등**. 종족 `forbid`는 뽑힌 뒤 결정적으로 덮어쓴다.

## 종족 (SPECIES)

`src/character/vocabulary/species.js`. 종족은 **고정 레인**이다 — 위에서부터 사람·사람·고양이·개·도깨비
(레퍼런스 영상 순서). `spec.js` `LANE_TABLE`이 행 수별 순서를 명시한다:

| 행 | 레인 |
| --- | --- |
| 4 | human · cat · pup · imp |
| 5 | human · human · cat · pup · imp |
| 6 | human · human · cat · pup · pup · imp |
| 8 | human · human · human · cat · cat · pup · imp · imp |

표에 없는 행 수는 5줄 기준을 비율대로 늘인다. `SPECIES`의 `weight`는 레인 표에서는 쓰이지 않는다
(랜덤 레인으로 되돌릴 때를 위해 남겨 둔다).

| 종족 | 가중치 | 골격 | 색 | 전용/편향 파츠 | 지배 모션 |
| --- | --- | --- | --- | --- | --- |
| **human** | 5 | 두발 | 팔레트 그대로 | forbid: 뿔 전부→none, cyclops→wide, 긴 팔(long)→medium. 나머지는 아키타입이 결정 | 좌우·앞뒤 락킹, 팔 행위(인사·팔짱·생각…) |
| **pup** | 2 | 네발 | 머리(털)색, 몸은 같거나 비슷한 톤 | 늘어진 귀(flap/long), 주둥이+검은 코(코 슬롯이 형태 결정), 꼬리 flag/stubtail, 얼룩, 다리 stub 위주(stick·float·boots) | 머리 롤 상시·킁킁 딥, ^^ 행복 눈 유지, 꼬리 플릭 |
| **cat** | 2 | 네발 | 머리(털)색, 몸은 같거나 비슷한 톤 | 정수리 세모귀(pointy/fold), 수염, ω 입, 세로동공(slit), 꼬리 curl/longtail, 다리 stub·stick(float·boots) | 꼬리 스위시 상시, 윙크, 갸웃 크게, 기지개 |
| **imp** | 2 | 두발 | 머리 DARKS 9색(먹·회갈·회청·자흑·녹흑…) 중 하나, 몸은 머리색 50% / 밝은 톤 30% / 어두운 톤 20% (같은 계열), 얼굴은 종이색, 잉크는 #1c1917 | 긴 뿔(1.8배: curved/straight/antenna/ram/crown), 외눈(cyclops), 지그재그 입, 스텁 팔, **바닥을 쓰는 긴 팔(long)은 도깨비만** (bias 3:2, 40%) | 젤리 워블 상시, 부르르·놀람 잦게, 만세·파닥임 잦게, "..." 중얼 |

네발 골격은 몸이 가로로 눕고 머리가 몸 앞(왼쪽)에 얹힌다. 키가 낮아 사람 줄과 나란히 서면
레퍼런스처럼 층이 낮아진다. 팔이 없고 다리 4개(앞쌍·뒷쌍) + 꼬리다. 치수 슬롯도 따른다 — `legLength`(short = 닥스훈트),
`build`(네발에서는 몸 길이·두께: wide = 긴 몸, skinny = 얇은 몸, small = 작은 몸).

## 아키타입 (ARCHETYPES)

`src/character/vocabulary/archetypes.js`. 성향이지 캐릭터가 아니다 — bias에 넣는 슬롯은
그 성향을 규정하는 것만. 그리드에서는 좌·상 이웃과 겹치면 최대 8회 다시 뽑는다.

| 아키타입 | 가중치 | 성향 | 편향 슬롯 |
| --- | --- | --- | --- |
| **beast** | 3 | 뿔·귀·이빨 | horns(curved/straight), ears(pointy/flap), mouth(teeth), nose(wedge/hook), hair(spikes/mop), head(round/wide) |
| **scholar** | 2 | 안경·단발·베레 | eyewear(glasses/monocle), eyes(dot/half/sleepy), hair(bob/wisp/curly/sweep), headgear(beret), mouth(line), nose(long/hook), horns(none) |
| **trooper** | 3 | 헬멧·안대·줄무늬·부츠 | headgear(helmet/cap/band/pot), eyewear(patch/goggles), head(square/block), hair(scribble/spikes), marks(stripes/patch/hatch), arms(sleeve/stick), legs(boots) |
| **sprite** | 3 | 더듬이·왕눈·긴 팔다리 | horns(antenna), eyes(wide/ring/spiral), head(tall/egg), body(tube), build(narrow/skinny), legs(stick/tiptoe), arms(stick/mitten), hair(none/wisp/tuft/pigtails), nose(none/dot) |
| **blob** | 2 | 넓적·대머리·뭉툭한 팔다리 | head(wide/round/pear), hair(none/tuft/mop), eyes(dot/ring/half), body(bean/dress), build(wide), legs(stub), arms(stubby), horns(none/nub) |
| **wanderer** | 2 | 밴드·졸린 눈·해칭 | headgear(band/pot/cap), eyes(half/sleepy/cross), marks(hatch/stripes/patch), mouth(wave/line), body(dress/bean) |

## 비율 지터 (proportions)

`src/character/spec.js` `makeProportions`. `rng.around(mean, spread)`는 평균 근처로 몰리되 범위를
안 벗어난다. 실루엣 다양성의 대부분이 여기서 나온다.

| 값 | 평균 (spread) | 뜻 |
| --- | --- | --- |
| headScale | 1.04 (0.34) — blob 1.14, sprite 0.96 | 머리 크기. 이웃 간 대비가 커야 판이 산다 |
| headWide | 1 (0.18) — blob 1.16 | 머리 가로 비 |
| headLumps / headLump | 4~7 / 0.07 (0.045) | 윤곽을 찌그러뜨리는 혹의 수·크기 |
| eyeSize | 0.17 (0.07) — sprite 0.24 | |
| eyeGap / eyeHeight | 0.42 (0.12) / 0.03 (0.09) | |
| eyeSizeSkew / eyeHeightSkew | 0 (0.22) / 0 (0.05) | **좌우 비대칭**. 손그림처럼 보이는 가장 값싼 장치 |
| noseDrop / mouthDrop | 0.1 (0.06) / 0.3 (0.07) | 머리 중심 대비 코·입 높이 |
| bodyScale / bodyWide | 0.52 (0.12) / 1 (0.2) | 몸 높이·폭. 둘 다에 `build` 슬롯 배율(폭 0.5~1.4, 높이 0.7~1.15)이 곱해진다 |
| legLength / armSpread | 0.3 (0.12) / 1 (0.25) | 다리 기장(×0.55, `legLength` short면 ×0.3 더) · 팔 길이(×0.242, `armLength` long이면 ×1.64 더) |
| bodyLen / tailLift | 1 (0.2) / 0 (1) | 네발용. 두발도 뽑는다 (rng 호출 수 고정) |
| wobble | 1 (0.55) | 개체별 손떨림 배율. 반듯한 놈과 엉망인 놈이 섞여야 한다 |
| wobbleSeed | 0~100000 | 그리기용 rng 시드. 생성 rng와 분리 |

## 팔레트

| | 값 | 규칙 |
| --- | --- | --- |
| skin | FILLS 7색 중 1 | 살구·회백·탄·분홍·청회·모래·갈회. 머리(털·피부)색 |
| cloth | 사람: FILLS 중 skin과 다른 1 | 옷은 피부와 달라야 몸이 읽힌다 |
| | 개·고양이: 머리색 그대로 50% / 조금 어두운 톤(×0.9) 30% / 조금 밝은 톤(×1.06) 20% | 털이라 몸이 머리와 같거나 비슷해야 한 몸으로 읽힌다 |
| | 도깨비: 머리색 그대로 50% / 밝은 톤(×1.35) 30% / 어두운 톤(×0.75) 20% | 덩어리라 같음. 색 포인트가 머리에 붙은 뒤 정하므로 몸이 따라간다 |
| ink | INKS 4색 중 1 | 전부 어두운 갈흑. imp는 #1c1917 고정(머리보다 더 어둡게) |
| **DARKS** | 9색 | imp 머리 전용 어두운 팔레트. 먹 · 갈흑 · 회갈 · 밝은 회갈 · 회청 · 청회 · 회 · 자흑 · 녹흑. 몸은 여기서 톤만 바꾼다(`shade`) |
| accent | ACCENTS 4색 중 1 | 모자·밴드 색 |
| fillOffset | ±0.035 | 채색이 선 밖으로 어긋난다 (인쇄 어긋남) |
| **pop** | POPS 5색, 14% 확률, 대상 hair/headgear/skin | 채도 있는 색 포인트. **한 판에 3개 상한** (`makeGrid`가 초과분을 끈다) |

## 정체성 (identity)

`species.js` `identity`. census가 검사하는 종족 불변식.

| 종족 | skeleton | horns | eyes | arms | tail | 기타 |
| --- | --- | --- | --- | --- | --- | --- |
| human | biped | none | not cyclops | ● | ✗ | armLength medium만 |
| pup | quad | none | not cyclops | ✗ | ● | hair none (털이지 머리카락이 아니다) |
| cat | quad | none | not cyclops | ✗ | ● | hair none |
| imp | biped | (자유) | (자유) | ● | ✗ | 머리 어두움(휘도<90) |

## 제약 (applyConstraints)

같이 나오면 그림이 깨지는 조합. **다시 뽑지 않고 결정적으로 덮어쓴다.** 순서대로:

1. **종족 forbid** (species.js) — 맨 먼저. human 뿔→none·cyclops→wide·long 팔→medium, pup 뿔·머리카락→none·cyclops→dot, cat 뿔·머리카락→none·cyclops→slit
2. 헬멧·항아리 → 머리카락 없음. 모자·밴드 → 짧은 머리만
3. 모히칸 → 모자 없음. 왕관 뿔 → 모자 없음, 머리카락 none/tuft만
4. 더듬이 → 75% 확률로 귀 없음
5. 안대 → 어느 쪽인지 여기서 정함 (patchSide ±1, 없으면 99 — 외눈의 side 0과 충돌 방지)
6. 감은 눈 + 화난 눈썹 → 눈썹 flat
7. 외눈 → 안경류 없음
8. 안경·고글 → 60% 확률로 눈썹 없음
9. 몸 색 (`makeCreature`): imp 머리 DARKS 중 1, 몸은 머리색/밝은 톤/어두운 톤 (50/30/20). 개·고양이 몸은 머리색/어두운 톤/밝은 톤 (50/30/20). 색 포인트 뒤에 정한다
10. 치수 슬롯(`LATE_SLOTS`)을 뽑은 뒤 종족 forbid를 **한 번 더** — 그 슬롯에도 제한이 걸리게
