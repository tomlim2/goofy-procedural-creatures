# 모션 카탈로그

> 기준: `src/motion/`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

`src/motion/`. `table.js`가 종족별 파라미터, `rhythm.js`(상시 진동) `events.js`(간헐) `states.js`(유지)가
모션 본체, `actions.js`가 행위 카탈로그(만세·인사·팔짱…의 내용), `index.js`가 고정 rng 순서로 조립한다.
규칙은 [rules.md](rules.md).
개체마다 시계가 하나씩 있고, 모든 예약은 **출생 시각 기준 상대 시간**이다.
매 프레임 `update(t)`가 상태 객체를 돌려주고 `scene/animate.js`가 그것을 리그에 적용한다.

**원칙** (레퍼런스 실측, video-notes 26~36):
- 움직임은 이징으로 **매끄럽게**, 선(보일)만 8~10fps로 끓는다
- 몸통에는 뼈대 리그가 없다. 생동감은 얼굴 리그 + 보일 + 몸에 종속된 미세 움직임이다
- 팔다리는 관절 지터 + 몸 따라가기가 기본. 큰 관절 이벤트는 **드물고 작게**
- 종족마다 지배 모션이 다르다 (`MOTION` 테이블)

## 종류별 위치

| 종류 | 파일 | 모션 |
| --- | --- | --- |
| 리듬 | `rhythm.js` | 호흡 · 스웨이 · 락킹 · 머리 롤 · 젤리 · 꼬리 스위시 · 시선 이징 · 얼굴 요 · 팔 진자 · 관절 지터 |
| 이벤트 | `events.js` | 깜빡임 · 시선 다트 · 놀람 · 끄덕 · 킁킁 딥 · 폴짝 · 기지개 · 부르르 · 발 까딱 · 제자리 스텝 · 꼬리 플릭 · 이모트 · 재생성 |
| 상태 | `states.js` | 반감김 · ^^ 행복 눈 · 윙크 · 갸웃 · 눈썹 상태 · 입 상태 · 팔 행위(언제 어떤 행위를) |
| 행위 | `actions.js` | 팔 행위의 **내용** — 두 팔의 손 목표·팔꿈치 방향·진동, 유지 시간, 동반 이모트. IK로 관절각을 푼다 |

## 상태 객체

`clock.update(t)`가 돌려주는 값과 scene의 적용처.

| 상태 | 타입 | 적용 |
| --- | --- | --- |
| breathe | −1~1 | group.scale (x 0.006, y 0.011) |
| sway | rad | group.rotation.z — 발 축 좌우 기울기 |
| rock | 배율 | group.scale.y — 앞뒤 락킹 착시 |
| hopY | 단위 | group.position.y |
| squashX / squashY | 배율 | group.scale — 폴짝 스쿼시&스트레치 |
| stretchX | 배율 | group.scale.x — 기지개 |
| jellyX / jellyY | 배율 | group.scale 역위상 — 젤리 워블 |
| shiverX | 단위 | group.position.x — 부르르 |
| headAngle | rad | headGroup.rotation.z (갸웃 + 롤) |
| headBob | 단위 | headGroup.position.y (끄덕 + 딥) |
| faceYaw | −1~1 | faceGroup.position.x — 이목구비 밀림 |
| gaze | [x, y] | pupil.position |
| lid | 0~1 | lid.scale.y |
| aperture | 배율 | eyeRig.scale — 놀람 |
| happy | bool | 눈 닫고 ^^ 아치 |
| winkSide | −1/0/1 | 한쪽만 lid 1 |
| browAlt / mouthAlt | bool | 눈썹·입 상태 벌 토글 |
| arms | {−1, 1} → {shoulder, elbow, behind, oscShoulder, oscElbow} | 팔 관절 세계각(rotation.z). 행위를 IK로 푼 값 + 진자·폴짝·지터. osc는 이징 없이 얹는 진동(인사·파닥임) |
| armAction / armSide | 행위 이름 또는 null / 활동 팔 | 디버그·통계용. scene은 arms만 본다 |
| legOffset | [4] rad | 다리 피벗 회전 |
| tailAngle | rad | tailGroup.rotation.z |
| emote | {kind, k} | 머리 위 글리프 |
| regen | bool | LIVE일 때 개체 교체 |

