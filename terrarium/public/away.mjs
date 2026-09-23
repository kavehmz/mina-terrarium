// The places Mina goes when she leaves the house, seen through a small live window next to the bus stop.
// Each place is a little 3D corner built far away from the house, so the main camera never sees it.
// Only people the world knows are there are drawn: colleagues at the library, a friend she is meeting.
import * as THREE from "/vendor/three.module.js";

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o });
function box(parent, w, h, d, color, x, z, y = 0, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === "object" ? color : mat(color, o));
  m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
export function makePerson(top, hair, skin = 0xd9a988) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.8, 12), mat(0x2d3a4f)); legs.position.y = 0.4; body.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 12), mat(top)); torso.position.y = 1.07; torso.castShadow = true; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat(skin)); head.position.y = 1.58; body.add(head);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(hair)); h.position.y = 1.6; h.rotation.x = 0.35; body.add(h);
  g.userData.body = body;
  return g;
}
const floor = (g, w, d, color) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color)); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; g.add(f); };
const wallBack = (g, w, color, h = 2.6, d = 3) => { box(g, w, h, 0.12, color, 0, -d); };
const wallLeft = (g, d, color, h = 2.6, w = 3.5) => { box(g, 0.12, h, d, color, -w, -d / 2 + 0.5); };
function shelf(g, x, z, w = 1.6, rot = 0) {
  const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rot; g.add(s);
  box(s, w, 2.0, 0.4, 0x7b5b3a, 0, 0);
  const colors = [0xb5473a, 0x3a6fb5, 0xd9a441, 0x4f8f5a, 0x7a4fa0, 0xe2d6c0];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) box(s, w / 11, 0.34, 0.3, colors[(row * 3 + i) % colors.length], -w / 2 + 0.12 + i * (w / 9.5), 0.05, 0.12 + row * 0.47);
}
function tree(g, x, z, r = 1) {
  box(g, 0.22, 1.1 * r, 0.22, 0x6b4a2f, x, z);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * r, 0), mat(0x5f9a4a, { flatShading: true })); c.position.set(x, 1.6 * r, z); c.castShadow = true; g.add(c);
}
function chair(g, x, z, color = 0x7a5a3c) { box(g, 0.45, 0.45, 0.45, color, x, z); }

