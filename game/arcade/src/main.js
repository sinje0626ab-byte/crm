// 아케이드 타이쿤 — 사냥 → 조리 → 배식 → 수금 → 해금 루프를 엮는다.
import * as THREE from 'three';
import { CFG } from './config.js';
import { Audio } from '../../src/audio.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createMenu } from './menu.js';
import { createDrops } from './drops.js';
import { createBears } from './bears.js';
import { createGrill, createTable } from './stations.js';
import { createZones } from './zones.js';
import { createCustomers } from './customers.js';
import { createWorkers } from './workers.js';
import { createPlayer } from './player.js';
import { loadSave, writeSave, clearSave } from './save.js';

const world = createWorld(document.getElementById('scene'));
const { scene, camera, renderer } = world;
const hud = createHud();
const input = createInput(
  document.getElementById('surface'),
  document.getElementById('joy'),
  document.getElementById('joy-knob'),
);

const S = { running: false, time: 0, priceLv: 0, served: 0, autosave: 12 };
const price = () => CFG.table.price + CFG.table.pricePerLevel * S.priceLv;

/* ------------------------------------------------------------- 구성 요소 */
const drops = createDrops(scene);
const bears = createBears(scene, camera, (x, z) => drops.spawn('meat', x, z));
const grill = createGrill(scene, -6, -2);
const table = createTable(scene, CFG.queueGap.x, CFG.camp.z1 - 4);

const audio = {
  swing: () => Audio.S.swing(),
  hit: () => Audio.S.bearHit(),
  stackUp: () => Audio.S.stackUp(),
  unload: () => Audio.S.unload(),
  coin: () => Audio.S.coin(),
  full: () => Audio.S.full(),
};

const ctx = { drops, bears, grill, table, audio, world };
const workers = createWorkers(scene, ctx);
const player = createPlayer(scene, ctx);

const customers = createCustomers(scene, table, drops, () => {
  S.served++;
  Audio.S.register();
});

const zones = createZones(scene, (z) => applyZone(z, false));

/* ------------------------------------------------------------ 해금 효과 */
function applyZone(z, silent) {
  if (z.id === 'hunter') workers.hire('hunter');
  else if (z.id === 'cook') workers.hire('cook');
  else if (z.id === 'server') workers.hire('server');
  else if (z.id === 'speed') player.speedLv++;
  else if (z.id === 'bag') player.bagLv++;
  else if (z.id === 'price') S.priceLv++;

  if (!silent) {
    Audio.S.unlock();
    world.shake(0.25);
    hud.toast(`${z.label} 해금! (Lv.${z.level})`);
  }
}

/* -------------------------------------------------------------- 안내문 */
function hintText() {
  const st = player.stack;
  if (st.type === 'cash') return '바닥의 원형 구역에 올라서면 해금됩니다';
  if (st.type === 'meat') return '그릴에 고기를 내려놓으세요';
  if (st.type === 'plate') return '배식대에 접시를 올려놓으세요';
  if (drops.list.some((d) => d.kind === 'cash')) return '떨어진 지폐를 주우세요';
  if (grill.output.length > 0) return '구운 접시를 배식대로 옮기세요';
  if (drops.list.some((d) => d.kind === 'meat')) return '떨어진 고기를 주우세요';
  return '위쪽 문으로 나가 곰을 사냥하세요';
}

/* ------------------------------------------------------------ 저장/초기화 */
function snapshot() {
  return {
    zones: zones.snapshot(),
    priceLv: S.priceLv,
    served: S.served,
    grill: { queue: grill.queue, output: grill.output.length },
    table: table.count,
  };
}
const saveGame = () => writeSave(snapshot());

function resetGame() {
  drops.list.slice().forEach((d) => drops.remove(d));
  bears.list.slice().forEach((b) => scene.remove(b.mesh));
  bears.list.length = 0;
  customers.clear();
  workers.clear();
  zones.reset();
  player.stack.clear();
  player.speedLv = 0;
  player.bagLv = 0;
  player.mesh.position.set(0, 0, 4);
  grill.queue = 0;
  while (grill.output.length) grill.takePlate();
  while (table.count) table.take();
  S.priceLv = 0;
  S.served = 0;
  S.time = 0;
  for (let i = 0; i < 4; i++) bears.spawn();
  hud.setMoney(0);
  hud.setCarry(null, 0, player.capacity());
}

function applySave(data) {
  if (!data) return;
  S.priceLv = data.priceLv || 0;
  S.served = data.served || 0;
  zones.restore(data.zones, applyZone);
  grill.accept(data.grill?.queue || 0);
  for (let i = 0; i < (data.table || 0); i++) table.add();
}

/* ---------------------------------------------------------------- 루프 */
let last = performance.now();
let hintTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.running) {
    S.time += dt;
    Audio.frameReset();

    player.update(dt, S.time, input.read());
    bears.update(dt, S.time);
    drops.update(dt, S.time);
    grill.update(dt, S.time);
    customers.update(dt, S.time, camera, price());
    workers.update(dt, S.time);
    zones.update(dt, player.mesh, player.stack, CFG.bill, () => hud.bump());

    const cash = player.stack.type === 'cash' ? player.stack.count * CFG.bill : 0;
    hud.setMoney(cash);
    hud.setCarry(player.stack.type, player.stack.count, player.capacity());
    hud.tick(dt);

    hintTimer -= dt;
    if (hintTimer <= 0) {
      hintTimer = 0.5;
      hud.hint(hintText());
    }
    S.autosave -= dt;
    if (S.autosave <= 0) {
      S.autosave = 12;
      saveGame();
    }
  }

  world.updateSnow(dt, player.mesh.position, S.time);
  world.updateCamera(player.mesh.position, S.running ? dt : dt * 0.5);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- 시작 */
createMenu({
  onNew() {
    clearSave();
    resetGame();
    S.running = true;
    hud.toast('위쪽 문으로 나가 곰을 사냥하세요');
  },
  onContinue() {
    resetGame();
    applySave(loadSave());
    S.running = true;
  },
  onPause() { S.running = false; },
  onResume() { S.running = true; },
  onSave() { return saveGame(); },
  onQuit() { S.running = false; },
});

// 디버그 훅(콘솔·자동 테스트용)
window.__game = {
  S, CFG, scene, camera, renderer, player, bears, drops, grill, table,
  zones, customers, workers, price, snapshot, saveGame, Audio,
};

hud.setMoney(0);
hud.setCarry(null, 0, player.capacity());
for (let i = 0; i < 4; i++) bears.spawn();
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(frame);
