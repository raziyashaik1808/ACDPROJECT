import React from 'react';
import { Link } from 'react-router-dom';
import {
  IconWrench,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconChevronRight,
} from './Icons';
import { useFleet } from '../context/FleetContext';

export default function MaintenancePanel() {
  const { tasks, updateTaskStatus, setSelectedMachine, fleet } = useFleet();

  const getPriorityBadge = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: 'var(--status-critical-subtle)',
              color: 'var(--status-critical-text)',
              border: '1px solid var(--status-critical-border)',
            }}
          >
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'var(--status-warning-subtle)',
              color: 'var(--status-warning-text)',
              border: '1px solid var(--status-warning-border)',
            }}
          >
            MED
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'var(--navy-100)',
              color: 'var(--navy-700)',
              border: '1px solid var(--navy-200)',
            }}
          >
            LOW
          </span>
        );
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Completed':
        return {
          bg: 'var(--status-healthy-subtle)',
          text: 'var(--status-healthy-text)',
          border: 'var(--status-healthy-border)',
        };
      case 'In Progress':
        return {
          bg: 'var(--primary-subtle)',
          text: 'var(--primary)',
          border: 'var(--primary-border)',
        };
      default: // Pending
        return {
          bg: '#f8fafc',
          text: 'var(--navy-700)',
          border: 'var(--navy-200)',
        };
    }
  };

  const handleNextStatus = (taskId, currentStatus) => {
    if (currentStatus === 'Pending') {
      updateTaskStatus(taskId, 'In Progress');
    } else if (currentStatus === 'In Progress') {
      updateTaskStatus(taskId, 'Completed');
    } else {
      updateTaskStatus(taskId, 'Pending');
    }
  };

  return (
    <div className="pm-card" style={{ marginTop: '20px' }}>
      <div className="pm-card-header">
        <div>
          <div className="pm-card-title">
            <IconWrench size={18} style={{ color: 'var(--primary)' }} />
            Upcoming Maintenance Schedule & Prescriptive Actions
          </div>
          <div className="pm-card-subtitle">
            Automated work orders generated from predictive failure risks
          </div>
        </div>

        <Link to="/maintenance" className="btn btn-secondary btn-sm">
          <span>Manage All Tasks</span>
          <IconChevronRight size={13} />
        </Link>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Equipment ID</th>
              <th>Prescriptive Maintenance Action</th>
              <th>Priority</th>
              <th>Assigned Technician</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 5).map((task) => {
              const statusStyle = getStatusStyle(task.status);
              const targetMachine = fleet.find(m => m.id === task.machineId);

              return (
                <tr key={task.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--navy-900)' }}>
                      {task.id}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => targetMachine && setSelectedMachine(targetMachine)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        cursor: targetMachine ? 'pointer' : 'default',
                        textDecoration: 'underline',
                        padding: 0,
                        fontSize: '13px',
                      }}
                      title="Inspect Machine Diagnostics"
                    >
                      {task.machineId}
                    </button>
                  </td>
                  <td style={{ maxWidth: '320px' }}>
                    <div style={{ fontWeight: 500, color: 'var(--navy-900)' }}>
                      {task.action}
                    </div>
                  </td>
                  <td>{getPriorityBadge(task.priority)}</td>
                  <td style={{ color: 'var(--navy-600)', fontSize: '12.5px' }}>
                    {task.assignedTo || 'Unassigned'}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--navy-600)', fontSize: '12px' }}>
                      <IconClock size={12} />
                      {task.scheduledDate}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleNextStatus(task.id, task.status)}
                      style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                        border: `1px solid ${statusStyle.border}`,
                        padding: '3px 9px',
                        borderRadius: '9999px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      title="Click to toggle status: Pending -> In Progress -> Completed"
                    >
                      {task.status === 'Completed' && <IconCheck size={11} />}
                      {task.status}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleNextStatus(task.id, task.status)}
                      className="btn btn-subtle btn-sm"
                      style={{ fontSize: '11.5px', padding: '4px 8px' }}
                    >
                      {task.status === 'Completed' ? 'Reopen' : 'Advance'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
