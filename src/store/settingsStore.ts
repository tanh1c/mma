import { create } from 'zustand';
import { readUnitSystem, writeUnitSystem, type UnitSystem } from '../lib/displayUnits';

type SettingsStore = {
  unitSystem: UnitSystem;
  setUnitSystem: (unitSystem: UnitSystem) => void;
};

export const useSettingsStore = create<SettingsStore>(set => ({
  unitSystem: readUnitSystem(),
  setUnitSystem: unitSystem => {
    writeUnitSystem(unitSystem);
    set({ unitSystem });
  }
}));
