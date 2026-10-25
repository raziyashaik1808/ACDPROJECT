import React, { useState, useMemo } from 'react';
import {
  IconSearch,
  IconFilter,
  IconEye,
  IconClock,
  IconAlertTriangle,
  IconCheckCircle,
  IconDownload,
} from './Icons';
import { exportMachinesToCSV } from '../utils/exportUtils';
import { useFleet } from '../context/FleetContext';

export default function MachineTable() {
  const { fleet, setSelectedMachine, healthyCount, warningCount, criticalCount } = useFleet();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Healthy' | 'Warning' | 'Critical'
  const [sortBy, setSortBy] = useState('risk-desc'); // 'risk-desc' | 'risk-asc' | 'id' | 'wear-desc'

  const filteredMachines = useMemo(() => {
    return fleet
      .filter((m) => {
        // Status filter
        if (statusFilter !== 'ALL' && m.health_status !== statusFilter) {
          return false;
        }
        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchId = m.id.toLowerCase().includes(term);
          const matchName = m.name?.toLowerCase().includes(term);
          const matchRec = m.recommendation?.toLowerCase().includes(term);
          return matchId || matchName || matchRec;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'risk-desc':
            return b.risk_score - a.risk_score;
          case 'risk-asc':
            return a.risk_score - b.risk_score;
          case 'wear-desc':
            return b.Tool_wear_min - a.Tool_wear_min;
          case 'id':
            return a.id.localeCompare(b.id);
          default:
            return 0;
        }
      });
  }, [fleet, searchTerm, statusFilter, sortBy]);

  const getRiskBarColor = (risk) => {
    if (risk <= 30) return '#10b981';
    if (risk <= 70) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="pm-card" style={{ marginTop: '20px' }}>
      {/* Header & Controls */}
      <div className="pm-card-header">
        <div>
          <div className="pm-card-title">Equipment Telemetry & Health Records</div>
          <div className="pm-card-subtitle">
            Monitored industrial machines, operational parameters, and real-time failure risk
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Status Filter Tabs */}
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
              onClick={() => setStatusFilter('ALL')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: statusFilter === 'ALL' ? 600 : 500,
                backgroundColor: statusFilter === 'ALL' ? '#ffffff' : 'transparent',
                color: statusFilter === 'ALL' ? 'var(--navy-900)' : 'var(--navy-600)',
                boxShadow: statusFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              All ({fleet.length})
            </button>
            <button
              onClick={() => setStatusFilter('Healthy')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: statusFilter === 'Healthy' ? 600 : 500,
                backgroundColor: statusFilter === 'Healthy' ? '#ffffff' : 'transparent',
                color: statusFilter === 'Healthy' ? '#065f46' : 'var(--navy-600)',
                boxShadow: statusFilter === 'Healthy' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              Healthy ({healthyCount})
            </button>
            <button
              onClick={() => setStatusFilter('Warning')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: statusFilter === 'Warning' ? 600 : 500,
                backgroundColor: statusFilter === 'Warning' ? '#ffffff' : 'transparent',
                color: statusFilter === 'Warning' ? '#92400e' : 'var(--navy-600)',
                boxShadow: statusFilter === 'Warning' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              Warning ({warningCount})
            </button>
            <button
              onClick={() => setStatusFilter('Critical')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: statusFilter === 'Critical' ? 600 : 500,
                backgroundColor: statusFilter === 'Critical' ? '#ffffff' : 'transparent',
                color: statusFilter === 'Critical' ? '#991b1b' : 'var(--navy-600)',
                boxShadow: statusFilter === 'Critical' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              Critical ({criticalCount})
            </button>
          </div>

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--navy-200)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              width: '180px',
            }}
          >
            <IconSearch size={14} style={{ color: 'var(--navy-400)' }} />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '12.5px',
                color: 'var(--navy-900)',
                width: '100%',
                background: 'transparent',
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--navy-200)',
              backgroundColor: '#ffffff',
              fontSize: '12px',
              color: 'var(--navy-700)',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="risk-desc">Sort: Highest Risk</option>
            <option value="risk-asc">Sort: Lowest Risk</option>
            <option value="wear-desc">Sort: Tool Wear</option>
            <option value="id">Sort: Machine ID</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={() => exportMachinesToCSV(filteredMachines, `machines_table_${statusFilter.toLowerCase()}`)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px', padding: '5px 10px' }}
            title="Export filtered machines table to CSV"
          >
            <IconDownload size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Equipment ID</th>
              <th>Air Temp</th>
              <th>Process Temp</th>
              <th>Speed (RPM)</th>
              <th>Torque</th>
              <th>Tool Wear</th>
              <th>Failure Risk</th>
              <th>Health Status</th>
              <th>Last Checked</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--navy-500)' }}>
                  No machines match the selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredMachines.map((machine) => {
                const statusClass = machine.health_status.toLowerCase();
                const riskColor = getRiskBarColor(machine.risk_score);

                return (
                  <tr key={machine.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: '13px' }}>
                          {machine.id}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--navy-500)' }}>
                          {machine.name || `Type ${machine.type || 'M'}`}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="telemetry-val">
                        {machine.Air_temperature_K} K
                      </span>
                    </td>

                    <td>
                      <span className="telemetry-val">
                        {machine.Process_temperature_K} K
                      </span>
                    </td>

                    <td>
                      <span className="telemetry-val">
                        {machine.Rotational_speed_rpm}
                      </span>
                    </td>

                    <td>
                      <span className="telemetry-val">
                        {machine.Torque_Nm} Nm
                      </span>
                    </td>

                    <td>
                      <span className="telemetry-val">
                        {machine.Tool_wear_min} min
                      </span>
                    </td>

                    <td style={{ minWidth: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            flex: 1,
                            height: '6px',
                            backgroundColor: 'var(--navy-200)',
                            borderRadius: '9999px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(machine.risk_score, 100)}%`,
                              height: '100%',
                              backgroundColor: riskColor,
                              borderRadius: '9999px',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: riskColor,
                            width: '42px',
                            textAlign: 'right',
                          }}
                        >
                          {machine.risk_score.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {machine.health_status}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--navy-500)' }}>
                        {machine.last_prediction_time || 'Recent'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedMachine(machine)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        title="View Full Telemetry & Diagnostics"
                      >
                        <IconEye size={13} />
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}