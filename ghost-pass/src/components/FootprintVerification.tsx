import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from './ui/toast';

interface FootprintVerificationProps {
  onComplete?: (verified: boolean, fp_id: string) => void;
  onCancel?: () => void;
}

export const FootprintVerification: React.FC<FootprintVerificationProps> = ({ 
  onComplete, 
  onCancel 
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [fpId, setFpId] = useState<string>('');

  useEffect(() => {
    // Load Footprint SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.onefootprint.com/footprint-js/v5/footprint-js.js';
    script.async = true;
    document.body.appendChild(script);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.onefootprint.com/footprint-js/v5/footprint-js.css';
    document.head.appendChild(link);

    return () => {
      document.body.removeChild(script);
      document.head.removeChild(link);
    };
  }, []);

  const startVerification = async () => {
    try {
      setLoading(true);
      setVerificationStatus('loading');

      // Step 1: Create Footprint onboarding session
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        showToast('Please login first', 'error');
        setLoading(false);
        setVerificationStatus('failed');
        return;
      }

      const sessionResponse = await fetch('/api/footprint/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create verification session');
      }

      const sessionData = await sessionResponse.json();

      // Step 2: Launch Footprint SDK
      // @ts-ignore - Footprint SDK loaded dynamically
      if (typeof window.onboarding === 'undefined') {
        throw new Error('Footprint SDK not loaded');
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
          showToast('Verification failed', 'error');
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
      showToast(error.message || 'Failed to start verification', 'error');
      setVerificationStatus('failed');
      setLoading(false);
    }
  };

  const handleVerificationComplete = async (validationToken: string) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      
      // Step 3: Validate the token and store fp_id
      const validateResponse = await fetch('/api/footprint/validate-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ validation_token: validationToken }),
      });

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        throw new Error(errorData.error || 'Failed to validate verification');
      }

      const validationData = await validateResponse.json();

      if (validationData.verified) {
        setVerificationStatus('success');
        setFpId(validationData.fp_id);
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
          {t('verification.tier3Title', 'Tier 3 - Identity Verification')}
        </h3>
      </div>

      <p className="text-slate-300 mb-6">
        {t('verification.tier3Description', 'Complete identity verification using Footprint. This includes document scanning and identity validation.')}
      </p>

      {verificationStatus === 'idle' && (
        <button
          onClick={startVerification}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500/20 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('verification.loading', 'Loading...')}</span>
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
