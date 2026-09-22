// 아케이드 타이쿤 밸런스/배치 상수.
export const CFG = {
  camp: { x0: -11, x1: 11, z0: -9, z1: 11 },     // 울타리 안 마당
  hunt: { x0: -13, x1: 13, z0: -30, z1: -13 },   // 북쪽 사냥터
  gate: { x: 0, half: 3 },                        // 사냥터로 나가는 문(위쪽)
  queueGap: { x: 1.5, half: 2.6 },                // 손님이 들어오는 아래쪽 통로

  player: { speed: 6.6, speedPerLevel: 0.9, capacity: 8, capPerLevel: 4, pickRadius: 1.5 },
  attack: { range: 2.6, cd: 0.62, damage: 26, damagePerLevel: 10 },

  bear: { hp: 80, meat: 3, maxAlive: 7, spawnCd: 2.4, wanderCd: 3 },

  grill: { cookTime: 1.6, queueMax: 12, outputMax: 10 },
  table: { slots: 6, price: 20, pricePerLevel: 10 },
  bill: 10,          // 지폐 한 장의 값

  customer: { interval: 3.4, maxQueue: 8, eatTime: 0.9, speed: 3.4, spawnZ: 24 },

  stack: { itemH: 0.3, wobble: 9, lean: 0.22 },

  worker: { speed: 4.2, carry: 5 },

  // 바닥에 그려지는 해금/업그레이드 원형 구역
  zones: [
    { id: 'hunter', x: -7.5, z: -5.5, price: 20, repeat: 3, mul: 2, label: '사냥꾼', icon: 'worker' },
    { id: 'cook', x: 7.5, z: -5.5, price: 60, repeat: 2, mul: 2.2, label: '조리사', icon: 'worker' },
    { id: 'server', x: 8.5, z: 5.5, price: 120, repeat: 2, mul: 2.2, label: '배식원', icon: 'worker' },
    { id: 'speed', x: -8.5, z: 5.5, price: 80, repeat: 4, mul: 1.7, label: '이동 속도', icon: 'boot' },
    { id: 'bag', x: -3.5, z: -7.5, price: 100, repeat: 4, mul: 1.8, label: '소지량', icon: 'bag' },
    { id: 'price', x: 3.5, z: -7.5, price: 150, repeat: 4, mul: 1.9, label: '고기 가격', icon: 'cash' },
  ],
};

export const C = {
  snow: 0xecf3fb, snowShade: 0xd3e3f2, ice: 0xbdd6ea,
  dirt: 0xd9a469, dirtEdge: 0xc08c52,
  plank: 0xd9a05e, plankDark: 0xb87a3c, plankTop: 0xf0c98a,
  fence: 0xf7f0e2, fenceTip: 0xffffff,
  gate: 0xb85c33, gateDark: 0x8f4526,
  coatRed: 0xd8503a, coatOrange: 0xe07a45, coatSand: 0xc9a06a, coatBrown: 0x9a6b4f,
  coatPlayer: 0x2f9fd6, coatPlayerDark: 0x1f78a8,
  fur: 0xfdf6ea, skin: 0xf2c79c, boots: 0x5a3b28,
  bear: 0xfbfdff, bearShade: 0xdfeaf5, bearNose: 0x3c3c44,
  meat: 0xd6453c, meatFat: 0xf6d2c0,
  plate: 0xfdf8ef, cooked: 0xa8402c,
  cash: 0x63d07f, cashDark: 0x2f9d52,
  metal: 0x4d525c, metalLight: 0x878e99, fire: 0xff9a2b, ember: 0xffce6b,
  wood: 0x8a5a33, zone: 0x3b3129, gold: 0xe8b23c,
  pine: 0x3f7f6b, pineSnow: 0xf2f8ff,
};
