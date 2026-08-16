# guidelines — menagerie 작업 규칙

이 랩을 고칠 때 지키는 규칙. 레포 전체 규칙은 [`../../../guidelines/`](../../../guidelines/index.md)에 있고,
여기는 menagerie에만 해당하는 것만 둔다.

| 문서 | 언제 읽나 |
| --- | --- |
| **카탈로그 — 무엇이 있나** | |
| [character-types.md](character-types.md) | 종족·아키타입·비율·팔레트·제약. 개체가 어떻게 정해지는지 |
| [parts-catalog.md](parts-catalog.md) | 17슬롯 102파츠 전체 목록과 그리기 방식, 렌더 순서 |
| [motion.md](motion.md) | 모션 전체 목록. 종족별 파라미터 표, 상태 객체, 팔 자세 |
| [rig.md](rig.md) | three.js 계층, 원점 규칙, 무엇을 굽고 무엇을 변형하나 |
| **규칙 — 어떻게 고치나** | |
| [determinism.md](determinism.md) | 생성 로직(`rng`/`creature`/`vocabulary/`)을 건드릴 때 |
| [parts.md](parts.md) | 파츠를 추가·삭제·변경할 때. 형태와 모션을 섞지 않는다 |
| [drawing.md](drawing.md) | 선·색·레이어를 건드릴 때 |

## 한 줄 요약

- 시드가 같으면 결과가 같아야 한다. 이게 깨지면 이 랩은 아무 의미가 없다
- 관심사를 섞지 않는다. 무엇이 있는가(vocabulary) / 무엇을 고르는가(creature) / 어떻게 그리는가(draw) / 언제 움직이는가(clocks)
- 눈으로 좋아 보이는 것과 분포가 고른 것은 다르다. 고쳤으면 분포를 세어 본다
