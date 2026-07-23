import type { FightCorner, FightTimelineEvent, FightVisualCue } from './liveFight';

export type FightSpriteAction = {
  path: string;
  category: 'fighters' | 'interactions' | 'effects';
  frameCount: number;
  frameSize: { width: number; height: number };
  fps: number;
  durationMs: number;
  loop: boolean;
  holdLast: boolean;
  pivot: { x: number; y: number };
  mirrorForLeft: boolean;
  impactFrames: number[];
  nextAnimation?: string;
  role?: string;
  interaction?: {
    pairGroup: string;
    syncPartner: string;
    interactionOffset: { x: number; y: number };
    mirrorAtRuntime: boolean;
    startFrame: number;
  };
};

export type FightSpriteManifest = {
  version: number;
  frameSize: { width: number; height: number };
  pivot: { x: number; y: number };
  actions: Record<string, FightSpriteAction>;
};

export type FightSpriteScene = {
  red: { animationId: string; followUpAnimationId?: string };
  blue: { animationId: string; followUpAnimationId?: string };
  effect?: { animationId: string; anchor: 'actor' | 'target' | 'contact' };
};

const strikeAnimations = {
  jab: 'fighter-jab',
  cross: 'fighter-cross',
  hook: 'fighter-hook',
  'body-hook': 'fighter-body-hook',
  'low-kick': 'fighter-low-kick',
  'body-kick': 'fighter-body-kick',
  'high-kick': 'fighter-high-kick',
  knee: 'fighter-knee-strike',
  elbow: 'fighter-elbow-strike'
} as const;

const strikeOffsets: Record<NonNullable<FightVisualCue['strike']>, number> = {
  jab: 35,
  cross: 37,
  hook: 29,
  'body-hook': 32,
  'low-kick': 32,
  'body-kick': 35,
  'high-kick': 34,
  knee: 21,
  elbow: 26
};

export function fightSpriteStrikeOffset(strike: NonNullable<FightVisualCue['strike']>): number {
  return strikeOffsets[strike];
}

const allMappedIds = new Set([
  'effect-block', 'effect-dust', 'effect-heavy-hit', 'effect-kick-impact', 'effect-knockdown', 'effect-ko', 'effect-light-hit', 'effect-sweat',
  'fighter-block-high', 'fighter-block-low', 'fighter-body-hook', 'fighter-body-kick', 'fighter-clinch-entry-attacker', 'fighter-clinch-entry-defender',
  'fighter-clinch-idle-attacker', 'fighter-clinch-idle-defender', 'fighter-cross', 'fighter-defeat', 'fighter-dodge', 'fighter-elbow-strike', 'fighter-get-up',
  'fighter-ground-position-bottom', 'fighter-ground-position-top', 'fighter-ground-and-pound-attacker', 'fighter-ground-and-pound-defender', 'fighter-high-kick',
  'fighter-hook', 'fighter-hurt', 'fighter-idle', 'fighter-jab', 'fighter-knee-strike', 'fighter-knockdown', 'fighter-ko', 'fighter-low-kick',
  'fighter-sprawl-attacker', 'fighter-sprawl-defender', 'fighter-stand-up-from-ground', 'fighter-stunned', 'fighter-submission-attempt-attacker',
  'fighter-submission-attempt-defender', 'fighter-submission-finish-attacker', 'fighter-submission-finish-defender', 'fighter-takedown-attacker',
  'fighter-takedown-defender', 'fighter-takedown-defense-attacker', 'fighter-takedown-defense-defender', 'fighter-tap-out', 'fighter-tko-cover',
  'fighter-victory', 'fighter-walk-backward', 'fighter-walk-forward'
]);

const idleScene = (): FightSpriteScene => ({ red: { animationId: 'fighter-idle' }, blue: { animationId: 'fighter-idle' } });

function actorScene(actor: FightCorner | undefined, actorAnimation: string, targetAnimation: string, actorFollowUp?: string, targetFollowUp?: string): FightSpriteScene {
  if (actor === 'blue') return { red: { animationId: targetAnimation, followUpAnimationId: targetFollowUp }, blue: { animationId: actorAnimation, followUpAnimationId: actorFollowUp } };
  return { red: { animationId: actorAnimation, followUpAnimationId: actorFollowUp }, blue: { animationId: targetAnimation, followUpAnimationId: targetFollowUp } };
}

