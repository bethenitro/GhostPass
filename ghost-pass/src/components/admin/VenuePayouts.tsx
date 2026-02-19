import React from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign } from 'lucide-react';

interface VenuePayoutsProps {
  venueId: string;
}

export const VenuePayouts: React.FC<VenuePayoutsProps> = ({ venueId: _venueId }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <DollarSign className="w-6 h-6 text-green-400" />
        <h2 className="text-xl font-bold text-white">{t('payouts.title')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">{t('payouts.pending')}</p>
          <p className="text-2xl font-bold text-white">$0.00</p>
        </div>
        <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">{t('payouts.history')}</p>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
      </div>
    </div>
  );
};
