import React, { useState } from 'react';
import { simulateFight } from '../lib/game/fightSimulator';
import { generateFighter } from '../lib/game/generator';
import { PRNG } from '../lib/game/rng';
import { Fighter, FightMatchup, FightResult } from '../types/game';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '../store/gameStore';
import { createGrandPrixTournament, scheduleSemifinals, scheduleFinal } from '../lib/game/tournament';
import { applyFightResult } from '../lib/engine';

const createFighter = (name: string, attrs: Partial<Fighter['attributes']>, age: number = 28): Fighter => {
  const rng = new PRNG(Math.random());
  const base = generateFighter(rng, 'Journeyman', 'Lightweight');
  return {
    ...base,
    id: uuidv4(),
    firstName: name.split(' ')[0],
    lastName: name.split(' ')[1] || '',
    age,
    attributes: {
      ...base.attributes,
      striking: 50,
      grappling: 50,
      wrestling: 50,
      submissions: 50,
      cardio: 70,
      chin: 70,
      power: 60,
      speed: 60,
      defense: 60,
      fightIq: 60,
      toughness: 70,
      ...attrs
    }
  };
};

const tests = [
  {
    name: "Elite Striker vs Elite Wrestler",
    red: createFighter("Elite Striker", { striking: 95, power: 85, speed: 90, wrestling: 30, grappling: 30, defense: 75, chin: 80, submissions: 20 }),
    blue: createFighter("Elite Wrestler", { wrestling: 95, grappling: 85, striking: 40, power: 50, speed: 70, defense: 75, chin: 80, submissions: 50 })
  },
  {
    name: "Elite Grappler vs Weak Sub Defense",
    red: createFighter("Elite Grappler", { grappling: 95, submissions: 95, wrestling: 85, striking: 50, power: 50 }),
    blue: createFighter("Weak SubDef", { grappling: 20, submissions: 20, wrestling: 50, striking: 85, power: 80 })
  },
  {
    name: "Power Puncher vs Glass Chin",
    red: createFighter("Power Puncher", { striking: 85, power: 98, speed: 80, chin: 80 }),
    blue: createFighter("Glass Chin", { striking: 85, power: 70, speed: 85, chin: 20, toughness: 40 })
  },
  {
    name: "High-Cardio Decision vs Explosive Low-Cardio",
    red: createFighter("Cardio Machine", { cardio: 98, striking: 75, wrestling: 75, power: 50 }),
    blue: createFighter("Explosive Gasser", { cardio: 20, striking: 90, power: 95, speed: 95 })
  },
  {
    name: "Old Veteran vs Young Prospect",
    red: createFighter("Old Veteran", { fightIq: 95, toughness: 95, speed: 40, cardio: 50, striking: 80, wrestling: 80 }, 39),
    blue: createFighter("Young Prospect", { fightIq: 50, toughness: 50, speed: 95, cardio: 95, striking: 85, wrestling: 85 }, 21)
  },
  {
    name: "Equal-Level Balanced Fighters",
    red: createFighter("Balanced Red", { fightIq: 75, toughness: 75, speed: 75, cardio: 75, striking: 75, wrestling: 75, grappling: 75, submissions: 75, power: 75, chin: 75, defense: 75 }),
    blue: createFighter("Balanced Blue", { fightIq: 75, toughness: 75, speed: 75, cardio: 75, striking: 75, wrestling: 75, grappling: 75, submissions: 75, power: 75, chin: 75, defense: 75 })
  },
  {
    name: "Top Contender vs Journeyman",
    red: createFighter("Top Contender", { fightIq: 90, toughness: 85, speed: 85, cardio: 85, striking: 90, wrestling: 85, grappling: 85, submissions: 80, power: 85, chin: 85, defense: 90 }),
    blue: createFighter("Local Journeyman", { fightIq: 60, toughness: 80, speed: 60, cardio: 70, striking: 65, wrestling: 65, grappling: 65, submissions: 60, power: 65, chin: 75, defense: 60 })
  }
];

