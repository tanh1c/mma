import { simulateFight } from './src/lib/game/fightSimulator';
import { generateFighter } from './src/lib/game/generator';
import { PRNG } from './src/lib/game/rng';

const rng = new PRNG(12345);

function testMatchup(desc: string, f1Overrides: any, f2Overrides: any, f1Age = 28, f2Age = 28, iters = 200) {
   let f1Wins = 0, f2Wins = 0, draws = 0;
   let koTkos = 0, subs = 0, decs = 0, docs = 0;
   let tenEightCount = 0, totalJudgeScores = 0;

   const getStyleFromName = (name: string): any => {
      if (name.includes("Striker") || name.includes("Glass")) return "Kickboxer";
      if (name.includes("Wrestler")) return "Wrestler";
      if (name.includes("Grappler")) return "BJJ";
      if (name.includes("Puncher")) return "Boxer";
      return "Balanced";
   };

   for (let i = 0; i < iters; i++) {
      let f1 = generateFighter(rng, 'Contender', 'Lightweight');
      f1.age = f1Age;
      f1.style = getStyleFromName(desc.split(" vs ")[0]);
      f1.attributes = {
         striking: 50, grappling: 50, wrestling: 50, submissions: 50,
         cardio: 70, chin: 70, power: 60, speed: 60, defense: 60, fightIq: 60, toughness: 70,
         ...f1Overrides
      };
      
      let f2 = generateFighter(rng, 'Contender', 'Lightweight');
      f2.age = f2Age;
      f2.style = getStyleFromName(desc.split(" vs ")[1] || "");
      f2.attributes = {
         striking: 50, grappling: 50, wrestling: 50, submissions: 50,
         cardio: 70, chin: 70, power: 60, speed: 60, defense: 60, fightIq: 60, toughness: 70,
         ...f2Overrides
      };

      const matchup = {
         id: "test",
         redCornerId: f1.id,
         blueCornerId: f2.id,
         weightClass: "Lightweight",
         rounds: 3,
         isTitleFight: false
      } as any;

      let res = simulateFight(matchup, f1, f2);
      if (res.winnerId === f1.id) f1Wins++;
      else if (res.winnerId === f2.id) f2Wins++;
      else draws++;

      if (res.method === 'KO/TKO') koTkos++;
      else if (res.method === 'Submission') subs++;
      else if (res.method.includes('Decision')) decs++;
      else if (res.method === 'Doctor Stoppage') docs++;

      if (res.roundStats) {
         res.roundStats.forEach(rs => {
            rs.judges.forEach(j => {
               totalJudgeScores += 2;
               if (j.redScore === 8 || j.blueScore === 8) tenEightCount++;
            });
         });
      }
   }

   const tenEightRate = totalJudgeScores > 0 ? (tenEightCount / totalJudgeScores) * 100 : 0;
   console.log(`${desc.padEnd(45)} | F1 (Red) Wins: ${((f1Wins/iters)*100).toFixed(1)}% | F2 (Blue) Wins: ${((f2Wins/iters)*100).toFixed(1)}% | Draw: ${((draws/iters)*100).toFixed(1)}% | KO/TKO: ${((koTkos/iters)*100).toFixed(1)}% | Sub: ${((subs/iters)*100).toFixed(1)}% | 10-8 rate: ${tenEightRate.toFixed(1)}%`);
}

console.log("=== RUNNING MMA CAGE DYNASTY BENCHMARKS ===");
testMatchup("Elite Striker vs Elite Wrestler", 
   { striking: 95, power: 85, speed: 90, wrestling: 30, grappling: 30, defense: 75, chin: 80, submissions: 20 }, 
   { wrestling: 95, grappling: 85, striking: 40, power: 50, speed: 70, defense: 75, chin: 80, submissions: 50 }
);
testMatchup("Elite Grappler vs Weak Sub Defense", 
   { grappling: 95, submissions: 95, wrestling: 85, striking: 50, power: 50 }, 
   { grappling: 20, submissions: 20, wrestling: 50, striking: 85, power: 80 }
);
testMatchup("Power Puncher vs Glass Chin", 
   { striking: 85, power: 98, speed: 80, chin: 80 }, 
   { striking: 85, power: 70, speed: 85, chin: 20, toughness: 40 }
);
testMatchup("High Cardio vs Explosive", 
   { cardio: 98, striking: 75, wrestling: 75, power: 50 }, 
   { cardio: 20, striking: 90, power: 95, speed: 95 }
);
testMatchup("Old Veteran vs Young Prospect", 
   { fightIq: 95, toughness: 95, speed: 40, cardio: 50, striking: 80, wrestling: 80 }, 
   { fightIq: 50, toughness: 50, speed: 95, cardio: 95, striking: 85, wrestling: 85 },
   39, 21
);
testMatchup("Equal Balanced", 
   { fightIq: 75, toughness: 75, speed: 75, cardio: 75, striking: 75, wrestling: 75, grappling: 75, submissions: 75, power: 75, chin: 75, defense: 75 }, 
   { fightIq: 75, toughness: 75, speed: 75, cardio: 75, striking: 75, wrestling: 75, grappling: 75, submissions: 75, power: 75, chin: 75, defense: 75 }
);
testMatchup("Top Contender vs Journeyman", 
   { fightIq: 90, toughness: 85, speed: 85, cardio: 85, striking: 90, wrestling: 85, grappling: 85, submissions: 80, power: 85, chin: 85, defense: 90 }, 
   { fightIq: 60, toughness: 80, speed: 60, cardio: 70, striking: 65, wrestling: 65, grappling: 65, submissions: 60, power: 65, chin: 75, defense: 60 }
);
