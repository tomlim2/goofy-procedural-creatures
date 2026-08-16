# guidelines — menagerie 작업 규칙

이 랩은 **캐릭터**(무엇인가 — 시드가 결정하는 정적인 것)와 **모션**(어떻게 움직이나 — 시계가
결정하는 동적인 것) 두 축으로 나뉜다. 코드도 문서도 그 축을 따른다. 파츠별 애니메이션이 아니다.

레포 전체 규칙은 [`../../../guidelines/`](../../../guidelines/index.md)에 있고, 여기는 menagerie에만
해당하는 것만 둔다.

| 축 | 코드 | 카탈로그 (무엇이 있나) | 규칙 (어떻게 고치나) |
| --- | --- | --- | --- |
| **캐릭터** | `src/character/` | [character/types.md](character/types.md) 종족·아키타입·비율·팔레트·제약<br>[character/parts.md](character/parts.md) 19슬롯 106파츠 | [character/rules.md](character/rules.md) 파츠 추가 절차, 형태/모션 분리, 분포 기준 |
| **모션** | `src/motion/` | [motion/catalog.md](motion/catalog.md) 상태 객체·종족별 파라미터·전 모션 | [motion/rules.md](motion/rules.md) 리듬/이벤트/상태 분류, rng 순서, 발화 측정 |
| 공통 | `src/scene/` `src/stroke.js` `src/rng.js` | [rig.md](rig.md) three.js 계층·원점 | [determinism.md](determinism.md) 시드 계약<br>[drawing.md](drawing.md) 선·색·레이어 |

## 무엇으로 판단하나

눈으로 좋아 보이는 것과 맞는 것은 다르다. 판단마다 도구가 있다.

| 판단 | 도구 | 어디 |
| --- | --- | --- |
| 파츠 하나의 **형태** | 파츠 갤러리 — 같은 개체에 슬롯값 전부를 나란히 | `/gallery.html?slot=…&species=…&fix=…` ([../README.md](../README.md) § 실행) |
| 파츠 **분포**·종족 정체성 | `node scripts/census.mjs [--slot X \| --check]` | [character/rules.md](character/rules.md) § 분포는 census로 본다 |
| **행위** 하나가 어떻게 보이나 | 화면 ACTION 카드 (두발 전원 강제, IDLE) | [motion/catalog.md](motion/catalog.md) § 바인드 포즈와 팔 행위 |
| 모션 **빈도** | 60초 시뮬로 발화를 센다 | [motion/rules.md](motion/rules.md) § 발화 빈도를 센다 |
| 형태 판단 시 모션 잡음 | POSE BIND(T포즈 고정) · INK STILL(보일 정지) | [rig.md](rig.md) § 포즈와 잉크 |
| 리팩토링 전후 **불변** | `node scripts/snapshot.mjs before/after` | [determinism.md](determinism.md) |

## 한 줄 요약

- 시드가 같으면 결과가 같아야 한다. 이게 깨지면 이 랩은 아무 의미가 없다
- 캐릭터는 슬롯(형태)만, 모션은 리듬/이벤트/상태만. 뒷짐은 형태가 아니라 자세(모션)다
- 눈으로 좋아 보이는 것과 분포·빈도가 맞는 것은 다르다. 고쳤으면 센다
