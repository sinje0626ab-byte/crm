// 게임 밸런스 상수. 숫자만 만져도 게임 느낌이 바뀌도록 한곳에 모아둔다.
export const CFG = {
  world: {
    groundSize: 220,
    treeCount: 340,
    base: { x: -13, z: 0, w: 30, d: 24 },      // 눈밭 위 캠프(울타리 안쪽)
    field: { x0: 9, x1: 56, z0: -26, z1: 26 }, // 야수 사냥터
  },

  player: {
    speed: 7.6,
    maxHp: 120,
    carryCap: 10,
    pickRadius: 1.9,
    regen: 5,          // 초당 회복량
    regenDelay: 3,     // 피격 후 회복까지 대기(초)
  },

  axe: {
    count: 4,          // 레벨 0 기준 도끼 개수
    damage: 20,
    radius: 3.2,
    spin: 2.6,         // rad/s
    hitCd: 0.35,        // 같은 야수를 다시 때리기까지의 간격
    perLevelCount: 1,
    perLevelDamage: 11,
  },

  bear: {
    hp: 110,
    speed: 3.4,
    aggro: 12,
    atkRange: 2.7,
    atkDmg: 9,
    atkCd: 1.6,
    meatDrop: 4,
    maxAlive: 9,
    spawnCd: 2.2,
    knockback: 2.2,
  },

  meat: { value: 12, life: 75 },
  grill: { cookTime: 0.55, queueMax: 24 },
  cash: { maxBills: 40 },

  archer: { range: 17, cd: 0.85, damage: 24, arrowSpeed: 30 },
  worker: { speed: 5.4, carryCap: 4 },

  // 구매 패드: 서 있으면 돈이 빠져나가며 채워진다.
  padFillRate: 0.45,   // 초당 가격의 몇 %를 지불하는가
};

export const COLORS = {
  snow: 0xf2f8ff,
  snowDark: 0xdce9f7,
  pine: 0x8fb9dd,
  pineDark: 0x6d9cc4,
  trunk: 0x7a5a42,
  ground: 0xc8a57c,
  wood: 0x9c6b43,
  woodDark: 0x7b5134,
  fence: 0xf6fbff,
  coat: 0x2f9fe0,
  fur: 0xf7fbff,
  skin: 0xe8b795,
  bear: 0xf4f7fb,
  bearShade: 0xd9e3ee,
  meat: 0xe2564d,
  fat: 0xf6d7c6,
  cash: 0x5fd07a,
  cashDark: 0x36a457,
  fire: 0xffa32e,
  steel: 0xb9c4cf,
};
