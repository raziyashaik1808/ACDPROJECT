import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../services/api';

const FleetContext = createContext(null);

export const INITIAL_FLEET = [
  {
    id: "M-14860",
    machine_id: "M-14860",
    name: "CNC Milling Station 01",
    type: "M",
    Air_temperature_K: 298.1,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1551,
    Torque_Nm: 42.8,
    Tool_wear_min: 12,
    failure_prediction: 0,
    failure_probability: 0.0014,
    risk_score: 0.14,
    health_status: "Healthy",
    recommendation: "No immediate action required. Continue routine monitoring.",
    last_prediction_time: "Just now",
  },
  {
    id: "L-47181",
    machine_id: "L-47181",
    name: "Heavy Lathe Unit 02",
    type: "L",
    Air_temperature_K: 298.2,
    Process_temperature_K: 308.7,
    Rotational_speed_rpm: 1408,
    Torque_Nm: 46.3,
    Tool_wear_min: 24,
    failure_prediction: 0,
    failure_probability: 0.0018,
    risk_score: 0.18,
    health_status: "Healthy",
    recommendation: "No immediate action required. Continue routine monitoring.",
    last_prediction_time: "2 mins ago",
  },
  {
    id: "L-47182",
    machine_id: "L-47182",
    name: "Drilling Center 03",
    type: "L",
    Air_temperature_K: 298.1,
    Process_temperature_K: 308.5,
    Rotational_speed_rpm: 1498,
    Torque_Nm: 49.4,
    Tool_wear_min: 45,
    failure_prediction: 0,
    failure_probability: 0.0022,
    risk_score: 0.22,
    health_status: "Healthy",
    recommendation: "No immediate action required. Continue routine monitoring.",
    last_prediction_time: "5 mins ago",
  },
  {
    id: "L-47183",
    machine_id: "L-47183",
    name: "Precision Boring Unit 04",
    type: "L",
    Air_temperature_K: 298.2,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1433,
    Torque_Nm: 39.5,
    Tool_wear_min: 58,
    failure_prediction: 0,
    failure_probability: 0.0019,
    risk_score: 0.19,
    health_status: "Healthy",
    recommendation: "No immediate action required. Continue routine monitoring.",
    last_prediction_time: "8 mins ago",
  },
  {
    id: "L-47184",
    machine_id: "L-47184",
    name: "Hydraulic Press 05",
    type: "L",
    Air_temperature_K: 302.5,
    Process_temperature_K: 312.2,
    Rotational_speed_rpm: 1380,
    Torque_Nm: 54.0,
    Tool_wear_min: 172,
    failure_prediction: 0,
    failure_probability: 0.442,
    risk_score: 44.2,
    health_status: "Warning",
    recommendation: "Check motor load and shaft alignment.",
    last_prediction_time: "12 mins ago",
  },
  {
    id: "M-14865",
    machine_id: "M-14865",
    name: "Rotary Grinder 06",
    type: "M",
    Air_temperature_K: 306.0,
    Process_temperature_K: 315.0,
    Rotational_speed_rpm: 1350,
    Torque_Nm: 58.0,
    Tool_wear_min: 220,
    failure_prediction: 1,
    failure_probability: 0.625,
    risk_score: 62.5,
    health_status: "Warning",
    recommendation: "Inspect cooling system and consider tool replacement.",
    last_prediction_time: "15 mins ago",
  },
  {
    id: "L-47186",
    machine_id: "L-47186",
    name: "Automated Saw 07",
    type: "L",
    Air_temperature_K: 298.1,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1558,
    Torque_Nm: 42.4,
    Tool_wear_min: 88,
    failure_prediction: 0,
    failure_probability: 0.0015,
    risk_score: 0.15,
    health_status: "Healthy",
    recommendation: "No immediate action required. Continue routine monitoring.",
    last_prediction_time: "19 mins ago",
  },
  {
    id: "L-47187",
    machine_id: "L-47187",
    name: "Gear Shaper 08",
    type: "L",
    Air_temperature_K: 298.1,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1527,
    Torque_Nm: 40.2,
    Tool_wear_min: 96,
    failure_prediction: 0,
    failure_probability: 0.0016,
    risk_score: 0.16,
    health_status: "Healthy",
    recommendation: "No immediate action required. Continue routine monitoring.",
    last_prediction_time: "24 mins ago",
  },
  {
    id: "L-47230",
    machine_id: "L-47230",
    name: "Extrusion Mill 09",
    type: "L",
    Air_temperature_K: 305.5,
    Process_temperature_K: 314.8,
    Rotational_speed_rpm: 1290,
    Torque_Nm: 66.5,
    Tool_wear_min: 198,
    failure_prediction: 1,
    failure_probability: 0.785,
    risk_score: 78.5,
    health_status: "Critical",
    recommendation: "Inspect overheating and vibration-related components. Reduce motor load.",
    last_prediction_time: "28 mins ago",
  },
  {
    id: "L-47257",
    machine_id: "L-47257",
    name: "Heavy Machining Center 10",
    type: "L",
    Air_temperature_K: 308.2,
    Process_temperature_K: 316.5,
    Rotational_speed_rpm: 1260,
    Torque_Nm: 69.2,
    Tool_wear_min: 246,
    failure_prediction: 1,
    failure_probability: 0.894,
    risk_score: 89.4,
    health_status: "Critical",
    recommendation: "Inspect cooling system and consider tool replacement immediately.",
    last_prediction_time: "31 mins ago",
  },
];

