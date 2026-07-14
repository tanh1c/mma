import { MMA_GUIDE_SECTIONS } from './src/pages/MmaGuide';

const requiredTerms = ['Grand Prix', 'Undisputed Champion', 'Interim Champion', 'Title Shot', 'KO/TKO', 'Submission', 'Decision'];
const terms = MMA_GUIDE_SECTIONS.flatMap(section => section.entries.map(entry => entry.term));

for (const term of requiredTerms) {
  if (!terms.includes(term)) throw new Error(`Missing MMA guide term: ${term}`);
}

console.log('MMA guide content checks passed.');
