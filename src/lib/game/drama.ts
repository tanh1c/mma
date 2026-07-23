import { differenceInCalendarDays } from 'date-fns';
import type { DramaConsequence, DramaIncident, DramaIncidentType, DramaRisk, Fighter, GameState } from '../../types/game';
import '../../i18n';
import { fixedT, type Language } from '../localization';
import { stableCareerSeed } from './career';
import { getPairKey } from './news';
import { applyPromotionTransaction, refreshPromotionEconomy } from './promotionEconomy';
import { addSocialFeedItems } from './social';

export interface DramaResponse {
  key: string;
  risk: DramaRisk;
  consequenceKeys: string[];
}

const RESPONSES: Record<DramaIncidentType, DramaResponse[]> = {
  weight_cut: [
    { key: 'accept_catchweight', risk: 'medium', consequenceKeys: ['hype', 'opponent_morale'] },
    { key: 'fine_fighter', risk: 'low', consequenceKeys: ['money', 'fighter_morale'] },
    { key: 'replace_or_cancel', risk: 'high', consequenceKeys: ['booking'] }
  ],
  camp_injury: [
    { key: 'rest_and_continue', risk: 'medium', consequenceKeys: ['fatigue'] },
    { key: 'replace_or_cancel', risk: 'high', consequenceKeys: ['booking'] }
  ],
  trash_talk: [
    { key: 'amplify', risk: 'medium', consequenceKeys: ['hype', 'rivalry'] },
    { key: 'deescalate', risk: 'low', consequenceKeys: ['morale'] }
  ],
  press_altercation: [
    { key: 'fine_both', risk: 'low', consequenceKeys: ['money', 'morale'] },
    { key: 'use_for_hype', risk: 'high', consequenceKeys: ['hype', 'reputation'] }
  ],
  pay_demand: [
    { key: 'improve_terms', risk: 'low', consequenceKeys: ['money', 'morale'] },
    { key: 'hold_line', risk: 'medium', consequenceKeys: ['morale'] }
  ],
  short_notice_refusal: [
    { key: 'respect_refusal', risk: 'low', consequenceKeys: ['morale'] },
    { key: 'apply_pressure', risk: 'high', consequenceKeys: ['morale', 'reputation'] }
  ],
  title_picture_complaint: [
    { key: 'promise_eliminator', risk: 'medium', consequenceKeys: ['morale'] },
    { key: 'reject_demand', risk: 'low', consequenceKeys: ['morale'] }
  ]
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const fullName = (fighter: Fighter) => `${fighter.firstName} ${fighter.lastName}`;

function incidentType(red: Fighter, blue: Fighter, triggerKey: string): DramaIncidentType {
  const traits = new Set([...red.personalityTraits, ...blue.personalityTraits]);
  if (traits.has('hot_head')) return 'press_altercation';
  if (traits.has('trash_talker')) return 'trash_talk';
  if (traits.has('diva')) return 'title_picture_complaint';
  if (traits.has('mercenary')) return 'pay_demand';
  if (traits.has('risk_taker')) return 'camp_injury';
  return stableCareerSeed(triggerKey, 'type') % 2 ? 'weight_cut' : 'camp_injury';
}

function shouldCreateIncident(state: GameState, red: Fighter, blue: Fighter, fightImportance: number, triggerKey: string): boolean {
  const traitWeight = [...red.personalityTraits, ...blue.personalityTraits].reduce((total, trait) => total + (['hot_head', 'trash_talker', 'diva', 'mercenary', 'risk_taker'].includes(trait) ? 18 : -4), 0);
  const scale = state.promotion.reputation * 0.35 + Math.min(25, Math.log10(Math.max(10, state.promotion.fanbase)) * 5);
  const stars = (red.popularity + blue.popularity) * 0.18;
  const threshold = clamp(18 + traitWeight + scale + stars + fightImportance, 8, 88);
  return stableCareerSeed(triggerKey, 'roll') % 100 < threshold;
}

function responseKeys(type: DramaIncidentType): string[] {
  return RESPONSES[type].map(response => response.key);
}

function responseLabel(responseKey: string, language: Language): string {
  const t = fixedT(language);
  const labels: Record<string, string> = {
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
  };
  return labels[responseKey] ?? responseKey;
}

function getFight(state: GameState, incident: DramaIncident) {
  const event = incident.eventId ? state.events[incident.eventId] : undefined;
  const fight = event?.fights.find(candidate => candidate.id === incident.fightId);
  return { event, fight };
}

export function getValidDramaResponses(state: GameState, incident: DramaIncident): DramaResponse[] {
  const { event, fight } = getFight(state, incident);
  if (incident.eventId && (!event || event.isCompleted || !fight)) return [];
  return RESPONSES[incident.type].filter(response => response.key !== 'replace_or_cancel' || !fight?.tournamentId);
}

export function expireStaleDramaIncidents(state: GameState): GameState {
  let changed = false;
  const incidents = Object.fromEntries(Object.entries(state.drama.incidents).map(([id, incident]) => {
    if (incident.status !== 'pending' || getValidDramaResponses(state, incident).length) return [id, incident];
    changed = true;
    return [id, { ...incident, status: 'expired' as const, expiredReason: 'stale_reference', resolvedDate: state.currentDate }];
  }));
  return changed ? { ...state, drama: { ...state.drama, incidents } } : state;
}

const IDENTITY_PREFERENCES: Record<GameState['drama']['promoterIdentity'], string[]> = {
  meritocracy: ['promise_eliminator', 'fine_fighter', 'fine_both', 'deescalate', 'hold_line'],
  spectacle: ['use_for_hype', 'amplify', 'accept_catchweight', 'apply_pressure'],
  prospect_builder: ['rest_and_continue', 'respect_refusal', 'improve_terms', 'promise_eliminator'],
  conservative: ['fine_fighter', 'fine_both', 'deescalate', 'hold_line', 'respect_refusal', 'reject_demand']
};

export function chooseObserverDramaResponse(state: GameState, incident: DramaIncident): { responseKey: string; rationaleKey: string } | null {
  const valid = getValidDramaResponses(state, incident);
  if (!valid.length) return null;
  const identity = state.drama.promoterIdentity;
  const { fight } = getFight(state, incident);
  const lead = state.fighters[incident.fighterIds[0]];
  const preferred = IDENTITY_PREFERENCES[identity];
  const scored = valid.map(response => {
    let score = Math.max(0, preferred.length - preferred.indexOf(response.key)) * 4;
    let factor = 'identity';
    if (!preferred.includes(response.key)) score = 0;
    if (response.key === 'replace_or_cancel') {
      score += identity === 'conservative' ? 3 : -8;
      factor = 'booking';
    }
    if (state.promotion.money < 100_000 && response.key === 'improve_terms') {
      score -= 10;
      factor = 'cash_safety';
    }
    if ((fight?.isTitleFight || fight?.tournamentId) && ['amplify', 'use_for_hype', 'promise_eliminator'].includes(response.key)) {
      score += identity === 'spectacle' || identity === 'meritocracy' ? 5 : 1;
      factor = 'event_importance';
    }
    if (lead && (lead.careerPhase === 'developing' || lead.age <= 25) && ['rest_and_continue', 'respect_refusal', 'improve_terms'].includes(response.key)) {
      score += identity === 'prospect_builder' ? 6 : 1;
      factor = 'fighter_development';
    }
    if (lead?.personalityTraits.includes('company_fighter') && ['hold_line', 'deescalate'].includes(response.key)) score += 2;
    return { response, score, factor, tie: stableCareerSeed(incident.id, response.key, identity) };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie || a.response.key.localeCompare(b.response.key));
  const selected = scored[0];
  return { responseKey: selected.response.key, rationaleKey: `generated.drama.rationale.${identity}.${selected.factor}` };
}

export function resolveObserverDrama(state: GameState, language: Language = 'en'): GameState {
  if (state.mode !== 'observer') return state;
  let nextState = state;
  for (const incident of Object.values(state.drama.incidents).filter(item => item.status === 'pending').sort((a, b) => a.id.localeCompare(b.id))) {
    const choice = chooseObserverDramaResponse(nextState, incident);
    if (!choice) continue;
    nextState = resolveDramaIncident(nextState, incident.id, choice.responseKey, 'observer', choice.rationaleKey, language);
    const resolved = nextState.drama.incidents[incident.id];
    if (resolved.status !== 'resolved' || !nextState.lastAutopilotSummary) continue;
    const consequences = resolved.consequences ?? [];
    nextState = {
      ...nextState,
      lastAutopilotSummary: {
        ...nextState.lastAutopilotSummary,
        drama: {
          incidentsResolved: (nextState.lastAutopilotSummary.drama?.incidentsResolved ?? 0) + 1,
          bookingChanges: (nextState.lastAutopilotSummary.drama?.bookingChanges ?? 0) + consequences.filter(item => item.kind === 'booking').length,
          moneyChange: (nextState.lastAutopilotSummary.drama?.moneyChange ?? 0) + consequences.filter(item => item.kind === 'money').reduce((total, item) => total + item.value, 0),
          socialHypeChange: (nextState.lastAutopilotSummary.drama?.socialHypeChange ?? 0) + consequences.filter(item => item.kind === 'social_hype').reduce((total, item) => total + item.value, 0)
        }
      }
    };
  }
  return nextState;
}

export function generateScheduledDrama(state: GameState, date: string = state.currentDate, _language: Language = 'en'): GameState {
  const triggerKeys = [...state.drama.triggerKeys];
  const triggerSet = new Set(triggerKeys);
  const incidents = { ...state.drama.incidents };
  const month = date.slice(0, 7);
  let monthCount = Object.values(incidents).filter(incident => incident.createdDate.startsWith(month)).length;
  const events = Object.values(state.events)
    .filter(event => !event.isCompleted && event.date >= date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const event of events) {
    const daysUntil = differenceInCalendarDays(new Date(event.date), new Date(date));
    if (daysUntil !== 7 && daysUntil !== 14) continue;
    let eventCount = Object.values(incidents).filter(incident => incident.eventId === event.id).length;
    for (const fight of [...event.fights].sort((a, b) => a.id.localeCompare(b.id))) {
      const triggerKey = `drama:${date}:${event.id}:${fight.id}:${daysUntil}`;
      if (triggerSet.has(triggerKey)) continue;
      triggerSet.add(triggerKey);
      triggerKeys.push(triggerKey);
      if (monthCount >= 4 || eventCount >= 2 || Object.values(incidents).some(incident => incident.fightId === fight.id)) continue;
      const red = state.fighters[fight.redCornerId];
      const blue = state.fighters[fight.blueCornerId];
      if (!red || !blue || red.careerPhase === 'retired' || blue.careerPhase === 'retired') continue;
      const importance = fight.isTitleFight ? 18 : fight.tournamentId ? 12 : 0;
      if (!shouldCreateIncident(state, red, blue, importance, triggerKey)) continue;
      const type = incidentType(red, blue, triggerKey);
      const severityRoll = stableCareerSeed(triggerKey, 'severity') % 100;
      const severity = severityRoll < 8 + Math.floor(state.promotion.reputation / 10) ? 'critical' : severityRoll < 45 ? 'major' : 'minor';
      const id = `incident:${event.id}:${fight.id}:${daysUntil}`;
      incidents[id] = {
        id,
        type,
        severity,
        status: 'pending',
        createdDate: date,
        fighterIds: [red.id, blue.id],
        eventId: event.id,
        fightId: fight.id,
        responseKeys: responseKeys(type)
      };
      monthCount++;
      eventCount++;
    }
  }

  if (triggerKeys.length === state.drama.triggerKeys.length && Object.keys(incidents).length === Object.keys(state.drama.incidents).length) return state;
  return { ...state, drama: { ...state.drama, triggerKeys, incidents } };
}

export function hasPendingIncidentForEvent(state: GameState, eventId: string): boolean {
  return Object.values(state.drama.incidents).some(incident => incident.eventId === eventId && incident.status === 'pending');
}

function updateFighter(fighters: Record<string, Fighter>, fighterId: string, changes: Partial<Pick<Fighter, 'morale' | 'popularity' | 'fatigue' | 'titleShotPromised'>>): DramaConsequence[] {
  const fighter = fighters[fighterId];
  if (!fighter) return [];
  const consequences: DramaConsequence[] = [];
  const next = { ...fighter };
  for (const [kind, raw] of Object.entries(changes)) {
    if (kind === 'titleShotPromised') {
      next.titleShotPromised = Boolean(raw);
      continue;
    }
    const key = kind as 'morale' | 'popularity' | 'fatigue';
    const before = fighter[key];
    next[key] = clamp(Number(raw));
    const value = next[key] - before;
    if (value) consequences.push({ kind: key === 'fatigue' ? 'fatigue' : key, value, fighterId, descriptionKey: `generated.drama.consequence.${key}` });
  }
  fighters[fighterId] = next;
  return consequences;
}

export function resolveDramaIncident(
  state: GameState,
  incidentId: string,
  responseKey: string,
  resolverMode: 'manager' | 'observer',
  rationaleKey?: string,
  language: Language = 'en'
): GameState {
  const incident = state.drama.incidents[incidentId];
  if (!incident || incident.status !== 'pending') return state;
  const valid = getValidDramaResponses(state, incident);
  if (!valid.length) {
    return {
      ...state,
      drama: { ...state.drama, incidents: { ...state.drama.incidents, [incidentId]: { ...incident, status: 'expired', expiredReason: 'stale_reference', resolvedDate: state.currentDate } } }
    };
  }
  if (!valid.some(response => response.key === responseKey)) return state;

  const t = fixedT(language);
  let transactionState = state;
  const fighters = { ...state.fighters };
  const events = { ...state.events };
  let promotion = { ...state.promotion };
  let storylines = [...state.storylines];
  const consequences: DramaConsequence[] = [];
  const [leadId, opponentId] = incident.fighterIds;
  const { event, fight } = getFight(state, incident);
  const strongOutcome = stableCareerSeed(incident.id, responseKey, 'outcome') % 100 < 45;
  const fighterDelta = (fighterId: string, changes: Parameters<typeof updateFighter>[2]) => consequences.push(...updateFighter(fighters, fighterId, changes));
  const promotionDelta = (kind: 'money' | 'reputation' | 'fanbase', value: number) => {
    if (kind === 'money') {
      const result = applyPromotionTransaction(transactionState, {
        id: `drama-${incident.id}-${responseKey}`,
        promotionId: state.playerPromotionId,
        date: state.currentDate,
        settlementKey: `drama-${incident.id}`,
        category: 'drama',
        amount: value,
        transactionClass: value > 0 ? 'income' : 'discretionary',
        sourceId: incident.id,
        descriptionKey: 'generated.drama.consequence.money',
        repayLiabilities: value > 0
      });
      if (!result.ok) return false;
      transactionState = result.state;
      promotion = transactionState.promotion;
      consequences.push({ kind, value, descriptionKey: 'generated.drama.consequence.money' });
      return true;
    }
    const before = promotion[kind];
    promotion = { ...promotion, [kind]: kind === 'fanbase' ? Math.max(0, before + value) : clamp(before + value) };
    const applied = promotion[kind] - before;
    if (applied) consequences.push({ kind, value: applied, descriptionKey: `generated.drama.consequence.${kind}` });
    return true;
  };
  const hypeDelta = (value: number) => {
    if (!event || !fight) return;
    events[event.id] = { ...event, fights: event.fights.map(candidate => candidate.id === fight.id ? { ...candidate, socialHype: clamp((candidate.socialHype ?? 0) + value, 0, 10) } : candidate) };
    consequences.push({ kind: 'social_hype', value, fightId: fight.id, descriptionKey: 'generated.drama.consequence.social_hype' });
  };

  switch (responseKey) {
    case 'accept_catchweight': hypeDelta(2); fighterDelta(opponentId, { morale: (fighters[opponentId]?.morale ?? 50) - 5 }); break;
    case 'fine_fighter': promotionDelta('money', 5_000); fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) - 8 }); break;
    case 'rest_and_continue': fighterDelta(leadId, { fatigue: (fighters[leadId]?.fatigue ?? 0) + (strongOutcome ? 6 : 12) }); break;
    case 'amplify': {
      hypeDelta(3);
      const pairKey = getPairKey(incident.fighterIds);
      const rivalry = storylines.find(item => item.type === 'Rivalry' && getPairKey(item.fighterIds) === pairKey && item.isActive);
      if (rivalry) storylines = storylines.map(item => item.id === rivalry.id ? { ...item, intensity: Math.min(5, (item.intensity ?? 1) + 1) } : item);
      else storylines.unshift({ id: `drama-rivalry-${pairKey}`, type: 'Rivalry', fighterIds: incident.fighterIds, description: t($ => $.generated.drama.rivalryDescription), isActive: true, intensity: 2, createdDate: state.currentDate });
      consequences.push({ kind: 'rivalry', value: 1, descriptionKey: 'generated.drama.consequence.rivalry' });
      break;
    }
    case 'deescalate': fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) + 3 }); break;
    case 'fine_both': promotionDelta('money', 10_000); fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) - 4 }); fighterDelta(opponentId, { morale: (fighters[opponentId]?.morale ?? 50) - 4 }); break;
    case 'use_for_hype': hypeDelta(3); promotionDelta('reputation', strongOutcome ? 1 : -2); break;
    case 'improve_terms': if (!promotionDelta('money', -10_000)) return state; fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) + 8 }); break;
    case 'hold_line': fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) - (strongOutcome ? 4 : 10) }); break;
    case 'respect_refusal': fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) + 4 }); break;
    case 'apply_pressure': fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) - 10 }); promotionDelta('reputation', strongOutcome ? 0 : -1); break;
    case 'promise_eliminator': fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) + 8 }); break;
    case 'reject_demand': fighterDelta(leadId, { morale: (fighters[leadId]?.morale ?? 50) - 6 }); break;
    case 'replace_or_cancel': {
      if (event && fight && !fight.tournamentId) {
        events[event.id] = { ...event, fights: event.fights.filter(candidate => candidate.id !== fight.id) };
        consequences.push({ kind: 'booking', value: -1, fightId: fight.id, descriptionKey: 'generated.drama.consequence.booking' });
      }
      break;
    }
  }

  const resolvedIncident: DramaIncident = { ...incident, status: 'resolved', selectedResponseKey: responseKey, resolverMode, rationaleKey, resolvedDate: state.currentDate, consequences };
  const lead = fighters[leadId] ?? state.fighters[leadId];
  const title = t($ => $.generated.drama.decisionTitle);
  const body = t($ => $.generated.drama.decisionBody, { fighter: lead ? fullName(lead) : t($ => $.generated.drama.unknownFighter), response: responseLabel(responseKey, language) });
  let nextState: GameState = {
    ...transactionState,
    fighters,
    events,
    promotion,
    promotions: {
      ...transactionState.promotions,
      [state.playerPromotionId]: promotion
    },
    storylines,
    drama: { ...state.drama, incidents: { ...state.drama.incidents, [incidentId]: resolvedIncident }, cooldowns: { ...state.drama.cooldowns, [`${leadId}:${incident.type}`]: state.currentDate } },
    news: [{ id: `drama-news-${incident.id}`, date: state.currentDate, type: 'general', title, content: body }, ...state.news.filter(item => item.id !== `drama-news-${incident.id}`)]
  };
  nextState = refreshPromotionEconomy(nextState, state.playerPromotionId);
  nextState = addSocialFeedItems(nextState, [{
    id: `drama-social-${incident.id}`,
    stableKey: `drama:${incident.id}:resolved`,
    date: state.currentDate,
    kind: 'article',
    headline: title,
    body,
    authorType: 'media',
    authorName: 'Cage Wire',
    fighterIds: incident.fighterIds,
    eventId: incident.eventId,
    fightId: incident.fightId,
    engagement: { likes: 20 + stableCareerSeed(incident.id, 'likes') % 200, comments: 5 + stableCareerSeed(incident.id, 'comments') % 50, shares: 2 + stableCareerSeed(incident.id, 'shares') % 30 }
  }]);
  return nextState;
}
