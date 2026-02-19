import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RevenueProfileManager } from './RevenueProfileManager';
import { EventCreator } from './EventCreator';
import { MenuManager } from './MenuManager';
import { StationManager } from './StationManager';
import { TransactionLedger } from './TransactionLedger';

export const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'events' | 'profiles' | 'menu' | 'stations' | 'ledger'>('events');
  const selectedVenue = 'venue_001';
  const selectedEvent = '';

  const tabs = [
    { id: 'events' as const, label: t('events.title') },
    { id: 'profiles' as const, label: t('revenueProfiles.title') },
    { id: 'stations' as const, label: t('stations.title') },
    { id: 'menu' as const, label: t('menu.title') },
    { id: 'ledger' as const, label: t('transactionLedger.title') },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold">{t('commandCenter.title')}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow">
          {activeTab === 'events' && <EventCreator />}
          {activeTab === 'profiles' && <RevenueProfileManager />}
          {activeTab === 'stations' && <StationManager venueId={selectedVenue} eventId={selectedEvent} />}
          {activeTab === 'menu' && <MenuManager venueId={selectedVenue} eventId={selectedEvent} />}
          {activeTab === 'ledger' && <TransactionLedger />}
        </div>
      </div>
    </div>
  );
};
