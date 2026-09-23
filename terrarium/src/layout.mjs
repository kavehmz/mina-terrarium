// The home's floor plan, shared by the server (walking, senses) and the browser (drawing).
// Units are metres. x runs east, y runs north. The house spans x 0..14, y 0..10; the street is south of it.

export const ROOMS = {
  bedroom:  { label: "Bedroom",     x0: 0,  x1: 5,  y0: 5.5, y1: 10,  floor: "#d9c9b0" },
  bathroom: { label: "Bathroom",    x0: 5,  x1: 8,  y0: 5.5, y1: 10,  floor: "#bcd6de" },
  kitchen:  { label: "Kitchen",     x0: 8,  x1: 14, y0: 5.5, y1: 10,  floor: "#e6dcc8" },
  living:   { label: "Living room", x0: 0,  x1: 5,  y0: 0,   y1: 5.5, floor: "#cfc2a8" },
  hall:     { label: "Hall",        x0: 5,  x1: 8,  y0: 0,   y1: 5.5, floor: "#c9bfae" },
  dining:   { label: "Dining room", x0: 8,  x1: 14, y0: 0,   y1: 5.5, floor: "#d6c7a6" },
};
export const ROOM_IDS = Object.keys(ROOMS);

// Doorways: a gap in a wall. `a`/`b` are the rooms on either side; `x`,`y` is the centre of the gap.
export const DOORS = [
  { a: "living", b: "bedroom", x: 2.5, y: 5.5, axis: "h" },
  { a: "living", b: "hall", x: 5, y: 2.6, axis: "v" },
  { a: "hall", b: "bathroom", x: 6.5, y: 5.5, axis: "h" },
  { a: "hall", b: "dining", x: 8, y: 2.6, axis: "v" },
  { a: "dining", b: "kitchen", x: 11, y: 5.5, axis: "h" },
  { a: "hall", b: "outside", x: 6.5, y: 0, axis: "h", front: true },
];
export const DOOR_WIDTH = 1.1;

// Places in the home where things happen. `at` is where she stands; `room` is the room it is in.
export const SPOTS = {
  bed:        { room: "bedroom", at: [3.1, 8.4], label: "bed" },
  wardrobe:   { room: "bedroom", at: [1.0, 9.0], label: "wardrobe" },
  bathtub:    { room: "bathroom", at: [6.5, 9.3], label: "bath and shower" },
  toilet:     { room: "bathroom", at: [5.6, 7.0], label: "toilet" },
  basin:      { room: "bathroom", at: [7.2, 7.0], label: "basin" },
  stove:      { room: "kitchen", at: [12.6, 8.8], label: "stove" },
  kitchen_sink: { room: "kitchen", at: [10.4, 8.8], label: "kitchen sink" },
  fridge:     { room: "kitchen", at: [12.9, 6.6], label: "fridge" },
  kettle:     { room: "kitchen", at: [9.2, 8.8], label: "kettle" },
  table:      { room: "dining", at: [12.3, 2.4], label: "dining table" },
  desk:       { room: "dining", at: [9.0, 4.4], label: "desk" },
  sofa:       { room: "living", at: [3.75, 1.15], label: "sofa" },
  armchair:   { room: "living", at: [1.1, 4.2], label: "armchair" },
  living_mid: { room: "living", at: [2.0, 2.8], label: "living room floor" },
  front_door: { room: "hall", at: [6.5, 0.8], label: "front door" },
  hall_mid:   { room: "hall", at: [6.5, 3], label: "hall" },
  bedroom_mid: { room: "bedroom", at: [1.6, 7.0], label: "bedroom" },
  bathroom_mid: { room: "bathroom", at: [6.5, 7.6], label: "bathroom" },
  kitchen_mid: { room: "kitchen", at: [11, 7.4], label: "kitchen" },
  dining_mid: { room: "dining", at: [10.5, 3.2], label: "dining room" },
};
export const ROOM_CENTRE = { bedroom: "bedroom_mid", bathroom: "bathroom_mid", kitchen: "kitchen_mid", living: "living_mid", hall: "hall_mid", dining: "dining_mid" };

// Outside the front door: porch, garden path, gate, pavement and the bus stop where she leaves the scene.
export const OUTSIDE = {
  porch: [6.5, -0.9],
  gate: [6.5, -2.0],
  pavement: [8.6, -2.6],
  bus_stop: [11.6, -2.6],
};

// Places away from home. Travel minutes are door to door.
export const PLACES = {
  library: { label: "the city library (work)", short: "at work", travel: 25 },
  shop: { label: "the grocery shop", short: "at the shop", travel: 10 },
  cafe: { label: "the café on Linden Street", short: "at the café", travel: 15 },
  park: { label: "the park", short: "in the park", travel: 10 },
  leyla_home: { label: "Leyla's flat", short: "at Leyla's", travel: 30 },
  gym: { label: "the gym", short: "at the gym", travel: 15 },
  doctor: { label: "the doctor's surgery", short: "at the doctor's", travel: 20 },
};
export const PLACE_IDS = Object.keys(PLACES);

export function roomAt(x, y) {
  for (const [id, r] of Object.entries(ROOMS)) if (x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && y >= r.y0 - 1e-6 && y <= r.y1 + 1e-6) return id;
  return "outside";
}

// Neighbouring rooms through a doorway.
function neighbours(room) {
  return DOORS.filter(d => d.a === room || d.b === room).map(d => ({ door: d, to: d.a === room ? d.b : d.a }));
}

// A path of points from (x,y) in room `from` to point `to` in room `toRoom`, only through doorways.
export function pathBetween(from, fx, fy, toRoom, tx, ty) {
  if (from === toRoom) return [[tx, ty]];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const r = queue.shift();
    if (r === toRoom) break;
    for (const n of neighbours(r)) if (!(n.to in prev)) { prev[n.to] = { room: r, door: n.door }; queue.push(n.to); }
  }
  if (!(toRoom in prev)) return null;
  const hops = [];
  for (let r = toRoom; prev[r]; r = prev[r].room) hops.unshift({ from: prev[r].room, to: r, door: prev[r].door });
  const pts = [];
  for (const h of hops) {
    const d = h.door;
    // Step up to the doorway square-on, pass through it, and step clear on the other side.
    const side = (room) => {
      if (room === "outside") return d.axis === "h" ? [d.x, d.y - 0.7] : [d.x - 0.7, d.y];
      const R = ROOMS[room];
      const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2;
      return d.axis === "h" ? [d.x, d.y + (cy > d.y ? 0.7 : -0.7)] : [d.x + (cx > d.x ? 0.7 : -0.7), d.y];
    };
    pts.push(side(h.from), [d.x, d.y], side(h.to));
  }
  pts.push([tx, ty]);
  return pts;
}
