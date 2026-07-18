import type { GameState, SeasonObjective, SeasonObjectiveCategory, SeasonObjectiveKind, SeasonSnapshot } from '../../types/game';
import '../../i18n';
import { fixedT, type Language } from '../localization';
import { stableCareerSeed } from './career';

const snapshot = (state: GameState, year: number): SeasonSnapshot => ({
  year,
  money: state.promotion.money,
  reputation: state.promotion.reputation,
  fanbase: state.promotion.fanbase,
  signedFighters: Object.values(state.fighters).filter(fighter => fighter.contract && fighter.careerPhase !== 'retired').length
});

function objective(state: GameState, year: number, category: SeasonObjectiveCategory, kind: SeasonObjectiveKind, target: number): SeasonObjective {
  return { id: `objective-${year}-${category}-${kind}`, year, category, kind, target, progress: 0, completed: false, rewardGranted: false };
}

function candidates(state: GameState, year: number, category: SeasonObjectiveCategory): SeasonObjective[] {
  if (category === 'sporting') {
    const result = [objective(state, year, category, 'title_fights', 2), objective(state, year, category, 'prospect_top_five', 1)];
    if (Object.values(state.titles).some(title => title.undisputedChampionId || title.interimChampionId)) result.push(objective(state, year, category, 'active_champion', 1));
    return result;
  }
  if (category === 'entertainment') {
    const result = [objective(state, year, category, 'strong_rivalry', 1), objective(state, year, category, 'award_candidate', 1)];
    if (Object.values(state.tournaments).some(tournament => tournament.status !== 'cancelled') || Object.values(state.fighters).filter(fighter => fighter.contract && fighter.careerPhase !== 'retired').length >= 8) result.push(objective(state, year, category, 'profitable_grand_prix', 1));
    return result;
  }
  return [objective(state, year, category, 'profit', Math.max(25_000, Math.round(Math.max(1, state.promotion.money) * 0.1))), objective(state, year, category, 'fanbase_growth', Math.max(500, Math.round(state.promotion.fanbase * 0.1)))];
}

export function ensureSeasonObjectives(state: GameState, year: number): GameState {
  if (state.drama.objectives[year]) return state;
  const categories: SeasonObjectiveCategory[] = ['sporting', 'entertainment', 'business'];
  const objectives = categories.flatMap(category => {
    const valid = candidates(state, year, category).sort((a, b) => a.id.localeCompare(b.id));
    return valid.length ? [valid[stableCareerSeed(state.promotion.id, year, category) % valid.length]] : [];
  });
  return {
    ...state,
    drama: {
      ...state.drama,
      objectives: { ...state.drama.objectives, [year]: objectives },
      seasonSnapshots: { ...state.drama.seasonSnapshots, [year]: state.drama.seasonSnapshots[year] ?? snapshot(state, year) }
    }
  };
}

export function getSeasonObjectiveProgress(state: GameState, item: SeasonObjective): number {
  const year = item.year.toString();
  const start = state.drama.seasonSnapshots[item.year] ?? snapshot(state, item.year);
  switch (item.kind) {
    case 'active_champion': return Object.values(state.titles).some(title => title.undisputedChampionId || title.interimChampionId) ? 1 : 0;
    case 'title_fights': return Object.values(state.fightArchive).filter(fight => fight.date.startsWith(year) && fight.isTitleFight).length;
    case 'prospect_top_five': return Object.values(state.rankings).flat().filter(rank => rank.rank <= 5 && (state.fighters[rank.fighterId]?.age ?? 99) <= 25).length;
    case 'profitable_grand_prix': return Object.values(state.tournaments).filter(tournament => tournament.completedDate?.startsWith(year) && tournament.fights.some(slot => slot.eventId && (state.eventArchive[slot.eventId]?.profit ?? 0) > 0)).length;
    case 'strong_rivalry': return state.storylines.filter(storyline => storyline.type === 'Rivalry' && (storyline.intensity ?? 1) >= 3 && (storyline.createdDate ?? year).startsWith(year)).length;
    case 'award_candidate': return Object.values(state.yearlyAwards?.[item.year] ?? {}).filter(Boolean).length ? 1 : 0;
    case 'profit': return Math.max(0, state.promotion.money - start.money - (state.financeLedger ?? []).filter(entry => entry.id.startsWith('objective-reward-') && entry.affectsCash).reduce((total, entry) => total + entry.amount, 0));
    case 'fanbase_growth': return Math.max(0, state.promotion.fanbase - start.fanbase);
  }
}

