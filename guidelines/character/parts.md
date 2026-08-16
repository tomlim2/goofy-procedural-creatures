# 파츠 카탈로그

> 기준: `src/character/vocabulary/slots.js`, `src/character/draw/`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

`src/character/vocabulary/slots.js` `SLOTS`의 전체 목록. 19슬롯 110파츠. 그리기는 `src/character/draw/` (섹션 = 파일: `head.js` `face.js` `body.js` `limbs.js`).

**규칙**: 슬롯은 **형태(생김새)** 만 담는다. 자세·동작은 `motion/` 상태다 ([rules.md](rules.md) 참조).
뽑는 순서는 `SLOTS`의 선언 순서이고 이게 곧 시드다 — 순서 변경은 **기존 시드를 깬다**. 새 슬롯은 `LATE_SLOTS`에
붙여 맨 끝에 뽑으면 기존 판이 유지된다 ([../determinism.md](../determinism.md)). 아래 목록은 부위별로 묶은 것이라
선언 순서와 다르다.

**머리와 얼굴은 다른 리그다.** 머리(윤곽·머리카락·모자·뿔·귀)는 `headGroup`에, 얼굴(눈·눈썹·안경·코·볼·입·수염·주둥이)은
`faceGroup`에 굽는다 — 얼굴 돌림(모션)이 이목구비만 통째로 민다 ([../rig.md](../rig.md)).

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

정적인 눈은 얼굴 잉크(faceGroup)에 굽는다 — 얼굴 돌림을 같이 따라간다. 살아 있는 눈만 별도 눈 리그(흰자·윤곽·동공·눈꺼풀·^^)로 세운다.

### brow — 눈썹 (4)
none / flat / angry(안쪽 내림) / worry(안쪽 올림). **상태 전환 대상** — 쉼/대체 두 벌을 굽고
clock이 토글한다. 대체 표: none→flat, flat→worry, angry→flat, worry→flat.

### eyewear (5)
none / glasses(양쪽 원 + 다리, 알 반지름 = 눈 × 1.45) / goggles(큰 원 + 머리까지 끈, × 1.75) / patch(한쪽 안대 + 사선 끈) / monocle(한쪽 큰 원 + 줄).
안경·고글은 **두 알이 겹치면 뺀다**(눈이 가까운 개체 — 눈에 맞춰 억지로 줄이지 않는다, `makeCreature`가 비율 확정 뒤 none으로).

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
none / helmet(눈썹 위~정수리 위 돔 + 테두리 + 능선) / cap(정수리 돔 + 한쪽 챙) / band(이마 띠) / pot(눈썹 위에서 정수리보다 높이 솟는 통) /
beret(기운 원반 + 꼭지) / bonnet(양옆 눈높이에서 정수리 위로 넘어가는 두툼한 테). 색은 accent 또는 pop.

**전부 눈썹 선 위에 앉는다** — 눈(안경·고글·안대·모노클 테 포함) 위쪽 끝에서 재서 눈이 높이 달린 개체도 가리지 않고, 폭은 그 높이의 머리 윤곽
반폭을 따라 머리 크기·모양에 맞는다. 모자는 머리 **앞**의 별도 층(채색 2.1·잉크 2.2 — 윤곽·머리카락·뿔 밑동을 덮되 눈·안경은 못 덮는다,
[../rig.md](../rig.md)).

### horns (7)
none / curved / straight / antenna(끝에 공) / nub(작은 혹) / ram(나선) / crown(정수리 스파이크 열).
imp는 1.8배.

