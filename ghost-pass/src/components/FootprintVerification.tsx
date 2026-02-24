import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from './ui/toast';

interface FootprintVerificationProps {
  onComplete?: (verified: boolean, fp_id: string) => void;
  onCancel?: () => void;
  walletBindingId?: string;
  verificationTier?: number;
}

export const FootprintVerification: React.FC<FootprintVerificationProps> = ({ 
  onComplete, 
  onCancel,
  walletBindingId,
  verificationTier = 3
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [fpId, setFpId] = useState<string>('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string>('');

  useEffect(() => {
    // Check if SDK is already loaded
    // @ts-ignore
    if (typeof window.onboarding !== 'undefined') {
      setSdkLoaded(true);
      return;
    }

    // Load Footprint SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.onefootprint.com/footprint-js/v5/footprint-js.js';
    script.async = true;
    
    script.onload = () => {
      console.log('Footprint SDK loaded successfully');
      setSdkLoaded(true);
    };
    
    script.onerror = () => {
      console.error('Failed to load Footprint SDK');
      setSdkError('Failed to load verification SDK. Please check your internet connection.');
      setVerificationStatus('failed');
    };
    
    document.body.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.onefootprint.com/footprint-js/v5/footprint-js.css';
    document.head.appendChild(link);

    return () => {
      try {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      } catch (e) {
        console.warn('Error cleaning up Footprint SDK:', e);
      }
    };
  }, []);

  const startVerification = async () => {
    try {
      setLoading(true);
      setVerificationStatus('loading');
      setSdkError('');

      // Wait for SDK to load if not loaded yet
      if (!sdkLoaded) {
        showToast('Loading verification system...', 'info');
        
        // Wait up to 10 seconds for SDK to load
        let attempts = 0;
        while (attempts < 20) {
          // @ts-ignore
          if (typeof window.onboarding !== 'undefined') {
            setSdkLoaded(true);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        // @ts-ignore
        if (typeof window.onboarding === 'undefined') {
          throw new Error('Verification system failed to load. Please refresh and try again.');
        }
      }

      // Get device fingerprint
      const deviceFingerprint = localStorage.getItem('device_fingerprint') || '';

      // Step 1: Create Footprint onboarding session (no auth required)
      const sessionResponse = await fetch('/api/footprint/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_binding_id: walletBindingId,
          device_fingerprint: deviceFingerprint
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create verification session');
      }

      const sessionData = await sessionResponse.json();

      // Step 2: Launch Footprint SDK
      // @ts-ignore - Footprint SDK loaded dynamically
      if (typeof window.onboarding === 'undefined') {
        throw new Error('Verification system not ready. Please try again.');
      }

      // @ts-ignore
      window.onboarding.initialize({
        onboardingSessionToken: sessionData.token,
        onComplete: async (validationToken: string) => {
          console.log('Footprint verification completed:', validationToken);
          await handleVerificationComplete(validationToken);
        },
        onError: (error: any) => {
          console.error('Footprint verification error:', error);
          const errorMessage = error?.message || 'Verification failed';
          showToast(errorMessage, 'error');
          setSdkError(errorMessage);
          setVerificationStatus('failed');
          setLoading(false);
        },
        onCancel: () => {
          console.log('Footprint verification cancelled');
          setVerificationStatus('idle');
          setLoading(false);
          if (onCancel) onCancel();
        },
        appearance: {
          variables: {
            borderRadius: '8px',
            colorSuccess: '#10b981',
            colorError: '#F87171',
            buttonPrimaryBg: '#3b82f6',
          },
        },
      });
    } catch (error: any) {
      console.error('Error starting verification:', error);
      const errorMessage = error.message || 'Failed to start verification';
      showToast(errorMessage, 'error');
      setSdkError(errorMessage);
      setVerificationStatus('failed');
      setLoading(false);
    }
  };

  const handleVerificationComplete = async (validationToken: string) => {
    try {
      const deviceFingerprint = localStorage.getItem('device_fingerprint') || '';
      
      // Step 3: Validate the token and store fp_id (no auth required)
      const validateResponse = await fetch('/api/footprint/validate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          validation_token: validationToken,
          wallet_binding_id: walletBindingId,
          device_fingerprint: deviceFingerprint
        }),
      });

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        throw new Error(errorData.error || 'Failed to validate verification');
      }

      const validationData = await validateResponse.json();

      if (validationData.verified) {
        setVerificationStatus('success');
        setFpId(validationData.fp_id);
        
        // Store footprint_id in localStorage for scanner to check
        localStorage.setItem('footprint_id', validationData.fp_id);
        
        showToast('Identity verified successfully!', 'success');
        
        if (onComplete) {
          onComplete(true, validationData.fp_id);
        }
      } else {
        setVerificationStatus('failed');
        showToast(
          validationData.requires_manual_review 
            ? 'Verification requires manual review' 
            : 'Verification failed',
          'warning'
        );
        
        if (onComplete) {
          onComplete(false, validationData.fp_id);
        }
      }
    } catch (error: any) {
      console.error('Error validating verification:', error);
      showToast(error.message || 'Failed to complete verification', 'error');
      setVerificationStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Shield className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-bold text-white">
          {verificationTier === 2 
            ? t('verification.tier2Title', 'Tier 2 - Footprint Real ID')
            : t('verification.tier3Title', 'Tier 3 - Footprint Deep Check')}
        </h3>
      </div>

      <p className="text-slate-300 mb-6">
        {verificationTier === 2
          ? t('verification.tier2Description', 'Complete identity verification using Footprint Real ID.')
          : t('verification.tier3Description', 'Complete identity verification using Footprint Deep Check. This includes document scanning and identity validation.')}
      </p>

      {sdkError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 text-sm">{sdkError}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2"
              >
                {t('verification.refresh', 'Refresh Page')}
              </button>
            </div>
          </div>
        </div>
      )}

      {verificationStatus === 'idle' && (
        <button
          onClick={startVerification}
          disabled={loading || !sdkLoaded}
          className="w-full px-6 py-3 bg-blue-500/20 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('verification.loading', 'Loading...')}</span>
            </>
          ) : !sdkLoaded ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('verification.loadingSDK', 'Loading verification system...')}</span>
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              <span>{t('verification.startVerification', 'Start Verification')}</span>
            </>
          )}
        </button>
      )}

      {verificationStatus === 'loading' && (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <p className="text-slate-300">
            {t('verification.inProgress', 'Verification in progress...')}
          </p>
        </div>
      )}

      {verificationStatus === 'success' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <p className="text-emerald-400 font-semibold">
                {t('verification.success', 'Verification Successful')}
              </p>
              {fpId && (
                <p className="text-xs text-slate-400 mt-1">
                  ID: {fpId}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {verificationStatus === 'failed' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <div>
              <p className="text-red-400 font-semibold">
                {t('verification.failed', 'Verification Failed')}
              </p>
              <button
                onClick={startVerification}
                className="text-sm text-blue-400 hover:text-blue-300 mt-2"
              >
                {t('verification.tryAgain', 'Try Again')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
