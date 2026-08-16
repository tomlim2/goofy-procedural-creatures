# 모션 규칙

`src/motion/`을 고칠 때 지키는 것. 무엇이 있는지는 [catalog.md](catalog.md).

## 세 종류로 나눈다

모션은 파츠별이 아니라 **움직임의 성격**으로 나눈다. 얼굴 모션·팔 모션이 아니라 리듬·이벤트·상태다.

| 종류 | 파일 | 성격 | rng | 형태 |
| --- | --- | --- | --- | --- |
| **리듬** | `rhythm.js` | 멈추지 않는 진동. 사인파와 이징 | init만 (위상·주기) | 결정적 함수 |
| **이벤트** | `events.js` | 예약 시각에 시작, 짧게 진행, 끝. 다음 예약 | init + step | `{ next, start }`, 진행 곡선 k |
| **상태** | `states.js` | 들어가면 몇 초 머물다 돌아옴. on/off | init + step | `{ next, until }` |

새 모션은 먼저 "이게 리듬인가 이벤트인가 상태인가"를 정한다. 그러면 파일도 형태도 정해진다.

- 호흡·스웨이·꼬리 스위시·관절 지터 → 리듬
- 깜빡임·놀람·폴짝·손 흔들기·이모트 → 이벤트
- 반감김·윙크·^^·눈썹·입·갸웃·팔 자세 → 상태

## 종족 차이는 table.js에만

종족별로 다른 것은 **파라미터**뿐이다. `MOTION[species]`에 간격·진폭·주기를 넣고, 없는 종족은 `null`.
`rhythm/events/states`에 `if (species === "cat")` 같은 분기를 넣지 않는다.

## rng 순서가 곧 시드

`index.js`의 init 28단계와 update 순서는 고정이다. 새 모션은 **각 블록의 끝에** 붙인다.
중간에 끼우면 그 뒤 모든 예약이 바뀌어 기존 시드의 모션이 전부 달라진다.

리듬의 step은 rng를 쓰지 않는다. 이벤트·상태의 step만 rng를 쓴다(다음 예약).

## 출생 상대 시간

모든 예약은 `birth` 기준이다. 절대 시간으로 잡으면 재생성으로 태어난 개체의 예약이 전부
과거가 되어 매 프레임 재생성되는 폭주가 난다.

## 크기는 실측에서

레퍼런스 대조 결과(reference/video-notes.md 33~36): 팔다리는 관절 지터 + 몸 따라가기가 기본이고
큰 관절 이벤트는 드물고 작다. 새 모션의 진폭·간격을 정할 때 눈이 아니라 프레임 대조로 정한다.

## 발화 빈도를 센다

고쳤으면 60초 시뮬로 몇 프레임 발화하는지 센다. 눈으로만 판단하지 않는다.

```bash
node --input-type=module -e "
import('./src/motion/index.js').then(({makeClock}) => {
  const c = makeClock(42, 0, 'kid');
  let n = 0;
  for (let f = 0; f < 3600; f++) { const s = c.update(f/60); if (s.YOUR_STATE) n++; }
  console.log(n, 'frames / 3600');
});"
```

## 리팩토링은 스냅샷으로

`node scripts/snapshot.mjs before` → 고침 → `node scripts/snapshot.mjs after`. diff 0이어야 한다.
