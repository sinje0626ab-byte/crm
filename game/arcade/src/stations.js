// 조리대(그릴)와 배식대(테이블).
import * as THREE from 'three';
import { CFG, C } from './config.js';
import { makeGrill, makeTable, makePlate, makeMeat } from './art.js';

/* -------------------------------------------------------------- 조리대 */
export function createGrill(scene, x, z) {
  const mesh = makeGrill();
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const state = {
    x, z, mesh,
    queue: 0,          // 구워야 할 생고기
    timer: 0,
    output: [],        // 완성된 접시 더미
    cookers: 0,        // 조리사 수(굽는 속도)
  };

  const pile = new THREE.Group();
  pile.position.set(x + 1.9, 0, z);
  scene.add(pile);
  state.pileAt = { x: x + 1.9, z };

  state.accept = (n = 1) => {
    const room = CFG.grill.queueMax - state.queue;
    const take = Math.min(room, n);
    state.queue += take;
    return take;
  };

  state.takePlate = () => {
    const m = state.output.pop();
    if (!m) return false;
    pile.remove(m);
    return true;
  };

  state.update = (dt, time) => {
    // 굽는 중인 고기(그릴 위 시각 표현)
    const cooking = mesh.userData.cooking;
    const want = Math.min(4, state.queue);
    while (cooking.children.length > want) cooking.remove(cooking.children[cooking.children.length - 1]);
    while (cooking.children.length < want) {
      const m = makeMeat();
      m.scale.setScalar(0.8);
      m.position.set(-0.75 + cooking.children.length * 0.5, 0, 0);
      cooking.add(m);
    }

    const hot = state.queue > 0;
    mesh.userData.fire.visible = hot;
    if (hot) mesh.userData.fire.scale.setScalar(0.8 + Math.sin(time * 14) * 0.2);
    mesh.userData.glow.intensity = hot ? 8 + Math.sin(time * 12) * 2 : 3;

    if (state.queue > 0 && state.output.length < CFG.grill.outputMax) {
      state.timer -= dt * (1 + state.cookers * 0.85);
      if (state.timer <= 0) {
        state.timer = CFG.grill.cookTime;
        state.queue--;
        const plate = makePlate();
        plate.position.y = state.output.length * 0.14;
        plate.rotation.y = Math.random() * 0.4;
        pile.add(plate);
        state.output.push(plate);
        return true;            // 한 접시 완성
      }
    }
    return false;
  };

  return state;
}

/* ------------------------------------------------------------ 배식대 */
export function createTable(scene, x, z) {
  const mesh = makeTable(CFG.table.slots);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const plates = [];
  const slotsGroup = mesh.userData.slots;
  const width = mesh.userData.width;

  const state = {
    x, z, mesh, plates,
    get count() { return plates.length; },
    full: () => plates.length >= CFG.table.slots,
    add() {
      if (plates.length >= CFG.table.slots) return false;
      const plate = makePlate();
      plate.position.set(-width / 2 + 1.0 + plates.length * 0.85, 0, -0.1);
      slotsGroup.add(plate);
      plates.push(plate);
      return true;
    },
    take() {
      const p = plates.pop();
      if (!p) return false;
      slotsGroup.remove(p);
      // 남은 접시를 앞으로 당겨 정리
      plates.forEach((pl, i) => { pl.position.x = -width / 2 + 1.0 + i * 0.85; });
      return true;
    },
  };
  return state;
}
