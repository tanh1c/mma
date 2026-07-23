import assert from 'node:assert/strict';
import { generateInitialWorld } from './src/lib/game/generator';
import { createInternationalGrandPrixTournament, ensureAnnualInternationalCompetitions, getInternationalQualifiers } from './src/lib/game/internationalCompetitions';
import { autoBookEventsAndContracts } from './src/lib/game/autobooker';
import { applyTournamentProgression } from './src/lib/game/tournament';
import { advanceTime, syncChampionFlags } from './src/lib/engine';

let state = generateInitialWorld(1806);
const qualifiers = getInternationalQualifiers(state, 'Lightweight', 'champions_cup');
assert.equal(qualifiers.participantIds.length, 8);
assert.ok(new Set(qualifiers.participantIds.map(id => state.fighters[id].contract?.promotionId)).size >= 2);
assert.ok(qualifiers.participantIds.every(id => state.fighters[id].weightClass === 'Lightweight'));

const domesticTitlesBefore = structuredClone(state.titlesByPromotion);
const playerMoneyBefore = state.promotion.money;
state = createInternationalGrandPrixTournament(state, {
  weightClass: 'Lightweight',
  tier: 'champions_cup',
  name: 'Lightweight World Champions Cup',
  participantIds: qualifiers.participantIds,
  reserveIds: qualifiers.reserveIds
}, 'en');
const tournament = Object.values(state.tournaments).find(item => item.scope === 'international')!;
assert.equal(tournament.promotionId, null);
assert.equal(tournament.titleShotPromised, false);
assert.equal(tournament.internationalTier, 'champions_cup');
assert.deepEqual(state.titlesByPromotion, domesticTitlesBefore);
assert.equal(state.promotion.money, playerMoneyBefore);

let completed = state;
const tournamentId = tournament.id;
for (const round of ['quarterfinal', 'semifinal', 'final'] as const) {
  for (const slot of completed.tournaments[tournamentId].fights.filter(item => item.round === round)) {
    completed = applyTournamentProgression(completed, tournamentId, slot.id, slot.redFighterId!, slot.blueFighterId!, 'en');
  }
}
const winnerId = completed.tournaments[tournamentId].winnerId!;
const internationalTitle = completed.internationalTitles.champions_cup.Lightweight;
assert.equal(internationalTitle.undisputedChampionId, winnerId);
assert.equal(internationalTitle.status, 'active');
assert.equal(completed.fighters[winnerId].isChampion, true);
assert.deepEqual(completed.titlesByPromotion, domesticTitlesBefore);
assert.equal(completed.promotion.money, playerMoneyBefore);
assert.ok(completed.titleHistory.some(item => item.scope === 'international' && item.promotionId === null && item.beltId === tournament.winnerBeltId && item.fighterId === winnerId && item.status === 'active'));
const domesticChampionIds = new Set(Object.values(completed.titlesByPromotion).flatMap(titles => Object.values(titles).flatMap(title => [title.undisputedChampionId, title.interimChampionId]).filter((id): id is string => Boolean(id))));
const internationalOnlyChampionId = qualifiers.participantIds.find(id => !domesticChampionIds.has(id))!;
assert.ok(internationalOnlyChampionId);
const syncFixture = {
  ...completed,
  fighters: { ...completed.fighters, [internationalOnlyChampionId]: { ...completed.fighters[internationalOnlyChampionId], isChampion: false } },
  internationalTitles: {
    ...completed.internationalTitles,
    champions_cup: {
      ...completed.internationalTitles.champions_cup,
      Lightweight: { ...completed.internationalTitles.champions_cup.Lightweight, undisputedChampionId: internationalOnlyChampionId }
    }
  }
};
const resynced = syncChampionFlags(syncFixture);
assert.equal(resynced.fighters[internationalOnlyChampionId].isChampion, true);
assert.deepEqual(resynced.titlesByPromotion, domesticTitlesBefore);

