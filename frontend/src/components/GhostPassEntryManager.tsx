import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DoorOpen, 
  DoorClosed,
  CreditCard,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntryManagerProps {
  venueId: string;
  walletBindingId?: string;
  onEntryComplete?: (result: any) => void;
}

interface EntryConfiguration {
  venue_id: string;
  initial_entry_fee_cents: number;
  re_entry_allowed: boolean;
  venue_re_entry_fee_cents: number;
  valid_re_entry_fee_cents: number;
  pass_purchase_required: boolean;
  max_entries_per_day?: number;
}

interface EntryHistory {
  id: string;
  entry_number: number;
  entry_type: 'INITIAL' | 'RE_ENTRY';
  interaction_method: 'QR' | 'NFC';
  fees_charged: Record<string, number>;
  total_fee_cents: number;
  timestamp: string;
  status: string;
}

interface VenueStats {
  summary: {
    total_entries: number;
    initial_entries: number;
    re_entries: number;
    unique_wallets: number;
    re_entry_rate: number;
  };
  fees: {
    total_collected_cents: number;
    venue_fees_cents: number;
    platform_fees_cents: number;
    total_collected_dollars: number;
    venue_fees_dollars: number;
    platform_fees_dollars: number;
  };
  patterns: {
    entries_by_hour: Record<string, number>;
  };
}

