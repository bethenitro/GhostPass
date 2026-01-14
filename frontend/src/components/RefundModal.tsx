import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, ArrowLeftRight, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletApi } from '../lib/api';
import type { RefundResponse, Transaction } from '../types';

interface RefundModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBalance: number; // in cents
    onRefundSuccess: () => void;
}

export default function RefundModal({
    isOpen,
    onClose,
    currentBalance,
    onRefundSuccess,
}: RefundModalProps) {
    const [step, setStep] = useState<'select' | 'input' | 'confirm' | 'processing' | 'success' | 'error'>('select');
    const [fundingTransactions, setFundingTransactions] = useState<Transaction[]>([]);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [amount, setAmount] = useState('');
    const [refundResponse, setRefundResponse] = useState<RefundResponse | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            loadEligibleTransactions();
        }
    }, [isOpen]);

    const loadEligibleTransactions = async () => {
        setLoading(true);
        try {
            const transactions = await walletApi.getEligibleFundingTransactions();
            setFundingTransactions(transactions);
        } catch (err) {
            setError('Failed to load funding transactions');
        } finally {
            setLoading(false);
        }
    };

    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    const maxRefundable = selectedTransaction ? selectedTransaction.amount_cents : 0;

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Allow only numbers and decimal point
        if (/^\d*\.?\d{0,2}$/.test(value)) {
            setAmount(value);
            setError('');
        }
    };

    const validateAmount = (): boolean => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return false;
        }
        if (amountCents > maxRefundable) {
            setError(`Amount exceeds original deposit ($${(maxRefundable / 100).toFixed(2)})`);
            return false;
        }
        if (amountCents > currentBalance) {
            setError(`Amount exceeds current balance ($${(currentBalance / 100).toFixed(2)})`);
            return false;
        }
        return true;
    };

    const handleSelectTransaction = (transaction: Transaction) => {
        setSelectedTransaction(transaction);
        setStep('input');
    };

    const handleContinue = () => {
        if (validateAmount()) {
            setStep('confirm');
        }
    };

    const handleConfirmRefund = async () => {
        if (!selectedTransaction) return;

        setStep('processing');
        try {
            const response = await walletApi.requestRefund(amountCents, selectedTransaction.id);
            setRefundResponse(response);

            if (response.status === 'SUCCESS') {
                setStep('success');
                setTimeout(() => {
                    onRefundSuccess();
                    handleClose();
                }, 3000);
            } else {
                setError(response.message);
                setStep('error');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to process refund. Please try again.');
            setStep('error');
        }
    };

    const handleClose = () => {
        setStep('select');
        setSelectedTransaction(null);
        setAmount('');
        setError('');
        setRefundResponse(null);
        onClose();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="glass-card max-w-md w-full space-y-6 max-h-[90vh] overflow-y-auto"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50">
                                <ArrowLeftRight className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">REFUND REQUEST</h2>
                                <p className="text-xs text-slate-400 uppercase tracking-widest">Return to Original Source</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                            <X size={20} className="text-white/60" />
                        </button>
                    </div>

                    {/* Content */}
                    <div>
                        {/* Select Transaction Step */}
                        {step === 'select' && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-4"
                            >
                                <div>
                                    <h3 className="label-tactical mb-3">Select Deposit to Refund</h3>

                                    {loading ? (
                                        <div className="text-center py-8">
                                            <div className="loading-spinner w-8 h-8 mx-auto mb-3"></div>
                                            <p className="text-slate-400 text-sm">Loading transactions...</p>
                                        </div>
                                    ) : fundingTransactions.length === 0 ? (
                                        <div className="glass-panel p-6 text-center">
                                            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                                            <p className="text-white mb-2">No Eligible Deposits</p>
                                            <p className="text-slate-400 text-sm">You don't have any deposits available for refund.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {fundingTransactions.map((tx) => (
                                                <motion.button
                                                    key={tx.id}
                                                    onClick={() => handleSelectTransaction(tx)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className="w-full glass-panel p-4 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all text-left"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="data-mono text-lg">
                                                            ${(tx.amount_cents / 100).toFixed(2)}
                                                        </span>
                                                        <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300 capitalize">
                                                            {tx.gateway_id || 'Unknown'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDate(tx.timestamp)}
                                                    </div>
                                                    {tx.refund_status === 'PARTIAL' && (
                                                        <div className="mt-2 text-xs text-yellow-400">
                                                            Partially refunded
                                                        </div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Input Step */}
                        {step === 'input' && selectedTransaction && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-4"
                            >
                                <div className="glass-panel p-4 border-cyan-500/30">
                                    <p className="label-tactical mb-2">Selected Deposit</p>
                                    <div className="flex items-center justify-between">
                                        <span className="data-mono text-lg">
                                            ${(selectedTransaction.amount_cents / 100).toFixed(2)}
                                        </span>
                                        <span className="text-xs text-slate-400 capitalize">
                                            {selectedTransaction.gateway_id || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {formatDate(selectedTransaction.timestamp)}
                                    </div>
                                </div>

                                <div>
                                    <label className="label-tactical mb-2 block">
                                        Refund Amount
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 text-xl font-mono">
                                            $
                                        </span>
                                        <input
                                            type="text"
                                            value={amount}
                                            onChange={handleAmountChange}
                                            placeholder="0.00"
                                            className="tactical-input w-full pl-10 pr-4 py-3 text-xl font-mono text-cyan-400"
                                            autoFocus
                                        />
                                    </div>
                                    {error && (
                                        <motion.p
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-2 text-sm text-red-400 flex items-center gap-2"
                                        >
                                            <AlertCircle className="w-4 h-4" />
                                            {error}
                                        </motion.p>
                                    )}
                                </div>

                                <div className="glass-panel p-4 border-cyan-500/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="label-tactical">Current Balance</span>
                                        <span className="data-mono text-lg">
                                            ${(currentBalance / 100).toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Refunds are processed to your original payment method within 3-5 business days.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setStep('select')}
                                        className="flex-1 glass-panel px-6 py-3 font-medium text-white hover:bg-white/10 transition-all"
                                    >
                                        BACK
                                    </button>
                                    <button
                                        onClick={handleContinue}
                                        className="flex-1 btn-primary"
                                    >
                                        CONTINUE
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Confirmation Step */}
                        {step === 'confirm' && selectedTransaction && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="space-y-4"
                            >
                                <div className="glass-panel p-4 space-y-3">
                                    <h3 className="label-tactical text-white">Confirm Refund Details</h3>
                                    <div className="space-y-2 font-mono">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">Refund Amount:</span>
                                            <span className="text-cyan-400 text-lg font-bold">${amount}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">Original Deposit:</span>
                                            <span className="text-white text-sm">
                                                ${(selectedTransaction.amount_cents / 100).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">New Balance:</span>
                                            <span className="text-white text-lg font-bold">
                                                ${((currentBalance - amountCents) / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-panel p-4 border-red-500/30 bg-red-500/5">
                                    <p className="text-sm text-red-400 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>This action cannot be undone. The refund will be processed to your original payment method.</span>
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setStep('input')}
                                        className="flex-1 glass-panel px-6 py-3 font-medium text-white hover:bg-white/10 transition-all"
                                    >
                                        BACK
                                    </button>
                                    <button
                                        onClick={handleConfirmRefund}
                                        className="flex-1 btn-primary"
                                    >
                                        CONFIRM REFUND
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Processing Step */}
                        {step === 'processing' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12"
                            >
                                <div className="loading-spinner w-16 h-16 mx-auto mb-6"></div>
                                <p className="text-white font-medium text-lg mb-2">Processing Refund...</p>
                                <p className="text-slate-400 text-sm">Please wait</p>
                            </motion.div>
                        )}

                        {/* Success Step */}
                        {step === 'success' && refundResponse && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                    className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto mb-6"
                                >
                                    <CheckCircle className="w-12 h-12 text-emerald-400 neon-glow-emerald" />
                                </motion.div>
                                <h3 className="text-2xl font-bold text-white mb-3">REFUND INITIATED</h3>
                                <p className="text-slate-300 mb-4">{refundResponse.message}</p>
                                {refundResponse.estimated_arrival && (
                                    <p className="text-sm text-cyan-400 mb-4">
                                        Estimated arrival: {refundResponse.estimated_arrival}
                                    </p>
                                )}
                                {refundResponse.refund_id && (
                                    <div className="glass-panel p-3 inline-block">
                                        <p className="label-tactical mb-1">Reference ID</p>
                                        <p className="font-mono text-xs text-slate-400">
                                            {refundResponse.refund_id.slice(0, 8)}...
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Error Step */}
                        {step === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                    className="w-20 h-20 bg-red-500/20 border-2 border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-6"
                                >
                                    <AlertCircle className="w-12 h-12 text-red-400 neon-glow-red" />
                                </motion.div>
                                <h3 className="text-2xl font-bold text-white mb-3">REFUND FAILED</h3>
                                <p className="text-slate-300 mb-6">{error}</p>
                                <button
                                    onClick={() => setStep('select')}
                                    className="btn-primary px-8"
                                >
                                    TRY AGAIN
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
