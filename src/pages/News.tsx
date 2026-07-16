import { useState } from 'react';
import { MessageCircle, Newspaper, Repeat2, ThumbsUp } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { Button, PageHeader, Panel, StatusBadge } from '../components/ui';
import { FighterAvatar } from '../components/FighterAvatar';
import { FighterRankBadge } from '../components/FighterRankBadge';
import type { SocialFeedItem, SocialFeedKind } from '../types/game';

const filters: Array<{ label: string; kinds?: SocialFeedKind[] }> = [
  { label: 'All' },
  { label: 'News', kinds: ['news', 'promotion_post'] },
  { label: 'Articles', kinds: ['article'] },
  { label: 'Fighter Posts', kinds: ['fighter_post'] },
  { label: 'Threads', kinds: ['thread'] }
];

export default function News() {
  const { socialFeed, storylines, fighters, events, currentDate, setView, applyPromotionSocialAction } = useGameStore();
  const [filter, setFilter] = useState('All');
  const selected = filters.find(item => item.label === filter)!;
  const feed = socialFeed.filter(item => !selected.kinds || selected.kinds.includes(item.kind));
  const activeStorylines = storylines.filter(storyline => storyline.isActive);
  const actionKeys = new Set(socialFeed.map(item => item.actionKey).filter(Boolean));
  const upcoming = Object.values(events).filter(event => !event.isCompleted && event.date >= currentDate).flatMap(event => event.fights.map(fight => ({ event, fight }))).slice(0, 4);

  return <div className="space-y-6 pb-12">
    <PageHeader eyebrow="The fight world" title="Social Hub" description="News, articles, fighter posts, fan threads, and the stories shaping your promotion." />
    <div className="flex flex-wrap gap-2 pb-1" aria-label="Social Hub filters">{filters.map(item => <button key={item.label} type="button" aria-pressed={filter === item.label} onClick={() => setFilter(item.label)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${filter === item.label ? 'border-white bg-white text-black' : 'border-neutral-800 text-neutral-400 hover:text-white'}`}>{item.label}</button>)}</div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-3" aria-label="Social feed">
        {feed.length === 0 ? <Panel className="text-sm text-neutral-500">No posts match this filter. Book fights, advance time, or simulate an event to create activity.</Panel> : feed.map(entry => <SocialCard key={entry.id} entry={entry} fighters={fighters} events={events} setView={setView} />)}
      </section>

      <aside className="space-y-5 lg:order-none">
        <section><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Trending Storylines</h2><div className="mt-3 space-y-3">{activeStorylines.length === 0 ? <Panel className="text-sm text-neutral-500">No active drama yet.</Panel> : activeStorylines.slice(0, 6).map(storyline => <Panel key={storyline.id} className="p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-medium text-white">{storyline.type}</h3>{storyline.intensity && <StatusBadge tone={storyline.intensity >= 3 ? 'danger' : 'warning'}>Intensity {storyline.intensity}/3</StatusBadge>}</div><p className="mt-2 text-sm leading-6 text-neutral-400">{storyline.description}</p><div className="mt-3 flex flex-wrap gap-2">{storyline.fighterIds.flatMap(id => fighters[id] ? [<button key={id} type="button" onClick={() => setView('fighter-detail', { fighterId: id })} className="text-xs text-neutral-300 underline decoration-neutral-700 underline-offset-4 hover:text-white"><FighterRankBadge fighterId={id} /> {fighters[id].firstName} {fighters[id].lastName}</button>] : [])}</div>{storyline.expiresDate && <p className="mt-3 font-mono text-[10px] text-neutral-600">Expires {storyline.expiresDate}</p>}</Panel>)}</div></section>
        {upcoming.length > 0 && <section><h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Promote upcoming fights</h2><div className="mt-3 space-y-3">{upcoming.map(({ event, fight }) => { const red = fighters[fight.redCornerId]; const blue = fighters[fight.blueCornerId]; if (!red || !blue) return null; const announceUsed = actionKeys.has(`fight:${fight.id}:promotion-announce`); const hypeUsed = actionKeys.has(`fight:${fight.id}:promotion-hype`); return <Panel key={fight.id} className="p-4"><button type="button" onClick={() => setView('event-builder', { eventId: event.id })} className="text-left text-sm font-medium text-white hover:text-neutral-300"><FighterRankBadge fighterId={red.id} /> {red.lastName} vs <FighterRankBadge fighterId={blue.id} /> {blue.lastName}</button><p className="mt-1 font-mono text-[10px] text-neutral-500">{event.name} · {event.date}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={announceUsed} onClick={() => applyPromotionSocialAction(fight.id, 'announce')} className="text-xs">{announceUsed ? 'Announced' : 'Announce matchup'}</Button><Button variant="primary" disabled={hypeUsed} onClick={() => applyPromotionSocialAction(fight.id, 'hype')} className="text-xs">{hypeUsed ? 'Hyped' : 'Hype fight'}</Button></div></Panel>; })}</div></section>}
      </aside>
    </div>
  </div>;
}

function SocialCard({ entry, fighters, events, setView }: { key?: string; entry: SocialFeedItem; fighters: ReturnType<typeof useGameStore.getState>['fighters']; events: ReturnType<typeof useGameStore.getState>['events']; setView: ReturnType<typeof useGameStore.getState>['setView'] }) {
  const author = entry.authorFighterId ? fighters[entry.authorFighterId] : null;
  const event = entry.eventId ? events[entry.eventId] : null;
  return <Panel className="p-4 sm:p-5"><div className="flex items-start gap-3">{author ? <FighterAvatar id={author.id} name={`${author.firstName} ${author.lastName}`} nationality={author.nationality} className="h-10 w-10" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950"><Newspaper size={16} className="text-neutral-500" /></span>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="flex items-center gap-1 font-medium text-white">{author && <FighterRankBadge fighterId={author.id} />}{entry.authorName}</span><StatusBadge>{entry.kind.replace('_', ' ')}</StatusBadge><time className="font-mono text-[10px] text-neutral-600">{entry.date}</time></div><h2 className="mt-3 text-lg font-medium tracking-[-0.02em] text-white">{entry.headline}</h2><p className="mt-2 text-sm leading-6 text-neutral-400">{entry.body}</p><div className="mt-3 flex flex-wrap gap-2">{entry.fighterIds.flatMap(id => fighters[id] ? [<button key={id} type="button" onClick={() => setView('fighter-detail', { fighterId: id })} className="rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-600 hover:text-white"><FighterRankBadge fighterId={id} /> {fighters[id].firstName} {fighters[id].lastName}</button>] : [])}{event && <button type="button" onClick={() => setView('event-builder', { eventId: event.id })} className="rounded-full border border-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-600 hover:text-white">{event.name}</button>}</div>{entry.replies && <div className="mt-4 space-y-2 border-l border-neutral-800 pl-3">{entry.replies.map(reply => <div key={reply.id}><p className="text-xs font-medium text-neutral-300">{reply.authorName}</p><p className="mt-1 text-sm text-neutral-500">{reply.body}</p></div>)}</div>}<div className="mt-4 flex gap-4 font-mono text-[10px] text-neutral-600"><span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {entry.engagement.likes}</span><span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {entry.engagement.comments}</span><span className="inline-flex items-center gap-1"><Repeat2 size={12} /> {entry.engagement.shares}</span></div></div></div></Panel>;
}
