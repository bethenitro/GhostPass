import React, { useState, useEffect } from 'react';
import { MapPin, Building2, Utensils, Plus, Edit2, Trash2, Power, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gatewayApi } from '@/lib/api';
import type { EntryPoint, InternalArea, TableSeat, GatewayStatus } from '@/types';

interface GatewayManagerPageProps {
    onBack: () => void;
}

type TabType = 'entry-points' | 'internal-areas' | 'tables-seats';

interface EntryPointFormData {
    name: string;
    status: GatewayStatus;
}

interface InternalAreaFormData {
    name: string;
    number: string;
    accepts_ghostpass: boolean;
    status: GatewayStatus;
}

interface TableSeatFormData {
    name: string;
    number: string;
    linked_area_id: string;
    status: GatewayStatus;
}

const GatewayManagerPage: React.FC<GatewayManagerPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<TabType>('entry-points');

    // Entry Points State
    const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [showEntryPointModal, setShowEntryPointModal] = useState(false);
    const [editingEntryPoint, setEditingEntryPoint] = useState<EntryPoint | null>(null);
    const [entryPointForm, setEntryPointForm] = useState<EntryPointFormData>({
        name: '',
        status: 'ENABLED'
    });
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [formError, setFormError] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Internal Areas State
    const [internalAreas, setInternalAreas] = useState<InternalArea[]>([]);
    const [loadingAreas, setLoadingAreas] = useState(false);
    const [areaError, setAreaError] = useState<string>('');
    const [showAreaModal, setShowAreaModal] = useState(false);
    const [editingArea, setEditingArea] = useState<InternalArea | null>(null);
    const [areaForm, setAreaForm] = useState<InternalAreaFormData>({
        name: '',
        number: '',
        accepts_ghostpass: true,
        status: 'ENABLED'
    });
    const [deleteAreaConfirmId, setDeleteAreaConfirmId] = useState<string | null>(null);
    const [areaFormError, setAreaFormError] = useState<string>('');
    const [savingArea, setSavingArea] = useState(false);

    // Tables & Seats State
    const [tableSeats, setTableSeats] = useState<TableSeat[]>([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [tableError, setTableError] = useState<string>('');
    const [showTableModal, setShowTableModal] = useState(false);
    const [editingTable, setEditingTable] = useState<TableSeat | null>(null);
    const [tableForm, setTableForm] = useState<TableSeatFormData>({
        name: '',
        number: '',
        linked_area_id: '',
        status: 'ENABLED'
    });
    const [deleteTableConfirmId, setDeleteTableConfirmId] = useState<string | null>(null);
    const [tableFormError, setTableFormError] = useState<string>('');
    const [savingTable, setSavingTable] = useState(false);

    // Load entry points from backend
    const loadEntryPoints = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await gatewayApi.getEntryPoints();
            setEntryPoints(data);
        } catch (err: any) {
            console.error('Error loading entry points:', err);
            setError(err.response?.data?.detail || 'Failed to load entry points');
        } finally {
            setLoading(false);
        }
    };

    // Load internal areas from backend
    const loadInternalAreas = async () => {
        try {
            setLoadingAreas(true);
            setAreaError('');
            const data = await gatewayApi.getInternalAreas();
            setInternalAreas(data);
        } catch (err: any) {
            console.error('Error loading internal areas:', err);
            setAreaError(err.response?.data?.detail || 'Failed to load internal areas');
        } finally {
            setLoadingAreas(false);
        }
    };

    // Load tables & seats from backend
    const loadTableSeats = async () => {
        try {
            setLoadingTables(true);
            setTableError('');
            const data = await gatewayApi.getTableSeats();
            console.log('Loaded tables from API:', data);
            if (data.length > 0) {
                console.log('First table object:', JSON.stringify(data[0], null, 2));
            }
            data.forEach((table: any) => {
                console.log(`Table "${table.name}": linked_area_id = ${table.linked_area_id}`);
            });
            setTableSeats(data);
        } catch (err: any) {
            console.error('Error loading tables & seats:', err);
            setTableError(err.response?.data?.detail || 'Failed to load tables & seats');
        } finally {
            setLoadingTables(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'entry-points') {
            loadEntryPoints();
        } else if (activeTab === 'internal-areas') {
            loadInternalAreas();
        } else if (activeTab === 'tables-seats') {
            loadInternalAreas(); // Load areas for dropdown
            loadTableSeats();
        }
    }, [activeTab]);

    const tabs = [
        { id: 'entry-points' as TabType, label: 'Entry Points', icon: MapPin },
        { id: 'internal-areas' as TabType, label: 'Internal Areas', icon: Building2 },
        { id: 'tables-seats' as TabType, label: 'Tables & Seats', icon: Utensils },
    ];

    // Entry Point CRUD Operations
    const handleOpenAddModal = () => {
        setEditingEntryPoint(null);
        setEntryPointForm({ name: '', status: 'ENABLED' });
        setFormError('');
        setShowEntryPointModal(true);
    };

    const handleOpenEditModal = (entryPoint: EntryPoint) => {
        setEditingEntryPoint(entryPoint);
        setEntryPointForm({ name: entryPoint.name, status: entryPoint.status });
        setFormError('');
        setShowEntryPointModal(true);
    };

    const handleSaveEntryPoint = async () => {
        if (!entryPointForm.name.trim()) {
            setFormError('Entry point name is required');
            return;
        }

        try {
            setSaving(true);
            setFormError('');

            if (editingEntryPoint) {
                const updated = await gatewayApi.updateEntryPoint(editingEntryPoint.id, {
                    name: entryPointForm.name,
                    status: entryPointForm.status
                });
                setEntryPoints(prev => prev.map(ep => ep.id === updated.id ? updated : ep));
            } else {
                const newPoint = await gatewayApi.createEntryPoint({
                    name: entryPointForm.name,
                    status: entryPointForm.status
                });
                setEntryPoints(prev => [newPoint, ...prev]);
            }

            setShowEntryPointModal(false);
            setEntryPointForm({ name: '', status: 'ENABLED' });
        } catch (err: any) {
            console.error('Error saving entry point:', err);
            setFormError(err.response?.data?.detail || 'Failed to save entry point');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEntryPoint = async (id: string) => {
        try {
            await gatewayApi.deleteEntryPoint(id);
            setEntryPoints(prev => prev.filter(ep => ep.id !== id));
            setDeleteConfirmId(null);
        } catch (err: any) {
            console.error('Error deleting entry point:', err);
            setError(err.response?.data?.detail || 'Failed to delete entry point');
        }
    };

    const handleToggleStatus = async (entryPoint: EntryPoint) => {
        const newStatus: GatewayStatus = entryPoint.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';

        try {
            const updated = await gatewayApi.updateEntryPoint(entryPoint.id, { status: newStatus });
            setEntryPoints(prev => prev.map(ep => ep.id === updated.id ? updated : ep));
        } catch (err: any) {
            console.error('Error toggling status:', err);
            setError(err.response?.data?.detail || 'Failed to update status');
        }
    };

    // Internal Area CRUD Operations
    const handleOpenAddAreaModal = () => {
        setEditingArea(null);
        setAreaForm({ name: '', number: '', accepts_ghostpass: true, status: 'ENABLED' });
        setAreaFormError('');
        setShowAreaModal(true);
    };

    const handleOpenEditAreaModal = (area: InternalArea) => {
        setEditingArea(area);
        setAreaForm({
            name: area.name,
            number: area.number?.toString() || '',
            accepts_ghostpass: area.accepts_ghostpass,
            status: area.status
        });
        setAreaFormError('');
        setShowAreaModal(true);
    };

    const handleSaveArea = async () => {
        if (!areaForm.name.trim()) {
            setAreaFormError('Area name is required');
            return;
        }

        try {
            setSavingArea(true);
            setAreaFormError('');

            const areaData = {
                name: areaForm.name,
                number: areaForm.number ? parseInt(areaForm.number) : undefined,
                accepts_ghostpass: areaForm.accepts_ghostpass,
                status: areaForm.status
            };

            if (editingArea) {
                const updated = await gatewayApi.updateInternalArea(editingArea.id, areaData);
                setInternalAreas(prev => prev.map(a => a.id === updated.id ? updated : a));
            } else {
                const newArea = await gatewayApi.createInternalArea(areaData);
                setInternalAreas(prev => [newArea, ...prev]);
            }

            setShowAreaModal(false);
            setAreaForm({ name: '', number: '', accepts_ghostpass: true, status: 'ENABLED' });
        } catch (err: any) {
            console.error('Error saving internal area:', err);
            setAreaFormError(err.response?.data?.detail || 'Failed to save internal area');
        } finally {
            setSavingArea(false);
        }
    };

    const handleDeleteArea = async (id: string) => {
        try {
            await gatewayApi.deleteInternalArea(id);
            setInternalAreas(prev => prev.filter(a => a.id !== id));
            setDeleteAreaConfirmId(null);
        } catch (err: any) {
            console.error('Error deleting internal area:', err);
            setAreaError(err.response?.data?.detail || 'Failed to delete internal area');
        }
    };

    const handleToggleAreaStatus = async (area: InternalArea) => {
        const newStatus: GatewayStatus = area.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';

        try {
            const updated = await gatewayApi.updateInternalArea(area.id, { status: newStatus });
            setInternalAreas(prev => prev.map(a => a.id === updated.id ? updated : a));
        } catch (err: any) {
            console.error('Error toggling status:', err);
            setAreaError(err.response?.data?.detail || 'Failed to update status');
        }
    };

    // Tables & Seats CRUD Operations
    const handleOpenAddTableModal = () => {
        if (internalAreas.length === 0) {
            setTableError('Please create an Internal Area first before adding tables');
            return;
        }
        setEditingTable(null);
        setTableForm({ name: '', number: '', linked_area_id: '', status: 'ENABLED' });
        setTableFormError('');
        setShowTableModal(true);
    };

    const handleOpenEditTableModal = (table: TableSeat) => {
        setEditingTable(table);
        setTableForm({
            name: table.name,
            number: table.number?.toString() || '',
            linked_area_id: table.linked_area_id,
            status: table.status
        });
        setTableFormError('');
        setShowTableModal(true);
    };

    const handleSaveTable = async () => {
        if (!tableForm.name.trim()) {
            setTableFormError('Table/Seat name is required');
            return;
        }

        if (!tableForm.linked_area_id) {
            setTableFormError('Please select a linked area');
            return;
        }

        try {
            setSavingTable(true);
            setTableFormError('');

            const tableData = {
                name: tableForm.name,
                number: tableForm.number ? parseInt(tableForm.number) : undefined,
                linked_area_id: tableForm.linked_area_id,
                status: tableForm.status
            };

            if (editingTable) {
                const updated = await gatewayApi.updateTableSeat(editingTable.id, tableData);
                setTableSeats(prev => prev.map(t => t.id === updated.id ? updated : t));
            } else {
                const newTable = await gatewayApi.createTableSeat(tableData);
                setTableSeats(prev => [newTable, ...prev]);
            }

            setShowTableModal(false);
            setTableForm({ name: '', number: '', linked_area_id: '', status: 'ENABLED' });
        } catch (err: any) {
            console.error('Error saving table/seat:', err);
            setTableFormError(err.response?.data?.detail || 'Failed to save table/seat');
        } finally {
            setSavingTable(false);
        }
    };

    const handleDeleteTable = async (id: string) => {
        try {
            await gatewayApi.deleteTableSeat(id);
            setTableSeats(prev => prev.filter(t => t.id !== id));
            setDeleteTableConfirmId(null);
        } catch (err: any) {
            console.error('Error deleting table/seat:', err);
            setTableError(err.response?.data?.detail || 'Failed to delete table/seat');
        }
    };

    const handleToggleTableStatus = async (table: TableSeat) => {
        const newStatus: GatewayStatus = table.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';

        try {
            const updated = await gatewayApi.updateTableSeat(table.id, { status: newStatus });
            setTableSeats(prev => prev.map(t => t.id === updated.id ? updated : t));
        } catch (err: any) {
            console.error('Error toggling status:', err);
            setTableError(err.response?.data?.detail || 'Failed to update status');
        }
    };

    // Helper function to get area name by ID
    const getAreaName = (areaId: string): string => {
        const area = internalAreas.find(a => a.id === areaId);
        return area ? area.name : 'Unknown Area';
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/10 to-transparent sticky top-0 z-10 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400 flex-shrink-0 touch-manipulation"
                            aria-label="Back to Command Center"
                        >
                            <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg sm:text-xl md:text-3xl font-bold text-red-400 truncate">
                                Point Centric Gateway Manager
                            </h1>
                            <p className="text-xs sm:text-sm md:text-base text-slate-400 mt-1 truncate">
                                Define where GhostPass can be used in your venue
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-red-500/20 bg-slate-900/50 sticky top-[72px] md:top-[88px] z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex overflow-x-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex items-center space-x-2 px-4 sm:px-6 py-3 sm:py-4 font-medium transition-all duration-300 border-b-2 whitespace-nowrap touch-manipulation min-h-[44px]",
                                        isActive
                                            ? "text-red-400 border-red-500 bg-red-500/10"
                                            : "text-slate-400 border-transparent hover:text-red-300 hover:bg-red-500/5 active:bg-red-500/10"
                                    )}
                                >
                                    <Icon size={16} className="sm:w-5 sm:h-5 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm md:text-base">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
                {activeTab === 'entry-points' && (
                    <div className="space-y-4">
                        {/* Header with Add Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-red-400">Entry Points</h2>
                                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                    Configure entry points where users can scan their GhostPass
                                </p>
                            </div>
                            <button
                                onClick={handleOpenAddModal}
                                className="px-4 py-2.5 sm:py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                            >
                                <Plus size={18} />
                                <span className="text-sm sm:text-base">ADD ENTRY POINT</span>
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 sm:p-4 flex items-start space-x-2">
                                <span className="text-red-400 text-sm flex-1">{error}</span>
                                <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 touch-manipulation">
                                    <ArrowLeft size={16} />
                                </button>
                            </div>
                        )}

                        {/* Loading State */}
                        {loading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-400"></div>
                            </div>
                        )}

                        {/* Entry Points List */}
                        {!loading && entryPoints.length > 0 && (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block glass-panel border-red-500/20 overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-red-500/20 bg-slate-800/50">
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Name</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Status</th>
                                                <th className="text-right py-3 px-4 text-slate-300 font-semibold text-sm">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entryPoints.map((entryPoint) => (
                                                <tr
                                                    key={entryPoint.id}
                                                    className={cn(
                                                        "border-b border-slate-800 hover:bg-red-500/5 transition-colors",
                                                        entryPoint.status === 'DISABLED' && "opacity-50"
                                                    )}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center space-x-2">
                                                            <MapPin size={16} className="text-red-400 flex-shrink-0" />
                                                            <span className={cn(
                                                                "font-medium text-sm",
                                                                entryPoint.status === 'ENABLED' ? "text-white" : "text-slate-500"
                                                            )}>{entryPoint.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => handleToggleStatus(entryPoint)}
                                                            className={cn(
                                                                "px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition-all touch-manipulation",
                                                                entryPoint.status === 'ENABLED'
                                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                                                                    : "bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600"
                                                            )}
                                                        >
                                                            <Power size={12} />
                                                            <span>{entryPoint.status}</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <button
                                                                onClick={() => handleOpenEditModal(entryPoint)}
                                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors touch-manipulation"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirmId(entryPoint.id)}
                                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors touch-manipulation"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                    {entryPoints.map((entryPoint) => (
                                        <div
                                            key={entryPoint.id}
                                            className={cn(
                                                "glass-panel border-red-500/20 p-4",
                                                entryPoint.status === 'DISABLED' && "opacity-50"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-3 gap-2">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <MapPin size={16} className="text-red-400 flex-shrink-0" />
                                                    <span className={cn(
                                                        "font-medium text-sm break-words",
                                                        entryPoint.status === 'ENABLED' ? "text-white" : "text-slate-500"
                                                    )}>{entryPoint.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleStatus(entryPoint)}
                                                    className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition-all flex-shrink-0 touch-manipulation min-h-[32px]",
                                                        entryPoint.status === 'ENABLED'
                                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 active:bg-emerald-500/40"
                                                            : "bg-slate-700 text-slate-400 border border-slate-600 active:bg-slate-600"
                                                    )}
                                                >
                                                    <Power size={10} />
                                                    <span>{entryPoint.status}</span>
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenEditModal(entryPoint)}
                                                    className="flex-1 px-3 py-2.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded text-sm hover:bg-blue-500/30 active:bg-blue-500/40 transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[44px]"
                                                >
                                                    <Edit2 size={14} />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(entryPoint.id)}
                                                    className="flex-1 px-3 py-2.5 bg-red-500/20 border border-red-500 text-red-400 rounded text-sm hover:bg-red-500/30 active:bg-red-500/40 transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[44px]"
                                                >
                                                    <Trash2 size={14} />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Empty State */}
                        {!loading && entryPoints.length === 0 && (
                            <div className="glass-panel border-red-500/20 p-8 sm:p-12 text-center">
                                <MapPin className="mx-auto text-slate-600 mb-4" size={48} />
                                <p className="text-slate-400 text-base sm:text-lg mb-2">No entry points configured</p>
                                <p className="text-slate-500 text-xs sm:text-sm mb-6">
                                    Add your first entry point to start managing venue access
                                </p>
                                <button
                                    onClick={handleOpenAddModal}
                                    className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 inline-flex items-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                                >
                                    <Plus size={18} />
                                    <span>ADD ENTRY POINT</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'internal-areas' && (
                    <div className="space-y-4">
                        {/* Header with Add Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-red-400">Internal Areas</h2>
                                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                    Configure internal areas where GhostPass can be used
                                </p>
                            </div>
                            <button
                                onClick={handleOpenAddAreaModal}
                                className="px-4 py-2.5 sm:py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                            >
                                <Plus size={18} />
                                <span className="text-sm sm:text-base">ADD AREA</span>
                            </button>
                        </div>

                        {/* Error Message */}
                        {areaError && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 sm:p-4 flex items-start space-x-2">
                                <span className="text-red-400 text-sm flex-1">{areaError}</span>
                                <button
                                    onClick={() => setAreaError('')}
                                    className="text-red-400 hover:text-red-300 touch-manipulation"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                            </div>
                        )}

                        {/* Loading State */}
                        {loadingAreas && (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-400"></div>
                            </div>
                        )}

                        {/* Internal Areas Table/List */}
                        {!loadingAreas && internalAreas.length > 0 && (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block glass-panel border-red-500/20 overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-red-500/20 bg-slate-800/50">
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Name</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Number</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">GhostPass Accepted</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Status</th>
                                                <th className="text-right py-3 px-4 text-slate-300 font-semibold text-sm">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {internalAreas.map((area) => (
                                                <tr
                                                    key={area.id}
                                                    className={cn(
                                                        "border-b border-slate-800 hover:bg-red-500/5 transition-colors",
                                                        area.status === 'DISABLED' && "opacity-50"
                                                    )}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center space-x-2">
                                                            <Building2 size={16} className="text-red-400 flex-shrink-0" />
                                                            <span className={cn(
                                                                "font-medium text-sm",
                                                                area.status === 'ENABLED' ? "text-white" : "text-slate-500"
                                                            )}>{area.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-slate-300 text-sm">
                                                            {area.number || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-full text-xs font-medium",
                                                            area.accepts_ghostpass
                                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                                                : "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                                                        )}>
                                                            {area.accepts_ghostpass ? 'YES' : 'NO'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => handleToggleAreaStatus(area)}
                                                            className={cn(
                                                                "px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition-all touch-manipulation",
                                                                area.status === 'ENABLED'
                                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                                                                    : "bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600"
                                                            )}
                                                        >
                                                            <Power size={12} />
                                                            <span>{area.status}</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <button
                                                                onClick={() => handleOpenEditAreaModal(area)}
                                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors touch-manipulation"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteAreaConfirmId(area.id)}
                                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors touch-manipulation"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                    {internalAreas.map((area) => (
                                        <div
                                            key={area.id}
                                            className={cn(
                                                "glass-panel border-red-500/20 p-4",
                                                area.status === 'DISABLED' && "opacity-50"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-3 gap-2">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <Building2 size={16} className="text-red-400 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className={cn(
                                                            "font-medium text-sm break-words block",
                                                            area.status === 'ENABLED' ? "text-white" : "text-slate-500"
                                                        )}>{area.name}</span>
                                                        {area.number && (
                                                            <span className="text-slate-400 text-xs">#{area.number}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleAreaStatus(area)}
                                                    className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition-all flex-shrink-0 touch-manipulation min-h-[32px]",
                                                        area.status === 'ENABLED'
                                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 active:bg-emerald-500/40"
                                                            : "bg-slate-700 text-slate-400 border border-slate-600 active:bg-slate-600"
                                                    )}
                                                >
                                                    <Power size={10} />
                                                    <span>{area.status}</span>
                                                </button>
                                            </div>

                                            <div className="mb-3 flex items-center gap-2 text-xs">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-full font-medium",
                                                    area.accepts_ghostpass
                                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                                        : "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                                                )}>
                                                    GhostPass: {area.accepts_ghostpass ? 'YES' : 'NO'}
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenEditAreaModal(area)}
                                                    className="flex-1 px-3 py-2.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded text-sm hover:bg-blue-500/30 active:bg-blue-500/40 transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[44px]"
                                                >
                                                    <Edit2 size={14} />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteAreaConfirmId(area.id)}
                                                    className="flex-1 px-3 py-2.5 bg-red-500/20 border border-red-500 text-red-400 rounded text-sm hover:bg-red-500/30 active:bg-red-500/40 transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[44px]"
                                                >
                                                    <Trash2 size={14} />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Empty State */}
                        {!loadingAreas && internalAreas.length === 0 && (
                            <div className="glass-panel border-red-500/20 p-8 sm:p-12 text-center">
                                <Building2 className="mx-auto text-slate-600 mb-4" size={48} />
                                <p className="text-slate-400 text-base sm:text-lg mb-2">No internal areas configured</p>
                                <p className="text-slate-500 text-xs sm:text-sm mb-6">
                                    Add your first internal area to start managing venue locations
                                </p>
                                <button
                                    onClick={handleOpenAddAreaModal}
                                    className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 inline-flex items-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                                >
                                    <Plus size={18} />
                                    <span>ADD AREA</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tables-seats' && (
                    <div className="space-y-4">
                        {/* Header with Add Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-red-400">Tables & Seats</h2>
                                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                    Configure specific tables, booths, or seats within internal areas
                                </p>
                            </div>
                            <button
                                onClick={handleOpenAddTableModal}
                                className="px-4 py-2.5 sm:py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                            >
                                <Plus size={18} />
                                <span className="text-sm sm:text-base">ADD TABLE/SEAT</span>
                            </button>
                        </div>

                        {/* Error Message */}
                        {tableError && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 sm:p-4 flex items-start space-x-2">
                                <span className="text-red-400 text-sm flex-1">{tableError}</span>
                                <button
                                    onClick={() => setTableError('')}
                                    className="text-red-400 hover:text-red-300 touch-manipulation"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                            </div>
                        )}

                        {/* Loading State */}
                        {loadingTables && (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-400"></div>
                            </div>
                        )}

                        {/* No Internal Areas Warning */}
                        {!loadingTables && internalAreas.length === 0 && (
                            <div className="glass-panel border-amber-500/20 p-8 sm:p-12 text-center">
                                <Building2 className="mx-auto text-amber-600 mb-4" size={48} />
                                <p className="text-amber-400 text-base sm:text-lg mb-2">Create an Internal Area first</p>
                                <p className="text-slate-500 text-xs sm:text-sm mb-6">
                                    Tables and seats must be linked to an internal area. Please create at least one internal area before adding tables.
                                </p>
                                <button
                                    onClick={() => setActiveTab('internal-areas')}
                                    className="px-6 py-3 bg-amber-500/20 border border-amber-500 text-amber-400 rounded-lg font-medium hover:bg-amber-500/30 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300 inline-flex items-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                                >
                                    <Building2 size={18} />
                                    <span>GO TO INTERNAL AREAS</span>
                                </button>
                            </div>
                        )}

                        {/* Tables & Seats List */}
                        {!loadingTables && internalAreas.length > 0 && tableSeats.length > 0 && (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block glass-panel border-red-500/20 overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-red-500/20 bg-slate-800/50">
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Name</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Number</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Linked Area</th>
                                                <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Status</th>
                                                <th className="text-right py-3 px-4 text-slate-300 font-semibold text-sm">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableSeats.map((table) => (
                                                <tr
                                                    key={table.id}
                                                    className={cn(
                                                        "border-b border-slate-800 hover:bg-red-500/5 transition-colors",
                                                        table.status === 'DISABLED' && "opacity-50"
                                                    )}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center space-x-2">
                                                            <Utensils size={16} className="text-red-400 flex-shrink-0" />
                                                            <span className={cn(
                                                                "font-medium text-sm",
                                                                table.status === 'ENABLED' ? "text-white" : "text-slate-500"
                                                            )}>{table.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-slate-300 text-sm">
                                                            {table.number || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center space-x-2">
                                                            <Building2 size={14} className="text-blue-400 flex-shrink-0" />
                                                            <span className="text-slate-300 text-sm">
                                                                {getAreaName(table.linked_area_id)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => handleToggleTableStatus(table)}
                                                            className={cn(
                                                                "px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition-all touch-manipulation",
                                                                table.status === 'ENABLED'
                                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                                                                    : "bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600"
                                                            )}
                                                        >
                                                            <Power size={12} />
                                                            <span>{table.status}</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <button
                                                                onClick={() => handleOpenEditTableModal(table)}
                                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors touch-manipulation"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTableConfirmId(table.id)}
                                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors touch-manipulation"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-3">
                                    {tableSeats.map((table) => (
                                        <div
                                            key={table.id}
                                            className={cn(
                                                "glass-panel border-red-500/20 p-4",
                                                table.status === 'DISABLED' && "opacity-50"
                                            )}
                                        >
                                            <div className="flex items-start justify-between mb-3 gap-2">
                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <Utensils size={16} className="text-red-400 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className={cn(
                                                            "font-medium text-sm break-words block",
                                                            table.status === 'ENABLED' ? "text-white" : "text-slate-500"
                                                        )}>{table.name}</span>
                                                        {table.number && (
                                                            <span className="text-slate-400 text-xs">#{table.number}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleTableStatus(table)}
                                                    className={cn(
                                                        "px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition-all flex-shrink-0 touch-manipulation min-h-[32px]",
                                                        table.status === 'ENABLED'
                                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 active:bg-emerald-500/40"
                                                            : "bg-slate-700 text-slate-400 border border-slate-600 active:bg-slate-600"
                                                    )}
                                                >
                                                    <Power size={10} />
                                                    <span>{table.status}</span>
                                                </button>
                                            </div>

                                            <div className="mb-3 flex items-center gap-2 text-xs">
                                                <Building2 size={14} className="text-blue-400" />
                                                <span className="text-slate-400">
                                                    Linked to: <span className="text-blue-400">{getAreaName(table.linked_area_id)}</span>
                                                </span>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenEditTableModal(table)}
                                                    className="flex-1 px-3 py-2.5 bg-blue-500/20 border border-blue-500 text-blue-400 rounded text-sm hover:bg-blue-500/30 active:bg-blue-500/40 transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[44px]"
                                                >
                                                    <Edit2 size={14} />
                                                    <span>Edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTableConfirmId(table.id)}
                                                    className="flex-1 px-3 py-2.5 bg-red-500/20 border border-red-500 text-red-400 rounded text-sm hover:bg-red-500/30 active:bg-red-500/40 transition-colors flex items-center justify-center space-x-1 touch-manipulation min-h-[44px]"
                                                >
                                                    <Trash2 size={14} />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Empty State */}
                        {!loadingTables && internalAreas.length > 0 && tableSeats.length === 0 && (
                            <div className="glass-panel border-red-500/20 p-8 sm:p-12 text-center">
                                <Utensils className="mx-auto text-slate-600 mb-4" size={48} />
                                <p className="text-slate-400 text-base sm:text-lg mb-2">No tables or seats configured</p>
                                <p className="text-slate-500 text-xs sm:text-sm mb-6">
                                    Add your first table or seat to start managing specific locations
                                </p>
                                <button
                                    onClick={handleOpenAddTableModal}
                                    className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 inline-flex items-center space-x-2 touch-manipulation min-h-[44px] active:scale-95"
                                >
                                    <Plus size={18} />
                                    <span>ADD TABLE/SEAT</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Entry Point Modal */}
            {showEntryPointModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !saving && setShowEntryPointModal(false)}
                    />
                    <div className="relative bg-slate-900 border-t sm:border border-red-500/30 sm:rounded-xl shadow-2xl shadow-red-500/20 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 sm:p-6">
                            <h3 className="text-lg sm:text-xl font-bold text-red-400 mb-4">
                                {editingEntryPoint ? 'Edit Entry Point' : 'Add Entry Point'}
                            </h3>

                            {formError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
                                    <p className="text-red-400 text-sm">{formError}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Entry Point Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={entryPointForm.name}
                                        onChange={(e) => setEntryPointForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Main Entrance, Gate F50"
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                                        autoFocus
                                        disabled={saving}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Status
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setEntryPointForm(prev => ({ ...prev, status: 'ENABLED' }))}
                                            disabled={saving}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                entryPointForm.status === 'ENABLED'
                                                    ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <Power size={16} />
                                            <span>ENABLED</span>
                                        </button>
                                        <button
                                            onClick={() => setEntryPointForm(prev => ({ ...prev, status: 'DISABLED' }))}
                                            disabled={saving}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                entryPointForm.status === 'DISABLED'
                                                    ? "bg-slate-700 border-2 border-slate-500 text-slate-300"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <Power size={16} />
                                            <span>DISABLED</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowEntryPointModal(false)}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEntryPoint}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/40 transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>}
                                    <span>{saving ? 'Saving...' : (editingEntryPoint ? 'Save Changes' : 'Add Entry Point')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDeleteConfirmId(null)}
                    />
                    <div className="relative bg-slate-900 border-t sm:border border-red-500/30 sm:rounded-xl shadow-2xl shadow-red-500/20 w-full sm:max-w-md">
                        <div className="p-4 sm:p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-3 bg-red-500/20 rounded-full">
                                    <Trash2 className="text-red-400" size={24} />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-red-400">Delete Entry Point</h3>
                            </div>

                            <p className="text-slate-300 mb-6 text-sm sm:text-base">
                                Are you sure you want to delete this entry point? <strong className="text-red-400">This cannot be undone.</strong>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteEntryPoint(deleteConfirmId)}
                                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/40 transition-all duration-300 touch-manipulation min-h-[44px]"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Internal Area Modal */}
            {showAreaModal && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !savingArea && setShowAreaModal(false)}
                    />
                    <div className="relative bg-slate-900 border-t sm:border border-red-500/30 sm:rounded-xl shadow-2xl shadow-red-500/20 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 sm:p-6">
                            <h3 className="text-lg sm:text-xl font-bold text-red-400 mb-4">
                                {editingArea ? 'Edit Internal Area' : 'Add Internal Area'}
                            </h3>

                            {areaFormError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
                                    <p className="text-red-400 text-sm">{areaFormError}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Area Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={areaForm.name}
                                        onChange={(e) => setAreaForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Bar 4, Concession Stand A"
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                                        autoFocus
                                        disabled={savingArea}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Area Number (Optional)
                                    </label>
                                    <input
                                        type="number"
                                        value={areaForm.number}
                                        onChange={(e) => setAreaForm(prev => ({ ...prev, number: e.target.value }))}
                                        placeholder="e.g., 4, 9"
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                                        disabled={savingArea}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Accepts GhostPass
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setAreaForm(prev => ({ ...prev, accepts_ghostpass: true }))}
                                            disabled={savingArea}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                areaForm.accepts_ghostpass
                                                    ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <span>YES</span>
                                        </button>
                                        <button
                                            onClick={() => setAreaForm(prev => ({ ...prev, accepts_ghostpass: false }))}
                                            disabled={savingArea}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                !areaForm.accepts_ghostpass
                                                    ? "bg-amber-500/20 border-2 border-amber-500 text-amber-400"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <span>NO</span>
                                        </button>
                                    </div>
                                    {!areaForm.accepts_ghostpass && (
                                        <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/50 rounded-lg">
                                            <p className="text-amber-400 text-xs sm:text-sm">
                                                ⚠️ Users will not be able to use GhostPass here.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Status
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setAreaForm(prev => ({ ...prev, status: 'ENABLED' }))}
                                            disabled={savingArea}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                areaForm.status === 'ENABLED'
                                                    ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <Power size={16} />
                                            <span>ACTIVE</span>
                                        </button>
                                        <button
                                            onClick={() => setAreaForm(prev => ({ ...prev, status: 'DISABLED' }))}
                                            disabled={savingArea}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                areaForm.status === 'DISABLED'
                                                    ? "bg-slate-700 border-2 border-slate-500 text-slate-300"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <Power size={16} />
                                            <span>INACTIVE</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAreaModal(false)}
                                    disabled={savingArea}
                                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveArea}
                                    disabled={savingArea}
                                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/40 transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {savingArea && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>}
                                    <span>{savingArea ? 'Saving...' : (editingArea ? 'Save Changes' : 'Add Area')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Internal Area Confirmation Modal */}
            {deleteAreaConfirmId && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDeleteAreaConfirmId(null)}
                    />
                    <div className="relative bg-slate-900 border-t sm:border border-red-500/30 sm:rounded-xl shadow-2xl shadow-red-500/20 w-full sm:max-w-md">
                        <div className="p-4 sm:p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-3 bg-red-500/20 rounded-full">
                                    <Trash2 className="text-red-400" size={24} />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-red-400">Delete Internal Area</h3>
                            </div>

                            <p className="text-slate-300 mb-6 text-sm sm:text-base">
                                Are you sure you want to delete this internal area? <strong className="text-red-400">This cannot be undone.</strong>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteAreaConfirmId(null)}
                                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteArea(deleteAreaConfirmId)}
                                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/40 transition-all duration-300 touch-manipulation min-h-[44px]"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Table/Seat Modal */}
            {showTableModal && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !savingTable && setShowTableModal(false)}
                    />
                    <div className="relative bg-slate-900 border-t sm:border border-red-500/30 sm:rounded-xl shadow-2xl shadow-red-500/20 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-4 sm:p-6">
                            <h3 className="text-lg sm:text-xl font-bold text-red-400 mb-4">
                                {editingTable ? 'Edit Table/Seat' : 'Add Table/Seat'}
                            </h3>

                            {tableFormError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
                                    <p className="text-red-400 text-sm">{tableFormError}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Table/Seat Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={tableForm.name}
                                        onChange={(e) => setTableForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Table 12, Booth A, Section 204"
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                                        autoFocus
                                        disabled={savingTable}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Number (Optional)
                                    </label>
                                    <input
                                        type="number"
                                        value={tableForm.number}
                                        onChange={(e) => setTableForm(prev => ({ ...prev, number: e.target.value }))}
                                        placeholder="e.g., 12, 204"
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                                        disabled={savingTable}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Linked Area *
                                    </label>
                                    <select
                                        value={tableForm.linked_area_id}
                                        onChange={(e) => setTableForm(prev => ({ ...prev, linked_area_id: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-red-500 focus:outline-none text-base"
                                        disabled={savingTable}
                                    >
                                        <option value="">Select an area...</option>
                                        {internalAreas.filter(a => a.status === 'ENABLED').map((area) => (
                                            <option key={area.id} value={area.id}>
                                                {area.name} {area.number ? `#${area.number}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-slate-500 text-xs mt-1">
                                        Select which internal area this table/seat belongs to
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Status
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setTableForm(prev => ({ ...prev, status: 'ENABLED' }))}
                                            disabled={savingTable}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                tableForm.status === 'ENABLED'
                                                    ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <Power size={16} />
                                            <span>ACTIVE</span>
                                        </button>
                                        <button
                                            onClick={() => setTableForm(prev => ({ ...prev, status: 'DISABLED' }))}
                                            disabled={savingTable}
                                            className={cn(
                                                "flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 touch-manipulation min-h-[44px]",
                                                tableForm.status === 'DISABLED'
                                                    ? "bg-slate-700 border-2 border-slate-500 text-slate-300"
                                                    : "bg-slate-800 border-2 border-slate-600 text-slate-400 active:bg-slate-700"
                                            )}
                                        >
                                            <Power size={16} />
                                            <span>INACTIVE</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowTableModal(false)}
                                    disabled={savingTable}
                                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTable}
                                    disabled={savingTable}
                                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/40 transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {savingTable && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>}
                                    <span>{savingTable ? 'Saving...' : (editingTable ? 'Save Changes' : 'Add Table/Seat')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Table/Seat Confirmation Modal */}
            {deleteTableConfirmId && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setDeleteTableConfirmId(null)}
                    />
                    <div className="relative bg-slate-900 border-t sm:border border-red-500/30 sm:rounded-xl shadow-2xl shadow-red-500/20 w-full sm:max-w-md">
                        <div className="p-4 sm:p-6">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-3 bg-red-500/20 rounded-full">
                                    <Trash2 className="text-red-400" size={24} />
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-red-400">Delete Table/Seat</h3>
                            </div>

                            <p className="text-slate-300 mb-6 text-sm sm:text-base">
                                Are you sure you want to delete this table/seat? <strong className="text-red-400">This cannot be undone.</strong>
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTableConfirmId(null)}
                                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 active:bg-slate-600 transition-colors touch-manipulation min-h-[44px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteTable(deleteTableConfirmId)}
                                    className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/40 transition-all duration-300 touch-manipulation min-h-[44px]"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GatewayManagerPage;
