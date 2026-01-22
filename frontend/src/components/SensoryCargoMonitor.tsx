import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, Ear, Hand, Compass, Wind, Droplet, 
  CheckCircle, XCircle, Clock, ArrowLeft,
  AlertCircle, Shield, Scale,
  BarChart3, Zap, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sensoryApi, environmentApi } from '@/lib/api';

/**
 * SENSORY CARGO MONITOR - OBSERVABILITY SURFACE ONLY
 * 
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * - We do NOT select sensory types
 * - We do NOT request sensory types  
 * - We do NOT interpret sensory types
 * - This UI is observability only - no decision logic
 * 
 * PURPOSE: Display what Sensory Types exist, their current state,
 * live incoming SCUs, and governance status for traceability.
 * 
 * LAYOUT (NON-NEGOTIABLE):
 * TOP: Sensory Receptor Panel - Always show 6 fixed sensory tiles
 * MIDDLE: Live Sensory Signal Feed - Real-time updates, visual style matches sensory type
 * BOTTOM: Governance & Audit Strip - Ghost Pass summary, Senate queue, audit access
 * 
 * LANGUAGE CONTRACT - NO AMBIGUITY:
 * - Sensory Type: One of 6 conceptual channels (VISION, HEARING, TOUCH, BALANCE, SMELL, TASTE)
 * - SCU: One incoming signal payload, belongs to exactly one Sensory Type
 * - Sensory Capsule: Container of multiple SCUs, no logic
 * 
 * ENVIRONMENT MODES:
 * - Sandbox: All 6 sensory types always visible, authority bypassed, zero friction
 * - Production: Sensory Types may be locked if authority required and no token
 */

interface Signal {
  signal_id: string;
  payload_type: 'scu' | 'capsule';
  sensory_type?: string;
  sensory_types?: string[];
  source_id: string;
  timestamp: string;
  received_at: string;
  status: string;
  ghost_pass_approved: boolean;
  signal_data?: any;
  metadata?: any;
  validation_result?: any;
  capsule_id?: string;
  scu_count?: number;
  scus?: any[];
}

interface SensoryCargoMonitorProps {
  onBack: () => void;
}

// Sensory receptor states - matches backend SensoryReceptorStatus
type SensoryState = 'unavailable' | 'available' | 'active';

interface SensoryReceptor {
  type: string;
  name: string;
  state: SensoryState;
  source_authority?: string;
  last_seen_at?: string;
  icon: React.ComponentType<any>;
  authority_required?: boolean;
  locked?: boolean;
  authority_bypassed?: boolean;
  environment_mode?: string;
}

// Environment configuration
interface EnvironmentConfig {
  environment_mode: 'sandbox' | 'production';
  is_sandbox: boolean;
  is_production: boolean;
}

// Live signal feed item for visualization
interface LiveSignalItem {
  id: string;
  sensoryType: string;
  timestamp: string;
  data: any;
  ghostPassStatus: boolean;
  senateStatus: 'pending' | 'approved' | 'escalated';
  originalSignal: Signal;
}

// Governance data interfaces
interface GhostPassSummary {
  total_signals: number;
  by_status: {
    approved: number;
    rejected: number;
  };
}

interface SenateStats {
  pending_count: number;
  escalated_count: number;
}

interface AuditTrailSummary {
  last_decision_timestamp?: string;
  total_events: number;
}

const SENSORY_COLORS = {
  VISION: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: Eye, active: { bg: 'bg-blue-500/60', border: 'border-blue-400/90', text: 'text-blue-100', ring: 'ring-blue-400/60' } },
  HEARING: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', icon: Ear, active: { bg: 'bg-purple-500/60', border: 'border-purple-400/90', text: 'text-purple-100', ring: 'ring-purple-400/60' } },
  TOUCH: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', icon: Hand, active: { bg: 'bg-orange-500/60', border: 'border-orange-400/90', text: 'text-orange-100', ring: 'ring-orange-400/60' } },
  BALANCE: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400', icon: Compass, active: { bg: 'bg-green-500/60', border: 'border-green-400/90', text: 'text-green-100', ring: 'ring-green-400/60' } },
  SMELL: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400', icon: Wind, active: { bg: 'bg-yellow-500/60', border: 'border-yellow-400/90', text: 'text-yellow-100', ring: 'ring-yellow-400/60' } },
  TASTE: { bg: 'bg-pink-500/20', border: 'border-pink-500/50', text: 'text-pink-400', icon: Droplet, active: { bg: 'bg-pink-500/60', border: 'border-pink-400/90', text: 'text-pink-100', ring: 'ring-pink-400/60' } },
};

