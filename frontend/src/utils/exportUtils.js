/**
 * exportUtils.js
 * Standardized RFC 4180 compliant CSV export utilities and helpers.
 */

/**
 * Escapes a cell value for CSV formatting.
 */
function escapeCSVValue(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}

/**
 * Converts array of objects to CSV string based on column definitions.
 * @param {Array<Object>} rows
 * @param {Array<{ key: string, label: string, formatter?: Function }>} columns
 */
export function convertToCSV(rows, columns) {
  if (!rows || rows.length === 0) {
    return columns.map(c => escapeCSVValue(c.label)).join(',');
  }

  const header = columns.map(c => escapeCSVValue(c.label)).join(',');
  const lines = rows.map(row => {
    return columns.map(col => {
      let val;
      if (typeof col.formatter === 'function') {
        val = col.formatter(row);
      } else if (col.key.includes('.')) {
        // Nested property access: e.g. "input_features.Air temperature [K]"
        val = col.key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), row);
      } else {
        val = row[col.key];
      }
      return escapeCSVValue(val);
    }).join(',');
  });

  return [header, ...lines].join('\r\n');
}

/**
 * Triggers a browser download of a CSV file.
 * @param {string} csvContent
 * @param {string} filename
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// Specialized Export Functions
// -------------------------------------------------------------

/**
 * Export machine fleet list to CSV
 */
