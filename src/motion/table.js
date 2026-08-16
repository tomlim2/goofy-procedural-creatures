// 종족별 모션 파라미터. 무엇이 어떤 주기로 얼마나 움직이는지는 전부 여기에 있다.
// 새 모션은 여기에 종족별 값을 넣는 것부터 시작한다 (없는 종족은 null).
// 문서: guidelines/motion.md

export const BLINK_TIME = 0.13;

// 종족별 모션 성격. [min, max]는 이벤트 간격(초), null은 그 모션 없음.
export const MOTION = {
  kid: {
    // 팔 행위 — 바인드(T포즈)에서 이따금 넘어갔다 돌아오는 것. [행위, 가중치]
    armActions: [["cross", 2], ["hips", 2], ["raise", 1.5], ["behind", 1.5], ["hang", 1.5], ["flap", 1]],
    armActionGap: [12, 36],
    // 팔: 레퍼런스에서 팔은 벌린 채 미세하게만 흔들린다. 큰 동작은 드물게.
    armSwing: 0.045, armLift: [18, 40], armWave: [30, 70],
    // 다리: 발 까딱 드물게. 다리는 바닥에 붙어 거의 정지한다.
    legTap: [12, 30], legStep: null,
    sway: [0.012, 0.032], swayPeriod: [2.6, 4.6],
    rock: 0.006,
    roll: null, dip: null,
    hop: [40, 90], stretch: null,
    tilt: [7, 18], tiltAmp: 0.1,
    jelly: null, shiver: [26, 60],
    wink: null, happyHold: null,
    tailSwish: null, tailFlick: null,
    surprise: [8, 22], yaw: 0.5,
    emotes: ["heart", "bang", "quest"]
  },
  pup: {
    armActions: null, armActionGap: null,
    armSwing: 0, armLift: null, armWave: null,
    // 레퍼런스의 개 다리는 4초 내내 바닥 고정. 몸이 흔들려 다리가 따라 보일 뿐이다.
    legTap: [14, 32], legStep: [30, 70],
    sway: [0.004, 0.01], swayPeriod: [3, 6],
    rock: 0.003,
    roll: { amp: [0.07, 0.14], period: [2.4, 4.8] },
    dip: [4, 10],
    hop: [30, 70], stretch: null,
    tilt: [9, 20], tiltAmp: 0.08,
    jelly: null, shiver: [40, 80],
    wink: null, happyHold: [6, 16],
    tailSwish: null, tailFlick: [3, 9],
    surprise: [10, 26], yaw: 0.7,
    emotes: ["heart", "bang", "quest"]
  },
  cat: {
    armActions: null, armActionGap: null,
    armSwing: 0, armLift: null, armWave: null,
    // 앞발 꾹꾹이 드물게, 스텝은 더 드물게
    legTap: [16, 36], legStep: [40, 90],
    sway: [0.002, 0.007], swayPeriod: [3.5, 7],
    rock: 0.004,
    roll: null, dip: null,
    hop: null, stretch: [10, 26],
    tilt: [5, 12], tiltAmp: 0.14,
    jelly: null, shiver: [40, 90],
    wink: [8, 20], happyHold: null,
    tailSwish: { amp: [0.16, 0.3], period: [2.4, 5] }, tailFlick: [4, 11],
    surprise: [9, 24], yaw: 0.8,
    emotes: ["heart", "quest", "bang"]
  },
  imp: {
    // 도깨비는 만세·파닥임을 더 자주. 팔짱은 짧은 팔이라 잘 안 보인다
    armActions: [["raise", 2.5], ["flap", 2], ["hips", 1.5], ["behind", 1], ["hang", 1]],
    armActionGap: [10, 30],
    // 짧은 스텁 팔. 젤리 워블에 딸려 미세하게 떨릴 뿐이다.
    armSwing: 0.06, armLift: [22, 50], armWave: [40, 90],
    legTap: [14, 34], legStep: null,
    sway: [0.015, 0.04], swayPeriod: [2, 3.8],
    rock: 0.004,
    roll: null, dip: null,
    hop: [50, 110], stretch: null,
    tilt: [8, 18], tiltAmp: 0.09,
    jelly: { amp: [0.008, 0.018], freq: [1.1, 1.9] }, shiver: [12, 30],
    wink: null, happyHold: null,
    tailSwish: null, tailFlick: null,
    surprise: [4, 12], yaw: 0.6,
    emotes: ["dots", "dots", "bang", "quest", "heart"]
  }
};