export const INITIAL_TASKS = [
  {
    id: "WO-8821",
    machineId: "L-47257",
    action: "Cooling system flush & cutter tool replacement",
    priority: "High",
    scheduledDate: "Immediate",
    status: "Pending",
    assignedTo: "Marcus Vance (Senior Tech)",
  },
  {
    id: "WO-8822",
    machineId: "L-47230",
    action: "Drive motor vibration test & torque recalibration",
    priority: "High",
    scheduledDate: "Today, 16:00",
    status: "In Progress",
    assignedTo: "Sarah Jenkins (Mechanical)",
  },
  {
    id: "WO-8823",
    machineId: "M-14865",
    action: "Spindle tool wear measurement & thermal sensor audit",
    priority: "Medium",
    scheduledDate: "Tomorrow, 09:30",
    status: "Pending",
    assignedTo: "David Liu (Reliability)",
  },
  {
    id: "WO-8824",
    machineId: "L-47184",
    action: "Hydraulic pressure inspection & seal check",
    priority: "Medium",
    scheduledDate: "Oct 26, 2026",
    status: "Pending",
    assignedTo: "Sarah Jenkins (Mechanical)",
  },
  {
    id: "WO-8820",
    machineId: "M-14860",
    action: "Scheduled 200-hour preventive lubrication & calibration",
    priority: "Low",
    scheduledDate: "Oct 22, 2026",
    status: "Completed",
    assignedTo: "Elena Ramos (Field Tech)",
  },
];

