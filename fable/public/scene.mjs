// Three.js dollhouse in a glass box. Rooms with furniture, Mina and Otto as figures driven by the world,
// lights, stove, tap, TV and door. Labels are DOM pills projected onto the scene.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const ROOMS = {
  bedroom: { x: [0, 4], z: [0, 4], floor: 0x8a684a, name: 'Bedroom' },
  bathroom: { x: [6, 10], z: [0, 4], floor: 0xa3b8c4, name: 'Bathroom' },
  living: { x: [0, 4], z: [4, 8], floor: 0x8a684a, name: 'Living room' },
  kitchen: { x: [6, 10], z: [4, 8], floor: 0xc7bfae, name: 'Kitchen' },
  hall: { x: [4, 6], z: [0, 8], floor: 0x7d7973, name: 'Hall' },
};
const SPOT = {
  mina: { bedroom: [1.2, 3.1], bathroom: [7.3, 2.4], living: [2.0, 5.0], kitchen: [7.6, 6.2], hall: [4.7, 6.4], outside: [16.5, 9.4] },
  otto: { bedroom: [2.9, 3.3], bathroom: [8.9, 3.4], living: [1.1, 7.0], kitchen: [8.8, 7.2], hall: [5.3, 2.6], outside: [16.5, 10.0] },
};
const DOORWAY = { bedroom: [4, 2.0], bathroom: [6, 2.0], living: [4, 6.0], kitchen: [6, 6.0] };
export const OBJ = { stove: [9.6, 1.35, 5.3], tap: [9.6, 1.35, 3.0], tv: [0.35, 1.5, 5.6], door: [5.0, 2.1, 8.0] };
const LIE = { mina: { bedroom: [0.85, 0.62, 2.15], living: [2.6, 0.62, 6.4] }, otto: { bedroom: [1.75, 0.62, 2.15], living: [2.6, 0.62, 6.4] } };
const LIE_ALONE = { bedroom: [1.3, 0.62, 2.15], living: [2.6, 0.62, 6.4] };
const HAIR = { mina: 0x3a2418, otto: 0x6b4a2c };
const COL = { mina: 0xd55181, otto: 0x3987e5, mind: 0xc49bff, wall: 0xefe9df, warm: 0xffd39a, water: 0x4aa3ff };
const KEYS = [
  [0, 0x070a14, 0x1a2340, 0x120f0c, 0x8fb0ff, 0.15, 0.35], [5, 0x0d1330, 0x2a3a6a, 0x1a1410, 0xffb070, 0.3, 0.5], [7, 0xf0a060, 0xffc9a0, 0x4a3a30, 0xffb070, 1.6, 0.9],
  [9, 0x8ec5ff, 0xbfe0ff, 0x5a4a40, 0xfff2e0, 2.6, 1.1], [16, 0x8ec5ff, 0xbfe0ff, 0x5a4a40, 0xfff2e0, 2.4, 1.1], [19, 0xd07050, 0xffb090, 0x3a2a28, 0xff9050, 1.0, 0.7],
  [21, 0x0d1330, 0x2a3a6a, 0x1a1410, 0x8fb0ff, 0.2, 0.4], [24, 0x070a14, 0x1a2340, 0x120f0c, 0x8fb0ff, 0.15, 0.35],
];
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: .05, ...o });
function box(w, h, d, m, x, y, z, shadow = true) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = shadow; b.receiveShadow = true; return b; }
function makePerson(color, hair) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.78, 10), mat(0x2c3e50)); legs.position.y = 0.39; legs.castShadow = true; g.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.46, 4, 12), mat(color, { roughness: .6 })); torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), mat(0xe0b89a)); head.position.y = 1.64; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hair)); cap.position.y = 1.66; g.add(cap);
  const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 })); badge.position.y = 2.0; g.add(badge); g.userData.badge = badge;
  return g;
}

