import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Lock, Mail, ArrowRight, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperatorLoginProps {
  onLoginSuccess: (token: string, user: any) => void;
  onCancel: () => void;
}

const OperatorLogin: React.FC<OperatorLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();

      // Check if user has admin or operator role
      if (data.user.role !== 'ADMIN' && data.user.role !== 'VENDOR') {
        throw new Error('Access denied. Operator credentials required.');
      }

      // Store auth token
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify(data.user));

      onLoginSuccess(data.access_token, data.user);
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 rounded-xl p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/50">
            <Building2 className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Operator Portal</h2>
          <p className="text-slate-400">Sign in to access the Command Center</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-2">
            <label className="text-slate-300 text-sm font-medium flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@example.com"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-slate-300 text-sm font-medium flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
            >
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Info */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Shield className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-400 text-xs">
                This portal is for venue operators and administrators only. All actions are audit-logged.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 disabled:bg-slate-800/50 disabled:cursor-not-allowed border border-slate-600 rounded-lg text-slate-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className={cn(
                "px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2",
                isLoading || !email.trim() || !password.trim()
                  ? "bg-slate-700/50 border border-slate-600 text-slate-500 cursor-not-allowed"
                  : "bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default OperatorLogin;
