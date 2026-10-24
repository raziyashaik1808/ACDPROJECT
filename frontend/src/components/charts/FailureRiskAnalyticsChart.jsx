import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useFleet } from '../../context/FleetContext';
import { IconCheckCircle } from '../Icons';

export default function FailureRiskAnalyticsChart() {
  const { fleet } = useFleet();

  // Compute actual failure risk factors based on ML feature thresholds
  let toolWearRiskCount = 0;
  let thermalRiskCount = 0;
  let overstrainRiskCount = 0;
  let powerMotorRiskCount = 0;

  fleet.forEach(m => {
    if (m.Tool_wear_min >= 180) toolWearRiskCount++;
    if (m.Process_temperature_K >= 312 || (m.Process_temperature_K - m.Air_temperature_K) < 8.6) thermalRiskCount++;
    if (m.Torque_Nm >= 55) overstrainRiskCount++;
    if (m.Rotational_speed_rpm <= 1350 && m.Torque_Nm >= 50) powerMotorRiskCount++;
  });

  const failureVectors = [
    { name: 'Overstrain / Torque', count: overstrainRiskCount, code: 'OSF', color: '#ef4444' },
    { name: 'Tool Wear Stress', count: toolWearRiskCount, code: 'TWF', color: '#f59e0b' },
    { name: 'Heat Dissipation', count: thermalRiskCount, code: 'HDF', color: '#dc2626' },
    { name: 'Motor Load / Power', count: powerMotorRiskCount, code: 'PWF', color: '#0284c7' },
  ];

  const totalRisksDetected = failureVectors.reduce((acc, curr) => acc + curr.count, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '10px 14px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{item.name}</div>
          <div style={{ color: 'var(--navy-600)', margin: '4px 0' }}>
            Equipment Affected: <strong style={{ color: item.color }}>{item.count} units</strong>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--navy-400)' }}>
            Dataset Indicator: AI4I Failure Mode {item.code}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pm-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pm-card-header">
        <div>
          <div className="pm-card-title">Failure Vector & Anomaly Breakdown</div>
          <div className="pm-card-subtitle">Active failure modes detected across equipment telemetry</div>
        </div>
      </div>

      {totalRisksDetected === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px',
            textAlign: 'center',
            color: 'var(--navy-500)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-healthy-subtle)',
              color: 'var(--status-healthy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <IconCheckCircle size={24} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '14px' }}>
            Zero Critical Failure Vectors
          </div>
          <p style={{ fontSize: '12px', maxWidth: '280px', marginTop: '4px' }}>
            All current fleet equipment operate well within manufacturer safe sensor parameters.
          </p>
        </div>
      ) : (
        <div style={{ width: '100%', height: 260, flex: 1, minHeight: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={failureVectors} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={34}>
                {failureVectors.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
