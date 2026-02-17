import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Bank {
  id: string;
  name: string;
  logo: string;
  logoUrl: string;
  color: string;
  popular: boolean;
}

const banks: Bank[] = [
  { 
    id: 'chase', 
    name: 'Chase', 
    logo: 'https://www.pngmart.com/files/23/Chase-Bank-Logo-PNG-HD.png',
    logoUrl: 'https://www.pngmart.com/files/23/Chase-Bank-Logo-PNG-HD.png',
    color: 'bg-blue-600', 
    popular: true 
  },
  { 
    id: 'boa', 
    name: 'Bank of America', 
    logo: 'https://companieslogo.com/img/orig/BAC-e7995069.png?t=1720244490',
    logoUrl: 'https://companieslogo.com/img/orig/BAC-e7995069.png?t=1720244490',
    color: 'bg-red-600', 
    popular: true 
  },
  { 
    id: 'wells', 
    name: 'Wells Fargo', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Wells_Fargo_Bank.svg/200px-Wells_Fargo_Bank.svg.png',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Wells_Fargo_Bank.svg/200px-Wells_Fargo_Bank.svg.png',
    color: 'bg-yellow-600', 
    popular: true 
  },
  { 
    id: 'citi', 
    name: 'Citibank', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Citi_logo_March_2023.svg/1280px-Citi_logo_March_2023.svg.png',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Citi_logo_March_2023.svg/1280px-Citi_logo_March_2023.svg.png',
    color: 'bg-blue-500', 
    popular: true 
  },
  { 
    id: 'hsbc', 
    name: 'HSBC', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/HSBC_logo_%282018%29.svg/200px-HSBC_logo_%282018%29.svg.png',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/HSBC_logo_%282018%29.svg/200px-HSBC_logo_%282018%29.svg.png',
    color: 'bg-red-500', 
    popular: false 
  },
  { 
    id: 'santander', 
    name: 'Santander', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/200px-Banco_Santander_Logotipo.svg.png',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/200px-Banco_Santander_Logotipo.svg.png',
    color: 'bg-red-700', 
    popular: false 
  },
  { 
    id: 'deutsche', 
    name: 'Deutsche Bank', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Deutsche_Bank_logo_without_wordmark.svg/200px-Deutsche_Bank_logo_without_wordmark.svg.png',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Deutsche_Bank_logo_without_wordmark.svg/200px-Deutsche_Bank_logo_without_wordmark.svg.png',
    color: 'bg-blue-800', 
    popular: false 
  },
  { 
    id: 'other', 
    name: 'Other Bank', 
    logo: '?', 
    logoUrl: '',
    color: 'bg-slate-600', 
    popular: false 
  },
];

interface BankVisualPlaceholdersProps {
  className?: string;
}

