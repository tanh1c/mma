import { WeightClass } from '../types/game';

export type BeltType = 'undisputed' | 'interim';
export type BeltSize = 'hero' | 'champion' | 'card' | 'marker';

const beltSources: Record<WeightClass, Record<BeltType, string>> = {
  Bantamweight: { undisputed: '/belts/bantamweight-undisputed.png', interim: '/belts/bantamweight-interim.png' },
  Featherweight: { undisputed: '/belts/featherweight-undisputed.png', interim: '/belts/featherweight-interim.png' },
  Lightweight: { undisputed: '/belts/lightweight-undisputed.png', interim: '/belts/lightweight-interim.png' },
  Welterweight: { undisputed: '/belts/welterweight-undisputed.png', interim: '/belts/welterweight-interim.png' },
  Middleweight: { undisputed: '/belts/middleweight-undisputed.png', interim: '/belts/middleweight-interim.png' },
  Heavyweight: { undisputed: '/belts/heavyweight-undisputed.png', interim: '/belts/heavyweight-interim.png' }
};

const sizeClasses: Record<BeltSize, string> = {
  hero: 'h-36 w-full max-w-[300px] sm:h-44',
  champion: 'h-32 w-full max-w-[240px] sm:h-40',
  card: 'h-20 w-28 sm:h-24 sm:w-32',
  marker: 'h-10 w-14 sm:h-12 sm:w-16'
};

export function getChampionshipBeltSrc(weightClass: WeightClass, type: BeltType): string {
  return beltSources[weightClass][type];
}

export function ChampionshipBelt({ weightClass, type, size = 'card', alt = '', className = '' }: {
  weightClass: WeightClass;
  type: BeltType;
  size?: BeltSize;
  alt?: string;
  className?: string;
}) {
  return <img src={getChampionshipBeltSrc(weightClass, type)} alt={alt} className={`${sizeClasses[size]} shrink-0 object-contain ${className}`} />;
}
