export type UnitSystem = 'metric' | 'us';

const UNIT_SYSTEM_KEY = 'cage-dynasty-unit-system';
const browserStorage = () => typeof localStorage === 'undefined' ? undefined : localStorage;

export function formatHeight(heightCm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') return `${Math.round(heightCm)} cm`;
  const inches = Math.round(heightCm / 2.54);
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

export function formatWeight(weightLb: number, unitSystem: UnitSystem): string {
  return unitSystem === 'metric' ? `${(weightLb * 0.45359237).toFixed(1)} kg` : `${Math.round(weightLb)} lb`;
}

export function readUnitSystem(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): UnitSystem {
  try {
    return storage?.getItem(UNIT_SYSTEM_KEY) === 'us' ? 'us' : 'metric';
  } catch {
    return 'metric';
  }
}

export function writeUnitSystem(unitSystem: UnitSystem, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): void {
  try {
    storage?.setItem(UNIT_SYSTEM_KEY, unitSystem);
  } catch {
    // The in-memory setting remains usable when browser storage is blocked.
  }
}
