import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QRCodeLib from 'react-qr-code';
import { Shield, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { sessionApi } from '../lib/api';
import { cn } from '@/lib/utils';
import SessionSelector from './SessionSelector';
import type { Session } from '../types';

const QRCode = (QRCodeLib as any).default || QRCodeLib;

const QRCodeView: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isVaporizing, setIsVaporizing] = useState(false);
  const [showVaporizeConfirm, setShowVaporizeConfirm] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const { data: sessionStatus, refetch: refetchSession } = useQuery({
    queryKey: ['session-status'],
    queryFn: sessionApi.getStatus,
    refetchInterval: 1000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refetchSession();
  }, [refetchSession]);

  useEffect(() => {
    if (sessionStatus?.session) {
      setActiveSession(sessionStatus.session);
    } else {
      setActiveSession(null);
    }
  }, [sessionStatus]);

  const getTimeRemaining = (expiresAt: string) => {
    const now = currentTime.getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { hours, minutes, seconds, total: diff };
  };

  const sessionTimeRemaining = activeSession?.vaporizes_at ? getTimeRemaining(activeSession.vaporizes_at) : null;
  const isSessionExpired = activeSession?.status !== 'ACTIVE' || !sessionTimeRemaining;
  const isSessionExpiringSoon = sessionTimeRemaining && sessionTimeRemaining.total < 30000;

  const handleInstantVaporize = async () => {
    if (!activeSession) return;
    
    setIsVaporizing(true);
    try {
      await sessionApi.vaporize();
      setActiveSession(null);
      setShowVaporizeConfirm(false);
      refetchSession();
    } catch (error) {
      console.error('Failed to vaporize session:', error);
    } finally {
      setIsVaporizing(false);
    }
  };

  if (!activeSession || isSessionExpired) {
    return (
      <div className="max-w-md mx-auto">
        {isSessionExpired && activeSession && !isCreatingSession && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <AlertTriangle className="text-red-400 mx-auto mb-2" size={32} />
            <p className="text-red-400 font-semibold">Session Vaporized</p>
            <p className="text-slate-400 text-sm mt-1">Create a new session to continue</p>
          </motion.div>
        )}
        <SessionSelector onSessionCreated={(session) => { 
          setIsCreatingSession(true);
          setActiveSession(session); 
          refetchSession();
          setTimeout(() => setIsCreatingSession(false), 500);
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">GHOSTPASS SESSION</h1>
        <p className="text-cyan-400 font-medium text-sm sm:text-base">{activeSession.session_type.replace('_', ' ').toUpperCase()}</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className={cn("bg-slate-800/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6", isSessionExpiringSoon ? "border-red-500/50" : "border-slate-700")}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Shield className="text-emerald-400" size={20} />
              <span className="text-base sm:text-lg font-semibold text-white">SESSION ACTIVE</span>
            </div>
            <div className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">LIVE</div>
          </div>
          {sessionTimeRemaining && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Clock size={14} className="text-slate-400" />
                <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Vaporizes in</span>
              </div>
              <motion.div key={`${sessionTimeRemaining.hours}:${sessionTimeRemaining.minutes}:${sessionTimeRemaining.seconds}`} initial={{ scale: 0.95 }} animate={{ scale: 1 }} className={cn("text-3xl sm:text-4xl font-bold font-mono", isSessionExpiringSoon ? 'text-red-400' : 'text-cyan-400')}>
                {String(sessionTimeRemaining.hours).padStart(2, '0')}:{String(sessionTimeRemaining.minutes).padStart(2, '0')}:{String(sessionTimeRemaining.seconds).padStart(2, '0')}
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex justify-center">
        <div className="relative">
          <div className="relative bg-slate-800/30 border border-white/10 rounded-xl p-3 sm:p-4 md:p-6" style={{background: 'radial-gradient(circle at center, rgba(6,182,212,0.05) 0%, transparent 70%)'}}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-2 w-3 h-3 sm:w-4 sm:h-4 border-l-2 border-t-2 border-cyan-500/50" />
              <div className="absolute top-2 right-2 w-3 h-3 sm:w-4 sm:h-4 border-r-2 border-t-2 border-cyan-500/50" />
              <div className="absolute bottom-2 left-2 w-3 h-3 sm:w-4 sm:h-4 border-l-2 border-b-2 border-cyan-500/50" />
              <div className="absolute bottom-2 right-2 w-3 h-3 sm:w-4 sm:h-4 border-r-2 border-b-2 border-cyan-500/50" />
            </div>
            <div className="relative flex justify-center">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="relative flex items-center justify-center" style={{ filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.5))' }}>
                <QRCode value={activeSession.qr_code || `ghostsession:${activeSession.id}`} size={128} fgColor="#06b6d4" bgColor="transparent" level="M" style={{height: "auto", maxWidth: "100%", width: "100%"}} />
              </motion.div>
            </div>
          </div>
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-slate-400 font-mono text-xs uppercase tracking-wider px-2">PRESENT CODE AT VENUE ENTRANCE</p>
            <div className="text-xs text-slate-500 font-mono break-all mt-2">SESSION ID: {activeSession.id}</div>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
            <div className="text-sm">
              <p className="font-semibold text-cyan-400 mb-1">Vaporization Protocol</p>
              <p className="text-slate-400">This session QR code vaporizes automatically after the selected time. No reuse or extension possible. Single-use only.</p>
            </div>
          </div>
        </div>
      </motion.div>
      {isSessionExpiringSoon && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="text-red-400" size={20} />
              <div>
                <p className="text-red-400 font-semibold">Critical Warning</p>
                <p className="text-slate-400 text-sm">Session vaporizes in less than 30 seconds. No extension possible.</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Instant Vaporization Button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <button
          onClick={() => setShowVaporizeConfirm(true)}
          disabled={isVaporizing}
          className="w-full py-3 px-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-semibold hover:bg-red-500/20 transition-all duration-300 flex items-center justify-center space-x-2 group"
          title="Immediately ends the active Ghost Pass session and invalidates the QR code"
        >
          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>INSTANT VAPORIZATION</span>
        </button>
        <p className="text-slate-500 text-xs text-center mt-2">
          Immediately ends the active session and invalidates the QR code
        </p>
      </motion.div>

      {/* Vaporize Confirmation Modal */}
      {showVaporizeConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !isVaporizing && setShowVaporizeConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-red-500/30 rounded-xl shadow-2xl shadow-red-500/20 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <Trash2 className="text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-red-400">Instant Vaporization</h3>
            </div>

            <p className="text-slate-300 mb-6">
              Are you sure you want to immediately vaporize this session? This will:
            </p>

            <ul className="space-y-2 mb-6 text-sm text-slate-400">
              <li className="flex items-start space-x-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Immediately end the active Ghost Pass session</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Invalidate the QR code instantly</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>Cannot be undone or recovered</span>
              </li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setShowVaporizeConfirm(false)}
                disabled={isVaporizing}
                className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInstantVaporize}
                disabled={isVaporizing}
                className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg font-medium hover:bg-red-500/30 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isVaporizing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                    <span>Vaporizing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Vaporize Now</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default QRCodeView;
