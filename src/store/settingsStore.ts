import { create } from 'zustand';
import i18n from '../i18n';
import { readUnitSystem, writeUnitSystem, type UnitSystem } from '../lib/displayUnits';
import { readLanguage, writeLanguage, type Language } from '../lib/localization';

type SettingsStore = {
  unitSystem: UnitSystem;
  language: Language;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  setLanguage: (language: Language) => void;
};

export const useSettingsStore = create<SettingsStore>(set => ({
  unitSystem: readUnitSystem(),
  language: readLanguage(),
  setUnitSystem: unitSystem => {
    writeUnitSystem(unitSystem);
    set({ unitSystem });
  },
  setLanguage: language => {
    writeLanguage(language);
    void i18n.changeLanguage(language);
    if (typeof document !== 'undefined') document.documentElement.lang = language;
    set({ language });
  }
}));
