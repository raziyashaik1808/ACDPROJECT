import React from 'react';
import {
  IconServer,
  IconCheckCircle,
  IconAlertTriangle,
  IconAlertOctagon,
  IconSparkles,
} from '../components/Icons';
import KpiCard from '../components/KpiCard';
import FailureRiskChart from '../components/charts/FailureRiskChart';
import HealthDistributionChart from '../components/charts/HealthDistributionChart';
import ParameterTrendsChart from '../components/charts/ParameterTrendsChart';
import FailureRiskAnalyticsChart from '../components/charts/FailureRiskAnalyticsChart';
import AlertsPanel from '../components/AlertsPanel';
import MaintenancePanel from '../components/MaintenancePanel';
import MachineTable from '../components/MachineTable';
import { useFleet } from '../context/FleetContext';

export default function Dashboard() {
  const {
    totalCount,
    healthyCount,
    warningCount,
    criticalCount,
    refreshFleet,
    isRefreshing,
  } = useFleet();

  const healthyPct = totalCount > 0 ? ((healthyCount / totalCount) * 100).toFixed(0) : 0;
  const warningPct = totalCount > 0 ? ((warningCount / totalCount) * 100).toFixed(0) : 0;
  const criticalPct = totalCount > 0 ? ((criticalCount / totalCount) * 100).toFixed(0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Responsive KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}
        className="kpi-grid"
      >
        <KpiCard
          title="Total Monitored"
          value={totalCount}
          subtitle="Continuous telemetry fleet"
          icon={<IconServer size={20} />}
          badgeText="Active Fleet"
          badgeType="info"
          indicatorColor="var(--primary)"
        />

        <KpiCard
          title="Healthy Machines"
          value={healthyCount}
          subtitle={`${healthyPct}% of fleet optimal`}
          icon={<IconCheckCircle size={20} />}
          badgeText={`${healthyPct}% Optimal`}
          badgeType="healthy"
          indicatorColor="var(--status-healthy)"
        />

        <KpiCard
          title="Warning Condition"
          value={warningCount}
          subtitle={`${warningPct}% approaching thresholds`}
          icon={<IconAlertTriangle size={20} />}
          badgeText="Inspect Soon"
          badgeType="warning"
          indicatorColor="var(--status-warning)"
        />

        <KpiCard
          title="Critical Failures"
          value={criticalCount}
          subtitle={criticalCount > 0 ? "Immediate action required" : "Zero active failures"}
          icon={<IconAlertOctagon size={20} />}
          badgeText={criticalCount > 0 ? "Action Required" : "Nominal"}
          badgeType={criticalCount > 0 ? "critical" : "healthy"}
          indicatorColor="var(--status-critical)"
        />
      </div>

      {/* Balanced 2-Column Analytics Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}
        className="charts-grid-row"
      >
        <FailureRiskChart />
        <HealthDistributionChart />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
        }}
        className="charts-grid-row"
      >
        <ParameterTrendsChart />
        <FailureRiskAnalyticsChart />
      </div>

      {/* Recent Alerts Panel */}
      <AlertsPanel />

      {/* Upcoming Maintenance Tasks Panel */}
      <MaintenancePanel />

      {/* Machine Data Table */}
      <MachineTable />

      <style>{`
        @media (max-width: 1024px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .charts-grid-row {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 580px) {
          .kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}