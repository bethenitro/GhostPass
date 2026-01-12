import React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminModeToggleProps {
  isAdminMode: boolean;
  onToggle: () => void;
  userRole: string;
}

const AdminModeToggle: React.FC<AdminModeToggleProps> = ({
  isAdminMode,
  onToggle,
  userRole
}) => {
  // Only show for admin users
  if (userRole !== 'ADMIN') {
    return null;
  }

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
      <span>ADMIN MODE</span>
      {isAdminMode && (
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
};

export default AdminModeToggle;