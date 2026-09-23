// DOM panels for two people: what the selected person feels and senses, their two systems, the shared story.
import { OBJ, ROOMS } from '/scene.mjs';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return `${s} s`; const m = Math.round(s / 60); if (m < 60) return `${m} min`; const h = Math.floor(m / 60); return m % 60 ? `${h} h ${m % 60} min` : `${h} h`; };
const MIN = 60000;
const NEED_WORDS = { none: 'Nothing pressing', hunger: 'Hungry', sleep: 'Tired, wants to sleep', hygiene: 'Wants a shower', boredom: 'Bored, restless', connection: 'Misses the other', obligation: 'Somewhere to be', safety: 'Danger', message: 'A message to answer' };
const NEED_CLASS = { none: 'calm', hunger: 'waste', sleep: 'waste', hygiene: 'waste', boredom: 'waste', connection: 'care', obligation: 'safety', safety: 'danger', message: 'care' };
const URGENCY_WORDS = ['Nothing pressing', 'Minor, it can wait', 'Serious, act soon', 'Emergency'];
const ROOM_NAMES = { bedroom: 'bedroom', bathroom: 'bathroom', kitchen: 'kitchen', living: 'living room', hall: 'hall', outside: 'outside' };
const STEP_WORDS = { go_to: 'go to', cook: 'cook', eat: 'eat', shower: 'shower', sleep: 'sleep', nap: 'nap', watch_tv: 'watch', read: 'read', rest: 'rest', talk: 'talk about', message: 'text', check_on: 'check on the other', go_out: 'go out', turn_off: 'turn off', turn_on_light: 'light on', turn_off_light: 'light off', lock_door: 'lock the door', unlock_door: 'unlock the door', answer_door: 'answer the door', call_emergency: 'call emergency services', wait: 'wait' };

