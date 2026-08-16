# 리그 구조

`src/scene/rig.js` `buildCreature`가 조립하고 `src/scene/animate.js` `applyState`가 매 프레임 상태를 입힌다. 개체 하나가 어떤 three.js 계층으로 조립되는지.

## 계층

```
group                        ← 원점 = 발바닥. 스웨이·부르르·폴짝·호흡·젤리
├── bodyGroup
│   ├── bodyFrame ×3         ← 보일 변형. 채색(1) + 잉크(2)
│   ├── tailGroup            ← 꼬리 뿌리에 피벗 (네발)
│   └── limb pivot ×N        ← 어깨·엉덩이 피벗. front(2.5) + back(0.5, 팔만)
└── headGroup                ← 원점 = 목(neckY = bodyTop). 갸웃·롤·끄덕·딥
    ├── headFrame ×3         ← 보일 변형. 채색(1) + 잉크(2)
    ├── emoteMesh            ← 이벤트 시에만
    └── faceGroup            ← 요(yaw)로 x 이동
        ├── faceStates.brow ×2   ← 쉼/대체
        ├── faceStates.mouth ×2
        └── eyeRig ×(0~2)        ← 살아 있는 눈만
            ├── white(3) · rim(4) · pupil(5) · lid(5) · smile(6)
```

괄호 숫자는 renderOrder. `depthTest: false`라 이 숫자가 곧 앞뒤다.

## 원점 규칙

- **group** — 발바닥. scale로 호흡하면 발이 바닥에 붙은 채 늘어난다
- **headGroup** — 목. 머리 지오메트리를 `-neckY`만큼 미리 내려서 굽는다. rotation.z가 턱 언저리를 축으로 돈다
- **limb pivot** — 어깨(bodyTop 아래 22%, 몸 폭 78%) / 엉덩이(밑단 위 0.02) / 네발 뿌리(bodyH 25% 위). 지체는 피벗 원점에서 늘어진 상태로 굽는다
- **tailGroup** — 꼬리 뿌리(몸 뒤끝)
- **eyeRig** — 눈 중심. scale이 개방도, pupil.position이 시선, lid.scale.y가 눈꺼풀

## 무엇을 굽고 무엇을 변형하나

| 한 번 굽는 것 (개체당) | 매 프레임 바꾸는 것 |
| --- | --- |
| 몸·머리 보일 3벌 | visible 토글 |
| 팔다리 지체 (front, back) | pivot.rotation.z, front/back visible |
| 꼬리 | rotation.z |
| 눈썹·입 쉼/대체 | visible |
| 눈 리그 5메시 | scale, position, visible |
| — | group·headGroup·faceGroup의 position/rotation/scale |

**매 프레임 지오메트리를 다시 만들지 않는다.** 예외는 이모트(이벤트당 1회)와 재생성(개체 교체)뿐이다.

## 지터 위상 (variant)

`drawCreature(spec, variant)`는 `wobbleSeed ^ (variant × 0x9e3779b9)`로 rng를 판다.
변형 3벌은 구도가 같고 떨림만 다르다. 눈썹·입·팔다리·꼬리는 변형이 없다(정적 지터로 충분).

## 재생성 시

`regenerate(index)`가 옛 그룹을 dispose하고 새 개체를 같은 슬롯에 세운다.
새 시계는 `clockNow`를 출생 시각으로 받는다. 종족은 유지된다.

## 자주 깨지는 지점

- 머리 지오메트리를 `-neckY` 안 내리고 headGroup.position.y만 올리면 **두 번 올라간다**
- 팔 front/back을 회전 중에 바꾸면 튄다 → 기준각 0.35rad 이내에서만
- 시계 위상 지터를 `t`에 그대로 붙이면 재생성 후 튄다 → 출생 상대 시간
- 뒷면 컬링을 켜두면 시계방향 경로의 채색이 사라진다 → `DoubleSide`
- 정점 색을 sRGB로 넣으면 회색이 된다 → `srgbToLinear`
