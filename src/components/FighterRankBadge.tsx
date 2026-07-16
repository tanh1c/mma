import { getFighterRankContext, type RankLabel } from '../lib/game/rankings';
import { useGameStore } from '../store/gameStore';

export function FighterRankBadge({ fighterId, snapshot, former, prefix }: { fighterId?: string; snapshot?: RankLabel | string; former?: RankLabel | string; prefix?: string }) {
  const state = useGameStore();
  const context = fighterId ? getFighterRankContext(state, fighterId) : null;
  const label = snapshot ?? context?.label;
  if (!label) return null;
  const text = former ? `Former ${former} · ${label}` : prefix ? `${prefix} ${label}` : label;
  const title = former ? `Former promotion rank ${former}; currently ${context?.description ?? label}` : prefix ? `${prefix}: ${label}` : context?.description ?? label;
  return <span title={title} aria-label={title} className="inline-flex shrink-0 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-neutral-300">{text}</span>;
}
