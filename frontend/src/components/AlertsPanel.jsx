import React from 'react';
import { Link } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconAlertOctagon,
  IconCheckCircle,
  IconEye,
  IconClock,
} from './Icons';
import { useFleet } from '../context/FleetContext';

export default function AlertsPanel() {
  const { alerts, setSelectedMachine } = useFleet();

  return (
    <div className="pm-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="pm-card-header">
        <div>
          <div className="pm-card-title">
            <span style={{ color: alerts.length > 0 ? 'var(--status-critical)' : 'var(--status-healthy)' }}>
              {alerts.length > 0 ? <IconAlertTriangle size={18} /> : <IconCheckCircle size={18} />}
            </span>
            Active Operational Alerts
          </div>
          <div className="pm-card-subtitle">
            {alerts.length} equipment unit{alerts.length !== 1 ? 's' : ''} require maintenance review
          </div>
        </div>

        {alerts.length > 0 && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '9999px',
              backgroundColor: 'var(--status-critical-subtle)',
              color: 'var(--status-critical-text)',
              border: '1px solid var(--status-critical-border)',
            }}
          >
            {alerts.length} Action{alerts.length !== 1 ? 's' : ''} Required
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-healthy-subtle)',
              color: 'var(--status-healthy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <IconCheckCircle size={22} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: '14px' }}>
            All Equipment Operating Normally
          </div>
          <p style={{ fontSize: '12px', color: 'var(--navy-500)', marginTop: '4px', maxWidth: '300px' }}>
            No warning or critical thresholds exceeded. Upload new sensor telemetry or simulate failure states in Predictions.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <Link to="/upload" className="btn btn-secondary btn-sm">
              Upload Sensor CSV
            </Link>
            <Link to="/predictions" className="btn btn-primary btn-sm">
              Simulate Failure State
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
            maxHeight: '360px',
            paddingRight: '4px',
          }}
        >
          {alerts.map((machine) => {
            const isCritical = machine.health_status === 'Critical';
            const borderCol = isCritical ? 'var(--status-critical-border)' : 'var(--status-warning-border)';
            const bgCol = isCritical ? '#fff8f8' : '#fffdf8';

            return (
              <div
                key={machine.id}
                style={{
                  backgroundColor: bgCol,
                  border: `1px solid ${borderCol}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--navy-900)',
                      }}
                    >
                      {machine.id}
                    </span>

                    <span
                      className={`status-badge ${isCritical ? 'critical' : 'warning'}`}
                      style={{ fontSize: '11px', padding: '1px 7px' }}
                    >
                      {machine.health_status} (Risk: {machine.risk_score.toFixed(1)}%)
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--navy-400)',
                      }}
                    >
                      <IconClock size={12} />
                      {machine.last_prediction_time || 'Recent'}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--navy-700)',
                      marginTop: '6px',
                      lineHeight: 1.35,
                    }}
                  >
                    <strong>Recommendation:</strong> {machine.recommendation}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      marginTop: '6px',
                      fontSize: '11px',
                      color: 'var(--navy-500)',
                    }}
                  >
                    <span>Torque: <strong className="telemetry-val">{machine.Torque_Nm} Nm</strong></span>
                    <span>Tool Wear: <strong className="telemetry-val">{machine.Tool_wear_min} min</strong></span>
                    <span>Speed: <strong className="telemetry-val">{machine.Rotational_speed_rpm} rpm</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedMachine(machine)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    flexShrink: 0,
                    padding: '6px 10px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                  }}
                  title="View Sensor Telemetry & Diagnostics"
                >
                  <IconEye size={13} />
                  Diagnose
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
