import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className, 
  showLabel = true 
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all min-h-[44px]"
        title={i18n.language === 'en' ? 'Switch Language' : 'Cambiar Idioma'}
      >
        <span className="text-lg">{i18n.language === 'en' ? '🇺🇸' : '🇪🇸'}</span>
        {showLabel && (
          <span className="text-slate-300 text-sm font-medium uppercase">
            {i18n.language === 'en' ? 'EN' : 'ES'}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden z-50">
          <button
            onClick={() => changeLanguage('en')}
            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">🇺🇸</span>
              <span>English</span>
            </span>
            {i18n.language === 'en' && <Check className="w-4 h-4 text-cyan-400" />}
          </button>
          <button
            onClick={() => changeLanguage('es')}
            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">🇪🇸</span>
              <span>Español</span>
            </span>
            {i18n.language === 'es' && <Check className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      )}
    </div>
  );
};
