import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readLanguage } from '../lib/localization';
import en from './resources/en';
import vi from './resources/vi';

const language = readLanguage();

void i18n.use(initReactI18next).init({
  lng: language,
  fallbackLng: 'en',
  supportedLngs: ['en', 'vi'],
  load: 'languageOnly',
  resources: { en: { translation: en }, vi: { translation: vi } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  enableSelector: 'optimize',
  initAsync: false
});

if (typeof document !== 'undefined') document.documentElement.lang = language;

export default i18n;