// Each place: build(group) returns where she sits, stands and walks, and where a companion goes.
const PLACES = {
  library: {
    title: "the city library", build(g) {
      floor(g, 8, 7, 0xc9b28c); wallBack(g, 8, 0xe9e1d0); wallLeft(g, 7, 0xe9e1d0);
      shelf(g, -2.2, -2.7); shelf(g, -0.4, -2.7); shelf(g, 1.4, -2.7);
      shelf(g, -3.2, -0.6, 1.6, Math.PI / 2);
      box(g, 2.2, 0.8, 0.8, 0x8a6a4a, 0.4, 0.2); box(g, 0.5, 0.35, 0.05, 0x222222, 0.2, 0.05, 0.8); box(g, 0.1, 0.05, 0.1, 0x222222, 0.2, 0.1, 0.8);
      // Returns trolley; the pile on top only shows while a full trolley is waiting.
      box(g, 0.8, 0.9, 0.5, 0x5a6f8a, 2.4, -1.0);
      const pile = new THREE.Group(); g.add(pile);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(pile, 0.14, 0.3, 0.2, [0xb5473a, 0x3a6fb5, 0xd9a441, 0x4f8f5a][i], 2.15 + i * 0.17, -1.1 + j * 0.22, 0.9);
      box(g, 1.6, 0.75, 0.9, 0x8a6a4a, 2.2, 1.6); chair(g, 2.2, 2.3); chair(g, 0.4, 1.05, 0x3c4a5a);
      // Printer, staff corner (kettle, table) and the staff toilet door.
      box(g, 0.7, 0.9, 0.55, 0x9aa3ad, -1.2, 1.4); box(g, 0.5, 0.05, 0.3, 0xffffff, -1.2, 1.4, 0.9);
      box(g, 1.0, 0.72, 0.8, 0x8a6a4a, -2.5, 2.6); chair(g, -2.5, 3.2, 0x7a5a3c); box(g, 0.18, 0.24, 0.18, 0xd05050, -2.8, 2.5, 0.72);
      box(g, 0.08, 2.0, 0.9, 0x6f8fb0, -3.42, 1.0); box(g, 0.05, 0.22, 0.3, 0xffffff, -3.37, 1.0, 1.55);
      const L = new THREE.PointLight(0xfff0d0, 2.2, 16, 0); L.position.set(0, 3, 0); g.add(L);
      return {
        sit: [0.4, 0.95, Math.PI], stand: [-0.4, -1.9, Math.PI], walk: { c: [0, -1.6], r: 1.3 },
        staff: [-2.5, 3.2, Math.PI], toilet: [-3.1, 1.0, -Math.PI / 2], printer: [-0.6, 1.9, -Math.PI / 2],
        pile,
        // People from work events: shown only while the world says they are there.
        people: {
          reader: { top: 0x5a8f3d, hair: 0x3a2412, at: [0.4, -0.55, 0] },
          student: { top: 0xd9a441, hair: 0x111111, at: [-1.2, 2.0, Math.PI] },
          colleague: { top: 0x8a5a9a, hair: 0x6b4a2f, at: [1.2, 0.9, -Math.PI / 2], rest: [2.2, 2.2, Math.PI, true] },
          dana: { top: 0x3c4a5a, hair: 0x999999, at: [1.2, 0.6, -Math.PI / 2] },
        },
      };
    },
  },
  cafe: {
    title: "the café on Linden Street", build(g) {
      floor(g, 8, 7, 0x8a6a52); wallBack(g, 8, 0xd8c3a5); wallLeft(g, 7, 0xd8c3a5);
      box(g, 3.2, 1.05, 0.7, 0x5a3d2b, 0.6, -2.3); box(g, 0.5, 0.5, 0.4, 0x999999, -0.4, -2.3, 1.05); box(g, 0.3, 0.3, 0.3, 0xd9a441, 1.4, -2.3, 1.05);
      for (const [x, z] of [[-1.8, 0.4], [1.6, 1.2], [-1.4, 2.2]]) { box(g, 0.9, 0.72, 0.9, 0x3b2a20, x, z); }
      chair(g, -1.8, 1.1, 0x5a3d2b); chair(g, -1.8, -0.3, 0x5a3d2b); chair(g, 1.6, 1.9, 0x5a3d2b); chair(g, -1.4, 2.9, 0x5a3d2b);
      box(g, 0.12, 0.12, 0.12, 0xffffff, -1.7, 0.4, 0.72); box(g, 0.12, 0.12, 0.12, 0xffffff, -1.9, 0.3, 0.72);
      const L = new THREE.PointLight(0xffd9a0, 2.2, 16, 0); L.position.set(0, 3, 0); g.add(L);
      return { sit: [-1.8, 1.15, Math.PI], stand: [0.4, -1.5, Math.PI], walk: { c: [0, 0], r: 1 }, companion: [-1.8, -0.35, 0], extras: [{ at: [1.3, -2.9, 0], top: 0x2f2f2f, hair: 0x222222 }] };
    },
  },
  shop: {
    title: "the grocery shop", build(g) {
      floor(g, 8, 7, 0xd8d8d0); wallBack(g, 8, 0xf0f0ea); wallLeft(g, 7, 0xf0f0ea);
      for (const x of [-2.4, -0.6, 1.2]) { box(g, 0.8, 1.5, 3.4, 0xe8e8e8, x, -0.9); for (let i = 0; i < 6; i++) for (const side of [-0.42, 0.42]) box(g, 0.1, 0.25, 0.4, [0xd9534f, 0xf0a030, 0x3fb27f, 0x3d7dd9, 0xffd24a, 0x8f5fd1][i], x + side, -2.4 + i * 0.6, 0.4 + (i % 3) * 0.35); }
      box(g, 1.2, 0.9, 0.6, 0x3c4a5a, 2.8, 1.8);
      const L = new THREE.PointLight(0xffffff, 2.2, 16, 0); L.position.set(0, 3, 0); g.add(L);
      return { sit: [0.3, 0.8, 0], stand: [0.3, 0.6, 0], walk: { c: [0.3, -0.9], r: 0.0, line: true }, extras: [{ at: [2.8, 2.4, Math.PI], top: 0x3fb27f, hair: 0x222222 }] };
    },
  },
  park: {
    title: "the park", build(g) {
      floor(g, 10, 8, 0x8cbf6a);
      const path = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.6, 40), mat(0xd8cfbd)); path.rotation.x = -Math.PI / 2; path.position.y = 0.01; g.add(path);
      tree(g, -3, -2, 1.2); tree(g, 3, -2.5, 1.1); tree(g, -3.4, 2, 0.9); tree(g, 3.9, -0.8, 1); tree(g, 0, -3.4, 1.3);
      box(g, 1.4, 0.45, 0.5, 0x8a6a4a, 0, 0.1); box(g, 1.4, 0.5, 0.1, 0x8a6a4a, 0, -0.12, 0.45);
      const L = new THREE.PointLight(0xffe7b0, 2.2, 16, 0); L.position.set(1.2, 2.6, 0.6); g.add(L); box(g, 0.08, 2.6, 0.08, 0x333333, 1.2, 0.6);
      return { sit: [0, 0.2, Math.PI], stand: [0, 2.2, 0], walk: { c: [0, 0], r: 2.2 }, companion: [0.55, 0.2, Math.PI] };
    },
  },
  leyla_home: {
    title: "Leyla's flat", build(g) {
      floor(g, 8, 7, 0xc2a57e); wallBack(g, 8, 0xe7d9c2); wallLeft(g, 7, 0xe7d9c2);
      box(g, 2.2, 0.45, 0.8, 0xa85a5a, -0.6, -1.8); box(g, 2.2, 0.8, 0.25, 0x964c4c, -0.6, -2.2);
      box(g, 2.4, 0.02, 1.6, 0x6f8fb0, -0.4, -0.3);
      for (const [x, z, c] of [[0.4, 0.2, 0xff5a4a], [-1.2, 0.3, 0x3fb27f], [1.0, -0.6, 0xffd24a]]) box(g, 0.25, 0.25, 0.25, c, x, z);
      box(g, 1.6, 0.75, 0.9, 0x8a6a4a, 2.2, 1.2); chair(g, 2.2, 1.9);
      const L = new THREE.PointLight(0xffd9a0, 2.2, 16, 0); L.position.set(0, 3, 0); g.add(L);
      return { sit: [-1.0, -1.75, 0], stand: [0, 0.6, Math.PI], walk: { c: [0, 0], r: 1 }, companion: [-0.1, -1.75, 0], companionId: "leyla" };
    },
  },
  gym: {
    title: "the gym", build(g) {
      floor(g, 8, 7, 0x444a52); wallBack(g, 8, 0x9aa3ad); wallLeft(g, 7, 0x9aa3ad);
      for (const x of [-2, 0, 2]) box(g, 1.2, 0.03, 0.6, 0x2ab3a8, x, 0.4);
      box(g, 1.8, 1.2, 0.8, 0x222222, -1.8, -2.2); box(g, 1.8, 1.2, 0.8, 0x222222, 1.8, -2.2);
      for (let i = 0; i < 5; i++) box(g, 0.2, 0.2, 0.2, 0x888888, -0.8 + i * 0.4, -2.6, 0.2);
      const L = new THREE.PointLight(0xffffff, 2.2, 16, 0); L.position.set(0, 3, 0); g.add(L);
      return { sit: [0, 0.4, Math.PI], stand: [0, 0.4, Math.PI], walk: { c: [0, 0.4], r: 0.7 }, extras: [{ at: [2, 0.4, Math.PI], top: 0xd9534f, hair: 0x222222 }] };
    },
  },
  doctor: {
    title: "the doctor's surgery", build(g) {
      floor(g, 8, 7, 0xd6dde0); wallBack(g, 8, 0xeef3f5); wallLeft(g, 7, 0xeef3f5);
      box(g, 2.2, 1.0, 0.7, 0xffffff, 1.6, -2.2);
      for (let i = 0; i < 5; i++) chair(g, -2.4 + i * 0.7, 0.9, 0x3d7dd9);
      box(g, 0.8, 0.45, 0.8, 0x8a6a4a, -0.4, -0.4);
      const L = new THREE.PointLight(0xffffff, 2.2, 16, 0); L.position.set(0, 3, 0); g.add(L);
      return { sit: [-1.0, 0.95, Math.PI], stand: [0.6, -1.4, Math.PI], walk: { c: [0, 0], r: 0.8 }, extras: [{ at: [1.6, -2.7, 0], top: 0xffffff, hair: 0x6b4a2f }, { at: [0.4, 0.95, Math.PI], top: 0x7a8a5a, hair: 0x999999, sit: true }] };
    },
  },
  bus: {
    title: "the bus", build(g) {
      floor(g, 3, 9, 0x555a60);
      // Cut away like the dollhouse: only the far side wall, a low sill on the near side.
      box(g, 0.12, 2.2, 9, 0x1f6fd1, -1.5, 0); box(g, 0.12, 0.5, 9, 0x1f6fd1, 1.5, 0);
      // A window strip on each side with the town sliding past.
      const c = document.createElement("canvas"); c.width = 512; c.height = 64; const x2 = c.getContext("2d");
      for (let i = 0; i < 40; i++) { x2.fillStyle = ["#9cbf7c", "#cfc2a8", "#8a9aaa", "#e9e2d2", "#5f9a4a"][i % 5]; x2.fillRect(i * 13, 10 + (i * 7) % 30, 12, 64); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
      for (const x of [-1.43]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.8), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); w.rotation.y = Math.PI / 2; w.position.set(x, 1.5, 0); g.add(w); }
      for (let i = 0; i < 6; i++) for (const x of [-0.9, 0.9]) { box(g, 0.9, 0.45, 0.6, 0xb5473a, x, -3.4 + i * 1.3); box(g, 0.9, 0.6, 0.12, 0xb5473a, x, -3.4 + i * 1.3 + 0.3, 0.45); }
      const L = new THREE.PointLight(0xfff5e0, 2.2, 16, 0); L.position.set(0, 2.4, 0); g.add(L);
      return { sit: [0.9, -0.8, Math.PI], stand: [0, 0, Math.PI], walk: { c: [0, 0], r: 0 }, tex, extras: [{ at: [-0.9, 1.8, Math.PI], top: 0x8f5fd1, hair: 0x222222, sit: true }, { at: [0.9, 3.1, Math.PI], top: 0xf0a030, hair: 0x6b4a2f, sit: true }] };
    },
  },
};

