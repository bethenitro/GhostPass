import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, ScanLine, CheckCircle, Receipt, Loader2, Target, AlertCircle } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { useToast } from '../ui/toast';
import { cn } from '@/lib/utils';

interface MenuItem {
    id: string;
    item_name: string;
    price_cents: number;
    item_category: string;
    station_type: string;
    is_taxable: boolean;
}

interface CartItem extends MenuItem {
    quantity: number;
}

interface StaffPOSProps {
    user: any;
}

const StaffPOS: React.FC<StaffPOSProps> = ({ user }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [menuLoading, setMenuLoading] = useState(true);
    const [menuError, setMenuError] = useState<string | null>(null);
    const [isCharging, setIsCharging] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    const scannerRef = React.useRef<Html5Qrcode | null>(null);
    const scannerElementId = 'staff-pos-scanner';

    // Fetch live menu from backend
    useEffect(() => {
        const fetchMenu = async () => {
            try {
                setMenuLoading(true);
                setMenuError(null);

                const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
                const token = localStorage.getItem('auth_token');

                // Build query: filter by venue + station type
                const params = new URLSearchParams();
                if (user.venue_id) params.append('venue_id', user.venue_id);
                if (user.role) params.append('station_type', user.role);

                const response = await fetch(`${API_BASE_URL}/menu/manage?${params.toString()}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) throw new Error('Failed to load menu');

                const data = await response.json();
                setMenuItems(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch menu:', err);
                setMenuError(t('staffPortal.menuError'));
            } finally {
                setMenuLoading(false);
            }
        };

        fetchMenu();
    }, [user.venue_id, user.role]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeFromCart = (id: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === id);
            if (!existing) return prev;
            if (existing.quantity === 1) {
                return prev.filter(i => i.id !== id);
            }
            return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
        });
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
    const tax = Math.round(subtotal * 0.08); // 8% tax
    const total = subtotal + tax;

    const handleCharge = () => {
        if (cart.length === 0) return;
        setIsCharging(true);
        setShowScanner(true);
    };

    const startScanner = async () => {
        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(scannerElementId);
            }

            if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
                await scannerRef.current.stop();
            }

            await scannerRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                () => {
                    // Ignore normal scan errors
                }
            );
        } catch (err) {
            console.error("Scanner failed to start", err);
            showToast(t('staffPortal.cameraFailed'), "error");
            setShowScanner(false);
            setIsCharging(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
        }
    };

    useEffect(() => {
        if (showScanner) {
            setTimeout(startScanner, 300);
        } else {
            stopScanner();
        }
        return () => { stopScanner(); };
    }, [showScanner]);

    const handleScanSuccess = async (qrData: string) => {
        await stopScanner();
        setShowScanner(false);
        setIsProcessingPayment(true);

        try {
            let passId = qrData;
            if (qrData.includes('ghostsession:')) {
                passId = qrData.split(':')[1];
            }

            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
            const token = localStorage.getItem('auth_token');

            const response = await fetch(`${API_BASE_URL}/staff/pos/charge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pass_id: passId,
                    cart_items: cart,
                    total_cents: total,
                    tax_cents: tax,
                    subtotal_cents: subtotal,
                    station_type: user.role
                })
            });

            if (!response.ok) {
                throw new Error('Payment failed or insufficient funds');
            }

            const result = await response.json();
            setScanResult({
                success: true,
                receipt_id: result.receipt_id || `RCPT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                amount: total
            });
            setCart([]);

        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : t('staffPortal.paymentFailed'), "error");
            setIsCharging(false);
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const resetPos = () => {
        setScanResult(null);
        setIsCharging(false);
    };

    // Group menu items by category for display
    const groupedMenu = menuItems.reduce((acc, item) => {
        const cat = item.item_category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">

            {/* Menu Area */}
            <div className="lg:col-span-2 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">{t('staffPortal.menu')} &middot; {user.role}</h2>
                </div>

                {menuLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    </div>
                ) : menuError ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                        <p className="text-slate-400">{menuError}</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700">
                            {t('staffPortal.retry')}
                        </button>
                    </div>
                ) : menuItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                        <Receipt className="w-12 h-12 text-slate-600" />
                        <p className="text-slate-400 text-lg font-medium">{t('staffPortal.noMenuItems')}</p>
                        <p className="text-slate-500 text-sm">{t('staffPortal.noMenuHint', { role: user.role })}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedMenu).map(([category, items]) => (
                            <div key={category}>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{category}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {items.map(item => (
                                        <motion.button
                                            key={item.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => addToCart(item)}
                                            className="bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl p-4 text-left flex flex-col justify-between aspect-square transition-colors"
                                        >
                                            <div>
                                                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1 block">
                                                    {item.item_category}
                                                </span>
                                                <span className="text-base font-bold text-white block leading-tight">
                                                    {item.item_name}
                                                </span>
                                            </div>
                                            <div className="text-lg font-bold text-emerald-400 mt-2">
                                                ${(item.price_cents / 100).toFixed(2)}
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cart & Checkout Area */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl flex flex-col overflow-hidden relative">

                {/* Receipt / Success Overlay */}
                <AnimatePresence>
                    {scanResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute inset-0 z-20 bg-slate-900 flex flex-col items-center justify-center p-6 text-center"
                        >
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{t('staffPortal.paymentApproved')}</h2>
                            <p className="text-emerald-400 text-3xl font-bold mb-6">
                                ${(scanResult.amount / 100).toFixed(2)}
                            </p>
                            <div className="bg-slate-800/50 w-full p-4 rounded-lg mb-8 border border-slate-700">
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-slate-400">{t('staffPortal.receiptId')}</span>
                                    <span className="text-white font-mono">{scanResult.receipt_id}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">{t('staffPortal.cashier')}</span>
                                    <span className="text-white">{user.name || user.email}</span>
                                </div>
                            </div>
                            <button onClick={resetPos} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors">
                                {t('staffPortal.newOrder')}
                            </button>
                        </motion.div>
                    )}

                    {/* Scanner Overlay */}
                    {showScanner && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-10 bg-black flex flex-col"
                        >
                            <div className="flex-1 relative">
                                <div id={scannerElementId} className="w-full h-full object-cover"></div>
                                <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"></div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <Target className="w-48 h-48 text-cyan-400/50 pointer-events-none" strokeWidth={1} />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900 border-t border-slate-800 text-center relative z-20">
                                <p className="text-cyan-400 font-bold mb-4">{t('staffPortal.scanPatron')}</p>
                                <button onClick={() => { setShowScanner(false); setIsCharging(false); }} className="px-6 py-2 bg-slate-800 rounded-lg text-white text-sm">
                                    {t('staffPortal.cancelScan')}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Processing Overlay */}
                    {isProcessingPayment && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center"
                        >
                            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
                            <p className="text-white font-medium animate-pulse">{t('staffPortal.processingPayment')}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-white">
                        <ShoppingCart className="w-5 h-5" />
                        <h3 className="font-bold">{t('staffPortal.currentOrder')}</h3>
                    </div>
                    {cart.length > 0 && (
                        <button onClick={() => setCart([])} className="text-sm text-red-400 hover:text-red-300">
                            {t('staffPortal.clearCart')}
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                            <Receipt className="w-12 h-12 opacity-20" />
                            <p>{t('staffPortal.emptyCart')}</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-white font-medium truncate">{item.item_name}</p>
                                    <p className="text-emerald-400 text-sm">${(item.price_cents / 100).toFixed(2)}</p>
                                </div>
                                <div className="flex items-center space-x-3 bg-slate-900 rounded-lg border border-slate-700 p-1">
                                    <button onClick={() => removeFromCart(item.id)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="text-white font-bold min-w-[1rem] text-center">{item.quantity}</span>
                                    <button onClick={() => addToCart(item)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-slate-800/80 border-t border-slate-700 space-y-2">
                    <div className="flex justify-between text-slate-400 text-sm">
                        <span>{t('staffPortal.subtotal')}</span>
                        <span>${(subtotal / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-sm">
                        <span>{t('staffPortal.tax')}</span>
                        <span>${(tax / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white text-lg font-bold pt-2 border-t border-slate-700">
                        <span>{t('staffPortal.total')}</span>
                        <span className="text-emerald-400">${(total / 100).toFixed(2)}</span>
                    </div>
                </div>

                <div className="p-4 bg-slate-900 border-t border-slate-700">
                    <button
                        onClick={handleCharge}
                        disabled={cart.length === 0 || isCharging}
                        className={cn(
                            "w-full py-4 rounded-xl flex items-center justify-center space-x-2 font-bold transition-all text-lg",
                            cart.length === 0
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20"
                        )}
                    >
                        <ScanLine className="w-5 h-5" />
                        <span>{t('staffPortal.charge', { amount: (total / 100).toFixed(2) })}</span>
                    </button>
                </div>
            </div>

        </div>
    );
};

export default StaffPOS;
