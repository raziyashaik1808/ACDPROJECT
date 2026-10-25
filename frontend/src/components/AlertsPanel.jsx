import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IconAlertTriangle,
  IconAlertOctagon,
  IconCheckCircle,
  IconCheck,
  IconEye,
  IconClock,
  IconWrench,
  IconDownload,
  IconFilter,
} from './Icons';
import { useFleet } from '../context/FleetContext';
import { exportAlertsToCSV } from '../utils/exportUtils';

export default function AlertsPanel() {
  const {
    alerts,
    updateAlertStatus,
    createWorkOrderFromAlert,
    setSelectedMachine,
    fleet,
  } = useFleet();

  const [statusFilter, setStatusFilter] = useState('Active'); // 'Active' | 'Investigating' | 'Resolved' | 'ALL'
  const [createdOrderAlertId, setCreatedOrderAlertId] = useState(null);
  const [updatingAlertId, setUpdatingAlertId] = useState(null);

  const activeAlerts = useMemo(
    () => alerts.filter(a => a.status === 'Active' || !a.status),
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    if (statusFilter === 'ALL') return alerts;
    if (statusFilter === 'Active') {
      return alerts.filter(a => a.status === 'Active' || !a.status);
    }
    if (statusFilter === 'Investigating') {
      return alerts.filter(a => a.status === 'In Review' || a.status === 'Investigating');
    }
    if (statusFilter === 'Resolved') {
      return alerts.filter(a => a.status === 'Resolved');
    }
    return alerts;
  }, [alerts, statusFilter]);

  const handleStatusChange = async (alert, newStatus) => {
    const alertId = alert.alert_id || alert.id;
    setUpdatingAlertId(alertId);
    try {
      await updateAlertStatus(alertId, newStatus);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const handleGenerateWorkOrder = async (alert) => {
    const alertId = alert.alert_id || alert.id;
    setUpdatingAlertId(alertId);
    try {
      await createWorkOrderFromAlert(alert);
      setCreatedOrderAlertId(alertId);
      setTimeout(() => setCreatedOrderAlertId(null), 3500);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const handleExportAlerts = () => {
    exportAlertsToCSV(filteredAlerts, `alerts_${statusFilter.toLowerCase()}`);
  };

  return (
    <div className="pm-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="pm-card-header">
        <div>
          <div className="pm-card-title">
            <span style={{ color: activeAlerts.length > 0 ? 'var(--status-critical)' : 'var(--status-healthy)' }}>
              {activeAlerts.length > 0 ? <IconAlertTriangle size={18} /> : <IconCheckCircle size={18} />}
            </span>
            Smart Operational Alerts & Recommendations
          </div>
          <div className="pm-card-subtitle">
            {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''} requiring prescriptive review
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--navy-100)',
              padding: '2px',
              borderRadius: 'var(--radius-md)',
              gap: '2px',
            }}
          >
            {[
              { id: 'Active', label: `Active (${activeAlerts.length})` },
              { id: 'Investigating', label: 'Investigating' },
              { id: 'Resolved', label: 'Resolved' },
              { id: 'ALL', label: `All (${alerts.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: statusFilter === tab.id ? 700 : 500,
                  backgroundColor: statusFilter === tab.id ? '#ffffff' : 'transparent',
                  color: statusFilter === tab.id ? 'var(--navy-900)' : 'var(--navy-600)',
                  boxShadow: statusFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export Alerts CSV */}
          <button
            onClick={handleExportAlerts}
            disabled={filteredAlerts.length === 0}
            className="btn btn-secondary btn-sm"
            title="Export filtered alerts to CSV"
          >
            <IconDownload size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Alert List or Empty State */}
      {filteredAlerts.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '36px 20px',
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
            {statusFilter === 'Active'
              ? 'Zero Active Operational Alerts'
              : `No alerts in '${statusFilter}' status`}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--navy-500)', marginTop: '4px', maxWidth: '320px' }}>
            {statusFilter === 'Active'
              ? 'All equipment running within nominal operating boundaries. Test predictions or upload data to simulate alerts.'
              : 'Switch tabs or run diagnostics to view telemetry alerts.'}
          </p>
          {statusFilter === 'Active' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <Link to="/predictions" className="btn btn-primary btn-sm">
                Simulate Risk In Predictions
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
            maxHeight: '420px',
            paddingRight: '4px',
          }}
        >
          {filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'Critical' || alert.health_status === 'Critical';
            const alertId = alert.alert_id || alert.id;
            const currentStatus = alert.status || 'Active';
            const isOrderCreated = createdOrderAlertId === alertId;
            const isUpdating = updatingAlertId === alertId;

            // Locate matching machine object for diagnostics
            const matchedMachine = fleet.find(m => m.id === alert.machine_id || m.machine_id === alert.machine_id) || alert;

            return (
              <div
                key={alertId}
                style={{
                  backgroundColor: isCritical ? '#fff8f8' : currentStatus === 'Resolved' ? '#f8fafc' : '#fffdf8',
                  border: `1px solid ${
                    currentStatus === 'Resolved'
                      ? 'var(--navy-200)'
                      : isCritical
                      ? 'var(--status-critical-border)'
                      : 'var(--status-warning-border)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '14px',
                  opacity: currentStatus === 'Resolved' ? 0.75 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Title & Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: 'var(--navy-900)',
                      }}
                    >
                      {alert.machine_id}
                    </span>

                    <span
                      className={`status-badge ${isCritical ? 'critical' : 'warning'}`}
                      style={{ fontSize: '11px', padding: '1px 7px' }}
                    >
                      {alert.severity || 'Warning'} ({Number(alert.risk_score || 0).toFixed(1)}%)
                    </span>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: '9999px',
                        backgroundColor:
                          currentStatus === 'Resolved'
                            ? 'var(--status-healthy-subtle)'
                            : currentStatus === 'Investigating' || currentStatus === 'In Review'
                            ? 'var(--primary-subtle)'
                            : 'var(--navy-100)',
                        color:
                          currentStatus === 'Resolved'
                            ? 'var(--status-healthy-text)'
                            : currentStatus === 'Investigating' || currentStatus === 'In Review'
                            ? 'var(--primary)'
                            : 'var(--navy-700)',
                        border: '1px solid var(--navy-200)',
                      }}
                    >
                      {currentStatus.toUpperCase()}
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
                      {alert.last_prediction_time || 'Recent'}
                    </span>
                  </div>

                  {/* Reason & Prescriptive Recommendation */}
                  <div style={{ marginTop: '6px' }}>
                    {alert.reason && (
                      <div style={{ fontSize: '12px', color: 'var(--navy-600)', marginBottom: '3px' }}>
                        <strong>Trigger:</strong> {alert.reason}
                      </div>
                    )}
                    <div style={{ fontSize: '12.5px', color: 'var(--navy-900)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--primary)' }}>Prescriptive Recommendation:</strong>{' '}
                      {alert.recommendation || 'Inspect equipment and verify nominal sensor telemetry channels.'}
                    </div>
                  </div>

                  {/* Sensor Snapshot Readings */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      marginTop: '8px',
                      fontSize: '11.5px',
                      color: 'var(--navy-600)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>Torque: <strong>{alert.Torque_Nm} Nm</strong></span>
                    <span>Tool Wear: <strong>{alert.Tool_wear_min} min</strong></span>
                    <span>Speed: <strong>{alert.Rotational_speed_rpm} RPM</strong></span>
                    {alert.Process_temperature_K && alert.Air_temperature_K && (
                      <span>ΔT: <strong>{(alert.Process_temperature_K - alert.Air_temperature_K).toFixed(1)} K</strong></span>
                    )}
                  </div>
                </div>

                {/* Action Buttons Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, minWidth: '130px' }}>
                  {/* Create Work Order Action */}
                  <button
                    onClick={() => handleGenerateWorkOrder(alert)}
                    disabled={isUpdating || isOrderCreated || currentStatus === 'Resolved'}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '11.5px', padding: '5px 10px', width: '100%' }}
                    title="Generate maintenance work order directly from this recommendation"
                  >
                    {isOrderCreated ? (
                      <>
                        <IconCheck size={13} />
                        WO Created!
                      </>
                    ) : (
                      <>
                        <IconWrench size={13} />
                        Create Work Order
                      </>
                    )}
                  </button>

                  {/* Status Toggle Action */}
                  {currentStatus !== 'Resolved' ? (
                    <button
                      onClick={() => handleStatusChange(alert, 'Resolved')}
                      disabled={isUpdating}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }}
                      title="Mark alert as resolved in MongoDB"
                    >
                      <IconCheckCircle size={12} />
                      Resolve Alert
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(alert, 'Active')}
                      disabled={isUpdating}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }}
                      title="Reopen alert to Active"
                    >
                      Reopen Alert
                    </button>
                  )}

                  {/* Diagnose Machine Modal Trigger */}
                  <button
                    onClick={() => setSelectedMachine(matchedMachine)}
                    className="btn btn-subtle btn-sm"
                    style={{ fontSize: '11px', padding: '4px 8px', width: '100%' }}
                    title="Inspect complete telemetry and feature distributions"
                  >
                    <IconEye size={12} />
                    Diagnose
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