export function exportMachinesToCSV(machines, filenamePrefix = 'machines_fleet') {
  const columns = [
    { key: 'machine_id', label: 'Machine ID', formatter: m => m.machine_id || m.id },
    { key: 'name', label: 'Machine Name' },
    { key: 'type', label: 'Type' },
    { key: 'health_status', label: 'Health Status' },
    { key: 'risk_score', label: 'Failure Risk (%)', formatter: m => m.risk_score !== undefined ? Number(m.risk_score).toFixed(2) : '' },
    { key: 'failure_prediction', label: 'Predicted Failure (0/1)' },
    { key: 'Air_temperature_K', label: 'Air Temp [K]' },
    { key: 'Process_temperature_K', label: 'Process Temp [K]' },
    { key: 'Rotational_speed_rpm', label: 'Rotational Speed [rpm]' },
    { key: 'Torque_Nm', label: 'Torque [Nm]' },
    { key: 'Tool_wear_min', label: 'Tool Wear [min]' },
    { key: 'is_anomaly', label: 'Is Anomaly', formatter: m => m.is_anomaly ? 'YES' : 'NO' },
    { key: 'anomaly_score', label: 'Anomaly Score' },
    { key: 'recommendation', label: 'Prescriptive Recommendation' },
    { key: 'updated_at', label: 'Last Updated', formatter: m => m.updated_at || m.last_prediction_time || '' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(machines, columns);
  downloadCSV(csv, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * Export prediction audit records to CSV
 */
export function exportPredictionsToCSV(predictions, filenamePrefix = 'predictions_audit') {
  const columns = [
    { key: 'prediction_id', label: 'Prediction ID', formatter: p => p.prediction_id || p.id || '' },
    { key: 'machine_id', label: 'Machine ID' },
    { key: 'created_at', label: 'Timestamp' },
    { key: 'failure_prediction', label: 'Failure Flag (1=Fail, 0=Nominal)' },
    { key: 'failure_probability', label: 'Probability', formatter: p => p.failure_probability !== undefined ? (p.failure_probability * 100).toFixed(2) + '%' : '' },
    { key: 'risk_score', label: 'Risk Score (%)', formatter: p => p.risk_score !== undefined ? Number(p.risk_score).toFixed(2) : '' },
    { key: 'health_status', label: 'Health Status' },
    { key: 'source', label: 'Source' },
    {
      key: 'air_temp',
      label: 'Air Temp [K]',
      formatter: p => p.input_features?.["Air temperature [K]"] ?? p.input_features?.Air_temperature_K ?? p.Air_temperature_K ?? '',
    },
    {
      key: 'proc_temp',
      label: 'Process Temp [K]',
      formatter: p => p.input_features?.["Process temperature [K]"] ?? p.input_features?.Process_temperature_K ?? p.Process_temperature_K ?? '',
    },
    {
      key: 'speed',
      label: 'Speed [rpm]',
      formatter: p => p.input_features?.["Rotational speed [rpm]"] ?? p.input_features?.Rotational_speed_rpm ?? p.Rotational_speed_rpm ?? '',
    },
    {
      key: 'torque',
      label: 'Torque [Nm]',
      formatter: p => p.input_features?.["Torque [Nm]"] ?? p.input_features?.Torque_Nm ?? p.Torque_Nm ?? '',
    },
    {
      key: 'wear',
      label: 'Tool Wear [min]',
      formatter: p => p.input_features?.["Tool wear [min]"] ?? p.input_features?.Tool_wear_min ?? p.Tool_wear_min ?? '',
    },
    { key: 'recommendation', label: 'Recommendation' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(predictions, columns);
  downloadCSV(csv, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * Export anomaly records to CSV
 */
export function exportAnomaliesToCSV(anomalies, filenamePrefix = 'anomalies_audit') {
  const columns = [
    { key: 'anomaly_id', label: 'Anomaly ID', formatter: a => a.anomaly_id || a.id || '' },
    { key: 'machine_id', label: 'Machine ID' },
    { key: 'created_at', label: 'Timestamp' },
    { key: 'is_anomaly', label: 'Anomaly Flag', formatter: a => a.is_anomaly ? 'ANOMALOUS' : 'NORMAL' },
    { key: 'anomaly_level', label: 'Severity Level' },
    { key: 'anomaly_score', label: 'Anomaly Score', formatter: a => a.anomaly_score !== undefined ? Number(a.anomaly_score).toFixed(2) : '' },
    { key: 'raw_score', label: 'Raw Model Score', formatter: a => a.raw_score !== undefined ? Number(a.raw_score).toFixed(4) : '' },
    { key: 'deviating_features', label: 'Deviating Telemetry Channels', formatter: a => Array.isArray(a.deviating_features) ? a.deviating_features.join('; ') : '' },
    { key: 'explanation', label: 'Diagnostic Explanation' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(anomalies, columns);
  downloadCSV(csv, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * Export alerts list to CSV
 */
export function exportAlertsToCSV(alerts, filenamePrefix = 'operational_alerts') {
  const columns = [
    { key: 'alert_id', label: 'Alert ID' },
    { key: 'machine_id', label: 'Machine ID' },
    { key: 'created_at', label: 'Created At' },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Workflow Status' },
    { key: 'alert_type', label: 'Alert Type' },
    { key: 'risk_score', label: 'Risk / Score', formatter: a => a.risk_score !== undefined ? Number(a.risk_score).toFixed(1) : '' },
    { key: 'reason', label: 'Trigger Reason' },
    { key: 'recommendation', label: 'Prescriptive Maintenance Recommendation' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(alerts, columns);
  downloadCSV(csv, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * Export maintenance work orders to CSV
 */
export function exportWorkOrdersToCSV(workOrders, filenamePrefix = 'maintenance_work_orders') {
  const columns = [
    { key: 'task_id', label: 'Work Order ID', formatter: t => t.task_id || t.id || '' },
    { key: 'machine_id', label: 'Machine ID', formatter: t => t.machine_id || t.machineId || '' },
    { key: 'action', label: 'Maintenance Action' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'scheduled_date', label: 'Scheduled Date', formatter: t => t.scheduled_date || t.scheduledDate || '' },
    { key: 'assigned_to', label: 'Assigned Specialist', formatter: t => t.assigned_to || t.assignedTo || '' },
    { key: 'notes', label: 'Notes', formatter: t => t.notes || '' },
    { key: 'created_at', label: 'Created Timestamp' },
    { key: 'updated_at', label: 'Last Updated' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(workOrders, columns);
  downloadCSV(csv, `${filenamePrefix}_${timestamp}.csv`);
}

/**
 * Export complete historical time-series for a machine
 */
export function exportMachineHistoryToCSV(historyRecords, machineId = 'machine') {
  const columns = [
    { key: 'timestamp', label: 'Timestamp', formatter: r => r.timestamp || r.created_at || '' },
    { key: 'cycle', label: 'Record / Cycle' },
    { key: 'risk', label: 'Failure Risk (%)' },
    { key: 'health_status', label: 'Health Status' },
    { key: 'airTemp', label: 'Air Temp [K]' },
    { key: 'procTemp', label: 'Process Temp [K]' },
    { key: 'tempDelta', label: 'Temp Delta (Process - Air) [K]' },
    { key: 'speed', label: 'Rotational Speed [rpm]' },
    { key: 'torque', label: 'Torque [Nm]' },
    { key: 'wear', label: 'Tool Wear [min]' },
    { key: 'is_anomaly', label: 'Is Anomaly', formatter: r => r.is_anomaly ? 'YES' : 'NO' },
    { key: 'anomaly_score', label: 'Anomaly Score' },
    { key: 'recommendation', label: 'Recommendation' },
    { key: 'source', label: 'Record Source' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(historyRecords, columns);
  downloadCSV(csv, `machine_${machineId}_history_${timestamp}.csv`);
}

/**
 * Export maintenance recommendations to CSV
 */
export function exportRecommendationsToCSV(recommendations, filenamePrefix = 'maintenance_recommendations') {
  const columns = [
    { key: 'recommendation_id', label: 'Recommendation ID' },
    { key: 'machine_id', label: 'Machine ID' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Workflow Status' },
    { key: 'urgency_timeframe', label: 'Urgency Timeframe' },
    { key: 'maintenance_type', label: 'Maintenance Type' },
    { key: 'reason', label: 'Primary Reason', formatter: r => r.reason || r.primary_reason || '' },
    { key: 'actions', label: 'Prescribed Actions', formatter: r => Array.isArray(r.actions) ? r.actions.join('; ') : (Array.isArray(r.recommended_actions) ? r.recommended_actions.join('; ') : '') },
    { key: 'risk_score', label: 'Risk Score (%)', formatter: r => r.risk_score !== undefined ? Number(r.risk_score).toFixed(1) : '' },
    { key: 'health_status', label: 'Health Status' },
    { key: 'created_at', label: 'Created At' },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csv = convertToCSV(recommendations, columns);
  downloadCSV(csv, `${filenamePrefix}_${timestamp}.csv`);
}

