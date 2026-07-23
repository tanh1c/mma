import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { fightSpriteCycleDuration, fightSpriteFrameDelay, fightSpriteFrameIndex, fightSpritePlaybackSegment, fightSpriteSourceSegmentDuration, fightSpriteStrikeOffset, loadFightSpriteManifest, resolveFightSpriteScene, type FightSpriteAction, type FightSpriteManifest } from '../lib/game/fightSprites';
import type { FightCorner, FightSession, FightTimelineEvent } from '../lib/game/liveFight';

type Props = {
  session: FightSession;
  latestEvent?: FightTimelineEvent;
  eventElapsedMs: number;
  onReady: () => void;
  onAssetError: () => void;
};

export function FightSpriteStage({ session, latestEvent, eventElapsedMs, onReady, onAssetError }: Props) {
  const [manifest, setManifest] = useState<FightSpriteManifest | null>(null);
  const failed = useRef(false);
  const reportAssetError = useCallback(() => {
    if (failed.current) return;
    failed.current = true;
    onAssetError();
  }, [onAssetError]);

  useEffect(() => {
    let active = true;
    loadFightSpriteManifest().then(value => {
      if (!active) return;
      setManifest(value);
      onReady();
    }).catch(reportAssetError);
    return () => { active = false; };
  }, [onReady, reportAssetError]);

  if (!manifest) return <div className="min-w-0 overflow-hidden rounded-xl border border-[#2a2c31] bg-neutral-950/60 pb-[52%] sm:pb-[42%]" aria-hidden="true" />;

  const event = latestEvent ?? idleEvent(session);
  const scene = resolveFightSpriteScene(event);
  const redAction = manifest.actions[scene.red.animationId];
  const blueAction = manifest.actions[scene.blue.animationId];
  if (!redAction || !blueAction) return null;
  const strikeOffset = event.visual.action === 'strike' || event.visual.action === 'knockdown'
    ? fightSpriteStrikeOffset(event.visual.strike ?? 'hook')
    : undefined;
  const actorAction = event.actor === 'blue' ? blueAction : redAction;
  const impactFrame = actorAction.impactFrames[0];
  const eventDurationMs = event.durationMs;
  const pairedSceneHasFollowUp = Boolean(
    redAction.interaction?.syncPartner === scene.blue.animationId &&
    blueAction.interaction?.syncPartner === scene.red.animationId &&
    (scene.red.followUpAnimationId || scene.blue.followUpAnimationId)
  );
  const sourceDurationMs = fightSpriteSourceSegmentDuration(actorAction, eventDurationMs, Boolean(event.actor === 'blue' ? scene.blue.followUpAnimationId : scene.red.followUpAnimationId));
  const impactElapsedMs = impactFrame === undefined ? 0 : Math.min(sourceDurationMs, fightSpriteFrameDelay(actorAction, impactFrame, 1));
  const effectElapsedMs = Math.max(0, eventElapsedMs - impactElapsedMs);
  const preloadActions = [...new Map([redAction, blueAction, scene.effect && manifest.actions[scene.effect.animationId]].filter((action): action is FightSpriteAction => Boolean(action)).map(action => [action.path, action])).values()];

  return <div className="relative min-w-0 overflow-hidden rounded-xl border border-[#2a2c31] bg-[radial-gradient(circle_at_50%_78%,#3f3f46_0,#18181b_42%,#09090b_72%)] pb-[52%] sm:pb-[42%]" aria-hidden="true">
    {preloadActions.map(action => <img key={action.path} src={`/sprites/${action.path}`} alt="" className="hidden" onError={reportAssetError} />)}
    <div className="absolute inset-x-[8%] bottom-[12%] h-[18%] rounded-[50%] border border-neutral-700/70 bg-neutral-900/70" />
    <SpriteStrip action={redAction} animationId={scene.red.animationId} followUpAnimationId={scene.red.followUpAnimationId} manifest={manifest} eventDurationMs={eventDurationMs} eventElapsedMs={eventElapsedMs} shareSceneSplit={pairedSceneHasFollowUp} corner="red" actor={event.actor} strikeOffset={strikeOffset} onAssetError={onAssetError} />
    <SpriteStrip action={blueAction} animationId={scene.blue.animationId} followUpAnimationId={scene.blue.followUpAnimationId} manifest={manifest} eventDurationMs={eventDurationMs} eventElapsedMs={eventElapsedMs} shareSceneSplit={pairedSceneHasFollowUp} corner="blue" actor={event.actor} strikeOffset={strikeOffset} onAssetError={onAssetError} />
    {scene.effect && eventElapsedMs >= impactElapsedMs && manifest.actions[scene.effect.animationId] && <EffectStrip action={manifest.actions[scene.effect.animationId]} anchor={scene.effect.anchor} actor={event.actor} strikeOffset={strikeOffset} durationMs={Math.max(1, eventDurationMs - impactElapsedMs)} elapsedMs={effectElapsedMs} onAssetError={onAssetError} />}
  </div>;
}

