// 씬·카메라·지형. 광고처럼 가까운 쿼터뷰로 마당 전체가 들어오게 잡는다.
import * as THREE from 'three';
import { CFG, C } from './config.js';
import { mat, makeFence, makeGate, makeTree, makeRock } from './art.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfeaf6);
  scene.fog = new THREE.Fog(0xdfeaf6, 46, 96);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 240);
  const camOffset = new THREE.Vector3(0, 18, 15.5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc3d6e6, 1.05));
  const sun = new THREE.DirectionalLight(0xfff2de, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  const SPAN = 24;
  Object.assign(sun.shadow.camera, { left: -SPAN, right: SPAN, top: SPAN, bottom: -SPAN });
  sun.shadow.bias = -0.0012;
  scene.add(sun, sun.target);

  /* --------------------------------------------------------- 눈 벌판 */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 1, 1), mat(C.snow));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ------------------------------------------------------ 마당(흙바닥) */
  const c = CFG.camp;
  const w = c.x1 - c.x0;
  const d = c.z1 - c.z0;
  const cx = (c.x0 + c.x1) / 2;
  const cz = (c.z0 + c.z1) / 2;

  const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.4, d + 1.4), mat(C.dirtEdge));
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(cx, 0.012, cz);
  edge.receiveShadow = true;
  scene.add(edge);

  const yard = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(C.dirt));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(cx, 0.02, cz);
  yard.receiveShadow = true;
  scene.add(yard);

  /* ----------------------------------------------------------- 울타리 */
  const gaps = [
    { axis: 'x', side: 'z0', at: CFG.gate.x, half: CFG.gate.half },
    { axis: 'x', side: 'z1', at: CFG.queueGap.x, half: CFG.queueGap.half },
  ];
  scene.add(makeFence(c.x0, c.x1, c.z0, c.z1, gaps));

  // 사냥터로 나가는 문(양쪽 문짝)
  for (const dir of [-1, 1]) {
    const gate = makeGate(2.6);
    gate.position.set(CFG.gate.x + dir * (CFG.gate.half + 1.3), 0, c.z0);
    scene.add(gate);
  }

  /* ------------------------------------------------------- 주변 장식 */
  const deco = new THREE.Group();
  const inCamp = (x, z) => x > c.x0 - 3 && x < c.x1 + 3 && z > c.z0 - 3 && z < c.z1 + 3;
  const h = CFG.hunt;
  const inHunt = (x, z) => x > h.x0 - 3 && x < h.x1 + 3 && z > h.z0 - 3 && z < h.z1 + 3;
  let guard = 0;
  let placed = 0;
  while (placed < 90 && guard++ < 3000) {
    const x = (Math.random() - 0.5) * 120;
    const z = (Math.random() - 0.5) * 120;
    if (inCamp(x, z) || inHunt(x, z)) continue;
    if (Math.abs(x) < 20 && z > c.z1 && z < CFG.customer.spawnZ + 6) continue;  // 손님 통로는 비운다
    const obj = Math.random() < 0.78 ? makeTree(0.9 + Math.random() * 0.8) : makeRock(0.7 + Math.random() * 0.8);
    obj.position.set(x, 0, z);
    obj.rotation.y = Math.random() * Math.PI;
    deco.add(obj);
    placed++;
  }
  // 사냥터 가장자리 바위 몇 개
  for (let i = 0; i < 10; i++) {
    const rock = makeRock(0.6 + Math.random() * 0.7);
    rock.position.set(h.x0 + Math.random() * (h.x1 - h.x0), 0, h.z0 + Math.random() * (h.z1 - h.z0));
    deco.add(rock);
  }
  scene.add(deco);

  /* ------------------------------------------------------------- 눈발 */
  const FLAKES = 420;
  const snowGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(FLAKES * 3);
  const vel = new Float32Array(FLAKES);
  const AREA = 54;
  for (let i = 0; i < FLAKES; i++) {
    pos[i * 3] = (Math.random() - 0.5) * AREA;
    pos[i * 3 + 1] = Math.random() * 20;
    pos[i * 3 + 2] = (Math.random() - 0.5) * AREA;
    vel[i] = 1.4 + Math.random() * 2;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snowfall = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  snowfall.frustumCulled = false;
  scene.add(snowfall);

  function updateSnow(dt, focus, time) {
    const a = snowGeo.attributes.position.array;
    for (let i = 0; i < FLAKES; i++) {
      const j = i * 3;
      a[j + 1] -= vel[i] * dt;
      a[j] += Math.sin(time * 0.7 + i) * 0.3 * dt;
      if (a[j + 1] < 0) {
        a[j] = focus.x + (Math.random() - 0.5) * AREA;
        a[j + 1] = 18 + Math.random() * 4;
        a[j + 2] = focus.z + (Math.random() - 0.5) * AREA;
      }
    }
    snowGeo.attributes.position.needsUpdate = true;
  }

  /* ---------------------------------------------------------- 카메라 */
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let shakeMag = 0;
  const shake = (v) => { shakeMag = Math.min(0.6, shakeMag + v); };

  const target = new THREE.Vector3();
  function updateCamera(focus, dt) {
    // 마당을 크게 벗어나지 않도록 시점을 살짝 묶어둔다
    target.set(
      THREE.MathUtils.clamp(focus.x, c.x0 - 3, c.x1 + 3),
      0,
      THREE.MathUtils.clamp(focus.z, h.z0 + 6, c.z1 + 5),
    );
    const desired = target.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.002, dt));
    if (shakeMag > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeMag;
      camera.position.y += (Math.random() - 0.5) * shakeMag;
      shakeMag *= Math.pow(0.02, dt);
    }
    camera.lookAt(target.x, 1.0, target.z);
    sun.position.set(target.x + 16, 26, target.z + 14);
    sun.target.position.set(target.x, 0, target.z);
    sun.target.updateMatrixWorld();
  }

  return { renderer, scene, camera, updateCamera, updateSnow, shake };
}
