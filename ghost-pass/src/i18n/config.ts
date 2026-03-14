import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import adminEn from './locales/admin.en.json';
import adminEs from './locales/admin.es.json';
import adminSetupEn from './locales/admin-setup.en.json';
import adminSetupEs from './locales/admin-setup.es.json';
import componentsEn from './locales/components.en.json';
import componentsEs from './locales/components.es.json';
import componentsExtendedEn from './locales/components-extended.en.json';
import componentsExtendedEs from './locales/components-extended.es.json';
import menuEn from './locales/menu.en.json';
import menuEs from './locales/menu.es.json';
import ticketsEn from '../locales/en/tickets.json';
import ticketsEs from '../locales/es/tickets.json';
import commonEn from '../locales/en/common.json';
import commonEs from '../locales/es/common.json';
import navEn from '../locales/en/nav.json';
import navEs from '../locales/es/nav.json';
import walletEn from '../locales/en/wallet.json';
import walletEs from '../locales/es/wallet.json';
import ghostpassEn from '../locales/en/ghostpass.json';
import ghostpassEs from '../locales/es/ghostpass.json';
import sessionEn from '../locales/en/session.json';
import sessionEs from '../locales/es/session.json';
import scannerEn from '../locales/en/scanner.json';
import scannerEs from '../locales/es/scanner.json';
import entryTesterEn from '../locales/en/entryTester.json';
import entryTesterEs from '../locales/es/entryTester.json';
import ghostPassInteractionSimulatorEn from '../locales/en/ghostPassInteractionSimulator.json';
import ghostPassInteractionSimulatorEs from '../locales/es/ghostPassInteractionSimulator.json';
import historyEn from '../locales/en/history.json';
import historyEs from '../locales/es/history.json';
import auditTrailEn from '../locales/en/auditTrail.json';
import auditTrailEs from '../locales/es/auditTrail.json';
import appContentEn from '../locales/en/appContent.json';
import appContentEs from '../locales/es/appContent.json';
import venueCommandCenterEn from '../locales/en/venueCommandCenter.json';
import venueCommandCenterEs from '../locales/es/venueCommandCenter.json';
import venueEn from '../locales/en/venue.json';
import venueEs from '../locales/es/venue.json';
import portalEn from '../locales/en/portal.json';
import portalEs from '../locales/es/portal.json';
import staffEn from '../locales/en/staff.json';
import staffEs from '../locales/es/staff.json';
import vendorEn from '../locales/en/vendor.json';
import vendorEs from '../locales/es/vendor.json';
import financialEn from '../locales/en/financial.json';
import financialEs from '../locales/es/financial.json';
import adminTranslationsEn from '../locales/en/admin.json';
import adminTranslationsEs from '../locales/es/admin.json';
import venuePickerEn from '../locales/en/venuePicker.json';
import venuePickerEs from '../locales/es/venuePicker.json';
import analyticsEn from '../locales/en/analytics.json';
import analyticsEs from '../locales/es/analytics.json';
import eventsEn from '../locales/en/events.json';
import eventsEs from '../locales/es/events.json';
import ticketTypesEn from '../locales/en/ticketTypes.json';
import ticketTypesEs from '../locales/es/ticketTypes.json';
import menuManagerEn from '../locales/en/menuManager.json';
import menuManagerEs from '../locales/es/menuManager.json';
import gatewayEn from '../locales/en/gateway.json';
import gatewayEs from '../locales/es/gateway.json';
import entryConfigEn from '../locales/en/entryConfig.json';
import entryConfigEs from '../locales/es/entryConfig.json';
import staffManagerEn from '../locales/en/staffManager.json';
import staffManagerEs from '../locales/es/staffManager.json';
import payoutsManagerEn from '../locales/en/payoutsManager.json';
import payoutsManagerEs from '../locales/es/payoutsManager.json';
import staffPortalEn from '../locales/en/staffPortal.json';
import staffPortalEs from '../locales/es/staffPortal.json';
import stationsEn from '../locales/en/stations.json';
import stationsEs from '../locales/es/stations.json';

// Merge all translations
const enResources = { 
  ...en, 
  ...adminEn,
  ...adminSetupEn,
  ...componentsEn,
  ...componentsExtendedEn, 
  ...menuEn, 
  ...navEn,
  ...adminTranslationsEn,
  common: commonEn,
  wallet: walletEn,
  tickets: ticketsEn,
  ghostPass: ghostpassEn,
  session: sessionEn,
  scanner: scannerEn,
  entryTester: entryTesterEn,
  ghostPassInteractionSimulator: ghostPassInteractionSimulatorEn,
  history: historyEn,
  auditTrail: auditTrailEn,
  appContent: appContentEn,
  venueCommandCenter: venueCommandCenterEn,
  venue: venueEn,
  portal: portalEn,
  staff: staffEn,
  vendor: vendorEn,
  financial: financialEn,
  admin: adminTranslationsEn,
  venuePicker: venuePickerEn,
  analytics: analyticsEn,
  events: eventsEn,
  ticketTypes: ticketTypesEn,
  menuManager: menuManagerEn,
  gateway: gatewayEn,
  entryConfig: entryConfigEn,
  staffManager: staffManagerEn,
  payoutsManager: payoutsManagerEn,
  staffPortal: staffPortalEn,
  stations: stationsEn
};
const esResources = { 
  ...es, 
  ...adminEs,
  ...adminSetupEs,
  ...componentsEs,
  ...componentsExtendedEs, 
  ...menuEs, 
  ...navEs,
  ...adminTranslationsEs,
  common: commonEs,
  wallet: walletEs,
  tickets: ticketsEs,
  ghostPass: ghostpassEs,
  session: sessionEs,
  scanner: scannerEs,
  entryTester: entryTesterEs,
  ghostPassInteractionSimulator: ghostPassInteractionSimulatorEs,
  history: historyEs,
  auditTrail: auditTrailEs,
  appContent: appContentEs,
  venueCommandCenter: venueCommandCenterEs,
  venue: venueEs,
  portal: portalEs,
  staff: staffEs,
  vendor: vendorEs,
  financial: financialEs,
  admin: adminTranslationsEs,
  venuePicker: venuePickerEs,
  analytics: analyticsEs,
  events: eventsEs,
  ticketTypes: ticketTypesEs,
  menuManager: menuManagerEs,
  gateway: gatewayEs,
  entryConfig: entryConfigEs,
  staffManager: staffManagerEs,
  payoutsManager: payoutsManagerEs,
  staffPortal: staffPortalEs,
  stations: stationsEs
};

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