const SIT = ["work", "eat", "drink", "read", "relax", "meet", "travel", "talk", "call", "message", "check_phone", "wait"];
const WALK = ["walk", "shop"];

export class AwayView {
  constructor(scene) {
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 60);
    this.sets = {};
    let i = 0;
    for (const [id, def] of Object.entries(PLACES)) {
      const g = new THREE.Group();
      g.position.set(400 + i * 40, 0, 400); i++;
      const info = def.build(g);
      for (const e of info.extras ?? []) {
        const who = makePerson(e.top, e.hair);
        who.position.set(e.at[0], 0, e.at[1]); who.rotation.y = e.at[2];
        if (e.sit) who.userData.body.position.y = -0.35;
        g.add(who);
      }
      const people = {};
      for (const [kind, spec] of Object.entries(info.people ?? {})) { const f = makePerson(spec.top, spec.hair); f.visible = false; g.add(f); people[kind] = { f, spec }; }
      scene.add(g);
      this.sets[id] = { g, info, title: def.title, people };
    }
    this.mina = makePerson(0x2ab3a8, 0x2a1a12);
    this.friend = makePerson(0xd96b3d, 0x3a2412);
    scene.add(this.mina, this.friend);
    this.t = 0;
  }

  // Which set to show for this snapshot, or null when she is at home.
  setFor(p) {
    if (p.location === "travelling") return "bus";
    if (p.location === "away" && this.sets[p.place]) return p.place;
    return null;
  }

  // Pose Mina (and a friend she is with) inside the set, then render it into the rectangle on screen.
  render(renderer, snap, rect, dt) {
    const p = snap.person, id = this.setFor(p);
    if (!id || !rect) return;
    const set = this.sets[id], info = set.info, o = set.g.position;
    this.t += dt;
    const kind = p.kind, body = this.mina.userData.body;
    body.position.set(0, 0, 0);
    let x, z, rot;
    const attend = p.attend;
    this.mina.visible = true;
    if (kind === "toilet" && info.toilet) { [x, z, rot] = info.toilet; this.mina.visible = false; }
    else if ((kind === "drink" || kind === "eat") && info.staff) { [x, z, rot] = info.staff; body.position.y = -0.35; }
    else if (kind === "attend" && attend === "student" && info.printer) { [x, z, rot] = info.printer; }
    else if (kind === "attend" && attend === "trolley") {
      const a = this.t * 0.3; x = -0.4 + Math.sin(a) * 1.6; z = -1.9; rot = Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2;
      body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.04;
    }
    else if (WALK.includes(kind) && info.walk.r > 0) {
      const a = this.t * 0.35;
      x = info.walk.c[0] + Math.cos(a) * info.walk.r; z = info.walk.c[1] + Math.sin(a) * info.walk.r; rot = -a;
      body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.05;
    } else if (WALK.includes(kind) && info.walk.line) {
      x = info.walk.c[0] + 0.1; z = info.walk.c[1] + Math.sin(this.t * 0.4) * 1.6; rot = Math.cos(this.t * 0.4) > 0 ? Math.PI : 0;
      body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.05;
    } else if (SIT.includes(kind)) { [x, z, rot] = info.sit; body.position.y = -0.35; }
    else if (kind === "exercise") { [x, z, rot] = info.stand; body.position.y = Math.abs(Math.sin(this.t * 3)) * 0.25; }
    else { [x, z, rot] = info.stand; }
    this.mina.position.set(o.x + x, 0, o.z + z); this.mina.rotation.y = rot;
    // Work: the people and things waiting for her, where they are.
    const present = new Set([...(p.work ?? []), ...(attend ? [attend] : [])]);
    for (const [k, { f, spec }] of Object.entries(set.people)) {
      const here = present.has(k);
      const pos = here ? spec.at : spec.rest;
      f.visible = Boolean(pos);
      if (pos) { f.position.set(pos[0], 0, pos[1]); f.rotation.y = pos[2]; f.userData.body.position.y = pos[3] ? -0.35 : 0; }
    }
    if (info.pile) info.pile.visible = present.has("trolley");
    // A friend is drawn only when the world says she is with them.
    const with_ = /with (\w+)/.exec(p.activity || "")?.[1];
    const showFriend = Boolean(with_) && kind === "meet" && info.companion;
    this.friend.visible = showFriend;
    if (showFriend) { const [fx, fz, fr] = info.companion; this.friend.position.set(o.x + fx, 0, o.z + fz); this.friend.rotation.y = fr; this.friend.userData.body.position.y = -0.35; }
    if (info.tex) info.tex.offset.x = (this.t * 0.25) % 1;
    // Camera: three-quarter view over the place, a little closer to her.
    const cx = o.x + x * 0.4, cz = o.z + z * 0.4;
    this.camera.position.set(cx + 2.4, id === "bus" ? 3.9 : 4.2, cz + 4.4);
    this.camera.lookAt(cx, 0.7, cz - 0.3);
    this.camera.aspect = rect.w / rect.h; this.camera.updateProjectionMatrix();
    const H = window.innerHeight;
    renderer.setScissorTest(true);
    renderer.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
    renderer.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, H);
  }

  hide() { this.mina.visible = false; this.friend.visible = false; }
}
