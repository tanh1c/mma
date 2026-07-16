import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { getPromotionInbox, type InboxSeverity } from '../lib/game/inbox';
import { Button, PageHeader, Panel, StatusBadge } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';

const tones: Record<InboxSeverity, 'danger' | 'warning' | 'success'> = {
  critical: 'danger',
  urgent: 'warning',
  opportunity: 'success'
};

export default function Inbox() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const state = useGameStore();
  const items = useMemo(() => getPromotionInbox(state, language), [state, language]);
  const severityLabel = (severity: InboxSeverity) => severity === 'critical' ? t($ => $.inbox.severity.critical) : severity === 'urgent' ? t($ => $.inbox.severity.urgent) : t($ => $.inbox.severity.opportunity);

  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader eyebrow={t($ => $.inbox.eyebrow)} title={t($ => $.inbox.title)} description={t($ => $.inbox.description)} actions={<Button variant="quiet" onClick={() => state.goBack('dashboard')}>{t($ => $.common.back)}</Button>} />
    <Panel className="space-y-3">
      {items.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">{t($ => $.inbox.empty)}</p> : items.map(item => <article key={item.id} className="flex flex-col gap-3 rounded border border-[#2a2c31] bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <StatusBadge tone={tones[item.severity]}>{severityLabel(item.severity)}</StatusBadge>
          <h2 className="mt-2 text-sm font-semibold text-white">{item.title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{item.description}</p>
        </div>
        <Button variant="secondary" onClick={() => state.setView(item.targetView, { fighterId: item.fighterId, eventId: item.eventId, calendarSlotId: item.calendarSlotId })}>{t($ => $.inbox.review)}</Button>
      </article>)}
    </Panel>
  </div>;
}
