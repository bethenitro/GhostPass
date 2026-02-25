import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Percent, Check, X, Loader2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ui/toast';

interface MenuItem {
  id: string;
  item_name: string;
  price_cents: number;
  item_category: string;
  station_type: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface MenuBasedVendorPurchaseProps {
  venueId?: string;
  eventId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TIP_PRESETS = [
  { label: '10%', value: 10 },
  { label: '15%', value: 15 },
  { label: '20%', value: 20 },
  { label: '25%', value: 25 },
];

export const MenuBasedVendorPurchase: React.FC<MenuBasedVendorPurchaseProps> = ({
  venueId,
  eventId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTipPercent, setSelectedTipPercent] = useState<number>(15);
  const [customTipPercent, setCustomTipPercent] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Debug logging
  useEffect(() => {
    console.log('MenuBasedVendorPurchase mounted with:', { venueId, eventId });
  }, []);

  useEffect(() => {
    if (!venueId && !eventId) {
      console.warn('No venueId or eventId provided to MenuBasedVendorPurchase');
      showToast(t('menu.errors.noVenueOrEvent'), 'error');
      setLoadingMenu(false);
      return;
    }
    loadMenuItems();
    checkWalletBalance();
  }, [venueId, eventId]);

  const checkWalletBalance = async () => {
    try {
      const deviceFingerprint = localStorage.getItem('device_fingerprint');
      if (!deviceFingerprint) return;

      const response = await fetch('/api/wallet/balance', {
        headers: {
          'X-Device-Fingerprint': deviceFingerprint,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWalletBalance(data.balance_cents || 0);
      }
    } catch (error) {
      console.error('Failed to check balance:', error);
    }
  };

  const loadMenuItems = async () => {
    setLoadingMenu(true);
    try {
      // Use public endpoint - no auth required for viewing menu
      let url = '/api/menu/public?';
      if (venueId) url += `venue_id=${venueId}&`;
      if (eventId) url += `event_id=${eventId}&`;

      console.log('Loading menu items from:', url);

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        console.log('Menu items loaded:', data);
        setMenuItems(data || []);
      } else {
        const errorData = await response.json();
        console.error('Failed to load menu:', errorData);
        showToast(errorData.error || t('menu.errors.loadFailed'), 'error');
      }
    } catch (error) {
      console.error('Failed to load menu:', error);
      showToast(t('menu.errors.loadFailed'), 'error');
    } finally {
      setLoadingMenu(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) {
      setCart(cart.map(i => 
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    const existingItem = cart.find(i => i.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(i => 
        i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
      ));
    } else {
      setCart(cart.filter(i => i.id !== itemId));
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
  const tipPercent = isCustom ? parseFloat(customTipPercent) || 0 : selectedTipPercent;
  const tipAmount = Math.round((subtotal * tipPercent) / 100);
  const finalTotal = subtotal + tipAmount;
  const hasInsufficientBalance = walletBalance < finalTotal;
  const shortfall = finalTotal - walletBalance;

  const handleTipSelect = (percent: number) => {
    setSelectedTipPercent(percent);
    setIsCustom(false);
    setCustomTipPercent('');
  };

  const handleCustomTip = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomTipPercent(value);
      setIsCustom(true);
    }
  };

  const handleAddFunds = async () => {
    try {
      const walletBindingId = localStorage.getItem('wallet_binding_id');
      const deviceFingerprint = localStorage.getItem('device_fingerprint');

      if (!walletBindingId || !deviceFingerprint) {
        showToast(t('menu.errors.walletNotFound'), 'error');
        return;
      }

      // Create Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': deviceFingerprint,
        },
        body: JSON.stringify({
          amount: Math.max(shortfall, 500), // Minimum $5.00
          wallet_binding_id: walletBindingId,
          device_fingerprint: deviceFingerprint,
          success_url: `${window.location.origin}/#/wallet?payment=success`,
          cancel_url: `${window.location.origin}/#/wallet?payment=cancelled`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(errorData.error || t('menu.errors.loadFailed'), 'error');
        return;
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        showToast(t('menu.errors.loadFailed'), 'error');
      }
    } catch (error) {
      console.error('Add funds error:', error);
      showToast(t('menu.errors.purchaseFailed'), 'error');
    }
  };

  const handlePurchase = async (method: 'QR' | 'NFC') => {
    if (cart.length === 0) {
      showToast(t('menu.errors.addItemsToCart'), 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const walletBindingId = localStorage.getItem('wallet_binding_id');
      const deviceFingerprint = localStorage.getItem('device_fingerprint');

      if (!walletBindingId || !deviceFingerprint) {
        showToast(t('menu.errors.walletNotFound'), 'error');
        setIsProcessing(false);
        return;
      }

      // Process purchase - combine all items into a single transaction
      const response = await fetch('/api/vendor/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': deviceFingerprint,
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          item_id: 'multi_item_purchase',
          gateway_id: 'pos_terminal_01',
          quantity: 1,
          item_amount_cents: subtotal,
          tip_amount_cents: tipAmount,
          tip_percent: tipPercent,
          interaction_method: method,
          cart_items: cart.map(item => ({
            item_id: item.id,
            item_name: item.item_name,
            quantity: item.quantity,
            price_cents: item.price_cents,
            category: item.item_category,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.error || t('menu.errors.purchaseFailed'), 'error');
        setIsProcessing(false);
        return;
      }

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Purchase error:', error);
      showToast(t('menu.errors.purchaseFailed'), 'error');
      setIsProcessing(false);
    }
  };

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <div className="bg-slate-900 border border-emerald-500 rounded-2xl p-8 max-w-md w-full text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center"
          >
            <Check className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-2">{t('menu.paymentSuccessful')}</h3>
          <p className="text-slate-400 mb-4">{t('menu.receiptRecorded')}</p>
          <div className="text-3xl font-bold text-emerald-400">
            ${(finalTotal / 100).toFixed(2)}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">{t('menu.title')}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Menu Items */}
          {loadingMenu ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-2" />
              <p className="text-slate-400">{t('menu.loading')}</p>
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">{t('menu.noItems')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-cyan-500 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{item.item_name}</h3>
                      <p className="text-slate-400 text-xs">{item.item_category}</p>
                    </div>
                    <span className="text-cyan-400 font-semibold">
                      ${(item.price_cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500 text-cyan-400 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('menu.addToCart')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Cart */}
          {cart.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                {t('menu.cartCount', { count: cart.length })}
              </h3>
              <div className="space-y-2 mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="p-1 hover:bg-slate-700 rounded"
                        >
                          <Minus className="w-3 h-3 text-slate-400" />
                        </button>
                        <span className="text-white font-mono w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="p-1 hover:bg-slate-700 rounded"
                        >
                          <Plus className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                      <span className="text-slate-300">{item.item_name}</span>
                    </div>
                    <span className="text-white font-semibold">
                      ${((item.price_cents * item.quantity) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tip Selection */}
              <div className="border-t border-slate-700 pt-4">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  {t('menu.addTip')}
                </label>
                
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {TIP_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleTipSelect(preset.value)}
                      className={`py-2 px-2 rounded-lg border-2 transition-all ${
                        !isCustom && selectedTipPercent === preset.value
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customTipPercent}
                    onChange={(e) => handleCustomTip(e.target.value)}
                    onFocus={() => setIsCustom(true)}
                    placeholder={t('menu.customTip')}
                    className={`w-full px-4 py-2 bg-slate-800/50 border-2 rounded-lg text-white placeholder-slate-500 focus:outline-none transition-all ${
                      isCustom
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700'
                    }`}
                  />
                  <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Total Breakdown */}
              <div className="border-t border-slate-700 pt-4 mt-4 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>{t('menu.subtotal')}</span>
                  <span>${(subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{t('menu.tip', { percent: tipPercent.toFixed(1) })}</span>
                  <span>${(tipAmount / 100).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-700 pt-2">
                  <div className="flex justify-between text-white font-bold text-lg">
                    <span>{t('menu.total')}</span>
                    <span className="text-cyan-400">${(finalTotal / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Buttons */}
          {cart.length > 0 && (
            <div className="space-y-3">
              {/* Wallet Balance Display */}
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">{t('menu.walletBalance')}</span>
                  <span className={`font-mono font-semibold ${hasInsufficientBalance ? 'text-red-400' : 'text-cyan-400'}`}>
                    ${(walletBalance / 100).toFixed(2)}
                  </span>
                </div>
                {hasInsufficientBalance && (
                  <div className="mt-2 text-xs text-red-400">
                    {t('menu.insufficientBalance', { amount: (shortfall / 100).toFixed(2) })}
                  </div>
                )}
              </div>

              {/* Add Funds Button (if insufficient balance) */}
              {hasInsufficientBalance && (
                <button
                  onClick={handleAddFunds}
                  className="w-full py-4 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all flex items-center justify-center space-x-2 font-semibold"
                >
                  <DollarSign className="w-5 h-5" />
                  <span>{t('menu.addFunds', { amount: ((Math.max(shortfall, 500)) / 100).toFixed(2) })}</span>
                </button>
              )}

              {/* Payment Buttons (only if sufficient balance) */}
              {!hasInsufficientBalance && (
                <>
                  <button
                    onClick={() => handlePurchase('QR')}
                    disabled={isProcessing}
                    className="w-full py-4 bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('menu.processing')}</span>
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        <span>{t('menu.payFromWallet')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handlePurchase('NFC')}
                    disabled={isProcessing}
                    className="w-full py-4 bg-purple-500/20 border-2 border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('menu.processing')}</span>
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        <span>{t('menu.nfcTapToPay')}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
