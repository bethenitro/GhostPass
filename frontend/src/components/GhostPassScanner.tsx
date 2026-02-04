/**
 * Ghost Pass Scanner Component
 * 
 * Uses html5-qrcode library for reliable QR code scanning with:
 * - Real QR code scanning for entry
 * - Automatic wallet surfacing after first scan
 * - Entry tracking and re-entry management
 * - Brightness control for low-light scanning
 * - PWA installation flow
 * - Dual fee structure handling
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Sun,
  Shield,
  Zap,
  Camera,
  Target,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GhostPassAutoSurface from './GhostPassAutoSurface';

// HTML5 QR Code scanner
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

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
  const [errorMessage, setErrorMessage] = useState('');
  const [walletBindingId, setWalletBindingId] = useState('');
  const [venueId] = useState('venue_001');
  const [gatewayId] = useState('00000000-0000-0000-0000-000000000001'); // Valid UUID for scanner demo
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const processingRef = React.useRef(false);
  
  const scannerElementId = 'qr-scanner-container';

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
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Assuming wallet binding ID is available in wallet data
          setWalletBindingId(data.wallet_binding_id || `wallet_${Date.now()}`);
        } else {
          // If API call fails, generate a fallback wallet ID
          setWalletBindingId(`wallet_${Date.now()}`);
        }
      } catch (error) {
        console.error('Failed to get wallet info:', error);
        setWalletBindingId(`wallet_${Date.now()}`);
      }
    };
    
    getWalletInfo();
  }, []);

  // Scanner instance ref
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        try {
          if (scannerRef.current) {
            const currentState = scannerRef.current.getState();
            if (currentState === Html5QrcodeScannerState.SCANNING) {
              await scannerRef.current.stop();
            }
            // Clear the scanner reference
            scannerRef.current = null;
          }
          restoreBrightness();
        } catch (error) {
          console.error('Cleanup error:', error);
          restoreBrightness();
        }
      };
      
      cleanup();
    };
  }, []);

  const startCamera = async () => {
    try {
      setScanState('scanning');
      setIsScanning(true);
      setErrorMessage('');
      
      // Check for camera permissions first
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Request camera permission explicitly
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
          });
          // Stop the test stream immediately
          stream.getTracks().forEach(track => track.stop());
        } catch (permissionError) {
          console.error('Camera permission denied:', permissionError);
          setErrorMessage('Camera permission required. Please allow camera access and try again.');
          setScanState('error');
          setIsScanning(false);
          return;
        }
      }
      
      // Apply brightness control for scanning
      await applyBrightnessControl();
      
      // Initialize scanner only when needed
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerElementId);
      }
      
      // Check if scanner is already running
      if (scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop();
      }
      
      // Start scanning with back camera
      await scannerRef.current.start(
        { facingMode: "environment" }, // Use back camera
        {
          fps: 10, // Frame per second for scanning
          qrbox: { width: 250, height: 250 }, // Scanning area
          aspectRatio: 1.0, // Square aspect ratio
          disableFlip: false // Allow camera flip if needed
        },
        (decodedText: string, _decodedResult: any) => {
          // QR Code successfully scanned - prevent multiple processing
          if (!processingRef.current) {
            processingRef.current = true;
            console.log('QR Code detected:', decodedText);
            processScan(decodedText);
          }
        },
        (_errorMessage: string) => {
          // Scanning error (ignore most of these as they're normal)
          // Only log significant errors
          if (_errorMessage.includes('NotAllowedError') || _errorMessage.includes('NotFoundError')) {
            console.error('Camera error:', _errorMessage);
          }
        }
      );
      
    } catch (error) {
      console.error('Camera access failed:', error);
      let errorMsg = 'Camera access failed. ';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMsg += 'Please allow camera permissions and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMsg += 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
          errorMsg += 'Camera not supported on this device.';
        } else {
          errorMsg += 'Please check camera permissions and try again.';
        }
      } else {
        errorMsg += 'Please check camera permissions and try again.';
      }
      
      setErrorMessage(errorMsg);
      setScanState('error');
      setIsScanning(false);
      restoreBrightness();
    }
  };

  const stopCamera = async () => {
    try {
      setIsScanning(false);
      
      // Stop the scanner if it's running
      if (scannerRef.current) {
        const currentState = scannerRef.current.getState();
        if (currentState === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      }
      
      // Restore brightness and cleanup
      restoreBrightness();
      
    } catch (error) {
      console.error('Failed to stop camera:', error);
      // Force cleanup even if stop fails
      restoreBrightness();
    }
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

  const resetScan = async () => {
    setScanState('idle');
    setScanResult(null);
    setEntryPermission(null);
    setErrorMessage('');
    processingRef.current = false;
    await stopCamera();
  };

  const handleStartScan = () => {
    // Reset processing state before starting
    processingRef.current = false;
    startCamera();
  };

  const checkEntryPermission = async () => {
    setIsCheckingStatus(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/entry-tracking/check-permission`, {
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
        const errorData = await response.text();
        console.error('Entry permission check failed:', response.status, errorData);
        
        // Set a default permission structure for debugging
        const fallbackPermission = {
          allowed: false,
          entry_type: 'initial' as const,
          entry_number: 1,
          message: `API Error: ${response.status} - ${errorData || 'Unknown error'}`,
          reason: 'api_error'
        };
        setEntryPermission(fallbackPermission);
        return fallbackPermission;
      }
    } catch (error) {
      console.error('Entry permission check failed:', error);
      
      // Set a fallback permission for network errors
      const fallbackPermission = {
        allowed: false,
        entry_type: 'initial' as const,
        entry_number: 1,
        message: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reason: 'network_error'
      };
      setEntryPermission(fallbackPermission);
      return fallbackPermission;
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const processScan = async (qrData: string) => {
    // Stop camera immediately to prevent multiple scans
    await stopCamera();
    
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

      // Extract UUID from QR data if it has a prefix
      let passId = qrData;
      if (qrData.includes(':')) {
        // Handle formats like "ghostsession:uuid" or "ghostpass:uuid"
        const parts = qrData.split(':');
        if (parts.length >= 2) {
          passId = parts[parts.length - 1]; // Get the last part (UUID)
        }
      }

      // Validate that we have a proper UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(passId)) {
        setScanResult({
          status: 'DENIED',
          message: 'Invalid QR code format',
          receipt_id: venueId
        });
        setScanState('error');
        return;
      }

      // Process the actual scan with the extracted UUID
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const scanResponse = await fetch(`${API_BASE_URL}/scan/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          pass_id: passId, // Use extracted UUID
          gateway_id: gatewayId, // Use valid UUID
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
          // Force wallet surfacing immediately after successful scan
          setTimeout(() => {
            setShowAutoSurface(true);
          }, 1000); // Show after success animation
        }

      } else {
        // Handle specific error messages
        let errorMessage = result.message || 'Scan failed';
        if (errorMessage.includes('Invalid gateway location')) {
          errorMessage = 'Scanner not configured. Please contact administrator to set up gateway entry.';
        }
        
        setScanResult({
          ...result,
          message: errorMessage
        });
        setScanState('error');
      }

    } catch (error) {
      console.error('Scan failed:', error);
      setErrorMessage('Scan processing failed');
      setScanState('error');
    } finally {
      processingRef.current = false;
    }
  };




  const renderScanState = () => {
    switch (scanState) {
      case 'idle':
        return (
          <div className="space-y-6">
            {/* Hero Scan Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative mx-auto mb-4 sm:mb-6 cursor-pointer group"
                onClick={handleStartScan}
              >
                {/* Outer glow ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl group-hover:blur-2xl transition-all duration-500" />
                
                {/* Main scan button - responsive sizing */}
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-full flex items-center justify-center group-hover:border-cyan-400/50 transition-all duration-300">
                  {/* Inner glow */}
                  <div className="absolute inset-3 sm:inset-4 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
                  
                  {/* Scan icon */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="relative z-10"
                  >
                    <Target className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                  </motion.div>
                  
                  {/* Corner brackets */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-3 left-3 sm:top-4 sm:left-4 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-t-2 border-cyan-500/60 rounded-tl-lg" />
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-t-2 border-cyan-500/60 rounded-tr-lg" />
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-b-2 border-cyan-500/60 rounded-bl-lg" />
                    <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-b-2 border-cyan-500/60 rounded-br-lg" />
                  </div>
                </div>
              </motion.div>
              
              <div className="space-y-1 sm:space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white">GHOST PASS SCANNER</h2>
                <p className="text-cyan-400 font-medium text-sm sm:text-base">TAP TO INITIATE SCAN</p>
                <p className="text-slate-400 text-xs sm:text-sm">Secure venue entry validation</p>
              </div>
            </motion.div>

            {/* Entry Status Card */}
            {entryPermission && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    entryPermission.allowed ? "bg-emerald-400" : "bg-red-400"
                  )} />
                  <h3 className="text-lg font-semibold text-white">Entry Status</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400 block">Entry Type</span>
                    <span className="text-cyan-400 font-medium capitalize">
                      {entryPermission.entry_type.replace('_', ' ')}
                    </span>
                  </div>
                  {entryPermission.fees && entryPermission.fees.total_fees_cents > 0 && (
                    <div>
                      <span className="text-slate-400 block">Total Fees</span>
                      <span className="text-emerald-400 font-bold text-lg">
                        ${(entryPermission.fees.total_fees_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        );

      case 'scanning':
        return (
          <div className="space-y-4">
            {/* Scanner Container with simple styling */}
            <div className="relative">
              <div className="relative bg-slate-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-xl overflow-hidden">
                {/* Scanner element - responsive height */}
                <div 
                  id={scannerElementId}
                  className="w-full rounded-xl overflow-hidden"
                  style={{ minHeight: '280px' }} // Reduced for mobile
                />
                
                {/* Simple scanning overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Top status bar */}
                  <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-10">
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-400 rounded-full animate-pulse" />
                        <span className="text-cyan-400 text-xs sm:text-sm font-medium">
                          {isScanning ? 'SCANNING FOR QR CODES' : 'INITIALIZING CAMERA'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Simple corner guides - responsive sizing */}
                  <div className="absolute inset-6 sm:inset-8">
                    <div className="absolute top-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-t-2 border-cyan-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-t-2 border-cyan-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-b-2 border-cyan-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-b-2 border-cyan-400 rounded-br-lg" />
                  </div>
                </div>

                {/* Bottom controls */}
                <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 flex justify-center z-10">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetScan}
                    className="flex items-center space-x-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 backdrop-blur-sm rounded-lg px-4 sm:px-6 py-2 sm:py-3 text-red-400 font-medium transition-all duration-300 text-sm sm:text-base"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>STOP SCAN</span>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Brightness indicator */}
            {brightnessControlled && (
              <div className="flex items-center justify-center space-x-2 text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/30 rounded-lg py-2 px-4">
                <Sun className="w-4 h-4" />
                <span>Brightness optimized for scanning</span>
              </div>
            )}
            
            {/* Simple instructions */}
            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Camera className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-white font-medium">Scanning Instructions</p>
                  <ul className="text-slate-400 text-sm space-y-1">
                    <li>• Point camera at QR code</li>
                    <li>• Ensure good lighting</li>
                    <li>• Hold steady for best results</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center space-y-6">
            {/* Processing animation */}
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 mx-auto"
              >
                <div className="w-full h-full border-4 border-cyan-500/20 border-t-cyan-400 rounded-full" />
              </motion.div>
              
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Zap className="w-8 h-8 text-cyan-400" />
              </motion.div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">PROCESSING SCAN</h3>
              <p className="text-cyan-400">Validating entry permissions...</p>
              <div className="flex items-center justify-center space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 bg-cyan-400 rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            {/* Success icon - no animation */}
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/50">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-emerald-400">ENTRY APPROVED</h3>
              <p className="text-slate-300">{scanResult?.message}</p>
            </div>

            {/* Entry details card */}
            {scanResult?.entry_info && (
              <div className="bg-slate-800/50 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Entry Type</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-emerald-400 font-semibold capitalize">
                      {scanResult.entry_info.entry_type === 'initial' ? 'Initial Entry' : 'Re-Entry'}
                    </span>
                  </div>
                </div>

                {scanResult.entry_info.fees.total_fees_cents > 0 && (
                  <div className="border-t border-slate-700 pt-4 space-y-3">
                    <h4 className="text-white font-semibold flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Fees Processed</span>
                    </h4>
                    
                    <div className="space-y-2">
                      {scanResult.entry_info.fees.initial_entry_fee_cents > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Initial Entry</span>
                          <span className="text-white font-medium">${(scanResult.entry_info.fees.initial_entry_fee_cents / 100).toFixed(2)}</span>
                        </div>
                      )}
                      
                      {scanResult.entry_info.fees.venue_reentry_fee_cents > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Venue Re-entry</span>
                          <span className="text-white font-medium">${(scanResult.entry_info.fees.venue_reentry_fee_cents / 100).toFixed(2)}</span>
                        </div>
                      )}
                      
                      {scanResult.entry_info.fees.valid_reentry_scan_fee_cents > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Platform Fee</span>
                          <span className="text-white font-medium">${(scanResult.entry_info.fees.valid_reentry_scan_fee_cents / 100).toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-bold text-lg border-t border-slate-700 pt-2">
                        <span className="text-white">Total Charged</span>
                        <span className="text-emerald-400">${(scanResult.entry_info.fees.total_fees_cents / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={resetScan}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/25"
            >
              SCAN ANOTHER PASS
            </motion.button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            {/* Error icon - no animation */}
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/50">
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-red-400">
                {scanResult?.status === 'DENIED' ? 'ENTRY DENIED' : 'SCAN FAILED'}
              </h3>
              <p className="text-slate-300 max-w-sm mx-auto">
                {scanResult?.message || errorMessage || 'Please try scanning again'}
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={resetScan}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/25"
              >
                TRY AGAIN
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={checkEntryPermission}
                disabled={isCheckingStatus}
                className="w-full bg-slate-700/50 hover:bg-slate-600/50 disabled:bg-slate-800/50 disabled:cursor-not-allowed border border-slate-600 text-slate-300 font-medium py-3 px-6 rounded-xl transition-all duration-300"
              >
                {isCheckingStatus ? (
                  <div className="flex items-center justify-center space-x-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"
                    />
                    <span>CHECKING STATUS...</span>
                  </div>
                ) : (
                  'CHECK ENTRY STATUS'
                )}
              </motion.button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-safe">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-6 sm:py-8"
        >
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-400 rounded-full animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">GHOST PASS</h1>
          <p className="text-cyan-400 font-medium text-sm sm:text-base">ENTRY SCANNER</p>
          <div className="w-20 sm:w-24 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto mt-3 sm:mt-4" />
        </motion.div>

        {/* Venue Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6"
        >
          <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-400 rounded-full animate-pulse" />
            <h3 className="text-base sm:text-lg font-semibold text-white">Scanner Status</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Venue</span>
              <span className="text-white font-medium">Test Venue</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Gateway</span>
              <span className="text-cyan-400 font-mono text-xs">
                {gatewayId.slice(0, 8)}...{gatewayId.slice(-4)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Wallet</span>
              <span className="text-cyan-400 font-mono text-xs">
                {walletBindingId.slice(0, 12)}...
              </span>
            </div>
          </div>
        </motion.div>

        {/* Main Scan Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/50 backdrop-blur-xl border border-slate-700 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={scanState}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {renderScanState()}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center mx-4 mb-6 sm:mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              // Check for existing wallet session
              const walletSession = localStorage.getItem('ghost_pass_wallet_session');
              if (walletSession) {
                // Open main app in new tab - wallet tab is default
                window.open(`${window.location.origin}/`, '_blank', 'noopener,noreferrer');
              } else {
                // Navigate to main app in current window
                window.location.href = `${window.location.origin}/`;
              }
            }}
            className="flex items-center justify-center space-x-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-all duration-300 backdrop-blur-sm"
          >
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">
              {localStorage.getItem('ghost_pass_wallet_session') ? 'Open Wallet' : 'View Wallet'}
            </span>
          </motion.button>
        </motion.div>
      </div>

      {/* Auto Surface Component */}
      <AnimatePresence>
        {showAutoSurface && (
          <GhostPassAutoSurface
            walletBindingId={walletBindingId}
            deviceFingerprint={deviceFingerprint}
            venueId={venueId}
            eventName="Test Event"
            venueName="Test Venue"
            onSurfaceComplete={(sessionId) => {
              console.log('✅ Wallet surfaced with session:', sessionId);
              // Keep the auto surface visible for a moment before closing
              setTimeout(() => {
                setShowAutoSurface(false);
              }, 500);
            }}
            onError={(error) => {
              console.error('❌ Wallet surface error:', error);
              // Close auto surface on error
              setTimeout(() => {
                setShowAutoSurface(false);
              }, 2000);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GhostPassScanner;