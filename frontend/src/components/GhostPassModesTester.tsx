import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  QrCode, 
  Wifi, 
  CheckCircle, 
  XCircle, 
  Settings,
  Zap,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextInfo {
  context: string;
  mode: string;
  pass_required: boolean;
  per_scan_fee_cents: number;
  pass_options: Array<{
    id: string;
    name: string;
    price_cents: number;
    duration_hours: number;
    includes: string[];
  }>;
}

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

const GhostPassModesTester: React.FC = () => {
  const [contexts, setContexts] = useState<Record<string, ContextInfo>>({});
  const [selectedContext, setSelectedContext] = useState<string>('club');
  const [walletBindingId, setWalletBindingId] = useState<string>('test_wallet_' + Math.random().toString(36).substring(2, 11));
  const [ghostPassToken, setGhostPassToken] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [interactionMethod, setInteractionMethod] = useState<'QR' | 'NFC'>('NFC');

  useEffect(() => {
    fetchContexts();
  }, []);

  const fetchContexts = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ghost-pass/contexts`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setContexts(data.contexts);
    } catch (error) {
      console.error('Failed to fetch contexts:', error);
      addTestResult({
        success: false,
        message: 'Failed to fetch contexts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
  };

  const testCheckContext = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ghost-pass/check-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: selectedContext,
          wallet_binding_id: walletBindingId,
          ghost_pass_token: ghostPassToken || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      addTestResult({
        success: response.ok,
        message: `Context Check: ${data.mode} mode - ${data.access_granted ? 'Access Granted' : 'Access Denied'}`,
        data
      });
    } catch (error) {
      addTestResult({
        success: false,
        message: 'Context check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testPurchasePass = async (passId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ghost-pass/purchase-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: selectedContext,
          pass_id: passId,
          wallet_binding_id: walletBindingId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.ghost_pass_token) {
        setGhostPassToken(data.ghost_pass_token);
      }

      addTestResult({
        success: data.success,
        message: `Pass Purchase: ${data.success ? 'Success' : 'Failed'}`,
        data
      });
    } catch (error) {
      addTestResult({
        success: false,
        message: 'Pass purchase failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testInteraction = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/ghost-pass/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: selectedContext,
          wallet_binding_id: walletBindingId,
          interaction_method: interactionMethod,
          gateway_id: `${selectedContext}_gateway_01`,
          ghost_pass_token: ghostPassToken || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      addTestResult({
        success: data.success,
        message: `${interactionMethod} Interaction: ${data.success ? 'Success' : 'Failed'} - ${data.message}`,
        data
      });
    } catch (error) {
      addTestResult({
        success: false,
        message: 'Interaction failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const resetWallet = () => {
    setWalletBindingId('test_wallet_' + Math.random().toString(36).substring(2, 11));
    setGhostPassToken('');
    addTestResult({
      success: true,
      message: 'Wallet reset - new binding ID generated'
    });
  };

  const currentContext = contexts[selectedContext];

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen">
      {/* Back Button */}
      <div className="flex items-center mb-4">
        <button
          onClick={() => window.location.hash = '#/command-center'}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Command Center</span>
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-white mb-2">GHOST PASS MODES TESTER</h1>
        <p className="text-cyan-400">Test Pay-Per-Scan vs Event Pass modes</p>
        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Test Configuration */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Left Panel - Configuration */}
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              Test Configuration
            </h3>

            {/* Context Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Context/Venue</label>
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              >
                {Object.keys(contexts).map(context => (
                  <option key={context} value={context}>
                    {context} ({contexts[context]?.mode})
                  </option>
                ))}
              </select>
            </div>

            {/* Wallet Binding ID */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Wallet Binding ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walletBindingId}
                  onChange={(e) => setWalletBindingId(e.target.value)}
                  className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                />
                <button
                  onClick={resetWallet}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Ghost Pass Token */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Ghost Pass Token</label>
              <input
                type="text"
                value={ghostPassToken}
                onChange={(e) => setGhostPassToken(e.target.value)}
                placeholder="Will be set after pass purchase"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
              />
            </div>

            {/* Interaction Method */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">Interaction Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setInteractionMethod('NFC')}
                  className={cn(
                    "p-3 rounded border transition-colors",
                    interactionMethod === 'NFC'
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-400"
                      : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500"
                  )}
                >
                  <Wifi className="w-4 h-4 mx-auto mb-1" />
                  NFC
                </button>
                <button
                  onClick={() => setInteractionMethod('QR')}
                  className={cn(
                    "p-3 rounded border transition-colors",
                    interactionMethod === 'QR'
                      ? "bg-cyan-600/20 border-cyan-500 text-cyan-400"
                      : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500"
                  )}
                >
                  <QrCode className="w-4 h-4 mx-auto mb-1" />
                  QR
                </button>
              </div>
            </div>
          </div>

          {/* Context Info */}
          {currentContext && (
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3">Current Context Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Mode:</span>
                  <span className={cn(
                    "font-medium",
                    currentContext.mode === 'pay_per_scan' ? "text-green-400" : "text-blue-400"
                  )}>
                    {currentContext.mode === 'pay_per_scan' ? 'Pay-Per-Scan' : 'Event Pass'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pass Required:</span>
                  <span className={cn(
                    "font-medium",
                    currentContext.pass_required ? "text-red-400" : "text-green-400"
                  )}>
                    {currentContext.pass_required ? 'Yes' : 'No'}
                  </span>
                </div>
                {!currentContext.pass_required && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Per-Scan Fee:</span>
                    <span className="text-yellow-400 font-medium">
                      ${(currentContext.per_scan_fee_cents / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {currentContext.pass_required && currentContext.pass_options.length > 0 && (
                  <div className="mt-3">
                    <span className="text-gray-400 text-xs">Pass Options:</span>
                    <div className="mt-1 space-y-1">
                      {currentContext.pass_options.map(option => (
                        <div key={option.id} className="text-xs text-gray-300">
                          {option.name}: ${(option.price_cents / 100).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Test Actions */}
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Test Actions
            </h3>

            <div className="space-y-3">
              {/* Check Context */}
              <button
                onClick={testCheckContext}
                disabled={isLoading}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white font-medium transition-colors"
              >
                1. Check Context Requirements
              </button>

              {/* Purchase Pass (only for event contexts) */}
              {currentContext?.pass_required && currentContext.pass_options.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">2. Purchase Pass</label>
                  {currentContext.pass_options.map(option => (
                    <button
                      key={option.id}
                      onClick={() => testPurchasePass(option.id)}
                      disabled={isLoading}
                      className="w-full p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white text-sm transition-colors flex items-center justify-between"
                    >
                      <span>{option.name}</span>
                      <span>${(option.price_cents / 100).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Test Interaction */}
              <button
                onClick={testInteraction}
                disabled={isLoading}
                className="w-full p-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-white font-medium transition-colors"
              >
                {currentContext?.pass_required ? '3. Test Entry with Pass' : '2. Test Pay-Per-Scan'}
              </button>

              {/* Clear Results */}
              <button
                onClick={clearResults}
                className="w-full p-2 bg-gray-600 hover:bg-gray-700 rounded text-white text-sm transition-colors"
              >
                Clear Results
              </button>
            </div>
          </div>

          {/* Quick Test Scenarios */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-3">Quick Test Scenarios</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => {
                  setSelectedContext('club');
                  setTimeout(testCheckContext, 100);
                }}
                className="p-2 bg-green-600/20 border border-green-500/30 rounded text-green-400 hover:bg-green-600/30"
              >
                Club Mode
              </button>
              <button
                onClick={() => {
                  setSelectedContext('event');
                  setTimeout(testCheckContext, 100);
                }}
                className="p-2 bg-blue-600/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-600/30"
              >
                Event Mode
              </button>
              <button
                onClick={() => {
                  setSelectedContext('bar');
                  setTimeout(testCheckContext, 100);
                }}
                className="p-2 bg-yellow-600/20 border border-yellow-500/30 rounded text-yellow-400 hover:bg-yellow-600/30"
              >
                Bar Mode
              </button>
              <button
                onClick={() => {
                  setSelectedContext('festival');
                  setTimeout(testCheckContext, 100);
                }}
                className="p-2 bg-purple-600/20 border border-purple-500/30 rounded text-purple-400 hover:bg-purple-600/30"
              >
                Festival Mode
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Test Results */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 p-4 rounded-lg border border-gray-700"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Test Results</h3>
        
        {testResults.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No test results yet. Run some tests above to see results here.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {testResults.map((result, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "p-3 rounded border",
                  result.success
                    ? "bg-green-900/20 border-green-500/30"
                    : "bg-red-900/20 border-red-500/30"
                )}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-medium text-sm",
                      result.success ? "text-green-400" : "text-red-400"
                    )}>
                      {result.message}
                    </div>
                    {result.error && (
                      <div className="text-xs text-red-300 mt-1">
                        Error: {result.error}
                      </div>
                    )}
                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          View Details
                        </summary>
                        <pre className="text-xs text-gray-300 mt-1 p-2 bg-black/20 rounded overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-white">Processing test...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GhostPassModesTester;