function SpriteStrip({ action, animationId, followUpAnimationId, manifest, eventDurationMs, eventElapsedMs, shareSceneSplit, corner, actor, strikeOffset, onAssetError }: {
  action: FightSpriteAction;
  animationId: string;
  followUpAnimationId?: string;
  manifest: FightSpriteManifest;
  eventDurationMs: number;
  eventElapsedMs: number;
  shareSceneSplit: boolean;
  corner: FightCorner;
  actor?: FightCorner;
  strikeOffset?: number;
  onAssetError: () => void;
}) {
  const followUp = followUpAnimationId ? manifest.actions[followUpAnimationId] : undefined;
  const segment = fightSpritePlaybackSegment(action, followUp, eventDurationMs, eventElapsedMs, shareSceneSplit);
  const current = segment.action;
  const paired = Boolean(current.interaction);
  const interactionOffset = current.interaction?.interactionOffset ?? { x: 0, y: 0 };
  const pairDirection = actor === 'blue' ? -1 : 1;
  const offsetX = paired
    ? -interactionOffset.x / manifest.frameSize.width * 100 * pairDirection
    : strikeOffset === undefined ? 0 : corner === 'red' ? -strikeOffset : strikeOffset;
  const offsetY = paired ? interactionOffset.y / manifest.frameSize.height * 100 : 0;
  const left = paired ? 50 : strikeOffset === undefined ? corner === 'red' ? 28 : 72 : 50;
  const mirror = paired
    ? Boolean(current.interaction?.mirrorAtRuntime) !== (actor === 'blue')
    : corner === 'blue' && current.mirrorForLeft;
  const style = stripStyle(current, segment.elapsedMs, mirror);

  return <div className="absolute bottom-[8%] w-[46%] max-w-72 sm:w-[40%]" style={{ left: `${left}%`, transform: `translate(calc(-50% + ${offsetX}%), ${offsetY}%)` }}>
    <img src={`/sprites/${current.path}`} alt="" className="hidden" onError={onAssetError} />
    <div
      key={`${animationId}-${current.path}`}
      className="fight-sprite-frame aspect-square w-full"
      style={style}
      data-animation={animationId}
      onError={onAssetError}
    />
  </div>;
}

function EffectStrip({ action, anchor, actor, strikeOffset, durationMs, elapsedMs, onAssetError }: {
  action: FightSpriteAction;
  anchor: 'actor' | 'target' | 'contact';
  actor?: FightCorner;
  strikeOffset?: number;
  durationMs: number;
  elapsedMs: number;
  onAssetError: () => void;
}) {
  if (!action.loop && !action.holdLast && elapsedMs >= fightSpriteCycleDuration(action, 1)) return null;
  const actorLeft = actor === 'blue' ? 72 : 28;
  const actorOffset = (actor === 'blue' ? 1 : -1) * (strikeOffset ?? 0);
  const effectOffset = anchor === 'contact' ? 0 : anchor === 'actor' ? actorOffset : -actorOffset;
  const left = strikeOffset === undefined
    ? anchor === 'contact' ? 50 : anchor === 'actor' ? actorLeft : 100 - actorLeft
    : 50;
  return <div className="pointer-events-none absolute bottom-[8%] w-[46%] max-w-72 sm:w-[40%]" style={{ left: `${left}%`, transform: `translateX(calc(-50% + ${effectOffset}%))` }}>
    <div className="fight-sprite-effect fight-sprite-frame aspect-square w-full" style={stripStyle(action, Math.min(durationMs, elapsedMs), false)} onError={onAssetError} />
  </div>;
}

function stripStyle(action: FightSpriteAction, elapsedMs: number, mirror: boolean): CSSProperties {
  const frame = fightSpriteFrameIndex(action, elapsedMs);
  return {
    backgroundImage: `url(/sprites/${action.path})`,
    backgroundSize: `${action.frameCount * 100}% 100%`,
    backgroundPosition: `${frame / Math.max(1, action.frameCount - 1) * 100}% 0`,
    transform: mirror ? 'scaleX(-1)' : undefined
  };
}

function idleEvent(session: FightSession): FightTimelineEvent {
  return {
    sequence: 0,
    round: session.round,
    clockBeforeMs: session.clockMs,
    clockAfterMs: session.clockMs,
    durationMs: 0,
    importance: 'routine',
    type: 'round-start',
    positionBefore: session.position,
    positionAfter: session.position,
    redConditionDelta: 0,
    blueConditionDelta: 0,
    redStaminaDelta: 0,
    blueStaminaDelta: 0,
    headline: '',
    commentary: '',
    intensity: 0,
    visual: { action: 'idle', intensity: 'light' }
  };
}
