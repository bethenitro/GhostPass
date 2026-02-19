import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { transactionApi } from '../../lib/api-client';

export const TransactionLedger: React.FC = () => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    venue_id: '',
    event_id: '',
    station_id: '',
    employee_id: '',
    revenue_profile_id: '',
    transaction_type: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await transactionApi.queryLedger(filters);
      setTransactions(res.data.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">{t('transactionLedger.title')}</h2>

      <div className="bg-slate-800/50 backdrop-blur-xl p-4 rounded-xl border border-slate-700 mb-6">
        <h3 className="font-bold mb-4">{t('transactionLedger.filterOptions')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <input
            type="text"
            placeholder={t('transactionLedger.filterByVenue')}
            value={filters.venue_id}
            onChange={(e) => handleFilterChange('venue_id', e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <input
            type="text"
            placeholder={t('transactionLedger.filterByEvent')}
            value={filters.event_id}
            onChange={(e) => handleFilterChange('event_id', e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <input
            type="text"
            placeholder={t('transactionLedger.filterByStation')}
            value={filters.station_id}
            onChange={(e) => handleFilterChange('station_id', e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <input
            type="text"
            placeholder={t('transactionLedger.filterByEmployee')}
            value={filters.employee_id}
            onChange={(e) => handleFilterChange('employee_id', e.target.value)}
            className="px-3 py-2 border rounded"
          />
          <select
            value={filters.transaction_type}
            onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">All Types</option>
            <option value="ENTRY">Entry</option>
            <option value="RE_ENTRY">Re-Entry</option>
            <option value="PURCHASE">Purchase</option>
            <option value="REFUND">Refund</option>
          </select>
          <button
            onClick={loadTransactions}
            className="bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded hover:bg-cyan-500/30"
          >
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-slate-800/50 backdrop-blur-xl p-4 rounded-xl border border-slate-700">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="font-mono text-sm text-slate-400">{tx.transaction_hash.substring(0, 16)}...</span>
                  <p className="text-xs text-gray-500 mt-1">{new Date(tx.timestamp).toLocaleString()}</p>
                </div>
                <span className={`px-3 py-1 rounded text-sm ${
                  tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {tx.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Type: <span className="font-medium">{tx.transaction_type}</span></p>
                  <p className="text-slate-400">Amount: <span className="font-medium">${(tx.item_amount_cents / 100).toFixed(2)}</span></p>
                  <p className="text-slate-400">Tax: <span className="font-medium">${(tx.tax_cents / 100).toFixed(2)}</span></p>
                  <p className="text-slate-400">Platform Fee: <span className="font-medium">${(tx.platform_fee_cents / 100).toFixed(2)}</span></p>
                </div>
                <div>
                  <p className="text-slate-400">Pre-Balance: <span className="font-medium">${(tx.pre_balance_cents / 100).toFixed(2)}</span></p>
                  <p className="text-slate-400">Post-Balance: <span className="font-medium">${(tx.post_balance_cents / 100).toFixed(2)}</span></p>
                  {tx.venue_id && <p className="text-slate-400">Venue: <span className="font-medium">{tx.venue_id}</span></p>}
                  {tx.event_id && <p className="text-slate-400">Event: <span className="font-medium">{tx.event_id}</span></p>}
                </div>
              </div>

              {tx.split_breakdown && Object.keys(tx.split_breakdown).length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium mb-2">{t('transactionLedger.splitBreakdown')}:</p>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    {Object.entries(tx.split_breakdown).map(([key, value]: [string, any]) => (
                      <div key={key}>
                        <span className="text-slate-400">{key}:</span>
                        <span className="ml-1 font-medium">${(value / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
