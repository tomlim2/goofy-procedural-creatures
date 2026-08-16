# 파츠 카탈로그

> 기준: `src/character/vocabulary/slots.js`, `src/character/draw/`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

`src/character/vocabulary/slots.js` `SLOTS`의 전체 목록. 17슬롯 102파츠. 그리기는 `src/character/draw/` (섹션 = 파일: `head.js` `face.js` `body.js` `limbs.js`).

**규칙**: 슬롯은 **형태(생김새)** 만 담는다. 자세·동작은 `motion/` 상태다 ([rules.md](rules.md) 참조).
슬롯 추가·순서 변경은 rng 호출 수를 바꿔 **기존 시드를 깬다** ([../determinism.md](../determinism.md)).

## 머리

### head — 윤곽 (7)
`blobPath`의 superellipse(각짐)·taper(위아래 폭 비)·크기 배율로 만든다. `HEAD_SHAPES` 표.

| 값 | square | taper | rx / ry | 인상 |
| --- | --- | --- | --- | --- |
| round | 0 | 0 | 1 / 1 | 원 |
| square | 1.5 | 0 | 1 / 0.96 | 모서리 둥근 사각 |
| tall | 0.9 | −0.05 | 0.86 / 1.22 | 세로 직사각 |
| pear | 0.25 | +0.3 | 1 / 1.06 | 아래가 넓은 서양배 |
| wide | 0.7 | +0.1 | 1.28 / 0.9 | 옆으로 퍼짐 |
| egg | 0.2 | +0.28 | 0.94 / 1.14 | 세로 달걀 |
| block | 2.2 | 0 | 1.06 / 0.98 | 거의 사각 |

머리는 그 위에 노이즈 혹(headLumps)이 얹히고, 연필 스크리블 채움이 덮인다.

### eyes — 눈 종류 (9)
| 값 | 그리기 | 살아 있나 (동공·깜빡임) |
| --- | --- | --- |
| ring | 흰자 + 윤곽 + 동공 | ● 눈 리그 |
| wide | ring보다 크게 | ● |
| cyclops | 중앙 외눈 하나, 1.75배 | ● (side 0) |
| dot | 검은 점 | ✗ 정적 |
| sleepy | 아래로 감은 호 | ✗ |
| half | 윤곽 + 가로선 (반감김) | ✗ |
| spiral | 소용돌이 | ✗ |
| cross | X | ✗ |
| slit | 아몬드 윤곽 + 세로 동공 | ✗ |

정적인 눈은 본체 잉크에 굽힌다. 살아 있는 눈만 별도 리그로 세운다.

### brow — 눈썹 (4)
none / flat / angry(안쪽 내림) / worry(안쪽 올림). **상태 전환 대상** — 쉼/대체 두 벌을 굽고
clock이 토글한다. 대체 표: none→flat, flat→worry, angry→flat, worry→flat.

### eyewear (5)
none / glasses(양쪽 원 + 다리) / goggles(큰 원 + 머리까지 끈) / patch(한쪽 안대 + 사선 끈) / monocle(한쪽 큰 원 + 줄).

### hair (11)
| 값 | 방식 |
| --- | --- |
| none | |
| bob / mop / scribble / sweep | 정수리를 덮는 **스크리블** (`Sketch.scribble`). depth와 passes만 다르다 |
| spikes / mohawk | 정수리에서 뻗는 짧은 획 (11개 / 7개 좁게) |
| tuft / wisp | 몇 가닥 (4 / 7) |
| pigtails | 양옆 뭉치 두 개 + 정수리 살짝 |
| curly | 정수리를 따라 작은 원 7개 |

### headgear (7)
none / helmet(머리 위 반원 채움) / cap(챙 있는 반원) / band(가로 띠) / pot(뒤집어쓴 통) / beret(기운 원반 + 꼭지) / bonnet(머리를 감싸는 두툼한 테). 색은 accent 또는 pop.

### horns (7)
none / curved / straight / antenna(끝에 공) / nub(작은 혹) / ram(나선) / crown(정수리 스파이크 열).
imp는 1.8배.

