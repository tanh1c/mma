import 'i18next';
import en from './resources/en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    enableSelector: 'optimize';
  }

  interface ResourceNamespaceMap {
    translation: typeof en;
  }
}
