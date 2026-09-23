"""Figures for the README and the blog post, in the style of blog.zamani.me (1200-wide SVG, warm white).
Numbers come from real runs (see the comments); the feeling charts read docs/charge.json, extracted from tick logs.
Run: python3 docs/make_figures.py  -> docs/images/*.svg
"""
import json, os
from html import escape as esc

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "images")
os.makedirs(OUT, exist_ok=True)

FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
INK, DIM, LINE, BG = "#22272B", "#5A6570", "#D4D8D0", "#FDFDFB"
JEV, JEV_BG = "#1E8C87", "#E3F4F2"
LLM, LLM_BG = "#6B4BC4", "#EFE9FB"
WORLD, WORLD_BG = "#9A6512", "#FBEFD6"
BODY, BODY_BG = "#3C5A78", "#E8EEF4"


def frame(w, h, title, sub, body, t, d):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" font-family="{FONT}">
  <title>{esc(t)}</title>
  <desc>{esc(d)}</desc>
  <rect x="0" y="0" width="{w}" height="{h}" fill="{BG}"/>
  <rect x="0.5" y="0.5" width="{w-1}" height="{h-1}" fill="none" stroke="{LINE}"/>
  <text x="40" y="50" font-size="26" font-weight="700" fill="{INK}">{esc(title)}</text>
  <text x="40" y="76" font-size="14" fill="{DIM}">{esc(sub)}</text>
{body}
</svg>
'''


def lines(x, y, texts, size=14, color=INK, gap=20, weight="400", anchor="start"):
    return "\n".join(f'  <text x="{x}" y="{y + i*gap}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{esc(t)}</text>' for i, t in enumerate(texts))


def arrow(x1, y1, x2, y2, color=DIM, label=None, lx=None, ly=None):
    s = f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="2.2"/>\n'
    s += f'  <polygon points="{x2},{y2} {x2-10},{y2-6} {x2-10},{y2+6}" fill="{color}"/>\n'
    if label:
        s += f'  <text x="{lx}" y="{ly}" font-size="12.5" fill="{color}" text-anchor="middle" font-weight="700">{esc(label)}</text>\n'
    return s


# 1. The idea: two systems, one person -------------------------------------------------------------
def fig_loop():
    b = ""
    boxes = [
        (40, "HER WORLD AND BODY", WORLD, WORLD_BG, ["the clock and daylight", "hunger, tiredness, the loo", "sounds, smells, water, smoke", "her phone, the doorbell", "the plan she is following"]),
        (325, "SYSTEM 1 · JEV", JEV, JEV_BG, ["looks every second", "11 typed questions at once", "six feelings fill up and leak", "330 ms · about $0.0001", "never writes a word"]),
        (635, "SYSTEM 2 · AN LLM", LLM, LLM_BG, ["called only when a feeling", "crosses its line", "a first-person thought", "and a plan of 1–5 steps", "about 4 s · about $0.015"]),
        (920, "HER BODY DOES IT", BODY, BODY_BG, ["code walks her through", "doorways, cooks, texts,", "takes the bus", "physics does the rest:", "food burns, baths overflow"]),
    ]
    for x, title, c, bg, txt in boxes:
        b += f'  <rect x="{x}" y="110" width="240" height="200" rx="12" fill="{bg}" stroke="{c}" stroke-width="1.6"/>\n'
        b += f'  <text x="{x+120}" y="140" font-size="12.5" font-weight="700" fill="{c}" text-anchor="middle" letter-spacing="1">{esc(title)}</text>\n'
        b += lines(x + 120, 172, txt, 14, INK, 24, anchor="middle") + "\n"
    b += arrow(282, 210, 322, 210)
    b += arrow(567, 210, 632, 210, LLM, "fires", 600, 198)
    b += arrow(877, 210, 917, 210)
    # the loop back
    b += f'  <path d="M 1040 312 L 1040 350 L 160 350 L 160 318" fill="none" stroke="{DIM}" stroke-width="2" stroke-dasharray="6 5"/>\n'
    b += f'  <polygon points="160,312 154,324 166,324" fill="{DIM}"/>\n'
    b += f'  <text x="600" y="342" font-size="13" fill="{DIM}" text-anchor="middle">the world changes · Jev keeps looking</text>\n'
    # heartbeat strip: one hour at real time, 3,600 looks, a few decisions
    y0 = 395
    b += f'  <text x="40" y="{y0}" font-size="13" font-weight="700" fill="{INK}">One hour of her life</text>\n'
    b += f'  <text x="210" y="{y0}" font-size="13" fill="{DIM}">each thin line is a look by Jev (3,600 of them) · each violet dot is a decision by the LLM (about 3)</text>\n'
    x0, x1 = 40, 1160
    ticks = "".join(f'<line x1="{x0 + (x1-x0)*i/360:.1f}" y1="{y0+18}" x2="{x0 + (x1-x0)*i/360:.1f}" y2="{y0+46}" stroke="{JEV}" stroke-width="1" opacity="0.55"/>' for i in range(361))
    b += f"  {ticks}\n"
    for fx in (0.18, 0.47, 0.83):
        cx = x0 + (x1 - x0) * fx
        b += f'  <circle cx="{cx:.1f}" cy="{y0+32}" r="9" fill="{LLM}" stroke="{BG}" stroke-width="2.5"/>\n'
    b += f'  <text x="40" y="{y0+74}" font-size="13" fill="{DIM}">An LLM alone waits to be asked. Jev asks for it, all the time, for cents, and wakes it only when something matters.</text>\n'
    return frame(1200, 490, "Two systems, one person", "Fast and slow, as in Kahneman: System 1 feels her life every second; System 2 thinks only when a feeling crosses its line.", b,
                 "Two systems, one person",
                 "Four boxes in a loop: her world and body feed System One (Jev), which looks every second with 11 typed questions and six feelings that fill and leak; when a feeling crosses its line it fires System Two (an LLM), which returns a thought and a plan; code carries out the plan and the world changes. Below, one hour of her life: 3,600 thin lines for Jev's looks and about three dots for the LLM's decisions.")


# 2. Watch a feeling fill up (real ticks) ----------------------------------------------------------
def fig_feelings():
    data = json.load(open(os.path.join(HERE, "charge.json")))
    panels = [
        ("body", "Slow: her body, while she showers", "Tuesday 07:03 → 07:16, 17 ticks", WORLD, "Shower's done its job… then eat. I'm starving, nothing since last night."),
        ("people", "Fast: a text from her sister arrives", "Tuesday 09:10 → 09:26, 17 ticks", JEV, "Leyla's asking about Saturday. Quick reply now… then back to work."),
    ]
    b = ""
    for pi, (fid, title, when, c, quote) in enumerate(panels):
        px, py, pw, ph = 40 + pi * 580, 110, 540, 250
        ser = data[fid]["series"]
        b += f'  <text x="{px}" y="{py}" font-size="16" font-weight="700" fill="{INK}">{esc(title)}</text>\n'
        b += f'  <text x="{px}" y="{py+20}" font-size="12.5" fill="{DIM}">{esc(when)}</text>\n'
        gx, gy, gw, gh = px + 30, py + 40, pw - 40, 160
        top = 2.6
        yv = lambda v: gy + gh - v / top * gh
        b += f'  <rect x="{gx}" y="{gy}" width="{gw}" height="{gh}" fill="#FFFFFF" stroke="{LINE}"/>\n'
        # the line
        b += f'  <line x1="{gx}" y1="{yv(2):.1f}" x2="{gx+gw}" y2="{yv(2):.1f}" stroke="{LLM}" stroke-width="1.6" stroke-dasharray="6 4"/>\n'
        b += f'  <text x="{gx+6}" y="{yv(2)-6:.1f}" font-size="11.5" fill="{LLM}" font-weight="700">the line: call the LLM</text>\n'
        n = len(ser)
        bw = gw / n
        pts = []
        for i, (clock, charge, p) in enumerate(ser):
            x = gx + i * bw
            # Jev's answer this tick, as a thin bar (0..1 on the same scale x1)
            b += f'  <rect x="{x+bw*0.25:.1f}" y="{yv(p):.1f}" width="{bw*0.5:.1f}" height="{gy+gh-yv(p):.1f}" fill="{c}" opacity="0.28"/>\n'
            pts.append(f"{x+bw/2:.1f},{yv(charge):.1f}")
        b += f'  <polyline points="{" ".join(pts)}" fill="none" stroke="{c}" stroke-width="3"/>\n'
        lx, ly = pts[-1].split(",")
        b += f'  <circle cx="{lx}" cy="{ly}" r="7" fill="{LLM}" stroke="#fff" stroke-width="2"/>\n'
        b += f'  <text x="{gx}" y="{gy+gh+16}" font-size="11" fill="{DIM}">{esc(ser[0][0])}</text>\n'
        b += f'  <text x="{gx+gw}" y="{gy+gh+16}" font-size="11" fill="{DIM}" text-anchor="end">{esc(ser[-1][0])}</text>\n'
        # A shortened quote of her real thought at the fire (full text in docs/charge.json).
        b += f'  <text x="{px}" y="{py+238}" font-size="13.5" fill="{LLM}" font-style="italic">“{esc(quote)}”</text>\n'
    b += f'  <rect x="40" y="378" width="16" height="10" fill="{WORLD}" opacity="0.3"/><text x="62" y="387" font-size="12.5" fill="{DIM}">Jev’s answer each tick (how true the feeling is, 0 to 1)</text>\n'
    b += f'  <line x1="440" y1="383" x2="462" y2="383" stroke="{INK}" stroke-width="3"/><text x="468" y="387" font-size="12.5" fill="{DIM}">the charge: it leaks a little each tick and adds the new answer</text>\n'
    b += f'  <circle cx="908" cy="383" r="6" fill="{LLM}"/><text x="920" y="387" font-size="12.5" fill="{DIM}">fired: her thought, seconds later</text>\n'
    return frame(1200, 410, "Watch a feeling fill up", "Real ticks from two runs. A half-true feeling that lasts fills slowly; a sudden, clear one crosses fast. One blip never fires.", b,
                 "Watch a feeling fill up",
                 "Two charts from real tick logs. Left: while Mina showers, Jev says her body needs something at about 0.3 to 0.5 each tick; the charge climbs over 17 ticks to the line at 2 and fires; her thought: Shower's done its job, I'm starving. Right: the someone feeling idles low, a text from Leyla arrives, Jev jumps to 0.85 and the charge crosses the line within three ticks; her thought: Leyla's asking about Saturday, quick reply now.")


# 3. By the numbers (measured 2026-09-23, Claude Opus 5.5, jev-1.13.0) ------------------------------
def fig_numbers():
    # Her morning on 2026-09-23 (07:00–13:30 of her life, 9 real minutes at 60×): counted from the tick and run logs.
    tiles = [
        ("SYSTEM 1 LOOKED", "449 times", "once a real second · 332 ms a look", JEV, JEV_BG),
        ("SYSTEM 2 THOUGHT", "19 times", "about 1 in 24 looks woke it · 4.4 s a thought", LLM, LLM_BG),
        ("SCRIPTED", "0 lines", "no routine, no schedule, no rule for what she wants", WORLD, WORLD_BG),
        ("THE LOOKING COST", "$0.07", "about $0.00015 a look", JEV, JEV_BG),
        ("THE THINKING COST", "$0.29", "about $0.015 a thought, Claude Opus 5.5", LLM, LLM_BG),
        ("THE WHOLE MORNING", "$0.39", "with her friends' replies to her texts", BODY, BODY_BG),
    ]
    b = ""
    for i, (k, v, s, c, bg) in enumerate(tiles):
        x, y = 40 + (i % 3) * 376, 100 + (i // 3) * 115
        b += f'  <rect x="{x}" y="{y}" width="356" height="100" rx="10" fill="{bg}" stroke="{c}" stroke-width="1.5"/>\n'
        b += f'  <text x="{x+178}" y="{y+26}" font-size="12" fill="{c}" text-anchor="middle" font-weight="700" letter-spacing="1">{esc(k)}</text>\n'
        b += f'  <text x="{x+178}" y="{y+62}" font-size="30" fill="{INK}" text-anchor="middle" font-weight="700">{esc(v)}</text>\n'
        b += f'  <text x="{x+178}" y="{y+86}" font-size="13" fill="{DIM}" text-anchor="middle">{esc(s)}</text>\n'
    return frame(1200, 340, "Her morning, by the numbers", "a burst pipe, a plumber, the bus and a morning at work · 07:00 to 13:30 of her life, in 9 real minutes at 60× speed", b,
                 "Her morning, by the numbers",
                 "Six tiles for one morning, 07:00 to 13:30 of her life in 9 real minutes: System 1 looked 449 times, once a real second at 332 ms; System 2 thought 19 times, about once every 24 looks, at 4.4 seconds; zero lines of scripted behaviour; the looking cost 7 cents, the thinking 29 cents, the whole morning 39 cents.")


# 4. Who owns what ---------------------------------------------------------------------------------
def fig_split():
    cols = [
        ("CODE: THE WORLD", WORLD, WORLD_BG, ["The clock, daylight, weather", "Rooms, doorways, the bus", "Needs rise with time", "A stove left on burns the food", "A burst pipe floods the hall", "Doorbells, texts, work events", "Carries out the steps she chose"]),
        ("SYSTEM 1 · JEV: SHE FEELS", JEV, JEV_BG, ["Does my body need something?", "Is something wrong?", "Does someone want me?", "Is something due?", "Does my plan still fit?", "Am I at a loose end?", "+ most pressing, urgency, mood"]),
        ("SYSTEM 2 · LLM: SHE DECIDES", LLM, LLM_BG, ["What she thinks, in her words", "What she does about it", "Whether to finish first", "What to text, whom to call", "What to remember", "A note for System 1", "Nothing else, and never on a timer"]),
    ]
    b = ""
    for i, (t, c, bg, items) in enumerate(cols):
        x = 40 + i * 376
        b += f'  <rect x="{x}" y="100" width="356" height="260" rx="12" fill="{bg}" stroke="{c}" stroke-width="1.6"/>\n'
        b += f'  <text x="{x+20}" y="130" font-size="13" font-weight="700" fill="{c}" letter-spacing="1">{esc(t)}</text>\n'
        b += lines(x + 20, 162, items, 15, INK, 28) + "\n"
    b += f'  <text x="600" y="392" font-size="15" fill="{INK}" text-anchor="middle" font-weight="700">Nothing in the code decides what she wants. If she goes to work, she chose to.</text>\n'
    return frame(1200, 415, "Who owns what", "The world is code. Her feelings are System 1. Her choices are System 2.", b,
                 "Who owns what",
                 "Three columns. Code, the world: clock, rooms, needs rising, a stove burning food, a pipe flooding, doorbells, texts, and carrying out chosen steps. Jev, she feels: six yes-no feelings plus most pressing, urgency and mood. The LLM, she decides: her thoughts, what she does, whether to finish first, texts and calls, what to remember, a note for System One. Bottom line: nothing in the code decides what she wants.")


for name, svg in [("terrarium_loop", fig_loop()), ("terrarium_feelings", fig_feelings()), ("terrarium_numbers", fig_numbers()), ("terrarium_split", fig_split())]:
    open(os.path.join(OUT, f"{name}.svg"), "w").write(svg)
    print("wrote", name)
