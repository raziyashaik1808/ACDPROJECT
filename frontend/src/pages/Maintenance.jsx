import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import {
  IconWrench,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconPlus,
} from '../components/Icons';
import KpiCard from '../components/KpiCard';

export default function Maintenance() {
  const { tasks, updateTaskStatus, addTask, fleet } = useFleet();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    machineId: fleet[0]?.id || 'M-14860',
    action: '',
    priority: 'Medium',
    scheduledDate: 'Next Shift',
    assignedTo: '',
  });

  const totalTasks = tasks.length;
  const highPriorityCount = tasks.filter(t => t.priority.toLowerCase() === 'high').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
    return true;
  });

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!newTask.action.trim()) return;
    addTask(newTask);
    setShowAddModal(false);
    setNewTask({
      machineId: fleet[0]?.id || 'M-14860',
      action: '',
      priority: 'Medium',
      scheduledDate: 'Next Shift',
      assignedTo: '',
    });
  };

  const getPriorityBadge = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--status-critical-subtle)', color: 'var(--status-critical-text)', border: '1px solid var(--status-critical-border)' }}>
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--status-warning-subtle)', color: 'var(--status-warning-text)', border: '1px solid var(--status-warning-border)' }}>
            MEDIUM
          </span>
        );
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--navy-100)', color: 'var(--navy-700)', border: '1px solid var(--navy-200)' }}>
            LOW
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: 'var(--status-healthy-subtle)', color: 'var(--status-healthy-text)', border: '1px solid var(--status-healthy-border)' }}>
            ✓ Completed
          </span>
        );
      case 'In Progress':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: 'var(--primary-subtle)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}>
            ● In Progress
          </span>
        );
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: '#f8fafc', color: 'var(--navy-700)', border: '1px solid var(--navy-200)' }}>
            Pending
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}
        className="kpi-grid"
      >
        <KpiCard
          title="Total Work Orders"
          value={totalTasks}
          subtitle="Cumulative logged tasks"
          icon={<IconWrench size={20} />}
          badgeText="All Records"
          badgeType="info"
          indicatorColor="var(--primary)"
        />

        <KpiCard
          title="High Priority"
          value={highPriorityCount}
          subtitle="Critical machine interventions"
          icon={<IconAlertTriangle size={20} />}
          badgeText={highPriorityCount > 0 ? "Urgent" : "Nominal"}
          badgeType={highPriorityCount > 0 ? "critical" : "healthy"}
          indicatorColor="var(--status-critical)"
        />

        <KpiCard
          title="Active Interventions"
          value={inProgressCount}
          subtitle="Technicians dispatched"
          icon={<IconClock size={20} />}
          badgeText="In Progress"
          badgeType="warning"
          indicatorColor="var(--status-warning)"
        />

        <KpiCard
          title="Resolved Tasks"
          value={completedCount}
          subtitle="Preventive actions completed"
          icon={<IconCheck size={20} />}
          badgeText="Completed"
          badgeType="healthy"
          indicatorColor="var(--status-healthy)"
        />
      </div>

      {/* Main Work Orders Card */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div>
            <div className="pm-card-title">Maintenance Task Schedules & Work Orders</div>
            <div className="pm-card-subtitle">
              Prioritize corrective and scheduled preventive actions to minimize machine downtime
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status Filters */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--navy-100)',
                padding: '2px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {['ALL', 'Pending', 'In Progress', 'Completed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: statusFilter === s ? 600 : 500,
                    backgroundColor: statusFilter === s ? '#ffffff' : 'transparent',
                    color: statusFilter === s ? 'var(--navy-900)' : 'var(--navy-600)',
                    boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
            >
              <IconWrench size={14} />
              + New Work Order
            </button>
          </div>
        </div>

        {/* Work Orders Table */}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Machine ID</th>
                <th>Prescriptive Maintenance Action</th>
                <th>Priority</th>
                <th>Assigned Specialist</th>
                <th>Due / Schedule</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Update</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--navy-500)' }}>
                    No maintenance tasks found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.id}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--navy-900)' }}>{t.machineId}</strong>
                    </td>
                    <td style={{ maxWidth: '340px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--navy-900)', fontSize: '13px' }}>
                        {t.action}
                      </div>
                    </td>
                    <td>{getPriorityBadge(t.priority)}</td>
                    <td style={{ color: 'var(--navy-600)', fontSize: '12.5px' }}>
                      {t.assignedTo || 'Unassigned'}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--navy-600)' }}>
                        <IconClock size={12} />
                        {t.scheduledDate}
                      </span>
                    </td>
                    <td>{getStatusBadge(t.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {t.status !== 'Completed' && (
                          <button
                            onClick={() => updateTaskStatus(t.id, t.status === 'Pending' ? 'In Progress' : 'Completed')}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            {t.status === 'Pending' ? 'Start' : 'Complete'}
                          </button>
                        )}
                        {t.status === 'Completed' && (
                          <button
                            onClick={() => updateTaskStatus(t.id, 'In Progress')}
                            className="btn btn-subtle btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--navy-900)', marginBottom: '16px' }}>
              Create Maintenance Work Order
            </h2>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--navy-700)', marginBottom: '4px' }}>
                  Target Equipment
                </label>
                <select
                  value={newTask.machineId}
                  onChange={(e) => setNewTask({ ...newTask, machineId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--navy-200)',
                    fontSize: '13px',
                  }}
                >
                  {fleet.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.name || 'Unit'} ({m.health_status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--navy-700)', marginBottom: '4px' }}>
                  Maintenance Action Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspect spindle bearing and replenish lubricant"
                  value={newTask.action}
                  onChange={(e) => setNewTask({ ...newTask, action: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--navy-200)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--navy-700)', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--navy-200)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="High">High (Immediate)</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--navy-700)', marginBottom: '4px' }}>
                    Scheduled Time
                  </label>
                  <input
                    type="text"
                    value={newTask.scheduledDate}
                    onChange={(e) => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--navy-200)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--navy-700)', marginBottom: '4px' }}>
                  Assigned Technician
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Vance (Reliability)"
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--navy-200)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