## 얼굴

| 모션 | 주기 / 지속 | 종족 차이 | 비고 |
| --- | --- | --- | --- |
| 깜빡임 | 1.8~6.5초, 0.13초 | 공통 | 22%는 연속 두 번. 22%는 ^^로 닫힘 |
| 시선 이동 | 1.4~5초 | 공통 | 목표까지 0.12 이징 |
| 얼굴 요 | 시선 추종 | yaw 배율 kid 0.5 / pup 0.7 / cat 0.8 / imp 0.6 | 이목구비 전체가 밀려 머리 돌린 착시 |
| 반감김 유지 | 8~20초, 1.2~2.8초 | 공통 | lid 0.5 |
| 놀람 (개방도) | 간격 표 참조, 1.1초 | kid 8~22 / pup 10~26 / cat 9~24 / **imp 4~12** | 눈 리그 1.65배 |
| ^^ 행복 유지 | 6~16초, 2~5초 | **pup만** | |
| 윙크 | 8~20초, 0.5~1.3초 | **cat만** | |
| 눈썹 전환 | 6~16초, 1.5~4초 | 공통 | ALT_BROW 표 |
| 입 전환 | 4~12초, 0.8~2.2초 | 공통 | ALT_MOUTH 표 |

## 몸통

| 모션 | 파라미터 | kid | pup | cat | imp |
| --- | --- | --- | --- | --- | --- |
| 호흡 | 주기 2.6~5.4초 | ● | ● | ● | ● |
| 스웨이 (좌우) | 진폭 rad, 주기 | 0.012~0.032, 2.6~4.6s | 0.004~0.01 | 0.002~0.007 | **0.015~0.04, 2~3.8s** |
| 락킹 (앞뒤) | scale.y 진폭 | 0.006 | 0.003 | 0.004 | 0.004 |
| 갸웃 | 간격, 진폭 | 7~18s, 0.1 | 9~20s, 0.08 | **5~12s, 0.14** | 8~18s, 0.09 |
| 끄덕 | 9~24초, 0.7초 | ● | ● | ● | ● |
| **머리 롤** | 진폭, 주기 | — | **0.07~0.14, 2.4~4.8s 상시** | — | — |
| **킁킁 딥** | 간격 | — | **4~10s** | — | — |
| 폴짝 | 간격 | 40~90s | 30~70s | — | 50~110s |
| **기지개** | 간격 | — | — | **10~26s** | — |
| 부르르 | 간격 | 26~60s | 40~80s | 40~90s | **12~30s** |
| **젤리 워블** | 진폭, 주파수 | — | — | — | **0.008~0.018, 1.1~1.9Hz 상시** |

## 팔다리

레퍼런스 실측(video-notes 33~36): 팔은 벌린 채 미세하게만 흔들리고, 다리는 바닥에 못 박혀 있다.
큰 이벤트는 4개체 × 4초 어디에도 없다. 그래서 상시 진폭은 보일 수준, 이벤트는 드물고 작다.

| 모션 | kid | imp | pup / cat |
| --- | --- | --- | --- |
| 팔 진자 (스웨이 반대 위상) | 0.045 | 0.06 | — |
| 팔 관절 지터 | 7.3Hz 0.012 + 11.7Hz 0.008 | 같음 | — |
| **팔 행위** (아래 표) | 12~36초마다 1.5~7초 | 10~30초마다 | — |
| 발 까딱 (0.09rad, 0.9초) | 12~30s | 14~34s | pup 14~32s / cat 16~36s |
| 제자리 스텝 (0.07rad, 대각선 번갈아, 2.4초) | — | — | pup 30~70s / cat 40~90s |
| 다리 관절 지터 | 6.1Hz 0.006 | 같음 | 같음 |
| 폴짝 시 | 팔 위로 (hopY×4), 다리 접힘 | 같음 | — |

### 바인드 포즈와 팔 행위

