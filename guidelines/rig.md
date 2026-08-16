# 리그 구조

> 기준: `src/scene/rig.js`, `src/scene/animate.js`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

`src/scene/rig.js` `buildCreature`가 조립하고 `src/scene/animate.js` `applyState`가 매 프레임 상태를 입힌다. 개체 하나가 어떤 three.js 계층으로 조립되는지.

## 계층

```
group                        ← 원점 = 발바닥. 스웨이·부르르·폴짝·호흡·젤리
├── bodyGroup
│   ├── bodyFrame ×3         ← 보일 변형. 채색(1) + 잉크(1.5)
│   ├── tailGroup            ← 꼬리 뿌리에 피벗 (네발)
│   └── limb pivot ×N        ← 어깨·엉덩이 피벗
│       ├── front             ← 위팔 (또는 다리). renderOrder 2.5
│       │   └── elbow         ← 팔꿈치 피벗 + 아래팔 (팔만). 어깨각·팔꿈치각 따로
│       └── back              ← 뒷짐 (팔만, 0.5)
└── headGroup                ← 원점 = 목(neckY = bodyTop). 갸웃·롤·끄덕·딥. 윤곽·귀·뿔·머리카락·모자
    ├── headFrame ×3         ← 보일 변형. 채색(1.8, 불투명) + 잉크(2)
    ├── emoteMesh            ← 이벤트 시에만
    └── faceGroup            ← 원점 = 머리 중심(headCy). 얼굴 돌림으로 x/y 이동 + 눌림. 이목구비 전부
        ├── faceFrame ×3         ← 보일 변형. 눈·볼·코·수염·주둥이·안경 채색(2.1) + 잉크(2.2)
        ├── faceStates.brow ×2   ← 쉼/대체
        ├── faceStates.mouth ×2
        └── eyeRig ×(0~2)        ← 살아 있는 눈만
            ├── white(3) · rim(4) · pupil(5) · lid(5) · smile(6)
```

괄호 숫자는 renderOrder. `depthTest: false`라 이 숫자가 곧 앞뒤다. **이 표가 단일 소스다** — 새 메시를 넣을 때 여기를 갱신한다.

| renderOrder | 무엇 |
| --- | --- |
| 0 | 종이 |
| 0.5 | 뒷짐 팔 (몸 뒤) |
| 1 | 몸 채색, 바닥선 |
| 1.5 | 몸 잉크 |
| 1.8 | 머리 채색 — **몸 잉크 위, 불투명**. 머리가 몸통을 덮는 자리에 몸통 윤곽선이 비치지 않게 |
| 2 | 머리 잉크 (윤곽·귀·뿔·머리카락·모자), 꼬리 |
| 2.1 | 얼굴 채색 (주둥이·눈 채움·볼) — 머리 잉크 위 (주둥이가 윤곽을 덮는다) |
| 2.2 | 얼굴 잉크 (눈·코·수염·안경) |
| 2.5 | 팔다리 위팔·아래팔 (몸 잉크 위 — 소매가 윤곽을 덮는다) |
| 3 | 눈 흰자, 눈썹·입 |
| 4 | 눈 윤곽 |
| 5 | 동공, 눈꺼풀 |
| 6 | 눈 ^^ 아치 |
| 7 | 이모트 |

## 원점 규칙

- **group** — 발바닥. scale로 호흡하면 발이 바닥에 붙은 채 늘어난다
- **headGroup** — 목. 머리 지오메트리를 `-neckY`만큼 미리 내려서 굽는다. rotation.z가 턱 언저리를 축으로 돈다
- **faceGroup** — 머리 중심(headCy). 얼굴 지오메트리(얼굴 프레임·눈썹·입·눈 리그)를 `-faceCy`만큼 내려서 굽고 그룹을 `faceCy - neckY`에 둔다. 돌림의 이동·눌림이 이 점을 축으로 한다
- **limb pivot** — 어깨(bodyTop 아래 22%, 몸 폭 78%) / 엉덩이(밑단 위 0.02) / 네발 뿌리(bodyH 25% 위). 지체는 피벗 원점에서 늘어진 상태로 굽는다. 팔은 `bindArm(side)`(T포즈)로 세우고 clock의 `state.arms`가 관절각을 준다
- **elbow** — 위팔 끝. 아래팔은 팔꿈치 원점에서 늘어진 상태로 굽는다. 위팔:아래팔 = 0.48:0.52. 같은 치수를 `armRig(spec)`이 clock에 넘겨 행위를 IK로 푼다
- **tailGroup** — 꼬리 뿌리(몸 뒤끝)
- **eyeRig** — 눈 중심. scale이 개방도, pupil.position이 시선, lid.scale.y가 눈꺼풀

## 무엇을 굽고 무엇을 변형하나

| 한 번 굽는 것 (개체당) | 매 프레임 바꾸는 것 |
| --- | --- |
| 몸·머리·얼굴 보일 3벌 | visible 토글 |
| 팔다리 지체 (front, back) | pivot.rotation.z, elbow.rotation.z (이징된 목표각 + 이징 없는 진동), front/back visible |
| 꼬리 | rotation.z |
| 눈썹·입 쉼/대체 | visible |
| 눈 리그 5메시 | scale, position, visible |
| — | group·headGroup·faceGroup의 position/rotation/scale |

**매 프레임 지오메트리를 다시 만들지 않는다.** 예외는 이모트(이벤트당 1회)와 재생성(개체 교체)뿐이다.

## 지터 위상 (variant)

`drawCreature(spec, variant)`는 `wobbleSeed ^ (variant × 0x9e3779b9)`로 rng를 판다.
변형 3벌은 구도가 같고 떨림만 다르다. 눈썹·입·팔다리·꼬리는 변형이 없다(정적 지터로 충분).

## 포즈와 잉크 — 두 축

`applyState(item, state, t, noise, { snap, boil })`.

| 축 | 토글 | 값 | 뜻 |
| --- | --- | --- | --- |
| **포즈** (리그) | POSE MOTION/BIND, `B` | `scene.setBind` | BIND면 clock 대신 `BIND_STATE`, 관절 이징 즉시(snap). 시계는 계속 흘린다 |
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