export class Scene {
  constructor(canvas, labelLayer) {
    this.canvas = canvas; this.labelLayer = labelLayer;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0x0f141b, 24, 62);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(5.4, -1.0, 4.2); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.enablePan = false;
    this.controls.minDistance = 10; this.controls.maxDistance = 40; this.controls.minPolarAngle = 0.2; this.controls.maxPolarAngle = 1.3;
    this.setView('corner');
    this.labels = new Map(); this.labelsOn = true; this.hour = 7; this.people = {}; this.pose = { mina: 'stand', otto: 'stand' }; this.flags = { mina: {}, otto: {} }; this.state = null;
    this.buildStatic(); this.buildDynamic();
    addEventListener('resize', () => this.resize()); this.resize();
  }
  setView(name) { const looks = { corner: [18.2, 13.2, 19.0], top: [5.41, 27, 4.9], front: [5.4, 8.5, 25] }; const [x, y, z] = looks[name] || looks.corner; this.camera.position.set(x, y, z); this.controls.update(); }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  buildStatic() {
    const S = this.scene;
    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a4a40, 1.0); S.add(this.hemi);
    this.fill = new THREE.AmbientLight(0x6f7a99, 0.55); S.add(this.fill);
    this.sun = new THREE.DirectionalLight(0xfff2e0, 2.4); this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 90 }); this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0005; this.sun.target.position.set(5, 0, 4); S.add(this.sun, this.sun.target);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), mat(0x232a36, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(5, -0.22, 4); ground.receiveShadow = true; S.add(ground);
    S.add(box(20.4, 0.2, 12.2, mat(0x232b38, { roughness: .7 }), 6, -0.1, 4.1));
    S.add(box(17.6, 0.03, 1.6, mat(0x3a3f48), 7.4, 0.015, 9.3, false));
    for (const [id, r] of Object.entries(ROOMS)) {
      const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
      S.add(box(w, 0.06, d, mat(r.floor, { roughness: .9 }), (r.x[0] + r.x[1]) / 2, 0.03, (r.z[0] + r.z[1]) / 2, false));
      this.label(`room:${id}`, new THREE.Vector3((r.x[0] + r.x[1]) / 2, 0.08, id === 'hall' ? 1.0 : r.z[1] - 0.45), 'room', r.name);
    }
    const W = mat(COL.wall, { roughness: .95 });
    const wall = (x1, z1, x2, z2, h, t = 0.12) => { const len = Math.hypot(x2 - x1, z2 - z1); const m = box(len, h, t, W, (x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); S.add(m); };
    wall(0, 0, 10, 0, 1.0, 0.16); wall(0, 0, 0, 8, 1.0, 0.16); wall(10, 0, 10, 8, 1.0, 0.16); wall(0, 8, 4.5, 8, 0.6, 0.16); wall(5.5, 8, 10, 8, 0.6, 0.16);
    wall(4, 0, 4, 1.5, 0.9); wall(4, 2.5, 4, 5.5, 0.9); wall(4, 6.5, 4, 8, 0.9); wall(6, 0, 6, 1.5, 0.9); wall(6, 2.5, 6, 5.5, 0.9); wall(6, 6.5, 6, 8, 0.9); wall(0, 4, 4, 4, 0.9); wall(6, 4, 10, 4, 0.9);
    const gx = 11.6, gy = 3.3, gz = 9.6, cx = 5, cz = 4.0;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(gx, gy, gz)), new THREE.LineBasicMaterial({ color: 0x9fb4cc, transparent: true, opacity: .35 })); edges.position.set(cx, gy / 2, cz); S.add(edges);
    const gbox = new THREE.Mesh(new THREE.BoxGeometry(gx, gy, gz), new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: .05, roughness: .1, metalness: 0, side: THREE.DoubleSide, depthWrite: false })); gbox.position.set(cx, gy / 2, cz); S.add(gbox);
    const wood = mat(0x5b3e2a), white = mat(0xf4f1ea, { roughness: .6 }), dark = mat(0x2a2d33), fabric = mat(0x4b6d8f, { roughness: .95 }), steel = mat(0xb8bec6, { metalness: .6, roughness: .35 });
    // bedroom: a double bed
    S.add(box(1.9, 0.38, 2.1, wood, 1.3, 0.19, 1.4)); S.add(box(1.75, 0.16, 1.55, mat(0xe8e2d8), 1.3, 0.46, 1.68)); S.add(box(0.75, 0.12, 0.42, white, 0.9, 0.44, 0.6)); S.add(box(0.75, 0.12, 0.42, white, 1.7, 0.44, 0.6)); S.add(box(1.9, 0.5, 0.08, wood, 1.3, 0.45, 0.34));
    S.add(box(0.7, 1.7, 1.4, mat(0x6b4a33), 3.55, 0.85, 1.0)); S.add(box(0.45, 0.45, 0.45, wood, 2.55, 0.225, 0.5)); S.add(box(2.4, 0.02, 1.6, mat(0x5a4a6a), 1.6, 0.07, 3.0, false));
    // bathroom
    S.add(box(1.75, 0.55, 0.8, white, 8.8, 0.275, 0.65)); S.add(box(1.45, 0.02, 0.55, mat(0x7fb6e6, { roughness: .2 }), 8.8, 0.56, 0.65, false));
    S.add(box(0.42, 0.4, 0.6, white, 6.6, 0.2, 0.75)); S.add(box(0.42, 0.42, 0.18, white, 6.6, 0.6, 0.5));
    S.add(box(0.5, 0.85, 0.55, white, 9.65, 0.425, 3.0)); S.add(box(0.06, 0.16, 0.06, steel, 9.72, 0.93, 3.0)); S.add(box(0.22, 0.05, 0.05, steel, 9.62, 1.0, 3.0)); S.add(box(0.5, 0.02, 0.9, mat(0x2b6ea3), 7.5, 0.07, 3.0, false));
    // living: sofa, table with laptop, tv
    S.add(box(2.6, 0.02, 3.0, mat(0x4a3b3b), 1.9, 0.07, 5.8, false));
    S.add(box(0.9, 0.42, 2.0, fabric, 2.6, 0.21, 5.6)); S.add(box(0.22, 0.5, 2.0, fabric, 3.05, 0.65, 5.6)); S.add(box(0.9, 0.2, 0.2, fabric, 2.6, 0.52, 4.7)); S.add(box(0.9, 0.2, 0.2, fabric, 2.6, 0.52, 6.5));
    S.add(box(0.6, 0.34, 1.0, wood, 1.6, 0.17, 5.6)); S.add(box(0.9, 0.05, 0.6, wood, 1.4, 0.72, 7.3)); S.add(box(0.3, 0.02, 0.22, dark, 1.4, 0.75, 7.3, false)); S.add(box(0.28, 0.2, 0.02, mat(0x3d8bff, { emissive: 0x3d8bff, emissiveIntensity: .5 }), 1.4, 0.86, 7.2, false));
    S.add(box(0.5, 0.5, 1.5, dark, 0.45, 0.25, 5.6)); S.add(box(0.06, 0.72, 1.3, dark, 0.35, 0.95, 5.6));
    this.tvScreen = box(0.02, 0.62, 1.16, new THREE.MeshStandardMaterial({ color: 0x0a0f18, emissive: 0x3d8bff, emissiveIntensity: 0 }), 0.39, 0.95, 5.6, false); S.add(this.tvScreen);
    // kitchen
    S.add(box(0.6, 0.9, 3.5, mat(0xdcd6c8), 9.7, 0.45, 6.05)); S.add(box(0.62, 0.05, 3.52, mat(0x40464e, { roughness: .4 }), 9.7, 0.92, 6.05, false));
    S.add(box(0.7, 1.7, 0.7, white, 6.55, 0.85, 4.55)); S.add(box(0.5, 0.02, 0.5, mat(0x9aa2ab), 6.55, 1.71, 4.55, false));
    S.add(box(1.2, 0.06, 0.8, wood, 7.6, 0.72, 6.6)); for (const [dx, dz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) S.add(box(0.06, 0.7, 0.06, wood, 7.6 + dx, 0.35, 6.6 + dz, false));
    S.add(box(0.4, 0.45, 0.4, wood, 7.6, 0.225, 7.35)); S.add(box(0.4, 0.45, 0.4, wood, 7.6, 0.225, 5.85));
    S.add(box(0.56, 0.06, 0.62, dark, 9.7, 0.97, 5.3)); this.burners = [];
    for (const [dx, dz] of [[-0.14, -0.16], [0.14, -0.16], [-0.14, 0.16], [0.14, 0.16]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xff5a1a, emissiveIntensity: 0 })); b.position.set(9.7 + dx, 1.01, 5.3 + dz); S.add(b); this.burners.push(b); }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.14, 20), steel); pot.position.set(9.62, 1.09, 5.14); pot.castShadow = true; S.add(pot);
    // hall: door, frame, mat, coat stand
    S.add(box(0.1, 2.1, 0.2, W, 4.47, 1.05, 8)); S.add(box(0.1, 2.1, 0.2, W, 5.53, 1.05, 8)); S.add(box(1.16, 0.1, 0.2, W, 5, 2.1, 8));
    this.doorPivot = new THREE.Group(); this.doorPivot.position.set(4.54, 0, 8.0); S.add(this.doorPivot);
    this.doorPivot.add(box(0.92, 2.0, 0.08, mat(0x7a4b2e), 0.46, 1.0, 0));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), steel); knob.position.set(0.8, 1.0, 0.07); this.doorPivot.add(knob);
    this.lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: 0x0ca30c, emissive: 0x0ca30c, emissiveIntensity: .8 })); this.lock.position.set(0.8, 1.2, 0.07); this.doorPivot.add(this.lock);
    S.add(box(1.2, 0.02, 0.6, mat(0x5a3a2a), 5, 0.02, 8.55, false)); S.add(box(0.08, 1.5, 0.08, wood, 4.3, 0.75, 7.4)); S.add(box(0.5, 0.03, 0.5, wood, 4.3, 1.5, 7.4, false));
    this.bulbs = {}; this.roomLights = {};
    for (const [id, r] of Object.entries(ROOMS)) {
      const cx2 = (r.x[0] + r.x[1]) / 2, cz2 = id === 'hall' ? 5.2 : (r.z[0] + r.z[1]) / 2;
      S.add(box(0.012, 0.9, 0.012, mat(0x6a6f78), cx2, 2.75, cz2, false));
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 20, 1, true), mat(0x8a8f99, { side: THREE.DoubleSide, roughness: .6 })); shade.position.set(cx2, 2.33, cz2); S.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: 0x555555, emissive: COL.warm, emissiveIntensity: 0 })); bulb.position.set(cx2, 2.22, cz2); S.add(bulb); this.bulbs[id] = bulb;
      const pl = new THREE.PointLight(COL.warm, 0, 7, 2); pl.position.set(cx2, 2.1, cz2); S.add(pl); this.roomLights[id] = pl;
    }
    const pts = []; for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.5 + 0.08, r = 80; pts.push(Math.cos(a) * Math.cos(e) * r + 5, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r + 4); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0, sizeAttenuation: true, fog: false })); S.add(this.stars);
  }

  buildDynamic() {
    const S = this.scene;
    this.mover = {}; this.ring = {}; this.ringT = {}; this.halo = {}; this.haloLight = {}; this.ids = [];
    this.spot = new THREE.SpotLight(0xffb020, 0, 9, 0.42, 0.7, 1.2); this.spot.position.set(5, 5, 4); S.add(this.spot, this.spot.target);
    this.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 48), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); this.focusRing.rotation.x = -Math.PI / 2; this.focusRing.position.y = 0.085; S.add(this.focusRing);
    this.smoke = []; const sm = new THREE.MeshBasicMaterial({ color: 0x9aa0a6, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), sm.clone()); s.userData.phase = i / 16; s.position.set(9.7, 1.1, 5.3); S.add(s); this.smoke.push(s); }
    this.fire = []; for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff9a2a : 0xff4d1a, emissive: i % 2 ? 0xff9a2a : 0xff4d1a, emissiveIntensity: 1.5, transparent: true, opacity: 0 })); f.position.set(9.7 + (i - 1.5) * 0.12, 1.25, 5.3 + ((i % 2) - 0.5) * 0.18); S.add(f); this.fire.push(f); }
    this.fireLight = new THREE.PointLight(0xff7a2a, 0, 5, 2); this.fireLight.position.set(9.6, 1.6, 5.3); S.add(this.fireLight);
    this.stream = box(0.035, 0.34, 0.035, new THREE.MeshStandardMaterial({ color: COL.water, emissive: COL.water, emissiveIntensity: .5, transparent: true, opacity: 0 }), 9.55, 0.83, 3.0, false); S.add(this.stream);
    this.puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0x3f8fe0, roughness: .1, metalness: .3, transparent: true, opacity: 0 })); this.puddle.rotation.x = -Math.PI / 2; this.puddle.position.set(8.4, 0.075, 2.6); S.add(this.puddle);
    this.bell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffd24a, emissiveIntensity: 0 })); this.bell.position.set(5.75, 1.45, 8.12); S.add(this.bell);
    for (const k of ['stove', 'tap', 'tv', 'door']) this.label(k, new THREE.Vector3(...OBJ[k]), 'obj', '');
    this.label('house', new THREE.Vector3(5, 3.5, 4), 'obj alarm', '');
  }

  ensurePerson(id) {
    if (this.people[id]) return;
    const S = this.scene; const spot = (SPOT[id] || SPOT.mina).bedroom;
    this.people[id] = makePerson(COL[id] || 0x999999, HAIR[id] || 0x333333); S.add(this.people[id]);
    this.mover[id] = { queue: [], place: null, pos: new THREE.Vector3(spot[0], 0, spot[1]) };
    this.people[id].position.copy(this.mover[id].pos);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: COL[id] || 0x999999, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.09; S.add(ring); this.ring[id] = ring; this.ringT[id] = 10;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: COL.mind, transparent: true, opacity: 0, depthWrite: false })); S.add(halo); this.halo[id] = halo;
    const hl = new THREE.PointLight(COL.mind, 0, 6, 2); S.add(hl); this.haloLight[id] = hl;
    this.label(id, new THREE.Vector3(), 'person', '');
    this.ids.push(id); this.pose[id] = 'stand'; this.flags[id] = {};
  }
  lie(id, place) { const table = this.ids.length > 1 ? LIE[id] || LIE.mina : LIE_ALONE; return table[place]; }

  label(key, pos, cls, text) {
    let l = this.labels.get(key);
    if (!l) { const el = document.createElement('div'); el.className = 'lbl ' + cls; this.labelLayer.appendChild(el); l = { pos, el, cls }; this.labels.set(key, l); }
    l.pos = pos; if (text !== undefined) this.setLabel(key, text, cls); return l;
  }
  setLabel(key, html, cls) { const l = this.labels.get(key); if (!l) return; l.el.hidden = !html; if (html) l.el.innerHTML = html; if (cls !== undefined) l.el.className = 'lbl ' + cls; }

  // Route between places through doorways and the hall, so nobody walks through walls.
  route(who, place) {
    const m = this.mover[who]; if (m.place === place) return;
    const spots = SPOT[who]; const pts = []; const from = m.place, to = place;
    if (from === null) { const [sx, sz] = spots[place] || spots.hall; m.pos.set(sx, 0, sz); m.queue = []; m.place = place; this.people[who].position.set(sx, 0, sz); return; }
    if (from !== to) {
      if (from !== 'hall' && from !== 'outside') pts.push(DOORWAY[from]);
      if (from === 'outside') pts.push([5, 9.2], [5, 8.0]);
      if (to !== 'hall' && to !== 'outside') pts.push([5, DOORWAY[to][1]], DOORWAY[to]);
      if (to === 'outside') pts.push([5, 8.0], [5, 9.2]);
    }
    pts.push(spots[place] || spots.hall);
    m.queue = pts.map(([x, z]) => new THREE.Vector3(x, 0, z)); m.place = place;
  }

  update(snap) {
    const w = snap.world; this.state = snap; this.hour = w.hour;
    for (const id of Object.keys(w.people)) {
      this.ensurePerson(id);
      const p = w.people[id]; const target = p.movingTo || p.place;
      this.route(id, target);
      this.pose[id] = p.collapsed ? 'floor' : (!p.awake && this.lie(id, p.place)) ? 'lie' : 'stand';
      this.flags[id] = (snap.agents[id] || {}).flags || {};
    }
    const d = w.dev;
    this.doorOpen = d.doorOpen; this.doorLocked = d.doorLocked; this.tvOn = d.tv && d.power; this.stoveOn = d.stove && d.power; this.smokeOn = d.smoke; this.fireOn = d.fire; this.tapOn = d.tap; this.flood = d.flood; this.bellOn = d.doorbellPending;
    for (const id of Object.keys(ROOMS)) { const on = w.rooms[id].light && d.power; this.roomLights[id].intensity = on ? 22 : 0; this.bulbs[id].material.emissiveIntensity = on ? 2.2 : 0; this.bulbs[id].material.color.set(on ? 0xffe9c4 : 0x555555); }
  }
  pulse(id) { if (id in this.ringT) this.ringT[id] = 0; }
  setFocus(target, colorHex) { if (!target) { this.focusTarget = null; return; } this.focusTarget = target.clone(); this.spot.color.set(colorHex); this.focusRing.material.color.set(colorHex); }

  render(dt, now) {
    dt = Math.min(dt, 0.1);
    const h = this.hour; let i = 0; while (KEYS[i + 1][0] < h) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]);
    const lerpC = (c1, c2) => new THREE.Color(c1).lerp(new THREE.Color(c2), t);
    const sky = lerpC(a[1], b[1]); this.scene.background = sky; this.scene.fog.color.copy(sky);
    this.hemi.color.copy(lerpC(a[2], b[2])); this.hemi.groundColor.copy(lerpC(a[3], b[3])); this.hemi.intensity = Math.max(0.55, THREE.MathUtils.lerp(a[6], b[6], t));
    this.sun.color.copy(lerpC(a[4], b[4])); this.sun.intensity = THREE.MathUtils.lerp(a[5], b[5], t);
    const st = THREE.MathUtils.clamp((h - 5.5) / 13.5, 0, 1); const ang = Math.PI * st; this.sun.position.set(5 - Math.cos(ang) * 30, Math.max(3, Math.sin(ang) * 28), 18);
    const night = h < 5 ? 1 : h < 7 ? 1 - (h - 5) / 2 : h < 19 ? 0 : h < 21 ? (h - 19) / 2 : 1; this.stars.material.opacity = night * 0.9;
    for (const id of this.ids) {
      const m = this.mover[id], g = this.people[id], flags = this.flags[id] || {};
      if (m.queue.length) {
        const target = m.queue[0]; const d = target.clone().sub(m.pos); const dist = d.length(); const step = 3.6 * dt;
        if (dist <= step) { m.pos.copy(target); m.queue.shift(); } else { d.normalize().multiplyScalar(step); m.pos.add(d); g.rotation.y = Math.atan2(d.x, d.z); }
        g.position.set(m.pos.x, Math.abs(Math.sin(now * 0.012)) * 0.04, m.pos.z); g.rotation.x = 0; g.rotation.z = 0;
      } else if (this.pose[id] !== 'stand' && this.state) {
        const place = this.state.world.people[id].place;
        const lie = this.lie(id, place);
        if (this.pose[id] === 'lie' && lie) { const [x, y, z] = lie; g.position.set(x, y, z); g.rotation.set(-Math.PI / 2, 0, 0); }
        else { g.position.set(m.pos.x, 0.18, m.pos.z); g.rotation.set(-Math.PI / 2, 0, id === 'mina' ? 0.6 : -0.6); }
      } else { g.position.set(m.pos.x, 0, m.pos.z); g.rotation.x = 0; g.rotation.z = 0; }
      const fade = THREE.MathUtils.clamp(1 - (g.position.x - 12.6) / 2.6, 0, 1);
      for (const ch of g.children) { ch.material.transparent = fade < 1; ch.material.opacity = fade; ch.visible = fade > 0.02; }
      const badge = g.userData.badge; badge.rotation.y += dt * 2; const bc = flags.sleeping ? 0x445566 : flags.thinking ? COL.mind : COL[id]; badge.material.emissive.set(bc); badge.material.color.set(bc);
      const p = g.position;
      this.ringT[id] += dt; const rt = this.ringT[id]; const ring = this.ring[id]; ring.position.set(p.x, 0.09, p.z);
      if (rt < 0.7 && fade > 0.5) { const sc = 1 + rt * 4; ring.scale.set(sc, sc, 1); ring.material.opacity = 0.9 * (1 - rt / 0.7); } else ring.material.opacity = 0;
      const th = flags.thinking && fade > 0.5 ? 0.35 + 0.25 * Math.sin(now * 0.006 + (id === 'mina' ? 1 : 0)) : 0;
      this.halo[id].material.opacity = th; this.halo[id].position.set(p.x, (this.pose[id] === 'stand' ? 2.35 : 1.2) + 0.05 * Math.sin(now * 0.004), p.z); this.haloLight[id].intensity = th * 30; this.haloLight[id].position.set(p.x, 2.4, p.z);
      this.labels.get(id).pos.set(p.x, this.pose[id] === 'stand' ? 2.3 : 1.2, p.z);
    }
    if (this.focusTarget) { const f = this.focusTarget; this.spot.position.set(f.x + 0.6, f.y + 4.2, f.z + 0.8); this.spot.target.position.set(f.x, Math.max(0, f.y - 0.6), f.z); this.spot.intensity = 90 + 30 * Math.sin(now * 0.004); this.focusRing.position.set(f.x, 0.085, f.z); const s = 1 + 0.12 * Math.sin(now * 0.004); this.focusRing.scale.set(s, s, 1); this.focusRing.material.opacity = 0.75; } else { this.spot.intensity = 0; this.focusRing.material.opacity = 0; }
    const want = this.doorOpen ? -1.65 : 0; this.doorPivot.rotation.y += (want - this.doorPivot.rotation.y) * Math.min(1, dt * 4);
    const lc = this.doorOpen ? 0xff4d3d : this.doorLocked ? 0x0ca30c : 0xffb020; this.lock.material.color.set(lc); this.lock.material.emissive.set(lc);
    this.tvScreen.material.emissiveIntensity = this.tvOn ? 0.9 + 0.15 * Math.sin(now * 0.02) : 0;
    for (const bn of this.burners) bn.material.emissiveIntensity = this.stoveOn ? 1.4 + 0.3 * Math.sin(now * 0.01) : 0;
    for (const s of this.smoke) { if (this.smokeOn || this.fireOn) { const f = ((now / 1000) * 0.35 + s.userData.phase) % 1; s.position.set(9.7 + Math.sin(f * 9 + s.userData.phase * 6) * 0.25, 1.15 + f * 2.0, 5.3 + Math.cos(f * 7) * 0.2); const sc = 0.7 + f * 1.8; s.scale.set(sc, sc, sc); s.material.opacity = 0.55 * (1 - f); } else s.material.opacity = 0; }
    for (let k = 0; k < this.fire.length; k++) { const f = this.fire[k]; f.material.opacity = this.fireOn ? 0.95 : 0; f.scale.y = this.fireOn ? 0.8 + 0.5 * Math.abs(Math.sin(now * 0.02 + k)) : 1; } this.fireLight.intensity = this.fireOn ? 25 + 10 * Math.sin(now * 0.03) : 0;
    this.stream.material.opacity = this.tapOn ? 0.85 : 0; this.stream.scale.y = this.tapOn ? 0.9 + 0.1 * Math.sin(now * 0.03) : 1;
    const pw = this.flood ? 0.55 : 0; this.puddle.material.opacity += (pw - this.puddle.material.opacity) * Math.min(1, dt * 2);
    this.bell.material.emissiveIntensity = this.bellOn ? 1 + Math.sin(now * 0.02) : 0; this.bell.material.color.set(this.bellOn ? 0xffd24a : 0x444444);
    this.controls.update(); this.renderer.render(this.scene, this.camera); this.projectLabels();
  }
  projectLabels() {
    const W = this.canvas.clientWidth || innerWidth, H = this.canvas.clientHeight || innerHeight; const v = new THREE.Vector3();
    for (const l of this.labels.values()) {
      if (l.el.hidden) continue;
      v.copy(l.pos).project(this.camera);
      const visible = v.z < 1 && this.labelsOn; l.el.style.opacity = visible ? '1' : '0';
      l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
    }
  }
}
