# 리그 구조

> 기준: `src/scene/rig.js`, `src/scene/animate.js`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

`src/scene/rig.js` `buildCreature`가 조립하고 `src/scene/animate.js` `applyState`가 매 프레임 상태를 입힌다. 개체 하나가 어떤 three.js 계층으로 조립되는지.

## 계층

```
group                        ← 원점 = 발바닥. 스웨이·부르르·점프·호흡·젤리
├── bodyGroup
│   ├── bodyFrame ×3         ← 보일 변형. 채색(1) + 잉크(1.5)
│   ├── tailGroup            ← 꼬리 뿌리에 피벗 (네발)
│   └── limb pivot ×N        ← 어깨·엉덩이 피벗
│       ├── front             ← 위팔 (또는 다리). renderOrder 2.5
│       │   └── elbow         ← 팔꿈치 피벗 + 아래팔 (팔만). 어깨각·팔꿈치각 따로
│       └── back              ← 뒷짐 (팔만, 0.5)
└── headGroup                ← 원점 = 목(neckY = bodyTop). 갸웃·롤·끄덕·딥. 윤곽만 여기 직접
    ├── headFrame ×3         ← 보일 변형. 머리 윤곽 채색(1.8, 불투명) + 잉크(2)
    ├── earGroup             ← 귀. 얼굴 돌림 때 이목구비 이동량의 [−0.4, −0.15]배 — **반대 방향**으로 밀린다(크기 그대로)
    │   ├── crownBackFrame ×3    ← 옆귀(사람·도깨비). 머리 채색 뒤 (채색 1.6 + 잉크 1.7) — 뿌리가 머리에 가린다
    │   └── frontFrame ×3        ← 개 귀·고양이 귀. 머리 잉크 위 (채색 2.1 + 잉크 2.12) — 윤곽·머리카락 밑동을 덮되 눈은 못 덮는다
    ├── crownGroup           ← 뿔·머리카락·모자. 얼굴 돌림 때 [0.45, 0.3]배 — 같은 방향으로 덜 밀린다(크기 그대로)
    │   ├── crownFrame ×3        ← 뿔·머리카락. 머리 잉크 위 (채색 2.05 + 잉크 2.06)
    │   └── hatFrame ×3          ← 모자. 귀 위·얼굴 아래 (채색 2.14 + 잉크 2.16) — 귀 밑동·머리카락을 덮는다
    └── faceGroup            ← 원점 = 머리 중심(headCy). 얼굴 돌림으로 x/y 이동 + 눌림. 이목구비 전부
        ├── faceFrame ×3         ← 보일 변형. 볼·수염 채색(2.3) + 잉크(2.4)
        ├── staticEyesFrame ×3   ← 보일 변형. 정지 눈(dot·half·slit…)만 따로 (2.3/2.4) — 놀람 변형(☆·♥) 때 끈다
        ├── faceFrontFrame ×3    ← 보일 변형. 코·주둥이·안경 채색(6.4) + 잉크(6.5) — 눈 리그 위
        ├── eyeFx ×(눈 수)      ← 놀람 변형: ☆·♥ 글리프(6.32). 덮개는 없다 — 그동안 정지 눈 프레임과 눈 리그를 **끄고** 이걸로 대체한다. state.eyeFx일 때만
        ├── faceStates.brow ×2   ← 쉼/대체
        ├── faceStates.mouth ×2
        ├── staticLid ×(정지 눈 수) ← 정지 눈(dot·cross·slit…) 덮개: 살색 덮개(3.5) + 감은 눈 선·미소 아치(3.6). 잠(sleep > 0.5)이면 감은 선, ^^·윙크(그쪽)면 미소 아치 — 살아 있는 눈의 lid/shut/smile과 같은 규칙
        └── eyeRig ×(0~2)        ← 살아 있는 눈만
            ├── white(3) · rim(4) · pupil(5) · lid(5) · smile(6) · shut(6 — 감은 눈 선, 눈꺼풀 > 0.85일 때: 깜빡임 꼭대기·잠)
emojiRoot (씬 루트, group 옆)  ← 이모지. 머리에 붙이지 않고 머리 위 지점(세계 좌표)을 이징(0.1)으로 따라간다 —
                                  갸웃·점프 때 한 박자 늦게 끌려오고 끌리는 쪽으로 눕는다. 이모지 중에만 메시가 있다
```

