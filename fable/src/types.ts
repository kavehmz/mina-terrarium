// Shared types. Vocabulary: tick, state, question, concern, fire, escalate, plan, step, compact, directive.
import type { Step } from "./world.ts";

export type RoomId = "bedroom" | "bathroom" | "kitchen" | "living" | "hall";
export type Place = RoomId | "outside";

// Who an event is about. "sense" events are one person's private perception. "sensor" = a device changed.
export type EventSource = "sensor" | "world" | "viewer" | "mind" | "sense" | "mina" | "otto";

export interface WorldEvent { id: number; t: number; source: EventSource; text: string }

export const REFLEXES = ["none", "turn_off_stove", "turn_off_tap", "wake_other"] as const;
export type ReflexId = (typeof REFLEXES)[number];

// TypeSafe question and answer shapes (POST /v1/systemone).
export interface NoulQ { type: "noul"; instructions: unknown; criteria?: { true?: unknown; false?: unknown } }
export interface ChoiceQ { type: "choice"; instructions: unknown; criteria: Record<string, unknown> }
export interface ScoreQ { type: "score"; instructions: unknown; criteria: unknown[] }
export type Question = NoulQ | ChoiceQ | ScoreQ;
export interface NoulA { type: "noul"; noul: number }
export interface ChoiceA { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
export interface ScoreA { type: "score"; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number }
export type Answer = NoulA | ChoiceA | ScoreA;
export interface JevResult { model: string; answers: Record<string, Answer>; usage: { input_tokens: number; output_tokens: number }; latencyMs: number; mock: boolean }

// A concern is one feeling the fast layer keeps checking. `a` is a leaky integrator of the yes-probability `p`.
export interface Concern { id: string; label: string; question: NoulQ; a: number; p: number; firedAt: number | null; refractoryUntil: number; fireCount: number; source: "base" | "mind" }
export interface Directive { text: string; since: number; simSince: number; from: string }
export interface Thought { t: number; simClock: string; kind: "thought" | "act" | "sleep" | "note" | "error"; text: string }
export interface MemoryItem { id: number; t: number; text: string }
export interface StoryItem { t: number; simClock: string; who: string; kind: "life" | "sense" | "act" | "mind" | "sleep" | "viewer" | "world"; text: string }

export interface MindInput {
  person: string;
  life: string;
  reason: string;
  senses: unknown;
  recent: string[];
  memory_summary: string;
  directive: string | null;
  current_plan: unknown;
  compact: boolean;
  compact_items?: string[];
}
export interface MindReply {
  thought: string;
  plan_label: string;
  plan: Step[];
  directive: string;
  memory_summary: string;
  model: string;
  mock: boolean;
  latencyMs: number;
}
