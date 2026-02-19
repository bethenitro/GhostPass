import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus } from 'lucide-react';

interface VenueStaffManagerProps {
  venueId: string;
}

export const VenueStaffManager: React.FC<VenueStaffManagerProps> = ({ venueId: _venueId }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-bold text-white">{t('staff.title')}</h2>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded-lg text-indigo-400 transition-all min-h-[44px]">
          <Plus className="w-4 h-4" />
          <span className="text-sm">{t('staff.addStaff')}</span>
        </button>
      </div>

      <div className="text-center py-12">
        <p className="text-slate-400">{t('staff.staffList')}</p>
      </div>
    </div>
  );
};
