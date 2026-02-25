import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import adminEn from './locales/admin.en.json';
import adminEs from './locales/admin.es.json';
import menuEn from './locales/menu.en.json';
import menuEs from './locales/menu.es.json';

// Merge all translations
const enResources = { ...en, ...adminEn, ...menuEn };
const esResources = { ...es, ...adminEs, ...menuEs };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enResources },
      es: { translation: esResources },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