export default function DebugSim() {
  const store = useGameStore();
  const [results, setResults] = useState<any[]>([]);
  const [report, setReport] = useState<any | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);
  
  const runTournamentTestWorkflow = () => {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      setTestLog([...logs]);
    };
    
    log("Starting Tournament Test Workflow...");
    
    try {
      const lwFighters = Object.values(store.fighters).filter(f => f.weightClass === 'Lightweight');
      if (lwFighters.length < 6) {
        throw new Error("Need at least 6 Lightweight fighters in database to run test.");
      }
      
      log(`Found ${lwFighters.length} Lightweight fighters. Preparing top 6 for tournament...`);
      
      const candidates = lwFighters.slice(0, 6).map((f, i) => {
        return {
          ...f,
          contract: f.contract || { fightsRemaining: 3, payPerFight: 10000, winBonus: 10000, exclusivity: true },
          injuryStatus: null,
          medicalSuspension: null,
          fatigue: 0
        };
      });
      
      let testState: any = {
        ...store,
        fighters: { ...store.fighters },
        tournaments: { ...store.tournaments },
        events: { ...store.events }
      };
      
      candidates.forEach(c => {
        testState.fighters[c.id] = c;
      });
      
      const pIds = candidates.slice(0, 4).map(f => f.id);
      const rIds = candidates.slice(4, 6).map(f => f.id);
      
      log(`Participants: ${candidates.slice(0,4).map(f => f.lastName).join(', ')}`);
      log(`Reserves: ${candidates.slice(4,6).map(f => f.lastName).join(', ')}`);
      
      testState = createGrandPrixTournament(testState, {
        weightClass: 'Lightweight',
        name: 'Debug Test Lightweight Grand Prix',
        titleShotPromised: true,
        participantIds: pIds,
        reserveIds: rIds
      });
      
      const tourneyId = Object.keys(testState.tournaments).find(id => testState.tournaments[id].name === 'Debug Test Lightweight Grand Prix');
      if (!tourneyId) throw new Error("Failed to create tournament.");
      log(`Created Grand Prix with ID: ${tourneyId}`);
      
      const eventId = 'test-evt-semis';
      testState.events[eventId] = {
        id: eventId,
        name: "GP Semifinals Event",
        date: testState.currentDate,
        venueId: Object.keys(testState.venues)[0],
        ticketPrice: 50,
        marketingSpend: 10000,
        fights: [],
        isCompleted: false
      };
      
      log("Scheduling semifinals onto GP Semifinals Event...");
      testState = scheduleSemifinals(testState, tourneyId, eventId);
      
      const t = testState.tournaments[tourneyId];
      const semiSlots = t.fights.filter(f => f.round === 'semifinal');
      if (semiSlots.some(s => !s.fightId)) {
        throw new Error("Semifinal slots are missing fightId after scheduling.");
      }
      log("Semifinals scheduled successfully.");
      
      log("Simulating semifinals event...");
      const eventToSim = testState.events[eventId];
      eventToSim.fights.forEach((fight, idx) => {
         const redF = testState.fighters[fight.redCornerId];
         const blueF = testState.fighters[fight.blueCornerId];
         const res = simulateFight(fight as FightMatchup, redF, blueF);
         testState = applyFightResult(testState, eventId, idx, res);
      });
      
      testState.events[eventId].isCompleted = true;
      log("Semifinal fights simulated.");
      
      const t2 = testState.tournaments[tourneyId];
      const finalSlot = t2.fights.find(f => f.round === 'final');
      if (!finalSlot?.redFighterId || !finalSlot?.blueFighterId) {
        throw new Error("Finalist slots not populated after semifinals simulation.");
      }
      
      const finalist1 = testState.fighters[finalSlot.redFighterId];
      const finalist2 = testState.fighters[finalSlot.blueFighterId];
      log(`Finalists set: ${finalist1.lastName} vs ${finalist2.lastName}`);
      
      log("Testing reserve replacement logic... injuring finalist 1.");
      const origFinalist1Id = finalSlot.redFighterId;
      testState.fighters[origFinalist1Id] = {
        ...testState.fighters[origFinalist1Id],
        injuryStatus: { id: 'test-gp-inj', type: 'Broken Hand', daysRemaining: 30 }
      };
      
      const finalEventId = 'test-evt-final';
      testState.events[finalEventId] = {
        id: finalEventId,
        name: "GP Final Event",
        date: testState.currentDate,
        venueId: Object.keys(testState.venues)[0],
        ticketPrice: 50,
        marketingSpend: 10000,
        fights: [],
        isCompleted: false
      };
      
      log("Scheduling final. Replacement should trigger automatically...");
      testState = scheduleFinal(testState, tourneyId, finalEventId);
      
      const t3 = testState.tournaments[tourneyId];
      const updatedFinalSlot = t3.fights.find(f => f.round === 'final');
      if (updatedFinalSlot?.redFighterId === origFinalist1Id) {
        throw new Error("Replacement did not occur; injured finalist was booked.");
      }
      
      const activeFinalistRed = testState.fighters[updatedFinalSlot!.redFighterId!];
      log(`Replacement successful: Reserve ${activeFinalistRed.lastName} entered the final to replace injured ${testState.fighters[origFinalist1Id].lastName}`);
      
      log("Simulating final event...");
      const finalEventToSim = testState.events[finalEventId];
      finalEventToSim.fights.forEach((fight, idx) => {
         const redF = testState.fighters[fight.redCornerId];
         const blueF = testState.fighters[fight.blueCornerId];
         const res = simulateFight(fight as FightMatchup, redF, blueF);
         testState = applyFightResult(testState, finalEventId, idx, res);
      });
      
      testState.events[finalEventId].isCompleted = true;
      log("Final fight simulated.");
      
      const t4 = testState.tournaments[tourneyId];
      if (t4.status !== 'completed' || !t4.winnerId) {
        throw new Error("Tournament status did not update to completed with winner.");
      }
      
      const winnerF = testState.fighters[t4.winnerId];
      log(`Tournament Winner crowned: ${winnerF.firstName} ${winnerF.lastName}!`);
      
      if (t4.titleShotPromised && !winnerF.titleShotPromised) {
        throw new Error("Winner did not receive the promised title shot flag.");
      }
      log("Promised title shot successfully awarded to winner.");
      
      store.importGame(JSON.stringify(testState));
      log("Tournament Workflow Test passed successfully! State updated locally.");
      
    } catch (err: any) {
      log(`❌ TEST FAILED: ${err.message}`);
      alert(`Test Failed: ${err.message}`);
    }
  };

  const runTest = (testIdx: number) => {
    const test = tests[testIdx];
    let redWins = 0;
    let blueWins = 0;
    let draws = 0;
    let totalRounds = 0;
    let totalPerformance = 0;
    let finishes = 0;
    let decisions = 0;
    let docStoppages = 0;
    let koTkoCount = 0;
    let subCount = 0;
    let tenEightCount = 0;
    let totalJudgeScores = 0;
    let medSuspensions = 0;
    let upsetCount = 0; // blue (underdog) wins - only meaningful for test index 6
    const methods: Record<string, number> = {};
    let sampleCommentary: string[] = [];
    let roundStatsErrors = 0;

    const simCount = 200;

    for (let i = 0; i < simCount; i++) {
      const matchup: FightMatchup = {
        id: uuidv4(),
        redCornerId: test.red.id,
        blueCornerId: test.blue.id,
        weightClass: 'Lightweight',
        isTitleFight: false,
        rounds: 3
      };
      
      const redClone = JSON.parse(JSON.stringify(test.red));
      const blueClone = JSON.parse(JSON.stringify(test.blue));
      
      const res = simulateFight(matchup, redClone, blueClone);
      
      if (res.winnerId === test.red.id) redWins++;
      else if (res.winnerId === test.blue.id) {
        blueWins++;
        if (testIdx === 6) upsetCount++; // Journeyman beating Top Contender is an upset
      }
      else draws++;

      if (res.method === 'KO/TKO') koTkoCount++;
      if (res.method === 'Submission') subCount++;

      if (res.method.includes('Decision')) decisions++;
      else if (res.method === 'Doctor Stoppage') { docStoppages++; finishes++; }
      else if (res.method !== 'Draw') finishes++;

      methods[res.method] = (methods[res.method] || 0) + 1;
      totalRounds += res.round;
      totalPerformance += res.performanceRating;

      if (res.medicalSuspensions) medSuspensions += res.medicalSuspensions.length;

      if (res.roundStats) {
        res.roundStats.forEach(rs => {
          if (!rs.judges || rs.judges.length === 0) {
            roundStatsErrors++;
          }
          rs.judges.forEach(j => {
            totalJudgeScores++;
            if (j.redScore === 8 || j.blueScore === 8) tenEightCount++;
          });
        });
      }
      
      if (i === 0) sampleCommentary = res.commentary;
    }

    setResults(prev => {
      const newRes = [...prev];
      newRes[testIdx] = { 
        redWins, 
        blueWins, 
        draws, 
        methods, 
        sampleCommentary,
        avgRound: (totalRounds / simCount).toFixed(1),
        avgPerf: (totalPerformance / simCount).toFixed(1),
        finishRate: ((finishes / simCount) * 100).toFixed(1),
        decisionRate: ((decisions / simCount) * 100).toFixed(1),
        drawRate: ((draws / simCount) * 100).toFixed(1),
        docStoppageRate: ((docStoppages / simCount) * 100).toFixed(1),
        koTkoRate: ((koTkoCount / simCount) * 100).toFixed(1),
        subRate: ((subCount / simCount) * 100).toFixed(1),
        tenEightRate: totalJudgeScores > 0 ? ((tenEightCount / totalJudgeScores) * 100).toFixed(2) : '0.00',
        tenEightCount,
        totalJudgeScores,
        medSuspensions,
        upsetCount: testIdx === 6 ? upsetCount : undefined,
        roundStatsErrors
      };
      return newRes;
    });
  };

  const runAll = () => {
    tests.forEach((_, i) => runTest(i));
  };

  const { events, fighters, promotion, newGame, setView } = useGameStore();

  const printState = () => {
    console.log(useGameStore.getState());
    alert("GameState printed to console.");
  };

  const addCash = () => {
    useGameStore.setState(state => ({
      promotion: { ...state.promotion, money: state.promotion.money + 1000000 }
    }));
    alert("Added $1,000,000");
  };

  const runInvariants = () => {
    const state = useGameStore.getState();
    let passed = true;
    let errors: string[] = [];
    
    // Check 1: Champion consistency
    const champsByWc: Record<string, string[]> = {};
    Object.values(state.fighters).forEach(f => {
       if (f.isChampion) {
          if (!champsByWc[f.weightClass]) champsByWc[f.weightClass] = [];
          champsByWc[f.weightClass].push(f.id);
          
          const title = state.titles[f.weightClass];
          if (!title || (title.undisputedChampionId !== f.id && title.interimChampionId !== f.id)) {
             passed = false;
             errors.push(`Fighter ${f.lastName} isChampion but titles[${f.weightClass}] says otherwise`);
          }
       }
    });

    Object.keys(state.titles).forEach(wc => {
       const uChampId = state.titles[wc].undisputedChampionId;
       const iChampId = state.titles[wc].interimChampionId;
       if (uChampId) {
          const champ = state.fighters[uChampId];
          if (!champ) {
             passed = false;
             errors.push(`Title in ${wc} points to non-existent fighter ${uChampId}`);
          } else if (!champ.isChampion) {
             passed = false;
             errors.push(`Title in ${wc} points to ${champ.lastName}, but their isChampion flag is false`);
          }
       }
       if (iChampId) {
          const champ = state.fighters[iChampId];
          if (!champ) {
             passed = false;
             errors.push(`Interim title in ${wc} points to non-existent fighter ${iChampId}`);
          } else if (!champ.isChampion) {
             passed = false;
             errors.push(`Interim title in ${wc} points to ${champ.lastName}, but their isChampion flag is false`);
          }
       }
       if (uChampId && iChampId && uChampId === iChampId) {
          passed = false;
          errors.push(`Fighter ${uChampId} is both undisputed and interim champion in ${wc}`);
       }
       
       const titleState = state.titles[wc];
       // Check status
       if (titleState) {
          const hasU = !!titleState.undisputedChampionId;
          const hasI = !!titleState.interimChampionId;
          let expectedStatus = titleState.status;
          if (!hasU && !hasI) expectedStatus = 'vacant';
          else if (hasU && hasI) expectedStatus = 'unification_needed';
          else if (!hasU && hasI) expectedStatus = 'interim_active';
          // inactive_champion can't be easily determined purely from presence without date checking, but we can check if it says vacant but has champ
          
          if (titleState.status === 'vacant' && (hasU || hasI)) {
             passed = false;
             errors.push(`${wc} title status is vacant but has a champion`);
          }
          if (titleState.status !== 'vacant' && (!hasU && !hasI)) {
             passed = false;
             errors.push(`${wc} title status is ${titleState.status} but has no champions`);
          }
       }
       
       if (champsByWc[wc] && champsByWc[wc].length > 2) {
          passed = false;
          errors.push(`Too many fighters have isChampion flag in ${wc}: ${champsByWc[wc].join(', ')}`);
       }
    });

    // Check title history for multiple active reigns
    const activeReigns = state.titleHistory.filter(th => th.status === 'active');
    const activeReignsByWc: Record<string, typeof activeReigns> = {};
    activeReigns.forEach(th => {
       if (!activeReignsByWc[th.weightClass]) activeReignsByWc[th.weightClass] = [];
       activeReignsByWc[th.weightClass].push(th);
    });
    
    Object.keys(activeReignsByWc).forEach(wc => {
       const reigns = activeReignsByWc[wc];
       const uReigns = reigns.filter(th => th.beltType !== 'interim');
       const iReigns = reigns.filter(th => th.beltType === 'interim');
       if (uReigns.length > 1) {
          passed = false;
          errors.push(`Multiple active undisputed title history items for ${wc}: ${uReigns.map(t => t.fighterId).join(', ')}`);
       }
       if (iReigns.length > 1) {
          passed = false;
          errors.push(`Multiple active interim title history items for ${wc}: ${iReigns.map(t => t.fighterId).join(', ')}`);
       }
    });
    
    // Check completed events have all results
    Object.values(state.events).forEach(event => {
       if (event.isCompleted) {
          event.fights.forEach((f, idx) => {
             if (!f.result) {
                passed = false;
                errors.push(`Event ${event.name} is completed but fight ${idx} has no result`);
             }
          });
       }
    });
    
    // Check RoundStats 10-8 rate
    let totalJudgesScored = 0;
    let tenEights = 0;
    Object.values(state.fightArchive).forEach(f => {
       f.roundStats?.forEach(rs => {
          rs.judges.forEach(j => {
             totalJudgesScored++;
             if (j.redScore === 8 || j.blueScore === 8) tenEights++;
          });
       });
    });
    if (totalJudgesScored > 0) {
       console.log(`Debug Check: ${tenEights} 10-8 rounds out of ${totalJudgesScored} judge-rounds (${((tenEights/totalJudgesScored)*100).toFixed(2)}%)`);
    }

    if (passed) {
       alert("Title Invariants Passed! Check console for details.");
       console.log("Invariants passed", { champsByWc, titles: state.titles });
    } else {
       alert("INVARIANT FAILURES DETECTED:\n" + errors.join('\n'));
       console.error("Invariant failures:", errors);
    }
  };

  const runAutoSim = (days: number) => {
    const initialFights = Object.keys(store.fightArchive || {}).length;
    store.advanceAutopilot(days, true);
    
    // We have to setTimeout to let state update, or just use getState
    setTimeout(() => {
       const reportData = calculateReport(useGameStore.getState(), initialFights);
       setReport(reportData);
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-white">SIMULATION DEBUGGER</h1>
        <div className="flex gap-2">
          <button onClick={addCash} className="bg-green-600 text-white px-4 py-2 font-bold rounded hover:bg-green-500">+$1M Cash</button>
          <button onClick={printState} className="bg-blue-600 text-white px-4 py-2 font-bold rounded hover:bg-blue-500">Print State</button>
          <button onClick={runInvariants} className="bg-purple-600 text-white px-4 py-2 font-bold rounded hover:bg-purple-500">Test Invariants</button>
          <button onClick={runAll} className="bg-white text-black px-4 py-2 font-bold rounded hover:bg-neutral-200">Run All 200x</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {tests.map((test, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">{test.name}</h2>
              <button onClick={() => runTest(i)} className="bg-neutral-800 text-white px-3 py-1 rounded text-sm hover:bg-neutral-700">Run 200x</button>
            </div>
            
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-neutral-950 p-2 rounded">
                <h3 className="font-bold text-red-400">{test.red.firstName} {test.red.lastName}</h3>
                <div className="text-xs text-neutral-500 font-mono flex gap-x-2 flex-wrap">
                  <span>STR:{test.red.attributes.striking}</span> 
                  <span>WRE:{test.red.attributes.wrestling}</span> 
                  <span>SUB:{test.red.attributes.submissions}</span> 
                  <span>POW:{test.red.attributes.power}</span> 
                  <span>CHIN:{test.red.attributes.chin}</span> 
                  <span>CAR:{test.red.attributes.cardio}</span> 
                  <span>IQ:{test.red.attributes.fightIq}</span>
                </div>
              </div>
              <div className="flex-1 bg-neutral-950 p-2 rounded">
                <h3 className="font-bold text-blue-400">{test.blue.firstName} {test.blue.lastName}</h3>
                <div className="text-xs text-neutral-500 font-mono flex gap-x-2 flex-wrap">
                  <span>STR:{test.blue.attributes.striking}</span> 
                  <span>WRE:{test.blue.attributes.wrestling}</span> 
                  <span>SUB:{test.blue.attributes.submissions}</span> 
                  <span>POW:{test.blue.attributes.power}</span> 
                  <span>CHIN:{test.blue.attributes.chin}</span> 
                  <span>CAR:{test.blue.attributes.cardio}</span> 
                  <span>IQ:{test.blue.attributes.fightIq}</span>
                </div>
              </div>
            </div>

            {results[i] && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-950 p-3 rounded">
                  <h4 className="text-sm font-bold text-white mb-2">Results (200 fights)</h4>
                  <p className="text-sm text-neutral-300">Red Wins: <span className="font-bold text-red-400">{results[i].redWins}</span> ({(results[i].redWins / 2).toFixed(1)}%)</p>
                  <p className="text-sm text-neutral-300">Blue Wins: <span className="font-bold text-blue-400">{results[i].blueWins}</span> ({(results[i].blueWins / 2).toFixed(1)}%)</p>
                  <p className="text-sm text-neutral-300">Draws: <span className="font-bold text-white">{results[i].draws}</span> ({(results[i].draws / 2).toFixed(1)}%)</p>
                  
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-neutral-400">
                    <div>
                      <span className="block text-white font-bold">Rates</span>
                      Fin: {results[i].finishRate}%<br/>
                      Dec: {results[i].decisionRate}%<br/>
                      Doc: {results[i].docStoppageRate}%<br/>
                      KO/TKO: {results[i].koTkoRate}%<br/>
                      Sub: {results[i].subRate}%
                    </div>
                    <div>
                      <span className="block text-white font-bold">Averages</span>
                      Rnd: {results[i].avgRound}<br/>
                      Perf: {results[i].avgPerf}/100<br/>
                      <span className="block text-white font-bold mt-2">Extras</span>
                      10-8s: {results[i].tenEightCount} ({results[i].tenEightRate}%)<br/>
                      Med Susp: {results[i].medSuspensions}<br/>
                      RS Errors: {results[i].roundStatsErrors}
                      {results[i].upsetCount !== undefined && (
                        <><br/><span className="text-yellow-400">Upsets: {results[i].upsetCount} ({((results[i].upsetCount / 200) * 100).toFixed(1)}%)</span></>
                      )}
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-4 mb-2">Methods</h4>
                  {Object.entries(results[i].methods)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([method, count]) => (
                    <p key={method} className="text-sm text-neutral-400">{method}: {count as number} ({(Number(count) / 2).toFixed(1)}%)</p>
                  ))}
                </div>
                <div className="bg-neutral-950 p-3 rounded h-64 overflow-y-auto">
                  <h4 className="text-sm font-bold text-white mb-2">Sample Commentary (1 fight)</h4>
                  {results[i].sampleCommentary.map((c: string, idx: number) => (
                    <p key={idx} className={`text-xs mb-1 ${c.startsWith('---') ? 'text-white font-bold mt-2' : 'text-neutral-400'}`}>{c}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Autopilot Testing</h2>
        <div className="flex gap-4 mb-6">
          <button onClick={() => runAutoSim(180)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
            Run 180 Days
          </button>
          <button onClick={() => runAutoSim(365)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
            Run 365 Days
          </button>
          <button onClick={() => runAutoSim(730)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
            Run 730 Days
          </button>
          <button onClick={runTournamentTestWorkflow} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Run GP Test Workflow
          </button>
        </div>

        {testLog.length > 0 && (
          <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-lg font-mono text-xs text-neutral-400 space-y-1 mb-6 max-h-60 overflow-y-auto text-left">
            <h4 className="font-bold text-white mb-2 uppercase">Test Workflow Output</h4>
            {testLog.map((log, idx) => (
              <p key={idx}>{log}</p>
            ))}
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Simulation Report</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                 <p className="text-xs text-neutral-500 uppercase">10-8 Judge Scores</p>
                 <p className="text-xl font-bold text-white">{report.tenEightRate.toFixed(1)}%</p>
                 <p className="text-xs text-neutral-400">{report.tenEightCount} / {report.totalRoundsScored} total scores</p>
               </div>
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                 <p className="text-xs text-neutral-500 uppercase">Awards Generated</p>
                 <p className="text-xl font-bold text-white">{report.awardsGenerated}</p>
               </div>
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                 <p className="text-xs text-neutral-500 uppercase">Events Completed</p>
                 <p className="text-xl font-bold text-white">{report.eventsCompleted}</p>
                 <p className="text-xs text-neutral-400">{report.fightsSimulated} fights</p>
               </div>
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                 <p className="text-xs text-neutral-500 uppercase">Medical Suspensions</p>
                 <p className="text-xl font-bold text-white">{report.medicalSuspensionsGiven}</p>
                 <p className="text-xs text-neutral-400">Total given in sim</p>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                  <h4 className="font-bold text-white mb-2">Title Status Counts</h4>
                  <ul className="text-sm text-neutral-300">
                    {Object.entries(report.titleStatuses).map(([status, count]) => (
                      <li key={status} className="flex justify-between w-48">
                        <span>{status}</span>
                        <span className="font-bold">{count as number}</span>
                      </li>
                    ))}
                  </ul>
               </div>
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                  <h4 className="font-bold text-white mb-2">Finish Methods</h4>
                  <ul className="text-sm text-neutral-300">
                     <li className="flex justify-between w-48"><span>KO/TKO</span><span className="font-bold">{report.methods.knockouts} ({report.koTkoRate}%)</span></li>
                     <li className="flex justify-between w-48"><span>Submission</span><span className="font-bold">{report.methods.submissions} ({report.subRate}%)</span></li>
                     <li className="flex justify-between w-48"><span>Decision</span><span className="font-bold">{report.methods.decisions}</span></li>
                     <li className="flex justify-between w-48"><span>Draw</span><span className="font-bold">{report.methods.draws} ({report.drawRate}%)</span></li>
                  </ul>
               </div>
               <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                  <h4 className="font-bold text-white mb-2">Deals & Ledger</h4>
                  <ul className="text-sm text-neutral-300 space-y-1">
                     <li className="flex justify-between w-56"><span>Active Sponsors</span><span className="font-bold text-green-400">{report.activeSponsors}</span></li>
                     <li className="flex justify-between w-56"><span>Expired Sponsors</span><span className="font-bold text-neutral-500">{report.expiredSponsors}</span></li>
                     <li className="flex justify-between w-56"><span>Active Media</span><span className="font-bold text-green-400">{report.activeMedia}</span></li>
                     <li className="flex justify-between w-56"><span>Expired Media</span><span className="font-bold text-neutral-500">{report.expiredMedia}</span></li>
                     <li className="border-t border-neutral-800 pt-1 flex justify-between w-56"><span>Ledger Entries</span><span className="font-bold">{report.ledgerTotal}</span></li>
                     <li className="flex justify-between w-56"><span>Summary Rows</span><span className="font-bold text-blue-400">{report.ledgerSummaryRows}</span></li>
                     <li className="flex justify-between w-56"><span>Cash-Affecting</span><span className="font-bold text-yellow-400">{report.ledgerCashRows}</span></li>
                  </ul>
               </div>
            </div>
            {report.ledgerByType && Object.keys(report.ledgerByType).length > 0 && (
              <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                <h4 className="font-bold text-white mb-2">Ledger Entries by Type</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Object.entries(report.ledgerByType)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([type, count]) => (
                    <div key={type} className="flex justify-between text-neutral-300">
                      <span className="text-neutral-400">{type}</span>
                      <span className="font-bold font-mono">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tournaments Report Block */}
            <div className="bg-neutral-900/40 p-4 border border-neutral-800 rounded space-y-4">
              <h4 className="font-bold text-white mb-2 uppercase tracking-wide text-xs text-purple-400">Detailed Tournament Stats</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Planned</p>
                  <p className="text-lg font-bold text-blue-400">{report.plannedTournamentsCount}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Active</p>
                  <p className="text-lg font-bold text-purple-400">{report.activeTournamentsCount}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Completed</p>
                  <p className="text-lg font-bold text-green-400">{report.completedTournamentsCount}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Cancelled</p>
                  <p className="text-lg font-bold text-neutral-500">{report.cancelledTournamentsCount}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Delayed Finals</p>
                  <p className="text-lg font-bold text-yellow-500">{report.delayedFinalsCount}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">GP Shots Pending</p>
                  <p className="text-base font-bold text-white">{report.titleShotsPending}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">GP Shots Used</p>
                  <p className="text-base font-bold text-neutral-400">{report.titleShotsUsed}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Reserve Replacements</p>
                  <p className="text-base font-bold text-white">{report.reserveReplacementsCount}</p>
                </div>
                <div className="bg-neutral-950 p-3 border border-neutral-800 rounded text-center">
                  <p className="text-[10px] text-neutral-500 uppercase">Missing FightArchiveIds</p>
                  <p className="text-base font-bold text-red-400">{report.missingFightArchiveIdCount}</p>
                </div>
              </div>
            </div>

            {/* General Invariants Checks Block */}
            <div className="bg-neutral-900/40 p-4 border border-neutral-800 rounded space-y-2">
              <h4 className="font-bold text-white mb-2 uppercase tracking-wide text-xs text-blue-400">General Codebase Invariants</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="flex justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                  <span className="text-neutral-400">Duplicate Champions</span>
                  <span className={`font-bold ${report.duplicateChampionsCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{report.duplicateChampionsCount}</span>
                </div>
                <div className="flex justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                  <span className="text-neutral-400">Completed Events w/o Result</span>
                  <span className={`font-bold ${report.completedEventMissingResult > 0 ? 'text-red-400' : 'text-green-400'}`}>{report.completedEventMissingResult}</span>
                </div>
                <div className="flex justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                  <span className="text-neutral-400">Suspended Fighter Booked</span>
                  <span className={`font-bold ${report.suspendedFightersBooked > 0 ? 'text-red-400' : 'text-green-400'}`}>{report.suspendedFightersBooked}</span>
                </div>
                <div className="flex justify-between p-2 bg-neutral-950 rounded border border-neutral-850">
                  <span className="text-neutral-400">Ledger Inconsistencies</span>
                  <span className={`font-bold ${report.ledgerInconsistencies > 0 ? 'text-red-400' : 'text-green-400'}`}>{report.ledgerInconsistencies}</span>
                </div>
              </div>
            </div>

            {report.tournamentWinners.length > 0 && (
              <div className="bg-neutral-950 p-4 border border-neutral-800 rounded">
                <h4 className="font-bold text-white mb-2">Grand Prix Winners</h4>
                <ul className="text-sm text-neutral-300 space-y-1">
                  {report.tournamentWinners.map((w: string, idx: number) => (
                    <li key={idx} className="text-green-400 font-semibold">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.invalidTournamentStates.length > 0 && (
              <div className="bg-red-950 p-4 border border-red-800 rounded">
                <h4 className="font-bold text-red-400 mb-2">Tournament Invariant Errors</h4>
                <ul className="text-sm text-red-300 space-y-1">
                  {report.invalidTournamentStates.map((err: string, idx: number) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.roundStatsErrors > 0 && (
              <div className="bg-red-950 p-4 border border-red-800 rounded">
                <p className="text-sm text-red-400 font-bold">⚠ {report.roundStatsErrors} roundStats validation errors detected (rounds with missing/empty judges)</p>
              </div>
            )}
            {report.titleInvariantErrors.length > 0 && (
              <div className="bg-red-950 p-4 border border-red-800 rounded">
                <h4 className="font-bold text-red-400 mb-2">Title Invariant Errors</h4>
                <ul className="text-sm text-red-300 space-y-1">
                  {report.titleInvariantErrors.map((err: string, idx: number) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function calculateReport(store: any, initialFights: number) {
   const state = store;
   
   let tenEightCount = 0;
   let totalRoundsScored = 0;
   let medicalSuspensionsGiven = 0;
   let knockouts = 0;
   let submissions = 0;
   let decisions = 0;
   let draws = 0;
   let roundStatsErrors = 0;
   
   const newFights = Object.values(state.fightArchive).slice(initialFights);
   const totalFights = newFights.length;
   
   newFights.forEach((f: any) => {
      if (f.method === 'KO/TKO') knockouts++;
      else if (f.method === 'Submission') submissions++;
      else if (f.method?.includes('Decision')) decisions++;
      
      if (!f.winnerId) draws++;

      if (f.medicalSuspensions) {
         medicalSuspensionsGiven += f.medicalSuspensions.length;
      }

      if (f.roundStats) {
         f.roundStats.forEach((rs: any) => {
            if (!rs.judges || rs.judges.length === 0) {
               roundStatsErrors++;
            }
            rs.judges.forEach((j: any) => {
               totalRoundsScored += 2; // red and blue score
               if (j.redScore === 8 || j.blueScore === 8) {
                  tenEightCount++;
               }
            });
         });
      }
   });

   const titleStatuses: Record<string, number> = {};
   Object.values(state.titles).forEach((t: any) => {
      titleStatuses[t.status] = (titleStatuses[t.status] || 0) + 1;
   });

   // Ledger summary
   const ledger = state.financeLedger || [];
   const ledgerTotal = ledger.length;
   let ledgerSummaryRows = 0;
   let ledgerCashRows = 0;
   const ledgerByType: Record<string, number> = {};
   
   ledger.forEach((entry: any) => {
      if (entry.isSummary) ledgerSummaryRows++;
      if (entry.affectsCash) ledgerCashRows++;
      ledgerByType[entry.type] = (ledgerByType[entry.type] || 0) + 1;
   });

   // Deal counts
   const sponsorDeals = state.sponsorDeals || [];
   const mediaDeals = state.mediaDeals || [];
   const activeSponsors = sponsorDeals.filter((d: any) => d.isActive).length;
   const expiredSponsors = sponsorDeals.filter((d: any) => !d.isActive).length;
   const activeMedia = mediaDeals.filter((d: any) => d.isActive).length;
   const expiredMedia = mediaDeals.filter((d: any) => !d.isActive).length;

   // Title invariant check
   const titleInvariantErrors: string[] = [];
   Object.keys(state.titles).forEach(wc => {
      const t = state.titles[wc];
      if (t.undisputedChampionId && t.interimChampionId && t.undisputedChampionId === t.interimChampionId) {
         titleInvariantErrors.push(`${wc}: Same fighter is both undisputed and interim champion`);
      }
      if (t.status === 'vacant' && (t.undisputedChampionId || t.interimChampionId)) {
         titleInvariantErrors.push(`${wc}: Status is vacant but has a champion`);
      }
      if (t.status !== 'vacant' && !t.undisputedChampionId && !t.interimChampionId) {
         titleInvariantErrors.push(`${wc}: Status is ${t.status} but has no champions`);
      }
   });

   // Tournament stats
   const tournaments = state.tournaments || {};
   const tournamentsList = Object.values(tournaments);
   const activeTournamentsCount = tournamentsList.filter((t: any) => t.status === 'active').length;
   const plannedTournamentsCount = tournamentsList.filter((t: any) => t.status === 'planned').length;
   const completedTournamentsCount = tournamentsList.filter((t: any) => t.status === 'completed').length;
   const cancelledTournamentsCount = tournamentsList.filter((t: any) => t.status === 'cancelled').length;
   const delayedFinalsCount = tournamentsList.filter((t: any) => t.finalDelayReason).length;
   
   const tournamentWinners: string[] = [];
   const invalidTournamentStates: string[] = [];
   let missingResultsFightsCount = 0;
   
   let titleShotsPending = 0;
   let titleShotsUsed = 0;
   let reserveReplacementsCount = 0;
   let missingFightArchiveIdCount = 0;
   
   tournamentsList.forEach((t: any) => {
      if (t.status === 'completed') {
         if (t.winnerId) {
            const winnerF = state.fighters[t.winnerId];
            if (winnerF) tournamentWinners.push(`${winnerF.firstName} ${winnerF.lastName} (${t.name})`);
         } else {
            invalidTournamentStates.push(`${t.name}: status is completed but has no winnerId`);
         }
      }
      
      if (t.titleShotPromised) {
        if (t.titleShotUsed) titleShotsUsed++;
        else titleShotsPending++;
      }
      
      const participantIds = t.participants.map((p: any) => p.fighterId);
      if (new Set(participantIds).size !== participantIds.length) {
         invalidTournamentStates.push(`${t.name}: has duplicate participant IDs`);
      }
      
      t.participants.forEach((p: any) => {
        if (p.replacementForFighterId) {
          reserveReplacementsCount++;
        }
      });
      
      t.fights.forEach((fSlot: any) => {
         if (fSlot.isCompleted && !fSlot.winnerId) {
            missingResultsFightsCount++;
         }
         if (fSlot.isCompleted && !fSlot.fightArchiveId) {
            missingFightArchiveIdCount++;
         }
         if (fSlot.eventId && !fSlot.isCompleted) {
            const event = state.events[fSlot.eventId];
            if (event && !event.isCompleted) {
               const redF = state.fighters[fSlot.redFighterId];
               const blueF = state.fighters[fSlot.blueFighterId];
               if (redF && (redF.injuryStatus || (redF.medicalSuspension && redF.medicalSuspension.daysRemaining > 0))) {
                  invalidTournamentStates.push(`${t.name}: unavailable fighter ${redF.lastName} is scheduled in an upcoming fight`);
               }
               if (blueF && (blueF.injuryStatus || (blueF.medicalSuspension && blueF.medicalSuspension.daysRemaining > 0))) {
                  invalidTournamentStates.push(`${t.name}: unavailable fighter ${blueF.lastName} is scheduled in an upcoming fight`);
               }
            }
         }
      });
   });

   // General checks
   let duplicateChampionsCount = 0;
   const undisputedChampIds = Object.values(state.titles).map((t: any) => t.undisputedChampionId).filter(Boolean);
   undisputedChampIds.forEach(id => {
     const matchCount = undisputedChampIds.filter(cid => cid === id).length;
     if (matchCount > 1) {
        duplicateChampionsCount++;
     }
   });

   let completedEventMissingResult = 0;
   Object.values(state.events).forEach((e: any) => {
     if (e.isCompleted) {
        if (e.fights.some((f: any) => !f.result)) {
           completedEventMissingResult++;
        }
     }
   });

   let suspendedFightersBooked = 0;
   Object.values(state.events).forEach((e: any) => {
     if (!e.isCompleted) {
        e.fights.forEach((f: any) => {
           const red = state.fighters[f.redCornerId];
           const blue = state.fighters[f.blueCornerId];
           if (red && (red.injuryStatus || (red.medicalSuspension && red.medicalSuspension.daysRemaining > 0))) {
              suspendedFightersBooked++;
           }
           if (blue && (blue.injuryStatus || (blue.medicalSuspension && blue.medicalSuspension.daysRemaining > 0))) {
              suspendedFightersBooked++;
           }
        });
     }
   });

   let ledgerInconsistencies = 0;
   ledger.forEach((entry: any) => {
      if (entry.amount === undefined || isNaN(entry.amount)) {
         ledgerInconsistencies++;
      }
   });

   return {
      tenEightCount,
      totalRoundsScored, 
      tenEightRate: totalRoundsScored > 0 ? (tenEightCount / totalRoundsScored) * 100 : 0,
      awardsGenerated: Object.keys(state.yearlyAwards || {}).length,
      eventsCompleted: state.lastAutopilotSummary?.eventsCompleted || 0,
      titleStatuses,
      fightsSimulated: totalFights,
      medicalSuspensionsGiven,
      methods: { knockouts, submissions, decisions, draws },
      koTkoRate: totalFights > 0 ? ((knockouts / totalFights) * 100).toFixed(1) : '0.0',
      subRate: totalFights > 0 ? ((submissions / totalFights) * 100).toFixed(1) : '0.0',
      drawRate: totalFights > 0 ? ((draws / totalFights) * 100).toFixed(1) : '0.0',
      ledgerTotal,
      ledgerSummaryRows,
      ledgerCashRows,
      ledgerByType,
      activeSponsors,
      expiredSponsors,
      activeMedia,
      expiredMedia,
      roundStatsErrors,
      titleInvariantErrors,
      activeTournamentsCount,
      plannedTournamentsCount,
      completedTournamentsCount,
      cancelledTournamentsCount,
      delayedFinalsCount,
      tournamentWinners,
      invalidTournamentStates,
      missingResultsFightsCount,
      titleShotsPending,
      titleShotsUsed,
      reserveReplacementsCount,
      missingFightArchiveIdCount,
      duplicateChampionsCount,
      completedEventMissingResult,
      suspendedFightersBooked,
      ledgerInconsistencies
   };
}
