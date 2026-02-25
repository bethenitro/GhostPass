import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, Ticket, Calendar, MapPin, AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from './ui/toast';

interface Event {
    id: string;
    name: string;
    description: string;
    venue_name: string;
    venue_id: string;
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

interface WebAppInitProps {
    eventId: string;
    assetId: string;
    onHasTicket: (context: { venueId: string; eventId: string; venueName: string; eventName: string; entryFee: number }) => void;
}

const WebAppInitializationPage: React.FC<WebAppInitProps> = ({ eventId, assetId, onHasTicket }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<Event | null>(null);
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
    const [selectedTicketType, setSelectedTicketType] = useState<TicketType | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        checkExistingTicketAndLoadData();
    }, [eventId]);

    const checkExistingTicketAndLoadData = async () => {
        try {
            setLoading(true);
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
            const deviceFingerprint = localStorage.getItem('device_fingerprint') || '';

            // Check if session_id is in URL indicating a return from Stripe
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('session_id');

            let hasExistingTicket = false;
            let existingTicketContext = null;

            if (deviceFingerprint) {
                // Find existing tickets
                try {
                    const ticketsResponse = await fetch(`${API_BASE_URL}/tickets/list`, {
                        headers: { 'X-Device-Fingerprint': deviceFingerprint },
                    });

                    if (ticketsResponse.ok) {
                        const data = await ticketsResponse.json();
                        const tickets = data.tickets || [];
                        const eventTicket = tickets.find((t: any) => t.event.id === eventId && t.status === 'active');

                        if (eventTicket) {
                            hasExistingTicket = true;
                            existingTicketContext = {
                                venueId: eventTicket.event.venue_id || '',
                                eventId: eventTicket.event.id,
                                venueName: eventTicket.event.venue_name,
                                eventName: eventTicket.event.name,
                                entryFee: 0,
                            };
                        }
                    }
                } catch (e) {
                    console.error('Error fetching tickets:', e);
                }
            }

            if (hasExistingTicket && existingTicketContext) {
                // If returning from stripe, maybe show a brief success toast
                if (sessionId) {
                    showToast(t('tickets.purchaseSuccess', 'Ticket purchased successfully!'), 'success');
                    // Clear query params
                    window.history.replaceState({}, '', window.location.pathname);
                }
                onHasTicket(existingTicketContext);
                return;
            }

            // If no ticket, load event details
            const [eventsRes, typesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/tickets/events`, {
                    headers: { 'X-Device-Fingerprint': deviceFingerprint },
                }),
                fetch(`${API_BASE_URL}/tickets/types?event_id=${eventId}`)
            ]);

            if (eventsRes.ok && typesRes.ok) {
                const eventsData = await eventsRes.json();
                const typesData = await typesRes.json();

                const currentEvent = eventsData.events?.find((e: Event) => e.id === eventId);
                if (currentEvent) {
                    setEvent(currentEvent);
                } else {
                    setError(t('events.notFound', 'Event not found.'));
                }

                const availableTypes = typesData.ticket_types || [];
                setTicketTypes(availableTypes);

                // Auto-select the first available ticket type
                const firstAvailable = availableTypes.find((tt: TicketType) => tt.max_quantity - tt.sold_count > 0);
                if (firstAvailable) setSelectedTicketType(firstAvailable);
            } else {
                setError(t('events.fetchError', 'Failed to load event details.'));
            }
        } catch (err) {
            console.error(err);
            setError(t('events.fetchError', 'Failed to load event details.'));
        } finally {
            if (!error) setLoading(false);
        }
    };

    const handleCheckout = async () => {
        if (!event || !selectedTicketType) return;

        setPurchasing(true);
        setError('');

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
            const deviceFingerprint = localStorage.getItem('device_fingerprint') || '';
            const walletBindingId = localStorage.getItem('wallet_binding_id') || '';

            const returnUrl = `${window.location.origin}${window.location.pathname}`;

            const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'ticket_purchase',
                    event_id: event.id,
                    ticket_type_id: selectedTicketType.id,
                    quantity,
                    wallet_binding_id: walletBindingId,
                    device_fingerprint: deviceFingerprint,
                    asset_id: assetId,
                    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${returnUrl}?canceled=true`,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Checkout failed');
            }

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned');
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Checkout failed');
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <h2 className="text-xl font-bold">{error || 'Event not available'}</h2>
                    <button
                        onClick={() => window.location.hash = '#/wallet'}
                        className="px-6 py-2 bg-slate-800 rounded-lg font-medium"
                    >
                        Go to Wallet
                    </button>
                </div>
            </div>
        );
    }

    const subtotalCents = (selectedTicketType?.price_cents || 0) * quantity;
    const platformFeeCents = Math.round(subtotalCents * ((event.service_fee_percent || 5) / 100));
    const totalCents = subtotalCents + platformFeeCents;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 pb-24 md:p-8 flex items-center justify-center">
            <div className="max-w-md w-full mx-auto space-y-6">

                {/* Header Section */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-4 border border-cyan-500/20">
                        <Ticket className="w-8 h-8 text-cyan-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{event.name}</h1>

                    <div className="flex flex-col items-center space-y-1 text-slate-400 text-sm mt-4">
                        <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-cyan-500" />
                            <span>{new Date(event.start_date).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-cyan-500" />
                            <span>{event.venue_name}</span>
                        </div>
                    </div>
                </motion.div>

                {/* Ticket Selection */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4 mt-8">
                    <h2 className="text-lg font-semibold text-white">Select Tickets</h2>

                    <div className="space-y-3">
                        {ticketTypes.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-4">No ticket options available.</p>
                        ) : (
                            ticketTypes.map((tt) => {
                                const available = tt.max_quantity - tt.sold_count;
                                const soldOut = available <= 0;
                                const isSelected = selectedTicketType?.id === tt.id;

                                return (
                                    <button
                                        key={tt.id}
                                        disabled={soldOut}
                                        onClick={() => setSelectedTicketType(tt)}
                                        className={cn(
                                            "w-full p-4 rounded-xl border text-left transition-all flex items-start justify-between",
                                            soldOut ? "bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed" :
                                                isSelected ? "bg-cyan-500/10 border-cyan-500 shadow-md shadow-cyan-500/10" : "bg-slate-800/50 border-slate-700 hover:border-slate-500"
                                        )}
                                    >
                                        <div>
                                            <h3 className="font-semibold text-white">{tt.name}</h3>
                                            <p className="text-xs text-slate-400 mt-1">{tt.description}</p>
                                            {available > 0 && available < 20 && (
                                                <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-medium">Only {available} left</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-lg text-white">${(tt.price_cents / 100).toFixed(2)}</span>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </motion.div>

                {/* Cost Breakdown */}
                {selectedTicketType && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">

                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <span className="text-slate-300 font-medium">Quantity</span>
                            <div className="flex items-center space-x-4 bg-slate-950 rounded-lg p-1 border border-slate-800">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                                    disabled={quantity <= 1}
                                >-</button>
                                <span className="w-4 text-center font-semibold">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(Math.min(10, quantity + 1))}
                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                                >+</button>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-400">
                                <span>Subtotal ({quantity}x)</span>
                                <span>${(subtotalCents / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Platform Fee ({event.service_fee_percent || 5}%)</span>
                                <span>${(platformFeeCents / 100).toFixed(2)}</span>
                            </div>
                            {/* Venue Fee placeholder since we calculate it on the backend, assuming 0 here or platform fee includes it */}
                            <div className="flex justify-between font-semibold text-white pt-2 border-t border-slate-800 mt-2">
                                <span>Total</span>
                                <span className="text-cyan-400 text-lg">${(totalCents / 100).toFixed(2)}</span>
                            </div>
                        </div>

                    </motion.div>
                )}

                {/* Disclaimer & Action */}
                {selectedTicketType && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-4 text-center mt-8">
                        <div className="flex flex-col items-center space-y-2">
                            <ShieldCheck className="w-6 h-6 text-green-400" />
                            <p className="text-xs text-slate-400 px-4 leading-relaxed">
                                By purchasing, you are activating your GhostPass wallet for this event.
                                This will act as your secure digital access pass and payment method. No separate app download required.
                            </p>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={purchasing}
                            className="w-full relative overflow-hidden group py-4 rounded-xl font-semibold text-lg flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition-all"
                        >
                            {purchasing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Preparing...</span>
                                </>
                            ) : (
                                <span>Checkout & Activate</span>
                            )}
                        </button>
                    </motion.div>
                )}

            </div>
        </div>
    );
};

export default WebAppInitializationPage;