괄호 숫자는 renderOrder. `depthTest: false`라 이 숫자가 곧 앞뒤다. **이 표가 단일 소스다** — 새 메시를 넣을 때 여기를 갱신한다.

| renderOrder | 무엇 |
| --- | --- |
| 0 | 종이 |
| 0.5 | 뒷짐 팔 (몸 뒤) |
| 1 | 몸 채색, 바닥선 |
| 1.5 | 몸 잉크 |
| 1.6 / 1.7 | 옆귀 채색 / 잉크 (사람·도깨비) — 머리 채색 뒤라 뿌리가 머리에 가린다 (crownGroup) |
| 1.8 | 머리 채색 — **몸 잉크 위, 불투명**. 머리가 몸통을 덮는 자리에 몸통 윤곽선이 비치지 않게 |
| 2 | 머리 잉크 (윤곽), 꼬리 |
| 2.05 / 2.06 | 뿔·머리카락 채색 / 잉크 — 윤곽 위 (crownGroup) |
| 2.1 / 2.12 | 개 귀·고양이 귀 채색 / 잉크 — 불투명 (윤곽·머리카락 밑동을 덮는다 — 귀가 실루엣의 혹으로 붙는다) (earGroup) |
| 2.14 / 2.16 | 모자 채색 / 잉크 — 귀 위, 얼굴 아래 (crownGroup) |
| 2.3 | 얼굴 채색 (정지 눈 채움·볼) — 모자 위 (눈이 모자에 가리지 않는다) |
| 2.4 | 얼굴 잉크 (정지 눈·수염) |
| 2.5 | 팔다리 위팔·아래팔 (몸 잉크 위 — 소매가 윤곽을 덮는다) |
| 3 | 눈 흰자 |
| 3.5 / 3.6 | 정지 눈 덮개 (살색) / 그 위 감은 눈 선·미소 아치 |
| 4 | 눈 윤곽 |
| 5 | 동공, 눈꺼풀 |
| 6 | 눈 ^^ 아치 · 감은 눈 선 |
| 6.32 | 놀람 변형 ☆·♥ 글리프 — 그동안 눈(정지 프레임·리그)은 꺼진다. 코·안경 아래 |
| 6.4 | 얼굴 맨 앞 채색 (주둥이) |
| 6.5 | 얼굴 맨 앞 잉크 (코·안경) — 눈꺼풀·눈 덮개가 코·안경테를 덮지 못하게 |
| 6.6 | 눈썹·입 — 눈 리그 위 (감긴 눈꺼풀이 눈썹을, 커진 외눈 흰자가 입을 안 지운다) |
| 7 | 이모지 (♥ ! ? …) |

## 원점 규칙

- **group** — 발바닥. scale로 호흡하면 발이 바닥에 붙은 채 늘어난다
- **headGroup** — 목. 머리 지오메트리를 `-neckY`만큼 미리 내려서 굽는다. rotation.z가 턱 언저리를 축으로 돈다
- **faceGroup** — 머리 중심(headCy). 얼굴 지오메트리(얼굴 프레임·눈썹·입·눈 리그)를 `-faceCy`만큼 내려서 굽고 그룹을 `faceCy - neckY`에 둔다. 돌림의 이동·눌림이 이 점을 축으로 한다
- **crownGroup / earGroup** — headGroup과 같은 원점(목). 얼굴 돌림 때 position만 — 뿔·머리카락·모자는 x 0.45배 · y 0.3배 같은 방향, 귀는 x −0.4배 · y −0.15배 반대 방향. scale은 건드리지 않는다 — 부속물은 자리만 옮기지 크기가 변하지 않는다
- **limb pivot** — 어깨(bodyTop 아래 22%, 몸통 좌우 윤곽 위 — 형태별 반폭 box 0.98 · bean 0.85 · dress 0.76 · tube 0.63) / 엉덩이(밑단 위 0.02) / 네발 뿌리(bodyH 25% 위). 지체는 피벗 원점에서 늘어진 상태로 굽는다. 팔은 `bindArm(side)`(T포즈)로 세우고 clock의 `state.arms`가 관절각을 준다
- **elbow** — 위팔 끝. 아래팔은 팔꿈치 원점에서 늘어진 상태로 굽는다. 위팔:아래팔 = 0.48:0.52. 같은 치수를 `armRig(spec)`이 clock에 넘겨 행위를 IK로 푼다
- **tailGroup** — 꼬리 뿌리(몸 뒤끝)
- **eyeRig** — 눈 중심. pupil.scale이 놀람(1 → 0.5), pupil.position이 시선, lid.scale.y가 눈꺼풀. 리그 자체는 안 커진다

