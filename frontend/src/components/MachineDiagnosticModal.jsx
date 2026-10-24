import React, { useState } from 'react';
import {
  IconClose,
  IconAlertTriangle,
  IconCheckCircle,
  IconWrench,
  IconActivity,
  IconShieldCheck,
  IconClock,
} from './Icons';
import { useFleet } from '../context/FleetContext';

export default function MachineDiagnosticModal({ machine, onClose }) {
  const { addTask } = useFleet();
  const [scheduled, setScheduled] = useState(false);

  if (!machine) return null;

  const isCritical = machine.health_status === 'Critical';
  const isWarning = machine.health_status === 'Warning';
  const riskColor = isCritical ? 'var(--status-critical)' : isWarning ? 'var(--status-warning)' : 'var(--status-healthy)';

  // Calculate sensor status tags
  const sensors = [
    {
      label: 'Air Temperature',
      value: `${machine.Air_temperature_K} K`,
      nominal: '298 - 302 K',
      isAbnormal: machine.Air_temperature_K > 304,
      note: machine.Air_temperature_K > 304 ? 'Ambient heat elevated' : 'Normal',
    },
    {
      label: 'Process Temperature',
      value: `${machine.Process_temperature_K} K`,
      nominal: '308 - 312 K',
      isAbnormal: machine.Process_temperature_K > 314,
      note: machine.Process_temperature_K > 314 ? 'Thermal dissipation stress' : 'Normal',
    },
    {
      label: 'Thermal Differential (ΔT)',
      value: `${(machine.Process_temperature_K - machine.Air_temperature_K).toFixed(1)} K`,
      nominal: '> 8.6 K',
      isAbnormal: (machine.Process_temperature_K - machine.Air_temperature_K) < 8.6,
      note: (machine.Process_temperature_K - machine.Air_temperature_K) < 8.6 ? 'Heat dissipation warning (HDF)' : 'Adequate cooling',
    },
    {
      label: 'Rotational Speed',
      value: `${machine.Rotational_speed_rpm} RPM`,
      nominal: '1400 - 1650 RPM',
      isAbnormal: machine.Rotational_speed_rpm < 1350 || machine.Rotational_speed_rpm > 1750,
      note: machine.Rotational_speed_rpm < 1350 ? 'Sub-nominal rotational speed' : 'Normal',
    },
    {
      label: 'Operating Torque',
      value: `${machine.Torque_Nm} Nm`,
      nominal: '35 - 50 Nm',
      isAbnormal: machine.Torque_Nm > 55,
      note: machine.Torque_Nm > 55 ? 'Overstrain / High mechanical load (OSF)' : 'Normal',
    },
    {
      label: 'Tool Wear Duration',
      value: `${machine.Tool_wear_min} min`,
      nominal: '< 180 min',
      isAbnormal: machine.Tool_wear_min >= 200,
      note: machine.Tool_wear_min >= 200 ? 'Severe tool wear (TWF risk)' : 'Acceptable',
    },
  ];

  const handleCreateWorkOrder = () => {
    addTask({
      machineId: machine.id,
      action: machine.recommendation,
      priority: isCritical ? 'High' : isWarning ? 'Medium' : 'Low',
      scheduledDate: 'Immediate',
      assignedTo: 'Assigned via Telemetry Modal',
    });
    setScheduled(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid var(--navy-200)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--navy-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            borderTopLeftRadius: 'var(--radius-xl)',
            borderTopRightRadius: 'var(--radius-xl)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy-900)' }}>
                {machine.id} Diagnostics
              </h2>
              <span className={`status-badge ${machine.health_status.toLowerCase()}`}>
                {machine.health_status}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--navy-500)', marginTop: '2px' }}>
              {machine.name || 'Industrial Telemetry Unit'} &bull; Type {machine.type || 'Standard'}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--navy-400)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <IconClose size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {/* Risk Overview Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#bbf7d0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy-600)', textTransform: 'uppercase' }}>
                AI Failure Probability
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: riskColor, lineHeight: 1.2 }}>
                {machine.risk_score.toFixed(1)}% Risk
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--navy-700)', marginTop: '4px' }}>
                <strong>Recommendation:</strong> {machine.recommendation}
              </div>
            </div>

            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: `5px solid ${riskColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '15px',
                color: riskColor,
                backgroundColor: '#ffffff',
                flexShrink: 0,
              }}
            >
              {machine.failure_prediction === 1 ? 'FAIL' : 'OK'}
            </div>
          </div>

          {/* Detailed Sensor Telemetry Grid */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--navy-900)', marginBottom: '12px' }}>
              Active Sensor Telemetry vs Safe Operating Thresholds
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '10px',
              }}
            >
              {sensors.map((sensor, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${sensor.isAbnormal ? 'var(--status-critical-border)' : 'var(--navy-200)'}`,
                    backgroundColor: sensor.isAbnormal ? '#fffaf9' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--navy-600)', fontWeight: 500 }}>
                      {sensor.label}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: sensor.isAbnormal ? 'var(--status-critical-subtle)' : 'var(--status-healthy-subtle)',
                        color: sensor.isAbnormal ? 'var(--status-critical-text)' : 'var(--status-healthy-text)',
                      }}
                    >
                      {sensor.isAbnormal ? 'ABNORMAL' : 'NOMINAL'}
                    </span>
                  </div>

                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--navy-900)', margin: '4px 0' }}>
                    {sensor.value}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--navy-500)' }}>
                    <span>Nominal: {sensor.nominal}</span>
                    <span style={{ color: sensor.isAbnormal ? 'var(--status-critical)' : 'inherit' }}>
                      {sensor.note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action / Work Order Dispatch */}
          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid var(--navy-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--navy-500)' }}>
              Source: ML Model Inference &bull; Feature Importance: Torque &gt; Speed &gt; Tool Wear
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} className="btn btn-secondary btn-sm">
                Close
              </button>
              <button
                onClick={handleCreateWorkOrder}
                disabled={scheduled}
                className="btn btn-primary btn-sm"
              >
                <IconWrench size={14} />
                {scheduled ? 'Work Order Scheduled!' : 'Schedule Maintenance Work Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
