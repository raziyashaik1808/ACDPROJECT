import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { useFleet } from '../context/FleetContext';
import {
  IconActivity,
  IconSparkles,
  IconAlertTriangle,
  IconCheckCircle,
  IconShieldCheck,
  IconWrench,
  IconHistory,
  IconRefresh,
} from '../components/Icons';

export default function Predictions() {
  const { fleet, setFleet, refreshFleet } = useFleet();

  const [selectedMachineId, setSelectedMachineId] = useState(fleet[0]?.id || 'M-14860');
  const [activeModelTab, setActiveModelTab] = useState('supervised'); // 'supervised' | 'anomaly'

  const [inputs, setInputs] = useState({
    Air_temperature_K: 298.1,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1551,
    Torque_Nm: 42.8,
    Tool_wear_min: 15,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [anomalyResult, setAnomalyResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // MongoDB History Audit Trail
  const [historyTab, setHistoryTab] = useState('predictions'); // 'predictions' | 'anomalies' | 'recommendations'
  const [predHistory, setPredHistory] = useState([]);
  const [anomalyHistory, setAnomalyHistory] = useState([]);
  const [recHistory, setRecHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const presets = [
    {
      name: 'Nominal Condition',
      data: {
        Air_temperature_K: 298.1,
        Process_temperature_K: 308.6,
        Rotational_speed_rpm: 1551,
        Torque_Nm: 42.8,
        Tool_wear_min: 15,
      },
    },
    {
      name: 'Heat Dissipation Hazard',
      data: {
        Air_temperature_K: 304.5,
        Process_temperature_K: 312.2,
        Rotational_speed_rpm: 1390,
        Torque_Nm: 54.0,
        Tool_wear_min: 185,
      },
    },
    {
      name: 'Severe Tool Wear (TWF)',
      data: {
        Air_temperature_K: 301.0,
        Process_temperature_K: 310.5,
        Rotational_speed_rpm: 1320,
        Torque_Nm: 58.5,
        Tool_wear_min: 242,
      },
    },
    {
      name: 'High Torque Overstrain (OSF)',
      data: {
        Air_temperature_K: 306.0,
        Process_temperature_K: 315.5,
        Rotational_speed_rpm: 1240,
        Torque_Nm: 71.0,
        Tool_wear_min: 195,
      },
    },
  ];

  const fetchAuditHistory = async () => {
    setLoadingHistory(true);
    try {
      const [predsRes, anomsRes, recsRes] = await Promise.allSettled([
        API.get('/predictions/history?limit=15'),
        API.get('/anomalies/history?limit=15'),
        API.get('/recommendations?limit=15'),
      ]);

      if (predsRes.status === 'fulfilled' && predsRes.value?.data) {
        setPredHistory(predsRes.value.data.records || []);
      }
      if (anomsRes.status === 'fulfilled' && anomsRes.value?.data) {
        setAnomalyHistory(anomsRes.value.data || []);
      }
      if (recsRes.status === 'fulfilled' && recsRes.value?.data) {
        setRecHistory(recsRes.value.data || []);
      }
    } catch (err) {
      console.warn('Audit trail load error:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleStatusChange = async (recId, newStatus) => {
    try {
      await API.put(`/recommendations/${recId}/status`, { status: newStatus });
      setRecHistory(prev =>
        prev.map(r => (r.recommendation_id === recId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Failed to update recommendation status:', err);
    }
  };

  useEffect(() => {
    fetchAuditHistory();
  }, []);

  const handleInputChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
    setSavedSuccess(false);
  };

  const applyPreset = (presetData) => {
    setInputs(presetData);
    setResult(null);
    setAnomalyResult(null);
    setSavedSuccess(false);
  };

  const runSupervisedPrediction = async () => {
    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const payload = {
        ...inputs,
        machine_id: selectedMachineId,
      };
      const response = await API.post('/predict', payload);
      setResult(response.data);
      // Auto-refresh fleet and audit trail
      refreshFleet();
      fetchAuditHistory();
    } catch (err) {
      console.error('Supervised inference error:', err);
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setError(errData.errors.join(' | '));
      } else if (errData?.detail) {
        if (typeof errData.detail === 'object') {
          setError(errData.detail.message || JSON.stringify(errData.detail));
        } else {
          setError(errData.detail);
        }
      } else {
        setError(err.message || 'Inference error');
      }
    } finally {
      setLoading(false);
    }
  };

  const runAnomalyDetection = async () => {
    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const payload = {
        ...inputs,
        machine_id: selectedMachineId,
      };
      const response = await API.post('/anomalies/detect', payload);
      setAnomalyResult(response.data);
      fetchAuditHistory();
    } catch (err) {
      console.error('Anomaly detection error:', err);
      const errData = err?.response?.data;
      if (errData?.errors && Array.isArray(errData.errors)) {
        setError(errData.errors.join(' | '));
      } else if (errData?.detail) {
        if (typeof errData.detail === 'object') {
          setError(errData.detail.message || JSON.stringify(errData.detail));
        } else {
          setError(errData.detail);
        }
      } else {
        setError(err.message || 'Anomaly detection error');
      }
    } finally {
      setLoading(false);
    }
  };

  const addSimulatedToFleet = () => {
    if (!result) return;
    const newId = `SIM-${Math.floor(100 + Math.random() * 900)}`;
    const newMachine = {
      id: newId,
      machine_id: newId,
      name: `Simulated Machine Unit`,
      type: 'M',
      ...inputs,
      ...result,
      last_prediction_time: 'Just now',
    };
    setFleet(prev => [newMachine, ...prev]);
    setSavedSuccess(true);
  };

  const isCritical = result?.health_status === 'Critical';
  const isWarning = result?.health_status === 'Warning';
  const riskColor = isCritical ? 'var(--status-critical)' : isWarning ? 'var(--status-warning)' : 'var(--status-healthy)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner / Scenarios */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">
              <IconSparkles size={18} style={{ color: 'var(--primary)' }} />
              Real-Time Sensor Simulator & AI Inference Engine
            </div>
            <div className="pm-card-subtitle">
              Dual-Model Intelligence: UCI AI4I Supervised Failure Prediction + Isolation Forest Anomaly Detection (Persisted to MongoDB)
            </div>
          </div>

          {/* Machine Selection Target */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy-600)' }}>
              Target Machine:
            </span>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--navy-200)',
                backgroundColor: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--navy-900)',
                cursor: 'pointer',
              }}
            >
              {fleet.map((m) => (
                <option key={m.id || m.machine_id} value={m.id || m.machine_id}>
                  {m.id || m.machine_id} - {m.name || 'Unit'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy-600)' }}>
            Load Simulation Scenario:
          </span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(p.data)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11.5px' }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Simulator 2-Column Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '20px',
        }}
        className="sim-grid"
      >
        {/* Left: Input Controls Form */}
        <div className="pm-card">
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">Telemetry Parameter Inputs</div>
              <div className="pm-card-subtitle">Values fed into Random Forest 5-feature vector & Isolation Forest</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Air Temp */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>Air Temperature [K]</span>
                <span className="telemetry-val">{inputs.Air_temperature_K} K</span>
              </div>
              <input
                type="range"
                min="295"
                max="315"
                step="0.1"
                value={inputs.Air_temperature_K}
                onChange={(e) => handleInputChange('Air_temperature_K', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--navy-400)' }}>
                <span>295 K (Cold)</span>
                <span>Nominal: ~298 - 302 K</span>
                <span>315 K (Overheat)</span>
              </div>
            </div>

            {/* Process Temp */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>Process Temperature [K]</span>
                <span className="telemetry-val">{inputs.Process_temperature_K} K</span>
              </div>
              <input
                type="range"
                min="305"
                max="325"
                step="0.1"
                value={inputs.Process_temperature_K}
                onChange={(e) => handleInputChange('Process_temperature_K', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--navy-400)' }}>
                <span>305 K</span>
                <span>Thermal Dissipation Limit: 312 K</span>
                <span>325 K</span>
              </div>
            </div>

            {/* Rotational Speed */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>Rotational Speed [rpm]</span>
                <span className="telemetry-val">{inputs.Rotational_speed_rpm} RPM</span>
              </div>
              <input
                type="range"
                min="1100"
                max="2800"
                step="10"
                value={inputs.Rotational_speed_rpm}
                onChange={(e) => handleInputChange('Rotational_speed_rpm', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--navy-400)' }}>
                <span>1100 RPM (Low stall)</span>
                <span>Nominal: ~1500 RPM</span>
                <span>2800 RPM (High)</span>
              </div>
            </div>

            {/* Torque */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>Torque [Nm]</span>
                <span className="telemetry-val">{inputs.Torque_Nm} Nm</span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                step="0.5"
                value={inputs.Torque_Nm}
                onChange={(e) => handleInputChange('Torque_Nm', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--navy-400)' }}>
                <span>5 Nm (Light)</span>
                <span>Threshold: &gt;55 Nm (Overstrain)</span>
                <span>85 Nm (Critical)</span>
              </div>
            </div>

            {/* Tool Wear */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--navy-800)' }}>Tool Wear Duration [min]</span>
                <span className="telemetry-val">{inputs.Tool_wear_min} min</span>
              </div>
              <input
                type="range"
                min="0"
                max="260"
                step="1"
                value={inputs.Tool_wear_min}
                onChange={(e) => handleInputChange('Tool_wear_min', e.target.value)}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--navy-400)' }}>
                <span>0 min (Fresh Tool)</span>
                <span>Safe Limit: &lt;180 min</span>
                <span>260 min (Critical Wear)</span>
              </div>
            </div>

            {/* Dual Inference Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={runSupervisedPrediction}
                disabled={loading}
                className="btn btn-primary"
                style={{ height: '42px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <IconActivity size={16} />
                {loading ? 'Evaluating...' : 'Run Failure Prediction'}
              </button>
              <button
                onClick={runAnomalyDetection}
                disabled={loading}
                className="btn btn-secondary"
                style={{ height: '42px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <IconShieldCheck size={16} />
                {loading ? 'Detecting...' : 'Detect Isolation Anomaly'}
              </button>
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '12px',
                  marginTop: '6px',
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconAlertTriangle size={14} /> Validation & Inference Diagnostic:
                </div>
                <div>{error}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Inference Results Panel */}
        <div className="pm-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">Model Inference & Anomaly Diagnostic</div>
              <div className="pm-card-subtitle">Real-time diagnosis persisted directly to local MongoDB</div>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setActiveModelTab('supervised')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--navy-200)',
                  backgroundColor: activeModelTab === 'supervised' ? 'var(--primary)' : '#ffffff',
                  color: activeModelTab === 'supervised' ? '#ffffff' : 'var(--navy-700)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Supervised (AI4I)
              </button>
              <button
                onClick={() => setActiveModelTab('anomaly')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--navy-200)',
                  backgroundColor: activeModelTab === 'anomaly' ? 'var(--primary)' : '#ffffff',
                  color: activeModelTab === 'anomaly' ? '#ffffff' : 'var(--navy-700)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Isolation Forest
              </button>
            </div>
          </div>

          {activeModelTab === 'supervised' ? (
            !result ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--navy-500)',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--navy-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    color: 'var(--navy-400)',
                  }}
                >
                  <IconActivity size={26} />
                </div>
                <div style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: '14px' }}>
                  Awaiting Supervised Inference
                </div>
                <p style={{ fontSize: '12px', maxWidth: '280px', marginTop: '4px' }}>
                  Adjust the telemetry sliders on the left, then click "Run Failure Prediction".
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
                {/* Gauge & Outcome Card */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: isCritical ? '#fff8f8' : isWarning ? '#fffdf7' : '#f7fdf9',
                    border: `1px solid ${isCritical ? 'var(--status-critical-border)' : isWarning ? 'var(--status-warning-border)' : 'var(--status-healthy-border)'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className={`status-badge ${result.health_status.toLowerCase()}`}>
                      Status: {result.health_status}
                    </span>
                    {result.prediction_id && (
                      <span style={{ fontSize: '10.5px', color: 'var(--navy-500)', fontFamily: 'monospace' }}>
                        MongoDB: {result.prediction_id}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '40px',
                      fontWeight: 800,
                      color: riskColor,
                      lineHeight: 1,
                      margin: '6px 0',
                    }}
                  >
                    {result.risk_score.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Equipment Failure Probability
                  </div>

                  <div
                    style={{
                      marginTop: '10px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--navy-200)',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: result.failure_prediction === 1 ? 'var(--status-critical)' : 'var(--status-healthy-text)',
                    }}
                  >
                    Prediction: {result.failure_prediction === 1 ? '⚠️ Machine Failure Imminent (Class 1)' : '✅ Healthy Operation (Class 0)'}
                  </div>
                </div>

                {/* Prescriptive / Intelligent Recommendation Card */}
                {(() => {
                  const rec = result.intelligent_recommendation;
                  if (!rec) {
                    return (
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: '#f8fafc',
                          border: '1px solid var(--navy-200)',
                        }}
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--navy-800)', marginBottom: '3px' }}>
                          Prescriptive Recommendation:
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--navy-700)', lineHeight: 1.4 }}>
                          {result.recommendation}
                        </div>
                      </div>
                    );
                  }

                  const priorityStyles = {
                    Critical: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#fee2e2' },
                    High: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#fef3c7' },
                    Medium: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: '#dbeafe' },
                    Low: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#dcfce7' },
                  };
                  const pStyle = priorityStyles[rec.priority] || priorityStyles.Low;

                  return (
                    <div
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: pStyle.bg,
                        border: `1px solid ${pStyle.border}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: pStyle.badge,
                              color: pStyle.text,
                            }}
                          >
                            {rec.priority} Priority
                          </span>
                          {rec.recommendation_id && (
                            <span style={{ fontSize: '10.5px', color: 'var(--navy-500)', fontFamily: 'monospace' }}>
                              ID: {rec.recommendation_id}
                            </span>
                          )}
                        </div>
                        {rec.urgency_timeframe && (
                          <span style={{ fontSize: '11px', color: pStyle.text, fontWeight: 600 }}>
                            ⏱️ {rec.urgency_timeframe}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: pStyle.text, lineHeight: 1.4, marginBottom: '8px' }}>
                        {rec.reason}
                      </div>

                      {rec.actions && rec.actions.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${pStyle.border}` }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--navy-700)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <IconWrench size={13} /> Recommended Maintenance Actions:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--navy-800)', lineHeight: 1.5 }}>
                            {rec.actions.map((act, actIdx) => (
                              <li key={actIdx}>{act}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Explainable AI: Feature Contributions (SHAP) */}
                {result.feature_contributions && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--navy-800)' }}>
                        Explainable Feature Attribution (SHAP):
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--navy-500)', fontStyle: 'italic' }}>
                        Statistical impact on risk
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(Array.isArray(result.feature_contributions)
                        ? result.feature_contributions
                        : Object.entries(result.feature_contributions).map(([feat, val]) => ({
                            feature: feat,
                            value: inputs[feat] ?? '-',
                            z_score: 0,
                            relative_contribution: typeof val === 'number' ? val : (val.relative_contribution || 0),
                            direction: 'Attribution',
                          }))
                      ).map((fc, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', padding: '2px 0' }}>
                          <span style={{ color: 'var(--navy-700)', fontWeight: 500 }}>{fc.feature}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--navy-500)' }}>
                              val: {fc.value} (z: {fc.z_score > 0 ? `+${fc.z_score}` : fc.z_score})
                            </span>
                            {fc.direction && (
                              <span style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: fc.direction.includes('Increases') ? 'var(--status-critical-subtle)' : 'var(--navy-100)',
                                color: fc.direction.includes('Increases') ? 'var(--status-critical-text)' : 'var(--navy-700)',
                                fontWeight: 600,
                              }}>
                                {fc.direction}
                              </span>
                            )}
                            <span style={{
                              fontWeight: 700,
                              minWidth: '40px',
                              textAlign: 'right',
                              color: fc.relative_contribution > 25 ? 'var(--status-critical)' : fc.relative_contribution > 15 ? 'var(--status-warning)' : 'var(--navy-600)',
                            }}>
                              {fc.relative_contribution}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={addSimulatedToFleet}
                  disabled={savedSuccess}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {savedSuccess ? 'Added to Monitored Fleet!' : '+ Add Unit to Live Monitored Fleet'}
                </button>
              </div>
            )
          ) : (
            /* Isolation Forest Tab */
            !anomalyResult ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--navy-500)',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--navy-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    color: 'var(--navy-400)',
                  }}
                >
                  <IconShieldCheck size={26} />
                </div>
                <div style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: '14px' }}>
                  Awaiting Anomaly Detection
                </div>
                <p style={{ fontSize: '12px', maxWidth: '280px', marginTop: '4px' }}>
                  Adjust the telemetry sliders on the left, then click "Detect Isolation Anomaly" to evaluate multi-dimensional outliers.
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
                {/* Anomaly Gauge */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: anomalyResult.is_anomaly ? '#fff8f8' : '#f7fdf9',
                    border: `1px solid ${anomalyResult.is_anomaly ? 'var(--status-critical-border)' : 'var(--status-healthy-border)'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className={`status-badge ${anomalyResult.is_anomaly ? 'critical' : 'healthy'}`}>
                      {anomalyResult.anomaly_level || (anomalyResult.is_anomaly ? 'Anomaly Detected' : 'Normal')}
                    </span>
                    {anomalyResult.anomaly_id && (
                      <span style={{ fontSize: '10.5px', color: 'var(--navy-500)', fontFamily: 'monospace' }}>
                        MongoDB: {anomalyResult.anomaly_id}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '40px',
                      fontWeight: 800,
                      color: anomalyResult.is_anomaly ? 'var(--status-critical)' : 'var(--status-healthy)',
                      lineHeight: 1,
                      margin: '6px 0',
                    }}
                  >
                    {anomalyResult.anomaly_score.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Isolation Forest Outlier Score (0 - 100)
                  </div>

                  <div
                    style={{
                      marginTop: '10px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--navy-200)',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: anomalyResult.is_anomaly ? 'var(--status-critical)' : 'var(--status-healthy-text)',
                    }}
                  >
                    {anomalyResult.is_anomaly ? '⚠️ Statistical Telemetry Outlier Detected' : '✅ Within Baseline Operational Manifold'}
                  </div>
                </div>

                {/* Anomaly Recommendation */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--navy-200)',
                  }}
                >
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--navy-800)', marginBottom: '3px' }}>
                    Outlier Recommendation:
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--navy-700)', lineHeight: 1.4 }}>
                    {anomalyResult.recommendation}
                  </div>
                </div>

                {/* Deviating Features */}
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--navy-800)', marginBottom: '6px' }}>
                    Deviating Sensor Parameters (vs Baseline):
                  </div>
                  {anomalyResult.deviating_features && anomalyResult.deviating_features.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {anomalyResult.deviating_features.map((df, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                          <span style={{ color: 'var(--navy-700)' }}>{df.feature}</span>
                          <span style={{ fontWeight: 600, color: Math.abs(df.z_score) > 3 ? 'var(--status-critical)' : 'var(--status-warning)' }}>
                            val: {df.value} | z: {df.z_score > 0 ? `+${df.z_score}` : df.z_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                      All parameters align with historical baseline distributions.
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Persisted Audit Trail Section (Directly from MongoDB collections) */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">
              <IconHistory size={17} style={{ color: 'var(--primary)' }} />
              MongoDB Inference & Anomaly Audit Trail
            </div>
            <div className="pm-card-subtitle">
              Persistent inference log stored in <code>prediction_history</code> and <code>anomaly_history</code> collections
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setHistoryTab('predictions')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--navy-200)',
                  backgroundColor: historyTab === 'predictions' ? 'var(--primary)' : '#ffffff',
                  color: historyTab === 'predictions' ? '#ffffff' : 'var(--navy-700)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Predictions ({predHistory.length})
              </button>
              <button
                onClick={() => setHistoryTab('anomalies')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--navy-200)',
                  backgroundColor: historyTab === 'anomalies' ? 'var(--primary)' : '#ffffff',
                  color: historyTab === 'anomalies' ? '#ffffff' : 'var(--navy-700)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Anomalies ({anomalyHistory.length})
              </button>
              <button
                onClick={() => setHistoryTab('recommendations')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--navy-200)',
                  backgroundColor: historyTab === 'recommendations' ? 'var(--primary)' : '#ffffff',
                  color: historyTab === 'recommendations' ? '#ffffff' : 'var(--navy-700)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Recommendations ({recHistory.length})
              </button>
            </div>

            <button
              onClick={fetchAuditHistory}
              disabled={loadingHistory}
              className="btn btn-secondary btn-sm"
              title="Refresh MongoDB Logs"
            >
              <IconRefresh size={14} />
            </button>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--navy-500)' }}>
            Retrieving persistent records from MongoDB...
          </div>
        ) : historyTab === 'predictions' ? (
          predHistory.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--navy-400)', fontSize: '13px' }}>
              No prediction records found in MongoDB. Run an inference above or upload a CSV dataset.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Prediction ID</th>
                    <th>Machine</th>
                    <th>Air Temp</th>
                    <th>Proc Temp</th>
                    <th>RPM</th>
                    <th>Torque</th>
                    <th>Wear</th>
                    <th>Risk Score</th>
                    <th>Health Status</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {predHistory.map((p, i) => (
                    <tr key={p.prediction_id || i}>
                      <td>
                        <code style={{ fontSize: '11px', color: 'var(--primary)' }}>
                          {p.prediction_id || 'N/A'}
                        </code>
                      </td>
                      <td><strong>{p.machine_id || 'M-14860'}</strong></td>
                      <td>{p.sensor_readings?.Air_temperature_K} K</td>
                      <td>{p.sensor_readings?.Process_temperature_K} K</td>
                      <td>{p.sensor_readings?.Rotational_speed_rpm} RPM</td>
                      <td>{p.sensor_readings?.Torque_Nm} Nm</td>
                      <td>{p.sensor_readings?.Tool_wear_min} min</td>
                      <td>
                        <strong style={{
                          color: (p.risk_score || 0) > 70 ? 'var(--status-critical)' : (p.risk_score || 0) > 30 ? 'var(--status-warning)' : 'var(--status-healthy)'
                        }}>
                          {(p.risk_score || 0).toFixed(1)}%
                        </strong>
                      </td>
                      <td>
                        <span className={`status-badge ${(p.health_status || 'healthy').toLowerCase()}`}>
                          {p.health_status || 'Healthy'}
                        </span>
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleTimeString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : historyTab === 'anomalies' ? (
          /* Anomalies table */
          anomalyHistory.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--navy-400)', fontSize: '13px' }}>
              No anomaly records logged in MongoDB yet. Run "Detect Isolation Anomaly" above.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Anomaly ID</th>
                    <th>Machine</th>
                    <th>Outlier Score</th>
                    <th>Anomaly Level</th>
                    <th>Outlier Detected?</th>
                    <th>Deviating Signals</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalyHistory.map((a, i) => (
                    <tr key={a.anomaly_id || i}>
                      <td>
                        <code style={{ fontSize: '11px', color: 'var(--primary)' }}>
                          {a.anomaly_id || 'N/A'}
                        </code>
                      </td>
                      <td><strong>{a.machine_id || 'M-14860'}</strong></td>
                      <td>
                        <strong style={{ color: a.is_anomaly ? 'var(--status-critical)' : 'var(--status-healthy)' }}>
                          {(a.anomaly_score || 0).toFixed(1)}
                        </strong>
                      </td>
                      <td>
                        <span className={`status-badge ${(a.anomaly_level || (a.is_anomaly ? 'critical' : 'healthy')).toLowerCase()}`}>
                          {a.anomaly_level || (a.is_anomaly ? 'Critical' : 'Normal')}
                        </span>
                      </td>
                      <td>
                        {a.is_anomaly ? '⚠️ Outlier' : '✅ Nominal'}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--navy-600)' }}>
                        {a.deviating_features && a.deviating_features.length > 0
                          ? a.deviating_features.map(f => `${f.feature} (z:${f.z_score})`).join(', ')
                          : 'None'}
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                        {a.created_at ? new Date(a.created_at).toLocaleTimeString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Recommendations Table */
          recHistory.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--navy-400)', fontSize: '13px' }}>
              No maintenance recommendations recorded in MongoDB yet. Run a prediction to generate intelligent recommendations.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Rec ID</th>
                    <th>Machine</th>
                    <th>Priority</th>
                    <th>Primary Reason & Prescribed Actions</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recHistory.map((r, i) => {
                    const priorityClass = (r.priority || 'low').toLowerCase();
                    return (
                      <tr key={r.recommendation_id || i}>
                        <td>
                          <code style={{ fontSize: '11px', color: 'var(--primary)' }}>
                            {r.recommendation_id || 'N/A'}
                          </code>
                        </td>
                        <td><strong>{r.machine_id || 'M-14860'}</strong></td>
                        <td>
                          <span className={`status-badge ${priorityClass}`}>
                            {r.priority || 'Low'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '380px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '12px', marginBottom: '3px' }}>
                            {r.reason}
                          </div>
                          {r.actions && r.actions.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--navy-600)' }}>
                              {r.actions.slice(0, 2).map((act, idx) => (
                                <li key={idx}>{act}</li>
                              ))}
                              {r.actions.length > 2 && (
                                <li style={{ fontStyle: 'italic' }}>+{r.actions.length - 2} more actions</li>
                              )}
                            </ul>
                          )}
                        </td>
                        <td style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--navy-700)' }}>
                          {r.urgency_timeframe || 'Next maintenance interval'}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                r.status === 'completed'
                                  ? '#dcfce7'
                                  : r.status === 'in_progress'
                                  ? '#fef3c7'
                                  : r.status === 'dismissed'
                                  ? '#f1f5f9'
                                  : '#fee2e2',
                              color:
                                r.status === 'completed'
                                  ? '#166534'
                                  : r.status === 'in_progress'
                                  ? '#92400e'
                                  : r.status === 'dismissed'
                                  ? '#475569'
                                  : '#991b1b',
                            }}
                          >
                            {r.status || 'open'}
                          </span>
                        </td>
                        <td>
                          <select
                            value={r.status || 'open'}
                            onChange={(e) => handleStatusChange(r.recommendation_id, e.target.value)}
                            style={{
                              fontSize: '11px',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--navy-300)',
                              backgroundColor: '#ffffff',
                              cursor: 'pointer',
                              color: 'var(--navy-800)',
                              fontWeight: 600,
                            }}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="dismissed">Dismissed</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .sim-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
