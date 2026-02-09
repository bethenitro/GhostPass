import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, ArrowRight, QrCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DashboardSelectorProps {
  onSelectGhostPass: () => void;
}

const DashboardSelector: React.FC<DashboardSelectorProps> = ({
  onSelectGhostPass
}) => {
  const handleSelectScanner = () => {
    window.location.hash = '#/ghost-pass-scanner';
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

          {/* Ghost Pass Scanner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card
              className="glass-card cursor-pointer transition-all hover:border-green-500/50 hover:scale-[1.02] h-full"
              onClick={handleSelectScanner}
            >
              <CardHeader className="text-center pb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 glass-panel mb-4 mx-auto" style={{ filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.5))' }}>
                  <QrCode className="text-green-400" size={32} />
                </div>
                <CardTitle className="heading-primary text-xl">Ghost Pass Scanner</CardTitle>
                <CardDescription className="label-tactical">
                  Scan QR codes for venue entry
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Scan Ghost Pass QR codes for entry</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Automatic wallet surfacing after first scan</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Entry tracking and re-entry management</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span>Brightness control for low-light scanning</span>
                  </li>
                </ul>

                <motion.div
                  className="flex items-center justify-center space-x-2 text-green-400 font-semibold pt-4"
                  whileHover={{ x: 5 }}
                >
                  <span>Open Scanner</span>
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

        </motion.div>
      </div>
    </div>
  );
};

export default DashboardSelector;
