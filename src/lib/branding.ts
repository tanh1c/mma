import { TournamentFormat, TournamentRound, WeightClass } from '../types/game';

const beltBranding: Record<WeightClass, { name: string; shortName: string }> = {
  Bantamweight: { name: 'Cage Dynasty Bantamweight Crown', shortName: 'CD Bantam Crown' },
  Featherweight: { name: 'Cage Dynasty Featherweight Throne', shortName: 'CD Feather Throne' },
  Lightweight: { name: 'Cage Dynasty Lightweight Gold', shortName: 'CD Lightweight Gold' },
  Welterweight: { name: 'Cage Dynasty Welterweight Scepter', shortName: 'CD Welter Scepter' },
  Middleweight: { name: 'Cage Dynasty Middleweight Iron Crown', shortName: 'CD Middle Iron Crown' },
  Heavyweight: { name: 'Cage Dynasty Heavyweight World Crown', shortName: 'CD Heavyweight Crown' }
};

const eventNames = {
  regular: ['Collision Course', 'Night of Violence', 'Bloodline', 'Rising Storm', 'No Mercy'],
  title: ['Gold Rush', 'Crown Night', "Champions' Summit", 'Throne Defense'],
  tentpole: ['Empire', 'Kingdom Come', 'Crown Wars'],
  grand_prix: {
    quarterfinal: 'Opening Siege',
    semifinal: 'Final Four',
    final: 'Crown Path'
  }
} as const;

const nationalityCodes = {
  USA: 'us',
  Brazil: 'br',
  Russia: 'ru',
  Japan: 'jp',
  Mexico: 'mx',
  UK: 'gb',
  Australia: 'au',
  Canada: 'ca',
  France: 'fr',
  Poland: 'pl',
  Sweden: 'se',
  Netherlands: 'nl',
  'South Korea': 'kr',
  China: 'cn',
  Nigeria: 'ng',
  'New Zealand': 'nz',
  Ireland: 'ie',
  Spain: 'es',
  Germany: 'de',
  Italy: 'it'
} as const;

type SupportedNationality = keyof typeof nationalityCodes;

const broadSkinPalette = ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29', '614335'] as const;

const nationalitySkinPalettes = {
  USA: broadSkinPalette,
  Brazil: broadSkinPalette,
  Russia: ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29'],
  Japan: ['ffdbb4', 'edb98a', 'd08b5b'],
  Mexico: ['edb98a', 'd08b5b', 'ae5d29', '614335'],
  UK: broadSkinPalette,
  Australia: broadSkinPalette,
  Canada: broadSkinPalette,
  France: broadSkinPalette,
  Poland: ['ffdbb4', 'edb98a', 'd08b5b'],
  Sweden: ['ffdbb4', 'edb98a', 'd08b5b'],
  Netherlands: ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29'],
  'South Korea': ['ffdbb4', 'edb98a', 'd08b5b'],
  China: ['ffdbb4', 'edb98a', 'd08b5b'],
  Nigeria: ['d08b5b', 'ae5d29', '614335'],
  'New Zealand': broadSkinPalette,
  Ireland: ['ffdbb4', 'edb98a', 'd08b5b'],
  Spain: ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29'],
  Germany: ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29'],
  Italy: ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29']
} satisfies Record<SupportedNationality, readonly string[]>;

const tournamentThemes: Record<WeightClass, string> = {
  Bantamweight: 'Fast Track to Gold',
  Featherweight: 'Crownbound',
  Lightweight: 'Road to the Crown',
  Welterweight: 'Path of Violence',
  Middleweight: 'Iron Path',
  Heavyweight: 'Thronebreaker'
};

function pick<T>(items: readonly T[], index: number): T {
  return items[(Math.max(index, 1) - 1) % items.length];
}

export function getBeltBranding(weightClass: WeightClass) {
  return beltBranding[weightClass];
}

export function getEventName(
  type: 'regular' | 'title' | 'tentpole' | 'grand_prix',
  index: number,
  round?: TournamentRound
): string {
  if (type === 'grand_prix') {
    const roundLabel = round === 'quarterfinal' ? 'Quarterfinal' : round === 'semifinal' ? 'Semifinal' : 'Final';
    return `CD GP ${roundLabel}: ${eventNames.grand_prix[round || 'final']} ${index}`;
  }

  if (type === 'tentpole') return `CD Mega Showdown: ${pick(eventNames.tentpole, index)} ${index}`;
  if (type === 'title') return `CD ${pick(eventNames.title, index)} ${index}`;
  return `Cage Dynasty: ${pick(eventNames.regular, index)} ${index}`;
}

export function getTournamentBranding(weightClass: WeightClass, format: TournamentFormat) {
  const formatLabel = format === 'eight_man' ? '8-Man' : '4-Man';
  return {
    name: `${weightClass} ${formatLabel} Grand Prix: ${tournamentThemes[weightClass]}`,
    shortName: `${weightClass} ${format === 'eight_man' ? '8-Man GP' : 'GP'}`
  };
}

export function getNationalityCode(nationality: string): string {
  return nationalityCodes[nationality as SupportedNationality] || 'un';
}

export function getNationalitySkinPalette(nationality: string): readonly string[] {
  return nationalitySkinPalettes[nationality as SupportedNationality] || broadSkinPalette;
}
