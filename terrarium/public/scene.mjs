// The home in 3D: a cutaway dollhouse seen from above at an angle, the garden, the street and the bus stop.
// World x -> three x, world y (north) -> three -z.
import * as THREE from "/vendor/three.module.js";
import { ROOMS, DOORS, DOOR_WIDTH, SPOTS, OUTSIDE } from "/shared/layout.mjs";
import { AwayView } from "/public/away.mjs";

const WALL_H = 1.05, WALL_T = 0.14;
const v3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o });

function box(w, h, d, color, x, y, z = 0, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === "object" ? color : mat(color, o));
  m.position.set(x, z + h / 2, -y); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function floorLabel(text, w, color = "rgba(40,32,20,0.55)") {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const g = c.getContext("2d");
  g.font = "700 120px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color;
  g.fillText(text.toUpperCase(), 512, 132);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export class Scene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0x6b5a45, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
    this.sun.position.set(-8, 18, 6); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
    this.sun.target.position.set(7, 0, -3);
    this.scene.add(this.sun, this.sun.target);
    this.roomLights = {};
    this.build();
    this.away = new AwayView(this.scene);
    this.awayRect = null; // screen rectangle of the "where she is" window, set by the page
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.pos = null; this.facing = 0; this.lastFrame = performance.now(); this.bob = 0;
    this.smokeT = 0;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Frame the house and the street between the side panels.
    const target = new THREE.Vector3(7.3, 0, -2.2);
    const dist = w / h > 1.7 ? 30 : 35;
    this.camera.position.set(target.x - 0.3, dist * 0.86, target.z + dist * 0.5);
    this.camera.lookAt(target);
    // Shift the picture so the house sits in the open space between the panels, above the bottom strip.
    this.camera.setViewOffset(w, h, 0, -h * 0.05, w, h);
    this.camera.updateProjectionMatrix();
  }

  build() {
    const s = this.scene;
    // Ground, garden, path, street.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x9cbf7c));
    ground.rotation.x = -Math.PI / 2; ground.position.set(7, -0.02, 0); ground.receiveShadow = true; s.add(ground);
    this.ground = ground;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 3.2), mat(0x5d6168));
    road.rotation.x = -Math.PI / 2; road.position.set(7, -0.01, 4.3); s.add(road);
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(120, 1.4), mat(0xcfcac0));
    pave.rotation.x = -Math.PI / 2; pave.position.set(7, 0, 2.7); s.add(pave);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), mat(0xd8cfbd));
    path.rotation.x = -Math.PI / 2; path.position.set(6.5, 0.005, 1.0); s.add(path);
    for (let x = -30; x < 40; x += 3) { const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.12), new THREE.MeshBasicMaterial({ color: 0xf2efe6 })); dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.001, 4.3); s.add(dash); }
    // Low garden fence with a gate gap.
    for (const [x0, x1] of [[-0.5, 5.9], [7.1, 14.5]]) s.add(box(x1 - x0, 0.45, 0.08, 0xe9e2d2, (x0 + x1) / 2, -2.05));
    // Bus stop: a shelter and a sign, where she leaves the scene.
    const [bx, by] = OUTSIDE.bus_stop;
    s.add(box(2.4, 0.08, 1.0, 0x3c4a5a, bx, by - 0.6, 2.2));
    s.add(box(0.08, 2.2, 0.08, 0x3c4a5a, bx - 1.1, by - 0.9)); s.add(box(0.08, 2.2, 0.08, 0x3c4a5a, bx + 1.1, by - 0.9));
    s.add(box(2.3, 1.6, 0.05, mat(0xbfe3ff, { transparent: true, opacity: 0.35 }), bx, by - 1.05, 0.5));
    const sign = box(0.5, 0.5, 0.06, 0x1f6fd1, bx + 1.6, by - 0.3, 2.0); s.add(sign); s.add(box(0.06, 2.0, 0.06, 0x888888, bx + 1.6, by - 0.3));
    // Trees and shrubs.
    const tree = (x, y, r = 1) => { s.add(box(0.25, 1.2 * r, 0.25, 0x6b4a2f, x, y)); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * r, 0), mat(0x5f9a4a, { flatShading: true })); c.position.set(x, 1.7 * r, -y); c.castShadow = true; s.add(c); };
    tree(-2.2, 2, 1.1); tree(16.3, 8, 1.2); tree(-2.5, 11, 1); tree(16.5, -2.5, 0.9); tree(1.6, -1.2, 0.6); tree(15.4, -1.2, 0.7);

    // Floors with their names written large on them.
    this.floors = {};
    for (const [id, r] of Object.entries(ROOMS)) {
      const w = r.x1 - r.x0, d = r.y1 - r.y0;
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(r.floor));
      f.rotation.x = -Math.PI / 2; f.position.set((r.x0 + r.x1) / 2, 0.01, -(r.y0 + r.y1) / 2); f.receiveShadow = true;
      s.add(f); this.floors[id] = f;
      const lab = floorLabel(r.label, Math.min(w - 0.4, 3.6));
      const ly = id === "bathroom" ? r.y0 + 1.9 : id === "hall" ? r.y0 + 1.6 : id === "kitchen" ? r.y0 + 1.1 : id === "dining" ? r.y0 + 2.9 : id === "living" ? r.y0 + 4.5 : r.y0 + 1.15;
      lab.position.set((r.x0 + r.x1) / 2, 0.02, -ly); s.add(lab);
      // Ceiling light glow for when the room light is on.
      const L = new THREE.PointLight(0xffd9a0, 0, 9, 1.6); L.position.set((r.x0 + r.x1) / 2, 2.6, -(r.y0 + r.y1) / 2); s.add(L);
      this.roomLights[id] = L;
    }
    // Walls with gaps at the doorways.
    const segs = [];
    const addWall = (x0, y0, x1, y1) => {
      const horiz = Math.abs(y1 - y0) < 1e-6;
      const gaps = DOORS.filter(d => (horiz ? d.axis === "h" && Math.abs(d.y - y0) < 1e-6 && d.x > Math.min(x0, x1) && d.x < Math.max(x0, x1) : d.axis === "v" && Math.abs(d.x - x0) < 1e-6 && d.y > Math.min(y0, y1) && d.y < Math.max(y0, y1)));
      let cuts = [[horiz ? Math.min(x0, x1) : Math.min(y0, y1), horiz ? Math.max(x0, x1) : Math.max(y0, y1)]];
      for (const g of gaps) {
        const c = horiz ? g.x : g.y, a = c - DOOR_WIDTH / 2, b = c + DOOR_WIDTH / 2;
        cuts = cuts.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, a], [b, q]].filter(([m, n]) => n - m > 0.01)));
      }
      for (const [p, q] of cuts) segs.push(horiz ? [p, y0, q, y0] : [x0, p, x0, q]);
    };
    // Outer walls.
    addWall(0, 0, 14, 0); addWall(0, 10, 14, 10); addWall(0, 0, 0, 10); addWall(14, 0, 14, 10);
    // Inner walls.
    addWall(0, 5.5, 14, 5.5); addWall(5, 0, 5, 10); addWall(8, 0, 8, 10);
    const wallMat = mat(0xf4efe6);
    const capMat = mat(0x8b7d6b);
    for (const [x0, y0, x1, y1] of segs) {
      const horiz = Math.abs(y1 - y0) < 1e-6;
      const len = horiz ? x1 - x0 : y1 - y0;
      const w = box(horiz ? len + WALL_T : WALL_T, WALL_H, horiz ? WALL_T : len + WALL_T, wallMat, (x0 + x1) / 2, (y0 + y1) / 2);
      s.add(w);
      const cap = box(horiz ? len + WALL_T : WALL_T, 0.03, horiz ? WALL_T : len + WALL_T, capMat, (x0 + x1) / 2, (y0 + y1) / 2, WALL_H);
      s.add(cap);
    }
    // Front door: a panel hinged on its left, swings in when open.
    const fd = DOORS.find(d => d.front);
    this.doorPivot = new THREE.Group(); this.doorPivot.position.set(fd.x - DOOR_WIDTH / 2, 0, -fd.y);
    const panel = box(DOOR_WIDTH, 1.9, 0.06, 0x2f5d8a, DOOR_WIDTH / 2, 0); panel.position.z = 0;
    this.doorPivot.add(panel); s.add(this.doorPivot);
    this.doorLock = box(0.12, 0.12, 0.1, 0xd4a017, fd.x + 0.4, fd.y + 0.05, 1.0); s.add(this.doorLock);
    // Windows on the outer walls (they glow at night when a light is on inside).
    this.windows = [];
    const win = (room, x, y, horiz) => { const m = box(horiz ? 1.2 : 0.06, 0.5, horiz ? 0.06 : 1.2, mat(0xaad4f0, { emissive: 0x000000 }), x, y, 0.45); m.userData.room = room; s.add(m); this.windows.push(m); };
    win("bedroom", 2.5, 10, true); win("kitchen", 11, 10, true); win("bathroom", 6.5, 10, true); win("living", 2.5, 0, true); win("dining", 11, 0, true); win("living", 0, 2.7, false); win("bedroom", 0, 7.7, false); win("kitchen", 14, 7.7, false); win("dining", 14, 2.7, false);

    this.buildFurniture();
    this.buildPeople();
    this.buildEffects();
  }

  buildFurniture() {
    const s = this.scene;
    // Bedroom.
    s.add(box(1.9, 0.45, 2.4, 0xf0ebe0, 3.1, 8.6)); s.add(box(1.9, 0.12, 1.6, 0x7a9cc6, 3.1, 8.1, 0.45)); s.add(box(1.5, 0.14, 0.45, 0xffffff, 3.1, 9.45, 0.45));
    s.add(box(1.95, 0.9, 0.1, 0x8a6a4a, 3.1, 9.85)); s.add(box(0.5, 0.5, 0.45, 0x8a6a4a, 1.85, 9.5));
    this.alarm = box(0.2, 0.15, 0.12, 0x333333, 1.85, 9.5, 0.5); s.add(this.alarm);
    s.add(box(0.6, 1.9, 1.4, 0xa07b55, 0.35, 9.0));
    s.add(box(2.2, 0.02, 1.6, 0xc9a27a, 2.3, 6.9));
    // Bathroom.
    s.add(box(2.7, 0.55, 0.9, 0xffffff, 6.5, 9.45)); this.bathWater = box(2.5, 0.02, 0.7, mat(0x69b7e8, { transparent: true, opacity: 0.8 }), 6.5, 9.45, 0.1); s.add(this.bathWater);
    s.add(box(0.1, 1.9, 0.1, 0xbfc7cf, 7.7, 9.85)); this.showerHead = box(0.3, 0.05, 0.3, 0xbfc7cf, 7.55, 9.7, 1.9); s.add(this.showerHead);
    s.add(box(0.45, 0.45, 0.6, 0xffffff, 5.35, 7.0)); s.add(box(0.45, 0.5, 0.2, 0xffffff, 5.35, 7.4, 0.2));
    s.add(box(0.5, 0.8, 0.6, 0xffffff, 7.65, 7.0));
    // Kitchen: counter along the north wall, stove, sink, fridge, kettle.
    s.add(box(5.8, 0.9, 0.7, 0xb8a58c, 11.05, 9.6)); s.add(box(5.8, 0.05, 0.72, 0xe6e1d8, 11.05, 9.6, 0.9));
    this.stoveTop = box(0.8, 0.03, 0.55, 0x222222, 12.6, 9.6, 0.93); s.add(this.stoveTop);
    this.burner = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0x331a10 }));
    this.burner.rotation.x = -Math.PI / 2; this.burner.position.set(12.6, 0.97, -9.6); s.add(this.burner);
    this.pan = box(0.34, 0.08, 0.34, 0x444444, 12.6, 9.6, 0.97); this.pan.visible = false; s.add(this.pan);
    s.add(box(0.7, 0.06, 0.45, 0x9aa7b3, 10.4, 9.6, 0.9));
    s.add(box(0.2, 0.25, 0.2, 0xd05050, 9.2, 9.6, 0.93));
    s.add(box(0.8, 1.9, 0.75, 0xeef2f5, 13.55, 6.6));
    this.plate = box(0.35, 0.04, 0.35, 0xffffff, 11.6, 9.6, 0.95); this.plate.visible = false; s.add(this.plate);
    // Dining room: table, chairs, desk, bookshelf, plant.
    s.add(box(2.0, 0.75, 1.1, 0x9b7652, 12.3, 1.4)); for (const x of [11.7, 12.9]) { s.add(box(0.45, 0.45, 0.45, 0x7a5a3c, x, 2.25)); s.add(box(0.45, 0.45, 0.45, 0x7a5a3c, x, 0.55)); }
    s.add(box(1.4, 0.75, 0.55, 0x6f5238, 9.0, 5.05)); s.add(box(0.12, 0.35, 0.12, 0xffe08a, 9.5, 5.1, 0.75));
    s.add(box(0.4, 1.8, 1.6, 0x7b5b3a, 13.75, 3.9));
    // Living room: sofa facing the TV on the west wall, armchair, rug.
    s.add(box(0.8, 0.45, 1.9, 0x5b7fa6, 3.95, 1.15)); s.add(box(0.25, 0.8, 1.9, 0x4c6d90, 4.3, 1.15));
    s.add(box(0.1, 0.7, 1.3, 0x1b1b1b, 0.12, 1.15, 0.5)); s.add(box(0.5, 0.45, 1.4, 0x6b5238, 0.35, 1.15));
    this.tvScreen = box(0.02, 0.6, 1.2, mat(0x0a0a0a, { emissive: 0x000000 }), 0.19, 1.15, 0.55); s.add(this.tvScreen);
    s.add(box(0.9, 0.5, 0.9, 0xc2694f, 0.8, 4.4)); s.add(box(2.2, 0.02, 1.6, 0xd8c39a, 2.2, 2.4));
    // Hall: coat rack, shoe mat.
    s.add(box(0.1, 1.7, 0.1, 0x6b4a2f, 5.25, 1.2)); s.add(box(1.0, 0.02, 0.6, 0x8a6d4f, 6.5, 0.45));
    this.parcel = box(0.45, 0.3, 0.35, 0xc79a5b, 7.4, 0.6); this.parcel.visible = false; this.scene.add(this.parcel);
    this.note = box(0.3, 0.01, 0.2, 0xffffff, 6.3, -0.55); this.note.visible = false; this.scene.add(this.note);
  }

  buildPeople() {
    const person = (top, hair) => {
      const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.8, 12), mat(0x2d3a4f)); legs.position.y = 0.4; body.add(legs);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 12), mat(top)); torso.position.y = 1.07; torso.castShadow = true; body.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat(0xd9a988)); head.position.y = 1.58; body.add(head);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(hair)); h.position.y = 1.6; h.rotation.x = 0.35; body.add(h);
      g.userData.body = body;
      return g;
    };
    this.mina = person(0x2ab3a8, 0x2a1a12); this.scene.add(this.mina);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0x2ad1c9, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 48), new THREE.MeshBasicMaterial({ color: 0xa77bff, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.halo.rotation.x = -Math.PI / 2; this.scene.add(this.halo);
    this.visitor = person(0xc0843d, 0x444444); this.visitor.visible = false; this.visitor.position.copy(v3(6.9, -1.1)); this.visitor.rotation.y = Math.PI; this.scene.add(this.visitor);
  }

  buildEffects() {
    // Smoke puffs per room, water sheets per room.
    this.smoke = {}; this.water = {};
    const puffMat = new THREE.MeshBasicMaterial({ color: 0x77777a, transparent: true, opacity: 0, depthWrite: false });
    for (const [id, r] of Object.entries(ROOMS)) {
      const g = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.35 + Math.random() * 0.35, 8, 6), puffMat.clone());
        m.userData = { x: r.x0 + 0.5 + Math.random() * (r.x1 - r.x0 - 1), y: r.y0 + 0.5 + Math.random() * (r.y1 - r.y0 - 1), ph: Math.random() * 6 };
        g.add(m);
      }
      this.scene.add(g); this.smoke[id] = g;
      const wtr = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 - 0.2, r.y1 - r.y0 - 0.2), new THREE.MeshStandardMaterial({ color: 0x3f8fd6, transparent: true, opacity: 0, roughness: 0.1, metalness: 0.2, depthWrite: false }));
      wtr.rotation.x = -Math.PI / 2; wtr.position.set((r.x0 + r.x1) / 2, 0.035, -(r.y0 + r.y1) / 2); this.scene.add(wtr); this.water[id] = wtr;
    }
    // The bus: drives in along the street, stops at the shelter, drives off. Only when she boards or gets off.
    this.bus = new THREE.Group();
    this.bus.add(box(5.2, 1.9, 2.0, 0x1f6fd1, 0, 0, 0.35));
    this.bus.add(box(4.6, 0.6, 2.04, mat(0xbfe3ff, { emissive: 0x223344 }), 0.2, 0, 1.2));
    for (const x of [-1.7, 1.7]) for (const zz of [-0.95, 0.95]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 14), mat(0x111111)); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.38, zz); this.bus.add(wh); }
    this.bus.visible = false; this.scene.add(this.bus);
    this.busAnim = null;
    this.showerDrops = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.35, 1.7, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    this.showerDrops.position.set(7.55, 1.0, -9.7); this.showerDrops.visible = false; this.scene.add(this.showerDrops);
  }

  // Apply a snapshot from the server. Called ~5 times a second; animation happens in frame().
  update(snap) {
    const prev = this.snap?.person.location;
    this.snap = snap;
    const p = snap.person, h = snap.home;
    if (prev && prev !== p.location && ((prev === "outside" && p.location === "travelling") || (prev === "travelling" && p.location === "outside"))) this.runBus();
    if (!this.pos) this.pos = { x: p.x, y: p.y };
    // Daylight and weather.
    const day = snap.clock.daylight;
    const storm = snap.clock.weather === "storm" ? 0.55 : snap.clock.weather === "rain" ? 0.75 : snap.clock.weather === "cloudy" ? 0.88 : 1;
    this.hemi.intensity = 0.25 + 0.95 * day * storm;
    this.sun.intensity = 0.1 + 1.6 * day * storm;
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x121a2c), new THREE.Color(storm < 0.8 ? 0x9aa6b3 : 0xcfe3f2), day);
    this.scene.background = sky;
    this.ground.material.color.lerpColors(new THREE.Color(0x2c3a2a), new THREE.Color(0x9cbf7c), day);
    for (const [id, L] of Object.entries(this.roomLights)) L.intensity = h.power && h.lights[id] ? 14 : 0;
    for (const w of this.windows) { const lit = h.power && h.lights[w.userData.room]; w.material.emissive.setHex(lit && day < 0.5 ? 0xffc870 : 0x000000); w.material.emissiveIntensity = 0.9; }
    // Devices.
    const st = h.stove;
    this.burner.material.color.setHex(st.on ? (st.state === "burning" || st.state === "burnt" ? 0xff3b1f : 0xff6a2a) : 0x331a10);
    this.pan.visible = Boolean(st.dish);
    this.pan.material.color.setHex(st.state === "burnt" ? 0x111111 : st.state === "burning" ? 0x3a2a1a : 0x555555);
    this.plate.visible = Boolean(h.food);
    this.tvScreen.material.emissive.setHex(h.tv && h.power ? 0x6fa8ff : 0x000000);
    this.bathWater.scale.y = 1; this.bathWater.position.y = 0.1 + Math.min(1, h.bath.level) * 0.4; this.bathWater.visible = h.bath.level > 0.02;
    this.showerDrops.visible = h.shower;
    this.alarm.material.color.setHex(h.alarmClock.ringing ? 0xff4040 : 0x333333);
    this.doorPivot.rotation.y = h.door.open ? Math.PI / 2.2 : 0;
    this.doorLock.material.color.setHex(h.door.locked ? 0xd4a017 : 0x6f6f6f);
    this.parcel.visible = Boolean(h.parcel);
    this.note.visible = Boolean(h.doormat);
    this.visitor.visible = Boolean(h.visitor);
    // Once let in, a guest stands with her; otherwise they wait on the porch.
    if (h.visitor?.answered && p.location === "home") { this.visitor.position.copy(v3(p.x + 0.9, p.y - 0.4)); this.visitor.rotation.y = -Math.PI / 2; }
    else { this.visitor.position.copy(v3(6.9, -1.1)); this.visitor.rotation.y = Math.PI; }
    for (const [id, w] of Object.entries(this.water)) w.material.opacity = Math.min(0.75, h.water[id] * 1.4);
  }

  // Start the bus animation: it arrives, waits a moment at the stop, and leaves.
  runBus() { this.busAnim = { t0: performance.now() }; }
  stepBus(now) {
    const a = this.busAnim; if (!a) { this.bus.visible = false; return; }
    const t = (now - a.t0) / 1000, [bx, by] = OUTSIDE.bus_stop, laneZ = -(by - 1.3);
    let x;
    if (t < 1.6) x = bx - 22 + 22 * (1 - Math.pow(1 - t / 1.6, 2));
    else if (t < 3.4) x = bx;
    else if (t < 5.4) x = bx + 24 * Math.pow((t - 3.4) / 2, 2);
    else { this.busAnim = null; this.bus.visible = false; return; }
    this.bus.visible = true; this.bus.position.set(x, 0, laneZ);
  }

  // Project a world point to screen pixels, for the HTML labels.
  toScreen(x, y, hgt) {
    const v = v3(x, y, hgt).project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, behind: v.z > 1 };
  }

  frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastFrame) / 1000); this.lastFrame = now;
    const snap = this.snap;
    if (snap) {
      const p = snap.person, h = snap.home;
      // Glide towards the server's position; the server already walked through doorways, never walls.
      const k = 1 - Math.exp(-dt * 10);
      const jump = Math.hypot(p.x - this.pos.x, p.y - this.pos.y) > 4;
      this.pos.x = jump ? p.x : this.pos.x + (p.x - this.pos.x) * k;
      this.pos.y = jump ? p.y : this.pos.y + (p.y - this.pos.y) * k;
      const visible = p.location === "home" || p.location === "outside";
      this.mina.visible = visible;
      this.mina.position.copy(v3(this.pos.x, this.pos.y));
      let target = -p.facing + Math.PI;
      let da = ((target - this.facing + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.facing += da * k;
      const body = this.mina.userData.body;
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
      this.mina.rotation.y = this.facing;
      const lying = !p.awake || p.onFloor;
      if (lying) {
        body.rotation.x = -Math.PI / 2;
        if (!p.awake && p.room === "bedroom" && !p.onFloor) { this.mina.rotation.y = 0; body.position.set(0, 0.55, 0.55); }
        else if (p.onFloor) { body.position.set(0, 0.15, 0.6); }
        else { this.mina.rotation.y = Math.PI / 2; body.position.set(0, 0.5, 0.6); }
      } else if (["watch_tv", "read", "relax", "eat"].includes(p.kind) && !p.walking) {
        body.position.y = -0.35;
        if (p.kind === "watch_tv" || (p.kind === "relax" && p.room === "living")) this.mina.rotation.y = -Math.PI / 2 + Math.PI;
      } else if (p.walking) {
        this.bob += dt * 9; body.position.y = Math.abs(Math.sin(this.bob)) * 0.06;
      }
      // Heartbeat ring on every Jev tick, violet halo while System Two thinks.
      const tickAge = snap.brain.last ? (Date.now() - snap.brain.last.at) / 1000 : 9;
      this.ring.visible = visible; this.halo.visible = visible;
      this.ring.position.copy(v3(this.pos.x, this.pos.y, 0.04));
      const tt = Math.min(1, tickAge / 0.8);
      this.ring.scale.setScalar(1 + tt * 1.4); this.ring.material.opacity = (1 - tt) * 0.8;
      this.halo.position.copy(v3(this.pos.x, this.pos.y, 0.05));
      this.halo.material.opacity = snap.brain.thinking ? 0.45 + 0.3 * Math.sin(now / 250) : 0;
      // Smoke drifts and rises.
      this.smokeT += dt;
      for (const [id, g] of Object.entries(this.smoke)) {
        const level = h.smoke[id];
        g.visible = level > 0.02;
        if (!g.visible) continue;
        for (const m of g.children) {
          const u = m.userData, ph = (this.smokeT * 0.25 + u.ph) % 1;
          m.position.set(u.x + Math.sin(this.smokeT + u.ph) * 0.3, 0.6 + ph * 2.2, -u.y);
          m.material.opacity = Math.min(0.55, level * 1.3) * (1 - ph) * 0.9;
        }
      }
      this.stepBus(now);
      this.burner.scale.setScalar(h.stove.on ? 1 + 0.08 * Math.sin(now / 120) : 1);
    }
    this.renderer.render(this.scene, this.camera);
    // When she is out, draw the place she is at into the small window by the bus stop.
    if (snap && this.awayRect && this.away.setFor(snap.person)) this.away.render(this.renderer, snap, this.awayRect, dt);
    else this.away.hide();
  }
}

export { SPOTS };
