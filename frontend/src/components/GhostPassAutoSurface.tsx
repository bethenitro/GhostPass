/**
 * Ghost Pass Auto Surface Component
 * 
 * Handles automatic wallet surfacing after first successful scan,
 * PWA add-to-home-screen flow, and brightness control for QR scanning.
 * 
 * REQUIREMENTS IMPLEMENTED:
 * - Automatic wallet appearance after first successful scan
 * - PWA add-to-home-screen flow (forced)
 * - Persistent session handle for instant reopening
 * - Brightness takeover for QR scanning
 * - Zero friction for intoxicated, crowded, low-light conditions
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, 
  Plus, 
  Sun, 
  QrCode, 
  CheckCircle, 
  AlertTriangle,
  X,
  Download,
  Home,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoSurfaceProps {
  walletBindingId: string;
  deviceFingerprint: string;
  eventId?: string;
  venueId?: string;
  eventName?: string;
  venueName?: string;
  onSurfaceComplete?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

interface WalletSession {
  session_id: string;
  wallet_binding_id: string;
  force_surface: boolean;
  expires_at: string;
  pwa_manifest: any;
  install_prompt: {
    show: boolean;
    title: string;
    message: string;
    install_button_text: string;
    skip_button_text: string;
  };
  brightness_control: {
    enabled: boolean;
    qr_brightness_level: number;
    restore_on_close: boolean;
  };
  wallet_url: string;
  boarding_pass_mode: boolean;
}

interface PWAInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const GhostPassAutoSurface: React.FC<AutoSurfaceProps> = ({
  walletBindingId,
  deviceFingerprint,
  eventId,
  venueId,
  eventName = "Event",
  venueName = "Venue",
  onSurfaceComplete,
  onError
}) => {
  const [surfaceState, setSurfaceState] = useState<'checking' | 'surfacing' | 'installing' | 'complete' | 'error'>('checking');
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<PWAInstallPrompt | null>(null);
  const [brightnessControlled, setBrightnessControlled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [installSkipped, setInstallSkipped] = useState(false);
  
  const originalBrightness = useRef<number>(100);
  const brightnessRestored = useRef<boolean>(false);

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as PWAInstallPrompt);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Surface wallet after first successful scan
  useEffect(() => {
    surfaceWallet();
  }, [walletBindingId, deviceFingerprint]);

  // Cleanup brightness on unmount
  useEffect(() => {
    return () => {
      if (brightnessControlled && !brightnessRestored.current) {
        restoreBrightness();
      }
    };
  }, [brightnessControlled]);

  const surfaceWallet = async () => {
    try {
      setSurfaceState('checking');

      const response = await fetch('/api/wallet-access/surface-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          device_fingerprint: deviceFingerprint,
          event_id: eventId,
          venue_id: venueId,
          event_name: eventName,
          venue_name: venueName
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to surface wallet: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'FIRST_SCAN_SUCCESS') {
        setSurfaceState('surfacing');
        setWalletSession(data.wallet_access);
        
        // Apply brightness control for QR scanning
        if (data.wallet_access?.brightness_control?.enabled) {
          await applyBrightnessControl(data.wallet_access.brightness_control.qr_brightness_level);
        }

        // Show PWA install prompt if forced
        if (data.force_surface && data.wallet_access?.install_prompt?.show) {
          setShowInstallPrompt(true);
          setSurfaceState('installing');
        } else {
          setSurfaceState('complete');
          onSurfaceComplete?.(data.wallet_access.session_id);
        }

      } else if (data.status === 'RETURNING_ACCESS') {
        setSurfaceState('complete');
        setWalletSession(data.wallet_access);
        onSurfaceComplete?.(data.wallet_access.session_id);

      } else {
        throw new Error(data.message || 'Unknown wallet surface error');
      }

    } catch (error) {
      console.error('Wallet surface error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to surface wallet');
      setSurfaceState('error');
      onError?.(errorMessage);
    }
  };

  const applyBrightnessControl = async (brightnessLevel: number) => {
    try {
      // Store original brightness (if available via Screen Brightness API)
      if ('screen' in navigator && 'brightness' in (navigator.screen as any)) {
        originalBrightness.current = (navigator.screen as any).brightness;
      }

      // Apply maximum brightness for QR scanning
      if ('screen' in navigator && 'brightness' in (navigator.screen as any)) {
        (navigator.screen as any).brightness = brightnessLevel / 100;
        setBrightnessControlled(true);
      }

      // Also request wake lock to prevent screen timeout
      if ('wakeLock' in navigator) {
        try {
          await (navigator as any).wakeLock.request('screen');
        } catch (wakeLockError) {
          console.warn('Wake lock not available:', wakeLockError);
        }
      }

      // Apply CSS brightness as fallback
      document.body.style.filter = `brightness(${brightnessLevel}%)`;
      setBrightnessControlled(true);

    } catch (error) {
      console.warn('Brightness control not available:', error);
    }
  };

  const restoreBrightness = async () => {
    try {
      // Restore original brightness
      if ('screen' in navigator && 'brightness' in (navigator.screen as any)) {
        (navigator.screen as any).brightness = originalBrightness.current;
      }

      // Remove CSS brightness filter
      document.body.style.filter = '';
      
      setBrightnessControlled(false);
      brightnessRestored.current = true;

    } catch (error) {
      console.warn('Failed to restore brightness:', error);
    }
  };

  const handleInstallPWA = async () => {
    try {
      if (installPromptEvent) {
        // Use native install prompt
        await installPromptEvent.prompt();
        const choiceResult = await installPromptEvent.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
          setShowInstallPrompt(false);
          setSurfaceState('complete');
          onSurfaceComplete?.(walletSession?.session_id || '');
        } else {
          setInstallSkipped(true);
        }
      } else {
        // Fallback: Show manual install instructions
        showManualInstallInstructions();
      }
    } catch (error) {
      console.error('PWA install error:', error);
      showManualInstallInstructions();
    }
  };

  const showManualInstallInstructions = () => {
    // Show platform-specific instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = "To add this wallet to your home screen:\n\n";
    
    if (isIOS) {
      instructions += "1. Tap the Share button (square with arrow)\n";
      instructions += "2. Scroll down and tap 'Add to Home Screen'\n";
      instructions += "3. Tap 'Add' to confirm";
    } else if (isAndroid) {
      instructions += "1. Tap the menu button (three dots)\n";
      instructions += "2. Tap 'Add to Home screen'\n";
      instructions += "3. Tap 'Add' to confirm";
    } else {
      instructions += "1. Look for the install icon in your browser's address bar\n";
      instructions += "2. Click it and follow the prompts\n";
      instructions += "3. Or bookmark this page for quick access";
    }
    
    alert(instructions);
    setInstallSkipped(true);
  };

  const handleSkipInstall = () => {
    setInstallSkipped(true);
    setShowInstallPrompt(false);
    setSurfaceState('complete');
    onSurfaceComplete?.(walletSession?.session_id || '');
  };

  const renderSurfacingState = () => {
    switch (surfaceState) {
      case 'checking':
        return (
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <Zap className="w-full h-full text-cyan-400" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">Activating Ghost Pass Wallet</h3>
            <p className="text-gray-400">Setting up your secure wallet session...</p>
          </div>
        );

      case 'surfacing':
        return (
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <Smartphone className="w-full h-full text-cyan-400" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">Wallet Surfacing</h3>
            <p className="text-gray-400">Your Ghost Pass wallet is now active</p>
            {brightnessControlled && (
              <div className="mt-4 flex items-center justify-center text-sm text-yellow-400">
                <Sun className="w-4 h-4 mr-2" />
                Brightness optimized for scanning
              </div>
            )}
          </div>
        );

      case 'installing':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-cyan-600 rounded-full flex items-center justify-center">
              <Download className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Add to Home Screen</h3>
            <p className="text-gray-400 mb-6">Keep your wallet instantly accessible throughout {eventName}</p>
            
            <div className="space-y-3">
              <button
                onClick={handleInstallPWA}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add to Home Screen
              </button>
              
              <button
                onClick={handleSkipInstall}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center"
            >
              <CheckCircle className="w-8 h-8 text-white" />
            </motion.div>
            <h3 className="text-xl font-bold text-white mb-2">Wallet Ready</h3>
            <p className="text-gray-400">Your Ghost Pass wallet is now accessible</p>
            {installSkipped && (
              <p className="text-sm text-yellow-400 mt-2">
                You can add to home screen later from your browser menu
              </p>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Wallet Surface Failed</h3>
            <p className="text-gray-400 mb-4">{errorMessage}</p>
            <button
              onClick={surfaceWallet}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {surfaceState !== 'complete' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md w-full"
          >
            {renderSurfacingState()}
            
            {/* Brightness indicator */}
            {brightnessControlled && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg"
              >
                <div className="flex items-center text-yellow-400 text-sm">
                  <Sun className="w-4 h-4 mr-2" />
                  Screen brightness optimized for QR scanning
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GhostPassAutoSurface;