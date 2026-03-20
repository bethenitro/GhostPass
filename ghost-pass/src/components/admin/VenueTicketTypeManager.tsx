import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, Plus, Loader2, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../ui/toast';
import { cn } from '@/lib/utils';
import { eventApi, revenueProfileApi, taxProfileApi } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

interface VenueTicketTypeManagerProps {
    venueId: string;
}

interface TicketType {
    id: string;
    event_id: string;
    name: string;
    description: string;
    price_cents: number;
    max_quantity: number;
    sold_count: number;
    allows_reentry: boolean;
    revenue_profile_id?: string;
    tax_profile_id?: string;
    id_verification_tier: number;
    sale_start_date?: string;
    sale_end_date?: string;
}

export const VenueTicketTypeManager: React.FC<VenueTicketTypeManagerProps> = ({ venueId }) => {
    const { t } = useTranslation();
    const { showToast } = useToast();

    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [revenueProfiles, setRevenueProfiles] = useState<any[]>([]);
    const [taxProfiles, setTaxProfiles] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingType, setEditingType] = useState<TicketType | null>(null);

    const [formData, setFormData] = useState({
        id: '',
        event_id: '',
        name: '',
        description: '',
        price_cents: 0,
        max_quantity: 0,
        allows_reentry: false,
        id_verification_tier: 1,
        revenue_profile_id: '',
        tax_profile_id: '',
        sale_start_date: '',
        sale_end_date: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, [venueId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [eventsRes, revRes, taxRes] = await Promise.all([
                eventApi.list({ venue_id: venueId }),
                revenueProfileApi.list(),
                taxProfileApi.list()
            ]);

            setEvents(eventsRes.data || []);
            setRevenueProfiles(revRes.data || []);
            setTaxProfiles(taxRes.data || []);

            // Pre-select first revenue profile if none selected
            if ((revRes.data || []).length > 0 && !formData.revenue_profile_id) {
                setFormData(prev => ({ ...prev, revenue_profile_id: revRes.data[0].id }));
            }

            const eventIds = (eventsRes.data || []).map((e: any) => e.event_id || e.id);

            if (eventIds.length > 0) {
                const { data, error } = await supabase
                    .from('ticket_types')
                    .select('*')
                    .in('event_id', eventIds)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTicketTypes(data || []);
            } else {
                setTicketTypes([]);
            }
        } catch (error: any) {
            console.error('Failed to load ticket types data:', error);
            showToast(t('ticketTypes.failedToLoad'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = t('ticketTypes.nameRequired');
        if (!formData.event_id) newErrors.event_id = t('ticketTypes.eventRequired');
        if (formData.price_cents < 0) newErrors.price_cents = t('ticketTypes.priceNegative');
        if (formData.max_quantity < 0) newErrors.max_quantity = t('ticketTypes.quantityNegative');

        if (formData.sale_start_date && formData.sale_end_date && new Date(formData.sale_start_date) >= new Date(formData.sale_end_date)) {
            newErrors.sale_end_date = t('ticketTypes.endDateAfterStart');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) {
            showToast(t('ticketTypes.fixErrors'), 'error');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                event_id: formData.event_id,
                description: formData.description,
                price_cents: formData.price_cents,
                max_quantity: formData.max_quantity,
                allows_reentry: formData.allows_reentry,
                id_verification_tier: Number(formData.id_verification_tier),
                revenue_profile_id: formData.revenue_profile_id || null,
                tax_profile_id: formData.tax_profile_id || null,
                sale_start_date: formData.sale_start_date ? new Date(formData.sale_start_date).toISOString() : null,
                sale_end_date: formData.sale_end_date ? new Date(formData.sale_end_date).toISOString() : null
            };

            if (editingType) {
                const { error } = await supabase
                    .from('ticket_types')
                    .update(payload)
                    .eq('id', editingType.id);
                if (error) throw error;
                showToast(t('ticketTypes.updated'), 'success');
            } else {
                const { error } = await supabase
                    .from('ticket_types')
                    .insert([{
                        id: formData.id || crypto.randomUUID(),
                        ...payload
                    }]);
                if (error) throw error;
                showToast(t('ticketTypes.created'), 'success');
            }

            setShowForm(false);
            resetForm();
            loadData();
        } catch (error: any) {
            console.error('Failed to save ticket type:', error);
            showToast(error.message || t('ticketTypes.failedToSave'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('ticketTypes.deleteConfirm'))) return;
        try {
            const { error } = await supabase
                .from('ticket_types')
                .delete()
                .eq('id', id);
            if (error) throw error;
            showToast(t('ticketTypes.deleted'), 'success');
            loadData();
        } catch (error: any) {
            console.error('Failed to delete:', error);
            showToast(t('ticketTypes.failedToDelete'), 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            id: '',
            event_id: formData.event_id,
            name: '',
            description: '',
            price_cents: 0,
            max_quantity: 0,
            allows_reentry: false,
            id_verification_tier: 1,
            revenue_profile_id: '',
            tax_profile_id: '',
            sale_start_date: '',
            sale_end_date: ''
        });
        setErrors({});
        setEditingType(null);
    };

    const formatDateForInput = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Ticket className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-xl font-bold text-white">{t('ticketTypes.title')}</h2>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setShowForm(!showForm);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded-lg text-indigo-400 transition-all min-h-[44px]"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">{showForm ? t('common.cancel') : t('ticketTypes.createTicketType')}</span>
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 md:p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        {editingType ? t('ticketTypes.editTicketType') : t('ticketTypes.createNewTicketType')}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    {t('ticketTypes.parentEvent')} <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={formData.event_id}
                                    onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                                    className={cn(
                                        "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                                        errors.event_id ? 'border-red-500/50' : 'border-slate-600 focus:border-indigo-500/50'
                                    )}
                                >
                                    <option value="">{t('ticketTypes.selectEvent')}</option>
                                    {events.map((evt) => (
                                        <option key={evt.event_id || evt.id} value={evt.event_id || evt.id}>
                                            {evt.event_name || evt.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.event_id && <p className="text-red-400 text-xs mt-1">{errors.event_id}</p>}
                            </div>

                            {!editingType && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        {t('ticketTypes.ticketId')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.id}
                                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                        placeholder={t('ticketTypes.ticketIdPlaceholder')}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    {t('ticketTypes.ticketName')} <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={cn(
                                        "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                                        errors.name ? 'border-red-500/50' : 'border-slate-600 focus:border-indigo-500/50'
                                    )}
                                    placeholder={t('ticketTypes.ticketNamePlaceholder')}
                                />
                                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.price')}</label>
                                <input
                                    type="number"
                                    value={formData.price_cents / 100 || ''}
                                    onChange={(e) => setFormData({ ...formData, price_cents: e.target.value === '' ? 0 : Math.round(parseFloat(e.target.value) * 100) })}
                                    className={cn(
                                        "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                                        errors.price_cents ? 'border-red-500/50' : 'border-slate-600 focus:border-indigo-500/50'
                                    )}
                                    step="0.01"
                                    min="0"
                                />
                                {errors.price_cents && <p className="text-red-400 text-xs mt-1">{errors.price_cents}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.description')}</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none"
                                rows={2}
                                placeholder={t('ticketTypes.descriptionPlaceholder')}
                            />
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.quantityLimit')}</label>
                                <input
                                    type="number"
                                    value={formData.max_quantity || ''}
                                    onChange={(e) => setFormData({ ...formData, max_quantity: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    min="0"
                                    placeholder={t('ticketTypes.quantityPlaceholder')}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.idValidationTier')}</label>
                                <select
                                    value={formData.id_verification_tier}
                                    onChange={(e) => setFormData({ ...formData, id_verification_tier: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                >
                                    <option value={1}>{t('ticketTypes.tier1')}</option>
                                    <option value={2}>{t('ticketTypes.tier2')}</option>
                                    <option value={3}>{t('ticketTypes.tier3')}</option>
                                </select>
                            </div>

                            <div className="flex items-end pb-2">
                                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.allows_reentry}
                                        onChange={(e) => setFormData({ ...formData, allows_reentry: e.target.checked })}
                                        className="rounded border-slate-600 bg-slate-900/50 text-indigo-500 focus:ring-indigo-500/50"
                                    />
                                    <span className="text-sm">{t('ticketTypes.allowsReentry')}</span>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.revenueProfile')}</label>
                                <select
                                    value={formData.revenue_profile_id}
                                    onChange={(e) => setFormData({ ...formData, revenue_profile_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none text-sm"
                                >
                                    <option value="">{t('ticketTypes.defaultNoSplit')}</option>
                                    {revenueProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>{p.profile_name}</option>
                                    ))}
                                </select>
                                {formData.revenue_profile_id && (() => {
                                    const p = revenueProfiles.find(r => r.id === formData.revenue_profile_id);
                                    if (!p) return null;
                                    return (
                                        <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-1 text-xs">
                                            {[
                                                { label: 'VALID', value: p.valid_percentage },
                                                { label: 'Vendor', value: p.vendor_percentage },
                                                { label: 'Pool', value: p.pool_percentage },
                                                { label: 'Promoter', value: p.promoter_percentage },
                                                { label: 'Exec', value: p.executive_percentage },
                                            ].map(item => (
                                                <div key={item.label} className="bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-center">
                                                    <div className="text-slate-400">{item.label}</div>
                                                    <div className="text-indigo-400 font-semibold">{item.value}%</div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.taxProfile')}</label>
                                <select
                                    value={formData.tax_profile_id}
                                    onChange={(e) => setFormData({ ...formData, tax_profile_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-indigo-500/50 focus:outline-none text-sm"
                                >
                                    <option value="">{t('ticketTypes.defaultNoTax')}</option>
                                    {taxProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>{p.profile_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.saleStartDate')}</label>
                                <input
                                    type="datetime-local"
                                    value={formData.sale_start_date}
                                    onChange={(e) => setFormData({ ...formData, sale_start_date: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">{t('ticketTypes.saleEndDate')}</label>
                                <input
                                    type="datetime-local"
                                    value={formData.sale_end_date}
                                    onChange={(e) => setFormData({ ...formData, sale_end_date: e.target.value })}
                                    className={cn(
                                        "w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white focus:outline-none transition-colors",
                                        errors.sale_end_date ? 'border-red-500/50 focus:border-red-500' : 'border-slate-600 focus:border-indigo-500/50'
                                    )}
                                />
                                {errors.sale_end_date && <p className="text-red-400 text-xs mt-1">{errors.sale_end_date}</p>}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 py-3 px-4 rounded-lg hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center justify-center gap-2 min-h-[44px]"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('ticketTypes.processing')}
                                </>
                            ) : editingType ? t('ticketTypes.updateTicketType') : t('ticketTypes.createTicketType')}
                        </button>
                    </form>
                </div>
            )}

            {ticketTypes.length === 0 && !showForm ? (
                <div className="text-center py-12">
                    <Ticket className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">{t('ticketTypes.noTicketTypes')}</p>
                    <p className="text-slate-500 text-sm mt-2">{t('ticketTypes.createFirst')}</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {ticketTypes.map((ticket) => (
                        <div key={ticket.id} className="bg-slate-700/30 border border-slate-600 rounded-lg p-4 hover:border-indigo-500/30 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="text-white font-medium text-lg">{ticket.name}</h3>
                                    <div className="text-slate-400 text-sm mt-1 mb-2 line-clamp-2">
                                        {ticket.description || t('ticketTypes.noDescription')}
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-1 text-xs mb-3">
                                        <span className="text-slate-300">Price: <span className="text-green-400 font-medium">${(ticket.price_cents / 100).toFixed(2)}</span></span>
                                        <span className="text-slate-300">{t('ticketTypes.authTier')} <span className="text-white">{ticket.id_verification_tier}</span></span>
                                        <span className="text-slate-300">{t('ticketTypes.limit')} <span className="text-white">{ticket.max_quantity === 0 ? t('ticketTypes.unlimited') : ticket.max_quantity}</span></span>
                                        <span className="text-slate-300">{t('ticketTypes.sold')} <span className="text-white">{ticket.sold_count || 0}</span></span>
                                        <span className="text-slate-300 col-span-2 mt-1 flex items-center gap-1">
                                            {t('ticketTypes.reentry')}
                                            {ticket.allows_reentry ? (
                                                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">{t('ticketTypes.allowed')}</span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">{t('ticketTypes.denied')}</span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="text-xs text-slate-500 mt-2">
                                        {t('ticketTypes.event')} {events.find(e => (e.event_id || e.id) === ticket.event_id)?.event_name || ticket.event_id}
                                    </div>
                                </div>

                                <div className="flex flex-col space-y-2 ml-4">
                                    <button
                                        onClick={() => {
                                            setEditingType(ticket);
                                            setFormData({
                                                id: ticket.id,
                                                event_id: ticket.event_id,
                                                name: ticket.name,
                                                description: ticket.description || '',
                                                price_cents: ticket.price_cents,
                                                max_quantity: ticket.max_quantity || 0,
                                                allows_reentry: ticket.allows_reentry,
                                                id_verification_tier: ticket.id_verification_tier || 1,
                                                revenue_profile_id: ticket.revenue_profile_id || '',
                                                tax_profile_id: ticket.tax_profile_id || '',
                                                sale_start_date: formatDateForInput(ticket.sale_start_date),
                                                sale_end_date: formatDateForInput(ticket.sale_end_date)
                                            });
                                            setShowForm(true);
                                        }}
                                        className="p-2 bg-slate-800 hover:bg-slate-600/80 rounded-lg transition-all border border-slate-700"
                                    >
                                        <Edit2 className="w-4 h-4 text-slate-300" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ticket.id)}
                                        className="p-2 bg-slate-800 hover:bg-red-500/20 rounded-lg transition-all border border-slate-700"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
