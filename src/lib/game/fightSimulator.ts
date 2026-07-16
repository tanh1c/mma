import type { Fighter, FightMatchup, FightResult, RoundStats } from '../../types/game';
import { createFightSession, fightSessionToResult, runFightSession } from './liveFight';

export function simulateFight(matchup: FightMatchup, red: Fighter, blue: Fighter, seed?: number): FightResult {
  return fightSessionToResult(runFightSession(createFightSession(matchup, red, blue, seed)));
}

export function validateRoundStats(roundStats: RoundStats[]): string[] {
  const errors: string[] = [];
  roundStats.forEach(rs => {
    [rs.red, rs.blue].forEach((stats, idx) => {
      const corner = idx === 0 ? 'Red' : 'Blue';
      if (!Object.values(stats).every(value => Number.isFinite(value) && value >= 0)) errors.push(`Round ${rs.round} ${corner}: statistics must be finite and non-negative`);
      if (stats.totalStrikesLanded > stats.totalStrikesAttempted) errors.push(`Round ${rs.round} ${corner}: totalLanded (${stats.totalStrikesLanded}) > totalAttempted (${stats.totalStrikesAttempted})`);
      if (stats.significantStrikesLanded > stats.significantStrikesAttempted) errors.push(`Round ${rs.round} ${corner}: sigLanded (${stats.significantStrikesLanded}) > sigAttempted (${stats.significantStrikesAttempted})`);
      if (stats.headStrikesLanded < 0) errors.push(`Round ${rs.round} ${corner}: headStrikes < 0`);
      if (stats.bodyStrikesLanded < 0) errors.push(`Round ${rs.round} ${corner}: bodyStrikes < 0`);
      if (stats.legStrikesLanded < 0) errors.push(`Round ${rs.round} ${corner}: legStrikes < 0`);
      const sumStrikes = stats.headStrikesLanded + stats.bodyStrikesLanded + stats.legStrikesLanded;
      if (sumStrikes > stats.significantStrikesLanded) errors.push(`Round ${rs.round} ${corner}: Head+Body+Leg (${sumStrikes}) > sigLanded (${stats.significantStrikesLanded})`);
      if (stats.takedownsLanded > stats.takedownsAttempted) errors.push(`Round ${rs.round} ${corner}: tdLanded > tdAttempted`);
      if (stats.controlSeconds < 0 || stats.controlSeconds > 300) errors.push(`Round ${rs.round} ${corner}: controlSeconds out of bounds`);
      if (stats.staminaStart < 0 || stats.staminaStart > 100) errors.push(`Round ${rs.round} ${corner}: staminaStart out of bounds`);
      if (stats.staminaEnd < 0 || stats.staminaEnd > 100) errors.push(`Round ${rs.round} ${corner}: staminaEnd out of bounds`);
    });
    if (rs.red.controlSeconds + rs.blue.controlSeconds > 300) errors.push(`Round ${rs.round}: Total control time > 300s`);
    if (rs.judges.length !== 3 || rs.judges.some(judge => ![8, 9, 10].includes(judge.redScore) || ![8, 9, 10].includes(judge.blueScore))) errors.push(`Round ${rs.round}: judges must contain three legal scores`);
  });
  return errors;
}
