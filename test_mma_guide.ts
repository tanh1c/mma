import en from './src/i18n/resources/en';

const requiredTerms = ['Grand Prix', 'Undisputed Champion', 'Interim Champion', 'Title Shot', 'KO/TKO', 'Submission', 'Decision'];
const terms = Object.values(en.mmaGuide.sections).flatMap(section => Object.values(section.entries).map(entry => entry.term));

for (const term of requiredTerms) {
  if (!terms.includes(term)) throw new Error(`Missing MMA guide term: ${term}`);
}

console.log('MMA guide content checks passed.');
