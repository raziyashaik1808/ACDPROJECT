import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useFleet } from '../../context/FleetContext';

export default function ParameterTrendsChart() {
  const { fleet } = useFleet();
  const [selectedParam, setSelectedParam] = useState('Torque'); // 'Torque' | 'Speed' | 'ToolWear' | 'Temperature'

  const paramConfigs = {
    Torque: {
      label: 'Torque [Nm]',
      dataKey: 'Torque_Nm',
      unit: ' Nm',
      color: '#2563eb',
      warningThreshold: 55,
      criticalThreshold: 65,
      domain: [20, 80],
    },
    Speed: {
      label: 'Rotational Speed [rpm]',
      dataKey: 'Rotational_speed_rpm',
      unit: ' rpm',
      color: '#0284c7',
      warningThreshold: 1350,
      criticalThreshold: 1250,
      domain: [1100, 1800],
    },
    ToolWear: {
      label: 'Tool Wear [min]',
      dataKey: 'Tool_wear_min',
      unit: ' min',
      color: '#d97706',
      warningThreshold: 180,
      criticalThreshold: 220,
      domain: [0, 260],
    },
    Temperature: {
      label: 'Temperatures [K]',
      unit: ' K',
      color: '#dc2626',
      domain: [290, 325],
    },
  };

  const currentConfig = paramConfigs[selectedParam];

  // Map fleet data
  const chartData = fleet.map((m, index) => ({
    name: m.id,
    unit: `Unit ${index + 1}`,
    Torque_Nm: m.Torque_Nm,
    Rotational_speed_rpm: m.Rotational_speed_rpm,
    Tool_wear_min: m.Tool_wear_min,
    Air_temperature_K: m.Air_temperature_K,
    Process_temperature_K: m.Process_temperature_K,
    tempDiff: Number((m.Process_temperature_K - m.Air_temperature_K).toFixed(1)),
    status: m.health_status,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
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
          <div style={{ fontWeight: 700, color: 'var(--navy-900)', marginBottom: '4px' }}>
            Machine {label}
          </div>
          {payload.map((entry, index) => (
            <div
              key={`item-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: entry.color,
                fontWeight: 600,
                margin: '2px 0',
              }}
            >
              <span>{entry.name}:</span>
              <span>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pm-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pm-card-header">
        <div>
          <div className="pm-card-title">Operational Parameter Trends</div>
          <div className="pm-card-subtitle">Sensor telemetry profile across fleet equipment</div>
        </div>

        {/* Parameter Selector Pills */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--navy-100)',
            padding: '2px',
            borderRadius: 'var(--radius-md)',
            gap: '2px',
          }}
        >
          <button
            onClick={() => setSelectedParam('Torque')}
            className={`btn btn-sm ${selectedParam === 'Torque' ? 'btn-primary' : 'btn-subtle'}`}
            style={{
              padding: '3px 9px',
              fontSize: '11px',
              backgroundColor: selectedParam === 'Torque' ? '#ffffff' : 'transparent',
              color: selectedParam === 'Torque' ? 'var(--navy-900)' : 'var(--navy-600)',
              boxShadow: selectedParam === 'Torque' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: selectedParam === 'Torque' ? 600 : 500,
            }}
          >
            Torque
          </button>
          <button
            onClick={() => setSelectedParam('Speed')}
            className={`btn btn-sm ${selectedParam === 'Speed' ? 'btn-primary' : 'btn-subtle'}`}
            style={{
              padding: '3px 9px',
              fontSize: '11px',
              backgroundColor: selectedParam === 'Speed' ? '#ffffff' : 'transparent',
              color: selectedParam === 'Speed' ? 'var(--navy-900)' : 'var(--navy-600)',
              boxShadow: selectedParam === 'Speed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: selectedParam === 'Speed' ? 600 : 500,
            }}
          >
            Speed
          </button>
          <button
            onClick={() => setSelectedParam('ToolWear')}
            className={`btn btn-sm ${selectedParam === 'ToolWear' ? 'btn-primary' : 'btn-subtle'}`}
            style={{
              padding: '3px 9px',
              fontSize: '11px',
              backgroundColor: selectedParam === 'ToolWear' ? '#ffffff' : 'transparent',
              color: selectedParam === 'ToolWear' ? 'var(--navy-900)' : 'var(--navy-600)',
              boxShadow: selectedParam === 'ToolWear' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: selectedParam === 'ToolWear' ? 600 : 500,
            }}
          >
            Tool Wear
          </button>
          <button
            onClick={() => setSelectedParam('Temperature')}
            className={`btn btn-sm ${selectedParam === 'Temperature' ? 'btn-primary' : 'btn-subtle'}`}
            style={{
              padding: '3px 9px',
              fontSize: '11px',
              backgroundColor: selectedParam === 'Temperature' ? '#ffffff' : 'transparent',
              color: selectedParam === 'Temperature' ? 'var(--navy-900)' : 'var(--navy-600)',
              boxShadow: selectedParam === 'Temperature' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: selectedParam === 'Temperature' ? 600 : 500,
            }}
          >
            Temperature
          </button>
        </div>
      </div>

      <div style={{ width: '100%', height: 260, flex: 1, minHeight: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              domain={currentConfig.domain}
            />
            <Tooltip content={<CustomTooltip />} />

            {selectedParam === 'Temperature' ? (
              <>
                <Line
                  type="monotone"
                  dataKey="Process_temperature_K"
                  name="Process Temp (K)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ef4444' }}
                />
                <Line
                  type="monotone"
                  dataKey="Air_temperature_K"
                  name="Air Temp (K)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                />
              </>
            ) : (
              <>
                {currentConfig.warningThreshold && (
                  <ReferenceLine
                    y={currentConfig.warningThreshold}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Warn Threshold', position: 'top', fill: '#d97706', fontSize: 10 }}
                  />
                )}
                {currentConfig.criticalThreshold && (
                  <ReferenceLine
                    y={currentConfig.criticalThreshold}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: 'Critical Limit', position: 'top', fill: '#dc2626', fontSize: 10 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={currentConfig.dataKey}
                  name={currentConfig.label}
                  stroke={currentConfig.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                  activeDot={{ r: 6 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
