# 캐릭터 유형

한 개체는 **종족 × 아키타입 × 비율 지터**로 정해진다. 종족이 골격이고, 아키타입이 성향이고,
지터가 실루엣이다. 세 층이 겹쳐야 서른 마리가 서로 달라 보인다.

## 층위

| 층 | 결정 단위 | 결정 시점 | 역할 |
| --- | --- | --- | --- |
| **종족** | 줄(row) | `makeGrid`가 줄마다 뽑는다 | 골격 — 두발/네발, 색, 전용 파츠, 지배 모션 |
| **아키타입** | 개체 | `makeCreature` 첫 추첨 | 성향 — 파츠 가중치 편향 |
| **비율 지터** | 개체 | `makeProportions` | 실루엣 — 머리 크기·비대칭·손떨림 |

파츠 선택 우선순위: **종족 bias > 아키타입 bias > DEFAULT_BIAS > 균등**.

## 종족 (SPECIES)

`src/character/vocabulary/species.js`. 줄마다 뽑히고 바로 윗줄과 같으면 한 번 다시 뽑는다.
kid이 흔해서 두 줄 연속도 자연스럽다.

| 종족 | 가중치 | 골격 | 색 | 전용/편향 파츠 | 지배 모션 |
| --- | --- | --- | --- | --- | --- |
| **kid** | 5 | 두발 | 팔레트 그대로 | 편향 없음 (아키타입이 결정) | 좌우·앞뒤 락킹, 팔 자세 전환 |
| **pup** | 2 | 네발 | 팔레트 그대로 | 늘어진 귀(flap/long), 주둥이+검은 코(코 슬롯이 형태 결정), 꼬리 flag/stubtail, 얼룩 | 머리 롤 상시·킁킁 딥, ^^ 행복 눈 유지, 꼬리 플릭 |
| **cat** | 2 | 네발 | 팔레트 그대로 | 정수리 세모귀(pointy/fold), 수염, ω 입, 세로동공(slit), 꼬리 curl/longtail | 꼬리 스위시 상시, 윙크, 갸웃 크게, 기지개 |
| **imp** | 2 | 두발 | 머리 먹빛(skin=ink), 몸은 절반 먹빛·절반 밝은 줄무늬, 얼굴은 종이색 | 긴 뿔(1.8배: curved/straight/antenna/ram/crown), 외눈(cyclops), 지그재그 입, 스텁 팔, 짧은 팔 | 젤리 워블 상시, 부르르·놀람 잦게, "..." 중얼 |

네발 골격은 몸이 가로로 눕고 머리가 몸 위에 얹힌다. 키가 낮아 사람 줄과 나란히 서면
레퍼런스처럼 층이 낮아진다. 팔이 없고 다리 4개 + 꼬리다.

## 아키타입 (ARCHETYPES)

`src/character/vocabulary/archetypes.js`. 성향이지 캐릭터가 아니다 — bias에 넣는 슬롯은
그 성향을 규정하는 것만. 그리드에서는 좌·상 이웃과 겹치면 최대 8회 다시 뽑는다.

| 아키타입 | 가중치 | 성향 | 편향 슬롯 |
| --- | --- | --- | --- |
| **beast** | 3 | 뿔·귀·이빨 | horns(curved/straight), ears(pointy/flap), mouth(teeth), nose(wedge/hook), hair(spikes/mop), head(round/wide) |
| **scholar** | 2 | 안경·단발·베레 | eyewear(glasses/monocle), eyes(dot/half/sleepy), hair(bob/wisp/curly/sweep), headgear(beret), mouth(line), nose(long/hook), horns(none) |
| **trooper** | 3 | 헬멧·안대·줄무늬·부츠 | headgear(helmet/cap/band/pot), eyewear(patch/goggles), head(square/block), hair(scribble/spikes), marks(stripes/patch/hatch), arms(sleeve/stick), legs(boots) |
| **sprite** | 3 | 더듬이·왕눈·긴 팔다리 | horns(antenna), eyes(wide/ring/spiral), head(tall/egg), body(tube), legs(stick/tiptoe), arms(stick/mitten), armLength(long/verylong), hair(none/wisp/tuft/pigtails), nose(none/dot) |
| **blob** | 2 | 넓적·대머리·짧은 팔다리 | head(wide/round/pear), hair(none/tuft/mop), eyes(dot/ring/half), body(bean/dress), legs(stub/wide), arms(stubby), armLength(short), horns(none/nub) |
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
| bodyScale / bodyWide | 0.52 (0.12) / 1 (0.2) | |
| legLength / armSpread | 0.3 (0.12) / 1 (0.25) | |
| bodyLen / tailLift | 1 (0.2) / 0 (1) | 네발용. 두발도 뽑는다 (rng 호출 수 고정) |
| **armRest** | rest 5 : out 2 : behind 2 : up 0.5 | 팔의 쉼 자세. 형태와 별개인 **개체 성격** |
| wobble | 1 (0.55) | 개체별 손떨림 배율. 반듯한 놈과 엉망인 놈이 섞여야 한다 |
| wobbleSeed | 0~100000 | 그리기용 rng 시드. 생성 rng와 분리 |

## 팔레트

| | 값 | 규칙 |
| --- | --- | --- |
| skin | FILLS 7색 중 1 | 살구·회백·탄·분홍·청회·모래·갈회 |
| cloth | FILLS 중 skin과 다른 1 | 옷은 피부와 달라야 몸이 읽힌다 |
| ink | INKS 4색 중 1 | 전부 어두운 갈흑 |
| accent | ACCENTS 4색 중 1 | 모자·밴드 색 |
| fillOffset | ±0.035 | 채색이 선 밖으로 어긋난다 (인쇄 어긋남) |
| **pop** | POPS 5색, 14% 확률, 대상 hair/headgear/skin | 채도 있는 색 포인트. **한 판에 3개 상한** (`makeGrid`가 초과분을 끈다) |

## 제약 (applyConstraints)

같이 나오면 그림이 깨지는 조합. **다시 뽑지 않고 결정적으로 덮어쓴다.**

- 헬멧·항아리 → 머리카락 없음. 모자·밴드 → 짧은 머리만
- 모히칸 → 모자 없음. 왕관 뿔 → 모자 없음, 머리카락 none/tuft만
- 더듬이 → 75% 확률로 귀 없음
- 안대 → 어느 쪽인지 여기서 정함 (patchSide ±1, 없으면 99 — 외눈의 side 0과 충돌 방지)
- 감은 눈 + 화난 눈썹 → 눈썹 flat
- 외눈 → 안경류 없음
- 안경·고글 → 60% 확률로 눈썹 없음
- imp: 머리 먹빛, 몸 50% 먹빛
- 매우 긴 팔 → 쉼 자세 out (늘어뜨리면 바닥을 뚫는다)
