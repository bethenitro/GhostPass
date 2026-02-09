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
import { motion } from 'framer-motion';
import { 
  Smartphone, 
  Plus, 
  Sun, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Zap
} from 'lucide-react';

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
  venueId,
  eventName = "Event",
  venueName = "Venue",
  onSurfaceComplete,
  onError
}) => {
  const [surfaceState, setSurfaceState] = useState<'checking' | 'surfacing' | 'installing' | 'complete' | 'error'>('checking');
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);
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

      if (import.meta.env.DEV) {
        console.log('🎫 [AutoSurface] Starting wallet surface with:', {
          deviceFingerprint,
          venueId,
          eventName,
          venueName
        });
      }

      // Call the anonymous wallet surface endpoint (no auth required)
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/wallet/surface-wallet-anonymous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_fingerprint: deviceFingerprint,
          venue_id: venueId,
          event_name: eventName,
          venue_name: venueName,
          entry_fee_cents: 500 // Default entry fee
        })
      });

      if (import.meta.env.DEV) {
        console.log('🎫 [AutoSurface] API response status:', response.status);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to surface wallet: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response:', responseText);
        throw new Error('API returned non-JSON response');
      }

      const data = await response.json();
      
      if (import.meta.env.DEV) {
        console.log('🎫 [AutoSurface] API response data:', data);
      }

      if (!data.success || !data.session) {
        throw new Error('Invalid response from wallet surface endpoint');
      }

      const sessionId = data.session.session_id;
      const recoveryCode = data.recovery_code; // Only present on first wallet creation
      
      const walletSession: WalletSession = {
        session_id: sessionId,
        wallet_binding_id: data.wallet.wallet_binding_id,
        force_surface: true, // BOARDING PASS: Always force surface for first scan
        expires_at: data.session.expires_at,
        pwa_manifest: {},
        install_prompt: {
          show: true, // Always show install prompt for boarding pass behavior
          title: `${eventName} - Ghost Pass Wallet`,
          message: `Keep your ${eventName} wallet instantly accessible throughout the event`,
          install_button_text: "Add to Home Screen",
          skip_button_text: "Not Now"
        },
        brightness_control: {
          enabled: true,
          qr_brightness_level: 150,
          restore_on_close: true
        },
        wallet_url: `${window.location.origin}/`,
        boarding_pass_mode: true
      };

      setSurfaceState('surfacing');
      setWalletSession(walletSession);
      
      // Apply brightness control for QR scanning
      if (walletSession.brightness_control?.enabled) {
        await applyBrightnessControl(walletSession.brightness_control.qr_brightness_level);
      }

      // Store wallet session in localStorage for persistence (BOARDING PASS BEHAVIOR)
      localStorage.setItem('ghost_pass_wallet_session', JSON.stringify(data.session));

      // Store recovery code if this is a new wallet
      if (recoveryCode) {
        const recoveryData = {
          wallet_binding_id: data.wallet.wallet_binding_id,
          recovery_code: recoveryCode,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('wallet_recovery_code', JSON.stringify(recoveryData));
        if (import.meta.env.DEV) {
          console.log('💾 [AutoSurface] Recovery code stored:', recoveryData);
        }
      }

      // BOARDING PASS BEHAVIOR: Force wallet to surface immediately for first scan
      if (walletSession.force_surface) {
        // Show PWA install prompt for persistent access
        if (installPromptEvent) {
          if (import.meta.env.DEV) {
            console.log('🎫 [AutoSurface] PWA prompt available - showing install screen');
          }
          setSurfaceState('installing');
        } else {
          // If no PWA prompt available, force wallet to open immediately
          if (import.meta.env.DEV) {
            console.log('🎫 [AutoSurface] No PWA prompt - forcing wallet to surface');
          }
          setSurfaceState('complete');
          
          // FORCE WALLET TO SURFACE - BOARDING PASS BEHAVIOR
          setTimeout(() => {
            if (import.meta.env.DEV) {
              console.log('🎫 BOARDING PASS MODE: Forcing wallet to surface immediately');
            }
            // Navigate to wallet in current window (forced surfacing)
            window.location.href = walletSession.wallet_url;
          }, 1000);
        }
      } else {
        // Returning user - just complete
        setSurfaceState('complete');
        
        // Auto-close after showing success for 2 seconds
        setTimeout(() => {
          onSurfaceComplete?.(sessionId);
        }, 2000);
      }

    } catch (error) {
      console.error('Wallet surface error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to surface wallet';
      setErrorMessage(errorMsg);
      setSurfaceState('error');
      onError?.(errorMsg);
      
      if (import.meta.env.DEV) {
        console.error('🎫 [AutoSurface] Full error details:', error);
        console.log('💡 Make sure Vercel dev server is running on port 3001');
      }
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
          console.log('🎫 PWA installed - boarding pass mode activated');
          setSurfaceState('complete');
          
          // After PWA install, force wallet to surface
          setTimeout(() => {
            console.log('🎫 BOARDING PASS MODE: Forcing wallet to surface after PWA install');
            window.location.href = walletSession?.wallet_url || `${window.location.origin}/`;
          }, 500);
        } else {
          // User declined PWA install, but still force wallet to surface (boarding pass behavior)
          console.log('🎫 PWA declined, but forcing wallet surface anyway (boarding pass mode)');
          setInstallSkipped(true);
          setSurfaceState('complete');
          
          setTimeout(() => {
            console.log('🎫 BOARDING PASS MODE: Forcing wallet to surface despite PWA decline');
            window.location.href = walletSession?.wallet_url || `${window.location.origin}/`;
          }, 1000);
        }
      } else {
        // Fallback: Show manual install instructions but still force wallet
        showManualInstallInstructions();
        setTimeout(() => {
          console.log('🎫 BOARDING PASS MODE: Forcing wallet to surface after manual instructions');
          window.location.href = walletSession?.wallet_url || `${window.location.origin}/`;
        }, 2000);
      }
    } catch (error) {
      console.error('PWA install error:', error);
      // Even if PWA install fails, force wallet to surface (boarding pass behavior)
      console.log('🎫 BOARDING PASS MODE: Forcing wallet to surface despite PWA error');
      setTimeout(() => {
        window.location.href = walletSession?.wallet_url || `${window.location.origin}/`;
      }, 1000);
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
    console.log('🎫 User skipped PWA install, but forcing wallet surface anyway (boarding pass mode)');
    setInstallSkipped(true);
    setSurfaceState('complete');
    
    // Even if user skips PWA install, force wallet to surface (boarding pass behavior)
    setTimeout(() => {
      console.log('🎫 BOARDING PASS MODE: Forcing wallet to surface after skip');
      window.location.href = walletSession?.wallet_url || `${window.location.origin}/`;
    }, 1000);
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
            <h3 className="text-xl font-bold text-white mb-2">🎫 Boarding Pass Mode</h3>
            <p className="text-gray-400">Your Ghost Pass wallet is surfacing automatically</p>
            <p className="text-sm text-cyan-400 mt-2">This will remain accessible throughout {eventName}</p>
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
            <h3 className="text-xl font-bold text-white mb-2">🎫 Add Boarding Pass</h3>
            <p className="text-gray-400 mb-6">Add your {eventName} wallet to home screen for instant access throughout the event</p>
            <p className="text-sm text-cyan-400 mb-4">This ensures your wallet stays accessible even if you close the browser</p>
            
            {/* Show note if PWA prompt not available */}
            {!installPromptEvent && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-400 text-xs">
                  Note: PWA install prompt is only available on mobile devices or when PWA criteria are met.
                  Your wallet will open automatically regardless.
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={handleInstallPWA}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                {installPromptEvent ? 'Add to Home Screen' : 'Continue to Wallet'}
              </button>
              
              <button
                onClick={handleSkipInstall}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Continue Without Installing
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              Your wallet will open automatically regardless of your choice
            </p>
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
            <h3 className="text-xl font-bold text-white mb-2">🎫 Boarding Pass Active</h3>
            <p className="text-gray-400">Your {eventName} wallet is now surfacing...</p>
            <p className="text-sm text-cyan-400 mt-2">Opening automatically in 3... 2... 1...</p>
            {installSkipped && (
              <p className="text-sm text-yellow-400 mt-2">
                You can still add to home screen later from your browser menu
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {surfaceState !== 'complete' && (
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
      )}
    </div>
  );
};

export default GhostPassAutoSurface;