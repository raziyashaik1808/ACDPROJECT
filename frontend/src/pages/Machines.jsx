import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  IconSearch,
  IconEye,
  IconWrench,
  IconServer,
  IconCheckCircle,
  IconAlertTriangle,
  IconAlertOctagon,
  IconFilter,
} from '../components/Icons';

export default function Machines() {
  const { fleet, setSelectedMachine, healthyCount, warningCount, criticalCount } = useFleet();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const filtered = fleet.filter((m) => {
    if (filterStatus !== 'ALL' && m.health_status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        m.id.toLowerCase().includes(term) ||
        m.name?.toLowerCase().includes(term) ||
        m.recommendation?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Card */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">Industrial Equipment Fleet Registry</div>
            <div className="pm-card-subtitle">
              Continuous condition monitoring of active machinery across manufacturing lines
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--navy-100)',
                padding: '2px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-subtle'}`}
                style={{
                  padding: '4px 10px',
                  backgroundColor: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--navy-900)' : 'var(--navy-600)',
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Cards View
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-subtle'}`}
                style={{
                  padding: '4px 10px',
                  backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? 'var(--navy-900)' : 'var(--navy-600)',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Table View
              </button>
            </div>

            {/* Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--navy-200)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px',
                width: '200px',
              }}
            >
              <IconSearch size={14} style={{ color: 'var(--navy-400)' }} />
              <input
                type="text"
                placeholder="Search fleet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  color: 'var(--navy-900)',
                  width: '100%',
                }}
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`btn btn-sm ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Machines ({fleet.length})
          </button>
          <button
            onClick={() => setFilterStatus('Healthy')}
            className={`btn btn-sm ${filterStatus === 'Healthy' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderColor: filterStatus === 'Healthy' ? 'transparent' : 'var(--status-healthy-border)',
              color: filterStatus === 'Healthy' ? '#fff' : 'var(--status-healthy-text)',
            }}
          >
            Healthy ({healthyCount})
          </button>
          <button
            onClick={() => setFilterStatus('Warning')}
            className={`btn btn-sm ${filterStatus === 'Warning' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderColor: filterStatus === 'Warning' ? 'transparent' : 'var(--status-warning-border)',
              color: filterStatus === 'Warning' ? '#fff' : 'var(--status-warning-text)',
            }}
          >
            Warning ({warningCount})
          </button>
          <button
            onClick={() => setFilterStatus('Critical')}
            className={`btn btn-sm ${filterStatus === 'Critical' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              borderColor: filterStatus === 'Critical' ? 'transparent' : 'var(--status-critical-border)',
              color: filterStatus === 'Critical' ? '#fff' : 'var(--status-critical-text)',
            }}
          >
            Critical ({criticalCount})
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {filtered.map((m) => {
            const isCritical = m.health_status === 'Critical';
            const isWarning = m.health_status === 'Warning';
            const riskColor = isCritical ? 'var(--status-critical)' : isWarning ? 'var(--status-warning)' : 'var(--status-healthy)';

            return (
              <div
                key={m.id}
                className="pm-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--navy-900)' }}>
                        {m.id}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--navy-500)', marginTop: '2px' }}>
                        {m.name || `Type ${m.type || 'M'}`}
                      </div>
                    </div>

                    <span className={`status-badge ${m.health_status.toLowerCase()}`}>
                      {m.health_status}
                    </span>
                  </div>

                  {/* Failure Risk Score Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--navy-600)' }}>Failure Probability:</span>
                      <strong style={{ color: riskColor }}>{m.risk_score.toFixed(1)}%</strong>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        backgroundColor: 'var(--navy-200)',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(m.risk_score, 100)}%`,
                          height: '100%',
                          backgroundColor: riskColor,
                          borderRadius: '9999px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Telemetry Sensor Badges */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                      marginTop: '12px',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: 'var(--navy-500)' }}>Air Temp:</span>{' '}
                      <strong className="telemetry-val">{m.Air_temperature_K} K</strong>
                    </div>
                    <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: 'var(--navy-500)' }}>Process Temp:</span>{' '}
                      <strong className="telemetry-val">{m.Process_temperature_K} K</strong>
                    </div>
                    <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: 'var(--navy-500)' }}>Speed:</span>{' '}
                      <strong className="telemetry-val">{m.Rotational_speed_rpm} RPM</strong>
                    </div>
                    <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: 'var(--navy-500)' }}>Torque:</span>{' '}
                      <strong className="telemetry-val">{m.Torque_Nm} Nm</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2', padding: '6px 8px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ color: 'var(--navy-500)' }}>Tool Wear:</span>{' '}
                      <strong className="telemetry-val">{m.Tool_wear_min} min</strong>
                      {m.Tool_wear_min > 200 && (
                        <span style={{ color: 'var(--status-critical)', marginLeft: '6px', fontWeight: 600 }}>
                          (Exceeds limit)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--navy-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--navy-400)' }}>
                    Last update: {m.last_prediction_time || 'Recent'}
                  </span>

                  <button
                    onClick={() => setSelectedMachine(m)}
                    className="btn btn-secondary btn-sm"
                  >
                    <IconEye size={13} />
                    Inspect Telemetry
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="pm-card">
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Machine ID</th>
                  <th>Type</th>
                  <th>Air Temp</th>
                  <th>Process Temp</th>
                  <th>Speed</th>
                  <th>Torque</th>
                  <th>Tool Wear</th>
                  <th>Failure Risk</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>{m.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--navy-500)' }}>{m.name}</div>
                    </td>
                    <td>{m.type || 'M'}</td>
                    <td><span className="telemetry-val">{m.Air_temperature_K} K</span></td>
                    <td><span className="telemetry-val">{m.Process_temperature_K} K</span></td>
                    <td><span className="telemetry-val">{m.Rotational_speed_rpm} rpm</span></td>
                    <td><span className="telemetry-val">{m.Torque_Nm} Nm</span></td>
                    <td><span className="telemetry-val">{m.Tool_wear_min} min</span></td>
                    <td>
                      <strong style={{ color: m.risk_score > 70 ? '#ef4444' : m.risk_score > 30 ? '#f59e0b' : '#10b981' }}>
                        {m.risk_score.toFixed(1)}%
                      </strong>
                    </td>
                    <td>
                      <span className={`status-badge ${m.health_status.toLowerCase()}`}>
                        {m.health_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => setSelectedMachine(m)} className="btn btn-secondary btn-sm">
                        <IconEye size={13} />
                        Diagnose
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