export const BankVisualPlaceholders: React.FC<BankVisualPlaceholdersProps> = ({ className }) => {
  const { t } = useTranslation();
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);

  const popularBanks = banks.filter(bank => bank.popular);
  const otherBanks = banks.filter(bank => !bank.popular);

  const handleBankSelect = (bankId: string) => {
    setSelectedBank(bankId);
    if (bankId !== 'other') {
      setShowAccountForm(true);
    }
  };

  const handleOtherBankSelect = () => {
    setSelectedBank('other');
    setShowAccountForm(true);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Popular Banks */}
      <div>
        <h3 className="text-slate-300 font-medium mb-3 flex items-center space-x-2">
          <Building2 size={16} />
          <span>{t('bankVisualPlaceholders.selectYourBank')}</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {popularBanks.map((bank) => (
            <motion.button
              key={bank.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleBankSelect(bank.id)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all duration-200 text-left",
                selectedBank === bank.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800/70"
              )}
            >
              {selectedBank === bank.id && (
                <div className="absolute top-2 right-2">
                  <Check className="text-emerald-400" size={16} />
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img 
                    src={bank.logoUrl} 
                    alt={bank.name}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      // Fallback to text if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.className = cn(parent.className, bank.color);
                        parent.innerHTML = `<span class="text-white font-bold text-xs">${bank.name.substring(0, 3).toUpperCase()}</span>`;
                      }
                    }}
                  />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{bank.name}</p>
                  <p className="text-slate-400 text-xs">{t('bankVisualPlaceholders.connectAccount')}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Other Banks */}
      <div>
        <h3 className="text-slate-300 font-medium mb-3">{t('bankVisualPlaceholders.otherBanks')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {otherBanks.slice(0, -1).map((bank) => (
            <motion.button
              key={bank.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleBankSelect(bank.id)}
              className={cn(
                "relative p-3 rounded-lg border transition-all duration-200 text-left",
                selectedBank === bank.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
              )}
            >
              {selectedBank === bank.id && (
                <div className="absolute top-2 right-2">
                  <Check className="text-emerald-400" size={14} />
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded bg-white flex items-center justify-center overflow-hidden">
                  <img 
                    src={bank.logoUrl} 
                    alt={bank.name}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      // Fallback to text if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.className = cn(parent.className, bank.color);
                        parent.innerHTML = `<span class="text-white font-bold text-xs">${bank.name.substring(0, 2).toUpperCase()}</span>`;
                      }
                    }}
                  />
                </div>
                <p className="text-white text-sm">{bank.name}</p>
              </div>
            </motion.button>
          ))}
          
          {/* Custom Bank Option */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleOtherBankSelect}
            className={cn(
              "relative p-3 rounded-lg border transition-all duration-200 text-left",
              selectedBank === 'other'
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
            )}
          >
            {selectedBank === 'other' && (
              <div className="absolute top-2 right-2">
                <Check className="text-emerald-400" size={14} />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center text-white font-bold text-xs">
                ?
              </div>
              <p className="text-white text-sm">{t('bankVisualPlaceholders.otherBank')}</p>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Account Form */}
      {showAccountForm && selectedBank && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-slate-600 rounded-lg p-4"
        >
          <h4 className="text-slate-300 font-medium mb-3 flex items-center space-x-2">
            <Building2 size={16} />
            <span>{t('bankVisualPlaceholders.accountInformation')}</span>
          </h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('bankVisualPlaceholders.accountHolderName')}</label>
                <input
                  type="text"
                  placeholder={t('bankVisualPlaceholders.enterFullName')}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('bankVisualPlaceholders.accountNumber')}</label>
                <input
                  type="text"
                  placeholder={t('bankVisualPlaceholders.enterAccountNumber')}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('bankVisualPlaceholders.routingNumber')}</label>
                <input
                  type="text"
                  placeholder={t('bankVisualPlaceholders.nineDigitRoutingNumber')}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('bankVisualPlaceholders.accountType')}</label>
                <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">{t('bankVisualPlaceholders.selectAccountType')}</option>
                  <option value="checking">{t('bankVisualPlaceholders.checking')}</option>
                  <option value="savings">{t('bankVisualPlaceholders.savings')}</option>
                </select>
              </div>
            </div>

            {selectedBank === 'other' && (
              <div>
                <label className="block text-sm text-slate-400 mb-2">{t('bankVisualPlaceholders.bankName')}</label>
                <input
                  type="text"
                  placeholder={t('bankVisualPlaceholders.enterYourBankName')}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div className="pt-2">
              <button className="w-full md:w-auto px-6 py-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg font-medium hover:bg-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300">
                {t('bankVisualPlaceholders.saveAccountInformation')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Clear Selection */}
      {selectedBank && (
        <div className="text-center">
          <button
            onClick={() => {
              setSelectedBank(null);
              setShowAccountForm(false);
            }}
            className="text-slate-400 hover:text-slate-300 text-sm underline transition-colors"
          >
            {t('bankVisualPlaceholders.clearSelection')}
          </button>
        </div>
      )}
    </div>
  );
};

export default BankVisualPlaceholders;