import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Loader2, CheckCircle } from 'lucide-react';
import { vendorPayoutApi } from '@/lib/api-client';
import { useToast } from '../ui/toast';

interface VenuePayoutsProps {
  venueId: string;
}

type PayoutMethod = 'paypal' | 'bank_transfer' | 'zelle' | 'venmo' | 'email_phone';

const METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'email_phone', label: 'Email / Phone' },
];

export const VenuePayouts: React.FC<VenuePayoutsProps> = ({ venueId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [method, setMethod] = useState<PayoutMethod | ''>('');
  const [details, setDetails] = useState({
    email: '',
    phone: '',
    paypal_email: '',
    venmo_handle: '',
    zelle_email: '',
    zelle_phone: '',
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    routing_number: '',
    org_name: '',
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    loadExisting();
  }, [venueId]);

  const loadExisting = async () => {
    try {
      const res = await vendorPayoutApi.getSetup('');
      if (res.data) {
        setMethod(res.data.method || '');
        setDetails(prev => ({ ...prev, ...(res.data.details || {}) }));
        setSaved(true);
      }
    } catch {
      // no existing setup
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleSave = async () => {
    if (!method) {
      showToast(t('payoutsManager.selectMethod'), 'error');
      return;
    }
    setLoading(true);
    try {
      await vendorPayoutApi.saveSetup({ method, details });
      setSaved(true);
      showToast(t('payoutsManager.saved'), 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || t('payoutsManager.saveFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none text-sm";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1";

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <DollarSign className="w-6 h-6 text-green-400" />
        <h2 className="text-xl font-bold text-white">{t('payoutsManager.title')}</h2>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {t('payoutsManager.configured')}
        </div>
      )}

      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-5 space-y-5">
        <div>
          <label className={labelClass}>{t('payoutsManager.pickMethod')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { setMethod(m.value); setSaved(false); }}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
                  method === m.value
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-400'
                    : 'bg-slate-800/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                {t(`payoutsManager.methods.${m.value}`)}
              </button>
            ))}
          </div>
        </div>

        {method === 'paypal' && (
          <div>
            <label className={labelClass}>{t('payoutsManager.paypalEmail')}</label>
            <input type="email" className={inputClass} placeholder="you@paypal.com"
              value={details.paypal_email}
              onChange={e => setDetails({ ...details, paypal_email: e.target.value })} />
          </div>
        )}

        {method === 'venmo' && (
          <div>
            <label className={labelClass}>{t('payoutsManager.venmoHandle')}</label>
            <input type="text" className={inputClass} placeholder="@yourhandle"
              value={details.venmo_handle}
              onChange={e => setDetails({ ...details, venmo_handle: e.target.value })} />
          </div>
        )}

        {method === 'zelle' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('payoutsManager.zelleEmail')}</label>
              <input type="email" className={inputClass} placeholder="you@email.com"
                value={details.zelle_email}
                onChange={e => setDetails({ ...details, zelle_email: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('payoutsManager.zellePhone')}</label>
              <input type="tel" className={inputClass} placeholder="+1 555 000 0000"
                value={details.zelle_phone}
                onChange={e => setDetails({ ...details, zelle_phone: e.target.value })} />
            </div>
          </div>
        )}

        {method === 'email_phone' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('payoutsManager.email')}</label>
              <input type="email" className={inputClass} placeholder="you@email.com"
                value={details.email}
                onChange={e => setDetails({ ...details, email: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('payoutsManager.phone')}</label>
              <input type="tel" className={inputClass} placeholder="+1 555 000 0000"
                value={details.phone}
                onChange={e => setDetails({ ...details, phone: e.target.value })} />
            </div>
          </div>
        )}

        {method === 'bank_transfer' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('payoutsManager.nameOnAccount')}</label>
                <input type="text" className={inputClass} placeholder="Full legal name"
                  value={details.account_holder_name}
                  onChange={e => setDetails({ ...details, account_holder_name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t('payoutsManager.bankName')}</label>
                <input type="text" className={inputClass} placeholder="e.g. Chase, Wells Fargo"
                  value={details.bank_name}
                  onChange={e => setDetails({ ...details, bank_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('payoutsManager.accountNumber')}</label>
                <input type="text" className={inputClass} placeholder="Account #"
                  value={details.account_number}
                  onChange={e => setDetails({ ...details, account_number: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t('payoutsManager.routingNumber')}</label>
                <input type="text" className={inputClass} placeholder="9-digit routing #"
                  value={details.routing_number}
                  onChange={e => setDetails({ ...details, routing_number: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('payoutsManager.orgName')}</label>
              <input type="text" className={inputClass} placeholder="Your business or org name"
                value={details.org_name}
                onChange={e => setDetails({ ...details, org_name: e.target.value })} />
            </div>
          </div>
        )}

        {method && (
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 py-3 px-4 rounded-lg hover:bg-cyan-500/30 disabled:opacity-50 transition-all font-medium min-h-[44px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {loading ? t('payoutsManager.saving') : t('payoutsManager.confirmSetup')}
          </button>
        )}
      </div>
    </div>
  );
};