**T포즈는 자세가 아니라 바인드 포즈다** — 캐릭터가 아무 모션도 받지 않을 때의 상태. 어깨 수평(1.57 outward),
팔꿈치 0. 캐릭터에는 "자세"라는 개념이 없다. `character/draw/limbs.js` `BIND_ARM`, `motion/actions.js` `bindArm(side)`.
`motion/index.js` `BIND_STATE`가 바인드의 상태 객체(전부 0·기본·T포즈)이고, 화면의 POSE BIND가 이걸
리그에 넣어 정지 그림을 만든다.

**모션은 행위다.** 바인드에서 행위로 넘어갔다가 끝나면 바인드로 돌아온다. 언제 어떤 행위를 하는지는
`states.js` `stepArmAction`(종족별 목록·가중치는 `table.js` `armActions`, 간격은 `armActionGap`), 행위의
**내용**은 `actions.js` `ACTIONS`·`ARM_POSES`다.

**행위는 항상 두 팔을 다 정한다.** "팔을 흔든다"가 아니라 "팔을 흔들어 인사한다"다 — 한 팔은 들어 흔들고
다른 팔은 내린다. 한 팔만 움직이고 나머지가 T포즈에 남는 이벤트(옛 팔 들기·손 흔들기)는 없앴다.
비대칭 행위는 시작할 때 활동 팔의 좌우를 뽑는다(`armSide`).

| 행위 | 활동 팔 | 나머지 팔 | 유지(초) | 뜻 | kid | imp |
| --- | --- | --- | --- | --- | --- | --- |
| **wave** | wave — 손 위로, 팔꿈치 ±0.5rad 3Hz | hang | 1.5~3 | **손 흔들어 인사** | 2 | 1.5 |
| hi | hi — 한 손 곧게 위로 | hang | 2~4 | 저요 | 1 | 1 |
| point | point — 옆으로 곧게 (수평 +17°) | hang | 2~4 | 가리키기 | 1 | 1 |
| think | think — 손이 턱(앵커 chin) | hang | 3~6 | 생각 | 1.5 | 0.5 |
| salute | salute — 손이 눈썹 옆(앵커 brow) | hang | 2~4 | 경례 | 0.7 | 0.5 |
| raise | raise | raise | 2~4 | 만세 (V) | 1.5 | 2.5 |
| cross | cross — 손이 반대쪽 가슴(앵커 chestFar) | cross | 3~7 | 팔짱 | 2 | — |
| hips | hips — 손이 허리(앵커 hip), 팔꿈치 바깥 | hips | 3~7 | 허리에 손 | 2 | 1.5 |
| hang | hang — 곧게 아래, 바닥 위로 클램프 | hang | 3~7 | 쉬어 (늘어뜨림) | 1.5 | 1 |
| behind | behind — 몸 뒤 (back 스케치) | behind | 3~7 | 뒷짐 | 1.5 | 1 |
| flap | flap — 어깨 ±0.28·팔꿈치 ±0.12rad 5Hz | flap | 1.5~3 | 파닥임(좋아함) + ♥ | 1 | 2 |

네발(cat·pup)은 팔이 없어 항상 바인드. 발화는 kid 2.4회/분, imp 2.8회/분, 좌우 반반(60초×40개체 측정).

**팔 자세는 손 목표로 적는다 (IK).** 관절각 표가 아니다. `ARM_POSES[이름]`은 손 목표(`hand`) — reach 배수
`[x 바깥, y 위]`거나 리그 앵커 이름 — 와 팔꿈치가 튀어나오는 쪽(`bend` out/down)을 적고,
`solveArm(rig, side, pose)`가 두 마디 IK(코사인 법칙)로 [어깨, 팔꿈치] 세계각을 푼다.
그래서 팔 길이(medium/long)·몸 크기가 달라도 "허리에 손"은 허리에, "턱에 손"은 턱에 간다.
못 닿으면 그쪽으로 곧게 뻗고(짧은 팔의 경례), `floor`가 켜진 자세는 손이 바닥 아래로 못 간다
(긴 팔의 쉬어 — 팔꿈치가 바깥으로 접힌다). 어깨각은 (−135°, 225°]로 감아 리그의 이징이 먼 길로 돌지 않게 한다.

