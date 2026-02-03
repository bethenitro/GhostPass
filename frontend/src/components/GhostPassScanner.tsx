/**
 * Ghost Pass Scanner Component
 * 
 * Comprehensive scanning interface that integrates:
 * - QR code scanning for entry
 * - Automatic wallet surfacing after first scan
 * - Entry tracking and re-entry management
 * - Brightness control for low-light scanning
 * - PWA installation flow
 * - Dual fee structure handling
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  QrCode, 
  Scan, 
  Wallet, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Sun, 
  Moon,
  Zap,
  DollarSign,
  Clock,
  Shield,
  Camera,
  Flashlight,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GhostPassAutoSurface from './GhostPassAutoSurface';

interface ScanResult {
  status: 'APPROVED' | 'DENIED';
  message: string;
  receipt_id: string;
  entry_info?: {
    entry_type: 'initial' | 're_entry';
    entry_number: number;
    fees: {
      initial_entry_fee_cents: number;
      venue_reentry_fee_cents: number;
      valid_reentry_scan_fee_cents: number;
      total_fees_cents: number;
    };
  };
}

interface EntryPermission {
  allowed: boolean;
  entry_type: 'initial' | 're_entry';
  entry_number: number;
  fees?: {
    initial_entry_fee_cents: number;
    venue_reentry_fee_cents: number;
    valid_reentry_scan_fee_cents: number;
    total_fees_cents: number;
  };
  message: string;
  reason?: string;
}

const GhostPassScanner: React.FC = () => {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error'>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [entryPermission, setEntryPermission] = useState<EntryPermission | null>(null);
  const [showAutoSurface, setShowAutoSurface] = useState(false);
  const [brightnessControlled, setBrightnessControlled] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [walletBindingId, setWalletBindingId] = useState('');
  const [venueId, setVenueId] = useState('venue_001');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx?.fillText('fingerprint', 10, 10);
      const fingerprint = canvas.toDataURL();
      return btoa(fingerprint).slice(0, 32);
    };
    
    setDeviceFingerprint(generateFingerprint());
  }, []);

  // Get wallet binding ID from auth/session
  useEffect(() => {
    const getWalletInfo = async () => {
      try {
        const response = await fetch('/api/wallet/balance', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Assuming wallet binding ID is available in wallet data
          setWalletBindingId(data.wallet_binding_id || `wallet_${Date.now()}`);
        }
      } catch (error) {
        console.error('Failed to get wallet info:', error);
        setWalletBindingId(`wallet_${Date.now()}`);
      }
    };
    
    getWalletInfo();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Apply brightness control for scanning
      await applyBrightnessControl();
      
    } catch (error) {
      console.error('Camera access failed:', error);
      setErrorMessage('Camera access required for scanning');
      setScanState('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    restoreBrightness();
  };

  const applyBrightnessControl = async () => {
    try {
      // Request wake lock to prevent screen timeout
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
      }

      // Apply maximum brightness via CSS
      document.body.style.filter = 'brightness(150%)';
      document.body.style.backgroundColor = '#ffffff';
      setBrightnessControlled(true);

    } catch (error) {
      console.warn('Brightness control not available:', error);
    }
  };

  const restoreBrightness = () => {
    document.body.style.filter = '';
    document.body.style.backgroundColor = '';
    setBrightnessControlled(false);
  };

  const toggleFlash = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !flashEnabled } as any]
          });
          setFlashEnabled(!flashEnabled);
        } catch (error) {
          console.warn('Flash control not available:', error);
        }
      }
    }
  };

  const checkEntryPermission = async () => {
    try {
      const response = await fetch('/api/entry-tracking/check-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          venue_id: venueId
        })
      });

      if (response.ok) {
        const permission = await response.json();
        setEntryPermission(permission);
        return permission;
      } else {
        throw new Error('Failed to check entry permission');
      }
    } catch (error) {
      console.error('Entry permission check failed:', error);
      return null;
    }
  };

  const simulateScan = async (qrData: string = 'ghost_pass_demo') => {
    setScanState('processing');
    setErrorMessage('');

    try {
      // First check entry permission
      const permission = await checkEntryPermission();
      
      if (!permission?.allowed) {
        setScanResult({
          status: 'DENIED',
          message: permission?.message || 'Entry denied',
          receipt_id: venueId
        });
        setScanState('error');
        return;
      }

      // Simulate scan validation
      const scanResponse = await fetch('/api/scan/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          pass_id: qrData,
          gateway_id: 'scanner_demo',
          venue_id: venueId
        })
      });

      const result = await scanResponse.json();
      
      if (result.status === 'APPROVED') {
        setScanResult({
          ...result,
          entry_info: {
            entry_type: permission.entry_type,
            entry_number: permission.entry_number,
            fees: permission.fees || {
              initial_entry_fee_cents: 0,
              venue_reentry_fee_cents: 0,
              valid_reentry_scan_fee_cents: 0,
              total_fees_cents: 0
            }
          }
        });
        setScanState('success');

        // Check if this is first scan for wallet surfacing
        const isFirstScan = permission.entry_type === 'initial';
        if (isFirstScan) {
          setTimeout(() => {
            setShowAutoSurface(true);
          }, 1500); // Show after success animation
        }

      } else {
        setScanResult(result);
        setScanState('error');
      }

    } catch (error) {
      console.error('Scan failed:', error);
      setErrorMessage('Scan processing failed');
      setScanState('error');
    }
  };

  const resetScan = () => {
    setScanState('idle');
    setScanResult(null);
    setEntryPermission(null);
    setErrorMessage('');
    stopCamera();
  };

  const handleStartScan = () => {
    setScanState('scanning');
    startCamera();
  };

  const renderScanState = () => {
    switch (scanState) {
      case 'idle':
        return (
          <div className="text-center space-y-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-32 h-32 mx-auto bg-gradient-to-br from-cyan-600 to-blue-600 rounded-full flex items-center justify-center cursor-pointer"
              onClick={handleStartScan}
            >
              <QrCode className="w-16 h-16 text-white" />
            </motion.div>
            
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Ghost Pass Scanner</h2>
              <p className="text-gray-400">Tap to start scanning</p>
            </div>

            {entryPermission && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-2">Entry Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entry Type:</span>
                    <span className="text-cyan-400 capitalize">{entryPermission.entry_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entry Number:</span>
                    <span className="text-white">#{entryPermission.entry_number}</span>
                  </div>
                  {entryPermission.fees && entryPermission.fees.total_fees_cents > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Fees:</span>
                      <span className="text-green-400">${(entryPermission.fees.total_fees_cents / 100).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'scanning':
        return (
          <div className="space-y-4">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-64 bg-black rounded-lg object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Scanning overlay */}
              <div className="absolute inset-0 border-2 border-cyan-400 rounded-lg">
                <div className="absolute inset-4 border border-cyan-400/50 rounded">
                  <motion.div
                    animate={{ y: [0, 200, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-full h-0.5 bg-cyan-400 shadow-lg shadow-cyan-400/50"
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                <button
                  onClick={toggleFlash}
                  className={cn(
                    "p-2 rounded-full",
                    flashEnabled ? "bg-yellow-600" : "bg-gray-800/80"
                  )}
                >
                  <Flashlight className="w-5 h-5 text-white" />
                </button>
                
                <button
                  onClick={() => simulateScan()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-medium"
                >
                  Simulate Scan
                </button>
                
                <button
                  onClick={resetScan}
                  className="p-2 bg-gray-800/80 rounded-full"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {brightnessControlled && (
              <div className="flex items-center justify-center text-yellow-400 text-sm">
                <Sun className="w-4 h-4 mr-2" />
                Brightness optimized for scanning
              </div>
            )}
          </div>
        );

      case 'processing':
        return (
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto"
            >
              <Scan className="w-full h-full text-cyan-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Processing Scan</h3>
              <p className="text-gray-400">Validating entry permissions...</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 mx-auto bg-green-600 rounded-full flex items-center justify-center"
            >
              <CheckCircle className="w-8 h-8 text-white" />
            </motion.div>
            
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Entry Approved</h3>
              <p className="text-gray-400">{scanResult?.message}</p>
            </div>

            {scanResult?.entry_info && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Entry Type:</span>
                  <span className="text-cyan-400 capitalize font-medium">
                    {scanResult.entry_info.entry_type === 'initial' ? 'Initial Entry' : 'Re-Entry'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Entry Number:</span>
                  <span className="text-white font-medium">#{scanResult.entry_info.entry_number}</span>
                </div>

                {scanResult.entry_info.fees.total_fees_cents > 0 && (
                  <div className="border-t border-gray-700 pt-3 space-y-2">
                    <h4 className="text-white font-medium">Fees Charged:</h4>
                    
                    {scanResult.entry_info.fees.initial_entry_fee_cents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Initial Entry:</span>
                        <span className="text-white">${(scanResult.entry_info.fees.initial_entry_fee_cents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {scanResult.entry_info.fees.venue_reentry_fee_cents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Venue Re-entry:</span>
                        <span className="text-white">${(scanResult.entry_info.fees.venue_reentry_fee_cents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {scanResult.entry_info.fees.valid_reentry_scan_fee_cents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Platform Fee:</span>
                        <span className="text-white">${(scanResult.entry_info.fees.valid_reentry_scan_fee_cents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between font-medium border-t border-gray-700 pt-2">
                      <span className="text-white">Total:</span>
                      <span className="text-green-400">${(scanResult.entry_info.fees.total_fees_cents / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={resetScan}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Scan Another
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 mx-auto bg-red-600 rounded-full flex items-center justify-center"
            >
              <AlertTriangle className="w-8 h-8 text-white" />
            </motion.div>
            
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">
                {scanResult?.status === 'DENIED' ? 'Entry Denied' : 'Scan Failed'}
              </h3>
              <p className="text-gray-400">
                {scanResult?.message || errorMessage || 'Please try again'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={resetScan}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={() => checkEntryPermission()}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Check Entry Status
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Ghost Pass Entry</h1>
          <p className="text-gray-400">Secure venue access scanning</p>
        </div>

        {/* Venue Info */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Venue:</span>
            <span className="text-white font-medium">Test Venue</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Wallet:</span>
            <span className="text-cyan-400 font-mono text-sm">
              {walletBindingId.slice(0, 16)}...
            </span>
          </div>
        </div>

        {/* Main Scan Interface */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-6">
          {renderScanState()}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => checkEntryPermission()}
            className="flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 px-4 rounded-lg transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm">Check Status</span>
          </button>
          
          <button
            onClick={() => window.location.hash = '#/wallet'}
            className="flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 px-4 rounded-lg transition-colors"
          >
            <Wallet className="w-4 h-4" />
            <span className="text-sm">View Wallet</span>
          </button>
        </div>
      </div>

      {/* Auto Surface Component */}
      {showAutoSurface && (
        <GhostPassAutoSurface
          walletBindingId={walletBindingId}
          deviceFingerprint={deviceFingerprint}
          venueId={venueId}
          eventName="Test Event"
          venueName="Test Venue"
          onSurfaceComplete={(sessionId) => {
            console.log('✅ Wallet surfaced with session:', sessionId);
            setShowAutoSurface(false);
          }}
          onError={(error) => {
            console.error('❌ Wallet surface error:', error);
            setShowAutoSurface(false);
          }}
        />
      )}
    </div>
  );
};

export default GhostPassScanner;