import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <div className="relative group">
      <button
        className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 transition-all text-slate-300 hover:text-white min-h-[44px]"
        title="Change Language"
      >
        <Globe size={16} className="sm:w-[18px] sm:h-[18px]" />
        <span className="text-sm font-medium">{currentLanguage.flag}</span>
      </button>

      {/* Dropdown */}
      <div className="absolute bottom-full mb-2 left-0 w-36 sm:w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={cn(
              "w-full flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg min-h-[44px]",
              i18n.language === lang.code
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
            )}
          >
            <span className="text-base sm:text-lg">{lang.flag}</span>
            <span className="text-xs sm:text-sm font-medium">{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;