### ears (6)
none / round / pointy(옆으로 뾰족) / flap(아래로 늘어진 호) / long(긴 로브, 비-pup) / fold(접힌 삼각).
**pup**은 슬롯값과 무관하게 늘어진 귀 로브. **cat**의 pointy는 옆이 아니라 정수리에 선다.

### nose (5)
hook(갈고리 한 획) / dot / wedge(V) / long(이마에서 내려옴) / none.
**pup**은 코 슬롯이 주둥이 형태(폭·높이·코 크기)를 결정한다 — 같은 슬롯으로 종족별 변형을 얻는다.

### face2 — 볼·눈가 (4)
none / tears(눈 아래 두 줄) / blush(볼 분홍 타원) / freckles(볼마다 점 3개).

### mouth (9)
dot / line / teeth(선 + 이빨 3개) / open(검은 타원) / wave / smile / pout(작은 원) / omega(ω, 고양이) / zigzag(도깨비).
**상태 전환 대상**. 대체 표: dot→line, line→wave, teeth→open, open→line, wave→line, smile→open.

## 몸

### body (4)
bean(찌그러진 타원) / box / dress(아래가 넓은 사다리꼴) / tube(좁은 통). 채색 + 스크리블 채움 + 외곽선.
네발은 슬롯값과 무관하게 가로 blob.

### marks (6)
none / stripes(가로 3줄) / dots(4점) / patch(왼쪽 해칭) / hatch(전체 사선) / spots(달마시안 얼룩 3개).

### legs (6)
| 값 | 그리기 |
| --- | --- |
| stick | 가는 선 + 동그란 발 |
| stub | 굵은 선 (0.019) + 동그란 발 |
| bent | 무릎 꺾임 + 동그란 발 |
| boots | 선 + 옷색 부츠 채움 |
| wide | 넓게 벌림 + 굵은 선 + 발 |
| tiptoe | 가는 선 + 아래로 뾰족한 발 |

두발은 엉덩이(밑단 위 0.02)에 피벗. **네발**은 슬롯값과 무관하게 굵은 스텁 4개 + 발가락, 뿌리는 bodyH 25% 위.

### tail (4) — 네발 전용
curl(위로 말림) / flag(위로 곧게) / longtail(뒤로 길게) / stubtail(뭉툭). 꼬리 뿌리에 피벗.
두발은 뽑히지만 그리지 않는다.

### arms — 형태 (4) — 두발 전용
| 값 | 그리기 |
| --- | --- |
| stick | 가는 선 + 손 획 |
| sleeve | 옷색 소매 채움 + 동그란 손. 긴 소매는 맨팔이 더 나온다 |
| stubby | 짧고 굵은 선 (0.017) + 주먹 |
| mitten | 선 + 동그란 손 |

팔마다 **위팔·아래팔·back(뒷짐)** 세 벌을 굽는다. 위팔은 어깨 원점, 아래팔은 팔꿈치 원점에서 늘어진 상태. 어깨는 몸 폭 78%(윤곽 안쪽). 소매는 위팔만 옷색이고 아래팔은 맨팔.

### armLength (4)
| 값 | 배율 |
| --- | --- |
| short | 0.45 — 손이 겨우 나온다 |
| medium | 1.1 |
| long | 2.2 — 팔꿈치 꺾임 |
| verylong | 3.6 — 바닥을 쓸 만큼. 쉼 자세는 out 고정 |

형태와 독립이라 4×4 조합 전부 나온다.

## 렌더 순서

`depthTest: false`라 `renderOrder`가 전부다.

| renderOrder | 무엇 |
| --- | --- |
| 0 | 종이 |
| 0.5 | 뒷짐 팔 (몸 뒤) |
| 1 | 채색, 바닥선 |
| 2 | 잉크 (몸·머리) |
| 2.5 | 팔다리 (몸 잉크 위 — 소매가 윤곽을 덮는다) |
| 3 | 눈 흰자, 눈썹·입 |
| 4 | 눈 윤곽 |
| 5 | 동공, 눈꺼풀 |
| 6 | 눈 ^^ 아치 |
| 7 | 이모트 |
