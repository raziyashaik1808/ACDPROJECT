import React, { useState, useEffect } from 'react';
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
} from 'recharts';
import { IconHistory, IconClock, IconEye, IconAlertTriangle, IconWrench, IconCheckCircle } from '../components/Icons';

export default function MachineHistory() {
  const { fleet, setSelectedMachine } = useFleet();
  const [selectedMachineId, setSelectedMachineId] = useState(fleet[0]?.id || 'M-14860');
  const [dbHistory, setDbHistory] = useState({
    prediction_history: [],
    anomaly_history: [],
    work_orders: [],
    alerts: [],
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedMachine = fleet.find(m => m.id === selectedMachineId || m.machine_id === selectedMachineId) || fleet[0];

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      if (!selectedMachineId) return;
      setLoadingHistory(true);
      try {
        const res = await API.get(`/machines/${selectedMachineId}/history`);
        if (isMounted && res.data) {
          setDbHistory({
            prediction_history: res.data.prediction_history || [],
            anomaly_history: res.data.anomaly_history || [],
            work_orders: res.data.work_orders || [],
            alerts: res.data.alerts || [],
          });
        }
      } catch (err) {
        console.warn('Machine history fetch from MongoDB:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [selectedMachineId]);

  // Construct chart data using real MongoDB prediction history if available, supplemented by progression
  const chartData = React.useMemo(() => {
    if (dbHistory.prediction_history && dbHistory.prediction_history.length >= 3) {
      return [...dbHistory.prediction_history].reverse().map((p, idx) => ({
        cycle: `Log #${idx + 1}`,
        airTemp: Number(p.sensor_readings?.Air_temperature_K || 298),
        procTemp: Number(p.sensor_readings?.Process_temperature_K || 308),
        tempDelta: Number(((p.sensor_readings?.Process_temperature_K || 308) - (p.sensor_readings?.Air_temperature_K || 298)).toFixed(1)),
        speed: Math.round(p.sensor_readings?.Rotational_speed_rpm || 1500),
        torque: Number(p.sensor_readings?.Torque_Nm || 40),
        wear: Math.round(p.sensor_readings?.Tool_wear_min || 10),
        risk: Number((p.risk_score || 0).toFixed(1)),
        source: 'MongoDB Log',
      }));
    }

    // Default 12-cycle progression for selected machine
    return Array.from({ length: 12 }, (_, i) => {
      const step = i + 1;
      const progress = step / 12;
      const wear = Math.round((selectedMachine?.Tool_wear_min || 10) * (0.4 + 0.6 * progress));
      const torque = Number(((selectedMachine?.Torque_Nm || 40) * (0.85 + 0.15 * progress) + (Math.sin(step) * 1.5)).toFixed(1));
      const speed = Math.round((selectedMachine?.Rotational_speed_rpm || 1500) + Math.cos(step) * 25);
      const airTemp = Number(((selectedMachine?.Air_temperature_K || 298) + Math.sin(step / 2) * 0.4).toFixed(1));
      const procTemp = Number(((selectedMachine?.Process_temperature_K || 308) + Math.sin(step / 2) * 0.6).toFixed(1));
      const risk = Number(Math.min(100, Math.max(0.1, (selectedMachine?.risk_score || 1) * (0.3 + 0.7 * Math.pow(progress, 1.8)))).toFixed(1));

      return {
        cycle: `T-${12 - step}h`,
        airTemp,
        procTemp,
        tempDelta: Number((procTemp - airTemp).toFixed(1)),
        speed,
        torque,
        wear,
        risk,
        source: 'Progression',
      };
    });
  }, [dbHistory.prediction_history, selectedMachine]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">
              <IconHistory size={18} style={{ color: 'var(--primary)' }} />
              Equipment Operational History & Degradation Tracking
            </div>
            <div className="pm-card-subtitle">
              Inspect multi-cycle telemetry trends, thermal degradation, and mechanical stress accumulation
            </div>
          </div>

          {/* Machine Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy-600)' }}>
              Select Machine:
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
        </div>

        {/* Selected Machine Telemetry Summary Ribbon */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
            marginTop: '12px',
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
            <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>TOOL WEAR TIME</div>
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
            <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>FAILURE RISK</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: selectedMachine.risk_score > 70 ? 'var(--status-critical)' : selectedMachine.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-healthy)' }}>
              {selectedMachine.risk_score.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Historical Trend Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}
        className="charts-grid-row"
      >
        {/* Chart 1: Failure Risk & Tool Wear Progression */}
        <div className="pm-card">
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">Failure Probability History</div>
              <div className="pm-card-subtitle">
                {dbHistory.prediction_history.length >= 3 ? 'Logged telemetry evaluations from MongoDB' : 'Progression trajectory over operational cycles'}
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="risk" name="Failure Risk %" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#riskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Thermal Differential (Process - Air) */}
        <div className="pm-card">
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">Thermal Dissipation Gradient (ΔT)</div>
              <div className="pm-card-subtitle">Internal Process Temp vs Ambient Air Temp over cycles</div>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit=" K" tick={{ fontSize: 11, fill: '#64748b' }} domain={[295, 320]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="procTemp" name="Process Temp [K]" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="airTemp" name="Air Temp [K]" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Persisted Records in MongoDB Table */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">
              <IconHistory size={16} style={{ color: 'var(--primary)' }} />
              MongoDB Inference History for {selectedMachineId}
            </div>
            <div className="pm-card-subtitle">
              Persistent records retrieved from <code>prediction_history</code> collection
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>
            {dbHistory.prediction_history.length} Saved Inferences
          </span>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--navy-500)' }}>
            Loading historical data from MongoDB...
          </div>
        ) : dbHistory.prediction_history.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--navy-400)', fontSize: '13px' }}>
            No individual prediction records saved for this machine yet. Run an inference in the Predictions module to log telemetry.
          </div>
        ) : (
          <div className="table-responsive">
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
                </tr>
              </thead>
              <tbody>
                {dbHistory.prediction_history.map((record, i) => (
                  <tr key={record.prediction_id || i}>
                    <td>
                      <code style={{ fontSize: '11px', color: 'var(--primary)' }}>
                        {record.prediction_id || 'N/A'}
                      </code>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--navy-600)' }}>
                      {record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td>{record.sensor_readings?.Air_temperature_K} K</td>
                    <td>{record.sensor_readings?.Process_temperature_K} K</td>
                    <td>{record.sensor_readings?.Rotational_speed_rpm} RPM</td>
                    <td>{record.sensor_readings?.Torque_Nm} Nm</td>
                    <td>{record.sensor_readings?.Tool_wear_min} min</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .charts-grid-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
