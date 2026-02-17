import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, QrCode, Zap, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import QRCodeLib from 'react-qr-code';
import { useSession } from '../hooks/useSession';

const QRCode = (QRCodeLib as any).default || QRCodeLib;

interface SessionPillProps {
  className?: string;
}

const SessionPill: React.FC<SessionPillProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [showQRModal, setShowQRModal] = useState(false);
  const [isVaporizing, setIsVaporizing] = useState(false);
  const { activeSession, sessionTimeRemaining, isSessionExpiringSoon, vaporizeSession } = useSession();

  const formatTimeRemaining = (timeRemaining: { hours: number; minutes: number; seconds: number }) => {
    if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}:${String(timeRemaining.minutes).padStart(2, '0')}:${String(timeRemaining.seconds).padStart(2, '0')}`;
    }
    return `${timeRemaining.minutes}:${String(timeRemaining.seconds).padStart(2, '0')}`;
  };

  const handleInstantVaporization = async () => {
    if (!activeSession || isVaporizing) return;
    
    setIsVaporizing(true);
    try {
      await vaporizeSession();
      setShowQRModal(false);
    } catch (error) {
      console.error(t('session.failedToVaporize'), error);
    } finally {
      setIsVaporizing(false);
    }
  };

  if (!activeSession || !sessionTimeRemaining) {
    return null;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -20 }}
        className={cn(
          // Check if it's integrated in navbar (has relative positioning)
          className?.includes('!relative') 
            ? "bg-slate-800/50 border rounded-lg" // Navbar integrated style
            : "fixed top-16 right-2 sm:top-20 sm:right-4 md:top-6 md:right-6 z-40 bg-slate-900/95 backdrop-blur-xl border rounded-xl shadow-2xl", // Floating style
          // Size adjustments
          className?.includes('!relative')
            ? "w-auto max-w-[100px]" // Even more compact for navbar
            : "w-[100px] sm:w-[120px] md:w-auto md:max-w-[240px]", // Floating sizes
          isSessionExpiringSoon 
            ? "border-red-500/50 shadow-red-500/20" 
            : "border-cyan-500/50 shadow-cyan-500/20",
          className
        )}
      >
        <div className={cn(
          className?.includes('!relative') ? "p-0.5 space-y-0" : "p-1 sm:p-1.5 md:p-4" // Minimal padding and no vertical spacing when in navbar
        )}>
          {/* Header - Extra compact for mobile */}
          <div className={cn(
            "flex items-center justify-between",
            className?.includes('!relative') ? "mb-0" : "mb-0.5 sm:mb-1"
          )}>
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              <div className={cn(
                "w-1 h-1 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 rounded-full animate-pulse",
                isSessionExpiringSoon ? "bg-red-400" : "bg-cyan-400"
              )} />
              <span className="text-[8px] sm:text-[10px] md:text-xs font-medium text-slate-300 uppercase tracking-wider">
                {t('session.ghost')}
              </span>
            </div>
            <div className={cn(
              "px-0.5 py-0.5 sm:px-1 sm:py-0.5 md:px-2 md:py-1 rounded-full text-[8px] sm:text-[10px] md:text-xs font-medium border",
              isSessionExpiringSoon
                ? "bg-red-500/20 text-red-400 border-red-500/50"
                : "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
            )}>
              {t('session.live')}
            </div>
          </div>

          {/* Time Display - Compact */}
          <div className={cn(
            "flex items-center",
            className?.includes('!relative') ? "space-x-0.5 mb-0" : "space-x-1 sm:space-x-2 mb-1 sm:mb-2"
          )}>
            <motion.div
              animate={{ 
                scale: isSessionExpiringSoon ? [1, 1.1, 1] : 1,
                rotate: isSessionExpiringSoon ? [0, 5, -5, 0] : 0
              }}
              transition={{ 
                duration: isSessionExpiringSoon ? 0.5 : 0,
                repeat: isSessionExpiringSoon ? Infinity : 0,
                repeatDelay: 1
              }}
            >
              <Clock size={8} className={cn(
                className?.includes('!relative') ? "w-2 h-2" : "sm:w-3 sm:h-3 md:w-4 md:h-4",
                isSessionExpiringSoon ? "text-red-400" : "text-cyan-400"
              )} />
            </motion.div>
            <motion.div
              key={`${sessionTimeRemaining.hours}:${sessionTimeRemaining.minutes}:${sessionTimeRemaining.seconds}`}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className={cn(
                "font-bold font-mono",
                className?.includes('!relative') 
                  ? "text-xs" // Much smaller when in navbar
                  : "text-sm sm:text-base md:text-lg",
                isSessionExpiringSoon ? "text-red-400" : "text-cyan-400"
              )}
            >
              {formatTimeRemaining(sessionTimeRemaining)}
            </motion.div>
          </div>

          {/* Session Type - Hidden on mobile for space */}
          <div className="hidden sm:block text-xs text-slate-400 mb-2 md:mb-3">
            {activeSession.session_type.replace('_', ' ').toUpperCase()}
          </div>

          {/* QR Code Button - Ultra compact for mobile */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowQRModal(true)}
            className={cn(
              "w-full flex items-center justify-center rounded-lg font-medium transition-all duration-300 border",
              // Ultra compact height and spacing for mobile navbar
              className?.includes('!relative') 
                ? "py-0 px-1 space-x-0.5 text-[8px] min-h-[20px]" // Minimal height
                : "py-1 sm:py-1.5 md:py-2 px-1 sm:px-2 md:px-3 space-x-1",
              isSessionExpiringSoon
                ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                : "bg-cyan-500/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
            )}
          >
            <QrCode size={6} className="sm:w-3 sm:h-3 md:w-4 md:h-4" />
            <span className={cn(
              className?.includes('!relative') ? "text-[7px] leading-none" : "text-[8px] sm:text-xs md:text-sm"
            )}>
              QR
            </span>
          </motion.button>

          {/* Warning for expiring soon - Hidden on mobile for space */}
          {isSessionExpiringSoon && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="hidden sm:block mt-1.5 md:mt-2 text-xs text-red-400 text-center"
            >
              {t('session.vaporizingSoon')}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* QR Code Modal - Fixed positioning for mobile */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowQRModal(false)}
          >
            {/* Centered container */}
            <div className="min-h-screen flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={cn(
                  "bg-slate-900 border rounded-xl shadow-2xl w-full max-w-sm",
                  // Ensure proper centering and spacing
                  "mx-auto p-4 sm:p-6",
                  isSessionExpiringSoon 
                    ? "border-red-500/30 shadow-red-500/20" 
                    : "border-cyan-500/30 shadow-cyan-500/20"
                )}
                onClick={(e) => e.stopPropagation()}
              >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Zap className={cn(
                    "w-5 h-5",
                    isSessionExpiringSoon ? "text-red-400" : "text-cyan-400"
                  )} />
                  <h3 className="text-lg font-bold text-white">{t('session.ghostSession')}</h3>
                </div>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Time Remaining */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">
                    {t('session.vaporizesIn')}
                  </span>
                </div>
                <motion.div
                  key={`${sessionTimeRemaining.hours}:${sessionTimeRemaining.minutes}:${sessionTimeRemaining.seconds}`}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className={cn(
                    "text-2xl font-bold font-mono",
                    isSessionExpiringSoon ? "text-red-400" : "text-cyan-400"
                  )}
                >
                  {formatTimeRemaining(sessionTimeRemaining)}
                </motion.div>
                <div className="text-xs text-slate-400 mt-1">
                  {activeSession.session_type.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div 
                    className={cn(
                      "relative border rounded-xl p-3 sm:p-4",
                      isSessionExpiringSoon 
                        ? "border-red-500/30 bg-red-500/5" 
                        : "border-cyan-500/30 bg-cyan-500/5"
                    )}
                    style={{
                      background: isSessionExpiringSoon 
                        ? 'radial-gradient(circle at center, rgba(239,68,68,0.05) 0%, transparent 70%)'
                        : 'radial-gradient(circle at center, rgba(6,182,212,0.05) 0%, transparent 70%)'
                    }}
                  >
                    {/* Corner decorations */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={cn(
                        "absolute top-2 left-2 w-3 h-3 border-l-2 border-t-2",
                        isSessionExpiringSoon ? "border-red-500/50" : "border-cyan-500/50"
                      )} />
                      <div className={cn(
                        "absolute top-2 right-2 w-3 h-3 border-r-2 border-t-2",
                        isSessionExpiringSoon ? "border-red-500/50" : "border-cyan-500/50"
                      )} />
                      <div className={cn(
                        "absolute bottom-2 left-2 w-3 h-3 border-l-2 border-b-2",
                        isSessionExpiringSoon ? "border-red-500/50" : "border-cyan-500/50"
                      )} />
                      <div className={cn(
                        "absolute bottom-2 right-2 w-3 h-3 border-r-2 border-b-2",
                        isSessionExpiringSoon ? "border-red-500/50" : "border-cyan-500/50"
                      )} />
                    </div>
                    
                    <div className="relative flex justify-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="relative flex items-center justify-center"
                        style={{ 
                          filter: isSessionExpiringSoon 
                            ? 'drop-shadow(0 0 10px rgba(239,68,68,0.5))'
                            : 'drop-shadow(0 0 10px rgba(6,182,212,0.5))'
                        }}
                      >
                        <QRCode
                          value={activeSession.qr_code || `ghostsession:${activeSession.id}`}
                          size={140}
                          fgColor={isSessionExpiringSoon ? "#ef4444" : "#06b6d4"}
                          bgColor="transparent"
                          level="M"
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center mb-4">
                <p className="text-slate-400 text-sm mb-2">
                  {t('session.presentQRCode')}
                </p>
                <div className="text-xs text-slate-500 font-mono break-all">
                  {t('session.session')}: {activeSession.id.slice(0, 8)}...
                </div>
              </div>

              {/* Instant Vaporization Button */}
              <div className="mb-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInstantVaporization}
                  disabled={isVaporizing}
                  className={cn(
                    "w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-300 border",
                    "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Zap size={16} className={isVaporizing ? "animate-spin" : ""} />
                  <span className="text-sm font-semibold">
                    {isVaporizing ? t('session.vaporizing') : t('session.instantVaporization')}
                  </span>
                </motion.button>
                <p className="text-xs text-slate-500 text-center mt-2">
                  {t('session.immediatelyEnd')}
                </p>
              </div>

              {/* Warning for expiring soon */}
              {isSessionExpiringSoon && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-red-400 text-sm font-medium">
                      {t('session.criticalSessionExpiring')}
                    </span>
                  </div>
                </motion.div>
              )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SessionPill;