function withEffect(scene: FightSpriteScene, event: FightTimelineEvent): FightSpriteScene {
  const cue = event.visual;
  let animationId: string | undefined;
  let anchor: NonNullable<FightSpriteScene['effect']>['anchor'] = 'target';
  if (cue.action === 'knockdown') animationId = 'effect-knockdown';
  else if (cue.action === 'finish' && cue.finish === 'ko') animationId = 'effect-ko';
  else if (cue.outcome === 'blocked') animationId = 'effect-block';
  else if ((cue.action === 'movement' || cue.action === 'recovery') && event.actor) {
    animationId = 'effect-dust';
    anchor = 'actor';
  } else if (cue.action === 'takedown' || cue.action === 'sprawl') {
    animationId = 'effect-dust';
    anchor = 'contact';
  } else if (cue.action === 'strike' && cue.outcome === 'landed') animationId = cue.strike?.includes('kick') ? 'effect-kick-impact' : cue.intensity === 'heavy' ? 'effect-heavy-hit' : 'effect-light-hit';
  else if ((cue.action === 'idle' || cue.action === 'clinch' || cue.action === 'submission') && cue.intensity === 'heavy' && event.actor) {
    animationId = 'effect-sweat';
    anchor = 'actor';
  }
  return animationId ? { ...scene, effect: { animationId, anchor } } : scene;
}

export function resolveFightSpriteScene(event: FightTimelineEvent): FightSpriteScene {
  const cue = event.visual;
  let scene: FightSpriteScene;
  if (cue.action === 'idle' && event.positionBefore === 'ground') {
    scene = actorScene(event.actor, 'fighter-ground-position-top', 'fighter-ground-position-bottom');
  } else if (cue.action === 'strike' && cue.strike) {
    const targetAnimation = cue.outcome === 'blocked'
      ? cue.targetZone === 'leg' ? 'fighter-block-low' : 'fighter-block-high'
      : cue.outcome === 'dodged' || cue.outcome === 'missed'
        ? 'fighter-dodge'
        : cue.intensity === 'heavy' ? 'fighter-stunned' : 'fighter-hurt';
    scene = actorScene(event.actor, strikeAnimations[cue.strike], targetAnimation, 'fighter-idle', 'fighter-idle');
  } else if (cue.action === 'knockdown') {
    scene = actorScene(event.actor, cue.strike ? strikeAnimations[cue.strike] : 'fighter-hook', 'fighter-knockdown', 'fighter-ground-position-top', 'fighter-ground-position-bottom');
  } else if (cue.action === 'ground-pound') {
    scene = actorScene(event.actor, 'fighter-ground-and-pound-attacker', 'fighter-ground-and-pound-defender', 'fighter-ground-position-top', 'fighter-ground-position-bottom');
  } else if (cue.action === 'clinch') {
    scene = actorScene(event.actor, 'fighter-clinch-entry-attacker', 'fighter-clinch-entry-defender', 'fighter-clinch-idle-attacker', 'fighter-clinch-idle-defender');
  } else if (cue.action === 'takedown') {
    scene = actorScene(event.actor, 'fighter-takedown-attacker', 'fighter-takedown-defender', 'fighter-ground-position-top', 'fighter-ground-position-bottom');
  } else if (cue.action === 'takedown-defense') {
    scene = actorScene(event.actor, 'fighter-takedown-defense-attacker', 'fighter-takedown-defense-defender', 'fighter-clinch-idle-attacker', 'fighter-clinch-idle-defender');
  } else if (cue.action === 'sprawl') {
    scene = actorScene(event.actor, 'fighter-sprawl-attacker', 'fighter-sprawl-defender', 'fighter-clinch-idle-attacker', 'fighter-clinch-idle-defender');
  } else if (cue.action === 'submission') {
    scene = cue.outcome === 'finished'
      ? actorScene(event.actor, 'fighter-submission-finish-attacker', 'fighter-submission-finish-defender', undefined, 'fighter-tap-out')
      : actorScene(event.actor, 'fighter-submission-attempt-attacker', 'fighter-submission-attempt-defender', 'fighter-ground-position-top', 'fighter-ground-position-bottom');
  } else if (cue.action === 'movement') {
    const actorAnimation = cue.transition === 'ground-to-distance' ? 'fighter-stand-up-from-ground' : cue.transition === 'disengage' ? 'fighter-walk-backward' : 'fighter-walk-forward';
    scene = cue.transition === 'ground-to-distance'
      ? actorScene(event.actor, actorAnimation, 'fighter-idle', 'fighter-idle', 'fighter-idle')
      : actorScene(event.actor, actorAnimation, cue.transition === 'close-distance' ? 'fighter-walk-backward' : 'fighter-idle');
  } else if (cue.action === 'recovery') {
    scene = cue.transition === 'ground-to-distance'
      ? actorScene(event.actor, 'fighter-get-up', 'fighter-stand-up-from-ground', 'fighter-idle', 'fighter-idle')
      : idleScene();
  } else if (cue.action === 'finish') {
    if (cue.finish === 'submission') scene = actorScene(event.actor, 'fighter-submission-finish-attacker', 'fighter-tap-out');
    else if (cue.finish === 'draw') scene = { red: { animationId: 'fighter-defeat' }, blue: { animationId: 'fighter-defeat' } };
    else scene = actorScene(event.actor, 'fighter-victory', cue.finish === 'ko' ? 'fighter-ko' : cue.finish === 'tko' || cue.finish === 'doctor' ? 'fighter-tko-cover' : 'fighter-defeat');
  } else {
    scene = idleScene();
  }
  return withEffect(scene, event);
}

