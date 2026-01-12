import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {QRCode} from 'react-qr-code';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ghostPassApi } from '../lib/api';
import { cn } from '@/lib/utils';

const QRCodeView: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: ghostPass, refetch } = useQuery({
    queryKey: ['ghostpass-status'],
    queryFn: ghostPassApi.getStatus,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

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

  const timeRemaining = ghostPass?.expires_at ? getTimeRemaining(ghostPass.expires_at) : null;
  const isExpired = ghostPass?.status !== 'ACTIVE' || !timeRemaining;
  const isExpiringSoon = timeRemaining && timeRemaining.total < 3600000;

  if (!ghostPass) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-8 text-center">
            <AlertTriangle className="text-yellow-400 mx-auto mb-4" size={48} />
            <h2 className="text-2xl font-semibold text-white mb-2">No Active Pass</h2>
            <p className="text-slate-400">Purchase a GhostPass to access venue features</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">GHOST PASS</h1>
        {ghostPass.venue_name && (
          <p className="text-cyan-400 font-medium text-sm sm:text-base">
            ESTABLISHMENT: {ghostPass.venue_name.toUpperCase()}
          </p>
        )}
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-4"></div>
      </motion.div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={cn(
          "bg-slate-800/50 backdrop-blur-xl border rounded-xl p-4 sm:p-6",
          isExpiringSoon ? "border-red-500/50" : "border-slate-700"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Shield className={cn(
                isExpired ? 'text-red-400' : 'text-emerald-400'
              )} size={20} />
              <span className="text-base sm:text-lg font-semibold text-white">STATUS</span>
            </div>
            <div className={cn(
              "px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border",
              isExpired ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            )}>
              {isExpired ? 'EXPIRED' : 'ACTIVE'}
            </div>
          </div>

          {!isExpired && timeRemaining && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Clock size={14} className="text-slate-400" />
                <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">Expires in</span>
              </div>
              <motion.div
                key={`${timeRemaining.hours}:${timeRemaining.minutes}:${timeRemaining.seconds}`}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className={cn(
                  "text-2xl sm:text-3xl font-bold font-mono",
                  isExpiringSoon ? 'text-red-400' : 'text-cyan-400'
                )}
              >
                {String(timeRemaining.hours).padStart(2, '0')}:
                {String(timeRemaining.minutes).padStart(2, '0')}:
                {String(timeRemaining.seconds).padStart(2, '0')}
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>

      {/* QR Scanner Frame */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        <div className="relative">
          
          {/* QR Frame - Matching synth-dashboard style */}
          <div className="relative bg-slate-800/30 border border-white/10 rounded-xl p-3 sm:p-4 md:p-6" style={{
            background: 'radial-gradient(circle at center, rgba(6,182,212,0.05) 0%, transparent 70%)'
          }}>
            
            {/* Corner Brackets */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top Left */}
              <div className="absolute top-2 left-2 w-3 h-3 sm:w-4 sm:h-4 border-l-2 border-t-2 border-cyan-500/50" />
              {/* Top Right */}
              <div className="absolute top-2 right-2 w-3 h-3 sm:w-4 sm:h-4 border-r-2 border-t-2 border-cyan-500/50" />
              {/* Bottom Left */}
              <div className="absolute bottom-2 left-2 w-3 h-3 sm:w-4 sm:h-4 border-l-2 border-b-2 border-cyan-500/50" />
              {/* Bottom Right */}
              <div className="absolute bottom-2 right-2 w-3 h-3 sm:w-4 sm:h-4 border-r-2 border-b-2 border-cyan-500/50" />
            </div>

            {/* QR Code or Placeholder */}
            <div className="relative flex justify-center">
              {isExpired ? (
                // Expired State
                <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center border-2 border-dashed border-red-500/50 rounded-lg bg-red-500/10">
                  <div className="text-center">
                    <AlertTriangle className="text-red-400 mx-auto mb-2 sm:mb-3" size={32} />
                    <p className="text-red-400 font-bold text-base sm:text-lg">EXPIRED</p>
                    <p className="text-slate-400 text-xs sm:text-sm">Renew Required</p>
                  </div>
                </div>
              ) : (
                // Active QR Code
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.5))' }}
                >
                  <QRCode
                    value={ghostPass.qr_code || `ghostpass:${ghostPass.id}`}
                    size={128} // Smaller base size for mobile
                    className="w-32 h-32 sm:w-40 sm:h-40" // Responsive sizing
                    fgColor="#06b6d4"
                    bgColor="transparent"
                    level="M"
                  />
                </motion.div>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-slate-400 font-mono text-xs uppercase tracking-wider px-2">
              {isExpired ? 'PASS EXPIRED - RENEWAL REQUIRED' : 'PRESENT CODE AT VENUE ENTRANCE'}
            </p>
            <div className="text-xs text-slate-500 font-mono break-all mt-2">
              ID: {ghostPass.id}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Security Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
            <div className="text-sm">
              <p className="font-semibold text-cyan-400 mb-1">Security Protocol</p>
              <p className="text-slate-400">This QR code is unique to your account. Do not share or screenshot. Code refreshes automatically every 30 seconds.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Expiration Warning */}
      {isExpiringSoon && !isExpired && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="text-red-400" size={20} />
              <div>
                <p className="text-red-400 font-semibold">Critical Warning</p>
                <p className="text-slate-400 text-sm">Pass expires in less than 1 hour. Immediate renewal recommended.</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default QRCodeView;