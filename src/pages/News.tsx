import { useGameStore } from '../store/gameStore';
import { PageHeader, Panel, StatusBadge } from '../components/ui';

export default function News() {
  const { news, storylines } = useGameStore();
  const activeStorylines = storylines.filter(storyline => storyline.isActive);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <PageHeader eyebrow="Promotion record" title="News & Storylines" description="Follow active narratives and the latest promotion updates." />

      {activeStorylines.length > 0 && (
        <section>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Active storylines</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {activeStorylines.map(storyline => (
              <Panel key={storyline.id} className="p-4">
                <h2 className="text-base font-normal tracking-[-0.02em] text-white">{storyline.type}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{storyline.description}</p>
              </Panel>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-500">Recent news feed</p>
        <div className="space-y-3">
          {news.length === 0 ? (
            <Panel className="text-sm text-neutral-500">No news yet.</Panel>
          ) : (
            news.map(item => (
              <Panel key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:gap-6">
                <time className="shrink-0 font-mono text-xs text-neutral-500 sm:w-24">{item.date}</time>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-normal tracking-[-0.02em] text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{item.content}</p>
                  <div className="mt-3"><StatusBadge>{item.type}</StatusBadge></div>
                </div>
              </Panel>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
