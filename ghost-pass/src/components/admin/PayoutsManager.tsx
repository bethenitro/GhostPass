import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { PayoutRequest } from '@/types';

export const PayoutsManager: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getPayoutRequests('pending');
      setPayouts(data);
    } catch (error: any) {
      console.error('Error loading payouts:', error);
      // Don't show error toast for 401 - the router will handle it
      if (error.response?.status !== 401) {
        toast({
          title: t('common.error'),
          description: t('payouts.loadError'),
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutAction = async (payoutId: string, action: 'approve' | 'reject') => {
    try {
      setProcessing(payoutId);
      await adminApi.processPayoutAction(payoutId, { action });
      
      toast({
        title: t('common.success'),
        description: action === 'approve' ? t('payouts.approved') : t('payouts.rejected')
      });
      
      await loadPayouts();
    } catch (error) {
      console.error('Error processing payout:', error);
      toast({
        title: t('common.error'),
        description: t('payouts.actionError'),
        variant: 'destructive'
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleProcessAll = async () => {
    try {
      setProcessing('all');
      await adminApi.processAllPayouts();
      
      toast({
        title: t('common.success'),
        description: t('payouts.allProcessed')
      });
      
      await loadPayouts();
    } catch (error) {
      console.error('Error processing all payouts:', error);
      toast({
        title: t('common.error'),
        description: t('payouts.processAllError'),
        variant: 'destructive'
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
          <h2 className="text-lg sm:text-xl font-bold text-white">{t('payouts.title')}</h2>
        </div>
        {payouts.length > 0 && (
          <button
            onClick={handleProcessAll}
            disabled={processing === 'all'}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-500/20 border border-green-500 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 min-h-[44px] text-sm"
          >
            {processing === 'all' && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
            )}
            <span>{t('payouts.processAll')}</span>
          </button>
        )}
      </div>

      {payouts.length === 0 ? (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-8 sm:p-12 text-center">
          <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm sm:text-base">{t('payouts.noPending')}</p>
        </div>
      ) : (
        <>
          {/* Mobile View */}
          <div className="space-y-3 lg:hidden">
            {payouts.map((payout) => (
              <div key={payout.id} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium text-sm sm:text-base">{payout.vendor_email}</p>
                    <p className="text-green-400 font-mono text-lg sm:text-xl">{formatCurrency(payout.amount_cents)}</p>
                    <p className="text-slate-400 text-xs mt-1">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePayoutAction(payout.id, 'approve')}
                    disabled={processing === payout.id}
                    className="flex-1 px-3 py-3 bg-green-500/20 border border-green-500 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px] text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('common.approve')}</span>
                  </button>
                  <button
                    onClick={() => handlePayoutAction(payout.id, 'reject')}
                    disabled={processing === payout.id}
                    className="flex-1 px-3 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px] text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t('common.reject')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-950/50 border-b border-slate-700">
                <tr>
                  <th className="text-left px-6 py-3 text-slate-300 font-medium">Vendor</th>
                  <th className="text-left px-6 py-3 text-slate-300 font-medium">Amount</th>
                  <th className="text-left px-6 py-3 text-slate-300 font-medium">Requested</th>
                  <th className="text-right px-6 py-3 text-slate-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-t border-slate-700">
                    <td className="px-6 py-4 text-white">{payout.vendor_email}</td>
                    <td className="px-6 py-4 text-green-400 font-mono">{formatCurrency(payout.amount_cents)}</td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handlePayoutAction(payout.id, 'approve')}
                        disabled={processing === payout.id}
                        className="px-3 py-1 bg-green-500/20 border border-green-500 text-green-400 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
                      >
                        {t('common.approve')}
                      </button>
                      <button
                        onClick={() => handlePayoutAction(payout.id, 'reject')}
                        disabled={processing === payout.id}
                        className="px-3 py-1 bg-red-500/20 border border-red-500 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm"
                      >
                        {t('common.reject')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
