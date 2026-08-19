// 종족별 모션 파라미터. 무엇이 어떤 주기로 얼마나 움직이는지는 전부 여기에 있다.
// 새 모션은 여기에 종족별 값을 넣는 것부터 시작한다 (없는 종족은 null).
// 문서: guidelines/motion/catalog.md

export const BLINK_TIME = 0.13;

// 종족별 모션 성격. [min, max]는 이벤트 간격(초), null은 그 모션 없음.
export const MOTION = {
  human: {
    // 팔 행위 — idle(A포즈)에서 이따금 넘어갔다 돌아오는 것. [행위, 가중치]. 내용은 actions.js
    armActions: [
      ["wave", 2], ["cross", 2], ["hips", 2], ["think", 1.5], ["raise", 1.5], ["behind", 1.5],
      ["hi", 1], ["point", 1], ["flap", 1], ["salute", 0.7]
    ],
    armActionGap: [12, 36],
    // 팔: 레퍼런스에서 팔은 벌린 채 미세하게만 흔들린다. 큰 동작은 드물게(행위).
    armSwing: 0.045,
    // 다리: 발 까딱 드물게. 다리는 바닥에 붙어 거의 정지한다.
    legTap: [12, 30], legStep: null,
    // 기본 상태 — 서 있기(idle)와 제자리 걷기(walk)를 오간다. walk: hz 걸음 주파수 · leg 다리 진폭(rad) · bob 몸 들썩(단위) · sway 좌우 기움(rad)
    modes: [["idle", 4], ["walk", 1]], modeHold: { idle: [30, 90], walk: [6, 14] },
    walk: { hz: 1.8, leg: 0.3, bob: 0.01, sway: 0.05, arm: 0.14, trip: [0.1, 0.18], speed: 0.045 },   // trip 나갔다 오는 거리(셀), speed 셀/초
    sway: [0.012, 0.032], swayPeriod: [2.6, 4.6],
    rock: 0.006,
    roll: null, dip: null,
    // 몸 행위 — idle하다가 가끔 제자리 점프(살짝 3번). 팔 행위와 겹친다(점프하며 인사)
    bodyActions: [["jump", 1]], bodyActionGap: [10, 25],
    stretch: null,
    tilt: [7, 18], tiltAmp: 0.1,
    jelly: null, shiver: [26, 60],
    wink: null, happyHold: null, angry: null,
    tailSwish: null, tailFlick: null,
    surprise: [8, 22], yaw: 0.5,
    // 둘러보기 — 얼굴을 한 방향으로 돌리고 머문다. [간격], [유지], 진폭 [x, y]
    look: [6, 16], lookHold: [1.5, 4], lookAmp: [1, 0.8],
    emojis: ["heart", "bang", "quest", "sweat"]
  },
  pup: {
    armActions: null, armActionGap: null,
    armSwing: 0,
    // 네발 idle 자세 — 바인드(다리 수직·꼬리 그린 그대로)와 다르다. 앞다리는 살짝 앞, 뒷다리는 뒤로 딛고
    // 꼬리는 올린다. 그 위에 리듬(호흡·롤·꼬리)과 행위가 얹힌다.
    legStance: [-0.05, -0.02, 0.09, 0.06], tailIdle: 0.25,
    // 기본 상태 — 서 있기(idle)·엎드려 잠(sleep)·걷기(walk)·앉기(sit)를 오간다. [상태, 가중치]는 시작·전환 때 뽑는 비율, 유지는 modeHold
    modes: [["idle", 3], ["sleep", 1], ["walk", 1.5], ["sit", 1.5]], modeHold: { idle: [40, 120], sleep: [25, 60], walk: [6, 16], sit: [15, 45] },
    walk: { hz: 2.6, leg: 0.32, bob: 0.008, sway: 0, arm: 0, trip: [0.1, 0.16], speed: 0.07, tail: 0.12 },   // 종종걸음 — 대각선 다리 쌍이 번갈아, 꼬리도 걸음에 살랑
    quadActions: [["wag", 3.5], ["scratch", 1]], quadActionGap: [6, 16],   // 개는 자주 흔든다
    wagOnHappy: { amp: 0.35, hz: 4 },   // ^^ 웃을 때마다 꼬리를 흔든다 (행복 유지·깜빡임 ^^)
    // 레퍼런스의 개 다리는 4초 내내 바닥 고정. 몸이 흔들려 다리가 따라 보일 뿐이다.
    legTap: [14, 32], legStep: [30, 70],
    sway: [0.004, 0.01], swayPeriod: [3, 6],
    rock: 0.003,
    roll: { amp: [0.07, 0.14], period: [2.4, 4.8] },
    dip: [4, 10],
    bodyActions: [["jump", 1]], bodyActionGap: [12, 30],
    stretch: null,
    tilt: [9, 20], tiltAmp: 0.08,
    jelly: null, shiver: [40, 80],
    wink: null, happyHold: [6, 16], angry: null,
    tailSwish: null, tailFlick: [3, 9],
    // 꼬리 끝 마디 — 개는 팔로스루만(흔들 때 끝이 늦게 따라온다). 나머지 고양이 전용은 null
    tailTip: { follow: 0.05, twitch: null, raise: null, puff: 0 },
    surprise: [10, 26], yaw: 0.7,
    // 개는 자주, 위(주인 쪽)로도 잘 본다
    look: [4, 12], lookHold: [1, 3], lookAmp: [1, 1],
    emojis: ["heart", "bang", "quest", "sweat"]
  },
  cat: {
    armActions: null, armActionGap: null,
    armSwing: 0,
    legStance: [-0.03, 0, 0.06, 0.03], tailIdle: 0,
    // idle 꼬리 자세 — **아치**. 골격(curl·flag·longtail·kink…)이 뭐든 깨어 있는 idle에선 관절을 이 세계각(뿌리→끝, 0 = 뒤(머리 반대), π/2 = 위)으로
    // 섞는다(weight — 1이면 골격이 안 보이고, 0.85면 골격의 성격이 15% 남아 개체마다 조금 다르다). 뿌리는 살짝 머리 쪽으로 기울어 오르고 끝은
    // **머리 반대편(뒤)** 으로 넘어가 끝이 **−75°로 내려온다**(거의 수직 낙하) — 등 뒤 허공에 걸린 ∩ 아치. 끝 두 마디는 개체 tailLift(−1~1)로
    // ±liftBend(±7°) — 살짝만 다르게. 잠·세움 땐 이 자세가 빠진다 (motion/index.js tailArch)
    tailIdlePose: { angles: [1.85, 1.3, 0.05, -75 * Math.PI / 180], weight: 0.85, liftBend: 0.12 },
    // 고양이는 더 자주, 더 오래 자고 앉는다
    modes: [["idle", 2], ["sleep", 1], ["walk", 1], ["sit", 1.5]], modeHold: { idle: [40, 120], sleep: [30, 90], walk: [6, 14], sit: [20, 60] },
    walk: { hz: 2.2, leg: 0.28, bob: 0.006, sway: 0, arm: 0, trip: [0.1, 0.16], speed: 0.05, tail: 0 },   // 느긋한 걸음 — 꼬리는 걷기에 안 흔든다 (고양이는 개처럼 꼬리치지 않는다)
    // 고양이는 개처럼 꼬리를 흔들지 않는다 — 꼬리는 상시 스위시·플릭뿐. 행위는 뒷발 긁기만
    quadActions: [["scratch", 1]], quadActionGap: [10, 28],
    // 앞발 꾹꾹이 드물게, 스텝은 더 드물게
    legTap: [16, 36], legStep: [40, 90],
    sway: [0.002, 0.007], swayPeriod: [3.5, 7],
    rock: 0.004,
    roll: null, dip: null,
    bodyActions: [["jump", 1]], bodyActionGap: [25, 60],   // 고양이는 드물게
    stretch: [10, 26],
    tilt: [5, 12], tiltAmp: 0.14,
    jelly: null, shiver: [40, 90],
    wink: [8, 20], happyHold: null,
    // 화남 — 25~60초마다 3~5초. 사나운 눈·이 드러낸 입, 그동안 꼬리 털이 곤두선다(tailTip.puff). 개는 아직 없다(null)
    angry: [25, 60], angryHold: [3, 5],
    // 고양이 꼬리 — 개와 반대: 빠른 움직임은 짜증·흥분, 기쁨은 **세우는 것**. 느린 스위시(리듬) 위에 끝 마디 모션이 얹힌다
    //   follow 팔로스루(끝이 뿌리 속도에 늦게 따라옴) · twitch 끝만 톡톡(tailFlick 간격을 끝 마디에 씀) ·
    //   raise 기분 좋을 때(^^ 동안) 세움 — 관절 전부 정확히 수직, 굽는 변형 없음 (true/null) · puff 곤두섬 배율(**화내는 동안** 굵기만 — 화남 봉투 0.1/유지/0.1 그대로)
    tailSwish: { amp: [0.16, 0.3], period: [2.4, 5] }, tailFlick: [8, 20],
    tailTip: { follow: 0.06, twitch: { amp: 0.35, hz: 6, dur: 0.5 }, raise: true, puff: 1 },   // 채찍질(lash)은 없다 — 고양이가 꼬리를 치는 모션은 금지
    surprise: [9, 24], yaw: 0.8,
    // 고양이는 드물게, 오래 응시
    look: [8, 20], lookHold: [2, 5], lookAmp: [0.9, 0.9],
    emojis: ["heart", "quest", "bang"]
  },
  imp: {
    // 도깨비는 만세·파닥임을 더 자주. 팔짱·생각은 드물게
    armActions: [
      ["raise", 2.5], ["flap", 2], ["wave", 1.5], ["hips", 1.5], ["hi", 1], ["point", 1],
      ["behind", 1], ["salute", 0.5], ["think", 0.5]
    ],
    armActionGap: [10, 30],
    // 젤리 워블에 딸려 미세하게 떨린다.
    armSwing: 0.06,
    legTap: [14, 34], legStep: null,
    modes: [["idle", 4], ["walk", 1]], modeHold: { idle: [25, 80], walk: [5, 12] },
    walk: { hz: 2.3, leg: 0.36, bob: 0.012, sway: 0.06, arm: 0.16, trip: [0.1, 0.18], speed: 0.06 },   // 통통 튀는 걸음
    sway: [0.015, 0.04], swayPeriod: [2, 3.8],
    rock: 0.004,
    roll: null, dip: null,
    bodyActions: [["jump", 1]], bodyActionGap: [8, 20],   // 도깨비는 자주 — 젤리 워블과 함께 통통
    stretch: null,
    tilt: [8, 18], tiltAmp: 0.09,
    jelly: { amp: [0.008, 0.018], freq: [1.1, 1.9] }, shiver: [12, 30],
    wink: null, happyHold: null, angry: null,
    tailSwish: null, tailFlick: null,
    surprise: [6, 14], yaw: 0.6,
    look: [5, 14], lookHold: [1, 3], lookAmp: [1, 0.7],
    emojis: ["dots", "dots", "bang", "quest", "heart", "sweat"]
  }
};
