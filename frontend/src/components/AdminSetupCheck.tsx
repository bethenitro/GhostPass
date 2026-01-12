import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface AdminSetupCheckProps {
  onSetupComplete: () => void;
}

interface HealthStatus {
  status: string;
  admin_user: string;
  admin_role: string;
  tables: Record<string, string>;
  message: string;
}

const AdminSetupCheck: React.FC<AdminSetupCheckProps> = ({ onSetupComplete }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getHealth();
      setHealth(data);
      
      if (data.status === 'healthy') {
        setTimeout(() => onSetupComplete(), 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="glass-panel p-6 md:p-8 w-full max-w-md border-red-500/30">
          <div className="flex items-center space-x-3 mb-4">
            <RefreshCw className="text-red-400 animate-spin flex-shrink-0" size={20} />
            <h2 className="text-lg md:text-xl font-bold text-red-400">Checking Admin Setup</h2>
          </div>
          <p className="text-slate-300 text-sm">Verifying admin system configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="glass-panel p-6 md:p-8 w-full max-w-md border-red-500/30">
          <div className="flex items-center space-x-3 mb-4">
            <XCircle className="text-red-400 flex-shrink-0" size={20} />
            <h2 className="text-lg md:text-xl font-bold text-red-400">Setup Check Failed</h2>
          </div>
          <p className="text-slate-300 mb-4 text-sm">{error}</p>
          <button
            onClick={checkHealth}
            className="w-full px-4 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const isHealthy = health.status === 'healthy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel p-6 md:p-8 w-full max-w-2xl border-red-500/30 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center space-x-3 mb-6">
          {isHealthy ? (
            <CheckCircle className="text-emerald-400 flex-shrink-0" size={20} />
          ) : (
            <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
          )}
          <h2 className="text-lg md:text-xl font-bold text-red-400">
            {isHealthy ? 'Admin System Ready' : 'Setup Required'}
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-slate-300 mb-2 text-sm">
              <strong>Admin User:</strong> {health.admin_user} ({health.admin_role})
            </p>
            <p className="text-slate-300 mb-4 text-sm">
              <strong>Status:</strong> {health.message}
            </p>
          </div>

          <div>
            <h3 className="text-base md:text-lg font-semibold text-red-400 mb-3">System Components:</h3>
            <div className="space-y-2">
              {Object.entries(health.tables).map(([table, status]) => (
                <div key={table} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-300 font-mono text-xs md:text-sm break-all">{table}</span>
                  <span className={`text-xs md:text-sm ml-2 flex-shrink-0 ${status.includes('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {status.includes('✅') ? '✅' : '❌'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!isHealthy && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <h4 className="text-yellow-400 font-semibold mb-2 text-sm">Setup Instructions:</h4>
              <ol className="text-xs md:text-sm text-yellow-300 space-y-1 list-decimal list-inside">
                <li>Go to Supabase Dashboard → SQL Editor</li>
                <li>Copy and paste the contents of <code className="bg-yellow-500/20 px-1 rounded">backend/admin_schema.sql</code></li>
                <li>Click "Run" to execute the SQL</li>
                <li>Click "Retry" below to check again</li>
              </ol>
            </div>
          )}

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={checkHealth}
              className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
            >
              Retry Check
            </button>
            {isHealthy && (
              <button
                onClick={onSetupComplete}
                className="flex-1 px-4 py-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm"
              >
                Continue to Command Center
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSetupCheck;