import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const rankings = readFileSync('src/pages/Rankings.tsx', 'utf8');

if (app.includes('Start Here')) {
  throw new Error('Removed onboarding block is still rendered.');
}

if (!app.includes('Sign Fighters')) {
  throw new Error('Missing fighter-signing navigation label.');
}

for (const text of ['isFinanceOpen', 'isNewsOpen', 'aria-expanded']) {
  if (!dashboard.includes(text)) throw new Error(`Missing collapsible dashboard UX: ${text}`);
}

if (!rankings.includes('statusTooltip')) {
  throw new Error('Missing champion status explanation.');
}

console.log('UX guidance checks passed.');
