import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import API from '../services/api';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  IconHistory,
  IconClock,
  IconEye,
  IconAlertTriangle,
  IconWrench,
  IconCheckCircle,
  IconDownload,
  IconFilter,
  IconRefresh,
  IconAlertOctagon,
  IconActivity,
} from '../components/Icons';
import MachineComparison from '../components/MachineComparison';
import { exportMachineHistoryToCSV } from '../utils/exportUtils';
import { Link } from 'react-router-dom';

export default function MachineHistory() {
  const { fleet, setSelectedMachine } = useFleet();

  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'compare'
  const [selectedMachineId, setSelectedMachineId] = useState(fleet[0]?.id || 'M-14860');

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('ALL'); // 'ALL' | '24H' | '7D' | '30D' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Backend History State
  const [dbHistory, setDbHistory] = useState({
    prediction_history: [],
    anomaly_history: [],
    work_orders: [],
    alerts: [],
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const selectedMachine = useMemo(
    () => fleet.find(m => m.id === selectedMachineId || m.machine_id === selectedMachineId) || fleet[0],
    [fleet, selectedMachineId]
  );

  const fetchHistory = async () => {
    if (!selectedMachineId) return;
    setLoadingHistory(true);
    setFetchError(null);
    try {
      const res = await API.get(`/machines/${selectedMachineId}/history?limit=100`);
      if (res.data) {
        setDbHistory({
          prediction_history: res.data.prediction_history || [],
          anomaly_history: res.data.anomaly_history || [],
          work_orders: res.data.work_orders || [],
          alerts: res.data.alerts || [],
        });
      }
    } catch (err) {
      console.warn('Machine history fetch from MongoDB error:', err);
      setFetchError(
        err.response?.data?.detail ||
        'Unable to retrieve historical logs from backend. Please ensure the FastAPI backend is running.'
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedMachineId]);

  // Robust sensor feature extractor for arbitrary key formats
  const extractFeatures = (record) => {
    const feat = record.input_features || record.sensor_readings || record;
    return {
      airTemp: Number(feat["Air temperature [K]"] ?? feat.Air_temperature_K ?? 298.0),
      procTemp: Number(feat["Process temperature [K]"] ?? feat.Process_temperature_K ?? 308.0),
      speed: Number(feat["Rotational speed [rpm]"] ?? feat.Rotational_speed_rpm ?? 1500),
      torque: Number(feat["Torque [Nm]"] ?? feat.Torque_Nm ?? 40.0),
      wear: Number(feat["Tool wear [min]"] ?? feat.Tool_wear_min ?? 0),
    };
  };

  // Filter raw prediction records by date range
  const filteredPredictions = useMemo(() => {
    const raw = dbHistory.prediction_history || [];
    if (datePreset === 'ALL') return raw;

    const now = new Date();
    return raw.filter(p => {
      if (!p.created_at) return true;
      const recDate = new Date(p.created_at);

      if (datePreset === '24H') {
        return (now - recDate) <= 24 * 60 * 60 * 1000;
      }
      if (datePreset === '7D') {
        return (now - recDate) <= 7 * 24 * 60 * 60 * 1000;
      }
      if (datePreset === '30D') {
        return (now - recDate) <= 30 * 24 * 60 * 60 * 1000;
      }
      if (datePreset === 'CUSTOM') {
        if (startDate && recDate < new Date(startDate)) return false;
        if (endDate && recDate > new Date(endDate + 'T23:59:59')) return false;
        return true;
      }
      return true;
    });
  }, [dbHistory.prediction_history, datePreset, startDate, endDate]);

  // Build real historical chart points (chronological order)
  const chartData = useMemo(() => {
    if (!filteredPredictions || filteredPredictions.length === 0) {
      return [];
    }

    return [...filteredPredictions].reverse().map((p, idx) => {
      const { airTemp, procTemp, speed, torque, wear } = extractFeatures(p);
      const timeStr = p.created_at
        ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : `T-${idx + 1}`;
      const dateStr = p.created_at
        ? new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : '';

      return {
        id: p.prediction_id || `REC-${idx + 1}`,
        cycle: dateStr ? `${dateStr} ${timeStr}` : `Log #${idx + 1}`,
        timestamp: p.created_at || '',
        airTemp: Number(airTemp.toFixed(1)),
        procTemp: Number(procTemp.toFixed(1)),
        tempDelta: Number((procTemp - airTemp).toFixed(1)),
        speed: Math.round(speed),
        torque: Number(torque.toFixed(1)),
        wear: Math.round(wear),
        risk: Number((p.risk_score || 0).toFixed(1)),
        health_status: p.health_status || 'Healthy',
        is_anomaly: p.is_anomaly || false,
        anomaly_score: p.anomaly_score !== undefined ? Number(p.anomaly_score).toFixed(1) : null,
        recommendation: p.recommendation || '',
        source: p.source || 'MongoDB Record',
      };
    });
  }, [filteredPredictions]);

  const handleExportHistoryCSV = () => {
    if (chartData.length === 0) return;
    exportMachineHistoryToCSV(chartData, selectedMachineId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Tab Navigation */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">
              <IconHistory size={18} style={{ color: 'var(--primary)' }} />
              Equipment Telemetry History & Advanced Analytics
            </div>
            <div className="pm-card-subtitle">
              Inspect historical sensor trends, thermal dissipation, failure risk trajectories, and comparative benchmarking
            </div>
          </div>

          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--navy-100)',
              padding: '3px',
              borderRadius: 'var(--radius-md)',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setActiveTab('history')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'history' ? 700 : 500,
                backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
                color: activeTab === 'history' ? 'var(--navy-900)' : 'var(--navy-600)',
                boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              Machine History Records
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'compare' ? 700 : 500,
                backgroundColor: activeTab === 'compare' ? '#ffffff' : 'transparent',
                color: activeTab === 'compare' ? 'var(--navy-900)' : 'var(--navy-600)',
                boxShadow: activeTab === 'compare' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              Machine-to-Machine Comparison
            </button>
          </div>
        </div>

        {/* Tab 1 Active: Show Filter Bar & Machine Selector */}
        {activeTab === 'history' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--navy-100)',
            }}
          >
            {/* Machine Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy-600)' }}>
                Machine:
              </span>
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--navy-200)',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--navy-900)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {fleet.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} - {m.name || 'Unit'} ({m.health_status} - {m.risk_score.toFixed(1)}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IconFilter size={13} /> Timeframe:
              </span>
              {['ALL', '24H', '7D', '30D', 'CUSTOM'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: datePreset === preset ? 700 : 500,
                    border: '1px solid',
                    borderColor: datePreset === preset ? 'var(--primary)' : 'var(--navy-200)',
                    backgroundColor: datePreset === preset ? 'var(--primary-subtle)' : '#ffffff',
                    color: datePreset === preset ? 'var(--primary)' : 'var(--navy-600)',
                    cursor: 'pointer',
                  }}
                >
                  {preset === 'ALL' ? 'All Records' : preset === '24H' ? 'Last 24h' : preset === '7D' ? 'Last 7 Days' : preset === '30D' ? 'Last 30 Days' : 'Custom'}
                </button>
              ))}

              {datePreset === 'CUSTOM' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '6px',
                      border: '1px solid var(--navy-200)',
                      fontSize: '11.5px',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '6px',
                      border: '1px solid var(--navy-200)',
                      fontSize: '11.5px',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Refresh and CSV Export Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="btn btn-secondary btn-sm"
                title="Refresh history from MongoDB"
              >
                <IconRefresh size={14} className={loadingHistory ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={handleExportHistoryCSV}
                disabled={chartData.length === 0}
                className="btn btn-primary btn-sm"
                title="Download real history as CSV"
              >
                <IconDownload size={14} />
                Export History CSV
              </button>
            </div>
          </div>
        )}

        {/* Selected Machine Telemetry Summary Ribbon */}
        {activeTab === 'history' && selectedMachine && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px',
              marginTop: '14px',
            }}
            className="kpi-grid"
          >
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--navy-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>OPERATING TORQUE</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-900)' }}>
                {selectedMachine.Torque_Nm} Nm
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--navy-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>ROTATIONAL SPEED</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-900)' }}>
                {selectedMachine.Rotational_speed_rpm} RPM
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--navy-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>TOOL WEAR ACCUMULATED</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-900)' }}>
                {selectedMachine.Tool_wear_min} min
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--navy-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>THERMAL DELTA (ΔT)</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy-900)' }}>
                {(selectedMachine.Process_temperature_K - selectedMachine.Air_temperature_K).toFixed(1)} K
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--navy-200)' }}>
              <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>CURRENT RISK STATUS</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: selectedMachine.risk_score > 70 ? 'var(--status-critical)' : selectedMachine.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-healthy)' }}>
                {selectedMachine.risk_score.toFixed(1)}% ({selectedMachine.health_status})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render Comparison View if Active */}
      {activeTab === 'compare' ? (
        <MachineComparison />
      ) : (
        <>
          {/* Error Banner if API error */}
          {fetchError && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-critical-subtle)',
                border: '1px solid var(--status-critical-border)',
                color: 'var(--status-critical-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IconAlertTriangle size={18} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{fetchError}</span>
              </div>
              <button onClick={fetchHistory} className="btn btn-secondary btn-sm">
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {loadingHistory ? (
            <div className="pm-card" style={{ padding: '48px', textAlign: 'center' }}>
              <div className="animate-spin" style={{ fontSize: '28px', marginBottom: '10px' }}>⚙️</div>
              <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>
                Retrieving real telemetry & prediction records from MongoDB...
              </div>
              <div style={{ fontSize: '12px', color: 'var(--navy-500)', marginTop: '4px' }}>
                Querying collections for {selectedMachineId}
              </div>
            </div>
          ) : chartData.length === 0 ? (
            /* Honest Real Empty State (No fabrication) */
            <div className="pm-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--navy-100)',
                  color: 'var(--navy-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <IconHistory size={26} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--navy-900)' }}>
                No Stored Historical Records for {selectedMachineId}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--navy-500)', maxWidth: '480px', margin: '8px auto 20px' }}>
                No telemetry predictions have been persisted in MongoDB for this unit within the selected timeframe.
                Historical charts only display verified stored records. Run a live test or upload telemetry data to generate logs.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <Link to="/predictions" className="btn btn-primary btn-sm">
                  Run Live Sensor Inference
                </Link>
                <Link to="/upload" className="btn btn-secondary btn-sm">
                  Upload Batch Dataset CSV
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* 2-Column Historical Trend Charts */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '20px',
                }}
                className="charts-grid-row"
              >
                {/* Chart 1: Failure Risk Trajectory with Threshold Reference Lines */}
                <div className="pm-card">
                  <div className="pm-card-header">
                    <div>
                      <div className="pm-card-title">Failure Risk Score Progression</div>
                      <div className="pm-card-subtitle">
                        Actual risk probabilities logged across {chartData.length} records
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 270 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="riskGradReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const p = payload[0].payload;
                              return (
                                <div style={{
                                  backgroundColor: '#ffffff',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12px',
                                }}>
                                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>{label}</div>
                                  <div>Risk Score: <strong style={{ color: '#ef4444' }}>{p.risk}%</strong></div>
                                  <div>Status: <strong>{p.health_status}</strong></div>
                                  {p.is_anomaly && (
                                    <div style={{ color: '#f59e0b', fontWeight: 700, marginTop: '2px' }}>
                                      ⚠️ Sensor Anomaly Detected
                                    </div>
                                  )}
                                  {p.timestamp && (
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                      {new Date(p.timestamp).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical (70%)', fill: '#ef4444', fontSize: 10 }} />
                        <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warning (30%)', fill: '#f59e0b', fontSize: 10 }} />
                        <Area
                          type="monotone"
                          dataKey="risk"
                          name="Failure Risk %"
                          stroke="#ef4444"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#riskGradReal)"
                          dot={{ r: 3, fill: '#ef4444' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Thermal Differential (Process - Air) */}
                <div className="pm-card">
                  <div className="pm-card-header">
                    <div>
                      <div className="pm-card-title">Thermal Dissipation Gradient (ΔT)</div>
                      <div className="pm-card-subtitle">
                        Internal Process Temp vs Ambient Air Temp over recorded logs
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 270 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis unit=" K" tick={{ fontSize: 11, fill: '#64748b' }} domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="procTemp" name="Process Temp [K]" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="airTemp" name="Air Temp [K]" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="tempDelta" name="Delta (ΔT) [K]" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Chart 3 & 4: Mechanical Stress (Torque & Tool Wear) and RPM */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '20px',
                }}
                className="charts-grid-row"
              >
                {/* Mechanical Stress Chart */}
                <div className="pm-card">
                  <div className="pm-card-header">
                    <div>
                      <div className="pm-card-title">Mechanical Stress & Tool Degradation</div>
                      <div className="pm-card-subtitle">
                        Operating Torque (Nm) and Tool Wear (min) accumulation
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis yAxisId="left" unit=" Nm" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis yAxisId="right" orientation="right" unit=" min" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line yAxisId="left" type="monotone" dataKey="torque" name="Torque [Nm]" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                        <Line yAxisId="right" type="monotone" dataKey="wear" name="Tool Wear [min]" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Spindle Speed & Anomaly Tracking */}
                <div className="pm-card">
                  <div className="pm-card-header">
                    <div>
                      <div className="pm-card-title">Spindle Rotational Speed (RPM)</div>
                      <div className="pm-card-subtitle">
                        Dynamometer spindle RPM telemetry tracking
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis unit=" RPM" tick={{ fontSize: 11, fill: '#64748b' }} domain={['dataMin - 50', 'dataMax + 50']} />
                        <Tooltip />
                        <Area type="monotone" dataKey="speed" name="Speed [RPM]" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#speedGrad)" dot={{ r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Maintenance Events & Anomalies Timeline for This Machine */}
              <div className="pm-card">
                <div className="pm-card-header">
                  <div>
                    <div className="pm-card-title">
                      <IconWrench size={16} style={{ color: 'var(--primary)' }} />
                      Correlated Maintenance Events & Anomalies for {selectedMachineId}
                    </div>
                    <div className="pm-card-subtitle">
                      Work orders and anomaly flags correlated with equipment history
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>
                    {dbHistory.work_orders.length} Work Orders | {dbHistory.anomaly_history.length} Anomalies Logged
                  </span>
                </div>

                {dbHistory.work_orders.length === 0 && dbHistory.anomaly_history.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--navy-400)', fontSize: '12.5px' }}>
                    No recorded work orders or sensor anomalies logged for this unit.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                    {dbHistory.work_orders.map((wo) => (
                      <div
                        key={wo.task_id || wo.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--navy-200)',
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                            {wo.task_id}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: wo.status === 'Completed' ? 'var(--status-healthy-subtle)' : 'var(--primary-subtle)',
                            color: wo.status === 'Completed' ? 'var(--status-healthy-text)' : 'var(--primary)',
                          }}>
                            {wo.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--navy-900)' }}>
                          {wo.action}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--navy-500)' }}>
                          Scheduled: {wo.scheduled_date} | Assigned: {wo.assigned_to}
                        </div>
                      </div>
                    ))}

                    {dbHistory.anomaly_history.map((anom) => (
                      <div
                        key={anom.anomaly_id || anom.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--status-warning-border)',
                          backgroundColor: 'var(--status-warning-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--status-warning-text)' }}>
                            {anom.anomaly_id} (Anomaly Score: {Number(anom.anomaly_score).toFixed(1)}%)
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--status-critical-text)',
                          }}>
                            {anom.anomaly_level || 'Anomaly'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--navy-800)' }}>
                          {anom.explanation || 'Sensor outlier detected.'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--navy-500)' }}>
                          Logged: {anom.created_at ? new Date(anom.created_at).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Persisted Records in MongoDB Table */}
              <div className="pm-card">
                <div className="pm-card-header">
                  <div>
                    <div className="pm-card-title">
                      <IconHistory size={16} style={{ color: 'var(--primary)' }} />
                      MongoDB Inference Records ({filteredPredictions.length})
                    </div>
                    <div className="pm-card-subtitle">
                      Real-time and batch inferences retrieved from <code>prediction_history</code>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>
                    Showing {filteredPredictions.length} matching entries
                  </span>
                </div>

                <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  <table className="pm-table">
                    <thead>
                      <tr>
                        <th>Prediction ID</th>
                        <th>Timestamp</th>
                        <th>Air Temp</th>
                        <th>Proc Temp</th>
                        <th>RPM</th>
                        <th>Torque</th>
                        <th>Wear</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPredictions.map((record, i) => {
                        const feat = extractFeatures(record);
                        return (
                          <tr key={record.prediction_id || i}>
                            <td>
                              <code style={{ fontSize: '11px', color: 'var(--primary)' }}>
                                {record.prediction_id || 'N/A'}
                              </code>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--navy-600)', whiteSpace: 'nowrap' }}>
                              {record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}
                            </td>
                            <td>{feat.airTemp.toFixed(1)} K</td>
                            <td>{feat.procTemp.toFixed(1)} K</td>
                            <td>{Math.round(feat.speed)} RPM</td>
                            <td>{feat.torque.toFixed(1)} Nm</td>
                            <td>{Math.round(feat.wear)} min</td>
                            <td>
                              <strong style={{
                                color: (record.risk_score || 0) > 70 ? 'var(--status-critical)' : (record.risk_score || 0) > 30 ? 'var(--status-warning)' : 'var(--status-healthy)'
                              }}>
                                {(record.risk_score || 0).toFixed(1)}%
                              </strong>
                            </td>
                            <td>
                              <span className={`status-badge ${(record.health_status || 'healthy').toLowerCase()}`}>
                                {record.health_status || 'Healthy'}
                              </span>
                            </td>
                            <td style={{ fontSize: '11.5px', color: 'var(--navy-600)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.recommendation}>
                              {record.recommendation || 'Continuous nominal monitoring.'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .charts-grid-row {
            grid-template-columns: 1fr !important;
          }
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