export type FightSpritePlaybackSegment = {
  action: FightSpriteAction;
  elapsedMs: number;
  durationMs: number;
  finite: boolean;
};

export function fightSpriteSourceSegmentDuration(action: FightSpriteAction, eventDurationMs: number, hasFollowUp: boolean): number {
  const duration = Math.max(1, eventDurationMs);
  return hasFollowUp
    ? Math.min(duration, fightSpriteCycleDuration(action, 1))
    : duration;
}

export function fightSpritePlaybackSegment(source: FightSpriteAction, followUp: FightSpriteAction | undefined, eventDurationMs: number, eventElapsedMs: number, shareSceneSplit = false): FightSpritePlaybackSegment {
  if (eventDurationMs <= 0) return followUp
    ? { action: followUp, elapsedMs: followUp.holdLast ? 1 : 0, durationMs: 1, finite: true }
    : { action: source, elapsedMs: source.holdLast ? 1 : 0, durationMs: 1, finite: true };
  const duration = Math.max(1, eventDurationMs);
  const sourceDuration = fightSpriteSourceSegmentDuration(source, duration, shareSceneSplit || Boolean(followUp));
  if (eventElapsedMs < sourceDuration || !followUp) return { action: source, elapsedMs: Math.min(sourceDuration, Math.max(0, eventElapsedMs)), durationMs: sourceDuration, finite: true };
  const followUpDuration = Math.max(1, duration - sourceDuration);
  return { action: followUp, elapsedMs: Math.min(followUpDuration, eventElapsedMs - sourceDuration), durationMs: followUpDuration, finite: false };
}

export function fightSpriteDuration(action: FightSpriteAction, playbackSpeed: number): number {
  return Math.max(0, action.frameCount - 1) * action.durationMs / playbackSpeed;
}

export function fightSpriteCycleDuration(action: FightSpriteAction, playbackSpeed: number): number {
  return action.frameCount * action.durationMs / playbackSpeed;
}

export function fightSpriteFrameDelay(action: FightSpriteAction, frame: number, playbackSpeed: number): number {
  return frame * action.durationMs / playbackSpeed;
}

export function fightSpriteFrameIndex(action: FightSpriteAction, elapsedMs: number): number {
  const frame = Math.floor(Math.max(0, elapsedMs) / action.durationMs);
  return action.loop ? frame % action.frameCount : Math.min(action.frameCount - 1, frame);
}

export function mappedFightSpriteActionIds(): ReadonlySet<string> {
  return allMappedIds;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const point = (value: unknown): value is { x: number; y: number } => object(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
const size = (value: unknown): value is { width: number; height: number } => object(value) && Number.isFinite(value.width) && Number.isFinite(value.height);

export function validateFightSpriteManifest(value: unknown): FightSpriteManifest | null {
  if (!object(value) || !Number.isFinite(value.version) || !size(value.frameSize) || !point(value.pivot) || !object(value.actions)) return null;
  for (const action of Object.values(value.actions)) {
    if (!object(action) || typeof action.path !== 'string' || !['fighters', 'interactions', 'effects'].includes(String(action.category)) || !Number.isInteger(action.frameCount) || Number(action.frameCount) < 1 || !size(action.frameSize) || !Number.isFinite(action.fps) || Number(action.fps) <= 0 || !Number.isFinite(action.durationMs) || Number(action.durationMs) <= 0 || typeof action.loop !== 'boolean' || typeof action.holdLast !== 'boolean' || !point(action.pivot) || typeof action.mirrorForLeft !== 'boolean' || !Array.isArray(action.impactFrames)) return null;
    if (action.interaction !== undefined) {
      if (!object(action.interaction) || typeof action.interaction.pairGroup !== 'string' || typeof action.interaction.syncPartner !== 'string' || !point(action.interaction.interactionOffset) || typeof action.interaction.mirrorAtRuntime !== 'boolean' || !Number.isInteger(action.interaction.startFrame)) return null;
    }
  }
  if ([...allMappedIds].some(id => !object(value.actions[id]))) return null;
  return value as unknown as FightSpriteManifest;
}

let manifestPromise: Promise<FightSpriteManifest> | null = null;

export function loadFightSpriteManifest(): Promise<FightSpriteManifest> {
  return manifestPromise ??= fetch('/sprites/fighter-sprites.json').then(response => {
    if (!response.ok) throw new Error(`Sprite manifest failed: ${response.status}`);
    return response.json() as Promise<unknown>;
  }).then(value => {
    const manifest = validateFightSpriteManifest(value);
    if (!manifest) throw new Error('Invalid sprite manifest');
    return manifest;
  });
}