// Fixed sensory receptors - always present, never conditional
// Status determined by environment mode and authority policies
const SENSORY_RECEPTOR_TEMPLATES: Omit<SensoryReceptor, 'state' | 'locked' | 'authority_required' | 'authority_bypassed'>[] = [
  { type: 'VISION', name: 'Vision', icon: Eye },
  { type: 'HEARING', name: 'Hearing', icon: Ear },
  { type: 'TOUCH', name: 'Touch / Pressure', icon: Hand },
  { type: 'BALANCE', name: 'Balance', icon: Compass },
  { type: 'SMELL', name: 'Smell', icon: Wind },
  { type: 'TASTE', name: 'Taste', icon: Droplet },
];

const SensoryCargoMonitor: React.FC<SensoryCargoMonitorProps> = ({ onBack }) => {
  // State management
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Environment and sensory channel state
  const [environmentConfig, setEnvironmentConfig] = useState<EnvironmentConfig | null>(null);
  const [sensoryReceptors, setSensoryReceptors] = useState<SensoryReceptor[]>([]);
  const [liveSignals, setLiveSignals] = useState<LiveSignalItem[]>([]);
  const [selectedSensoryFilter, setSelectedSensoryFilter] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalSignals, setTotalSignals] = useState(0);
  const SIGNALS_PER_PAGE = 10;

  // Governance & audit data
  const [ghostPassSummary, setGhostPassSummary] = useState<GhostPassSummary | null>(null);
  const [senateStats, setSenateStats] = useState<SenateStats>({ pending_count: 0, escalated_count: 0 });
  const [auditSummary, setAuditSummary] = useState<AuditTrailSummary>({ total_events: 0 });
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);

  // Event handlers - UI interactions only, no business logic
  const onReceptorClick = (type: string) => {
    setSelectedSensoryFilter(selectedSensoryFilter === type ? null : type);
  };

  const onSignalClick = async (signal: LiveSignalItem) => {
    // Log audit entry for signal access
    try {
      await sensoryApi.logAuditEntry({
        signal_id: signal.originalSignal.signal_id,
        sensory_type: signal.sensoryType,
        timestamp: new Date().toISOString(),
        outcome: 'VIEWED',
        metadata: {
          user_action: 'signal_detail_view',
          ghost_pass_status: signal.ghostPassStatus,
          senate_status: signal.senateStatus
        }
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
    
    setSelectedSignal(signal.originalSignal);
  };

  // Group signals by sensory type by default
  const groupedSignals = React.useMemo(() => {
    const filtered = selectedSensoryFilter 
      ? liveSignals.filter(s => s.sensoryType === selectedSensoryFilter)
      : liveSignals;
    
    // Group by sensory type
    const groups: Record<string, LiveSignalItem[]> = {};
    filtered.forEach(signal => {
      if (!groups[signal.sensoryType]) {
        groups[signal.sensoryType] = [];
      }
      groups[signal.sensoryType].push(signal);
    });
    
    return groups;
  }, [liveSignals, selectedSensoryFilter]);

  const getStateColor = (state: SensoryState, receptorType: string) => {
    const baseColor = SENSORY_COLORS[receptorType as keyof typeof SENSORY_COLORS];
    
    switch (state) {
      case 'unavailable': 
        return 'bg-slate-600/50 border-slate-500/50 text-slate-500';
      case 'available': 
        return `${baseColor.bg} ${baseColor.border} ${baseColor.text}`;
      case 'active': 
        return `${baseColor.active.bg} ${baseColor.active.border} ${baseColor.active.text} ring-2 ${baseColor.active.ring} shadow-lg shadow-current/30`;
      default:
        return 'bg-slate-600/50 border-slate-500/50 text-slate-500';
    }
  };

  const getStateIndicator = (state: SensoryState) => {
    switch (state) {
      case 'unavailable': return <XCircle size={12} />;
      case 'available': return <Clock size={12} />;
      case 'active': return <Zap size={12} />;
    }
  };

  const renderSensoryVisualization = (signal: LiveSignalItem) => {
    const sensoryType = signal.sensoryType;
    
    // If no data, show a placeholder
    if (!signal.data) {
      return (
        <div className="w-12 h-8 bg-slate-600/30 border border-slate-500/50 rounded flex items-center justify-center flex-shrink-0">
          <div className="w-2 h-2 bg-slate-500 rounded animate-pulse"></div>
        </div>
      );
    }
    
    switch (sensoryType) {
      case 'VISION':
        // Frame tiles/thumbnails, bounding boxes/contours, confidence overlays, timestamp per frame
        return (
          <div className="w-12 h-8 bg-blue-500/30 border border-blue-500/50 rounded relative flex-shrink-0">
            <div className="absolute inset-1 border border-blue-400/60 rounded"></div>
            <div className="absolute top-1 left-1 w-2 h-1 bg-blue-400 rounded"></div>
            <div className="absolute bottom-1 right-1 w-1 h-1 bg-blue-300 rounded"></div>
            <div className="absolute top-0 right-0 text-xs text-blue-300 bg-blue-900/50 px-1 rounded-bl text-[8px]">
              {new Date(signal.timestamp).getSeconds()}s
            </div>
          </div>
        );
      
      case 'HEARING':
        // Waveform/spectral bars, time-scrolling view, peak indicators
        return (
          <div className="flex space-x-0.5 items-end flex-shrink-0 w-12 h-8 relative">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-purple-400 rounded-t relative" 
                style={{ height: `${Math.random() * 24 + 4}px` }}
              >
                {Math.random() > 0.7 && (
                  <div className="absolute -top-1 left-0 w-1 h-1 bg-purple-200 rounded"></div>
                )}
              </div>
            ))}
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600/30"></div>
          </div>
        );
      
      case 'TOUCH':
        // Threshold bars, gauge meters, binary crossings (above/below limit)
        return (
          <div className="w-12 h-8 bg-orange-500/30 border border-orange-500/50 rounded relative flex-shrink-0">
            <div className="absolute inset-1 bg-gradient-to-r from-orange-600/20 to-orange-400/60 rounded"></div>
            <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-orange-300 rounded"></div>
            <div className="absolute right-2 top-2 w-2 h-1 bg-orange-400 rounded"></div>
            <div className="absolute right-1 bottom-1 text-xs text-orange-300 text-[8px]">
              {Math.random() > 0.5 ? '↑' : '↓'}
            </div>
          </div>
        );
      
      case 'BALANCE':
        // Drift lines, axis movement visualization, stability cone/tilt indicator
        return (
          <div className="w-10 h-10 border border-green-500/50 rounded-full relative flex-shrink-0">
            <div className="absolute inset-2 border border-green-400/30 rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-green-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-green-300/60 transform -translate-x-1/2 -translate-y-1/2 rotate-12"></div>
            <div className="absolute top-2 left-2 w-1 h-1 border-l border-t border-green-300/40"></div>
            <div className="absolute bottom-2 right-2 w-1 h-1 border-r border-b border-green-300/40"></div>
          </div>
        );
      
      case 'SMELL':
        // Anomaly spike graph, confidence decay/risk score trend, event markers
        return (
          <div className="flex space-x-0.5 items-end flex-shrink-0 w-12 h-8 relative">
            {[...Array(6)].map((_, i) => {
              const height = Math.random() * 20 + 2;
              const isSpike = Math.random() > 0.8;
              return (
                <div key={i} className="relative">
                  <div 
                    className={`w-1 rounded-t ${isSpike ? 'bg-yellow-300' : 'bg-yellow-400/60'}`}
                    style={{ height: `${isSpike ? height * 1.5 : height}px` }}
                  ></div>
                  {isSpike && (
                    <div className="absolute -top-1 left-0 w-1 h-1 bg-yellow-200 rounded"></div>
                  )}
                </div>
              );
            })}
            <div className="absolute bottom-0 right-0 text-xs text-yellow-300 text-[8px]">●</div>
          </div>
        );
      
      case 'TASTE':
        // Quality band visualization, acceptance range indicator, pass/fail envelope
        return (
          <div className="w-12 h-8 bg-pink-500/30 border border-pink-500/50 rounded relative flex-shrink-0">
            <div className="absolute inset-1 bg-gradient-to-b from-pink-400/20 via-pink-400/60 to-pink-400/20 rounded"></div>
            <div className="absolute left-1 top-2 right-1 h-0.5 bg-pink-300/80 rounded"></div>
            <div className="absolute left-1 bottom-2 right-1 h-0.5 bg-pink-300/80 rounded"></div>
            <div className="absolute right-1 top-1/2 w-1 h-2 bg-pink-400 rounded transform -translate-y-1/2"></div>
            <div className="absolute top-1 right-1 text-xs text-pink-300 text-[8px]">
              {Math.random() > 0.5 ? '✓' : '✗'}
            </div>
          </div>
        );
      
      default:
        return (
          <div className="w-8 h-8 bg-cyan-500/30 border border-cyan-500/50 rounded flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 bg-cyan-400 rounded"></div>
          </div>
        );
    }
  };

  const fetchSignals = async (page: number = 0, append: boolean = false) => {
    try {
      const offset = page * SIGNALS_PER_PAGE;
      const data = await sensoryApi.getSignals(SIGNALS_PER_PAGE, offset);
      
      // Update sensory receptor states based on recent signals (only for first page)
      if (page === 0) {
        updateSensoryStates(data.signals);
      }
      
      // Convert signals to live feed items
      const liveItems = data.signals.flatMap((signal: Signal) => {
        if (signal.payload_type === 'capsule' && signal.scus && Array.isArray(signal.scus)) {
          // For capsules with multiple sensory types, create separate feed items for each SCU
          return signal.scus.map((scu: any, index: number) => ({
            id: `${signal.signal_id}_${scu.sensory_type}_${index}`,
            sensoryType: scu.sensory_type,
            timestamp: signal.received_at,
            data: scu.signal_data, // Use signal_data from individual SCU
            ghostPassStatus: signal.ghost_pass_approved,
            senateStatus: 'pending' as const,
            originalSignal: signal
          }));
        } else if (signal.payload_type === 'capsule' && signal.sensory_types && Array.isArray(signal.sensory_types)) {
          // Fallback: if scus is not available but sensory_types is, create items without data
          return signal.sensory_types.map((sensoryType: string, index: number) => ({
            id: `${signal.signal_id}_${sensoryType}_${index}`,
            sensoryType: sensoryType,
            timestamp: signal.received_at,
            data: null, // No data available
            ghostPassStatus: signal.ghost_pass_approved,
            senateStatus: 'pending' as const,
            originalSignal: signal
          }));
        } else if (signal.payload_type === 'scu') {
          // For single SCUs
          return [{
            id: signal.signal_id,
            sensoryType: signal.sensory_type || 'UNKNOWN',
            timestamp: signal.received_at,
            data: signal.signal_data, // Use signal_data from backend
            ghostPassStatus: signal.ghost_pass_approved,
            senateStatus: 'pending' as const,
            originalSignal: signal
          }];
        } else {
          // Fallback for unknown types
          return [];
        }
      });
      
      if (append) {
        setLiveSignals(prev => [...prev, ...liveItems]);
      } else {
        setLiveSignals(liveItems);
      }
      
      // Update pagination state
      const actualHasMore = data.has_more !== undefined ? data.has_more : (data.signals.length === SIGNALS_PER_PAGE);
      setHasMore(actualHasMore);
      setTotalSignals(data.total || 0);
      
    } catch (error) {
      console.error('Failed to fetch signals:', error);
    }
  };

  // Load more signals (pagination)
  const loadMoreSignals = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    await fetchSignals(nextPage, true);
    setCurrentPage(nextPage);
    setLoadingMore(false);
  };

  const fetchGovernanceData = async () => {
    try {
      // Fetch Ghost Pass summary
      const ghostPassData = await sensoryApi.getStats();
      setGhostPassSummary(ghostPassData);

      // Fetch Senate statistics
      const senateData = await sensoryApi.getSenateStats();
      setSenateStats(senateData);

      // Fetch audit summary (last decision timestamp)
      const historyData = await sensoryApi.getSenateHistory(1);
      if (historyData.decisions && historyData.decisions.length > 0) {
        setAuditSummary({
          last_decision_timestamp: historyData.decisions[0].timestamp,
          total_events: historyData.total_count || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch governance data:', error);
      // Set fallback values to prevent UI errors
      setGhostPassSummary(null);
      setSenateStats({ pending_count: 0, escalated_count: 0 });
      setAuditSummary({ total_events: 0 });
    }
  };
  // Update sensory receptor states based on recent signal activity
  const updateSensoryStates = (signals: Signal[]) => {
    const recentSignals = signals.filter(s => {
      const signalTime = new Date(s.received_at);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return signalTime > fiveMinutesAgo;
    });

    const activeSensoryTypes = new Set<string>();
    recentSignals.forEach(signal => {
      if (signal.payload_type === 'capsule' && signal.scus) {
        // For capsules, get sensory types from individual SCUs
        signal.scus.forEach((scu: any) => {
          if (scu.sensory_type) {
            activeSensoryTypes.add(scu.sensory_type);
          }
        });
      } else if (signal.sensory_type) {
        // For single SCUs
        activeSensoryTypes.add(signal.sensory_type);
      }
    });

    setSensoryReceptors(prev => prev.map(receptor => {
      const isActive = activeSensoryTypes.has(receptor.type);
      let last_seen_at = receptor.last_seen_at;
      
      if (isActive) {
        // Find the most recent signal for this sensory type
        const recentSignal = recentSignals.find(s => {
          if (s.payload_type === 'capsule' && s.scus) {
            return s.scus.some((scu: any) => scu.sensory_type === receptor.type);
          } else {
            return s.sensory_type === receptor.type;
          }
        });
        if (recentSignal) {
          last_seen_at = recentSignal.received_at;
        }
      }
      
      return {
        ...receptor,
        state: isActive ? 'active' : 'available',
        last_seen_at
      };
    }));
  };

  // Initialize data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setCurrentPage(0);
      await Promise.all([
        fetchSignals(0, false), 
        fetchGovernanceData(),
        loadEnvironmentConfig()
      ]);
      setLoading(false);
    };

    loadData();
    setLastRefreshTime(new Date().toISOString());
  }, []);

  // Load environment configuration and sensory channel status
  const loadEnvironmentConfig = async () => {
    try {
      // Get environment mode
      const envConfig = await environmentApi.getMode();
      setEnvironmentConfig(envConfig);

      // Get sensory channel statuses
      const channelsResponse = await environmentApi.getSensoryChannels();

      // Build sensory receptors with environment-aware status
      const receptors = SENSORY_RECEPTOR_TEMPLATES.map(template => {
        const channelStatus = channelsResponse.sensory_channels[template.type];
        return {
          ...template,
          state: (channelStatus?.available ? 'available' : 'unavailable') as SensoryState,
          authority_required: channelStatus?.authority_required || false,
          locked: channelStatus?.locked || false,
          authority_bypassed: channelStatus?.authority_bypassed || false,
          environment_mode: channelStatus?.environment_mode || 'sandbox'
        };
      });
      setSensoryReceptors(receptors);

    } catch (error) {
      console.error('Failed to load environment configuration:', error);
      // Fallback to default receptors
      const defaultReceptors = SENSORY_RECEPTOR_TEMPLATES.map(template => ({
        ...template,
        state: 'available' as SensoryState,
        authority_required: false,
        locked: false,
        authority_bypassed: true,
        environment_mode: 'sandbox'
      }));
      setSensoryReceptors(defaultReceptors);
    }
  };

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setCurrentPage(0);
      await Promise.all([
        fetchSignals(0, false), 
        fetchGovernanceData(),
        loadEnvironmentConfig()
      ]);
      setLastRefreshTime(new Date().toISOString());
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400">Loading Sensory Cargo Monitor...</p>
        </div>
      </div>
    );
  }

  // Signal Detail View
  if (selectedSignal) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-2 sm:p-4 lg:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
            <motion.button
              onClick={() => setSelectedSignal(null)}
              className="glass-panel p-2 sm:p-3 hover:border-cyan-500/50 transition-all flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="text-cyan-400" size={18} />
            </motion.button>
            <div className="min-w-0 flex-1">
              <h1 className="heading-primary text-xl sm:text-2xl truncate">Signal Details</h1>
              <p className="label-tactical text-xs sm:text-sm truncate">Full SCU information and validation results</p>
            </div>
          </div>

          {/* Status Banner */}
          <Card className={`glass-card mb-4 sm:mb-6 ${selectedSignal.ghost_pass_approved ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  {selectedSignal.ghost_pass_approved ? (
                    <CheckCircle className="text-emerald-400 flex-shrink-0" size={24} />
                  ) : (
                    <XCircle className="text-red-400 flex-shrink-0" size={24} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-lg sm:text-xl font-bold ${selectedSignal.ghost_pass_approved ? 'text-emerald-400' : 'text-red-400'}`}>
                      {selectedSignal.ghost_pass_approved ? 'Ghost Pass Approved' : 'Ghost Pass Rejected'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      {selectedSignal.ghost_pass_approved ? 'Signal forwarded to Senate' : 'Signal blocked by validation'}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="label-tactical text-xs sm:text-sm">Status</p>
                  <p className="data-mono text-sm sm:text-base">{selectedSignal.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SCU Metadata */}
          <Card className="glass-card mb-4 sm:mb-6">
            <CardHeader>
              <CardTitle className="heading-primary text-lg sm:text-xl">SCU Metadata</CardTitle>
              <p className="label-tactical text-sm">Complete signal information and validation results</p>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="label-tactical text-xs sm:text-sm">SCU ID</p>
                  <p className="data-mono text-xs sm:text-sm break-all">{selectedSignal.signal_id}</p>
                </div>
                <div>
                  <p className="label-tactical text-xs sm:text-sm">Sensory Type</p>
                  <p className="data-mono text-sm sm:text-base">
                    {selectedSignal.payload_type === 'capsule' 
                      ? selectedSignal.sensory_types?.join(', ') || 'Multiple'
                      : selectedSignal.sensory_type || 'Unknown'
                    }
                  </p>
                </div>
                <div>
                  <p className="label-tactical text-xs sm:text-sm">Source ID</p>
                  <p className="data-mono text-sm sm:text-base">{selectedSignal.source_id}</p>
                </div>
                <div>
                  <p className="label-tactical text-xs sm:text-sm">Payload Type</p>
                  <p className="data-mono text-sm sm:text-base uppercase">{selectedSignal.payload_type}</p>
                </div>
                <div>
                  <p className="label-tactical text-xs sm:text-sm">Timestamp</p>
                  <p className="data-mono text-xs sm:text-sm">{formatTimestamp(selectedSignal.timestamp)}</p>
                </div>
                <div>
                  <p className="label-tactical text-xs sm:text-sm">Received At</p>
                  <p className="data-mono text-xs sm:text-sm">{formatTimestamp(selectedSignal.received_at)}</p>
                </div>
                {selectedSignal.metadata?.integrity_hash && (
                  <div className="sm:col-span-2">
                    <p className="label-tactical text-xs sm:text-sm">Payload Hash</p>
                    <p className="data-mono text-xs break-all">{selectedSignal.metadata.integrity_hash}</p>
                  </div>
                )}
              </div>
              
              {/* Ghost Pass Validation Status */}
              <div className="border-t border-slate-700 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="label-tactical text-xs sm:text-sm">Ghost Pass Validation</p>
                    <div className="flex items-center space-x-2">
                      {selectedSignal.ghost_pass_approved ? (
                        <CheckCircle className="text-emerald-400" size={16} />
                      ) : (
                        <XCircle className="text-red-400" size={16} />
                      )}
                      <span className={`text-sm font-semibold ${selectedSignal.ghost_pass_approved ? 'text-emerald-400' : 'text-red-400'}`}>
                        {selectedSignal.ghost_pass_approved ? 'APPROVED' : 'REJECTED'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="label-tactical text-xs sm:text-sm">Senate Status</p>
                    <div className="flex items-center space-x-2">
                      <Scale className="text-purple-400" size={16} />
                      <span className="text-sm text-purple-400 uppercase">
                        {selectedSignal.ghost_pass_approved ? 'Pending Evaluation' : 'Blocked'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signal Data */}
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="heading-primary">Signal Data</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSignal.payload_type === 'capsule' && selectedSignal.scus ? (
                // For capsules, show all SCU data
                <div className="space-y-4">
                  {selectedSignal.scus.map((scu: any, index: number) => (
                    <div key={index} className="border border-slate-700 rounded p-4">
                      <h4 className="text-sm font-semibold text-cyan-400 mb-2">
                        SCU {index + 1}: {scu.sensory_type}
                      </h4>
                      <pre className="p-4 bg-slate-950/50 rounded text-sm overflow-x-auto">
                        {JSON.stringify(scu.signal_data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                // For single SCUs, show the signal data directly
                <pre className="p-4 bg-slate-950/50 rounded text-sm overflow-x-auto">
                  {JSON.stringify(selectedSignal.signal_data, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {selectedSignal.validation_result && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="heading-primary">Validation Results</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-slate-950/50 rounded text-sm overflow-x-auto">
                  {JSON.stringify(selectedSignal.validation_result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={onBack}
              className="glass-panel p-3 hover:border-cyan-500/50 transition-all flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="text-cyan-400" size={20} />
            </motion.button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-3">
                <h1 className="heading-primary text-2xl sm:text-2xl lg:text-3xl">Sensory Cargo Monitor</h1>
                {environmentConfig && (
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${
                    environmentConfig.is_sandbox 
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  }`}>
                    {environmentConfig.environment_mode.toUpperCase()}
                  </div>
                )}
              </div>
              <p className="label-tactical text-sm">
                Observability surface for sensory governance
                {environmentConfig && (
                  <span className="ml-2 text-slate-500">
                    • {environmentConfig.is_sandbox ? 'Full observability, zero friction' : 'Policy-enforced locking'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4">
            {lastRefreshTime && (
              <div className="text-xs text-slate-500">
                Last updated: {getTimeAgo(lastRefreshTime)}
              </div>
            )}
            <motion.button
              onClick={handleRefresh}
              disabled={refreshing}
              className="glass-panel px-4 py-2 hover:border-cyan-500/50 transition-all"
              whileHover={{ scale: refreshing ? 1 : 1.05 }}
              whileTap={{ scale: refreshing ? 1 : 0.95 }}
              title="Refresh data"
            >
              <div className="flex items-center space-x-2">
                {refreshing ? (
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span className="text-sm text-cyan-400">
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </span>
              </div>
            </motion.button>
          </div>
        </div>

        {/* TOP SECTION - Sensory Receptor Panel */}
        <Card className="glass-card mb-6">
          <CardHeader>
            <CardTitle className="heading-primary text-lg">Sensory Receptor Panel</CardTitle>
            <p className="label-tactical text-sm">6 fixed Sensory Types and their current state</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {sensoryReceptors.map((receptor) => {
                const Icon = receptor.icon;
                const isSelected = selectedSensoryFilter === receptor.type;
                const stateColor = getStateColor(receptor.state, receptor.type);
                const stateIndicator = getStateIndicator(receptor.state);
                
                return (
                  <motion.button
                    key={receptor.type}
                    onClick={() => receptor.locked ? null : onReceptorClick(receptor.type)}
                    className={`glass-panel p-4 transition-all ${stateColor} ${
                      isSelected ? 'ring-2 ring-cyan-400/50' : ''
                    } ${receptor.locked ? 'cursor-not-allowed opacity-75' : ''} ${
                      receptor.authority_required ? 'border-orange-500/50' : ''
                    }`}
                    whileHover={{ scale: receptor.locked ? 1 : 1.02 }}
                    whileTap={{ scale: receptor.locked ? 1 : 0.98 }}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="relative">
                        <Icon size={24} />
                        {receptor.locked && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-sm">{receptor.name}</p>
                        <div className="flex items-center justify-center space-x-1 mt-1">
                          {stateIndicator}
                          <span className="text-xs capitalize">{receptor.state}</span>
                        </div>
                        
                        {/* Environment-aware status display */}
                        {receptor.authority_required && (
                          <div className="mt-1">
                            {receptor.authority_bypassed ? (
                              <p className="text-xs text-yellow-400">Authority Required (Sandbox: bypassed)</p>
                            ) : (
                              <p className="text-xs text-orange-400">Authority Required</p>
                            )}
                          </div>
                        )}
                        
                        {receptor.locked && (
                          <p className="text-xs text-red-400 mt-1">Locked</p>
                        )}
                        
                        {receptor.last_seen_at && receptor.state === 'active' && (
                          <p className="text-xs mt-1 opacity-75">
                            {getTimeAgo(receptor.last_seen_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* MIDDLE SECTION - Live Sensory Signal Feed */}
        <Card className="glass-card mb-6">
          <CardHeader>
            <CardTitle className="heading-primary text-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="text-cyan-400" size={20} />
                <span>Live Sensory Signal Feed</span>
                {selectedSensoryFilter && (
                  <span className="text-sm text-slate-400">
                    - Filtered by {selectedSensoryFilter}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400">
                {totalSignals > 0 && (
                  <span>
                    {liveSignals.length} live feeds from {totalSignals} signals
                  </span>
                )}
              </div>
            </CardTitle>
            <p className="label-tactical text-sm">
              Real-time SCU events • 
              {totalSignals > 0 && (
                <span className="ml-1">
                  {totalSignals} SCUs received
                  {selectedSensoryFilter && ` • Filtered by ${selectedSensoryFilter} channel`}
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {Object.keys(groupedSignals).length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="text-slate-400 mx-auto mb-4" size={48} />
                <p className="text-slate-400 text-lg mb-2">
                  {selectedSensoryFilter ? `No SCUs from ${selectedSensoryFilter} channel` : 'No active SCU events'}
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  Live SCU events will appear here as they are received and processed
                </p>
                <div className="text-xs text-slate-600 bg-slate-800/50 rounded p-3 max-w-md mx-auto">
                  <p className="font-semibold mb-1">Monitor Status:</p>
                  <p>This monitor displays incoming sensory data for visibility and traceability.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-h-96 overflow-y-auto overflow-x-hidden">
                {Object.entries(groupedSignals).map(([sensoryType, signals]) => (
                  <div key={sensoryType} className="space-y-3">
                    {/* Sensory Type Header */}
                    <div className="flex items-center space-x-3 pb-2 border-b border-slate-700/50">
                      <div className={`w-3 h-3 rounded-full ${getSensoryColor(sensoryType).bg.replace('/20', '/60')}`}></div>
                      <h3 className={`font-semibold text-lg ${getSensoryColor(sensoryType).text}`}>
                        {sensoryType} Channel
                      </h3>
                      <span className="text-sm text-slate-400">
                        ({signals.length} SCU{signals.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    
                    {/* Signals in this channel */}
                    <AnimatePresence>
                      {signals.map((signal, index) => {
                        const color = getSensoryColor(signal.sensoryType);
                        
                        return (
                          <motion.div
                            key={signal.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => onSignalClick(signal)}
                            className={`glass-panel p-4 cursor-pointer transition-colors hover:border-cyan-500/50 ${color.border} border-l-4 ml-6`}
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                {renderSensoryVisualization(signal)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3">
                                  <span className="text-sm text-slate-400">
                                    {getTimeAgo(signal.timestamp)}
                                  </span>
                                </div>
                                
                                <div className="flex items-center space-x-4 mt-1">
                                  <div className="flex items-center space-x-1">
                                    {signal.ghostPassStatus ? (
                                      <CheckCircle className="text-emerald-400" size={16} />
                                    ) : (
                                      <XCircle className="text-red-400" size={16} />
                                    )}
                                    <span className="text-sm text-slate-300">Ghost Pass</span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <Scale size={16} />
                                    <span className="text-sm text-slate-300 capitalize">{signal.senateStatus}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ))}
                
                {/* Load More Button */}
                {hasMore && !selectedSensoryFilter && (
                  <div className="flex justify-center pt-4">
                    <motion.button
                      onClick={loadMoreSignals}
                      disabled={loadingMore}
                      className="glass-panel px-6 py-3 hover:border-cyan-500/50 transition-all"
                      whileHover={{ scale: loadingMore ? 1 : 1.05 }}
                      whileTap={{ scale: loadingMore ? 1 : 0.95 }}
                    >
                      <div className="flex items-center space-x-2">
                        {loadingMore ? (
                          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <BarChart3 className="text-cyan-400" size={16} />
                        )}
                        <span className="text-cyan-400">
                          {loadingMore ? 'Loading...' : 'Load More Signals'}
                        </span>
                      </div>
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* BOTTOM SECTION - Governance & Audit Strip */}
        <Card className="glass-card border-purple-500/30">
          <CardHeader>
            <CardTitle className="heading-primary text-lg flex items-center space-x-2">
              <Shield className="text-purple-400" size={20} />
              <span>Governance & Audit Status</span>
            </CardTitle>
            <p className="label-tactical text-sm">System status and traceability overview</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ghost Pass Validation Summary */}
              <div className="glass-panel p-4 border-l-4 border-emerald-500/50">
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className="text-emerald-400" size={16} />
                  <span className="font-semibold text-emerald-400">Ghost Pass Summary</span>
                </div>
                {ghostPassSummary ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Approved:</span>
                      <span className="text-emerald-400">{ghostPassSummary.by_status?.approved || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rejected:</span>
                      <span className="text-red-400">{ghostPassSummary.by_status?.rejected || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total:</span>
                      <span className="text-cyan-400">{ghostPassSummary.total_signals || 0}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Loading validation data...</div>
                )}
              </div>

              {/* Senate Queue Status */}
              <div className="glass-panel p-4 border-l-4 border-purple-500/50">
                <div className="flex items-center space-x-2 mb-2">
                  <Scale className="text-purple-400" size={16} />
                  <span className="font-semibold text-purple-400">Senate Queue Status</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pending:</span>
                    <span className={`font-bold ${senateStats.pending_count > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {senateStats.pending_count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Escalated:</span>
                    <span className={`font-bold ${senateStats.escalated_count > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {senateStats.escalated_count}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {senateStats.pending_count === 0 ? 'All signals reviewed' : `${senateStats.pending_count} awaiting decision`}
                  </div>
                </div>
              </div>

              {/* Audit Trail Access */}
              <div className="glass-panel p-4 border-l-4 border-cyan-500/50">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="text-cyan-400" size={16} />
                  <span className="font-semibold text-cyan-400">Audit Trail Access</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Decision:</span>
                    <span className="text-cyan-400">
                      {auditSummary.last_decision_timestamp ? getTimeAgo(auditSummary.last_decision_timestamp) : 'None'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Full audit trail available
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
// Utility functions
function getSensoryColor(type: string) {
  return SENSORY_COLORS[type as keyof typeof SENSORY_COLORS] || {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/50',
    text: 'text-cyan-400'
  };
}

function getTimeAgo(timestamp: string) {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default SensoryCargoMonitor;