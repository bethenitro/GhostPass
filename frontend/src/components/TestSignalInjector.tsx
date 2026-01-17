import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Send, Plus, Trash2, CheckCircle, XCircle, 
  AlertTriangle, Zap, Package, Eye, Ear, Hand, Compass, Wind, Droplet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface TestSignalInjectorProps {
  onBack: () => void;
}

interface SCUForm {
  id: string;
  sensory_type: string;
  signal_data: string;
  source_id: string;
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
  VISION: '{\n  "objects_detected": ["person", "vehicle"],\n  "confidence_scores": [0.95, 0.87],\n  "scene": "urban_street"\n}',
  HEARING: '{\n  "audio_pattern": "alert_tone",\n  "frequency_range": [800, 1200],\n  "duration_ms": 1000\n}',
  TOUCH: '{\n  "pressure_points": [{"location": "surface_a", "pressure_psi": 15.2}],\n  "threshold_exceeded": false\n}',
  BALANCE: '{\n  "orientation": {"pitch": 2.3, "roll": -1.1, "yaw": 0.5},\n  "stability_score": 0.94\n}',
  SMELL: '{\n  "chemical_signatures": ["CO2", "CH4"],\n  "concentrations_ppm": [450, 2.1],\n  "anomaly_detected": false\n}',
  TASTE: '{\n  "quality_metrics": {"pH": 7.2, "salinity": 0.05},\n  "fitness_score": 0.89,\n  "quality_grade": "A"\n}',
};

const TestSignalInjector: React.FC<TestSignalInjectorProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'single' | 'capsule'>('single');
  
  // Single SCU state
  const [singleSCU, setSingleSCU] = useState<SCUForm>({
    id: '1',
    sensory_type: 'VISION',
    signal_data: EXAMPLE_DATA.VISION,
    source_id: 'test_sensor_01'
  });
  
  // Capsule state
  const [capsuleSourceId, setCapsuleSourceId] = useState('sensor_hub_test');
  const [capsuleSCUs, setCapsuleSCUs] = useState<SCUForm[]>([
    {
      id: '1',
      sensory_type: 'VISION',
      signal_data: EXAMPLE_DATA.VISION,
      source_id: 'sensor_hub_test'
    }
  ]);
  
  // Response state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const handleSendSingle = async () => {
    setLoading(true);
    setResponse(null);

    try {
      // Parse signal data
      const signalData = JSON.parse(singleSCU.signal_data);

      // Create SCU payload
      const payload = {
        schema_version: '1.0.0',
        sensory_type: singleSCU.sensory_type,
        signal_data: signalData,
        metadata: {
          timestamp: new Date().toISOString(),
          source_id: singleSCU.source_id,
          integrity_hash: '0'.repeat(64) // Placeholder - backend will validate
        }
      };

      // Compute integrity hash (simplified for testing)
      const hashInput = `${payload.sensory_type}:${payload.metadata.source_id}:${JSON.stringify(signalData, null, 0)}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      payload.metadata.integrity_hash = hashHex;

      // Send to Conduit
      const res = await fetch('http://localhost:8000/conduit/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        setResponse({
          success: true,
          message: 'Signal sent successfully!',
          data: result
        });
      } else {
        setResponse({
          success: false,
          message: result.detail?.message || result.message || 'Failed to send signal',
          data: result
        });
      }
    } catch (error: any) {
      setResponse({
        success: false,
        message: error.message || 'Error sending signal'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendCapsule = async () => {
    setLoading(true);
    setResponse(null);

    try {
      // Create SCUs with integrity hashes
      const scus = await Promise.all(capsuleSCUs.map(async (scu) => {
        const signalData = JSON.parse(scu.signal_data);
        
        const scuPayload = {
          schema_version: '1.0.0',
          sensory_type: scu.sensory_type,
          signal_data: signalData,
          metadata: {
            timestamp: new Date().toISOString(),
            source_id: scu.source_id,
            integrity_hash: '0'.repeat(64)
          }
        };

        // Compute integrity hash
        const hashInput = `${scuPayload.sensory_type}:${scuPayload.metadata.source_id}:${JSON.stringify(signalData, null, 0)}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(hashInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        scuPayload.metadata.integrity_hash = hashHex;

        return scuPayload;
      }));

      // Create capsule payload
      const capsulePayload = {
        capsule_id: `test_capsule_${Date.now()}`,
        timestamp: new Date().toISOString(),
        source_id: capsuleSourceId,
        scus: scus
      };

      // Send to Conduit
      const res = await fetch('http://localhost:8000/conduit/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capsulePayload)
      });

      const result = await res.json();

      if (res.ok) {
        setResponse({
          success: true,
          message: `Capsule with ${scus.length} SCUs sent successfully!`,
          data: result
        });
      } else {
        setResponse({
          success: false,
          message: result.detail?.message || result.message || 'Failed to send capsule',
          data: result
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

  const addSCUToCapsule = () => {
    setCapsuleSCUs([
      ...capsuleSCUs,
      {
        id: Date.now().toString(),
        sensory_type: 'VISION',
        signal_data: EXAMPLE_DATA.VISION,
        source_id: capsuleSourceId
      }
    ]);
  };

  const removeSCUFromCapsule = (id: string) => {
    setCapsuleSCUs(capsuleSCUs.filter(scu => scu.id !== id));
  };

  const updateCapsuleSCU = (id: string, field: keyof SCUForm, value: string) => {
    setCapsuleSCUs(capsuleSCUs.map(scu => 
      scu.id === id ? { ...scu, [field]: value } : scu
    ));
  };

  const loadExampleData = (type: string, scuId?: string) => {
    const exampleData = EXAMPLE_DATA[type as keyof typeof EXAMPLE_DATA] || '{}';
    
    if (mode === 'single') {
      setSingleSCU({ ...singleSCU, signal_data: exampleData });
    } else if (scuId) {
      updateCapsuleSCU(scuId, 'signal_data', exampleData);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header with Warning */}
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
                  <span>Test Signal Injector</span>
                </h1>
                <p className="label-tactical">Development tool for testing sensory signals</p>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          <Card className="glass-card bg-yellow-500/10 border-yellow-500/50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-400 mb-1">DEVELOPMENT TOOL ONLY</p>
                  <p className="text-slate-300">
                    This tool simulates external systems sending sensory signals. 
                    For testing purposes only. Not for production use.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mode Selector */}
        <div className="flex space-x-4 mb-6">
          <motion.button
            onClick={() => setMode('single')}
            className={`flex-1 glass-panel p-4 transition-all ${
              mode === 'single' ? 'border-cyan-500/50 bg-cyan-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center space-x-2">
              <Send className={mode === 'single' ? 'text-cyan-400' : 'text-slate-400'} size={20} />
              <span className={`font-semibold ${mode === 'single' ? 'text-cyan-400' : 'text-slate-400'}`}>
                Single SCU
              </span>
            </div>
          </motion.button>

          <motion.button
            onClick={() => setMode('capsule')}
            className={`flex-1 glass-panel p-4 transition-all ${
              mode === 'capsule' ? 'border-purple-500/50 bg-purple-500/10' : 'hover:border-white/20'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center space-x-2">
              <Package className={mode === 'capsule' ? 'text-purple-400' : 'text-slate-400'} size={20} />
              <span className={`font-semibold ${mode === 'capsule' ? 'text-purple-400' : 'text-slate-400'}`}>
                Sensory Capsule
              </span>
            </div>
          </motion.button>
        </div>

        {/* Single SCU Mode */}
        {mode === 'single' && (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="heading-primary">Send Individual SCU</CardTitle>
              <CardDescription className="label-tactical">
                Create and send a single sensory cargo unit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sensory Type */}
              <div>
                <label className="label-tactical block mb-2">Sensory Type</label>
                <select
                  value={singleSCU.sensory_type}
                  onChange={(e) => {
                    setSingleSCU({ ...singleSCU, sensory_type: e.target.value });
                    loadExampleData(e.target.value);
                  }}
                  className="tactical-input w-full"
                >
                  {SENSORY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source ID */}
              <div>
                <label className="label-tactical block mb-2">Source ID</label>
                <Input
                  value={singleSCU.source_id}
                  onChange={(e) => setSingleSCU({ ...singleSCU, source_id: e.target.value })}
                  className="tactical-input"
                  placeholder="test_sensor_01"
                />
              </div>

              {/* Signal Data */}
              <div>
                <label className="label-tactical block mb-2">Signal Data (JSON)</label>
                <textarea
                  value={singleSCU.signal_data}
                  onChange={(e) => setSingleSCU({ ...singleSCU, signal_data: e.target.value })}
                  className="tactical-input w-full font-mono text-sm"
                  rows={8}
                  placeholder='{"key": "value"}'
                />
              </div>

              {/* Send Button */}
              <motion.button
                onClick={handleSendSingle}
                disabled={loading}
                className="btn-primary w-full"
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="loading-spinner"></div>
                    <span>SENDING...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Send size={20} />
                    <span>SEND SIGNAL</span>
                  </div>
                )}
              </motion.button>
            </CardContent>
          </Card>
        )}

        {/* Capsule Mode */}
        {mode === 'capsule' && (
          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="heading-primary">Send Sensory Capsule</CardTitle>
              <CardDescription className="label-tactical">
                Create and send multiple SCUs in one capsule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Capsule Source ID */}
              <div>
                <label className="label-tactical block mb-2">Capsule Source ID</label>
                <Input
                  value={capsuleSourceId}
                  onChange={(e) => setCapsuleSourceId(e.target.value)}
                  className="tactical-input"
                  placeholder="sensor_hub_test"
                />
              </div>

              {/* SCUs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="label-tactical">SCUs in Capsule ({capsuleSCUs.length})</label>
                  <motion.button
                    onClick={addSCUToCapsule}
                    className="glass-panel px-3 py-2 hover:border-cyan-500/50 transition-all"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center space-x-2">
                      <Plus className="text-cyan-400" size={16} />
                      <span className="text-sm text-cyan-400">Add SCU</span>
                    </div>
                  </motion.button>
                </div>

                {capsuleSCUs.map((scu, index) => (
                  <div key={scu.id} className="glass-panel p-4 space-y-3 border-l-4 border-purple-500/50">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-400">SCU #{index + 1}</span>
                      {capsuleSCUs.length > 1 && (
                        <motion.button
                          onClick={() => removeSCUFromCapsule(scu.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      )}
                    </div>

                    <div>
                      <label className="label-tactical block mb-2">Sensory Type</label>
                      <select
                        value={scu.sensory_type}
                        onChange={(e) => {
                          updateCapsuleSCU(scu.id, 'sensory_type', e.target.value);
                          loadExampleData(e.target.value, scu.id);
                        }}
                        className="tactical-input w-full"
                      >
                        {SENSORY_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label-tactical block mb-2">Source ID</label>
                      <Input
                        value={scu.source_id}
                        onChange={(e) => updateCapsuleSCU(scu.id, 'source_id', e.target.value)}
                        className="tactical-input"
                        placeholder={capsuleSourceId}
                      />
                    </div>

                    <div>
                      <label className="label-tactical block mb-2">Signal Data (JSON)</label>
                      <textarea
                        value={scu.signal_data}
                        onChange={(e) => updateCapsuleSCU(scu.id, 'signal_data', e.target.value)}
                        className="tactical-input w-full font-mono text-sm"
                        rows={6}
                        placeholder='{"key": "value"}'
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Send Button */}
              <motion.button
                onClick={handleSendCapsule}
                disabled={loading}
                className="btn-primary w-full"
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="loading-spinner"></div>
                    <span>SENDING...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Package size={20} />
                    <span>SEND CAPSULE ({capsuleSCUs.length} SCUs)</span>
                  </div>
                )}
              </motion.button>
            </CardContent>
          </Card>
        )}

        {/* Response Display */}
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
