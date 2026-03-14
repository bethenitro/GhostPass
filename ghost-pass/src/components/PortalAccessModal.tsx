import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Building2, Users, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PortalAccessModalProps {
    onOperatorLogin: () => void;
    onStaffLogin: () => void;
    onCancel: () => void;
}

const PortalAccessModal: React.FC<PortalAccessModalProps> = ({ onOperatorLogin, onStaffLogin, onCancel }) => {
    const { t } = useTranslation();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 rounded-xl p-8 max-w-md w-full"
        >
            {/* Header */}
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('portal.title')}</h2>
                <p className="text-slate-400">{t('portal.subtitle')}</p>
            </div>

            <div className="space-y-4">
                {/* Operator Portal button */}
                <button
                    onClick={onOperatorLogin}
                    className="w-full px-4 py-4 bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded-lg font-medium hover:bg-amber-500/30 transition-all flex items-center justify-between"
                >
                    <div className="flex items-center space-x-3">
                        <Building2 className="w-5 h-5" />
                        <div className="text-left">
                            <div className="font-bold">{t('portal.operatorLogin')}</div>
                            <div className="text-xs opacity-80">{t('portal.operatorSubtitle')}</div>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5" />
                </button>

                {/* Staff Portal button */}
                <button
                    onClick={onStaffLogin}
                    className="w-full px-4 py-4 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-lg font-medium hover:bg-cyan-500/30 transition-all flex items-center justify-between"
                >
                    <div className="flex items-center space-x-3">
                        <Users className="w-5 h-5" />
                        <div className="text-left">
                            <div className="font-bold">{t('portal.staffLogin')}</div>
                            <div className="text-xs opacity-80">{t('portal.staffSubtitle')}</div>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5" />
                </button>

                {/* Actions */}
                <div className="pt-2">
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-lg text-slate-300 font-medium transition-all"
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default PortalAccessModal;
