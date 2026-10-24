import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MachineDiagnosticModal from './MachineDiagnosticModal';
import { useFleet } from '../context/FleetContext';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { selectedMachine, setSelectedMachine } = useFleet();

  // Determine current page title & subtitle for Header
  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return {
          title: "Equipment Health Overview",
          subtitle: "Monitor equipment condition, failure risk, and maintenance activity.",
        };
      case '/machines':
        return {
          title: "Industrial Equipment Fleet",
          subtitle: "Real-time telemetry, operating states, and unit diagnostics.",
        };
      case '/upload':
        return {
          title: "Sensor Data Upload & Batch Inference",
          subtitle: "Upload industrial CSV telemetry to execute batch predictive maintenance.",
        };
      case '/predictions':
        return {
          title: "AI Inference & Anomaly Diagnostics",
          subtitle: "Live sensor parameter simulation and real-time failure probability estimation.",
        };
      case '/maintenance':
        return {
          title: "Predictive Maintenance Work Orders",
          subtitle: "Track, schedule, and resolve automated prescriptive maintenance tasks.",
        };
      case '/history':
        return {
          title: "Telemetry & Operational History",
          subtitle: "Historical sensor trends, thermal differentials, and tool wear progression.",
        };
      case '/metrics':
        return {
          title: "AI Model Performance & Evaluation",
          subtitle: "Random Forest classifier metrics, confusion matrix, and feature importances.",
        };
      default:
        return {
          title: "Industrial Predictive Maintenance",
          subtitle: "Equipment condition monitoring & AI failure prediction.",
        };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Wrapper */}
      <div
        className="main-wrapper"
        style={{
          marginLeft: collapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)',
        }}
      >
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onOpenMobileNav={() => setMobileOpen(true)}
        />

        <main className="content-container">
          {children}
        </main>
      </div>

      {/* Diagnostic Details Modal */}
      {selectedMachine && (
        <MachineDiagnosticModal
          machine={selectedMachine}
          onClose={() => setSelectedMachine(null)}
        />
      )}

      <style>{`
        @media (max-width: 1024px) {
          .main-wrapper {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}