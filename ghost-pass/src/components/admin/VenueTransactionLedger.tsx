import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';

interface VenueTransactionLedgerProps {
  venueId: string;
  eventId?: string;
}

export const VenueTransactionLedger: React.FC<VenueTransactionLedgerProps> = ({ venueId, eventId }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <FileText className="w-6 h-6 text-orange-400" />
        <h2 className="text-xl font-bold text-white">{t('transactionLedger.title')}</h2>
      </div>
      <div className="text-center py-12">
        <p className="text-slate-400">{t('transactionLedger.eventScoped')}</p>
        <p className="text-slate-500 text-sm mt-2">Venue: {venueId}</p>
        {eventId && <p className="text-slate-500 text-sm">Event: {eventId}</p>}
      </div>
    </div>
  );
};
