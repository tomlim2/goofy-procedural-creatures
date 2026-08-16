# 파츠 카탈로그

> 기준: `src/character/vocabulary/slots.js`, `src/character/draw/`. 코드가 바뀌면 이 문서도 같은 커밋에서 고친다.

`src/character/vocabulary/slots.js` `SLOTS`의 전체 목록. 18슬롯 102파츠. 그리기는 `src/character/draw/` (섹션 = 파일: `head.js` `face.js` `body.js` `limbs.js`).

**규칙**: 슬롯은 **형태(생김새)** 만 담는다. 자세·동작은 `motion/` 상태다 ([rules.md](rules.md) 참조).
슬롯 순서 변경은 rng 호출 순서를 바꿔 **기존 시드를 깬다**. 새 슬롯은 `LATE_SLOTS`에 붙여 맨 끝에 뽑으면 기존 판이
유지된다 ([../determinism.md](../determinism.md)).

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

### legLength (2)
| 값 | 기장 | |
| --- | --- | --- |
| medium | legLength 비율 × 0.55 (≈0.17) | 기준 |
| short | 그 절반 (≈0.08) | 몸이 바닥 가까이 내려앉는다. **스케일이 아니라 기장만** — 발·굵기·부츠 높이는 그대로 |

형태(legs)와 독립이라 6×2 조합 — 모든 다리 유형에 짧은 판이 있다. `layout()`이 `legTop`에서 곱하므로 몸·머리·어깨가
같이 내려온다. 네발은 무시. `LATE_SLOTS`라 맨 끝에 뽑는다. 갤러리: `gallery.html?slot=legs&fix=legLength:short`.

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

팔마다 **위팔·아래팔·back(뒷짐)** 세 벌을 굽는다. 위팔은 어깨 원점, 아래팔은 팔꿈치 원점에서 늘어진 상태로 굽고, 리그가 바인드 포즈(T)로 세운다. 어깨는 몸 폭 78%(윤곽 안쪽). 소매는 위팔만 옷색이고 아래팔은 맨팔.

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
