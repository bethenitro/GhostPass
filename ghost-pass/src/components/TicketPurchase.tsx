/**
 * Ticket Purchase Component
 * 
 * Allows users to browse events and purchase single-event tickets.
 * Simpler than Ghost Pass - just one-time ticket purchase with entry permission.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Calendar, MapPin, DollarSign, CheckCircle, AlertCircle, Loader2, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  name: string;
  description: string;
  venue_name: string;
  start_date: string;
  end_date: string;
  status: string;
  service_fee_percent: number;
}

interface TicketType {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  max_quantity: number;
  sold_count: number;
  allows_reentry: boolean;
}

interface PurchasedTicket {
  id: string;
  ticket_code: string;
  event_name: string;
  ticket_type_name: string;
  total_paid_cents: number;
  purchased_at: string;
}

const TicketPurchase: React.FC = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [selectedTicketType, setSelectedTicketType] = useState<TicketType | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedTicket, setPurchasedTicket] = useState<PurchasedTicket | null>(null);
  const [error, setError] = useState<string>('');
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchEvents();
    fetchBalance();
  }, []);

  const fetchEvents = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/tickets/events`, {
        headers: {
          'X-Device-Fingerprint': localStorage.getItem('device_fingerprint') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error(t('tickets.failedToFetchEvents'), error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
        headers: {
          'X-Device-Fingerprint': localStorage.getItem('device_fingerprint') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance_cents || 0);
      }
    } catch (error) {
      console.error(t('tickets.failedToFetchBalance'), error);
    }
  };

  const fetchTicketTypes = async (eventId: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/tickets/types?event_id=${eventId}`);

      if (response.ok) {
        const data = await response.json();
        setTicketTypes(data.ticket_types || []);
      }
    } catch (error) {
      console.error(t('tickets.failedToFetchTicketTypes'), error);
    }
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setSelectedTicketType(null);
    setPurchasedTicket(null);
    setError('');
    fetchTicketTypes(event.id);
  };

  const handlePurchase = async () => {
    if (!selectedEvent || !selectedTicketType) return;

    setPurchasing(true);
    setError('');

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const walletBindingId = localStorage.getItem('wallet_binding_id');
      const deviceFingerprint = localStorage.getItem('device_fingerprint');

      const response = await fetch(`${API_BASE_URL}/tickets/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': deviceFingerprint || '',
        },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          ticket_type_id: selectedTicketType.id,
          wallet_binding_id: walletBindingId,
          device_fingerprint: deviceFingerprint,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('tickets.purchaseFailed'));
      }

      const data = await response.json();
      
      setPurchasedTicket({
        id: data.ticket.id,
        ticket_code: data.ticket.ticket_code,
        event_name: selectedEvent.name,
        ticket_type_name: selectedTicketType.name,
        total_paid_cents: data.receipt.pricing.total_paid_cents,
        purchased_at: data.ticket.purchased_at,
      });

      // Refresh balance
      await fetchBalance();

    } catch (error) {
      console.error(t('tickets.purchaseFailed'), error);
      setError(error instanceof Error ? error.message : t('tickets.purchaseFailed'));
    } finally {
      setPurchasing(false);
    }
  };

  const calculateTotal = (ticketType: TicketType, serviceFeePercent: number) => {
    const serviceFeeCents = Math.round(ticketType.price_cents * (serviceFeePercent / 100));
    return ticketType.price_cents + serviceFeeCents;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (purchasedTicket) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('tickets.ticketPurchased')}</h2>
          <p className="text-slate-400">{t('tickets.ticketReady')}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('tickets.event')}</span>
            <span className="text-white font-medium">{purchasedTicket.event_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('tickets.ticketType')}</span>
            <span className="text-white font-medium">{purchasedTicket.ticket_type_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('tickets.totalPaid')}</span>
            <span className="text-green-400 font-bold text-lg">
              ${(purchasedTicket.total_paid_cents / 100).toFixed(2)}
            </span>
          </div>
          
          <div className="pt-4 border-t border-slate-700">
            <div className="bg-white p-4 rounded-lg">
              <div className="text-center">
                <QrCode className="w-16 h-16 mx-auto mb-2 text-slate-900" />
                <p className="text-xs text-slate-600 font-mono">{purchasedTicket.ticket_code}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              {t('tickets.showQRCode')}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setPurchasedTicket(null);
            setSelectedEvent(null);
            setSelectedTicketType(null);
          }}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          {t('tickets.purchaseAnotherTicket')}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">{t('tickets.title')}</h1>
        <p className="text-slate-400">{t('tickets.purchaseTickets')}</p>
        <div className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg">
          <DollarSign className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-medium">${(balance / 100).toFixed(2)}</span>
          <span className="text-slate-400 text-sm">{t('tickets.available')}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Event Selection */}
      {!selectedEvent && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">{t('tickets.availableEvents')}</h2>
          {events.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              {t('tickets.noEventsAvailable')}
            </div>
          ) : (
            events.map((event) => (
              <motion.button
                key={event.id}
                onClick={() => handleEventSelect(event)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full p-4 bg-slate-800/50 border border-slate-700 hover:border-cyan-400 rounded-xl text-left transition-all"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">{event.name}</h3>
                    <p className="text-slate-400 text-sm mb-2">{event.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>{event.venue_name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(event.start_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      )}

      {/* Ticket Type Selection */}
      {selectedEvent && !selectedTicketType && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedEvent(null)}
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            {t('tickets.backToEvents')}
          </button>
          
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">{selectedEvent.name}</h2>
            <p className="text-slate-400 text-sm">{t('tickets.selectTicketType')}</p>
          </div>

          {ticketTypes.map((ticketType) => {
            const total = calculateTotal(ticketType, selectedEvent.service_fee_percent);
            const available = ticketType.max_quantity - ticketType.sold_count;
            const soldOut = available <= 0;

            return (
              <motion.button
                key={ticketType.id}
                onClick={() => !soldOut && setSelectedTicketType(ticketType)}
                disabled={soldOut}
                whileHover={!soldOut ? { scale: 1.02 } : {}}
                whileTap={!soldOut ? { scale: 0.98 } : {}}
                className={cn(
                  "w-full p-4 border rounded-xl text-left transition-all",
                  soldOut
                    ? "bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed"
                    : "bg-slate-800/50 border-slate-700 hover:border-cyan-400"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-1">{ticketType.name}</h3>
                    <p className="text-slate-400 text-sm mb-2">{ticketType.description}</p>
                    <div className="flex items-center space-x-2 text-xs">
                      {ticketType.allows_reentry && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                          {t('tickets.reEntryAllowed')}
                        </span>
                      )}
                      <span className="text-slate-500">
                        {available} / {ticketType.max_quantity} {t('tickets.available')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">
                      ${(total / 100).toFixed(2)}
                    </div>
                    <div className="text-slate-500 text-xs">
                      +${((total - ticketType.price_cents) / 100).toFixed(2)} {t('tickets.fee')}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Purchase Confirmation */}
      {selectedEvent && selectedTicketType && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedTicketType(null)}
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            {t('tickets.backToTicketTypes')}
          </button>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">{t('tickets.confirmPurchase')}</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('tickets.event')}</span>
                <span className="text-white">{selectedEvent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('tickets.ticketType')}</span>
                <span className="text-white">{selectedTicketType.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('tickets.ticketPrice')}</span>
                <span className="text-white">${(selectedTicketType.price_cents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('tickets.serviceFee')} ({selectedEvent.service_fee_percent}%)</span>
                <span className="text-white">
                  ${(Math.round(selectedTicketType.price_cents * (selectedEvent.service_fee_percent / 100)) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700">
                <span className="text-white font-semibold">{t('tickets.total')}</span>
                <span className="text-cyan-400 font-bold text-lg">
                  ${(calculateTotal(selectedTicketType, selectedEvent.service_fee_percent) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={purchasing || balance < calculateTotal(selectedTicketType, selectedEvent.service_fee_percent)}
              className={cn(
                "w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2",
                purchasing || balance < calculateTotal(selectedTicketType, selectedEvent.service_fee_percent)
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-cyan-600 hover:bg-cyan-700 text-white"
              )}
            >
              {purchasing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('tickets.processing')}</span>
                </>
              ) : balance < calculateTotal(selectedTicketType, selectedEvent.service_fee_percent) ? (
                <span>{t('tickets.insufficientBalance')}</span>
              ) : (
                <span>{t('tickets.purchaseTicket')}</span>
              )}
            </button>

            {balance < calculateTotal(selectedTicketType, selectedEvent.service_fee_percent) && (
              <p className="text-red-400 text-sm text-center">
                {t('tickets.youNeed', { amount: ((calculateTotal(selectedTicketType, selectedEvent.service_fee_percent) - balance) / 100).toFixed(2) })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketPurchase;
