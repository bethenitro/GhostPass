import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ArrowUpRight, ArrowDownLeft, X, Calendar, MapPin, Hash } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../lib/api';
import type { Transaction } from '../types';

const TransactionHistory: React.FC = () => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: walletApi.getTransactions,
  });

  const handleDownload = async () => {
    try {
      // Helper function to escape CSV values
      const escapeCSV = (value: string | number | undefined | null): string => {
        if (value === undefined || value === null || value === '') {
          return '';
        }
        const str = String(value);
        // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Create properly formatted CSV content
      const csvHeader = 'Date,Time,Type,Description,Amount (USD),Payment Method,Venue ID,Transaction ID\n';
      const csvRows = transactions.map(t => {
        const date = escapeCSV(formatDate(t.timestamp));
        const time = escapeCSV(formatTime(t.timestamp));
        const type = escapeCSV(t.type);
        const description = escapeCSV(getTransactionLabel(t));
        const amount = escapeCSV((t.amount_cents / 100).toFixed(2));
        const gateway = escapeCSV(t.gateway_id);
        const venue = escapeCSV(t.venue_id);
        const id = escapeCSV(t.id);
        
        return [date, time, type, description, amount, gateway, venue, id].join(',');
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghostpass-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'FUND':
        return ArrowDownLeft;
      case 'SPEND':
      case 'FEE':
        return ArrowUpRight;
      default:
        return ArrowUpRight;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'FUND':
        return 'text-neon-green';
      case 'SPEND':
      case 'FEE':
        return 'text-neon-red';
      default:
        return 'text-white';
    }
  };

  const getTransactionLabel = (transaction: Transaction) => {
    // Use vendor_name if available, otherwise fall back to old logic
    if (transaction.vendor_name) {
      return transaction.vendor_name;
    }
    
    switch (transaction.type) {
      case 'FUND':
        return `Wallet Funding${transaction.gateway_id ? ` (${transaction.gateway_id})` : ''}`;
      case 'SPEND':
        return transaction.metadata?.pass_id ? 'GhostPass Purchase' : 'Purchase';
      case 'FEE':
        return 'Transaction Fee';
      default:
        return transaction.type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">TRANSACTION LEDGER</h1>
          <p className="text-white/60 text-sm">Complete transaction history</p>
        </div>
        <button
          onClick={handleDownload}
          className="glass-button flex items-center space-x-2 px-3 py-2 sm:px-4 sm:py-2"
        >
          <Download size={16} />
          <span className="hidden sm:inline">CSV</span>
        </button>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 text-center"
          >
            <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/60">Loading transactions...</p>
          </motion.div>
        ) : transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 text-center"
          >
            <p className="text-white/60">No transactions yet</p>
          </motion.div>
        ) : (
          transactions.map((transaction, index) => {
            const Icon = getTransactionIcon(transaction.type);
            const colorClass = getTransactionColor(transaction.type);

            return (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-3 sm:p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg bg-white/10 ${colorClass} flex-shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm sm:text-base truncate">
                        {getTransactionLabel(transaction)}
                      </p>
                      <p className="text-white/60 text-xs sm:text-sm">
                        {formatDate(transaction.timestamp)} • {formatTime(transaction.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                    <div className="text-right">
                      <p className={`font-mono font-bold text-sm sm:text-base ${colorClass}`}>
                        {transaction.type === 'FUND' ? '+' : '-'}${Math.abs(transaction.amount_cents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-neon-green">
                        completed
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedTransaction(transaction)}
                      className="px-2 py-1 sm:px-3 sm:py-1 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan text-xs sm:text-sm font-medium rounded hover:bg-neon-cyan/30 transition-colors min-h-[32px]"
                    >
                      <span className="hidden sm:inline">View</span>
                      <span className="sm:hidden">•••</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTransaction(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card max-w-sm sm:max-w-md w-full mx-4 p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-white">Digital Receipt</h2>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X size={20} className="text-white/60" />
                </button>
              </div>

              {/* Receipt Content */}
              <div className="space-y-3 sm:space-y-4 font-mono text-sm">
                <div className="border-b border-white/20 pb-3 sm:pb-4">
                  <div className="text-center">
                    <p className="text-neon-cyan font-bold text-base sm:text-lg">GHOSTPASS WALLET</p>
                    <p className="text-white/60 text-sm">Digital Transaction Receipt</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Hash size={16} className="text-white/60 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white/60 text-xs">Transaction ID</p>
                      <p className="text-white text-sm break-all">{selectedTransaction.id.slice(0, 8)}...</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Calendar size={16} className="text-white/60 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white/60 text-xs">Date & Time</p>
                      <p className="text-white text-sm">
                        {formatDate(selectedTransaction.timestamp)} {formatTime(selectedTransaction.timestamp)}
                      </p>
                    </div>
                  </div>

                  {selectedTransaction.gateway_id && (
                    <div className="flex items-center space-x-3">
                      <MapPin size={16} className="text-white/60 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white/60 text-xs">Payment Method</p>
                        <p className="text-white text-sm capitalize">{selectedTransaction.gateway_id}</p>
                      </div>
                    </div>
                  )}

                  {selectedTransaction.venue_id && (
                    <div className="flex items-center space-x-3">
                      <MapPin size={16} className="text-white/60 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white/60 text-xs">Venue ID</p>
                        <p className="text-white text-sm break-all">{selectedTransaction.venue_id}</p>
                      </div>
                    </div>
                  )}

                  {selectedTransaction.vendor_name && (
                    <div className="flex items-center space-x-3">
                      <MapPin size={16} className="text-white/60 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white/60 text-xs">Vendor</p>
                        <p className="text-white text-sm">{selectedTransaction.vendor_name}</p>
                      </div>
                    </div>
                  )}

                  {selectedTransaction.balance_before_cents !== null && selectedTransaction.balance_before_cents !== undefined && (
                    <div className="space-y-2 border-t border-white/20 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-xs">Balance Before</span>
                        <span className="text-white text-sm font-mono">
                          ${(selectedTransaction.balance_before_cents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-xs">Balance After</span>
                        <span className="text-neon-green text-sm font-mono font-bold">
                          ${(selectedTransaction.balance_after_cents! / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-white/20 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Amount:</span>
                      <span className={`font-bold text-base sm:text-lg ${getTransactionColor(selectedTransaction.type)}`}>
                        {selectedTransaction.type === 'FUND' ? '+' : '-'}${Math.abs(selectedTransaction.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Type:</span>
                      <span className="text-white capitalize text-sm">
                        {getTransactionLabel(selectedTransaction)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Status:</span>
                      <span className="text-neon-green text-sm">
                        Completed
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/20 pt-3 sm:pt-4 text-center">
                  <p className="text-white/40 text-xs">
                    Thank you for using GhostPass
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionHistory;