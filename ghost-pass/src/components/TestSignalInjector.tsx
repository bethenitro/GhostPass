import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Send, CheckCircle, XCircle, 
  Zap, Package, Eye, Ear, Hand, Compass, Wind, Droplet,
  Monitor, Play, RotateCcw, Timer, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { sensoryApi } from '@/lib/api';

interface TestSignalInjectorProps {
  onBack: () => void;
}

const SENSORY_TYPES = [
  { value: 'VISION', label: 'Vision', icon: Eye, color: 'text-blue-400' },
  { value: 'HEARING', label: 'Hearing', icon: Ear, color: 'text-purple-400' },
  { value: 'TOUCH', label: 'Touch', icon: Hand, color: 'text-orange-400' },
  { value: 'BALANCE', label: 'Balance', icon: Compass, color: 'text-green-400' },
  { value: 'SMELL', label: 'Smell', icon: Wind, color: 'text-yellow-400' },
  { value: 'TASTE', label: 'Taste', icon: Droplet, color: 'text-pink-400' },
];

const EXAMPLE_DATA = {
  VISION: '{\n  "frame_id": "frame_001",\n  "objects_detected": ["person", "vehicle"],\n  "confidence_scores": [0.95, 0.87],\n  "bounding_boxes": [{"x": 100, "y": 50, "w": 200, "h": 300}],\n  "scene_type": "urban_street"\n}',
  HEARING: '{\n  "audio_pattern": "alert_tone",\n  "frequency_range": [800, 1200],\n  "amplitude_db": 65,\n  "duration_ms": 1000,\n  "peak_detected": true\n}',
  TOUCH: '{\n  "pressure_points": [{"location": "surface_a", "pressure_psi": 15.2}],\n  "threshold_psi": 12.0,\n  "threshold_exceeded": true,\n  "contact_area_cm2": 4.5\n}',
  BALANCE: '{\n  "orientation": {"pitch": 2.3, "roll": -1.1, "yaw": 0.5},\n  "stability_score": 0.94,\n  "drift_rate": 0.02,\n  "axis_movement": "stable"\n}',
  SMELL: '{\n  "chemical_signatures": ["CO2", "CH4", "H2S"],\n  "concentrations_ppm": [450, 2.1, 0.8],\n  "anomaly_detected": true,\n  "risk_score": 0.75,\n  "confidence_decay": 0.92\n}',
  TASTE: '{\n  "quality_metrics": {"pH": 7.2, "salinity": 0.05, "sweetness": 3.2},\n  "fitness_score": 0.89,\n  "quality_grade": "A",\n  "acceptance_range": "within_limits",\n  "pass_fail": "pass"\n}',
};

// Preset multi-sensory capsules for testing
const CAPSULE_PRESETS = [
  {
    name: 'Vision + Touch',
    description: 'Test visual and tactile sensors together',
    scus: [
      { sensory_type: 'VISION', data: EXAMPLE_DATA.VISION },
      { sensory_type: 'TOUCH', data: EXAMPLE_DATA.TOUCH }
    ]
  },
  {
    name: 'Audio + Balance',
    description: 'Test hearing and stability sensors',
    scus: [
      { sensory_type: 'HEARING', data: EXAMPLE_DATA.HEARING },
      { sensory_type: 'BALANCE', data: EXAMPLE_DATA.BALANCE }
    ]
  },
  {
    name: 'Chemical Detection',
    description: 'Test smell and taste sensors',
    scus: [
      { sensory_type: 'SMELL', data: EXAMPLE_DATA.SMELL },
      { sensory_type: 'TASTE', data: EXAMPLE_DATA.TASTE }
    ]
  },
  {
    name: 'Full Sensory Suite',
    description: 'Test all 6 sensory types in one capsule',
    scus: [
      { sensory_type: 'VISION', data: EXAMPLE_DATA.VISION },
      { sensory_type: 'HEARING', data: EXAMPLE_DATA.HEARING },
      { sensory_type: 'TOUCH', data: EXAMPLE_DATA.TOUCH },
      { sensory_type: 'BALANCE', data: EXAMPLE_DATA.BALANCE },
      { sensory_type: 'SMELL', data: EXAMPLE_DATA.SMELL },
      { sensory_type: 'TASTE', data: EXAMPLE_DATA.TASTE }
    ]
  }
];

