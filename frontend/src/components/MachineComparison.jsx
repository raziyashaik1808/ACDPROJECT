import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  IconActivity,
  IconAlertTriangle,
  IconCheckCircle,
  IconAlertOctagon,
  IconDownload,
  IconRefresh,
} from './Icons';
import { convertToCSV, downloadCSV } from '../utils/exportUtils';

export default function MachineComparison() {
  const { fleet } = useFleet();

  const [machineAId, setMachineAId] = useState(fleet[0]?.id || 'M-14860');
  const [machineBId, setMachineBId] = useState(
    fleet.find(m => m.health_status === 'Critical')?.id || fleet[1]?.id || 'L-47257'
  );

  const machineA = useMemo(
    () => fleet.find(m => m.id === machineAId || m.machine_id === machineAId) || fleet[0],
    [fleet, machineAId]
  );

  const machineB = useMemo(
    () => fleet.find(m => m.id === machineBId || m.machine_id === machineBId) || fleet[1] || fleet[0],
    [fleet, machineBId]
  );

  if (!machineA || !machineB) {
    return (
      <div className="pm-card" style={{ padding: '36px', textAlign: 'center' }}>
        <p style={{ color: 'var(--navy-500)' }}>At least two machines are required to run machine-to-machine comparisons.</p>
      </div>
    );
  }

  // Calculate telemetry deltas (B - A)
  const deltaAtoB = {
    risk: (machineB.risk_score - machineA.risk_score).toFixed(1),
    torque: (machineB.Torque_Nm - machineA.Torque_Nm).toFixed(1),
    speed: Math.round(machineB.Rotational_speed_rpm - machineA.Rotational_speed_rpm),
    wear: Math.round(machineB.Tool_wear_min - machineA.Tool_wear_min),
    tempDeltaB: ((machineB.Process_temperature_K - machineB.Air_temperature_K) -
                 (machineA.Process_temperature_K - machineA.Air_temperature_K)).toFixed(1),
  };

  // Normalized Grouped Comparison Data for Chart
  const comparisonChartData = [
    {
      parameter: 'Operating Torque [Nm]',
      [machineA.id]: Number(machineA.Torque_Nm.toFixed(1)),
      [machineB.id]: Number(machineB.Torque_Nm.toFixed(1)),
      unit: 'Nm',
    },
    {
      parameter: 'Tool Wear [min]',
      [machineA.id]: Number(machineA.Tool_wear_min.toFixed(0)),
      [machineB.id]: Number(machineB.Tool_wear_min.toFixed(0)),
      unit: 'min',
    },
    {
      parameter: 'Rotational Speed [x10 RPM]',
      [machineA.id]: Number((machineA.Rotational_speed_rpm / 10).toFixed(0)),
      [machineB.id]: Number((machineB.Rotational_speed_rpm / 10).toFixed(0)),
      unit: 'x10 RPM',
    },
    {
      parameter: 'Process Temp [K - 250]',
      [machineA.id]: Number((machineA.Process_temperature_K - 250).toFixed(1)),
      [machineB.id]: Number((machineB.Process_temperature_K - 250).toFixed(1)),
      unit: 'K (-250)',
    },
    {
      parameter: 'Failure Risk [%]',
      [machineA.id]: Number(machineA.risk_score.toFixed(1)),
      [machineB.id]: Number(machineB.risk_score.toFixed(1)),
      unit: '%',
    },
  ];

  const handleExportComparison = () => {
    const rows = [
      {
        metric: 'Machine ID',
        machine_A: machineA.id,
        machine_B: machineB.id,
        difference: 'N/A',
      },
      {
        metric: 'Name',
        machine_A: machineA.name,
        machine_B: machineB.name,
        difference: 'N/A',
      },
      {
        metric: 'Health Status',
        machine_A: machineA.health_status,
        machine_B: machineB.health_status,
        difference: 'N/A',
      },
      {
        metric: 'Failure Risk (%)',
        machine_A: `${machineA.risk_score.toFixed(1)}%`,
        machine_B: `${machineB.risk_score.toFixed(1)}%`,
        difference: `${deltaAtoB.risk > 0 ? '+' : ''}${deltaAtoB.risk}%`,
      },
      {
        metric: 'Torque (Nm)',
        machine_A: machineA.Torque_Nm,
        machine_B: machineB.Torque_Nm,
        difference: `${deltaAtoB.torque > 0 ? '+' : ''}${deltaAtoB.torque} Nm`,
      },
      {
        metric: 'Rotational Speed (RPM)',
        machine_A: machineA.Rotational_speed_rpm,
        machine_B: machineB.Rotational_speed_rpm,
        difference: `${deltaAtoB.speed > 0 ? '+' : ''}${deltaAtoB.speed} RPM`,
      },
      {
        metric: 'Tool Wear (min)',
        machine_A: machineA.Tool_wear_min,
        machine_B: machineB.Tool_wear_min,
        difference: `${deltaAtoB.wear > 0 ? '+' : ''}${deltaAtoB.wear} min`,
      },
      {
        metric: 'Air Temp (K)',
        machine_A: machineA.Air_temperature_K,
        machine_B: machineB.Air_temperature_K,
        difference: (machineB.Air_temperature_K - machineA.Air_temperature_K).toFixed(1),
      },
      {
        metric: 'Process Temp (K)',
        machine_A: machineA.Process_temperature_K,
        machine_B: machineB.Process_temperature_K,
        difference: (machineB.Process_temperature_K - machineA.Process_temperature_K).toFixed(1),
      },
      {
        metric: 'Prescriptive Recommendation',
        machine_A: machineA.recommendation,
        machine_B: machineB.recommendation,
        difference: 'N/A',
      },
    ];

    const columns = [
      { key: 'metric', label: 'Metric / Parameter' },
      { key: 'machine_A', label: `Machine A (${machineA.id})` },
      { key: 'machine_B', label: `Machine B (${machineB.id})` },
      { key: 'difference', label: 'Delta (B - A)' },
    ];

    const csv = convertToCSV(rows, columns);
    downloadCSV(csv, `machine_comparison_${machineA.id}_vs_${machineB.id}.csv`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Critical':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: 'var(--status-critical-subtle)',
            color: 'var(--status-critical-text)',
            border: '1px solid var(--status-critical-border)',
          }}>
            <IconAlertOctagon size={12} /> CRITICAL
          </span>
        );
      case 'Warning':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: 'var(--status-warning-subtle)',
            color: 'var(--status-warning-text)',
            border: '1px solid var(--status-warning-border)',
          }}>
            <IconAlertTriangle size={12} /> WARNING
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: 'var(--status-healthy-subtle)',
            color: 'var(--status-healthy-text)',
            border: '1px solid var(--status-healthy-border)',
          }}>
            <IconCheckCircle size={12} /> HEALTHY
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Machine Selector Ribbon */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">
              <IconActivity size={18} style={{ color: 'var(--primary)' }} />
              Machine-to-Machine Comparative Stress Analytics
            </div>
            <div className="pm-card-subtitle">
              Benchmark operational degradation, thermal stress, and failure risk between two fleet units
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleExportComparison}
              className="btn btn-secondary btn-sm"
              title="Export side-by-side comparison to CSV"
            >
              <IconDownload size={14} />
              Export Comparison CSV
            </button>
          </div>
        </div>

        {/* Dual Selectors */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
            marginTop: '10px',
          }}
          className="comparison-selectors"
        >
          {/* Unit A Selector */}
          <div style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f0f7ff',
            border: '1px solid #bfdbfe',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                Primary Unit (Machine A)
              </span>
              {getStatusBadge(machineA.health_status)}
            </div>
            <select
              value={machineAId}
              onChange={(e) => setMachineAId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #93c5fd',
                backgroundColor: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--navy-900)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {fleet.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} - {m.name || 'Unit'} ({m.health_status} - {m.risk_score.toFixed(1)}%)
                </option>
              ))}
            </select>
          </div>

          {/* Unit B Selector */}
          <div style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>
                Benchmark Unit (Machine B)
              </span>
              {getStatusBadge(machineB.health_status)}
            </div>
            <select
              value={machineBId}
              onChange={(e) => setMachineBId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #fdba74',
                backgroundColor: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--navy-900)',
                outline: 'none',
                cursor: 'pointer',
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
      </div>

      {/* Side-by-Side KPI Matrix */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
        }}
        className="comparison-kpi-grid"
      >
        {/* Failure Risk */}
        <div className="pm-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
            Failure Risk Comparison
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>{machineA.risk_score.toFixed(1)}%</span>
            <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>vs</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>{machineB.risk_score.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', color: Number(deltaAtoB.risk) > 0 ? 'var(--status-critical)' : 'var(--status-healthy)' }}>
            Δ {deltaAtoB.risk > 0 ? `+${deltaAtoB.risk}` : deltaAtoB.risk}% on Unit B
          </div>
        </div>

        {/* Operating Torque */}
        <div className="pm-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
            Operating Torque
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>{machineA.Torque_Nm} Nm</span>
            <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>vs</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>{machineB.Torque_Nm} Nm</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', color: Number(deltaAtoB.torque) > 0 ? 'var(--status-warning-text)' : 'var(--status-healthy-text)' }}>
            Δ {deltaAtoB.torque > 0 ? `+${deltaAtoB.torque}` : deltaAtoB.torque} Nm
          </div>
        </div>

        {/* Tool Wear Time */}
        <div className="pm-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
            Tool Wear Accumulated
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>{machineA.Tool_wear_min} min</span>
            <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>vs</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>{machineB.Tool_wear_min} min</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', color: deltaAtoB.wear > 0 ? 'var(--status-warning-text)' : 'var(--navy-600)' }}>
            Δ {deltaAtoB.wear > 0 ? `+${deltaAtoB.wear}` : deltaAtoB.wear} min
          </div>
        </div>

        {/* Rotational Speed */}
        <div className="pm-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
            Spindle Speed
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>{machineA.Rotational_speed_rpm}</span>
            <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>vs</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>{machineB.Rotational_speed_rpm}</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', color: 'var(--navy-600)' }}>
            Δ {deltaAtoB.speed > 0 ? `+${deltaAtoB.speed}` : deltaAtoB.speed} RPM
          </div>
        </div>

        {/* Thermal Differential */}
        <div className="pm-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600, textTransform: 'uppercase' }}>
            Thermal Delta (ΔT)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
              {(machineA.Process_temperature_K - machineA.Air_temperature_K).toFixed(1)} K
            </span>
            <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>vs</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>
              {(machineB.Process_temperature_K - machineB.Air_temperature_K).toFixed(1)} K
            </span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '4px', color: 'var(--navy-600)' }}>
            Δ {deltaAtoB.tempDeltaB > 0 ? `+${deltaAtoB.tempDeltaB}` : deltaAtoB.tempDeltaB} K
          </div>
        </div>
      </div>

      {/* Comparison Grouped Bar Chart */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">Normalized Sensor Parameter & Risk Benchmarking</div>
            <div className="pm-card-subtitle">
              Visual stress comparison between {machineA.id} (Blue) and {machineB.id} (Orange)
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonChartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="parameter" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div style={{
                        backgroundColor: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--navy-900)' }}>{label}</div>
                        {payload.map((entry, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: entry.color, margin: '2px 0' }}>
                            <span style={{ fontWeight: 600 }}>{entry.name}:</span>
                            <span style={{ fontWeight: 800 }}>{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12.5px', paddingTop: '10px' }} />
              <Bar dataKey={machineA.id} name={`${machineA.id} (${machineA.name})`} fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey={machineB.id} name={`${machineB.id} (${machineB.name})`} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side-by-Side Diagnostic & Recommendations Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}
        className="recommendation-comparison"
      >
        {/* Machine A Details */}
        <div className="pm-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--navy-900)' }}>
              {machineA.id} Diagnostic Status
            </div>
            {getStatusBadge(machineA.health_status)}
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--navy-600)', margin: '4px 0 12px' }}>
            <strong>Recommendation:</strong> {machineA.recommendation || 'Continuous nominal monitoring.'}
          </p>
          <div style={{ fontSize: '12px', color: 'var(--navy-500)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div>Air Temp: <strong>{machineA.Air_temperature_K} K</strong></div>
            <div>Process Temp: <strong>{machineA.Process_temperature_K} K</strong></div>
            <div>Torque: <strong>{machineA.Torque_Nm} Nm</strong></div>
            <div>Speed: <strong>{machineA.Rotational_speed_rpm} RPM</strong></div>
            <div>Tool Wear: <strong>{machineA.Tool_wear_min} min</strong></div>
            <div>Anomaly Flag: <strong>{machineA.is_anomaly ? 'Detected' : 'Normal'}</strong></div>
          </div>
        </div>

        {/* Machine B Details */}
        <div className="pm-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--navy-900)' }}>
              {machineB.id} Diagnostic Status
            </div>
            {getStatusBadge(machineB.health_status)}
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--navy-600)', margin: '4px 0 12px' }}>
            <strong>Recommendation:</strong> {machineB.recommendation || 'Continuous nominal monitoring.'}
          </p>
          <div style={{ fontSize: '12px', color: 'var(--navy-500)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div>Air Temp: <strong>{machineB.Air_temperature_K} K</strong></div>
            <div>Process Temp: <strong>{machineB.Process_temperature_K} K</strong></div>
            <div>Torque: <strong>{machineB.Torque_Nm} Nm</strong></div>
            <div>Speed: <strong>{machineB.Rotational_speed_rpm} RPM</strong></div>
            <div>Tool Wear: <strong>{machineB.Tool_wear_min} min</strong></div>
            <div>Anomaly Flag: <strong>{machineB.is_anomaly ? 'Detected' : 'Normal'}</strong></div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .comparison-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .recommendation-comparison {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .comparison-selectors {
            grid-template-columns: 1fr !important;
          }
          .comparison-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
