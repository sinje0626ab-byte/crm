// 게임 밸런스 상수. 숫자만 만져도 게임 느낌이 바뀌도록 한곳에 모아둔다.
export const CFG = {
  world: {
    groundSize: 240,
    camp: { x: -16, z: 0, w: 34, d: 30 },      // 눈 속 정착지
    forest: { x0: 9, x1: 48, z0: -32, z1: -7 }, // 벌목장
    field: { x0: 9, x1: 52, z0: 3, z1: 30 },    // 야수 사냥터
    sceneryTrees: 420,
    choppableTrees: 32,
  },

  player: {
    speed: 7.8,
    maxHp: 120,
    carryBase: 10,      // 기본 적재량(나무+고기 합산)
    carryPerLevel: 5,
    pickRadius: 2.0,
    regen: 5,
    regenDelay: 3,
  },

  sword: {
    damage: 26,
    range: 3.4,
    arc: 1.4,           // 전방 판정 각도(rad, 좌우 합)
    cd: 0.55,
    perLevelDamage: 15,
    perLevelCd: 0.035,
  },

  tree: { hp: 3, logs: 3, respawn: 20 },

  bear: {
    hp: 110, speed: 3.4, aggro: 12, atkRange: 2.7, atkDmg: 9, atkCd: 1.6,
    meatDrop: 4, maxAlive: 9, spawnCd: 2.4, knockback: 2.2,
  },

  goods: { woodPrice: 14, meatPrice: 24 },
  grill: { cookTime: 0.6, queueMax: 30 },
  stall: { stockMax: 60, depositRate: 0.09 },
  buyer: { interval: 4.5, maxQueue: 4, wantMin: 2, wantMax: 5, speed: 4.8, serveTime: 0.9 },
  cash: { maxBills: 44 },

  archer: { range: 17, cd: 0.85, damage: 24, arrowSpeed: 30 },
  worker: { speed: 5.4, carryCap: 4 },

  padFillRate: 0.45,
  autosaveEvery: 12,
};

// WOS 계열의 차갑고 채도 낮은 설원 팔레트 + 불빛의 주황 대비
export const COLORS = {
  snow: 0xe4edf6,
  snowShade: 0xc6d7e8,
  ice: 0xb9cfe2,
  pine: 0x2f574c,
  pineDeep: 0x24443c,
  pineSnow: 0xeaf3fb,
  trunk: 0x4a3627,
  wood: 0x6d4c34,
  woodDark: 0x4d3423,
  plank: 0x835e3d,
  stone: 0x6d7884,
  stoneDark: 0x505a66,
  roof: 0xdde9f5,
  canvas: 0x8a6f52,
  coat: 0x2a5f92,
  coatAlt: 0x7a4a3a,
  fur: 0xe6eef7,
  skin: 0xd9a582,
  bear: 0xeef4fa,
  bearShade: 0xd0ddea,
  meat: 0xc2453e,
  fat: 0xe8c9b6,
  cash: 0x5bc47a,
  cashDark: 0x2f8b4d,
  fire: 0xff8a2b,
  ember: 0xffc76b,
  steel: 0xa9b4c2,
  gold: 0xe0b34a,
};
