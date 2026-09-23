// System One's standing questions. Every tick asks all of them in one Jev request over the same state.
// Ids are for code only; each question carries its full meaning. Backticked paths point into the state
// that brain.mjs builds: now, me, body, senses, phone, time_since, home, my_life, intention, memory.

// Feelings: Nouls that charge a leaky integrator each. When one crosses its line, System Two is called.
export const FEELINGS = [
  {
    id: "body", label: "Body needs something", threshold: 2.0,
    q: {
      type: "noul",
      instructions: {
        question: "Is one of Mina's bodily needs in `body` strong enough that she would want to deal with it soon, and is it not already being dealt with by `intention`?",
        look_at: ["`body`", "`time_since`", "`now.part_of_day`", "`intention`"],
      },
      criteria: {
        true: "A need is at 'hungry', 'tired', 'feels grubby', 'needs the toilet' or stronger (or tiredness late in the evening), and `intention` has no step that takes care of it.",
        false: "Needs are mild, or `intention` already takes care of the strongest one (for example she is cooking or eating while hungry, or heading to bed while tired).",
      },
    },
  },
  {
    id: "wrong", label: "Something is wrong", threshold: 1.2,
    q: {
      type: "noul",
      instructions: {
        question: "Is something wrong, risky or out of place around Mina that she has not dealt with yet?",
        look_at: ["`senses`", "`home.devices_on`", "`body.pain`", "`intention`"],
      },
      criteria: {
        true: "Smoke or a burning smell, an alarm going off, water on the floor, a stove, tap, bath or shower running with nobody using it, the front door left open, no power, pain, or lying on the floor, and `intention` does not already deal with it.",
        false: "Everything is as it should be: anything switched on is being used by what she is doing now, or `intention` already deals with the problem.",
      },
    },
  },
  {
    id: "people", label: "Someone / missing someone", threshold: 2.0,
    q: {
      type: "noul",
      instructions: {
        question: "Does someone want Mina's attention, or does she want contact with someone, and is `intention` not already taking care of it?",
        look_at: ["`phone.unread`", "`senses`", "`home.waiting_for_her_here`", "`body.loneliness`", "`time_since.talked_to_someone`", "`intention`"],
      },
      criteria: {
        true: "An unread message waiting for a reply, someone ringing at the door, someone or something waiting for her where she is (such as a reader, a colleague or a ringing phone at work), or `body.loneliness` is 'lonely' or 'very lonely', and `intention` has no step for it.",
        false: "No unread messages, nobody at the door, nothing waiting for her where she is, and `body.loneliness` is only 'connected' or 'a bit lonely'; or `intention` already has a step for it.",
      },
    },
  },
  {
    id: "duty", label: "Something I must do", threshold: 2.0,
    q: {
      type: "noul",
      instructions: {
        question: "Given the time in `now`, the facts of her life in `my_life` and anything she promised in `memory`, is something Mina must do due within about 30 minutes or already overdue, and `intention` does not lead to it?",
        look_at: ["`now`", "`my_life`", "`memory`", "`me.where`", "`intention`"],
      },
      criteria: {
        true: "She needs to leave now to be somewhere on time (such as work on a workday), an arrangement is due, or she is already late, and `intention` does not get her there.",
        false: "Nothing is due soon, it is her day off, she is already where she has to be, or `intention` already leads to it.",
      },
    },
  },
  {
    id: "stale", label: "My plan no longer fits", threshold: 2.0,
    q: {
      type: "noul",
      instructions: {
        question: "Has the situation changed so that what Mina intends to do in `intention` is no longer the right thing to be doing now?",
        look_at: ["`intention`", "`senses`", "`body`", "`phone`", "`now`"],
      },
      criteria: {
        true: "Something more important has come up since she decided, the reason for the plan has passed, or the plan no longer suits the time of day.",
        false: "The intention still makes sense for what is happening now.",
      },
    },
  },
  {
    id: "restless", label: "At a loose end", threshold: 2.0,
    q: {
      type: "noul",
      instructions: {
        question: "Is Mina at a loose end: nothing left to do in `intention`, only waiting, or bored with what she is doing?",
        look_at: ["`intention`", "`me.doing`", "`body.boredom`"],
      },
      criteria: {
        true: "`intention` has no steps left or she is idle or just waiting, or `body.boredom` is 'bored' or stronger.",
        false: "She is busy with something that holds her attention, or asleep.",
      },
    },
  },
];