export function FleetProvider({ children }) {
  const [fleet, setFleet] = useState(INITIAL_FLEET);
  const [dataSource, setDataSource] = useState("MongoDB Local: predictive_maintenance.machines");
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [alerts, setAlerts] = useState([]);
  const [timeRange, setTimeRange] = useState("Live Shift (24h)");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [dbStatus, setDbStatus] = useState({ connected: false, collections: {} });

  // Map backend machine document to frontend format
  const formatMachineDoc = (m) => ({
    id: m.machine_id,
    machine_id: m.machine_id,
    name: m.name || `Machine ${m.machine_id}`,
    type: m.type || "M",
    Air_temperature_K: m.Air_temperature_K,
    Process_temperature_K: m.Process_temperature_K,
    Rotational_speed_rpm: m.Rotational_speed_rpm,
    Torque_Nm: m.Torque_Nm,
    Tool_wear_min: m.Tool_wear_min,
    failure_prediction: m.failure_prediction,
    failure_probability: m.failure_probability,
    risk_score: m.risk_score,
    health_status: m.health_status,
    recommendation: m.recommendation || "System operational. Monitor nominal parameters.",
    is_anomaly: m.is_anomaly || false,
    anomaly_score: m.anomaly_score || 0.0,
    last_prediction_time: m.updated_at ? new Date(m.updated_at).toLocaleTimeString() : "Recent",
  });

  // Map backend task document to frontend format
  const formatTaskDoc = (t) => ({
    id: t.task_id,
    task_id: t.task_id,
    machineId: t.machine_id,
    action: t.action,
    priority: t.priority,
    scheduledDate: t.scheduled_date,
    status: t.status,
    assignedTo: t.assigned_to,
  });

  // Map backend alert document to frontend format
  const formatAlertDoc = (a) => ({
    id: a.alert_id,
    alert_id: a.alert_id,
    machine_id: a.machine_id,
    health_status: a.severity,
    severity: a.severity,
    risk_score: a.risk_score,
    recommendation: a.recommendation,
    reason: a.reason,
    status: a.status,
    last_prediction_time: a.created_at ? new Date(a.created_at).toLocaleTimeString() : "Recent",
    Torque_Nm: a.sensor_readings?.Torque_Nm || 45.0,
    Tool_wear_min: a.sensor_readings?.Tool_wear_min || 50,
    Rotational_speed_rpm: a.sensor_readings?.Rotational_speed_rpm || 1500,
    Air_temperature_K: a.sensor_readings?.Air_temperature_K || 300.0,
    Process_temperature_K: a.sensor_readings?.Process_temperature_K || 310.0,
  });

  // Synchronize state with local MongoDB through FastAPI
  const loadDataFromBackend = useCallback(async () => {
    try {
      // 1. Health & Database check
      const healthRes = await API.get('/health');
      setDbStatus({
        connected: healthRes.data.status === 'healthy',
        collections: healthRes.data.collections || {},
      });
      setBackendOnline(true);

      // 2. Fetch Machines from MongoDB
      const machinesRes = await API.get('/machines');
      if (Array.isArray(machinesRes.data) && machinesRes.data.length > 0) {
        setFleet(machinesRes.data.map(formatMachineDoc));
        setDataSource(`MongoDB Local: predictive_maintenance.machines (${machinesRes.data.length} Units)`);
      }

      // 3. Fetch Maintenance Work Orders from MongoDB
      const tasksRes = await API.get('/maintenance/tasks');
      if (Array.isArray(tasksRes.data) && tasksRes.data.length > 0) {
        setTasks(tasksRes.data.map(formatTaskDoc));
      }

      // 4. Fetch Active Alerts from MongoDB
      const alertsRes = await API.get('/alerts?status=Active');
      if (Array.isArray(alertsRes.data)) {
        setAlerts(alertsRes.data.map(formatAlertDoc));
      }
    } catch (err) {
      console.warn("MongoDB API sync error, keeping fallback state:", err);
      setBackendOnline(false);
      setDbStatus({ connected: false, collections: {} });
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadDataFromBackend();
  }, [loadDataFromBackend]);

  // Refresh predictions with backend and sync with MongoDB
  const refreshFleet = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDataFromBackend();
    } catch (e) {
      console.warn("Backend unavailable during refresh:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDataFromBackend]);

  // Load uploaded batch predictions
  const applyBatchPredictions = async (batchPredictions, filename = "Uploaded_Data.csv") => {
    const formatted = batchPredictions.map((row, idx) => ({
      id: row.id || `BAT-${String(idx + 1).padStart(3, '0')}`,
      machine_id: row.id || `BAT-${String(idx + 1).padStart(3, '0')}`,
      name: `Equipment Unit ${idx + 1}`,
      type: row.Type || "M",
      Air_temperature_K: row["Air temperature [K]"] || row.Air_temperature_K || 300.0,
      Process_temperature_K: row["Process temperature [K]"] || row.Process_temperature_K || 310.0,
      Rotational_speed_rpm: row["Rotational speed [rpm]"] || row.Rotational_speed_rpm || 1500,
      Torque_Nm: row["Torque [Nm]"] || row.Torque_Nm || 45.0,
      Tool_wear_min: row["Tool wear [min]"] || row.Tool_wear_min || 100,
      failure_prediction: row.failure_prediction ?? (row.risk_score > 70 ? 1 : 0),
      failure_probability: row.failure_probability ?? Number((row.risk_score / 100).toFixed(4)),
      risk_score: row.risk_score ?? 10.0,
      health_status: row.health_status || (row.risk_score > 70 ? "Critical" : row.risk_score > 30 ? "Warning" : "Healthy"),
      recommendation: row.recommendation || "System operational. Monitor nominal sensor parameters.",
      last_prediction_time: "Just now",
    }));

    setFleet(formatted);
    setDataSource(`Batch Feed: ${filename} (${formatted.length} Machines)`);

    // Reload alerts and tasks from MongoDB since batch upload created persistent records
    try {
      const alertsRes = await API.get('/alerts?status=Active');
      if (Array.isArray(alertsRes.data)) {
        setAlerts(alertsRes.data.map(formatAlertDoc));
      }
    } catch (e) {
      console.warn("Could not reload alerts after batch:", e);
    }
  };

  const resetToSampleData = async () => {
    try {
      await loadDataFromBackend();
    } catch (e) {
      setFleet(INITIAL_FLEET);
      setTasks(INITIAL_TASKS);
    }
  };

  // Persist work order status update to MongoDB
  const updateTaskStatus = async (taskId, newStatus) => {
    // Optimistic UI update
    setTasks(prev =>
      prev.map(t => (t.id === taskId || t.task_id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await API.put(`/maintenance/tasks/${taskId}/status`, { status: newStatus });
    } catch (err) {
      console.error("Failed to persist task status to MongoDB:", err);
    }
  };

  // Persist new work order to MongoDB
  const addTask = async (newTask) => {
    try {
      const payload = {
        machine_id: newTask.machineId || newTask.machine_id,
        action: newTask.action,
        priority: newTask.priority || "Medium",
        scheduled_date: newTask.scheduledDate || newTask.scheduled_date || "Next Shift",
        assigned_to: newTask.assignedTo || newTask.assigned_to || "Industrial Specialist",
      };
      const res = await API.post('/maintenance/tasks', payload);
      const savedTask = formatTaskDoc(res.data);
      setTasks(prev => [savedTask, ...prev]);
    } catch (err) {
      console.error("Failed to save task to MongoDB:", err);
      // Fallback local addition if network blip
      setTasks(prev => [
        {
          id: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "Pending",
          ...newTask,
        },
        ...prev,
      ]);
    }
  };

  // Derived counts
  const healthyCount = fleet.filter(m => m.health_status === "Healthy").length;
  const warningCount = fleet.filter(m => m.health_status === "Warning").length;
  const criticalCount = fleet.filter(m => m.health_status === "Critical").length;
  const totalCount = fleet.length;

  return (
    <FleetContext.Provider
      value={{
        fleet,
        setFleet,
        dataSource,
        timeRange,
        setTimeRange,
        isRefreshing,
        refreshFleet,
        applyBatchPredictions,
        resetToSampleData,
        tasks,
        updateTaskStatus,
        addTask,
        selectedMachine,
        setSelectedMachine,
        backendOnline,
        dbStatus,
        healthyCount,
        warningCount,
        criticalCount,
        totalCount,
        alerts,
        loadDataFromBackend,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const context = useContext(FleetContext);
  if (!context) {
    throw new Error("useFleet must be used within a FleetProvider");
  }
  return context;
}
