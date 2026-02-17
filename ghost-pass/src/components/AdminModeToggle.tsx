import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminModeToggleProps {
  isAdminMode: boolean;
  onToggle: () => void;
  userRole: string;
  compact?: boolean; // New prop for mobile compact mode
}

const AdminModeToggle: React.FC<AdminModeToggleProps> = ({
  isAdminMode,
  onToggle,
  userRole,
  compact = false
}) => {
  const { t } = useTranslation();
  // Only show for admin users
  if (userRole !== 'ADMIN') {
    return null;
  }

  if (compact) {
    // Compact version for mobile header
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center p-2 rounded-lg transition-all duration-300",
          isAdminMode
            ? "text-red-400 bg-red-500/10 border border-red-500/50 shadow-lg shadow-red-500/20"
            : "text-slate-500 hover:text-red-400 hover:bg-red-500/5 border border-transparent"
        )}
        title={isAdminMode ? "Admin Mode Active" : "Enable Admin Mode"}
      >
        <Settings 
          size={18} 
          className={cn(
            "transition-transform duration-300",
            isAdminMode && "rotate-90 animate-pulse"
          )} 
        />
        {isAdminMode && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  // Full version for desktop sidebar
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-300 text-sm font-medium",
        isAdminMode
          ? "text-red-400 bg-red-500/10 border border-red-500/50 shadow-lg shadow-red-500/20 animate-pulse"
          : "text-slate-500 hover:text-red-400 hover:bg-red-500/5 border border-transparent"
      )}
    >
      <Settings 
        size={16} 
        className={cn(
          "transition-transform duration-300",
          isAdminMode && "rotate-90"
        )} 
      />
      <span>{t('common.admin')}</span>
      {isAdminMode && (
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
};

export default AdminModeToggle;