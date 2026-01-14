import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { sessionApi } from '../lib/api';
import { cn } from '@/lib/utils';
import type { Session, SessionStatusResponse } from '../types';

interface SessionSelectorProps {
  onSessionCreated: (session: Session) => void;
  onCancel: () => void;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({ onSessionCreated, onCancel }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedType, setSelectedType] = useState<'30_seconds' | '3_minutes' | '10_minutes' | null>(null);

  const sessionOptions = [
    {
      type: '30_seconds' as const,
      label: '30 Seconds',
      duration: 30,
      description: 'Quick access session',
      icon: '⚡'
    },
    {
      type: '3_minutes' as const,
      label: '3 Minutes',
      duration: 180,
      description: 'Standard session',
      icon: '⏱️'
    },
    {
      type: '10_minutes' as const,
      label: '10 Minutes',
      duration: 600,
      description: 'Extended session',
      icon: '🕐'
    }
  ];

  const handleCreateSession = async () => {
    if (!selectedType) return;

    setIsCreating(true);
    try {
      const response: SessionStatusResponse = await sessionApi.create(selectedType);
      if (response.session) {
        onSessionCreated(response.session);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">GHOSTPASS SESSION</h1>
        <p className="text-cyan-400 font-medium text-sm">Choose your vaporization time</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Session Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <div className="grid gap-3">
          {sessionOptions.map((option, index) => (
            <motion.div
              key={option.type}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={cn(
                "bg-slate-800/50 backdrop-blur-xl border rounded-xl p-4 cursor-pointer transition-all duration-300",
                selectedType === option.type
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-slate-700 hover:border-cyan-500/30 hover:bg-cyan-500/5"
              )}
              onClick={() => setSelectedType(option.type)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{option.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{option.label}</h3>
                    <p className="text-slate-400 text-sm">{option.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-cyan-400 font-mono text-sm">
                    {option.duration < 60
                      ? `${option.duration}s`
                      : `${Math.floor(option.duration / 60)}m ${option.duration % 60}s`
                    }
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex space-x-4"
      >
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg font-semibold hover:bg-slate-700/70 transition-colors"
        >
          Cancel
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleCreateSession}
          disabled={!selectedType || isCreating}
          className={cn(
            "flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2",
            selectedType && !isCreating
              ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
              : "bg-slate-700/50 border border-slate-600 text-slate-500 cursor-not-allowed"
          )}
        >
          {isCreating ? (
            <>
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <span>CREATING...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>START SESSION</span>
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
            <div className="text-sm">
              <p className="font-semibold text-red-400 mb-1">Vaporization Protocol</p>
              <p className="text-slate-400">Session vaporizes automatically after selected time. No reuse or extension possible. Choose wisely.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SessionSelector;