const annualBase = generateInitialWorld(1807);
const annual = ensureAnnualInternationalCompetitions(annualBase, 2025, 'en');
assert.equal(annual.internationalCompetitionYears.includes(2025), true);
assert.equal(Object.values(annual.tournaments).filter(item => item.scope === 'international').length, 12);
assert.deepEqual(ensureAnnualInternationalCompetitions(annual, 2025, 'en'), annual);

const protectedBase = structuredClone(annual);
const protectedTournament = Object.values(protectedBase.tournaments).find(item => item.scope === 'international' && item.status === 'planned')!;
const protectedFighterId = protectedTournament.participants[0].fighterId;
const protectedOwnerId = protectedBase.fighters[protectedFighterId].contract!.promotionId;
protectedBase.currentDate = '2025-06-15';
protectedBase.fighters[protectedFighterId] = {
  ...protectedBase.fighters[protectedFighterId],
  isChampion: false,
  contract: { ...protectedBase.fighters[protectedFighterId].contract!, endDate: '2025-06-15' }
};
const protectedAdvance = advanceTime(protectedBase, 1, 'en');
assert.equal(protectedAdvance.fighters[protectedFighterId].contract?.promotionId, protectedOwnerId);

const rosterBoundary = structuredClone(state);
const protectedParticipantId = rosterBoundary.tournaments[tournamentId].participants.find(participant => {
  const fighter = rosterBoundary.fighters[participant.fighterId];
  return fighter.contract?.promotionId !== rosterBoundary.playerPromotionId && !fighter.isChampion;
})!.fighterId;
const protectedParticipant = rosterBoundary.fighters[protectedParticipantId];
const protectedParticipantOwnerId = protectedParticipant.contract!.promotionId;
rosterBoundary.promotion = { ...rosterBoundary.promotion, money: 0 };
rosterBoundary.promotions[rosterBoundary.playerPromotionId] = rosterBoundary.promotion;
for (const fighter of Object.values(rosterBoundary.fighters).filter(item => item.weightClass === protectedParticipant.weightClass && item.contract)) {
  rosterBoundary.fighters[fighter.id] = {
    ...fighter,
    contract: { ...fighter.contract!, fightsRemaining: fighter.id === protectedParticipantId ? 1 : 4 }
  };
}
const rosterAdvance = autoBookEventsAndContracts(rosterBoundary, 'en');
assert.equal(rosterAdvance.fighters[protectedParticipantId].contract?.promotionId, protectedParticipantOwnerId);

const dueBase = structuredClone(annual);
dueBase.currentDate = '2025-06-30';
dueBase.sponsorDeals = [];
dueBase.mediaDeals = [];
dueBase.financeLedger = [];
for (const objectives of Object.values(dueBase.drama.objectives)) {
  for (const objective of objectives) objective.rewardGranted = true;
}
const due = advanceTime(dueBase, 1, 'en');
assert.ok(Object.values(due.events).some(event => event.scope === 'international' && event.promotionId === null));
const internationalEventIds = new Set(Object.values(due.events).filter(event => event.scope === 'international').map(event => event.id));
assert.ok(due.promotionEconomies[due.playerPromotionId].ledger.every(entry => !entry.sourceId || !internationalEventIds.has(entry.sourceId)));
assert.ok(Object.values(due.eventArchive).every(event => event.scope !== 'international' || event.promotionId === null));
for (const tournament of Object.values(due.tournaments).filter(item => item.scope === 'international')) {
  for (const slot of tournament.fights.filter(item => item.isCompleted && item.eventId)) {
    assert.ok(slot.fightArchiveId, `Completed international tournament slot ${slot.id} must link to its fight archive.`);
    assert.equal(due.fightArchive[slot.fightArchiveId!]?.tournamentId, tournament.id);
    assert.equal(due.fightArchive[slot.fightArchiveId!]?.tournamentRound, slot.round);
  }
}

console.log('International competition checks passed.');