export const PRESSING = {
  type: "choice",
  instructions: "What is the single most pressing thing for Mina right now, given `body`, `senses`, `phone`, `now` and `intention`?",
  criteria: {
    nothing: "Nothing pressing; she can carry on with what she is doing.",
    hunger: "She is hungry and it is a sensible time to eat.",
    tiredness: "She is tired, or it is late and time for bed.",
    hygiene: "She feels grubby and wants a wash.",
    toilet: "She needs the toilet.",
    boredom: "She is bored or restless.",
    loneliness: "She misses people and wants contact.",
    message: "A message on her phone wants an answer.",
    door: "Someone is at the door.",
    someone_here: "Someone or something where she is needs her now, such as a reader waiting at work or a ringing phone.",
    obligation: "Something she must do, such as getting to work on time.",
    danger: "Smoke, fire, water, an alarm or something left running in the house.",
    pain: "She is hurt or on the floor.",
  },
};

export const URGENCY = {
  type: "score",
  instructions: "How urgent is the most pressing thing for Mina right now?",
  criteria: [
    "Nothing needs doing now: an ordinary moment.",
    "Minor: it can wait an hour or so.",
    "Soon: she should act within the next few minutes.",
    "Now: danger to her or the home, someone waiting at the door or in front of her this moment, or she is about to be late.",
  ],
};

export const MOOD = {
  type: "score",
  instructions: "How does Mina most likely feel right now, given `body`, `senses`, what happened in `memory` and who she has been in touch with?",
  criteria: ["Miserable or frightened", "Low, fed up or anxious", "Okay, neutral", "Good, comfortable", "Happy, content or delighted"],
};

export const ATTENTION = {
  type: "choice",
  instructions: "What would most catch Mina's attention at this moment?",
  criteria: {
    her_body: "A feeling in her body: hunger, tiredness, pain, needing the toilet.",
    what_she_sees: "Something she sees in the room.",
    a_sound: "A sound: a bell, an alarm, running water, the TV.",
    a_smell: "A smell: cooking, burning, smoke.",
    her_phone: "Her phone: a message or a call.",
    the_time: "The time: being late, the day getting on, time passing.",
    people: "Thinking about people in her life.",
    her_task: "What she is doing right now.",
  },
};

// A tiny automatic action, done without thinking, right where she is. Code only carries it out if it is physically possible.
export const REFLEX = {
  type: "choice",
  instructions: "Is there a tiny automatic action Mina would do this very second, without thinking, right where she is (`me.where`)? Prefer `none` unless it is right in front of her.",
  criteria: {
    none: "No automatic action.",
    switch_off_alarm_clock: "She is in the bedroom, awake, and the alarm clock is ringing.",
    turn_off_stove: "She is in the kitchen and the stove is on with food burning, smoking, or with nobody cooking.",
    turn_off_tap: "She is in the room where a tap is running and nobody is using it.",
  },
};

export function tickQuestions() {
  const q = {};
  for (const f of FEELINGS) q[f.id] = f.q;
  q.pressing = PRESSING;
  q.urgency = URGENCY;
  q.mood = MOOD;
  q.attention = ATTENTION;
  q.reflex = REFLEX;
  return q;
}

// Memory compaction: one Noul per remembered item, all in one request. Jev decides what is worth keeping.
export function relevanceQuestions(n) {
  const q = {};
  for (let i = 0; i < n; i++) {
    q[`keep_${i}`] = {
      type: "noul",
      instructions: {
        question: `Is \`memory.recent[${i}]\` worth Mina remembering for the rest of today and tomorrow, rather than routine detail?`,
        compare_with: "`memory.story_so_far`",
      },
      criteria: {
        true: "A decision, a promise or arrangement, a message or conversation, something that went wrong, a change in the house, or anything about the people in her life.",
        false: "Routine detail (walking somewhere, switching something off, a finished chore) or something the story so far already covers.",
      },
    };
  }
  return q;
}