### ears (8)
none / round / pointy · pointyMid · pointyBig(뾰족귀 — 크기 셋: 1 · 1.4 · 1.85배, 모양은 같다) / flap(아래로 늘어진 호) / long(긴 로브, 비-pup) / fold(접힌 삼각).
**cat**의 pointy는 정수리에 서고 크기 셋이 다 있다(중간 이상은 안쪽 귀 선이 하나 더). 종족 bias pointy 3 · pointyMid 3 · pointyBig 2 · fold 2 · round 1.
**pup**은 같은 값을 개 귀로 그린다 — 뿌리는 **머리 윤곽 위 두 자리** — 위쪽 모서리(정수리보다 좀 밑, θ 50°: pointy·round·fold)와 옆구리(눈 양옆보다 조금 옆, θ 88°:
flap·long) — 이고 귀는 그 자리의 법선을 **반대 기울기로 탄다**(수직 기준 거울상 축 — 세모귀·동그란 귀는 위·안쪽으로 기울어 서고, 로브는 늘어지되
0.25~0.35rad 안쪽으로 모인다). 귀 몸통은 머리 **밖** 종이 위에 놓인다 — 위쪽 귀는 윤곽에 밑변을 박고 0.02 밖으로, 긴 귀(flap·long)는 0.09 밖으로
떨어져 늘어진다 — 그리고 머리 **위에** 그린다(`drawPupEars`, 머리 다음). 채운 로브: flap 늘어진 로브(레퍼런스 비글) · long 턱 아래까지(바셋) · round 작은 동그란 귀(퍼그) ·
pointy 쫑긋 선 세모귀(셰퍼드) · fold 옆으로 접혀 끝만 처짐 · none 없음. 종족 bias flap 4 · long 3 · pointy 2 · round 1.5 · fold 1.
**cat**의 pointy는 옆이 아니라 정수리에 선다.

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

### build — 체격 (5)
두발에서는 몸통 **폭·높이**, 네발에서는 몸통 **길이·두께**다 (네발 몸은 가로로 누워 있어 실루엣의 너비가 곧 길이).

| 값 | 두발: 몸 폭 | 두발: 몸 높이 | 두발: 다리 스탠스 (몸 반폭 대비) | 네발: 길이 / 두께 | |
| --- | --- | --- | --- | --- | --- |
| **skinny** 홀쭉이 | 0.5 (dress 0.6) — 막대 몸통 | ×1.15 | 0.33 | 1 / 0.62 얇은 몸 | sprite |
| narrow 마름 | 0.7 (dress 0.75) | ×1.08 | 0.4 — 다리를 모은다 | 0.7 / 1 짧은 몸 | sprite |
| medium | 1 | ×1 | 0.5 | 1 / 1 | 기본 |
| wide 넓적 | 1.4 (dress 1.15 — 밑단이 셀을 넘지 않게) | ×0.92 땅딸막 | 0.68 — 다리를 벌린다 | 1.45 / 1 긴 몸 (닥스훈트·먼치킨). 몸 중심을 머리 쪽으로 당겨 꼬리가 셀을 덜 넘게 | blob |
| **small** 작은 몸통 | 0.75 (dress 0.8) | ×0.7 | 0.45 | 0.75 / 0.75 작은 몸 | |

형태(body)와 독립이라 4×5 조합. **다리 스탠스(벌림)는 다리 슬롯이 아니라 여기서 정한다** — 넓은 몸이 넓은 스탠스를
받치고, 좁은 몸은 다리를 모은다. 어깨 위치(몸통 윤곽 위)도 같이 따라온다. 네발은 앞뒤 다리 쌍이 몸 길이를 따라 벌어진다.
`layout()` `BUILD`(두발)·`QUAD_BUILD`(네발). `LATE_SLOTS`. 기본 가중치 medium 4 · narrow 1.5 · wide 1.5 · skinny 1 · small 1.
갤러리: `gallery.html?slot=build&fix=legLength:long`.

### marks (6)
none / stripes(가로 3줄) / dots(4점) / patch(왼쪽 해칭) / hatch(전체 사선) / spots(달마시안 얼룩 3개).

