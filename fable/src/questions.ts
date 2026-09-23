// The standing questions one person's System One asks every tick. Judgment in `instructions`, answers in `criteria`.
// Ids are for code only; each question carries its full meaning. Backticked paths point into the state.
import type { ChoiceQ, Concern, NoulQ, ScoreQ } from "./types.ts";

function concern(id: string, label: string, question: NoulQ): Concern {
  return { id, label, question, a: 0, p: 0, firedAt: null, refractoryUntil: 0, fireCount: 0, source: "base" };
}

export function baseConcerns(): Concern[] {
  return [
    concern("attention", "Something calls for attention", {
      type: "noul",
      instructions: "I am the person in `me`. Considering my body in `me.body`, what I see in `here`, what I `heard`, the people in `others` and my `messages`, is there something that calls for my attention now, rather than simply carrying on with `me.doing`?",
      criteria: {
        true: "A need is pressing (hunger, tiredness, needing a shower, boredom, missing the other person), something is wrong or unusual, someone may need me, a message wants an answer, my plan has ended or no longer fits, or it is time for something in my life.",
        false: "Carry on. Nothing needs deciding right now. If I am asleep (`me.state`), only an alarm, danger, a loud disturbance, a message, or being fully rested in the morning counts.",
      },
    }),
    concern("unusual", "Something is wrong", {
      type: "noul",
      instructions: "Is something unusual, risky or worrying happening: in the house (`here`, `heard`), with me (`me.state`), or with the people in `others`?",
      criteria: {
        true: "Smoke or fire, an alarm, water on the floor, power out, the front door open, the stove on with nobody cooking, someone else in the house on the floor or silent far longer than normal, a strange message, me being unable to get up.",
        false: "An ordinary moment. Alarms quiet, the house as expected, the other person where they usually would be.",
      },
    }),
    concern("other", "People I care about", {
      type: "noul",
      instructions: "Looking at `others`, `messages` and `me.body.connection`, might someone I care about need me, or is it time to reach out to someone: a text, a call, a chat?",
      criteria: {
        true: "No contact with anyone for unusually long given the time of day, someone in the house seems unwell or still, a message asks me something, or I feel lonely and could text or call.",
        false: "I am in touch with people, we spoke recently, or it is not a time to reach out (deep night, mid-task).",
      },
    }),
    concern("duty", "Time for something I must do", {
      type: "noul",
      instructions: "Given the `time`, my `my_life` facts and what I am doing (`me.doing`, `me.plan`), is it time, or nearly time, for something I must do, such as leaving for work, being back when expected, or going to bed for an early start, and I have not started on it?",
      criteria: {
        true: "An obligation is due within about half an hour (or overdue) and my current plan does not lead to it.",
        false: "No obligation is close, or I am already on my way to it, or it is a day off.",
      },
    }),
    concern("stale", "My plan is out of date", {
      type: "noul",
      instructions: "Given my body, the time, `heard` and `others`, is what I am doing now (`me.doing`, `me.plan`, `me.step`) no longer the right thing?",
      criteria: {
        true: "The plan's reason has passed, something more important came up, it runs against the time of day or my obligations, or it is finished.",
        false: "The plan still makes sense; keep going.",
      },
    }),
  ];
}

export function needQuestion(): ChoiceQ {
  return {
    type: "choice",
    instructions: "Which of these is most pressing for me right now, judging by `me.body`, the `time`, my life and what is happening around me?",
    criteria: {
      none: "Nothing pressing; carry on or relax.",
      hunger: "I am hungry and it is a reasonable time to eat.",
      sleep: "I am tired, or it is late at night and I should sleep.",
      hygiene: "I feel grubby and should shower.",
      boredom: "I am restless and want something to do.",
      connection: "I want contact with someone: talk, call or text.",
      obligation: "Something in my life I must do around now, such as leaving for work on time or being back when expected.",
      safety: "Danger to me, the other person or the house: alarm, smoke, fire, water, someone on the floor.",
      message: "A message on my phone wants an answer.",
    },
  };
}

export function urgencyQuestion(): ScoreQ {
  return {
    type: "score",
    instructions: "How urgent is the most pressing thing for me right now?",
    criteria: [
      "Nothing pressing. Ordinary life.",
      "Minor. It can wait some minutes or an hour.",
      "Serious. I should act within a minute or two.",
      "Emergency. Danger to life or to the home right now.",
    ],
  };
}

export function reflexQuestion(): ChoiceQ {
  return {
    type: "choice",
    instructions: "Is there a small reflex action I should do right now, without thinking, where I stand? Prefer `none` unless the situation is right here in front of me.",
    criteria: {
      none: "No reflex needed.",
      turn_off_stove: "I am in the kitchen, the stove is on, and there is smoke, fire, or nobody is cooking.",
      turn_off_tap: "I am in the bathroom and the tap is running with nobody using it, or the floor is flooding.",
      wake_other: "Someone else is asleep in the same room and there is danger: smoke, fire, an alarm.",
    },
  };
}

export function relevanceQuestion(memoryText: string): NoulQ {
  return {
    type: "noul",
    instructions: { memory: memoryText, question: "Is `memory` still worth keeping for me (a person living in this house with a partner), given `current_summary`, `directive` and the current `time`?" },
    criteria: {
      true: "An incident, a decision, a conversation, a message, a change that still matters, or something about the other person's pattern.",
      false: "Routine detail the summary already covers or that no longer matters.",
    },
  };
}
