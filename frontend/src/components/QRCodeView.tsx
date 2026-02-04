import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import QRCodeLib from 'react-qr-code';
import { Shield, AlertTriangle, Clock, Wifi, QrCode as QrCodeIcon, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ghostPassApi } from '../lib/api';

const QRCode = (QRCodeLib as any).default || QRCodeLib;

const QRCodeView: React.FC = () => {
  const [interactionMethod, setInteractionMethod] = useState<'QR' | 'NFC'>('QR');
  const [ghostPass, setGhostPass] = useState<any>(null);
  const [isLoadingGhostPass, setIsLoadingGhostPass] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch ghost pass when component mounts
  useEffect(() => {
    fetchGhostPass();
  }, []);

  const fetchGhostPass = async () => {
    setIsLoadingGhostPass(true);
    setError(null);
    try {
      const pass = await ghostPassApi.getStatus();
      setGhostPass(pass);
    } catch (error) {
      console.error('Failed to fetch ghost pass:', error);
      setError('No active ghost pass found');
      setGhostPass(null);
    } finally {
      setIsLoadingGhostPass(false);
    }
  };

  // Show loading state
  if (isLoadingGhostPass) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading ghost pass...</p>
        </div>
      </div>
    );
  }

  // Show error state if no ghost pass
  if (error || !ghostPass) {
    return (
      <div className="max-w-md mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center"
        >
          <AlertTriangle className="text-red-400 mx-auto mb-4" size={32} />
          <p className="text-red-400 font-semibold mb-2">No Active Ghost Pass</p>
          <p className="text-slate-400 text-sm mb-4">
            {error || 'You need to purchase a ghost pass to generate a QR code'}
          </p>
          <button
            onClick={fetchGhostPass}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  // Check if ghost pass is expired
  const isExpired = ghostPass.status !== 'ACTIVE';
  const expiresAt = new Date(ghostPass.expires_at);
  const now = new Date();
  const isExpiringSoon = (expiresAt.getTime() - now.getTime()) < (24 * 60 * 60 * 1000); // Less than 24 hours

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">GHOST PASS</h1>
        <p className="text-cyan-400 font-medium text-sm sm:text-base">
          {isExpired ? 'EXPIRED' : 'ACTIVE'}
        </p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className={cn(
          "bg-slate-800/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6", 
          isExpired ? "border-red-500/50" : isExpiringSoon ? "border-yellow-500/50" : "border-slate-700"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Ticket className={cn(
                isExpired ? "text-red-400" : "text-emerald-400"
              )} size={20} />
              <span className="text-base sm:text-lg font-semibold text-white">
                {isExpired ? 'PASS EXPIRED' : 'PASS ACTIVE'}
              </span>
            </div>
            <div className={cn(
              "px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border",
              isExpired 
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            )}>
              {isExpired ? 'EXPIRED' : 'LIVE'}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">
                {isExpired ? 'Expired' : 'Expires'}
              </span>
            </div>
            <div className={cn(
              "text-lg sm:text-xl font-bold",
              isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-cyan-400'
            )}>
              {expiresAt.toLocaleDateString()} {expiresAt.toLocaleTimeString()}
            </div>
          </div>
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
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ duration: 0.5 }} 
                className="relative flex items-center justify-center" 
                style={{ filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.5))' }}
              >
                {interactionMethod === 'QR' ? (
                  <QRCode 
                    value={`ghostpass:${ghostPass.id}`} 
                    size={128} 
                    fgColor={isExpired ? "#ef4444" : "#06b6d4"} 
                    bgColor="transparent" 
                    level="M" 
                    style={{height: "auto", maxWidth: "100%", width: "100%"}} 
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center bg-cyan-500/10 border-2 border-cyan-500/30 rounded-xl">
                    <div className="text-center">
                      <Wifi className="text-cyan-400 mx-auto mb-2" size={32} />
                      <div className="text-cyan-400 text-sm font-medium">NFC Ready</div>
                      <div className="text-slate-400 text-xs">Tap to scan</div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
          
          {/* Interaction Method Toggle */}
          <div className="mt-4 flex justify-center">
            <div className="bg-slate-700/30 rounded-lg p-1 flex space-x-1">
              <button
                onClick={() => setInteractionMethod('QR')}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center space-x-2",
                  interactionMethod === 'QR'
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-300"
                )}
              >
                <QrCodeIcon size={14} />
                <span>QR Scan</span>
              </button>
              <button
                onClick={() => setInteractionMethod('NFC')}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center space-x-2",
                  interactionMethod === 'NFC'
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-300"
                )}
              >
                <Wifi size={14} />
                <span>NFC Tap</span>
              </button>
            </div>
          </div>
          
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-slate-400 font-mono text-xs uppercase tracking-wider px-2">
              {interactionMethod === 'QR' ? 'PRESENT CODE AT VENUE ENTRANCE' : 'TAP DEVICE AT NFC READER'}
            </p>
            <div className="text-xs text-slate-500 font-mono break-all mt-2">
              PASS ID: {ghostPass.id}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className={cn(
          "border rounded-xl p-4",
          isExpired 
            ? "bg-red-500/5 border-red-500/20"
            : "bg-cyan-500/5 border-cyan-500/20"
        )}>
          <div className="flex items-start space-x-3">
            <div className={cn(
              "w-2 h-2 rounded-full mt-2 flex-shrink-0",
              isExpired ? "bg-red-400" : "bg-cyan-400"
            )}></div>
            <div className="text-sm">
              <p className={cn(
                "font-semibold mb-1",
                isExpired ? "text-red-400" : "text-cyan-400"
              )}>
                {isExpired ? 'Pass Expired' : 'Ghost Pass Active'}
              </p>
              <p className="text-slate-400">
                {isExpired 
                  ? 'This ghost pass has expired and cannot be used for entry. Purchase a new pass to continue.'
                  : 'Present this QR code at venue entrances for seamless access. Valid until expiration date.'
                }
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {isExpiringSoon && !isExpired && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="text-yellow-400" size={20} />
              <div>
                <p className="text-yellow-400 font-semibold">Pass Expiring Soon</p>
                <p className="text-slate-400 text-sm">Your ghost pass expires in less than 24 hours.</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Refresh Button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <button
          onClick={fetchGhostPass}
          className="w-full py-3 px-4 bg-slate-700/30 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600/30 transition-all duration-300 flex items-center justify-center space-x-2"
        >
          <Shield className="w-4 h-4" />
          <span>Refresh Pass Status</span>
        </button>
      </motion.div>
    </div>
  );
};

export default QRCodeView;