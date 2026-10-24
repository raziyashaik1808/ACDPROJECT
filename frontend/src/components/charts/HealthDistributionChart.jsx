import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useFleet } from '../../context/FleetContext';

export default function HealthDistributionChart() {
  const { healthyCount, warningCount, criticalCount, totalCount } = useFleet();

  const data = [
    { name: 'Healthy', value: healthyCount, color: '#10b981', statusClass: 'healthy' },
    { name: 'Warning', value: warningCount, color: '#f59e0b', statusClass: 'warning' },
    { name: 'Critical', value: criticalCount, color: '#ef4444', statusClass: 'critical' },
  ].filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const pct = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : 0;
      return (
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '10px 14px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            fontSize: '12.5px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: item.payload.color,
              }}
            />
            <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{item.name}:</span>
            <span style={{ fontWeight: 700, color: 'var(--navy-800)' }}>
              {item.value} units ({pct}%)
            </span>
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
          <div className="pm-card-title">Machine Health Distribution</div>
          <div className="pm-card-subtitle">Fleet condition status breakdown</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          position: 'relative',
          minHeight: '220px',
        }}
      >
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Readout */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--navy-900)',
              lineHeight: 1,
            }}
          >
            {totalCount}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--navy-500)',
              fontWeight: 600,
              marginTop: '2px',
              textTransform: 'uppercase',
            }}
          >
            Machines
          </div>
        </div>
      </div>

      {/* Legend & Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          paddingTop: '14px',
          borderTop: '1px solid var(--navy-100)',
          marginTop: 'auto',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--navy-600)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            Healthy
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46', marginTop: '2px' }}>
            {healthyCount}
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--navy-500)', marginLeft: '3px' }}>
              ({totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--navy-600)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            Warning
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', marginTop: '2px' }}>
            {warningCount}
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--navy-500)', marginLeft: '3px' }}>
              ({totalCount > 0 ? Math.round((warningCount / totalCount) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--navy-600)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            Critical
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', marginTop: '2px' }}>
            {criticalCount}
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--navy-500)', marginLeft: '3px' }}>
              ({totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