const TestSignalInjector: React.FC<TestSignalInjectorProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'single' | 'capsule' | 'quick-test'>('quick-test');
  
  // Response state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [rapidFire, setRapidFire] = useState(false);
  const [rapidFireCount, setRapidFireCount] = useState(0);

  // Utility function to compute integrity hash exactly like the backend
  const computeIntegrityHash = async (sensoryType: string, sourceId: string, signalData: any): Promise<string> => {
    // Create deterministic JSON representation matching Python's json.dumps(sort_keys=True, separators=(',', ':'))
    const sortedKeys = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sortedKeys);
      
      const sorted: any = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = sortedKeys(obj[key]);
      });
      return sorted;
    };
    
    const sortedData = sortedKeys(signalData);
    const signalJson = JSON.stringify(sortedData, null, 0).replace(/\s/g, '');
    
    // Combine with sensory type and source for uniqueness (matching Python format)
    const hashInput = `${sensoryType}:${sourceId}:${signalJson}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(hashInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Quick test functions
  const sendQuickSignal = async (sensoryType: string) => {
    setLoading(true);
    setResponse(null);

    try {
      const signalData = JSON.parse(EXAMPLE_DATA[sensoryType as keyof typeof EXAMPLE_DATA]);
      const sourceId = `quick_test_${sensoryType.toLowerCase()}`;
      
      const payload = {
        schema_version: '1.0.0',
        sensory_type: sensoryType,
        signal_data: signalData,
        metadata: {
          timestamp: new Date().toISOString(),
          source_id: sourceId,
          integrity_hash: await computeIntegrityHash(sensoryType, sourceId, signalData)
        }
      };

      const result = await sensoryApi.sendTestSignal(payload);
      
      if (result) {
        setResponse({
          success: true,
          message: `${sensoryType} SCU sent successfully!`,
          data: result
        });
      } else {
        setResponse({
          success: false,
          message: 'Failed to send SCU'
        });
      }
    } catch (error: any) {
      setResponse({
        success: false,
        message: error.message || 'Error sending SCU'
      });
    } finally {
      setLoading(false);
    }
  };

  const sendPresetCapsule = async (preset: typeof CAPSULE_PRESETS[0]) => {
    setLoading(true);
    setResponse(null);

    try {
      const scus = await Promise.all(preset.scus.map(async (scu) => {
        const signalData = JSON.parse(scu.data);
        const sourceId = `preset_${preset.name.toLowerCase().replace(/\s+/g, '_')}`;
        
        const scuPayload = {
          schema_version: '1.0.0',
          sensory_type: scu.sensory_type,
          signal_data: signalData,
          metadata: {
            timestamp: new Date().toISOString(),
            source_id: sourceId,
            integrity_hash: await computeIntegrityHash(scu.sensory_type, sourceId, signalData)
          }
        };

        return scuPayload;
      }));

      const capsulePayload = {
        capsule_id: `preset_${preset.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source_id: `preset_hub_${preset.name.toLowerCase().replace(/\s+/g, '_')}`,
        scus: scus
      };

      const result = await sensoryApi.sendTestCapsule(capsulePayload);

      if (result) {
        setResponse({
          success: true,
          message: `${preset.name} capsule sent successfully!`,
          data: result
        });
      } else {
        setResponse({
          success: false,
          message: 'Failed to send capsule'
        });
      }
    } catch (error: any) {
      setResponse({
        success: false,
        message: error.message || 'Error sending capsule'
      });
    } finally {
      setLoading(false);
    }
  };

  const startRapidFire = async () => {
    setRapidFire(true);
    setRapidFireCount(0);
    
    for (let i = 0; i < 10; i++) {
      const sensoryTypes = Object.keys(EXAMPLE_DATA);
      const randomType = sensoryTypes[Math.floor(Math.random() * sensoryTypes.length)];
      
      try {
        await sendQuickSignal(randomType);
        setRapidFireCount(i + 1);
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between signals
      } catch (error) {
        console.error('Rapid fire error:', error);
      }
    }
    
    setRapidFire(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header with Monitor Link */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={onBack}
                className="glass-panel p-3 hover:border-cyan-500/50 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="text-cyan-400" size={20} />
              </motion.button>
              <div>
                <h1 className="heading-primary text-2xl sm:text-3xl flex items-center space-x-2">
                  <Zap className="text-yellow-400" size={28} />
                  <span>Sensory Signal Test Lab</span>
                </h1>
                <p className="label-tactical">Optimized for testing the Sensory Cargo Monitor</p>
              </div>
            </div>
            
            <motion.button
              onClick={() => window.location.hash = '#/sensory-monitor'}
              className="glass-panel px-4 py-3 hover:border-cyan-500/50 transition-all bg-cyan-500/10"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center space-x-2">
                <Monitor className="text-cyan-400" size={20} />
                <span className="text-cyan-400 font-semibold">Open Monitor</span>
              </div>
            </motion.button>
          </div>

          {/* Enhanced Warning Banner */}
          <Card className="glass-card bg-yellow-500/10 border-yellow-500/50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Target className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-400 mb-1">SENSORY CARGO MONITOR TEST LAB</p>
                  <p className="text-slate-300">
                    Send test SCUs (Sensory Cargo Units) and immediately see them appear in the Sensory Cargo Monitor. 
                    Use Quick Test for rapid testing, or create custom SCUs for detailed validation.
                    <span className="block mt-2 text-slate-400 text-xs">
                      Note: Multiple SCUs can originate from a single Ghost Pass interaction.
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.button
            onClick={() => setMode('quick-test')}
            className={`glass-panel p-4 transition-all ${
              mode === 'quick-test' ? 'border-emerald-500/50 bg-emerald-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Play className={mode === 'quick-test' ? 'text-emerald-400' : 'text-slate-400'} size={20} />
              <span className={`font-semibold ${mode === 'quick-test' ? 'text-emerald-400' : 'text-slate-400'}`}>
                Quick Test
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Instant testing with presets
            </p>
          </motion.button>

          <motion.button
            onClick={() => setMode('single')}
            className={`glass-panel p-4 transition-all ${
              mode === 'single' ? 'border-cyan-500/50 bg-cyan-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Send className={mode === 'single' ? 'text-cyan-400' : 'text-slate-400'} size={20} />
              <span className={`font-semibold ${mode === 'single' ? 'text-cyan-400' : 'text-slate-400'}`}>
                Single SCU
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Custom individual signals
            </p>
          </motion.button>

          <motion.button
            onClick={() => setMode('capsule')}
            className={`glass-panel p-4 transition-all ${
              mode === 'capsule' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Package className={mode === 'capsule' ? 'text-purple-400' : 'text-slate-400'} size={20} />
              <span className={`font-semibold ${mode === 'capsule' ? 'text-purple-400' : 'text-slate-400'}`}>
                Sensory Capsule
              </span>
            </div>
            <p className="text-xs text-slate-400 text-center">
              Multi-sensory packages
            </p>
          </motion.button>
        </div>

        {/* Quick Test Mode */}
        {mode === 'quick-test' && (
          <div className="space-y-6">
            {/* Individual Sensory Tests */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="heading-primary flex items-center space-x-2">
                  <Target className="text-emerald-400" size={20} />
                  <span>Individual Sensory Tests</span>
                </CardTitle>
                <CardDescription className="label-tactical">
                  Click any sensory type to instantly send a test SCU (Sensory Cargo Unit)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SENSORY_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <motion.button
                        key={type.value}
                        onClick={() => sendQuickSignal(type.value)}
                        disabled={loading}
                        className={`glass-panel p-4 transition-all hover:border-current/50 ${type.color} ${
                          loading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        whileHover={{ scale: loading ? 1 : 1.05 }}
                        whileTap={{ scale: loading ? 1 : 0.95 }}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <Icon size={24} />
                          <span className="font-semibold text-sm">{type.label}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Preset Capsules */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="heading-primary flex items-center space-x-2">
                  <Package className="text-purple-400" size={20} />
                  <span>Preset Multi-Sensory Capsules</span>
                </CardTitle>
                <CardDescription className="label-tactical">
                  Test multiple sensory types together with realistic combinations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CAPSULE_PRESETS.map((preset, index) => (
                    <motion.button
                      key={index}
                      onClick={() => sendPresetCapsule(preset)}
                      disabled={loading}
                      className={`glass-panel p-4 text-left transition-all hover:border-purple-500/50 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      whileHover={{ scale: loading ? 1 : 1.02 }}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                    >
                      <div className="flex items-start space-x-3">
                        <Package className="text-purple-400 flex-shrink-0 mt-1" size={20} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-purple-400 mb-1">{preset.name}</h4>
                          <p className="text-sm text-slate-400 mb-2">{preset.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {preset.scus.map((scu, scuIndex) => {
                              const sensoryType = SENSORY_TYPES.find(t => t.value === scu.sensory_type);
                              const Icon = sensoryType?.icon || Package;
                              return (
                                <div key={scuIndex} className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${sensoryType?.color || 'text-slate-400'} bg-current/10`}>
                                  <Icon size={12} />
                                  <span>{sensoryType?.label || scu.sensory_type}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Rapid Fire Testing */}
            <Card className="glass-card border-orange-500/30">
              <CardHeader>
                <CardTitle className="heading-primary flex items-center space-x-2">
                  <Timer className="text-orange-400" size={20} />
                  <span>Rapid Fire Testing</span>
                </CardTitle>
                <CardDescription className="label-tactical">
                  Send 10 random signals rapidly to stress test the monitor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <motion.button
                  onClick={startRapidFire}
                  disabled={loading || rapidFire}
                  className="btn-primary w-full bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-orange-500/30"
                  whileHover={{ scale: (loading || rapidFire) ? 1 : 1.02 }}
                  whileTap={{ scale: (loading || rapidFire) ? 1 : 0.98 }}
                >
                  {rapidFire ? (
                    <div className="flex items-center justify-center space-x-2">
                      <RotateCcw className="animate-spin" size={20} />
                      <span>RAPID FIRE IN PROGRESS... ({rapidFireCount}/10)</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Timer size={20} />
                      <span>START RAPID FIRE TEST</span>
                    </div>
                  )}
                </motion.button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Response Display */}
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6"
            >
              <Card className={`glass-card ${
                response.success 
                  ? 'border-emerald-500/50 bg-emerald-500/10' 
                  : 'border-red-500/50 bg-red-500/10'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    {response.success ? (
                      <CheckCircle className="text-emerald-400 flex-shrink-0" size={32} />
                    ) : (
                      <XCircle className="text-red-400 flex-shrink-0" size={32} />
                    )}
                    <div className="flex-1">
                      <p className={`text-xl font-bold mb-2 ${
                        response.success ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {response.success ? 'Success!' : 'Error'}
                      </p>
                      <p className="text-slate-300 mb-4">{response.message}</p>
                      
                      {response.data && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 mb-2">
                            View Response Details
                          </summary>
                          <pre className="p-4 bg-slate-950/50 rounded text-xs overflow-x-auto">
                            {JSON.stringify(response.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TestSignalInjector;