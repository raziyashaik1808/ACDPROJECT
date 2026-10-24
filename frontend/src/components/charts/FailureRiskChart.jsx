import React, { useState } from 'react';
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

export default function FailureRiskChart() {
  const { fleet, setSelectedMachine } = useFleet();
  const [viewMode, setViewMode] = useState('horizontal'); // 'horizontal' | 'vertical'

  // Format data for chart
  const data = fleet.map((m) => ({
    id: m.id,
    name: m.id,
    fullName: m.name,
    risk: m.risk_score,
    status: m.health_status,
    recommendation: m.recommendation,
    machine: m,
  }));

  const getBarColor = (risk) => {
    if (risk <= 30) return '#10b981'; // Green
    if (risk <= 70) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '12px 14px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            border: 'none',
            fontSize: '12.5px',
            maxWidth: '260px',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--navy-900)', marginBottom: '4px' }}>
            {item.name} <span style={{ fontWeight: 400, color: 'var(--navy-500)' }}>({item.fullName})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: 'var(--navy-600)' }}>Failure Risk:</span>
            <span style={{ fontWeight: 700, color: getBarColor(item.risk) }}>
              {item.risk.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
            <span style={{ color: 'var(--navy-600)' }}>Health Status:</span>
            <span
              className={`status-badge ${item.status.toLowerCase()}`}
              style={{ padding: '1px 7px', fontSize: '11px' }}
            >
              {item.status}
            </span>
          </div>
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', color: 'var(--navy-600)', fontSize: '11.5px', lineHeight: 1.3 }}>
            <strong>Action:</strong> {item.recommendation}
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
            Click bar to view full diagnostics →
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
          <div className="pm-card-title">Failure Risk by Machine</div>
          <div className="pm-card-subtitle">
            Calculated probability score based on sensor telemetry
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--navy-600)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981' }} />
            Low (&le;30%)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--navy-600)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
            Warning (31-70%)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--navy-600)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
            Critical (&gt;70%)
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: 280, flex: 1, minHeight: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={[0, 100]}
              unit="%"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={65}
              tick={{ fontSize: 11, fill: '#0f172a', fontWeight: 600 }}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
            <Bar
              dataKey="risk"
              radius={[0, 4, 4, 0]}
              barSize={14}
              onClick={(entry) => setSelectedMachine(entry.machine)}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.risk)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
