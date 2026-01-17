import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, Send,
  Eye, Ear, Hand, Compass, Wind, Droplet, Activity,
  Clock, Shield, FileText, Scale
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SenateEvaluationProps {
  onBack: () => void;
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

const SENSORY_ICONS = {
  VISION: Eye,
  HEARING: Ear,
  TOUCH: Hand,
  BALANCE: Compass,
  SMELL: Wind,
  TASTE: Droplet,
};

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' },
  medium: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  normal: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
};

const SenateEvaluation: React.FC<SenateEvaluationProps> = ({ onBack }) => {
  const [view, setView] = useState<'pending' | 'review' | 'history'>('pending');
  const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Decision form state
  const [decision, setDecision] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [trustScore, setTrustScore] = useState<number>(75);
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = async () => {
    try {
      const response = await fetch('http://localhost:8000/senate/pending');
      const data = await response.json();
      setPendingEvaluations(data.evaluations);
    } catch (error) {
      console.error('Failed to fetch pending evaluations:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/senate/history');
      const data = await response.json();
      setHistory(data.decisions);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/senate/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPending(), fetchHistory(), fetchStats()]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchPending();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleReview = async (evaluation: Evaluation) => {
    // Fetch detailed evaluation data
    try {
      const response = await fetch(`http://localhost:8000/senate/pending/${evaluation.evaluation_id}`);
      const data = await response.json();
      setSelectedEvaluation(data);
      setView('review');
      setDecision('');
      setReason('');
      setTrustScore(75);
    } catch (error) {
      console.error('Failed to fetch evaluation details:', error);
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
          reviewer_id: 'admin_user', // In production, use actual user ID
          trust_score: trustScore / 100
        })
      });

      if (response.ok) {
        // Refresh data
        await Promise.all([fetchPending(), fetchHistory(), fetchStats()]);
        setView('pending');
        setSelectedEvaluation(null);
      }
    } catch (error) {
      console.error('Failed to submit decision:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400">Loading Senate Evaluation...</p>
        </div>
      </div>
    );
  }

  if (view === 'review' && selectedEvaluation) {
    return <EvaluationWorkspace 
      evaluation={selectedEvaluation}
      decision={decision}
      setDecision={setDecision}
      reason={reason}
      setReason={setReason}
      trustScore={trustScore}
      setTrustScore={setTrustScore}
      submitting={submitting}
      onSubmit={handleSubmitDecision}
      onBack={() => setView('pending')}
    />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={onBack}
              className="glass-panel p-3 hover:border-purple-500/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="text-purple-400" size={20} />
            </motion.button>
            <div>
              <h1 className="heading-primary text-2xl sm:text-3xl flex items-center space-x-2">
                <Scale className="text-purple-400" size={28} />
                <span>Senate Evaluation</span>
              </h1>
              <p className="label-tactical">Governance decisions on validated signals</p>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex space-x-2">
            <motion.button
              onClick={() => setView('pending')}
              className={`glass-panel px-4 py-2 transition-all ${
                view === 'pending' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className={view === 'pending' ? 'text-purple-400' : 'text-slate-400'}>Pending</span>
            </motion.button>
            <motion.button
              onClick={() => setView('history')}
              className={`glass-panel px-4 py-2 transition-all ${
                view === 'history' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className={view === 'history' ? 'text-purple-400' : 'text-slate-400'}>History</span>
            </motion.button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="glass-card border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-tactical">Pending Review</p>
                    <p className="text-2xl font-bold text-purple-400">{stats.pending_count}</p>
                  </div>
                  <Clock className="text-purple-400" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-tactical">Approved</p>
                    <p className="text-2xl font-bold text-emerald-400">{stats.by_decision?.approved || 0}</p>
                  </div>
                  <CheckCircle className="text-emerald-400" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-tactical">Rejected</p>
                    <p className="text-2xl font-bold text-red-400">{stats.by_decision?.rejected || 0}</p>
                  </div>
                  <XCircle className="text-red-400" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-tactical">Escalated</p>
                    <p className="text-2xl font-bold text-yellow-400">{stats.by_decision?.escalated || 0}</p>
                  </div>
                  <AlertTriangle className="text-yellow-400" size={24} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending Evaluations */}
        {view === 'pending' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="heading-primary flex items-center space-x-2">
                <Shield className="text-purple-400" size={20} />
                <span>Pending Evaluation</span>
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
                    <EvaluationCard
                      key={evaluation.evaluation_id}
                      evaluation={evaluation}
                      index={index}
                      onReview={() => handleReview(evaluation)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* History */}
        {view === 'history' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="heading-primary flex items-center space-x-2">
                <FileText className="text-purple-400" size={20} />
                <span>Evaluation History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="text-slate-400 mx-auto mb-4" size={48} />
                  <p className="text-slate-400">No decisions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((decision, index) => (
                    <DecisionCard key={decision.decision_id} decision={decision} index={index} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

interface EvaluationCardProps {
  evaluation: Evaluation;
  index: number;
  onReview: () => void;
}

const EvaluationCard: React.FC<EvaluationCardProps> = ({ evaluation, index, onReview }) => {
  const priorityColor = PRIORITY_COLORS[evaluation.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal;
  const sensoryTypes = evaluation.context.sensory_types || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-panel p-4 ${priorityColor.border} border-l-4`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-3">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${priorityColor.bg} ${priorityColor.text}`}>
              {evaluation.priority.toUpperCase()}
            </span>
            <span className="text-sm text-slate-400">ID: {evaluation.signal_id}</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {sensoryTypes.map((type: string) => {
                const Icon = SENSORY_ICONS[type as keyof typeof SENSORY_ICONS] || Activity;
                return <Icon key={type} className="text-purple-400" size={16} />;
              })}
              <span className="text-sm text-slate-300">
                {sensoryTypes.length} sensory type{sensoryTypes.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center space-x-1 text-sm text-slate-400">
              <Clock size={12} />
              <span>{new Date(evaluation.received_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="text-sm text-slate-400">
            Source: <span className="text-cyan-400">{evaluation.context.source_id}</span>
          </div>
        </div>

        <motion.button
          onClick={onReview}
          className="btn-primary px-4 py-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Review
        </motion.button>
      </div>
    </motion.div>
  );
};

interface DecisionCardProps {
  decision: Decision;
  index: number;
}

const DecisionCard: React.FC<DecisionCardProps> = ({ decision, index }) => {
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
      className={`glass-panel p-4 ${config.border} border-l-4`}
    >
      <div className="flex items-start space-x-4">
        <div className={`${config.bg} p-3 rounded-lg`}>
          <Icon className={config.color} size={20} />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className={`font-semibold ${config.color}`}>
              {decision.decision.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(decision.timestamp).toLocaleString()}
            </span>
          </div>

          <p className="text-sm text-slate-300 mb-2">{decision.reason}</p>

          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span>Signal: {decision.signal_id}</span>
            {decision.trust_score && (
              <span>Trust: {(decision.trust_score * 100).toFixed(0)}%</span>
            )}
            <span>Reviewer: {decision.reviewer_id}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface EvaluationWorkspaceProps {
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

const EvaluationWorkspace: React.FC<EvaluationWorkspaceProps> = ({
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
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <motion.button
            onClick={onBack}
            className="glass-panel p-3 hover:border-purple-500/50 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="text-purple-400" size={20} />
          </motion.button>
          <div>
            <h1 className="heading-primary text-2xl">Evaluation Workspace</h1>
            <p className="label-tactical">Review signal and make governance decision</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Signal Data */}
          <div className="lg:col-span-2 space-y-6">
            {/* Signal Overview */}
            <Card className="glass-card border-purple-500/30">
              <CardHeader>
                <CardTitle className="heading-primary">Signal Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="label-tactical">Signal ID</p>
                    <p className="data-mono text-sm">{evaluation.signal_id}</p>
                  </div>
                  <div>
                    <p className="label-tactical">Priority</p>
                    <p className="data-mono">{evaluation.priority.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="label-tactical">Source</p>
                    <p className="data-mono">{evaluation.context.source_id}</p>
                  </div>
                  <div>
                    <p className="label-tactical">Received</p>
                    <p className="data-mono text-xs">{new Date(evaluation.received_at).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <p className="label-tactical mb-2">Sensory Types</p>
                  <div className="flex flex-wrap gap-2">
                    {sensoryTypes.map((type: string) => {
                      const Icon = SENSORY_ICONS[type as keyof typeof SENSORY_ICONS] || Activity;
                      return (
                        <div key={type} className="glass-panel px-3 py-2 flex items-center space-x-2">
                          <Icon className="text-purple-400" size={16} />
                          <span className="text-sm">{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Applicable Policies */}
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

            {/* Signal Data */}
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

          {/* Right Column: Decision Panel */}
          <div className="space-y-6">
            {/* Trust Score */}
            <Card className="glass-card border-purple-500/30">
              <CardHeader>
                <CardTitle className="heading-primary">Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-purple-400">{trustScore}%</div>
                  <p className="text-sm text-slate-400 mt-1">Confidence Level</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={trustScore}
                  onChange={(e) => setTrustScore(parseInt(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: '#a855f7'
                  }}
                />
              </CardContent>
            </Card>

            {/* Decision Options */}
            <Card className="glass-card border-purple-500/30">
              <CardHeader>
                <CardTitle className="heading-primary">Make Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                        <div className="flex items-center space-x-3">
                          <Icon className={`text-${option.color}-400`} size={20} />
                          <span className={decision === option.value ? `text-${option.color}-400` : 'text-slate-300'}>
                            {option.label}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <div>
                  <label className="label-tactical block mb-2">Reason (Required)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="tactical-input w-full"
                    rows={4}
                    placeholder="Explain your decision..."
                  />
                </div>

                <motion.button
                  onClick={onSubmit}
                  disabled={!decision || !reason || submitting}
                  className="btn-primary w-full"
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

export default SenateEvaluation;