export const hud = {
  who: null,
  ids(snap) { return Object.keys(snap.world.people); },
  ensureWho(snap) { const ids = this.ids(snap); if (!this.who || !ids.includes(this.who)) this.who = ids[0]; return this.who; },
  disconnected() { $('modeText').innerHTML = 'Disconnected<small>reload the page</small>'; },

  senses(snap) {
    const w = snap.world, d = w.dev, p = w.people[this.ensureWho(snap)], o = Object.values(w.people).find((q) => q.id !== p.id), sim = w.simMs;
    const since = (t) => fmtDur(sim - (t ?? sim));
    $('sensesName').textContent = p.name;
    const b = p.body, bw = p.bodyWords;
    const rows = [['🍽️', 'hunger', b.hunger, bw.hunger], ['😴', 'tiredness', 1 - b.energy, bw.energy], ['🚿', 'grubby', b.hygiene, bw.hygiene], ['🥱', 'boredom', b.boredom, bw.boredom], ['💬', o ? 'missing ' + o.name : 'lonely', b.connection, bw.connection]];
    $('body').innerHTML = rows.map(([ic, nm, v, words]) => `<div class="need"><span class="ic">${ic}</span><span class="track"><i class="${v > 0.75 ? 'hot' : ''}" style="width:${Math.round(v * 100)}%"></i></span><span class="w"><b>${nm}</b> · ${esc(words)}</span></div>`).join('');
    const here = p.place; const tiles = [];
    tiles.push({ ic: '📍', nm: 'Where I am', val: here === 'outside' ? (p.outPurpose || 'out') : ROOM_NAMES[here], st: 'off' });
    tiles.push({ ic: p.awake ? (p.collapsed ? '🆘' : '🙂') : '😴', nm: 'State', val: p.collapsed ? 'on the floor' : p.awake ? p.activity : 'asleep', st: p.collapsed ? 'alarm' : 'off' });
    if (here === 'kitchen') tiles.push({ ic: '🔥', nm: 'Stove', val: d.stove ? `on ${since(d.stoveSince)}` : 'off', st: d.fire ? 'alarm' : d.stove ? 'on' : 'off' });
    if (here === 'bathroom') { tiles.push({ ic: '🚰', nm: 'Tap', val: d.tap ? `running ${since(d.tapSince)}` : 'off', st: d.tap ? 'on' : 'off' }); tiles.push({ ic: '💧', nm: 'Floor', val: d.flood ? 'wet' : 'dry', st: d.flood ? 'water' : 'off' }); }
    if (here === 'living') tiles.push({ ic: '📺', nm: 'TV', val: d.tv ? `on ${since(d.tvSince)}` : 'off', st: d.tv ? 'on' : 'off' });
    if (here === 'hall') tiles.push({ ic: '🚪', nm: 'Front door', val: d.doorOpen ? 'open' : d.doorLocked ? 'closed · locked' : 'closed · unlocked', st: d.doorOpen ? 'alarm' : d.doorLocked ? 'off' : 'on' });
    if (here !== 'outside') tiles.push({ ic: '💡', nm: 'Light here', val: w.rooms[here].light && d.power ? 'on' : 'off', st: 'off' });
    $('tiles').innerHTML = tiles.map((t) => `<div class="tile" data-state="${t.st}"><span class="ic">${t.ic}</span><span class="nm">${t.nm}</span><span class="val">${esc(t.val)}</span></div>`).join('');
    const heard = [];
    if (here !== 'outside') {
      if (d.fire) heard.push('🔥 heat alarm: fire in the kitchen'); else if (d.smoke) heard.push(`🚨 smoke alarm, ${since(d.smokeSince)}`);
      if (d.doorbellPending) heard.push(`🔔 doorbell rang ${since(d.doorbellAt)} ago`);
      if (!d.power) heard.push('⚡ power is out');
      if (d.tap && here !== 'bathroom') heard.push('🚰 water running in the bathroom');
      if (d.tv && here !== 'living') heard.push('📺 TV on in the living room');
    }
    const otherLine = !o ? '🏠 lives alone · phone: Leyla, Sam' : o.place === here && here !== 'outside' ? `👀 ${o.name} is here${o.collapsed ? ', ON THE FLOOR' : o.awake ? ', ' + esc(o.activity) : ', asleep'}` : `👤 ${o.name} not in sight`;
    const msgs = (p.inbox || []).slice(-2).map((m) => `📱 ${esc(m.from)}: “${esc(m.text)}”`);
    $('heard').innerHTML = [...heard.map((h) => `<div class="h">${h}</div>`), `<div class="o">${otherLine}</div>`, ...msgs.map((m) => `<div class="m">${m}</div>`)].join('') || '<div class="o muted">quiet</div>';
  },

  jev(snap, ticked) {
    const b = snap.agents[this.ensureWho(snap)], s = b.stats, f = b.flags, p = snap.world.people[this.who];
    $('brainName').textContent = b.name; $('inspectName').textContent = b.name;
    const dot = $('jevDot'); dot.className = 'dot ' + (f.jevError ? 'error' : f.jevMock ? 'mock' : 'live') + (ticked ? ' beat' : '');
    $('modelName').textContent = f.jevModel; $('latency').textContent = s.lastTickMs ? `${Math.round(s.lastTickMs)} ms` : '— ms';
    const n = b.need; const big = $('needBig');
    if (n) { big.textContent = NEED_WORDS[n.choice] ?? n.choice; big.className = 'big ' + (NEED_CLASS[n.choice] ?? ''); $('needConf').textContent = `${Math.round(n.confidence * 100)}% sure · ${p.awake ? esc(p.activity) : 'asleep'}`; }
    $('concerns').innerHTML = b.concerns.filter((c) => c.asked).map((c) => {
      const pct = Math.min(100, (100 * c.a) / c.cap), thr = (100 * c.fireAt) / c.cap, fired = c.firedAgo != null && c.firedAgo < 1600;
      return `<div class="concern ${fired ? 'fired' : ''}" title="${esc(c.id)}"><span>${esc(c.label)}</span><span class="track"><span class="fill" style="width:${pct}%"></span><span class="thr" style="left:${thr}%"></span><span class="pm" style="left:${Math.round(c.p * 100)}%"></span></span><span class="p">${c.p.toFixed(2)}</span></div>`;
    }).join('') + (b.reflex && b.reflex.choice !== 'none' ? `<div class="small" style="color:var(--alarm)">reflex: ${esc(b.reflex.choice.replaceAll('_', ' '))} ${Math.round(b.reflex.confidence * 100)}%</div>` : '');
    const u = b.urgency; const lvl = u ? Math.max(0, Math.min(3, Math.round(u.score))) : -1;
    $('urgMeter').dataset.level = String(lvl); $('urgText').textContent = u ? URGENCY_WORDS[lvl] : '—';
    let mode;
    if (f.idleReason === 'paused') mode = 'Paused with the house'; else if (f.idleReason) mode = 'Idle · nobody watching';
    else if (f.sleeping) mode = 'Tidying memory'; else if (f.thinking) mode = 'Asking System Two';
    else if (s.mode === 'asleep') mode = 'Asleep · feeling every 8 s'; else if (s.mode === 'awake') mode = 'Awake · feeling every 1.5 s'; else mode = 'Quiet · feeling every 4 s';
    $('modeText').innerHTML = `${mode}<small>${b.lastStateTokens} tokens per tick</small>`;
    $('mindDot').className = 'dot violet ' + (f.mindMock ? 'mock' : 'live'); $('mindModel').textContent = f.mindMock ? 'mock' : f.mindModel;
    const st = $('mindState'); st.textContent = f.thinking ? 'deciding…' : `${s.mindCalls} ${s.mindCalls === 1 ? 'decision' : 'decisions'}`; st.className = 'state' + (f.thinking ? ' thinking' : '');
    const th = b.thoughts.find((t) => t.kind === 'thought');
    $('thought').innerHTML = th ? `<time>${esc(th.simClock)}</time>“${esc(th.text.replace(/ · \d+ ms$/, ''))}”` : '<span class="muted">no thought yet</span>';
    const plan = p.plan;
    $('plan').innerHTML = plan ? plan.steps.map((st2, i) => `<li class="${i < plan.idx ? 'done' : i === plan.idx ? 'now' : ''}"><i>${i === plan.idx ? '▸' : i < plan.idx ? '✓' : '·'}</i><span>${esc(STEP_WORDS[st2.step] ?? st2.step)} ${esc(st2.arg)}</span><small>${st2.minutes ? st2.minutes + ' min' : ''}</small></li>`).join('') : `<li class="none">no plan · ${p.awake ? 'about to decide' : 'asleep'}</li>`;
    const dEl = $('directive');
    if (b.directive) { dEl.className = 'directive'; dEl.innerHTML = `<span class="muted small">note to System One:</span> ${esc(b.directive.text)}`; } else { dEl.className = 'directive none'; dEl.textContent = 'No note for the fast layer yet.'; }
    $('ticks').textContent = s.ticks; $('mindCalls').textContent = s.mindCalls; $('cost').textContent = `$${s.costTotal.toFixed(3)}`; $('perHour').textContent = `$${s.dollarsPerHour.toFixed(2)}`;
  },

  dash(snap) {
    const w = snap.world;
    $('clock').textContent = w.clock; $('weekday').textContent = `${w.weekday} · ${w.paused ? 'paused' : w.slowed ? 'real time while thinking' : w.speed === 1 ? 'real time' : w.speed + '× speed'}`;
    $('clock').parentElement.classList.toggle('slow', !!w.slowed); $('clock').closest('.clock').classList.toggle('slow', !!w.slowed);
    $('daylight').textContent = w.daylight; $('daybar').querySelector('.mark').style.left = `${(w.hour / 24) * 100}%`;
    $('story').innerHTML = snap.story.slice(-7).reverse().map((it) => `<li class="${it.kind}" data-who="${it.who}"><time>${esc(it.simClock)}</time><span>${esc(it.text)}</span></li>`).join('') || '<li><time></time><span>Nothing has happened yet.</span></li>';
    const ids = this.ids(snap); const row = $('whoRow'); row.dataset.count = String(ids.length);
    row.innerHTML = ids.map((id) => { const p = w.people[id]; const doing = p.collapsed ? 'on the floor!' : p.place === 'outside' ? (p.outPurpose || 'out') : `${p.awake ? p.activity : 'asleep'} · ${ROOM_NAMES[p.place]}`; return `<span class="avatar ${id === 'mina' ? 'm' : 's'}">${esc(p.name[0])}</span><div><b>${esc(p.name)}</b><div class="small">${esc(doing)}</div></div>`; }).join('');
    const tabs = $('whoTabs'); tabs.hidden = ids.length < 2;
    if (ids.length > 1 && tabs.children.length !== ids.length) tabs.innerHTML = ids.map((id) => `<button data-who="${id}" class="${id === this.who ? 'on' : ''}">${esc(w.people[id].name)}</button>`).join('');
    const sel = $('pokeTo'); if (sel.options.length !== ids.length) sel.innerHTML = ids.map((id) => `<option value="${id}">text ${esc(w.people[id].name)}</option>`).join('');
    document.querySelectorAll('[data-incident^="fall_"]').forEach((btn) => { btn.hidden = !ids.includes(btn.dataset.incident.slice(5)); });
    $('tlName').textContent = w.people[this.who].name;
    const ph = snap.phases[this.who] || ''; const segs = []; let i = 0;
    while (i < ph.length) { let j = i; while (j < ph.length && ph[j] === ph[i]) j++; segs.push([ph[i], j - i]); i = j; }
    const total = Math.max(ph.length, 600); const lead = total - ph.length;
    $('timeline').innerHTML = (lead ? `<i style="width:${(lead / total) * 100}%"></i>` : '') + segs.map(([c, n]) => `<i class="ph-${c}" style="width:${(n / total) * 100}%"></i>`).join('');
  },

  // Where the selected person's attention is: drives the spotlight.
  focus(snap, scene) {
    const b = snap.agents[this.ensureWho(snap)], w = snap.world, d = w.dev, p = w.people[this.who];
    const top = [...b.concerns].filter((c) => c.asked).sort((x, y) => y.a - x.a)[0];
    if (!top || top.a < 1) return null;
    const color = top.id === 'unusual' ? 0xff8a3d : top.id === 'other' ? 0xe0669a : 0xffb020;
    let key = null;
    if (top.id === 'unusual') key = d.fire || d.smoke || d.stove ? 'stove' : d.tap || d.flood ? 'tap' : d.doorOpen ? 'door' : null;
    else if (top.id === 'other') key = Object.keys(w.people).find((id) => id !== this.who) || null;
    else if (top.id === 'attention' && b.need && b.need.choice === 'hunger') key = 'stove';
    if (!key) return null;
    let pos;
    if (w.people[key]) { const fig = scene.people[key]; if (!fig || w.people[key].place === 'outside') return null; const q = fig.position; pos = [q.x, 1.2, q.z]; } else pos = OBJ[key];
    return { key, pos, color };
  },

  sceneLabels(snap, scene, focusKey) {
    const w = snap.world, d = w.dev, sim = w.simMs; const since = (t) => fmtDur(sim - (t ?? sim));
    const fc = (k) => (focusKey === k ? ' focus' : '');
    scene.setLabel('stove', d.fire ? '🔥 FIRE on the stove' : d.smoke ? `💨 smoke · stove ${d.stove ? 'on ' + since(d.stoveSince) : 'off'}` : d.stove ? `🔥 stove on ${since(d.stoveSince)}${d.stoveMeal ? ' · ' + esc(d.stoveMeal) : ''}` : '', 'obj' + (d.fire || d.smoke ? ' alarm' : '') + fc('stove'));
    scene.setLabel('tap', d.flood ? `💧 water on the floor · tap ${d.tap ? 'running' : 'off'}` : d.tap ? `🚰 tap running ${since(d.tapSince)}` : '', 'obj' + (d.flood ? ' water' : '') + fc('tap'));
    scene.setLabel('tv', d.tv && d.power ? `📺 TV on ${since(d.tvSince)}` : '', 'obj' + fc('tv'));
    scene.setLabel('door', d.doorbellPending ? `🔔 ding! ${since(d.doorbellAt)} ago` : d.doorOpen ? `🚪 door open ${since(d.doorOpenSince)}` : !d.doorLocked && (w.hour < 7 || w.hour > 21) ? '🚪 door unlocked' : '', 'obj' + (d.doorOpen ? ' alarm' : '') + fc('door'));
    scene.setLabel('house', d.power ? '' : '⚡ POWER OUT', 'obj alarm');
    for (const id of Object.keys(w.people)) {
      const p = w.people[id], a = snap.agents[id], f = a.flags;
      const state = p.collapsed ? '<b>!</b> on the floor' : !p.awake ? 'z z · ' + esc(p.activity) : f.thinking ? esc(p.activity) + ' · thinking…' : esc(p.activity);
      scene.setLabel(id, p.place === 'outside' ? '' : `<b class="${id}">${esc(p.name)}</b> <i>${state}</i>`, 'person' + (f.thinking ? ' thinking' : '') + (p.collapsed ? ' alarm' : '') + (focusKey === id ? ' focus' : ''));
    }
  },
};