const GhostPassEntryManager: React.FC<EntryManagerProps> = ({
  venueId,
  walletBindingId,
  onEntryComplete
}) => {
  const [configuration, setConfiguration] = useState<EntryConfiguration | null>(null);
  const [entryHistory, setEntryHistory] = useState<EntryHistory[]>([]);
  const [venueStats, setVenueStats] = useState<VenueStats | null>(null);
  const [isProcessingEntry, setIsProcessingEntry] = useState(false);
  const [lastEntryResult, setLastEntryResult] = useState<any>(null);
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load entry configuration
  const loadConfiguration = async () => {
    try {
      const response = await fetch(`/api/ghost-pass/entry/configure?venue_id=${venueId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfiguration(data.configuration);
      }
    } catch (error) {
      console.error('Failed to load entry configuration:', error);
    }
  };

  // Load entry history
  const loadEntryHistory = async () => {
    if (!walletBindingId) return;
    
    try {
      const response = await fetch(`/api/ghost-pass/entry/history/${walletBindingId}?venue_id=${venueId}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEntryHistory(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load entry history:', error);
    }
  };

  // Load venue statistics
  const loadVenueStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/ghost-pass/entry/venue/${venueId}/stats?date_from=${today}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVenueStats(data);
      }
    } catch (error) {
      console.error('Failed to load venue stats:', error);
    }
  };

  // Process entry attempt
  const processEntry = async (interactionMethod: 'QR' | 'NFC') => {
    if (!walletBindingId || !configuration) return;
    
    try {
      setIsProcessingEntry(true);
      setError(null);
      
      const entryData = {
        wallet_binding_id: walletBindingId,
        venue_id: venueId,
        gateway_id: 'main_entry', // This would come from the actual gateway
        interaction_method: interactionMethod,
        device_fingerprint: localStorage.getItem('device_fingerprint') || 'unknown',
        brightness_level: interactionMethod === 'QR' ? 100 : undefined
      };
      
      const response = await fetch('/api/ghost-pass/entry/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(entryData)
      });
      
      const result = await response.json();
      setLastEntryResult(result);
      
      if (result.status === 'APPROVED') {
        // Refresh data after successful entry
        await Promise.all([
          loadEntryHistory(),
          loadVenueStats()
        ]);
        
        if (onEntryComplete) {
          onEntryComplete(result);
        }
      } else if (result.requires_staff) {
        setError(result.message);
      }
      
    } catch (error) {
      console.error('Entry processing failed:', error);
      setError('Failed to process entry attempt');
    } finally {
      setIsProcessingEntry(false);
    }
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadConfiguration(),
          loadEntryHistory(),
          loadVenueStats()
        ]);
      } catch (error) {
        console.error('Failed to initialize entry manager:', error);
        setError('Failed to load entry management data');
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [venueId, walletBindingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading entry management...</p>
        </div>
      </div>
    );
  }

  if (!configuration) {
    return (
      <div className="p-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div>
            <h3 className="font-semibold text-white">Configuration Required</h3>
            <p className="text-sm text-gray-400">
              Entry management is not configured for this venue
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Entry Management</h2>
          <p className="text-sm text-gray-400">Venue: {venueId}</p>
        </div>
        <button
          onClick={() => setShowConfiguration(!showConfiguration)}
          className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </motion.div>
      )}

      {/* Configuration Display */}
      <AnimatePresence>
        {showConfiguration && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
          >
            <h3 className="font-semibold text-white mb-3">Current Configuration</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Initial Entry Fee:</span>
                <span className="text-white ml-2">${(configuration.initial_entry_fee_cents / 100).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Re-entry Allowed:</span>
                <span className={cn("ml-2", configuration.re_entry_allowed ? "text-green-400" : "text-red-400")}>
                  {configuration.re_entry_allowed ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Venue Re-entry Fee:</span>
                <span className="text-white ml-2">${(configuration.venue_re_entry_fee_cents / 100).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Platform Re-entry Fee:</span>
                <span className="text-white ml-2">${(configuration.valid_re_entry_fee_cents / 100).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Pass Required:</span>
                <span className={cn("ml-2", configuration.pass_purchase_required ? "text-yellow-400" : "text-green-400")}>
                  {configuration.pass_purchase_required ? 'Yes' : 'No'}
                </span>
              </div>
              {configuration.max_entries_per_day && (
                <div>
                  <span className="text-gray-400">Max Entries/Day:</span>
                  <span className="text-white ml-2">{configuration.max_entries_per_day}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entry Actions */}
      {walletBindingId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">Entry Actions</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => processEntry('QR')}
              disabled={isProcessingEntry}
              className={cn(
                "p-4 rounded-lg border transition-all duration-200",
                "bg-cyan-600/20 border-cyan-500 text-cyan-400 hover:bg-cyan-600/30",
                isProcessingEntry && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <DoorOpen className="w-6 h-6" />
                <span className="text-sm font-medium">QR Entry</span>
                {configuration.initial_entry_fee_cents > 0 && (
                  <span className="text-xs">
                    ${(configuration.initial_entry_fee_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={() => processEntry('NFC')}
              disabled={isProcessingEntry}
              className={cn(
                "p-4 rounded-lg border transition-all duration-200",
                "bg-blue-600/20 border-blue-500 text-blue-400 hover:bg-blue-600/30",
                isProcessingEntry && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <DoorOpen className="w-6 h-6" />
                <span className="text-sm font-medium">NFC Entry</span>
                {configuration.initial_entry_fee_cents > 0 && (
                  <span className="text-xs">
                    ${(configuration.initial_entry_fee_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </button>
          </div>

          {isProcessingEntry && (
            <div className="flex items-center justify-center gap-2 text-cyan-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processing entry...</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Last Entry Result */}
      {lastEntryResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-lg border",
            lastEntryResult.status === 'APPROVED' 
              ? "bg-green-900/20 border-green-500/30"
              : "bg-red-900/20 border-red-500/30"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {lastEntryResult.status === 'APPROVED' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span className={cn(
              "font-medium",
              lastEntryResult.status === 'APPROVED' ? "text-green-400" : "text-red-400"
            )}>
              {lastEntryResult.status}
            </span>
          </div>
          
          <div className="text-sm text-gray-300 space-y-1">
            <div>Type: {lastEntryResult.entry_type}</div>
            <div>Entry #: {lastEntryResult.entry_number}</div>
            {lastEntryResult.total_fee_cents > 0 && (
              <div>Fee: ${(lastEntryResult.total_fee_cents / 100).toFixed(2)}</div>
            )}
            <div>Message: {lastEntryResult.message}</div>
          </div>
        </motion.div>
      )}

      {/* Entry History */}
      {entryHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Entry History
          </h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {entryHistory.map((entry) => (
              <div
                key={entry.id}
                className="p-3 bg-gray-800/30 rounded-lg border border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      entry.entry_type === 'INITIAL' ? "bg-green-400" : "bg-blue-400"
                    )} />
                    <span className="text-white text-sm font-medium">
                      Entry #{entry.entry_number} ({entry.entry_type})
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <div className="mt-1 text-xs text-gray-400 flex items-center gap-4">
                  <span>Method: {entry.interaction_method}</span>
                  {entry.total_fee_cents > 0 && (
                    <span>Fee: ${(entry.total_fee_cents / 100).toFixed(2)}</span>
                  )}
                  <span>Status: {entry.status}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Venue Statistics */}
      {venueStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Today's Statistics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-white">{venueStats.summary.total_entries}</div>
              <div className="text-xs text-gray-400">Total Entries</div>
            </div>
            
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-green-400">{venueStats.summary.initial_entries}</div>
              <div className="text-xs text-gray-400">Initial Entries</div>
            </div>
            
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-blue-400">{venueStats.summary.re_entries}</div>
              <div className="text-xs text-gray-400">Re-entries</div>
            </div>
            
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-cyan-400">{venueStats.summary.unique_wallets}</div>
              <div className="text-xs text-gray-400">Unique Wallets</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-lg font-bold text-white">
                ${venueStats.fees.total_collected_dollars.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Total Fees Collected</div>
            </div>
            
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-lg font-bold text-yellow-400">
                ${venueStats.fees.venue_fees_dollars.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Venue Fees</div>
            </div>
            
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="text-lg font-bold text-purple-400">
                ${venueStats.fees.platform_fees_dollars.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Platform Fees</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GhostPassEntryManager;