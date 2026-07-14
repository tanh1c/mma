import { createAvatar } from '@dicebear/core';
import { create, meta, schema, type Options } from '@dicebear/avataaars';
import { getNationalitySkinPalette } from '../lib/branding';

const avataaars = { create, meta, schema };

type FighterAvatarProps = {
  id: string;
  name: string;
  nationality: string;
  className?: string;
};

const fighterPortraitOptions: Partial<Options> = {
  top: ['shavedSides', 'dreads01', 'dreads02', 'shortCurly', 'shortFlat', 'shortRound', 'shortWaved', 'sides', 'theCaesar', 'theCaesarAndSidePart'],
  facialHair: ['beardLight', 'beardMajestic', 'beardMedium', 'moustacheFancy', 'moustacheMagnum'],
  facialHairProbability: 55,
  clothing: ['shirtCrewNeck', 'shirtVNeck', 'hoodie', 'graphicShirt'],
  mouth: ['serious', 'grimace', 'default'],
  eyebrows: ['angryNatural', 'flatNatural', 'frownNatural', 'unibrowNatural'],
  accessoriesProbability: 0,
  backgroundColor: ['0a0a0a', '101114', '1b1c20']
};

export function FighterAvatar({ id, name, nationality, className = '' }: FighterAvatarProps) {
  return <img alt={`${name} portrait`} className={`shrink-0 rounded-full bg-neutral-800 ${className}`} src={createAvatar(avataaars, { seed: id, ...fighterPortraitOptions, skinColor: [...getNationalitySkinPalette(nationality)] }).toDataUri()} />;
}
