import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, 
  Sun, 
  Download, 
  Shield, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletPersistenceProps {
  walletBindingId: string;
  venueId?: string;
  onPersistenceUpdate?: (config: any) => void;
}

interface PersistenceConfig {
  persistence_active: boolean;
  force_pwa_install: boolean;
  auto_brightness_control: boolean;
  brightness_override_level: number;
  expires_at: string;
  configuration?: any;
}

const GhostPassWalletPersistence: React.FC<WalletPersistenceProps> = ({
  walletBindingId,
  venueId,
  onPersistenceUpdate
}) => {
  const [persistenceConfig, setPersistenceConfig] = useState<PersistenceConfig | null>(null);
  const [currentBrightness, setCurrentBrightness] = useState<number>(100);
  const [isAdjustingBrightness, setIsAdjustingBrightness] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if app is running as PWA
  const isPWA = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  };

  // Load persistence configuration
  const loadPersistenceConfig = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (venueId) params.append('venue_id', venueId);
      
      const response = await fetch(`/api/ghost-pass/entry/wallet/persistence/${walletBindingId}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const data = await response.json();
      setPersistenceConfig(data);
      
      if (data.persistence_active && data.auto_brightness_control) {
        setCurrentBrightness(data.brightness_override_level);
        await applyBrightnessControl(data.brightness_override_level);
      }
      
      if (onPersistenceUpdate) {
        onPersistenceUpdate(data);
      }
      
    } catch (error) {
      console.error('Failed to load persistence config:', error);
      setError('Failed to load wallet persistence configuration');
    } finally {
      setLoading(false);
    }
  }, [walletBindingId, venueId, onPersistenceUpdate]);

  // Apply brightness control for QR scanning
  const applyBrightnessControl = async (brightnessLevel: number) => {
    try {
      // Modern browsers - Screen Wake Lock API
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
      }
      
      // Try to control screen brightness (limited browser support)
      if ('screen' in navigator && 'brightness' in (navigator as any).screen) {
        (navigator as any).screen.brightness = brightnessLevel / 100;
      }
      
      // Fallback: CSS brightness filter on body
      document.body.style.filter = `brightness(${brightnessLevel}%)`;
      
      // Store brightness preference
      localStorage.setItem('ghost_pass_brightness', brightnessLevel.toString());
      
    } catch (error) {
      console.error('Brightness control failed:', error);
    }
  };

  // Handle brightness adjustment
  const handleBrightnessChange = async (newBrightness: number) => {
    try {
      setIsAdjustingBrightness(true);
      
      const response = await fetch('/api/ghost-pass/entry/qr/brightness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          brightness_level: newBrightness
        })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setCurrentBrightness(newBrightness);
        await applyBrightnessControl(newBrightness);
      }
      
    } catch (error) {
      console.error('Failed to adjust brightness:', error);
    } finally {
      setIsAdjustingBrightness(false);
    }
  };

  // Handle PWA installation
  const handlePWAInstall = async () => {
    try {
      if (pwaInstallPrompt) {
        const result = await pwaInstallPrompt.prompt();
        if (result.outcome === 'accepted') {
          setIsPwaInstalled(true);
          setPwaInstallPrompt(null);
        }
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
    }
  };

  // Force PWA installation if required
  const forcePWAInstall = useCallback(() => {
    if (persistenceConfig?.force_pwa_install && !isPWA() && !isPwaInstalled) {
      // Show persistent PWA install prompt
      const installBanner = document.createElement('div');
      installBanner.id = 'ghost-pass-pwa-banner';
      installBanner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #0ea5e9, #3b82f6);
        color: white;
        padding: 16px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      
      installBanner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span style="font-weight: 600;">Install Ghost Pass Wallet</span>
          </div>
          <button id="pwa-install-btn" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
          ">Install Now</button>
        </div>
      `;
      
      document.body.appendChild(installBanner);
      
      // Handle install button click
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn) {
        installBtn.addEventListener('click', handlePWAInstall);
      }
    }
  }, [persistenceConfig, isPwaInstalled, pwaInstallPrompt]);

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPwaInstallPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Check if PWA is installed
  useEffect(() => {
    setIsPwaInstalled(isPWA());
  }, []);

  // Load configuration on mount
  useEffect(() => {
    loadPersistenceConfig();
  }, [loadPersistenceConfig]);

  // Force PWA install when config loads
  useEffect(() => {
    if (persistenceConfig?.persistence_active) {
      forcePWAInstall();
    }
  }, [persistenceConfig, forcePWAInstall]);

  // Auto-brightness control for QR scanning
  useEffect(() => {
    if (persistenceConfig?.auto_brightness_control) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Restore brightness when app becomes visible
          applyBrightnessControl(currentBrightness);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [persistenceConfig, currentBrightness]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-400">Loading wallet persistence...</p>
        </div>
      </div>
    );
  }

  if (!persistenceConfig?.persistence_active) {
    return (
      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Wallet persistence not active</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Persistence Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg"
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <h3 className="font-semibold text-white">Wallet Persistence Active</h3>
            <p className="text-sm text-gray-400">
              Your Ghost Pass wallet will remain accessible until{' '}
              {new Date(persistenceConfig.expires_at).toLocaleString()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* PWA Installation Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "p-4 rounded-lg border",
          isPwaInstalled 
            ? "bg-green-900/20 border-green-500/30"
            : "bg-yellow-900/20 border-yellow-500/30"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className={cn(
              "w-5 h-5",
              isPwaInstalled ? "text-green-400" : "text-yellow-400"
            )} />
            <div>
              <h3 className="font-semibold text-white">
                {isPwaInstalled ? "App Installed" : "Install Required"}
              </h3>
              <p className="text-sm text-gray-400">
                {isPwaInstalled 
                  ? "Ghost Pass wallet is installed on your device"
                  : "Install the app for instant access"
                }
              </p>
            </div>
          </div>
          
          {!isPwaInstalled && pwaInstallPrompt && (
            <button
              onClick={handlePWAInstall}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          )}
        </div>
      </motion.div>

      {/* Brightness Control */}
      {persistenceConfig.auto_brightness_control && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-white">QR Brightness Control</h3>
          </div>
          
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-300">Screen Brightness</span>
              <span className="text-sm font-mono text-cyan-400">{currentBrightness}%</span>
            </div>
            
            <div className="space-y-3">
              <input
                type="range"
                min="50"
                max="100"
                value={currentBrightness}
                onChange={(e) => setCurrentBrightness(parseInt(e.target.value))}
                onMouseUp={(e) => handleBrightnessChange(parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleBrightnessChange(parseInt((e.target as HTMLInputElement).value))}
                disabled={isAdjustingBrightness}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${(currentBrightness - 50) * 2}%, #374151 ${(currentBrightness - 50) * 2}%, #374151 100%)`
                }}
              />
              
              <div className="flex justify-between text-xs text-gray-400">
                <span>Low Light</span>
                <span>Maximum</span>
              </div>
              
              {isAdjustingBrightness && (
                <div className="flex items-center gap-2 text-sm text-cyan-400">
                  <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  Adjusting brightness...
                </div>
              )}
            </div>
            
            <div className="mt-3 text-xs text-gray-400">
              QR codes automatically use maximum brightness for optimal scanning in dark venues
            </div>
          </div>
        </motion.div>
      )}

      {/* Persistence Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
      >
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          Active Features
        </h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-300">Instant wallet access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-300">No re-scanning required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-300">Automatic brightness control</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-300">Optimized for crowded venues</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-300">Works in low-light conditions</span>
          </div>
        </div>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GhostPassWalletPersistence;