import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, Ear, Hand, Compass, Wind, Droplet, 
  CheckCircle, XCircle, Clock, ArrowLeft, Package,
  Activity, TrendingUp, AlertCircle, Shield, Scale, Send, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface Evaluation {
  evaluation_id: string;
  signal_id: string;
  signal_data: any;
  status: string;
  priority: string;
  received_at: string;
  context: {
    source_id: string;
    payload_type: string;
    sensory_types: string[];
    timestamp: string;
  };
  applicable_policies?: any[];
}

interface Decision {
  decision_id: string;
  signal_id: string;
  decision: string;
  reason: string;
  reviewer_id: string;
  trust_score?: number;
  timestamp: string;
  context: any;
}

interface SensoryCargoMonitorProps {
  onBack: () => void;
}

const SENSORY_COLORS = {
  VISION: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: Eye },
  HEARING: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', icon: Ear },
  TOUCH: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', icon: Hand },
  BALANCE: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400', icon: Compass },
  SMELL: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400', icon: Wind },
  TASTE: { bg: 'bg-pink-500/20', border: 'border-pink-500/50', text: 'text-pink-400', icon: Droplet },
};

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' },
  medium: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  normal: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
};

const SensoryCargoMonitor: React.FC<SensoryCargoMonitorProps> = ({ onBack }) => {
  const [view, setView] = useState<'signals' | 'senate-pending' | 'senate-review' | 'senate-history' | 'test-injector'>('signals');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Disable auto-refresh for now
  // const [autoRefresh, setAutoRefresh] = useState(false);
  // Disable realtime for now
  // const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  // const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Check if in development mode
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

  // Senate state
  const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [senateHistory, setSenateHistory] = useState<Decision[]>([]);
  const [senateStats, setSenateStats] = useState<any>(null);
  
  // Decision form state
  const [decision, setDecision] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [trustScore, setTrustScore] = useState<number>(75);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingEvaluationId, setReviewingEvaluationId] = useState<string | null>(null);

  // Test Injector state
  const [injectorMode, setInjectorMode] = useState<'single' | 'capsule'>('single');
  const [singleSCU, setSingleSCU] = useState({
    sensory_type: 'VISION',
    signal_data: '{\n  "objects_detected": ["person", "vehicle"],\n  "confidence_scores": [0.95, 0.87],\n  "scene": "urban_street"\n}',
    source_id: 'test_sensor_01'
  });
  const [capsuleSourceId, setCapsuleSourceId] = useState('sensor_hub_test');
  const [capsuleSCUs, setCapsuleSCUs] = useState([
    {
      id: '1',
      sensory_type: 'VISION',
      signal_data: '{\n  "objects_detected": ["person", "vehicle"],\n  "confidence_scores": [0.95, 0.87],\n  "scene": "urban_street"\n}',
      source_id: 'sensor_hub_test'
    }
  ]);
  const [injectorResponse, setInjectorResponse] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [injectorLoading, setInjectorLoading] = useState(false);

  const fetchSignals = async () => {
    try {
      const response = await fetch('http://localhost:8000/sensory-monitor/signals?limit=50');
      const data = await response.json();
      setSignals(data.signals);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/sensory-monitor/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Real-time WebSocket callbacks (disabled for now)
  // const handleSignalChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
  //   console.log('[REALTIME] Signal change:', payload);
  //   
  //   if (payload.eventType === 'INSERT') {
  //     // Add new signal to the list
  //     setSignals(prev => [payload.new, ...prev]);
  //     // Refresh stats to get updated counts
  //     fetchStats();
  //   } else if (payload.eventType === 'UPDATE') {
  //     // Update existing signal
  //     setSignals(prev => prev.map(signal => 
  //       signal.signal_id === payload.new.signal_id ? payload.new : signal
  //     ));
  //     fetchStats();
  //   } else if (payload.eventType === 'DELETE') {
  //     // Remove deleted signal
  //     setSignals(prev => prev.filter(signal => signal.signal_id !== payload.old.signal_id));
  //     fetchStats();
  //   }
  // }, []);

  // const handleEvaluationChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
  //   console.log('[REALTIME] Evaluation change:', payload);
  //   
  //   if (payload.eventType === 'INSERT') {
  //     // Add new evaluation to pending list
  //     setPendingEvaluations(prev => [payload.new, ...prev]);
  //     fetchSenateStats();
  //   } else if (payload.eventType === 'UPDATE') {
  //     // Update existing evaluation
  //     setPendingEvaluations(prev => prev.map(evaluation => 
  //       evaluation.evaluation_id === payload.new.evaluation_id ? payload.new : evaluation
  //     ));
  //     fetchSenateStats();
  //   } else if (payload.eventType === 'DELETE') {
  //     // Remove evaluation from pending (likely moved to decisions)
  //     setPendingEvaluations(prev => prev.filter(evaluation => 
  //       evaluation.evaluation_id !== payload.old.evaluation_id
  //     ));
  //     fetchSenateStats();
  //   }
  // }, []);

  // const handleDecisionChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
  //   console.log('[REALTIME] Decision change:', payload);
  //   
  //   if (payload.eventType === 'INSERT') {
  //     // Add new decision to history
  //     setSenateHistory(prev => [payload.new, ...prev]);
  //     fetchSenateStats();
  //   }
  // }, []);

  // Setup real-time WebSocket connections (disabled for now)
  // useSensorySystemRealtime({
  //   onSignalChange: handleSignalChange,
  //   onEvaluationChange: handleEvaluationChange,
  //   onDecisionChange: handleDecisionChange,
  // }, {
  //   enabled: realtimeEnabled,
  //   onConnectionChange: (connected) => {
  //     setRealtimeConnected(connected);
  //     console.log(`[REALTIME] Connection status changed: ${connected ? 'Connected' : 'Disconnected'}`);
  //   },
  //   onError: (error) => {
  //     console.error('[REALTIME] WebSocket error:', error);
  //     // Could show a toast notification here
  //   }
  // });

  const fetchSenatePending = async () => {
    try {
      const response = await fetch('http://localhost:8000/senate/pending');
      const data = await response.json();
      setPendingEvaluations(data.evaluations);
    } catch (error) {
      console.error('Failed to fetch pending evaluations:', error);
    }
  };

  const fetchSenateHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/senate/history');
      const data = await response.json();
      setSenateHistory(data.decisions);
    } catch (error) {
      console.error('Failed to fetch senate history:', error);
    }
  };

  const fetchSenateStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/senate/stats');
      const data = await response.json();
      setSenateStats(data);
    } catch (error) {
      console.error('Failed to fetch senate stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSignals(), fetchStats(), fetchSenatePending(), fetchSenateStats()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh disabled for now
    // const interval = setInterval(() => {
    //   if (autoRefresh) {
    //     handleRefresh();
    //   }
    // }, 3000);

    // return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSignals(), fetchStats(), fetchSenatePending(), fetchSenateStats()]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSenateReview = async (evaluation: Evaluation) => {
    setReviewingEvaluationId(evaluation.evaluation_id);
    
    try {
      const response = await fetch(`http://localhost:8000/senate/pending/${evaluation.evaluation_id}`);
      const data = await response.json();
      setSelectedEvaluation(data);
      setView('senate-review');
      setDecision('');
      setReason('');
      setTrustScore(75);
    } catch (error) {
      console.error('Failed to fetch evaluation details:', error);
    } finally {
      setReviewingEvaluationId(null);
    }
  };

  const handleSubmitDecision = async () => {
    if (!selectedEvaluation || !decision || !reason) return;

    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/senate/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_id: selectedEvaluation.signal_id,
          decision,
          reason,
          reviewer_id: 'admin_user',
          trust_score: trustScore / 100
        })
      });

      if (response.ok) {
        await Promise.all([fetchSenatePending(), fetchSenateHistory(), fetchSenateStats()]);
        setView('senate-pending');
        setSelectedEvaluation(null);
      }
    } catch (error) {
      console.error('Failed to submit decision:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to match Python's JSON serialization (sorted keys, no spaces)
  const serializeForHash = (obj: any): string => {
    if (obj === null) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      return '[' + obj.map(serializeForHash).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${serializeForHash(obj[key])}`);
    return '{' + pairs.join(',') + '}';
  };

  // Test Injector handlers
  const handleSendSingle = async () => {
    setInjectorLoading(true);
    setInjectorResponse(null);

    try {
      const signalData = JSON.parse(singleSCU.signal_data);
      const payload = {
        schema_version: '1.0.0',
        sensory_type: singleSCU.sensory_type,
        signal_data: signalData,
        metadata: {
          timestamp: new Date().toISOString(),
          source_id: singleSCU.source_id,
          integrity_hash: '0'.repeat(64)
        }
      };

      // Match Python's JSON formatting: no spaces, sorted keys
      const hashInput = `${payload.sensory_type}:${payload.metadata.source_id}:${serializeForHash(signalData)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      payload.metadata.integrity_hash = hashHex;

      const res = await fetch('http://localhost:8000/conduit/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        setInjectorResponse({ success: true, message: 'Signal sent successfully!', data: result });
        // Refresh signals
        await fetchSignals();
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => setInjectorResponse(null), 3000);
      } else {
        setInjectorResponse({ success: false, message: result.detail?.message || 'Failed to send signal', data: result });
        
        // Auto-dismiss errors after 5 seconds
        setTimeout(() => setInjectorResponse(null), 5000);
      }
    } catch (error: any) {
      setInjectorResponse({ success: false, message: error.message || 'Error sending signal' });
      setTimeout(() => setInjectorResponse(null), 5000);
    } finally {
      setInjectorLoading(false);
    }
  };

  const handleSendCapsule = async () => {
    setInjectorLoading(true);
    setInjectorResponse(null);

    try {
      const scus = await Promise.all(capsuleSCUs.map(async (scu) => {
        const signalData = JSON.parse(scu.signal_data);
        const scuPayload = {
          schema_version: '1.0.0',
          sensory_type: scu.sensory_type,
          signal_data: signalData,
          metadata: {
            timestamp: new Date().toISOString(),
            source_id: scu.source_id,
            integrity_hash: '0'.repeat(64)
          }
        };

        // Match Python's JSON formatting: no spaces, sorted keys
        const hashInput = `${scuPayload.sensory_type}:${scuPayload.metadata.source_id}:${serializeForHash(signalData)}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(hashInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        scuPayload.metadata.integrity_hash = hashHex;

        return scuPayload;
      }));

      const capsulePayload = {
        capsule_id: `test_capsule_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source_id: capsuleSourceId,
        scus: scus
      };

      const res = await fetch('http://localhost:8000/conduit/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capsulePayload)
      });

      const result = await res.json();

      if (res.ok) {
        setInjectorResponse({ success: true, message: `Capsule with ${scus.length} SCUs sent successfully!`, data: result });
        await fetchSignals();
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => setInjectorResponse(null), 3000);
      } else {
        setInjectorResponse({ success: false, message: result.detail?.message || 'Failed to send capsule', data: result });
        
        // Auto-dismiss errors after 5 seconds
        setTimeout(() => setInjectorResponse(null), 5000);
      }
    } catch (error: any) {
      setInjectorResponse({ success: false, message: error.message || 'Error sending capsule' });
      setTimeout(() => setInjectorResponse(null), 5000);
    } finally {
      setInjectorLoading(false);
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

  // Senate Review Workspace
  if (view === 'senate-review' && selectedEvaluation) {
    return (
      <SenateReviewWorkspace
        evaluation={selectedEvaluation}
        decision={decision}
        setDecision={setDecision}
        reason={reason}
        setReason={setReason}
        trustScore={trustScore}
        setTrustScore={setTrustScore}
        submitting={submitting}
        onSubmit={handleSubmitDecision}
        onBack={() => setView('senate-pending')}
      />
    );
  }

  // Signal Detail View
  if (selectedSignal) {
    return <SignalDetailView signal={selectedSignal} onBack={() => setSelectedSignal(null)} />;
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
              <h1 className="heading-primary text-2xl sm:text-2xl lg:text-3xl">Sensory Cargo Monitor</h1>
              <p className="label-tactical text-sm">Real-time signal feed and Senate evaluation</p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            {/* Refresh Button */}
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

        {/* View Tabs */}
        <div className="flex flex-wrap gap-2 sm:gap-2 mb-6 overflow-x-auto pb-1">
          <motion.button
            onClick={() => setView('signals')}
            className={`glass-panel px-4 py-3 sm:px-4 sm:py-2 transition-all whitespace-nowrap flex-shrink-0 ${
              view === 'signals' ? 'border-cyan-500/50 bg-cyan-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className={`text-sm ${view === 'signals' ? 'text-cyan-400' : 'text-slate-400'}`}>Signal Feed</span>
          </motion.button>
          
          <motion.button
            onClick={() => setView('senate-pending')}
            className={`glass-panel px-4 py-3 sm:px-4 sm:py-2 transition-all whitespace-nowrap flex-shrink-0 ${
              view === 'senate-pending' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center space-x-2">
              <Scale className={view === 'senate-pending' ? 'text-purple-400' : 'text-slate-400'} size={14} />
              <span className={`text-sm ${view === 'senate-pending' ? 'text-purple-400' : 'text-slate-400'}`}>
                Senate Pending {senateStats && senateStats.pending_count > 0 && `(${senateStats.pending_count})`}
              </span>
            </div>
          </motion.button>

          <motion.button
            onClick={() => {
              setView('senate-history');
              fetchSenateHistory();
            }}
            className={`glass-panel px-4 py-3 sm:px-4 sm:py-2 transition-all whitespace-nowrap flex-shrink-0 ${
              view === 'senate-history' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className={`text-sm ${view === 'senate-history' ? 'text-purple-400' : 'text-slate-400'}`}>Senate History</span>
          </motion.button>

          {/* Test Injector Tab (Dev Only) */}
          {isDevelopment && (
            <motion.button
              onClick={() => setView('test-injector')}
              className={`glass-panel px-4 py-3 sm:px-4 sm:py-2 transition-all whitespace-nowrap flex-shrink-0 ${
                view === 'test-injector' ? 'border-yellow-500/50 bg-yellow-500/10' : 'hover:border-white/20'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center space-x-2">
                <Send className={view === 'test-injector' ? 'text-yellow-400' : 'text-slate-400'} size={14} />
                <span className={`text-sm ${view === 'test-injector' ? 'text-yellow-400' : 'text-slate-400'}`}>
                  Test Injector [DEV]
                </span>
              </div>
            </motion.button>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="label-tactical text-xs leading-tight">Total Signals</p>
                    <TrendingUp className="text-cyan-400 flex-shrink-0" size={16} />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-cyan-400">{stats.total_signals}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="label-tactical text-xs leading-tight">Approved</p>
                    <CheckCircle className="text-emerald-400 flex-shrink-0" size={16} />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                    {stats.by_status?.approved || 0}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="label-tactical text-xs leading-tight">Rejected</p>
                    <XCircle className="text-red-400 flex-shrink-0" size={16} />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-red-400">
                    {stats.by_status?.rejected || 0}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="label-tactical text-xs leading-tight">Capsules</p>
                    <Package className="text-purple-400 flex-shrink-0" size={16} />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-purple-400">
                    {signals.filter(s => s.payload_type === 'capsule').length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Signal Feed */}
      <div className="max-w-7xl mx-auto">
        {view === 'signals' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="heading-primary flex items-center space-x-2">
                <Activity className="text-cyan-400" size={20} />
                <span>Live Signal Feed</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {signals.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="text-slate-400 mx-auto mb-4" size={48} />
                  <p className="text-slate-400">No signals received yet</p>
                  <p className="text-sm text-slate-500 mt-2">Signals will appear here as they arrive</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {signals.map((signal, index) => (
                      <SignalCard
                        key={signal.signal_id}
                        signal={signal}
                        index={index}
                        onClick={() => setSelectedSignal(signal)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Senate Pending */}
        {view === 'senate-pending' && (
          <Card className="glass-card border-purple-500/30">
            <CardHeader>
              <CardTitle className="heading-primary flex items-center space-x-2">
                <Shield className="text-purple-400" size={20} />
                <span>Senate Pending Evaluation</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingEvaluations.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="text-slate-400 mx-auto mb-4" size={48} />
                  <p className="text-slate-400">No pending evaluations</p>
                  <p className="text-sm text-slate-500 mt-2">All signals have been reviewed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingEvaluations.map((evaluation, index) => (
                    <SenateEvaluationCard
                      key={evaluation.evaluation_id}
                      evaluation={evaluation}
                      index={index}
                      onReview={() => handleSenateReview(evaluation)}
                      isLoading={reviewingEvaluationId === evaluation.evaluation_id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Senate History */}
        {view === 'senate-history' && (
          <Card className="glass-card border-purple-500/30">
            <CardHeader>
              <CardTitle className="heading-primary flex items-center space-x-2">
                <Scale className="text-purple-400" size={20} />
                <span>Senate Decision History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {senateHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Scale className="text-slate-400 mx-auto mb-4" size={48} />
                  <p className="text-slate-400">No decisions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {senateHistory.map((decision, index) => (
                    <SenateDecisionCard key={decision.decision_id} decision={decision} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Injector (Dev Only) */}
        {view === 'test-injector' && isDevelopment && (
          <TestInjectorView
            mode={injectorMode}
            setMode={setInjectorMode}
            singleSCU={singleSCU}
            setSingleSCU={setSingleSCU}
            capsuleSourceId={capsuleSourceId}
            setCapsuleSourceId={setCapsuleSourceId}
            capsuleSCUs={capsuleSCUs}
            setCapsuleSCUs={setCapsuleSCUs}
            response={injectorResponse}
            loading={injectorLoading}
            onSendSingle={handleSendSingle}
            onSendCapsule={handleSendCapsule}
          />
        )}
      </div>
    </div>
  );
};

interface SignalCardProps {
  signal: Signal;
  index: number;
  onClick: () => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, index, onClick }) => {
  const isApproved = signal.ghost_pass_approved;
  const isCapsule = signal.payload_type === 'capsule';
  
  const primaryType = isCapsule 
    ? (signal.sensory_types?.[0] || 'UNKNOWN')
    : (signal.sensory_type || 'UNKNOWN');
  
  const color = getSensoryColor(primaryType);
  const { Icon, className } = getSensoryIcon(primaryType);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`glass-panel p-3 sm:p-4 cursor-pointer transition-all hover:border-cyan-500/50 ${
        !isApproved ? 'border-red-500/50' : ''
      }`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
          {/* Icon */}
          <div className={`${color.bg} ${color.border} border rounded-lg p-2 sm:p-3 flex-shrink-0`}>
            <Icon className={className} size={16} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
              {isCapsule && (
                <Package className="text-purple-400 flex-shrink-0" size={14} />
              )}
              <span className={`font-semibold ${color.text} text-sm sm:text-base truncate`}>
                {isCapsule ? `Capsule (${signal.scu_count} SCUs)` : primaryType}
              </span>
              {isCapsule && signal.sensory_types && signal.sensory_types.length > 1 && (
                <span className="text-xs text-slate-400 flex-shrink-0">
                  +{signal.sensory_types.length - 1} more
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs sm:text-sm text-slate-400 space-y-1 sm:space-y-0">
              <span className="truncate">Source: {signal.source_id}</span>
              <span className="flex items-center space-x-1 flex-shrink-0">
                <Clock size={10} />
                <span>{getTimeAgo(signal.received_at)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-2">
          {isApproved ? (
            <div className="flex items-center space-x-1 text-emerald-400">
              <CheckCircle size={16} />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Approved</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-red-400">
              <XCircle size={16} />
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">Rejected</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const SignalDetailView: React.FC<{ signal: Signal; onBack: () => void }> = ({ signal, onBack }) => {
  const isCapsule = signal.payload_type === 'capsule';
  const isApproved = signal.ghost_pass_approved;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-2 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
          <motion.button
            onClick={onBack}
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
        <Card className={`glass-card mb-4 sm:mb-6 ${isApproved ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                {isApproved ? (
                  <CheckCircle className="text-emerald-400 flex-shrink-0" size={24} />
                ) : (
                  <XCircle className="text-red-400 flex-shrink-0" size={24} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-lg sm:text-xl font-bold ${isApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isApproved ? 'Ghost Pass Approved' : 'Ghost Pass Rejected'}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400">
                    {isApproved ? 'Signal forwarded to Senate' : 'Signal blocked by validation'}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="label-tactical text-xs sm:text-sm">Status</p>
                <p className="data-mono text-sm sm:text-base">{signal.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="glass-card mb-4 sm:mb-6">
          <CardHeader>
            <CardTitle className="heading-primary text-lg sm:text-xl">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="label-tactical text-xs sm:text-sm">Signal ID</p>
                <p className="data-mono text-xs sm:text-sm break-all">{signal.signal_id}</p>
              </div>
              <div>
                <p className="label-tactical text-xs sm:text-sm">Source ID</p>
                <p className="data-mono text-sm sm:text-base">{signal.source_id}</p>
              </div>
              <div>
                <p className="label-tactical text-xs sm:text-sm">Timestamp</p>
                <p className="data-mono text-xs sm:text-sm">{formatTimestamp(signal.timestamp)}</p>
              </div>
              <div>
                <p className="label-tactical text-xs sm:text-sm">Received At</p>
                <p className="data-mono text-xs sm:text-sm">{formatTimestamp(signal.received_at)}</p>
              </div>
              {signal.metadata?.integrity_hash && (
                <div className="sm:col-span-2">
                  <p className="label-tactical text-xs sm:text-sm">Integrity Hash</p>
                  <p className="data-mono text-xs break-all">{signal.metadata.integrity_hash}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Capsule View or Single SCU */}
        {isCapsule ? (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="heading-primary flex items-center space-x-2">
                <Package className="text-purple-400" size={20} />
                <span>Sensory Capsule ({signal.scu_count} SCUs)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {signal.scus?.map((scu, index) => (
                  <div key={index} className="glass-panel p-4 border-l-4 border-cyan-500/50">
                    <div className="flex items-center space-x-3 mb-3">
                      {(() => {
                        const { Icon, className } = getSensoryIcon(scu.sensory_type);
                        return <Icon className={className} size={20} />;
                      })()}
                      <span className="font-semibold text-cyan-400">{scu.sensory_type}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="label-tactical">Source:</span>
                        <span className="data-mono ml-2">{scu.source_id}</span>
                      </div>
                      <div>
                        <span className="label-tactical">Signal Data:</span>
                        <pre className="mt-2 p-3 bg-slate-950/50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(scu.signal_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="heading-primary">Signal Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-slate-950/50 rounded text-sm overflow-x-auto">
                {JSON.stringify(signal.signal_data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Validation Results */}
        {signal.validation_result && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="heading-primary">Validation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-slate-950/50 rounded text-sm overflow-x-auto">
                {JSON.stringify(signal.validation_result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

function getSensoryIcon(type: string) {
  const config = SENSORY_COLORS[type as keyof typeof SENSORY_COLORS];
  if (!config) return { Icon: Activity, className: 'text-cyan-400' };
  return { Icon: config.icon, className: config.text };
}

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


interface SenateEvaluationCardProps {
  evaluation: Evaluation;
  index: number;
  onReview: () => void;
  isLoading?: boolean;
}

const SenateEvaluationCard: React.FC<SenateEvaluationCardProps> = ({ evaluation, index, onReview, isLoading = false }) => {
  const priorityColor = PRIORITY_COLORS[evaluation.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal;
  const sensoryTypes = evaluation.context.sensory_types || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-panel p-3 sm:p-4 ${priorityColor.border} border-l-4`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${priorityColor.bg} ${priorityColor.text}`}>
              {evaluation.priority.toUpperCase()}
            </span>
            <span className="text-xs sm:text-sm text-slate-400 truncate">ID: {evaluation.signal_id}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {sensoryTypes.slice(0, 3).map((type: string) => {
                  const Icon = getSensoryIcon(type).Icon;
                  return <Icon key={type} className="text-purple-400" size={14} />;
                })}
                {sensoryTypes.length > 3 && (
                  <span className="text-xs text-slate-400">+{sensoryTypes.length - 3}</span>
                )}
              </div>
              <span className="text-xs sm:text-sm text-slate-300">
                {sensoryTypes.length} sensory type{sensoryTypes.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center space-x-1 text-xs sm:text-sm text-slate-400">
              <Clock size={10} />
              <span>{getTimeAgo(evaluation.received_at)}</span>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-slate-400">
            Source: <span className="text-cyan-400">{evaluation.context.source_id}</span>
          </div>
        </div>

        <motion.button
          onClick={onReview}
          disabled={isLoading}
          className={`btn-primary px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm w-full sm:w-auto ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
          whileHover={{ scale: isLoading ? 1 : 1.05 }}
          whileTap={{ scale: isLoading ? 1 : 0.95 }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading...</span>
            </div>
          ) : (
            'Review'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

interface SenateDecisionCardProps {
  decision: Decision;
  index: number;
}

const SenateDecisionCard: React.FC<SenateDecisionCardProps> = ({ decision, index }) => {
  const getDecisionColor = (dec: string) => {
    switch (dec) {
      case 'approved': return { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50' };
      case 'rejected': return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/50' };
      case 'escalated': return { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50' };
      case 'request_more_data': return { icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/50' };
      default: return { icon: Activity, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/50' };
    }
  };

  const config = getDecisionColor(decision.decision);
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-panel p-3 sm:p-4 ${config.border} border-l-4`}
    >
      <div className="flex items-start space-x-3 sm:space-x-4">
        <div className={`${config.bg} p-2 sm:p-3 rounded-lg flex-shrink-0`}>
          <Icon className={config.color} size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-1 sm:space-y-0">
            <span className={`font-semibold ${config.color} text-sm sm:text-base`}>
              {decision.decision.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">
              {formatTimestamp(decision.timestamp)}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 mb-2 break-words">{decision.reason}</p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-slate-400">
            <span className="truncate">Signal: {decision.signal_id}</span>
            {decision.trust_score && (
              <span className="flex-shrink-0">Trust: {(decision.trust_score * 100).toFixed(0)}%</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface SenateReviewWorkspaceProps {
  evaluation: Evaluation;
  decision: string;
  setDecision: (d: string) => void;
  reason: string;
  setReason: (r: string) => void;
  trustScore: number;
  setTrustScore: (t: number) => void;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

const SenateReviewWorkspace: React.FC<SenateReviewWorkspaceProps> = ({
  evaluation,
  decision,
  setDecision,
  reason,
  setReason,
  trustScore,
  setTrustScore,
  submitting,
  onSubmit,
  onBack
}) => {
  const sensoryTypes = evaluation.context.sensory_types || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-2 sm:p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
          <motion.button
            onClick={onBack}
            className="glass-panel p-2 sm:p-3 hover:border-purple-500/50 transition-all flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="text-purple-400" size={18} />
          </motion.button>
          <div className="min-w-0 flex-1">
            <h1 className="heading-primary text-xl sm:text-2xl truncate">Senate Review Workspace</h1>
            <p className="label-tactical text-xs sm:text-sm truncate">Evaluate signal and make governance decision</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card className="glass-card border-purple-500/30">
              <CardHeader>
                <CardTitle className="heading-primary text-lg sm:text-xl">Signal Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="label-tactical text-xs sm:text-sm">Signal ID</p>
                    <p className="data-mono text-xs sm:text-sm break-all">{evaluation.signal_id}</p>
                  </div>
                  <div>
                    <p className="label-tactical text-xs sm:text-sm">Priority</p>
                    <p className="data-mono text-sm sm:text-base">{evaluation.priority.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="label-tactical text-xs sm:text-sm">Source</p>
                    <p className="data-mono text-sm sm:text-base">{evaluation.context.source_id}</p>
                  </div>
                  <div>
                    <p className="label-tactical text-xs sm:text-sm">Received</p>
                    <p className="data-mono text-xs sm:text-sm">{formatTimestamp(evaluation.received_at)}</p>
                  </div>
                </div>

                <div>
                  <p className="label-tactical mb-2 text-xs sm:text-sm">Sensory Types</p>
                  <div className="flex flex-wrap gap-2">
                    {sensoryTypes.map((type: string) => {
                      const Icon = getSensoryIcon(type).Icon;
                      return (
                        <div key={type} className="glass-panel px-2 py-1 sm:px-3 sm:py-2 flex items-center space-x-1 sm:space-x-2">
                          <Icon className="text-purple-400" size={14} />
                          <span className="text-xs sm:text-sm">{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {evaluation.applicable_policies && evaluation.applicable_policies.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="heading-primary">Applicable Policies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {evaluation.applicable_policies.map((policy: any) => (
                    <div key={policy.policy_id} className="glass-panel p-3 border-l-4 border-yellow-500/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-yellow-400">{policy.name}</p>
                          <p className="text-sm text-slate-300 mt-1">{policy.description}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          policy.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {policy.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="heading-primary">Signal Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-slate-950/50 rounded text-xs overflow-x-auto">
                  {JSON.stringify(evaluation.signal_data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card className="glass-card border-purple-500/30">
              <CardHeader>
                <CardTitle className="heading-primary text-lg sm:text-xl">Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-3 sm:mb-4">
                  <div className="text-3xl sm:text-4xl font-bold text-purple-400">{trustScore}%</div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">Confidence Level</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={trustScore}
                  onChange={(e) => setTrustScore(parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#a855f7' }}
                />
              </CardContent>
            </Card>

            <Card className="glass-card border-purple-500/30">
              <CardHeader>
                <CardTitle className="heading-primary text-lg sm:text-xl">Make Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  {[
                    { value: 'approved', label: 'Approve', icon: CheckCircle, color: 'emerald' },
                    { value: 'rejected', label: 'Reject', icon: XCircle, color: 'red' },
                    { value: 'escalated', label: 'Escalate to Judge', icon: AlertTriangle, color: 'yellow' },
                    { value: 'request_more_data', label: 'Request More Data', icon: Send, color: 'blue' }
                  ].map((option) => {
                    const Icon = option.icon;
                    return (
                      <motion.button
                        key={option.value}
                        onClick={() => setDecision(option.value)}
                        className={`w-full glass-panel p-3 transition-all ${
                          decision === option.value 
                            ? `border-${option.color}-500/50 bg-${option.color}-500/10` 
                            : 'hover:border-white/20'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <Icon className={`text-${option.color}-400 flex-shrink-0`} size={18} />
                          <span className={`text-sm sm:text-base ${decision === option.value ? `text-${option.color}-400` : 'text-slate-300'}`}>
                            {option.label}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <div>
                  <label className="label-tactical block mb-2 text-xs sm:text-sm">Reason (Required)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="tactical-input w-full text-sm"
                    rows={4}
                    placeholder="Explain your decision..."
                  />
                </div>

                <motion.button
                  onClick={onSubmit}
                  disabled={!decision || !reason || submitting}
                  className="btn-primary w-full py-3 text-sm sm:text-base"
                  whileHover={{ scale: submitting || !decision || !reason ? 1 : 1.02 }}
                  whileTap={{ scale: submitting || !decision || !reason ? 1 : 0.98 }}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="loading-spinner"></div>
                      <span>SUBMITTING...</span>
                    </div>
                  ) : (
                    <span>SUBMIT DECISION</span>
                  )}
                </motion.button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};


const EXAMPLE_DATA: Record<string, string> = {
  VISION: '{\n  "objects_detected": ["person", "vehicle"],\n  "confidence_scores": [0.95, 0.87],\n  "scene": "urban_street"\n}',
  HEARING: '{\n  "audio_pattern": "alert_tone",\n  "frequency_range": [800, 1200],\n  "duration_ms": 1000\n}',
  TOUCH: '{\n  "pressure_points": [{"location": "surface_a", "pressure_psi": 15.2}],\n  "threshold_exceeded": false\n}',
  BALANCE: '{\n  "orientation": {"pitch": 2.3, "roll": -1.1, "yaw": 0.5},\n  "stability_score": 0.94\n}',
  SMELL: '{\n  "chemical_signatures": ["CO2", "CH4"],\n  "concentrations_ppm": [450, 2.1],\n  "anomaly_detected": false\n}',
  TASTE: '{\n  "quality_metrics": {"pH": 7.2, "salinity": 0.05},\n  "fitness_score": 0.89,\n  "quality_grade": "A"\n}',
};

const SENSORY_TYPES = [
  { value: 'VISION', label: 'Vision' },
  { value: 'HEARING', label: 'Hearing' },
  { value: 'TOUCH', label: 'Touch' },
  { value: 'BALANCE', label: 'Balance' },
  { value: 'SMELL', label: 'Smell' },
  { value: 'TASTE', label: 'Taste' },
];

interface TestInjectorViewProps {
  mode: 'single' | 'capsule';
  setMode: (m: 'single' | 'capsule') => void;
  singleSCU: any;
  setSingleSCU: (s: any) => void;
  capsuleSourceId: string;
  setCapsuleSourceId: (s: string) => void;
  capsuleSCUs: any[];
  setCapsuleSCUs: (s: any[]) => void;
  response: { success: boolean; message: string; data?: any } | null;
  loading: boolean;
  onSendSingle: () => void;
  onSendCapsule: () => void;
}

const TestInjectorView: React.FC<TestInjectorViewProps> = ({
  mode,
  setMode,
  singleSCU,
  setSingleSCU,
  capsuleSourceId,
  setCapsuleSourceId,
  capsuleSCUs,
  setCapsuleSCUs,
  response,
  loading,
  onSendSingle,
  onSendCapsule
}) => {
  const addSCUToCapsule = () => {
    setCapsuleSCUs([
      ...capsuleSCUs,
      {
        id: Date.now().toString(),
        sensory_type: 'VISION',
        signal_data: EXAMPLE_DATA.VISION,
        source_id: capsuleSourceId
      }
    ]);
  };

  const removeSCUFromCapsule = (id: string) => {
    setCapsuleSCUs(capsuleSCUs.filter(scu => scu.id !== id));
  };

  const updateCapsuleSCU = (id: string, field: string, value: string) => {
    setCapsuleSCUs(capsuleSCUs.map(scu => 
      scu.id === id ? { ...scu, [field]: value } : scu
    ));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Warning Banner */}
      <Card className="glass-card bg-yellow-500/10 border-yellow-500/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start space-x-2 sm:space-x-3">
            <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-yellow-400 mb-1">DEVELOPMENT TOOL ONLY</p>
              <p className="text-slate-300">
                This tool simulates external systems sending sensory signals. For testing purposes only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selector */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <motion.button
          onClick={() => setMode('single')}
          className={`flex-1 glass-panel p-3 sm:p-4 transition-all ${
            mode === 'single' ? 'border-cyan-500/50 bg-cyan-500/10' : 'hover:border-white/20'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <Send className={mode === 'single' ? 'text-cyan-400' : 'text-slate-400'} size={18} />
            <span className={`font-semibold text-sm sm:text-base ${mode === 'single' ? 'text-cyan-400' : 'text-slate-400'}`}>
              Single SCU
            </span>
          </div>
        </motion.button>

        <motion.button
          onClick={() => setMode('capsule')}
          className={`flex-1 glass-panel p-3 sm:p-4 transition-all ${
            mode === 'capsule' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <Package className={mode === 'capsule' ? 'text-purple-400' : 'text-slate-400'} size={18} />
            <span className={`font-semibold text-sm sm:text-base ${mode === 'capsule' ? 'text-purple-400' : 'text-slate-400'}`}>
              Sensory Capsule
            </span>
          </div>
        </motion.button>
      </div>

      {/* Single SCU Mode */}
      {mode === 'single' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="heading-primary text-lg sm:text-xl">Send Individual SCU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div>
              <label className="label-tactical block mb-2 text-xs sm:text-sm">Sensory Type</label>
              <select
                value={singleSCU.sensory_type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const exampleData = EXAMPLE_DATA[newType] || '{}';
                  setSingleSCU({ 
                    ...singleSCU, 
                    sensory_type: newType,
                    signal_data: exampleData
                  });
                }}
                className="tactical-input w-full text-sm"
              >
                {SENSORY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-tactical block mb-2 text-xs sm:text-sm">Source ID</label>
              <input
                value={singleSCU.source_id}
                onChange={(e) => setSingleSCU({ ...singleSCU, source_id: e.target.value })}
                className="tactical-input w-full text-sm"
                placeholder="test_sensor_01"
              />
            </div>

            <div>
              <label className="label-tactical block mb-2 text-xs sm:text-sm">Signal Data (JSON)</label>
              <textarea
                value={singleSCU.signal_data}
                onChange={(e) => setSingleSCU({ ...singleSCU, signal_data: e.target.value })}
                className="tactical-input w-full font-mono text-xs sm:text-sm"
                rows={6}
                placeholder='{"key": "value"}'
              />
            </div>

            <motion.button
              onClick={onSendSingle}
              disabled={loading}
              className="btn-primary w-full py-3 text-sm sm:text-base"
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="loading-spinner"></div>
                  <span>SENDING...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Send size={18} />
                  <span>SEND SIGNAL</span>
                </div>
              )}
            </motion.button>

            {/* Quick confirmation below button */}
            {response && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-3 p-3 rounded-lg text-xs sm:text-sm ${
                  response.success 
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' 
                    : 'bg-red-500/20 border border-red-500/50 text-red-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {response.success ? (
                    <CheckCircle size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>{response.message}</span>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Capsule Mode */}
      {mode === 'capsule' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="heading-primary">Send Sensory Capsule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="label-tactical block mb-2">Capsule Source ID</label>
              <input
                value={capsuleSourceId}
                onChange={(e) => setCapsuleSourceId(e.target.value)}
                className="tactical-input w-full"
                placeholder="sensor_hub_test"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="label-tactical">SCUs in Capsule ({capsuleSCUs.length})</label>
                <motion.button
                  onClick={addSCUToCapsule}
                  className="glass-panel px-3 py-2 hover:border-cyan-500/50 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex items-center space-x-2">
                    <Package className="text-cyan-400" size={16} />
                    <span className="text-sm text-cyan-400">Add SCU</span>
                  </div>
                </motion.button>
              </div>

              {capsuleSCUs.map((scu, index) => (
                <div key={scu.id} className="glass-panel p-4 space-y-3 border-l-4 border-purple-500/50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-400">SCU #{index + 1}</span>
                    {capsuleSCUs.length > 1 && (
                      <motion.button
                        onClick={() => removeSCUFromCapsule(scu.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <XCircle size={16} />
                      </motion.button>
                    )}
                  </div>

                  <div>
                    <label className="label-tactical block mb-2">Sensory Type</label>
                    <select
                      value={scu.sensory_type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        const exampleData = EXAMPLE_DATA[newType] || '{}';
                        setCapsuleSCUs(capsuleSCUs.map(s => 
                          s.id === scu.id 
                            ? { ...s, sensory_type: newType, signal_data: exampleData }
                            : s
                        ));
                      }}
                      className="tactical-input w-full"
                    >
                      {SENSORY_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-tactical block mb-2">Source ID</label>
                    <input
                      value={scu.source_id}
                      onChange={(e) => updateCapsuleSCU(scu.id, 'source_id', e.target.value)}
                      className="tactical-input w-full"
                      placeholder={capsuleSourceId}
                    />
                  </div>

                  <div>
                    <label className="label-tactical block mb-2">Signal Data (JSON)</label>
                    <textarea
                      value={scu.signal_data}
                      onChange={(e) => updateCapsuleSCU(scu.id, 'signal_data', e.target.value)}
                      className="tactical-input w-full font-mono text-sm"
                      rows={6}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                </div>
              ))}
            </div>

            <motion.button
              onClick={onSendCapsule}
              disabled={loading}
              className="btn-primary w-full"
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="loading-spinner"></div>
                  <span>SENDING...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Package size={20} />
                  <span>SEND CAPSULE ({capsuleSCUs.length} SCUs)</span>
                </div>
              )}
            </motion.button>

            {/* Quick confirmation below button */}
            {response && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-3 p-3 rounded-lg text-sm ${
                  response.success 
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' 
                    : 'bg-red-500/20 border border-red-500/50 text-red-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {response.success ? (
                    <CheckCircle size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                  <span>{response.message}</span>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Response Display */}
      {response && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`glass-card ${
            response.success 
              ? 'border-emerald-500/50 bg-emerald-500/10' 
              : 'border-red-500/50 bg-red-500/10'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                {response.success ? (
                  <CheckCircle className="text-emerald-400 flex-shrink-0" size={32} />
                ) : (
                  <XCircle className="text-red-400 flex-shrink-0" size={32} />
                )}
                <div className="flex-1">
                  <p className={`text-xl font-bold mb-2 ${
                    response.success ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {response.success ? 'Success!' : 'Error'}
                  </p>
                  <p className="text-slate-300 mb-4">{response.message}</p>
                  
                  {response.data && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 mb-2">
                        View Response Details
                      </summary>
                      <pre className="p-4 bg-slate-950/50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(response.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};
