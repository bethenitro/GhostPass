import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DashboardSelectorProps {
  onSelectGhostPass: () => void;
  onSelectSensoryMonitor?: () => void; // Keep for backward compatibility but make optional
}

const DashboardSelector: React.FC<DashboardSelectorProps> = ({
  onSelectGhostPass
}) => {
  const handleSelectSensoryMonitor = () => {
    window.location.hash = '#/sensory-monitor';
  };
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="heading-primary text-3xl sm:text-4xl mb-4">Welcome to GhostPass</h1>
          <p className="label-tactical text-lg">Select your dashboard</p>
        </motion.div>

        {/* Dashboard Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GhostPass Wallet */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card
              className="glass-card cursor-pointer transition-all hover:border-cyan-500/50 hover:scale-[1.02] h-full"
              onClick={onSelectGhostPass}
            >
              <CardHeader className="text-center pb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 glass-panel mb-4 mx-auto neon-glow-cyan">
                  <Wallet className="text-cyan-400" size={32} />
                </div>
                <CardTitle className="heading-primary text-xl">GhostPass Wallet</CardTitle>
                <CardDescription className="label-tactical">
                  Manage your venue access and transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Purchase and manage GhostPass sessions</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>View wallet balance and transaction history</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Generate QR codes for venue entry</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Access trust center and security features</span>
                  </li>
                </ul>

                <motion.div
                  className="flex items-center justify-center space-x-2 text-cyan-400 font-semibold pt-4"
                  whileHover={{ x: 5 }}
                >
                  <span>Enter Wallet</span>
                  <ArrowRight size={20} />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sensory Cargo Monitor */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card
              className="glass-card cursor-pointer transition-all hover:border-purple-500/50 hover:scale-[1.02] h-full"
              onClick={handleSelectSensoryMonitor}
            >
              <CardHeader className="text-center pb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 glass-panel mb-4 mx-auto" style={{ filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.5))' }}>
                  <Activity className="text-purple-400" size={32} />
                </div>
                <CardTitle className="heading-primary text-xl">Sensory Cargo Monitor</CardTitle>
                <CardDescription className="label-tactical">
                  Real-time sensory signal monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>View live feed of incoming sensory signals</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Monitor validation status and Ghost Pass approval</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Inspect detailed SCU data and metadata</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Track sensory capsules and audit trails</span>
                  </li>
                </ul>

                <motion.div
                  className="flex items-center justify-center space-x-2 text-purple-400 font-semibold pt-4"
                  whileHover={{ x: 5 }}
                >
                  <span>Enter Monitor</span>
                  <ArrowRight size={20} />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card className="glass-card bg-cyan-500/5 border-cyan-500/20">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0 neon-glow-cyan"></div>
                <div className="text-sm">
                  <p className="font-semibold text-neon-cyan mb-1">Secure Access</p>
                  <p className="text-slate-400">
                    All dashboards are protected by military-grade encryption. Your data is secure and private.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardSelector;
