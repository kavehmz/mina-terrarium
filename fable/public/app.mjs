// Glue: SSE snapshots in, scene and panels out. The brains only run while a page is connected.
import { Scene } from '/scene.mjs';
import { hud } from '/hud.mjs';
import * as THREE from 'three';
const $ = (id) => document.getElementById(id);
const vec = (p) => new THREE.Vector3(p[0], p[1], p[2]);

const scene = new Scene($('scene'), $('labels'));
window.terrarium = { scene, THREE, hud, get snap() { return snap; } };
let snap = null, es = null, lastTicks = {}, lastStory = null, toastTimer = 0;

function connect() {
  if (es) return;
  es = new EventSource('/events');
  es.onmessage = (e) => { snap = JSON.parse(e.data); onSnapshot(); };
  es.onerror = () => hud.disconnected();
  $('watchBtn').textContent = 'Pause house';
}
function onSnapshot() {
  hud.ensureWho(snap);
  for (const id of Object.keys(snap.agents)) { const t = snap.agents[id].stats.ticks; if (t !== lastTicks[id]) { lastTicks[id] = t; scene.pulse(id); } }
  scene.update(snap);
  hud.senses(snap); hud.jev(snap, true); hud.dash(snap);
  const f = hud.focus(snap, scene);
  if (f) scene.setFocus(vec(f.pos), f.color); else scene.setFocus(null);
  hud.sceneLabels(snap, scene, f && f.key);
  $('watchBtn').textContent = snap.world.paused ? 'Resume house' : 'Pause house';
  $('speedSel').value = String(snap.world.speed);
  const last = snap.story[snap.story.length - 1];
  if (last) { const key = last.t + last.text; if (lastStory && key !== lastStory) toast(last); lastStory = key; }
}
function toast(item) { const el = $('toast'); el.textContent = item.text; el.className = 'toast ' + item.kind; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 9000); }

let lastT = performance.now();
(function loop(t) { const dt = (t - lastT) / 1000; lastT = t; scene.render(dt, t); requestAnimationFrame(loop); })(lastT);

// intro
const intro = $('intro');
if (localStorage.getItem('terrarium.intro2')) { intro.hidden = true; connect(); }
$('introBtn').addEventListener('click', () => { localStorage.setItem('terrarium.intro2', '1'); intro.hidden = true; connect(); });

// controls
async function post(url, body) { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
$('watchBtn').addEventListener('click', () => { if (!es) return connect(); post('/control', { paused: !(snap && snap.world.paused) }); });
$('speedSel').addEventListener('change', (e) => post('/control', { speed: Number(e.target.value), paused: false }));
$('viewSel').addEventListener('change', (e) => scene.setView(e.target.value));
$('labelsChk').addEventListener('change', (e) => { scene.labelsOn = e.target.checked; });
document.querySelectorAll('[data-incident]').forEach((btn) => btn.addEventListener('click', () => post('/poke', { incident: btn.dataset.incident })));
$('poke').addEventListener('submit', (e) => { e.preventDefault(); const inp = $('pokeText'); const text = inp.value.trim(); if (!text) return; post('/poke', { to: $('pokeTo').value, text }); inp.value = ''; });
$('whoTabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-who]'); if (!b) return; hud.who = b.dataset.who; document.querySelectorAll('#whoTabs button').forEach((x) => x.classList.toggle('on', x === b)); if (snap) onSnapshot(); });

// inspector
const drawer = $('inspector'); let tab = 'state', inspectData = null;
async function refreshInspector() {
  inspectData = await (await fetch('/inspect?who=' + hud.who)).json();
  const pick = { state: inspectData.state, answers: inspectData.answers, questions: inspectData.questions, memory: [inspectData.memory_summary ? 'SUMMARY: ' + inspectData.memory_summary : '(no summary yet)', ...inspectData.memory], thoughts: inspectData.thoughts.map((t) => `${t.simClock} [${t.kind}] ${t.text}`) }[tab];
  $('inspectorBody').textContent = Array.isArray(pick) && typeof pick[0] === 'string' ? pick.join('\n') : JSON.stringify(pick, null, 2);
}
$('inspectBtn').addEventListener('click', () => { drawer.hidden = !drawer.hidden; if (!drawer.hidden) refreshInspector(); });
$('closeInspect').addEventListener('click', () => { drawer.hidden = true; });
drawer.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; drawer.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b)); refreshInspector(); }));
$('exportBtn').addEventListener('click', async () => { if (!inspectData) await refreshInspector(); const blob = new Blob([JSON.stringify({ ...inspectData, snapshot: snap }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `terrarium-${hud.who}-${Date.now()}.json`; a.click(); });
setInterval(() => { if (!drawer.hidden) refreshInspector(); }, 4000);
addEventListener('keydown', (e) => { if (e.target.matches('input,select,textarea')) return; if (e.key === 'i') $('inspectBtn').click(); if (e.key === ' ') { e.preventDefault(); $('watchBtn').click(); } const tab = e.key === 'm' ? document.querySelector('#whoTabs [data-who=mina]') : e.key === 'o' ? document.querySelector('#whoTabs [data-who=otto]') : null; if (tab) tab.click(); });
