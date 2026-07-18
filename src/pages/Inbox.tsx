import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getPromotionInbox, type InboxSeverity } from '../lib/game/inbox';
import { getValidDramaResponses } from '../lib/game/drama';
import { Button, PageHeader, Panel, StatusBadge } from '../components/ui';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore';
import type { DramaIncidentType } from '../types/game';

const tones: Record<InboxSeverity, 'danger' | 'warning' | 'success'> = {
  critical: 'danger',
  urgent: 'warning',
  opportunity: 'success'
};

export default function Inbox() {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const state = useGameStore();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const items = useMemo(() => getPromotionInbox(state, language), [state, language]);
  const incident = selectedIncidentId ? state.drama.incidents[selectedIncidentId] : undefined;
  const responses = incident ? getValidDramaResponses(state, incident) : [];
  const severityLabel = (severity: InboxSeverity) => severity === 'critical' ? t($ => $.inbox.severity.critical) : severity === 'urgent' ? t($ => $.inbox.severity.urgent) : t($ => $.inbox.severity.opportunity);
  const incidentLabel = (key: DramaIncidentType) => ({
    weight_cut: t($ => $.inbox.drama.incident.weightCut),
    camp_injury: t($ => $.inbox.drama.incident.campInjury),
    trash_talk: t($ => $.inbox.drama.incident.trashTalk),
    press_altercation: t($ => $.inbox.drama.incident.pressAltercation),
    pay_demand: t($ => $.inbox.drama.incident.payDemand),
    short_notice_refusal: t($ => $.inbox.drama.incident.shortNoticeRefusal),
    title_picture_complaint: t($ => $.inbox.drama.incident.titlePictureComplaint)
  }[key]);
  const responseLabel = (key: string) => ({
    accept_catchweight: t($ => $.inbox.drama.response.acceptCatchweight),
    fine_fighter: t($ => $.inbox.drama.response.fineFighter),
    replace_or_cancel: t($ => $.inbox.drama.response.replaceOrCancel),
    rest_and_continue: t($ => $.inbox.drama.response.restAndContinue),
    amplify: t($ => $.inbox.drama.response.amplify),
    deescalate: t($ => $.inbox.drama.response.deescalate),
    fine_both: t($ => $.inbox.drama.response.fineBoth),
    use_for_hype: t($ => $.inbox.drama.response.useForHype),
    improve_terms: t($ => $.inbox.drama.response.improveTerms),
    hold_line: t($ => $.inbox.drama.response.holdLine),
    respect_refusal: t($ => $.inbox.drama.response.respectRefusal),
    apply_pressure: t($ => $.inbox.drama.response.applyPressure),
    promise_eliminator: t($ => $.inbox.drama.response.promiseEliminator),
    reject_demand: t($ => $.inbox.drama.response.rejectDemand)
  }[key] ?? key);
  const consequenceLabel = (key: string) => ({
    hype: t($ => $.inbox.drama.consequence.hype),
    opponent_morale: t($ => $.inbox.drama.consequence.opponentMorale),
    money: t($ => $.inbox.drama.consequence.money),
    fighter_morale: t($ => $.inbox.drama.consequence.fighterMorale),
    booking: t($ => $.inbox.drama.consequence.booking),
    fatigue: t($ => $.inbox.drama.consequence.fatigue),
    rivalry: t($ => $.inbox.drama.consequence.rivalry),
    morale: t($ => $.inbox.drama.consequence.morale),
    reputation: t($ => $.inbox.drama.consequence.reputation)
  }[key] ?? key);
  const riskLabel = (risk: 'low' | 'medium' | 'high') => risk === 'low' ? t($ => $.inbox.drama.risk.low) : risk === 'medium' ? t($ => $.inbox.drama.risk.medium) : t($ => $.inbox.drama.risk.high);

  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader eyebrow={t($ => $.inbox.eyebrow)} title={t($ => $.inbox.title)} description={t($ => $.inbox.description)} actions={<Button variant="quiet" onClick={() => state.goBack('dashboard')}>{t($ => $.common.back)}</Button>} />
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Panel className={`${selectedIncidentId ? 'hidden lg:block' : ''} min-w-0 space-y-3`}>
        {items.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">{t($ => $.inbox.empty)}</p> : items.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded border border-[#2a2c31] bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <StatusBadge tone={tones[item.severity]}>{severityLabel(item.severity)}</StatusBadge>
            <h2 className="mt-2 text-sm font-semibold text-white">{item.title}</h2>
            <p className="mt-1 text-sm text-neutral-400">{item.description}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => item.incidentId ? setSelectedIncidentId(item.incidentId) : state.setView(item.targetView, { fighterId: item.fighterId, eventId: item.eventId, calendarSlotId: item.calendarSlotId })}>{t($ => $.inbox.review)}</Button>
        </article>)}
      </Panel>
      <Panel className={`${selectedIncidentId ? '' : 'hidden lg:block'} min-w-0`}>
        {incident ? <div className="min-w-0 space-y-5">
          <Button type="button" variant="quiet" className="lg:hidden" onClick={() => setSelectedIncidentId(null)}>{t($ => $.inbox.drama.backToList)}</Button>
          <div>
            <StatusBadge tone={incident.severity === 'critical' ? 'danger' : 'warning'}>{t($ => $.inbox.drama.decisionRequired)}</StatusBadge>
            <h2 className="mt-3 text-xl text-white">{incidentLabel(incident.type)}</h2>
            <p className="mt-2 text-sm text-neutral-400">{t($ => $.inbox.drama.description)}</p>
          </div>
          <div className="space-y-3">
            {responses.map(response => <div key={response.key} className="min-w-0 rounded border border-[#2a2c31] bg-neutral-950 p-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{responseLabel(response.key)}</h3>
                <StatusBadge tone={response.risk === 'low' ? 'success' : response.risk === 'medium' ? 'warning' : 'danger'}>{t($ => $.inbox.drama.risk.label)}: {riskLabel(response.risk)}</StatusBadge>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">{t($ => $.inbox.drama.consequences)}</p>
              <ul className="mt-2 flex min-w-0 flex-wrap gap-2 text-sm text-neutral-300">
                {response.consequenceKeys.map(key => <li key={key} className="max-w-full rounded bg-white/5 px-2 py-1 [overflow-wrap:anywhere]">{consequenceLabel(key)}</li>)}
              </ul>
              <Button type="button" variant="primary" className="mt-4 min-h-11 w-full" onClick={() => { state.resolveDramaIncident(incident.id, response.key); setSelectedIncidentId(null); }}>{t($ => $.inbox.drama.chooseResponse)}</Button>
            </div>)}
          </div>
        </div> : <p className="py-12 text-center text-sm text-neutral-500">{t($ => $.inbox.drama.selectDecision)}</p>}
      </Panel>
    </div>
  </div>;
}
