import type { FightSession, FightTimelineEvent } from './liveFight';

export type FightPlaybackSnapshot = {
  sequence: number;
  clockBeforeMs: number;
  redCondition: number;
  blueCondition: number;
  redStamina: number;
  blueStamina: number;
  currentRoundStats: FightSession['currentRoundStats'];
};

export type FightDisplayState = {
  clockMs: number;
  redCondition: number;
  blueCondition: number;
  redStamina: number;
  blueStamina: number;
};

type FightDisplaySnapshot = Pick<FightPlaybackSnapshot, 'clockBeforeMs' | 'redCondition' | 'blueCondition' | 'redStamina' | 'blueStamina'>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const interpolate = (from: number, delta: number, progress: number) => from + delta * progress;

export function createFightPlaybackSnapshot(session: FightSession, nextSequence: number): FightPlaybackSnapshot {
  return {
    sequence: nextSequence,
    clockBeforeMs: session.clockMs,
    redCondition: session.red.condition,
    blueCondition: session.blue.condition,
    redStamina: session.red.stamina,
    blueStamina: session.blue.stamina,
    currentRoundStats: structuredClone(session.currentRoundStats)
  };
}

export function advanceFightPlayback(elapsedFightMs: number, elapsedWallMs: number, speed: 0 | 1 | 2 | 4, durationMs: number) {
  const totalFightMs = Math.max(0, elapsedFightMs) + Math.max(0, elapsedWallMs) * speed;
  return {
    elapsedFightMs: Math.min(durationMs, totalFightMs),
    overflowFightMs: Math.max(0, totalFightMs - durationMs)
  };
}

export function advanceFightElapsed(elapsedFightMs: number, elapsedWallMs: number, speed: 0 | 1 | 2 | 4, durationMs: number): number {
  return advanceFightPlayback(elapsedFightMs, elapsedWallMs, speed, durationMs).elapsedFightMs;
}

export function fightPlaybackProgress(elapsedFightMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : clamp01(elapsedFightMs / durationMs);
}

export function remainingFightWallMs(elapsedFightMs: number, durationMs: number, speed: 1 | 2 | 4): number {
  return Math.max(0, durationMs - elapsedFightMs) / speed;
}

export function interpolateFightDisplay(snapshot: FightDisplaySnapshot, event: Pick<FightTimelineEvent, 'clockBeforeMs' | 'clockAfterMs' | 'redConditionDelta' | 'blueConditionDelta' | 'redStaminaDelta' | 'blueStaminaDelta'>, progress: number): FightDisplayState {
  const value = clamp01(progress);
  return {
    clockMs: interpolate(event.clockBeforeMs, event.clockAfterMs - event.clockBeforeMs, value),
    redCondition: interpolate(snapshot.redCondition, event.redConditionDelta, value),
    blueCondition: interpolate(snapshot.blueCondition, event.blueConditionDelta, value),
    redStamina: interpolate(snapshot.redStamina, event.redStaminaDelta, value),
    blueStamina: interpolate(snapshot.blueStamina, event.blueStaminaDelta, value)
  };
}
