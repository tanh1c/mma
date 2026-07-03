import { simulateFight } from './src/lib/game/fightSimulator';
import { generateFighter } from './src/lib/game/generator';
import { PRNG } from './src/lib/game/rng';

const rng = new PRNG(12345);

function testMatchup(desc: string, f1Overrides: any, f2Overrides: any, iters = 200) {
   let f1Wins = 0, f2Wins = 0, draws = 0;
   let koTkos = 0;
   for (let i=0; i<iters; i++) {
      let f1 = generateFighter(rng, 'Contender', 'Lightweight' as any);
      f1.attributes = { ...f1.attributes, ...f1Overrides };
      let f2 = generateFighter(rng, 'Contender', 'Lightweight' as any);
      f2.attributes = { ...f2.attributes, ...f2Overrides };
      
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
   }
   console.log(`${desc}: F1 ${((f1Wins/iters)*100).toFixed(1)}% | F2 ${((f2Wins/iters)*100).toFixed(1)}% | Draw ${((draws/iters)*100).toFixed(1)}% | KO/TKO ${((koTkos/iters)*100).toFixed(1)}%`);
}

testMatchup("Equal Balanced", { power: 50, chin: 50, cardio: 50, striking: 50, grappling: 50, fightIq: 50 }, { power: 50, chin: 50, cardio: 50, striking: 50, grappling: 50, fightIq: 50 });
testMatchup("Cardio vs Explosive", { cardio: 90, power: 40, striking: 60, chin: 60, grappling: 50, fightIq: 50 }, { cardio: 30, power: 90, striking: 60, chin: 60, grappling: 50, fightIq: 50 });
testMatchup("Contender vs Journeyman", { striking: 85, grappling: 85, cardio: 85, power: 85, chin: 85, fightIq: 85 }, { striking: 45, grappling: 45, cardio: 45, power: 45, chin: 45, fightIq: 45 });
testMatchup("Elite Striker vs Wrestler", { striking: 95, grappling: 30, power: 80, chin: 80, cardio: 80 }, { striking: 30, grappling: 95, power: 60, chin: 80, cardio: 80 });
testMatchup("Power Puncher vs Glass Chin", { power: 95, striking: 80, grappling: 50, chin: 80, cardio: 80 }, { power: 50, striking: 80, grappling: 50, chin: 30, cardio: 80 });