## 무엇을 굽고 무엇을 변형하나

| 한 번 굽는 것 (개체당) | 매 프레임 바꾸는 것 |
| --- | --- |
| 몸·머리·머리 앞·얼굴 보일 3벌 | visible 토글 |
| 팔다리 지체 (front, back) | pivot.rotation.z, elbow.rotation.z (이징된 목표각 + 이징 없는 진동), front/back visible |
| 꼬리 | rotation.z |
| 눈썹·입 쉼/대체 | visible |
| 눈 리그 6메시 | pupil.scale(놀람 — 동공 1 → 0.5배), pupil.position(시선), lid.scale.y, visible (smile ^^ / shut 감은 눈 선) |
| — | group·headGroup·crownGroup·earGroup·faceGroup의 position/rotation/scale — group.position.x에는 걷기로 옮긴 자리(walkX), group.scale.x에는 네발이 걷는 방향(facing ±1)이 들어간다 |

**매 프레임 지오메트리를 다시 만들지 않는다.** 예외는 이모지(트리거당 1회)와 재생성(개체 교체)뿐이다.

## 지터 위상 (variant)

`drawCreature(spec, variant)`는 `wobbleSeed ^ (variant × 0x9e3779b9)`로 rng를 판다.
변형 3벌은 구도가 같고 떨림만 다르다. 눈썹·입·팔다리·꼬리는 변형이 없다(정적 지터로 충분).

## 포즈와 잉크 — 두 축

`applyState(item, state, t, noise, { snap, boil })`.

| 축 | 토글 | 값 | 뜻 |
| --- | --- | --- | --- |
| **포즈** (리그) | POSE MOTION/BIND, `B` | `scene.setBind` | BIND면 clock 대신 `BIND_STATE`(두발 T포즈, 네발 다리 수직·꼬리 그린 그대로), 관절 이징 즉시(snap). 시계는 계속 흘린다 |
| **잉크** (선) | INK BOIL/STILL, `I` | `scene.setBoil` | STILL이면 보일 0번 프레임 고정 |
| 행위 강제 (디버그) | ACTION 카드 | `scene.setAction` | 두발 전원이 그 행위를 계속. IDLE은 행위 없음. `clock.force`. AUTO면 예약대로 |

바인드 포즈는 리그의 상태이고 보일은 손그림 재질이다. 다른 축이라 따로 켠다 —
"바인드인데 선은 끓는" 상태도, "모션 중인데 선은 고정" 상태도 볼 수 있다.

## 태어날 때

`buildCreature`는 팔을 바인드(T)로 세운다. scene의 `settle`이 곧바로 시계의 현재 상태를 이징 없이(snap)
입혀 idle에 앉힌다 — 안 그러면 첫 프레임에 T에서 idle로 팔이 휘돌며 내려오는 게 보인다.

## 재생성 시

`regenerate(index)`가 기존 그룹을 dispose하고 새 개체를 같은 슬롯에 세운다.
새 시계는 `clockNow`를 출생 시각으로 받는다. 종족은 유지된다. `settle`도 같이 한다.

## 자주 깨지는 지점

- 머리 지오메트리를 `-neckY` 안 내리고 headGroup.position.y만 올리면 **두 번 올라간다**. 얼굴도 같다 — 얼굴 메시는 `-faceCy`, faceGroup은 `faceCy - neckY`. `-neckY`로 내리면 돌림 축이 목으로 내려가 눌림이 어긋난다
- 팔 front/back을 회전 중에 바꾸면 튄다 → 기준각 0.35rad 이내에서만
- 시계 위상 지터를 `t`에 그대로 붙이면 재생성 후 튄다 → 출생 상대 시간
- 뒷면 컬링을 켜두면 시계방향 경로의 채색이 사라진다 → `DoubleSide`
- 정점 색을 sRGB로 넣으면 회색이 된다 → `srgbToLinear`
