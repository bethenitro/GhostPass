import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      
      if (err.response?.status === 401) {
        setError(t('login.invalidCredentials'));
      } else if (err.response?.status === 409) {
        setError(t('login.accountExists'));
      } else if (err.response?.status === 400) {
        setError(t('login.checkFormat'));
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(err.message || t('login.authError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm sm:max-w-md space-y-6 sm:space-y-8"
      >
        {/* Logo/Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 glass-panel mb-4 sm:mb-6 neon-glow-cyan">
            <Zap className="text-cyan-400" size={32} />
          </div>
          <h1 className="heading-primary text-2xl sm:text-3xl mb-2">{t('login.title')}</h1>
          <p className="label-tactical">{t('login.subtitle')}</p>
        </motion.div>

        {/* Auth Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="heading-primary">
                {isLogin ? t('login.accessTerminal') : t('login.registerAccount')}
              </CardTitle>
              <CardDescription className="label-tactical">
                {isLogin ? t('login.authenticateToAccess') : t('login.joinNetwork')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="label-tactical block">{t('login.emailLabel')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400/60" size={18} />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="tactical-input pl-10 h-12"
                      placeholder={t('login.emailPlaceholder')}
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="label-tactical block">{t('login.accessCodeLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400/60" size={18} />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="tactical-input pl-10 pr-12 h-12"
                      placeholder={t('login.accessCodePlaceholder')}
                      required
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400/60 hover:text-cyan-400 transition-colors p-1"
                      whileTap={{ scale: 0.95 }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </motion.button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card className="glass-card bg-red-500/10 border-red-500/30 neon-glow-red">
                      <CardContent className="p-3">
                        <p className="text-neon-red text-sm font-medium">{error}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full py-3 sm:py-4 rounded-lg font-semibold transition-all duration-300 min-h-[48px]",
                    loading ? 'btn-tactical opacity-50 cursor-not-allowed' : 'btn-primary'
                  )}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="loading-spinner"></div>
                      <span>{t('login.authenticating')}</span>
                    </div>
                  ) : (
                    <span className="text-neon-cyan">
                      {isLogin ? t('login.authenticate') : t('login.register')}
                    </span>
                  )}
                </motion.button>
              </form>

              {/* Toggle Auth Mode */}
              <div className="text-center pt-4 border-t border-white/10">
                <motion.button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLogin ? t('login.needAccess') : t('login.alreadyRegistered')}
                </motion.button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="glass-card bg-cyan-500/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0 neon-glow-cyan"></div>
                <div className="text-sm">
                  <p className="font-semibold text-neon-cyan mb-1">{t('login.secureProtocol')}</p>
                  <p className="text-slate-400">{t('login.securityNotice')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;