### legs (6)
| 값 | 두발 | 네발 (고양이·개) |
| --- | --- | --- |
| stick | 가는 선 + 동그란 발 | 가는 다리 + 둥근 발 |
| stub | 굵은 선 (0.019) + 동그란 발 | **기본** — 굵은 스텁 + 앞으로 나온 발끝 + 발가락 두 줄 (레퍼런스) |
| bent | 무릎 꺾임 + 동그란 발 | stick으로 그린다 |
| boots | 선 + 옷색 부츠 채움 | 양말 — 발목까지 작은 부츠 |
| tiptoe | 가는 선 + 아래로 뾰족한 발 | stick으로 그린다 |
| **float** | 레이맨식 — 다리 선 없이 큼직한 발만 떠 있다 (반지름 0.03) | 발만 떠 있다 (0.024) |

형태만이다. 벌린 정도(스탠스)는 `build`가, 기장은 `legLength`가 정한다 — 6×3×5 조합.
float도 엉덩이 피벗에 걸려 있어 관절 지터·발 까딱이 발을 둥둥 흔든다.

두발은 엉덩이(밑단 위 0.02)에 피벗. **네발**은 앞다리 둘·뒷다리 둘이 각각 **붙어 있다**(옆에서 본 짐승 — 쌍 안 간격
max(0.03, 몸 길이 16%)), 앞쌍은 몸 중심에서 −60%, 뒷쌍은 +60%. 뿌리는 bodyH 25% 위. 종족 bias: pup stub 4 · stick 2 ·
float 1.5 · boots 1, cat stub 3 · stick 3 · float 1.5 · boots 1.

### legLength (3)
| 값 | 기장 (두발) | 기장 (네발) | |
| --- | --- | --- | --- |
| long | legLength 비율 × 0.55 (≈0.17) | × 0.4 (≈0.12) | 기준 |
| medium | 그 65% | 65% | |
| short | 그 30% (≈0.05) | 30% — 닥스훈트·먼치킨 | 몸이 바닥에 거의 내려앉는다. **스케일이 아니라 기장만** — 발·굵기·부츠 높이는 그대로 |

형태(legs)와 독립이라 모든 다리 유형에 세 기장이 있다. `layout()`이 `legTop`에서 곱하므로(`LEG_LENGTH`) 몸·머리·어깨가
같이 내려온다. 네발도 따른다. `LATE_SLOTS`라 맨 끝에 뽑는다. 기본 가중치 long 3 · medium 2 · short 1.
갤러리: `gallery.html?slot=legs&fix=legLength:short`.

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

팔마다 **위팔·아래팔·back(뒷짐)** 세 벌을 굽는다. 위팔은 어깨 원점, 아래팔은 팔꿈치 원점에서 늘어진 상태로 굽고, 리그가 바인드 포즈(T)로 세운다. 어깨는 **몸통 좌우 윤곽 위** — 팔이 옆구리에서 나온다 (형태별 반폭 `SHOULDER_X`: box 0.98 · bean 0.85 · dress 0.76 · tube 0.63; 위에서 22% 높이). 소매는 위팔만 옷색이고 아래팔은 맨팔.

### armLength (2)
| 값 | 배율 | |
| --- | --- | --- |
| medium | 1 — 기준 (ARM_BASE 0.242 × armSpread) | 사람·도깨비 |
| long | 1.64 — 바닥을 쓸 만큼 | **도깨비만** (사람은 forbid로 medium). idle에서 손이 바닥에 걸려 팔꿈치가 바깥으로 접힌다 (모션 IK의 floor 클램프) |

형태와 독립이라 4×2 조합. 단계는 둘뿐이다 — 기준(1)보다 짧으면 손이 몸통 근처라 팔로 안 보이고,
1.64보다 길면 바닥을 뚫는다. 팔 길이는 **종족이 정한다** — 사람은 forbid로 항상 medium, 도깨비는
species bias 3:2. 아키타입은 관여하지 않는다.

## 렌더 순서

`renderOrder` 표는 [../rig.md](../rig.md) § 계층에 있다.
