// 게임 밸런스 상수. 숫자만 만져도 게임 느낌이 바뀌도록 한곳에 모아둔다.
export const CFG = {
  world: {
    groundSize: 360,
    camp: { x: -16, z: 0, w: 34, d: 30 },        // 눈 속 정착지
    forest: { x0: 9, x1: 86, z0: -62, z1: -7 },  // 벌목장(깊이 들어갈수록 험해진다)
    field: { x0: 9, x1: 92, z0: 3, z1: 58 },     // 야수 사냥터
    sceneryTrees: 620,
    choppableTrees: 54,
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

  // 낮/밤 주기(초). 밤에는 횃불을 들고 다닌다.
  dayNight: { day: 120, night: 75, blend: 18 },

  // 레벨: 경험치를 모으면 레벨업하고 스킬을 고른다. Lv.1은 공격만 가능.
  level: { baseXp: 60, stepXp: 55, maxLevel: 20, treeXp: 5, saleXp: 2 },

  // 스킬 3종. 각 스킬은 5레벨까지 강화된다.
  skills: {
    whirl: {
      name: '회전베기', key: 'S', cooldown: 9, duration: 0.7,
      radius: 6.8, damageMul: 2.4, knock: 7,
      perLevel: { damageMul: 0.5, radius: 0.5, cooldown: -0.6 },
      desc: '제자리에서 돌며 주변의 야수를 한 번에 베고 나무도 찍는다',
    },
    charge: {
      name: '돌진베기', key: 'D', cooldown: 7, duration: 0.42,
      distance: 13, width: 2.6, damageMul: 2.0, knock: 9,
      perLevel: { damageMul: 0.45, distance: 1.4, cooldown: -0.45 },
      desc: '앞으로 내달리며 부딪히는 야수를 모두 베어 넘긴다',
    },
    frost: {
      name: '서리폭발', key: 'F', cooldown: 12, duration: 0.6,
      radius: 9, damageMul: 1.7, slow: 0.42, slowTime: 4.5,
      perLevel: { damageMul: 0.4, radius: 0.7, slowTime: 0.8, cooldown: -0.8 },
      desc: '서리를 터뜨려 넓은 범위에 피해를 주고 야수를 느리게 만든다',
    },
  },
  skillMaxLevel: 5,

  attack: { repeatDelay: 0.05 },

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
    aggro: 13, atkRange: 2.7, atkCd: 1.6,
    maxAlive: 20, spawnCd: 1.1, knockback: 2.2,
    // 밤에는 더 많이, 더 자주, 가끔 한 등급 위로 나온다
    night: { maxAliveMul: 1.7, spawnMul: 0.5, tierUpChance: 0.28 },
    // 정착지에서 멀어질수록 더 강한 놈이 나온다(깊이 = 정착지 중심까지 거리)
    tiers: [
      { id: 0, name: '북극곰', hp: 110, dmg: 9, speed: 3.4, scale: 1.22,
        color: 0xeef4fa, shade: 0xd0ddea, meat: 4, xp: 12, depth: 0 },
      { id: 1, name: '회색곰', hp: 280, dmg: 17, speed: 3.9, scale: 1.55,
        color: 0xb2a894, shade: 0x8d8375, meat: 7, xp: 30, depth: 62 },
      { id: 2, name: '흑곰 대장', hp: 640, dmg: 27, speed: 4.2, scale: 1.95,
        color: 0x4e4a55, shade: 0x38343f, meat: 12, xp: 70, depth: 96 },
    ],
  },

  goods: { woodPrice: 14, meatPrice: 24 },
  grill: { cookTime: 0.6, queueMax: 30 },
  stall: { stockMax: 60, depositRate: 0.09 },
  buyer: { interval: 4.5, maxQueue: 4, wantMin: 2, wantMax: 5, speed: 2.4, serveTime: 0.9 },
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
