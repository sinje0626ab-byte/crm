// 씬, 카메라, 조명, 눈 지형, 침엽수 숲, 캠프 바닥/울타리를 만든다.
import * as THREE from 'three';
import { CFG, COLORS } from './config.js';
import { mat, makeFence, makeLogStack } from './entities.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9ecfb);
  scene.fog = new THREE.Fog(0xd9ecfb, 70, 135);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
  const camOffset = new THREE.Vector3(-3, 20.5, 17); // 광고와 비슷한 비스듬한 부감 시점

  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0xb9cfe4, 1.15));

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  const SHADOW_SPAN = 26;
  sun.shadow.camera.left = -SHADOW_SPAN;
  sun.shadow.camera.right = SHADOW_SPAN;
  sun.shadow.camera.top = SHADOW_SPAN;
  sun.shadow.camera.bottom = -SHADOW_SPAN;
  sun.shadow.bias = -0.0012;
  scene.add(sun, sun.target);

  /* 눈 지형: 살짝 울퉁불퉁하게 만들어 플랫셰이딩 면이 보이도록 한다 */
  const size = CFG.world.groundSize;
  const groundGeo = new THREE.PlaneGeometry(size, size, 44, 44);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const bump = Math.sin(x * 0.13) * Math.cos(y * 0.11) * 0.45 + (Math.random() - 0.5) * 0.25;
    pos.setZ(i, bump);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, mat(COLORS.snow));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* 캠프 바닥 */
  const b = CFG.world.base;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.35, b.d), mat(COLORS.ground));
  floor.position.set(b.x, 0.18, b.z);
  floor.receiveShadow = true;
  scene.add(floor);

  const fence = makeFence(b.w + 0.3, b.d + 0.3, 1.1, 4.6);
  fence.position.set(b.x, 0.35, b.z);
  scene.add(fence);

  // 사냥터로 나가는 오른쪽 통로(울타리 일부를 문으로 대체)
  const gateGeo = new THREE.BoxGeometry(0.3, 1.5, 4.4);
  for (const z of [-6.2, 6.2]) {
    const gate = new THREE.Mesh(gateGeo, mat(COLORS.wood));
    gate.position.set(b.x + b.w / 2, 0.9, b.z + z);
    gate.castShadow = true;
    scene.add(gate);
  }

  const logs = makeLogStack();
  logs.position.set(b.x - 4, 0.35, b.z - 8);
  scene.add(logs);

  /* 침엽수 숲: 인스턴싱으로 한 번에 그린다 */
  const inBase = (x, z) =>
    Math.abs(x - b.x) < b.w / 2 + 3 && Math.abs(z - b.z) < b.d / 2 + 3;
  const f = CFG.world.field;
  const inField = (x, z) => x > f.x0 - 4 && x < f.x1 + 4 && z > f.z0 - 4 && z < f.z1 + 4;

  const spots = [];
  let guard = 0;
  while (spots.length < CFG.world.treeCount && guard++ < 8000) {
    const x = (Math.random() - 0.5) * (size - 12);
    const z = (Math.random() - 0.5) * (size - 12);
    if (inBase(x, z) || inField(x, z)) continue;
    spots.push({ x, z, s: 0.75 + Math.random() * 0.9, r: Math.random() * Math.PI });
  }

  const coneGeo = new THREE.ConeGeometry(1.35, 3.6, 6);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.1, 5);
  const cones = new THREE.InstancedMesh(coneGeo, mat(COLORS.pine), spots.length);
  const conesTop = new THREE.InstancedMesh(coneGeo, mat(COLORS.pineDark), spots.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(COLORS.trunk), spots.length);
  cones.castShadow = true;
  conesTop.castShadow = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  spots.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r);
    v.set(p.x, 0.55 + 1.8 * p.s, p.z);
    sc.set(p.s, p.s, p.s);
    cones.setMatrixAt(i, m4.compose(v, q, sc));
    v.set(p.x, 0.55 + 3.1 * p.s, p.z);
    sc.setScalar(p.s * 0.68);
    conesTop.setMatrixAt(i, m4.compose(v, q, sc));
    v.set(p.x, 0.55, p.z);
    sc.setScalar(p.s);
    trunks.setMatrixAt(i, m4.compose(v, q, sc));
  });
  scene.add(cones, conesTop, trunks);

  /* 사냥터 장식: 눈더미와 바위 */
  const driftGeo = new THREE.SphereGeometry(1, 8, 4);
  const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
  for (let i = 0; i < 26; i++) {
    const x = f.x0 - 2 + Math.random() * (f.x1 - f.x0 + 4);
    const z = f.z0 - 2 + Math.random() * (f.z1 - f.z0 + 4);
    if (Math.random() < 0.72) {
      const drift = new THREE.Mesh(driftGeo, mat(0xe9f2fc));
      drift.scale.set(1.3 + Math.random() * 1.7, 0.72 + Math.random() * 0.5, 1.3 + Math.random() * 1.5);
      drift.position.set(x, -0.35, z);
      drift.receiveShadow = true;
      scene.add(drift);
    } else {
      const rock = new THREE.Mesh(rockGeo, mat(0xa8b6c4));
      rock.scale.setScalar(0.6 + Math.random() * 0.9);
      rock.position.set(x, 0.3, z);
      rock.castShadow = true;
      scene.add(rock);
    }
  }

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const camTarget = new THREE.Vector3();
  function updateCamera(focus, dt) {
    // 부드럽게 따라가되 사냥터 쪽을 조금 더 보여준다.
    camTarget.set(focus.x + 2, 0, focus.z);
    const desired = camTarget.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.0016, dt));
    camera.lookAt(camTarget.x, 1.2, camTarget.z);

    sun.position.set(focus.x + 24, 40, focus.z + 18);
    sun.target.position.set(focus.x, 0, focus.z);
    sun.target.updateMatrixWorld();
  }

  return { renderer, scene, camera, updateCamera, ground };
}