export function refreshSeasonObjectives(state: GameState, year: number, language: Language = 'en'): GameState {
  const initialized = ensureSeasonObjectives(state, year);
  const t = fixedT(language);
  const objectiveLabels: Record<SeasonObjectiveKind, string> = {
    active_champion: t($ => $.objectives.kinds.activeChampion),
    title_fights: t($ => $.objectives.kinds.titleFights),
    prospect_top_five: t($ => $.objectives.kinds.prospectTopFive),
    profitable_grand_prix: t($ => $.objectives.kinds.profitableGrandPrix),
    strong_rivalry: t($ => $.objectives.kinds.strongRivalry),
    award_candidate: t($ => $.objectives.kinds.awardCandidate),
    profit: t($ => $.objectives.kinds.profit),
    fanbase_growth: t($ => $.objectives.kinds.fanbaseGrowth)
  };
  const current = initialized.drama.objectives[year] ?? [];
  let promotion = initialized.promotion;
  let financeLedger = [...(initialized.financeLedger ?? [])];
  let changed = initialized !== state;
  const objectives = current.map(item => {
    const progress = getSeasonObjectiveProgress(initialized, item);
    const completed = progress >= item.target;
    let rewardGranted = item.rewardGranted;
    if (completed && !rewardGranted) {
      rewardGranted = true;
      const reward = 10_000;
      promotion = { ...promotion, money: promotion.money + reward };
      financeLedger = [{ id: `objective-reward-${item.id}`, date: initialized.currentDate, type: 'other', amount: reward, description: t($ => $.generated.objectives.reward, { kind: objectiveLabels[item.kind] }), affectsCash: true, isSummary: false }, ...financeLedger.filter(entry => entry.id !== `objective-reward-${item.id}`)];
    }
    if (progress !== item.progress || completed !== item.completed || rewardGranted !== item.rewardGranted) changed = true;
    return { ...item, progress, completed, rewardGranted };
  });
  if (!changed) return state;
  return { ...initialized, promotion, financeLedger, drama: { ...initialized.drama, objectives: { ...initialized.drama.objectives, [year]: objectives } } };
}

export function finalizeSeasonReview(state: GameState, year: number, language: Language = 'en'): GameState {
  if (state.drama.seasonReviews[year]) return state;
  const refreshed = refreshSeasonObjectives(state, year, language);
  const objectives = refreshed.drama.objectives[year] ?? [];
  const completedObjectives = objectives.filter(item => item.completed).length;
  const start = refreshed.drama.seasonSnapshots[year] ?? snapshot(refreshed, year);
  const improved = refreshed.promotion.money > start.money || refreshed.promotion.fanbase > start.fanbase || refreshed.promotion.reputation > start.reputation;
  const grade = completedObjectives === 3 ? 'S' : completedObjectives === 2 ? 'A' : completedObjectives === 1 ? 'B' : improved ? 'C' : 'D';
  const topIncident = Object.values(refreshed.drama.incidents).filter(incident => incident.status === 'resolved' && incident.resolvedDate?.startsWith(year.toString())).sort((a, b) => {
    const impact = (incident: typeof a) => (incident.consequences ?? []).reduce((total, consequence) => total + Math.abs(consequence.value), 0);
    return impact(b) - impact(a) || a.id.localeCompare(b.id);
  })[0];
  return {
    ...refreshed,
    drama: {
      ...refreshed.drama,
      seasonReviews: {
        ...refreshed.drama.seasonReviews,
        [year]: { year, objectiveIds: objectives.map(item => item.id), completedObjectives, grade, topIncidentId: topIncident?.id, snapshot: snapshot(refreshed, year) }
      }
    }
  };
}
