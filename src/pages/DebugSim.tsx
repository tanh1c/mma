import React, { useState } from 'react';
import { simulateFight } from '../lib/game/fightSimulator';
import { generateFighter } from '../lib/game/generator';
import { PRNG } from '../lib/game/rng';
import { Fighter, FightMatchup, FightResult } from '../types/game';
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from '../store/gameStore';

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
    const methods: Record<string, number> = {};
    let sampleCommentary: string[] = [];

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
      else if (res.winnerId === test.blue.id) blueWins++;
      else draws++;

      if (res.method.includes('Decision')) decisions++;
      else if (res.method === 'Doctor Stoppage') { docStoppages++; finishes++; }
      else if (res.method !== 'Draw') finishes++;

      methods[res.method] = (methods[res.method] || 0) + 1;
      totalRounds += res.round;
      totalPerformance += res.performanceRating;
      
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
        docStoppageRate: ((docStoppages / simCount) * 100).toFixed(1)
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
                      Doc: {results[i].docStoppageRate}%
                    </div>
                    <div>
                      <span className="block text-white font-bold">Averages</span>
                      Rnd: {results[i].avgRound}<br/>
                      Perf: {results[i].avgPerf}/100
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
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                     <li className="flex justify-between w-48"><span>KO/TKO</span><span className="font-bold">{report.methods.knockouts}</span></li>
                     <li className="flex justify-between w-48"><span>Submission</span><span className="font-bold">{report.methods.submissions}</span></li>
                     <li className="flex justify-between w-48"><span>Decision</span><span className="font-bold">{report.methods.decisions}</span></li>
                     <li className="flex justify-between w-48"><span>Draw</span><span className="font-bold">{report.methods.draws}</span></li>
                  </ul>
               </div>
            </div>
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
   
   const newFights = Object.values(state.fightArchive).slice(initialFights);
   
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

   return {
      tenEightCount,
      totalRoundsScored, 
      tenEightRate: totalRoundsScored > 0 ? (tenEightCount / totalRoundsScored) * 100 : 0,
      awardsGenerated: Object.keys(state.yearlyAwards || {}).length,
      eventsCompleted: state.lastAutopilotSummary?.eventsCompleted || 0,
      titleStatuses,
      fightsSimulated: newFights.length,
      medicalSuspensionsGiven,
      methods: { knockouts, submissions, decisions, draws }
   };
}