리그 서술은 캐릭터가 준다: `character/draw/limbs.js` `armRig(spec)` → `{ x, y, upper, lower, anchors }`
(어깨 위치, 위팔·아래팔 길이, 앵커 ground·hip·chestFar·chin·brow — 몸 좌표, 오른팔 기준). scene이
`makeClock(seed, birth, species, armRig(spec))`로 넘긴다. 전부 스펙에서 나오는 정적 치수다.

행위 위에 얹는 것: 팔 진자(스웨이 역위상)·폴짝 시 팔 위로·관절 지터는 어깨각에, 그 절반이 팔꿈치에 더해진다.
인사·파닥임의 진동(`osc`)은 이징을 거치지 않고 리그 회전에 그대로 얹는다 — 이징을 거치면 3~5Hz가 뭉개진다.
행위에 들어가고 나갈 때 0.35초 봉투로 페이드해 끝나는 순간 팔이 튀지 않게 한다.
front/back(뒷짐) 전환은 어깨각이 목표 0.35rad 이내로 돌아온 뒤에만 한다.

**행위 하나만 보려면** 화면 ACTION 카드에서 고른다. 두발 전원이 그 행위를 계속한다(비대칭 행위의 활동 팔은
시드 홀짝으로 좌우 섞임). `clock.force(action, side)`, `scene.setAction(name)`. AUTO로 돌리면 예약대로.

## 꼬리 (네발)

| 모션 | pup | cat |
| --- | --- | --- |
| 상시 스위시 | — | **진폭 0.16~0.3, 주기 2.4~5초** |
| 플릭 (0.35rad 감쇠, 0.5초) | 3~9s | 4~11s |

## 이모트

머리 위 2.2초. 페이드 인·아웃, 3Hz 까딱거림. 간격 14~40초.

| 종족 | 종류 (가중) |
| --- | --- |
| kid / pup | heart, bang(!), quest(?) |
| cat | heart, quest, bang |
| imp | **dots(...) ×2**, bang, quest, heart |

## 재생성

슬롯당 6~14초. **기본 꺼짐(STILL)** — 형태는 NEW SEED로만 바뀐다. LIVE를 켜면 개체가
각자의 시계로 교체되고 종족은 슬롯에 남는다. 새 개체의 시계는 그 시각을 출생 시각으로 받는다
(안 그러면 예약이 전부 과거가 되어 매 프레임 재생성되는 폭주가 난다).

## 보일은 모션이 아니다

선이 끓는 것(보일)은 손그림 **재질**이지 캐릭터의 행위가 아니다. 바인드 포즈에서도 선은 끓는다.
[../drawing.md](../drawing.md) § 보일. 화면의 INK BOIL/STILL이 이 축이고, POSE MOTION/BIND와 별개다.

## 새 모션을 넣을 때

1. `motion/table.js`에 종족별 파라미터를 넣는다. 없는 종족은 `null`
2. 종류를 정한다 — 리듬(`rhythm.js`) / 이벤트(`events.js`) / 상태(`states.js`) — 그 파일에 `initXxx`·`stepXxx` 추가 → `motion/index.js`에서 **기존 순서 뒤에** 호출 (앞에 끼우면 시드가 깨진다)
3. `scene/animate.js` `applyState`에서 리그에 적용
4. 60초 시뮬로 발화 빈도를 센다 (아래 명령). 눈으로만 판단하지 않는다

**새 팔 행위**는 더 짧다: `actions.js` `ARM_POSES`에 자세(손 목표·bend), `ACTIONS`에 행위(두 팔 자세·hold·label),
`table.js` `armActions`에 종족별 가중치. rng 순서는 안 바뀐다. 손 위치는 계산으로 확인한다 —
`solveArm` 결과를 FK로 되돌려 손이 앵커에 닿는지·바닥 위인지 본 뒤, 화면 ACTION 카드로 강제해 본다.

```bash
node --input-type=module -e "
Promise.all([import('./src/motion/index.js'), import('./src/character/index.js')]).then(([{makeClock}, {makeCreature, armRig}]) => {
  const c = makeClock(42, 0, 'kid', armRig(makeCreature(42, 'kid')));
  let n = 0;
  for (let f = 0; f < 3600; f++) { const s = c.update(f/60); if (s.YOUR_STATE) n++; }
  console.log(n, 'frames / 3600');
});"
```
