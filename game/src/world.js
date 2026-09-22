// 씬, 카메라, 조명, 눈 지형, 숲, 정착지 배치, 눈발 파티클.
import * as THREE from 'three';
import { CFG, COLORS } from './config.js';
import {
  mat, makeFence, makeLogStack, makeHut, makeTent, makeTorch, makeBarrel, makeStars, makeCampHouse,
} from './entities.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbdd2e4);
  scene.fog = new THREE.Fog(0xbdd2e4, 58, 140);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 320);
  const camOffset = new THREE.Vector3(-3, 20.5, 17);

  // 차가운 하늘빛 + 낮게 깔린 따뜻한 태양(설원의 해질녘 느낌)
  const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x7e93aa, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe7cf, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 95;
  const SPAN = 28;
  Object.assign(sun.shadow.camera, { left: -SPAN, right: SPAN, top: SPAN, bottom: -SPAN });
  sun.shadow.bias = -0.0013;
  scene.add(sun, sun.target);

  /* ------------------------------------------------------------- 눈 지형 */
  const size = CFG.world.groundSize;
  const groundGeo = new THREE.PlaneGeometry(size, size, 48, 48);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.12) * Math.cos(y * 0.1) * 0.5 + (Math.random() - 0.5) * 0.3);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, mat(COLORS.snow));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ----------------------------------------------------------- 정착지 */
  const c = CFG.world.camp;
  const camp = new THREE.Group();
  camp.position.set(c.x, 0, c.z);
  scene.add(camp);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.35, c.d), mat(0x6f6455));
  floor.position.y = 0.18;
  floor.receiveShadow = true;
  camp.add(floor);

  // 다져진 눈길 느낌의 안쪽 바닥
  const inner = new THREE.Mesh(new THREE.BoxGeometry(c.w - 3, 0.36, c.d - 3), mat(0x8a7c69));
  inner.position.y = 0.19;
  inner.receiveShadow = true;
  camp.add(inner);

  const fence = makeFence(c.w + 0.3, c.d + 0.3, 1.2, 5);
  camp.add(fence);

  // 밖에서 보면 지붕까지 얹힌 집, 안에 들어가면 사라져 내부가 보인다
  const house = makeCampHouse(c.w, c.d, 5);
  house.position.y = 0.35;
  camp.add(house);

  // 정착지는 밤에도 환하게: 캠프 전체를 덮는 따뜻한 조명 하나
  // r155+ 의 점광원은 거리제곱으로 감쇠한다. 13m 위에서 캠프를 덮으려면
  // 세기를 그만큼 크게 잡아야 한다(decay 1 로 완만하게).
  const campLight = new THREE.PointLight(0xffd6a0, 0, 58, 1);
  campLight.position.set(0, 13, 0);
  camp.add(campLight);

  const gateGeo = new THREE.BoxGeometry(0.35, 1.9, 4.6);
  for (const z of [-7, 7]) {
    const gate = new THREE.Mesh(gateGeo, mat(COLORS.woodDark));
    gate.position.set(c.w / 2, 1.05, z);
    gate.castShadow = true;
    camp.add(gate);
  }

  // 캠프 안 소품(정착지처럼 보이게)
  const deco = [
    [makeHut(4.4, 3.6, 2.3), -13.5, -11.5, 0.3],
    [makeHut(3.8, 3.2, 2.1), -14.5, 10.5, -0.2],
    [makeTent(), -6, -12.5, 0],
    [makeTent(), 2.5, 12.5, 0],
    [makeLogStack(3, 4), -11, 3.5, 0.4],
    [makeBarrel(), 6, -3.5, 0],
    [makeBarrel(), 7, -4.6, 0],
    [makeTorch(true), -16.5, -14.5, 0],
    [makeTorch(true), 16.5, 14.5, 0],
    [makeTorch(false), -16.5, 14.5, 0],
    [makeTorch(false), 16.5, -14.5, 0],
  ];
  const flames = [];
  const torchLights = [];
  for (const [obj, x, z, ry] of deco) {
    obj.position.set(x, 0.35, z);
    obj.rotation.y = ry;
    camp.add(obj);
    if (obj.userData.flame) flames.push(obj.userData.flame);
    if (obj.userData.light) {
      obj.userData.light.intensity = 0;
      torchLights.push(obj.userData.light);
    }
  }

  /* --------------------------------------------------------------- 숲 */
  const inCamp = (x, z) =>
    Math.abs(x - c.x) < c.w / 2 + 3.5 && Math.abs(z - c.z) < c.d / 2 + 3.5;
  const f = CFG.world.field;
  const fo = CFG.world.forest;
  const inRect = (r, x, z, m = 4) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;

  const spots = [];
  let guard = 0;
  while (spots.length < CFG.world.sceneryTrees && guard++ < 12000) {
    const x = (Math.random() - 0.5) * (size - 14);
    const z = (Math.random() - 0.5) * (size - 14);
    if (inCamp(x, z) || inRect(f, x, z) || inRect(fo, x, z)) continue;
    spots.push({ x, z, s: 0.8 + Math.random() * 1.0, r: Math.random() * Math.PI });
  }

  const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 7);
  const capGeo = new THREE.ConeGeometry(1.2, 1.5, 7);
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.3, 1.2, 5);
  const lower = new THREE.InstancedMesh(coneGeo, mat(COLORS.pineDeep), spots.length);
  const upper = new THREE.InstancedMesh(coneGeo, mat(COLORS.pine), spots.length);
  const caps = new THREE.InstancedMesh(capGeo, mat(COLORS.pineSnow), spots.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(COLORS.trunk), spots.length);
  lower.castShadow = true;
  upper.castShadow = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  spots.forEach((p, i) => {
    q.setFromAxisAngle(up, p.r);
    const put = (im, y, s) => {
      v.set(p.x, y, p.z);
      sc.setScalar(s);
      im.setMatrixAt(i, m4.compose(v, q, sc));
    };
    put(trunks, 0.6, p.s);
    put(lower, 0.6 + 1.7 * p.s, p.s);
    put(upper, 0.6 + 3.0 * p.s, p.s * 0.72);
    put(caps, 0.6 + 4.1 * p.s, p.s * 0.8);
  });
  scene.add(lower, upper, caps, trunks);

  /* ------------------------------------------------- 사냥터 눈더미와 바위 */
  const driftGeo = new THREE.SphereGeometry(1, 8, 4);
  const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
  for (let i = 0; i < 40; i++) {
    const r = i % 2 ? f : fo;
    const x = r.x0 - 2 + Math.random() * (r.x1 - r.x0 + 4);
    const z = r.z0 - 2 + Math.random() * (r.z1 - r.z0 + 4);
    if (Math.random() < 0.7) {
      const drift = new THREE.Mesh(driftGeo, mat(0xdfeaf6));
      drift.scale.set(1.3 + Math.random() * 1.7, 0.7 + Math.random() * 0.5, 1.3 + Math.random() * 1.5);
      drift.position.set(x, -0.35, z);
      drift.receiveShadow = true;
      scene.add(drift);
    } else {
      const rock = new THREE.Mesh(rockGeo, mat(0x95a3b2));
      rock.scale.setScalar(0.6 + Math.random() * 0.9);
      rock.position.set(x, 0.3, z);
      rock.castShadow = true;
      scene.add(rock);
    }
  }

  /* ----------------------------------------------------------- 밤하늘 */
  const stars = makeStars();
  scene.add(stars);

  /* ----------------------------------------------------------- 눈발 */
  const FLAKES = 520;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(FLAKES * 3);
  const snowVel = new Float32Array(FLAKES);
  const AREA = 70;
  for (let i = 0; i < FLAKES; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * AREA;
    snowPos[i * 3 + 1] = Math.random() * 26;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * AREA;
    snowVel[i] = 1.6 + Math.random() * 2.4;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowfall = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.17, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  snowfall.frustumCulled = false;
  scene.add(snowfall);

  function updateSnow(dt, focus, time) {
    const a = snowGeo.attributes.position.array;
    for (let i = 0; i < FLAKES; i++) {
      const j = i * 3;
      a[j + 1] -= snowVel[i] * dt;
      a[j] += Math.sin(time * 0.6 + i) * 0.35 * dt;
      if (a[j + 1] < 0) {
        a[j] = focus.x + (Math.random() - 0.5) * AREA;
        a[j + 1] = 24 + Math.random() * 4;
        a[j + 2] = focus.z + (Math.random() - 0.5) * AREA;
      }
    }
    snowGeo.attributes.position.needsUpdate = true;
  }

  /* ---------------------------------------------------------- 카메라 */
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  /* ------------------------------------------------------- 낮 / 밤 */
  const DAY_SKY = new THREE.Color(0xbdd2e4);
  const NIGHT_SKY = new THREE.Color(0x172336);
  const DAY_SUN = new THREE.Color(0xffe7cf);
  const NIGHT_SUN = new THREE.Color(0x9db4da);
  const DAY_HEMI = new THREE.Color(0xcfe0f0);
  const NIGHT_HEMI = new THREE.Color(0x3f5270);
  const DAY_GROUND = new THREE.Color(0x7e93aa);
  const NIGHT_GROUND = new THREE.Color(0x2b3950);
  const skyColor = new THREE.Color();

  // light = 1 이면 한낮, 0 이면 한밤
  function setDaylight(light) {
    const l = Math.max(0, Math.min(1, light));
    sun.intensity = 0.2 + 1.3 * l;
    sun.color.copy(NIGHT_SUN).lerp(DAY_SUN, l);
    hemi.intensity = 0.3 + 0.55 * l;
    hemi.color.copy(NIGHT_HEMI).lerp(DAY_HEMI, l);
    hemi.groundColor.copy(NIGHT_GROUND).lerp(DAY_GROUND, l);

    skyColor.copy(NIGHT_SKY).lerp(DAY_SKY, l);
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor);
    scene.fog.near = 40 + 18 * l;
    scene.fog.far = 95 + 45 * l;

    stars.material.opacity = Math.pow(1 - l, 1.5) * 0.9;
    const glow = Math.pow(1 - l, 1.1);
    for (const m of house.userData.windows) m.emissiveIntensity = glow * 1.6;
    const dark = Math.pow(1 - l, 1.2);
    for (const t of torchLights) t.intensity = dark * 7;
    campLight.intensity = dark * 30;
  }
  setDaylight(1);

  /* --------------------------------------------------- 집 껍데기 전환 */
  const EAVE = 2.4;
  const houseBox = {
    x0: c.x - c.w / 2 - EAVE, x1: c.x + c.w / 2 + EAVE,
    z0: c.z - c.d / 2 - EAVE, z1: c.z + c.d / 2 + EAVE,
    top: 11.2,
  };

  // 카메라와 플레이어 사이를 집이 가로막는지(집 북쪽에 서면 지붕에 가린다)
  function blocksView(px, pz) {
    const cx = px + camOffset.x;
    const cy = camOffset.y;
    const cz = pz + camOffset.z;
    for (let i = 1; i <= 8; i++) {
      const t = i / 9;
      const y = cy + (1.2 - cy) * t;
      if (y > houseBox.top || y < 0.4) continue;
      const x = cx + (px - cx) * t;
      const z = cz + (pz - cz) * t;
      if (x > houseBox.x0 && x < houseBox.x1 && z > houseBox.z0 && z < houseBox.z1) return true;
    }
    return false;
  }

  let houseShown = 1;
  // 1 = 집(벽·지붕) 보임, 0 = 내부가 드러남
  function updateHouse(px, pz, inside, dt) {
    const target = inside || blocksView(px, pz) ? 0 : 1;
    const k = dt ? 1 - Math.pow(0.0008, dt) : 1;
    houseShown += (target - houseShown) * k;
    if (Math.abs(target - houseShown) < 0.01) houseShown = target;

    house.visible = houseShown > 0.02;
    for (const m of house.userData.mats) m.opacity = houseShown;
    fence.visible = houseShown < 0.98;
    house.traverse((o) => { if (o.isMesh) o.castShadow = houseShown > 0.6; });
  }
  updateHouse(0, 60, false, 0);

  /* ------------------------------------------------------------ 카메라 */
  let shakeMag = 0;
  function shake(amount) {
    shakeMag = Math.min(0.8, shakeMag + amount);
  }

  const camTarget = new THREE.Vector3();
  function updateCamera(focus, dt) {
    camTarget.set(focus.x + 2, 0, focus.z);
    const desired = camTarget.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.0016, dt));
    if (shakeMag > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeMag;
      camera.position.y += (Math.random() - 0.5) * shakeMag;
      camera.position.z += (Math.random() - 0.5) * shakeMag;
      shakeMag *= Math.pow(0.02, dt);
    }
    camera.lookAt(camTarget.x, 1.2, camTarget.z);
    sun.position.set(focus.x + 26, 34, focus.z + 20);
    sun.target.position.set(focus.x, 0, focus.z);
    sun.target.updateMatrixWorld();
    stars.position.set(focus.x, 0, focus.z);
  }

  function tickAmbient(dt, time) {
    for (const fl of flames) {
      fl.scale.setScalar(0.85 + Math.sin(time * 9 + fl.id) * 0.15);
    }
  }

  return {
    renderer, scene, camera, camp, updateCamera, updateSnow, tickAmbient,
    setDaylight, shake, updateHouse,
  };
}
